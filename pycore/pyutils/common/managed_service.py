# -*- coding: utf-8 -*-
"""
Unified managed-service lifecycle for pycore.

Implements the shared lifecycle/concurrency contract defined in
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md
(§2 concurrency rules, §3 the manager). This module owns idempotent start /
single-active / idle auto-shutdown / busy (in-flight) protection; orchestrators
own priority; the UI only reads status.

Engine taxonomy (spec §1): class A cloud/CLI providers are unmanaged; class B
in-process models load lazily and unload independently; class C API servers use
Popen, HTTP health, and process termination. Incompatible class-C engines use
dedicated venvs.

Contract enforced here:
  - code identity (class C): every server pycore owns declares its launch
    script set; the manager digests it into an expected code id, injects it
    into the launch environment (SERVER_CODE_ID_ENV), and compares it with the
    id the live server reports in its lifecycle status. A listener reporting no id or a
    different id (stale orphan from a previous worker, pre-contract process,
    drifted staging copy) is never adopted and is reclaimed so a start always
    loads current code. Busy services are exempt until their next lease.
  - default no memory: nothing stays loaded by default; a service runs only
    while being called, and is auto-stopped after `idle_shutdown_s` (default
    180s = 3 minutes; 0 disables) with no calls. Keys: TTS `server_idle_shutdown_s`,
    STT `model_idle_shutdown_s`.
  - idempotent start on call: `ensure_running(name)`, `lease(name)`, and
    `retain_async(name, owner, ttl_s)` reuse a running service.
  - single-active applies to kind=="server" ONLY: starting one server stops the
    OTHER servers in the SAME category ("tts"/"stt") - EXCEPT any peer with an
    in-flight call (in-flight > 0 is never killed). Starting a class-B model
    never evicts anything (models run in parallel).
  - busy protection is ABSOLUTE: a service with `_in_flight > 0` is never
    stopped/unloaded - not by single-active, not by the idle watchdog. Callers
    MUST wrap synthesis/transcription in `lease(name)` so startup and in-flight
    ownership are one atomic state transition.

start_command() may return (cwd, argv) OR (cwd, argv, env). When an `env` dict is
returned the subprocess launches with it; for a service run under an ISOLATED
interpreter (argv[0] != this interpreter, e.g. qwen3tts's venv) PYTHONPATH /
PYTHONHOME are stripped so the main interpreter's site-packages cannot shadow the
venv (spec §5).

Settings persist in user_data.json per category as prefixed `auto_manage`,
`single_active`, `idle_shutdown_s`, and `enabled` keys.
"""

import atexit
import copy
import hashlib
import subprocess
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    register_serialized_error_type,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

from pycore.pyutils.common.managed_service_process import (
    CODE_IDENTITY_CURRENT as _CODE_IDENTITY_CURRENT,
    CODE_IDENTITY_DISABLED as _CODE_IDENTITY_DISABLED,
    CODE_IDENTITY_STALE as _CODE_IDENTITY_STALE,
    CODE_IDENTITY_UNKNOWN as _CODE_IDENTITY_UNKNOWN,
    READY_SIGNAL_PREFIX as _READY_SIGNAL_PREFIX,
    SERVER_CODE_ID_ENV,
    START_TIMEOUT_SECONDS as _START_TIMEOUT_S,
    ManagedServiceProcessMixin,
)


DEFAULT_IDLE_S = 180
_WATCHDOG_POLL_S = 5.0
_RUN_CACHE_TTL_S = 10.0
_SETTINGS_SIGNAL_PREFIX = "managed.service.settings."


def service_script_code_id(scripts: List[Path]) -> str:
    """Stable identity of one class-C launch script set.

    sha256 over the sorted (file name, bytes) pairs of the given scripts.
    Missing files are skipped; an empty result ("") disables the code-identity
    contract for that service (foreign-codebase servers, no probe)."""
    entries = []
    for path in scripts or [] :
        script = Path(path)
        if script.is_file():
            entries.append((script.name, script.read_bytes()))
    if not entries:
        return ""
    digest = hashlib.sha256()
    for name, payload in sorted(entries):
        digest.update(name.encode("utf-8"))
        digest.update(b"\x1f")
        digest.update(payload)
    return digest.hexdigest()[:16]


class ManagedServiceUnavailable(RuntimeError):
    pass


# Lease acquisition runs on the serialized state-owner thread; registering the
# type keeps `except ManagedServiceUnavailable` working for callers across the
# THREAD_BUS boundary instead of surfacing a flattened RuntimeError.
register_serialized_error_type(ManagedServiceUnavailable)


@dataclass
class CategorySettings:
    """Where + how a category's settings are persisted."""
    section: str
    prefix: str               # "server_" for tts (legacy), "model_" for stt
    idle_default: int = DEFAULT_IDLE_S
    auto_manage_default: bool = True
    single_active_default: bool = True


@dataclass
class ServiceSpec:
    name: str
    category: str
    kind: str                  # "server" | "model"
    installed: Callable[[], bool]
    config_ready: Callable[[], bool] = field(default=lambda: True)
    # kind="server": returns (cwd, argv) OR (cwd, argv, env). An env dict is used
    # as the subprocess environment; for an isolated interpreter PYTHONPATH/
    # PYTHONHOME are stripped (see ManagedServiceManager._launch_env).
    start_command: Optional[Callable[[], Optional[Tuple]]] = None
    health: Optional[Callable[[], bool]] = None
    # called after a successful start / after a stop, to invalidate caches.
    on_started: Optional[Callable[[], None]] = None
    on_stopped: Optional[Callable[[], None]] = None
    on_acquired: Optional[Callable[[], None]] = None
    # kind="model":
    unload: Optional[Callable[[], None]] = None
    is_loaded: Optional[Callable[[], bool]] = None
    # kind="server": accept a healthy listener from a previous manager process
    # only when this optional capability probe confirms the service contract.
    adopt_foreign: Optional[Callable[[], bool]] = None
    # Read-only presence probe kept separate from stop_foreign so the manager
    # can make each idempotent decision before performing a mutation.
    foreign_present: Optional[Callable[[], Optional[bool]]] = None
    # kind="server": called when the health endpoint answers but the process is
    # NOT one we launched (stale orphan from a previous run, manual start). It
    # should terminate that foreign process and return True when the port is
    # free, False when a listener could not be stopped, and None when ownership
    # cannot be inspected. False or None aborts startup.
    stop_foreign: Optional[Callable[[], Optional[bool]]] = None
    # kind="server": the exact script files a start launches. The manager
    # digests them (service_script_code_id) into the expected code id and
    # injects it into the launch environment (SERVER_CODE_ID_ENV).
    server_scripts: Optional[Callable[[], List[Path]]] = None
    # kind="server": one canonical lightweight service report. Declared with
    # server_scripts it activates code identity; one probe supplies both health
    # and code_id so transport failure cannot be misread as a stale identity.
    status_report: Optional[Callable[[], Optional[Dict[str, Any]]]] = None
    external: bool = False
    ready_without_process: Optional[Callable[[], bool]] = None


class ManagedServiceManager(ManagedServiceProcessMixin):
    """Singleton registry + lifecycle supervisor. Use the `managed_services` instance."""

    def __init__(self) -> None:
        self._specs: Dict[str, ServiceSpec] = {}
        self._categories: Dict[str, CategorySettings] = {}
        # Every registry below is owned by one THREAD_BUS-backed state thread.
        # server-only subprocess handles
        self._processes: Dict[str, subprocess.Popen] = {}
        self._adopted_servers: Set[str] = set()
        # per-server append log handles (subprocess stdout/stderr -> file, not DEVNULL,
        # so model-load progress AND errors are VISIBLE for diagnosis)
        self._logfiles: Dict[str, Any] = {}
        # shared across kinds
        self._last_activity: Dict[str, float] = {}
        # Busy tokens are mutated only by the serialized state owner.
        self._in_flight: Dict[str, set] = {}
        self._async_holds: Dict[str, Dict[str, float]] = {}
        # server health cache (short TTL - status polls hit many at once)
        self._run_cache: Dict[str, Tuple[float, bool]] = {}
        self._server_reports: Dict[str, Dict[str, Any]] = {}
        self._health_failures: Dict[str, int] = {}
        self._active_server_by_category: Dict[str, str] = {}
        self._watchdog_started = False
        init_serialized_owner(
            self,
            "pyutils.managed_service.state",
            "ManagedServiceState",
            timeout=_START_TIMEOUT_S + 30.0,
        )
        self._start_watchdog()

    # --- registration --------------------------------------------------- #

    @serialized_method
    def register_category(self, category: str, layout: CategorySettings) -> None:
        self._categories[category] = layout
        self._publish_settings(category)

    @serialized_method
    def register(self, spec: ServiceSpec) -> None:
        self._specs[spec.name] = spec
        self._publish_settings(spec.category)

    @serialized_method
    def is_registered(self, name: str) -> bool:
        return name in self._specs

    @serialized_method
    def spec(self, name: str) -> Optional[ServiceSpec]:
        return self._specs.get(name)

    @serialized_method
    def category(self, name: str) -> Optional[str]:
        s = self._specs.get(name)
        return s.category if s else None

    @serialized_method
    def services_in(self, category: str) -> List[ServiceSpec]:
        return [s for s in self._specs.values() if s.category == category]

    # --- settings (per category, persisted) ----------------------------- #

    @staticmethod
    def _load_section(section: str) -> Dict[str, Any]:
        try:
            return dict(user_data_store.get_section(section) or {})
        except Exception:  # noqa: BLE001
            return {}

    @staticmethod
    def _save_section(section: str, data: Dict[str, Any]) -> None:
        try:
            user_data_store.set_section(section, data)
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[managed] failed to persist {section}: {e}")

    def _layout(self, category: str) -> Optional[CategorySettings]:
        return self._categories.get(category)

    @staticmethod
    def _settings_signal(category: str) -> str:
        return f"{_SETTINGS_SIGNAL_PREFIX}{category}"

    def _compose_settings(self, category: str) -> Dict[str, Any]:
        layout = self._layout(category)
        if layout is None:
            return {"success": False, "error": f"unknown category: {category}"}
        p = layout.prefix
        raw = self._load_section(layout.section)
        services = [
            service.name
            for service in self._specs.values()
            if service.category == category
        ]
        enabled: Dict[str, bool] = {name: True for name in services}
        saved_enabled = raw.get(f"{p}enabled")
        if isinstance(saved_enabled, dict):
            for name in services:
                if name in saved_enabled:
                    enabled[name] = bool(saved_enabled[name])
        idle = raw.get(f"{p}idle_shutdown_s", layout.idle_default)
        try:
            idle = max(0, int(idle))
        except (TypeError, ValueError):
            idle = layout.idle_default
        return {
            "success": True,
            f"{p}auto_manage": bool(raw.get(f"{p}auto_manage", layout.auto_manage_default)),
            f"{p}single_active": bool(raw.get(f"{p}single_active", layout.single_active_default)),
            f"{p}idle_shutdown_s": idle,
            f"{p}enabled": enabled,
        }

    def _publish_settings(
        self,
        category: str,
        settings: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        snapshot = settings or self._compose_settings(category)
        THREAD_BUS.signal(
            self._settings_signal(category),
            copy.deepcopy(snapshot),
        )
        return snapshot

    def peek_settings(self, category: str) -> Dict[str, Any]:
        """Return the immutable settings snapshot without entering lifecycle state."""
        snapshot = THREAD_BUS.get_signal(self._settings_signal(category), {}) or {}
        if isinstance(snapshot, dict) and snapshot:
            return copy.deepcopy(snapshot)
        return {
            "success": False,
            "error": f"settings snapshot unavailable: {category}",
            "pending": True,
        }

    @serialized_method
    def get_settings(self, category: str) -> Dict[str, Any]:
        return self._publish_settings(category)

    @serialized_method
    def apply_settings(self, category: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        layout = self._layout(category)
        if layout is None:
            return {"success": False, "error": f"unknown category: {category}"}
        p = layout.prefix
        section = self._load_section(layout.section)
        merged = self._compose_settings(category)
        if patch.get(f"{p}auto_manage") is not None:
            merged[f"{p}auto_manage"] = bool(patch[f"{p}auto_manage"])
        if patch.get(f"{p}single_active") is not None:
            merged[f"{p}single_active"] = bool(patch[f"{p}single_active"])
            if not merged[f"{p}single_active"]:
                self._active_server_by_category.pop(category, None)
        if patch.get(f"{p}idle_shutdown_s") is not None:
            try:
                merged[f"{p}idle_shutdown_s"] = max(0, int(patch[f"{p}idle_shutdown_s"]))
            except (TypeError, ValueError):
                pass
        if isinstance(patch.get(f"{p}enabled"), dict):
            for name, val in patch[f"{p}enabled"].items():
                if name in self._specs and self._specs[name].category == category:
                    merged[f"{p}enabled"][name] = bool(val)
        section.update(merged)
        self._save_section(layout.section, section)
        return self._publish_settings(category, merged)

    def _settings(self, category: str) -> Dict[str, Any]:
        layout = self._layout(category)
        if layout is None:
            return {}
        s = self.peek_settings(category)
        if not s.get("success"):
            s = self._publish_settings(category)
        p = layout.prefix
        return {
            "auto_manage": s[f"{p}auto_manage"],
            "single_active": s[f"{p}single_active"],
            "idle_s": s[f"{p}idle_shutdown_s"],
            "enabled": s[f"{p}enabled"],
        }

    # --- running state -------------------------------------------------- #

    def _is_managed_process(self, name: str) -> bool:
        """A server subprocess we launched and is still alive."""
        proc = self._processes.get(name)
        return proc is not None and proc.poll() is None

    def _is_managed_server(self, name: str) -> bool:
        return self._is_managed_process(name) or name in self._adopted_servers

    def _invalidate_run_cache(self, name: str) -> None:
        self._run_cache.pop(name, None)
        self._server_reports.pop(name, None)
        self._health_failures.pop(name, None)

    def _clear_active_server(self, name: str, category: str) -> None:
        if self._active_server_by_category.get(category) == name:
            self._active_server_by_category.pop(category, None)

    @serialized_method
    def is_running(self, name: str) -> bool:
        """Reachability: server HTTP health (cached) or model loaded."""
        spec = self._specs.get(name)
        if spec is None:
            return False
        if spec.kind == "model":
            return bool(spec.is_loaded and spec.is_loaded())
        if spec.ready_without_process is not None and spec.ready_without_process():
            return True
        # server
        proc = self._processes.get(name)
        if proc is not None and proc.poll() is not None:
            self._processes.pop(name, None)
            self._clear_active_server(name, spec.category)
            logf = self._logfiles.pop(name, None)
            if logf is not None:
                try:
                    logf.close()
                except OSError:
                    pass
            self._last_activity.pop(name, None)
            self._invalidate_run_cache(name)
        now = time.monotonic()
        cached = self._run_cache.get(name)
        if cached is not None and now - cached[0] < _RUN_CACHE_TTL_S:
            return cached[1]
        probed = self._probe_server(spec)
        managed = self._is_managed_server(name)
        failures = self._health_failures.get(name, 0)
        ok = (
            managed
            if probed is None
            else probed or (managed and failures < _HEALTH_FAILURE_THRESHOLD)
        )
        if not ok:
            self._adopted_servers.discard(name)
        self._run_cache[name] = (now, ok)
        return ok

    @serialized_method
    def peek_running(self, name: str) -> bool:
        """Return known runtime state without invoking a health probe."""
        spec = self._specs.get(name)
        if spec is None:
            return False
        if spec.kind == "model":
            return bool(spec.is_loaded and spec.is_loaded())
        if spec.ready_without_process is not None:
            cached = self._run_cache.get(name)
            if cached is not None and cached[1]:
                return True
        if self._is_managed_server(name):
            return True
        cached = self._run_cache.get(name)
        return bool(cached[1]) if cached is not None else False

    @serialized_method
    def peek_runtime_status(self, name: str) -> Dict[str, Any]:
        """Build runtime metadata from known state without command or HTTP checks."""
        return self._compose_runtime_status(name, self.peek_running(name))

    def _compose_runtime_status(
        self,
        name: str,
        running: bool,
    ) -> Dict[str, Any]:
        """Compose the one canonical managed-service runtime payload."""
        spec = self._specs.get(name)
        if spec is None:
            return {}
        managed = (spec.kind == "server" and self._is_managed_server(name)) \
            or (spec.kind == "model" and running)
        settings = self._settings(spec.category)
        idle_seconds = settings.get("idle_s", DEFAULT_IDLE_S)
        idle_remaining: Optional[float] = None
        if managed and idle_seconds > 0 and name in self._last_activity:
            idle_remaining = max(
                0.0,
                float(idle_seconds) - (time.monotonic() - self._last_activity[name]),
            )
        identity_state, expected_code_id, reported_code_id = self._code_id_state(spec)
        return {
            "name": name,
            "category": spec.category,
            "kind": spec.kind,
            "running": running,
            "managed": managed,
            "enabled": bool(settings.get("enabled", {}).get(name, True)),
            "in_flight": self.in_flight(name),
            "health_probe_failures": self._health_failures.get(name, 0),
            "idle_remaining_s": idle_remaining,
            "ready_url": THREAD_BUS.get_signal(
                f"{_READY_SIGNAL_PREFIX}{name}", None
            ),
            "code_id": reported_code_id,
            "expected_code_id": expected_code_id,
            "code_identity_state": identity_state,
            "code_stale": identity_state == _CODE_IDENTITY_STALE,
        }

    def _touch(self, name: str) -> None:
        if name in self._specs:
            self._last_activity[name] = time.monotonic()

    def _expected_code_id(self, spec: ServiceSpec) -> str:
        """Digest of the script set a fresh start would launch ('' = off)."""
        if spec.kind != "server" or spec.server_scripts is None or spec.status_report is None:
            return ""
        return service_script_code_id(spec.server_scripts())

    def _probe_server(self, spec: ServiceSpec) -> Optional[bool]:
        if spec.status_report is not None:
            report = spec.status_report()
            if report is None:
                self._health_failures[spec.name] = (
                    self._health_failures.get(spec.name, 0) + 1
                )
                return None
            self._server_reports[spec.name] = dict(report)
            healthy = bool(report.get("ok"))
        else:
            healthy = bool(spec.health and spec.health())
        if healthy:
            self._health_failures.pop(spec.name, None)
        else:
            self._health_failures[spec.name] = (
                self._health_failures.get(spec.name, 0) + 1
            )
        return healthy

    def _code_id_state(self, spec: ServiceSpec) -> Tuple[str, str, str]:
        """Return identity state, expected id, and last confirmed reported id.

        A missing transport response is unknown and must not trigger a stop. A
        successful report with a missing or different code_id is confirmed stale
        and must be reclaimed before use."""
        expected = self._expected_code_id(spec)
        if not expected:
            return _CODE_IDENTITY_DISABLED, "", ""
        report = self._server_reports.get(spec.name)
        if report is None:
            return _CODE_IDENTITY_UNKNOWN, expected, ""
        reported = str(report.get("code_id") or "")
        state = (
            _CODE_IDENTITY_CURRENT
            if reported == expected
            else _CODE_IDENTITY_STALE
        )
        return state, expected, reported

    def _log_stale_code(self, name: str, expected: str, reported: str, owner: str) -> None:
        ColorPrint.yellow(
            f"[managed] {name}: {owner} runs stale code "
            f"(code_id={reported or 'none'}, expected={expected or 'none'}) - reclaiming"
        )

    @serialized_method
    def record_use(self, name: str) -> None:
        """Refresh the idle timer after a successful call."""
        self._touch(name)

    @serialized_method
    def in_flight(self, name: str) -> int:
        tokens = self._in_flight.get(name)
        holds = self._async_holds.get(name)
        if holds:
            now = time.monotonic()
            expired = [owner for owner, deadline in holds.items() if deadline <= now]
            for owner in expired:
                holds.pop(owner, None)
            if not holds:
                self._async_holds.pop(name, None)
                holds = None
        return (len(tokens) if tokens else 0) + (len(holds) if holds else 0)

    # --- busy-protected call ownership --------------------------------- #

    @serialized_method
    def _acquire_lease(self, name: str, force: bool = False) -> Optional[object]:
        spec = self._specs.get(name)
        if spec is None:
            return None
        try:
            ready = self.ensure_running(name, force=force)
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[managed] ensure_running {name} failed: {e}")
            raise ManagedServiceUnavailable(
                f"managed service {name} failed to start"
            ) from e
        if not ready:
            raise ManagedServiceUnavailable(f"managed service {name} is unavailable")
        if spec.on_acquired is not None:
            spec.on_acquired()
        token = object()
        self._in_flight.setdefault(name, set()).add(token)
        self._touch(name)
        return token

    @serialized_method
    def _release_lease(self, name: str, token: object) -> None:
        tokens = self._in_flight.get(name)
        if tokens is not None:
            tokens.discard(token)
        self._touch(name)
        self._after_busy_release(name)

    def _after_busy_release(self, name: str) -> None:
        spec = self._specs.get(name)
        if spec is None or self.in_flight(name) > 0:
            return
        settings = self._settings(spec.category)
        if not settings.get("enabled", {}).get(name, True):
            self.stop(name)
            return
        if spec.kind != "server" or not self._is_managed_server(name):
            return
        active_name = self._active_server_by_category.get(spec.category)
        if settings.get("single_active", True) and active_name and active_name != name:
            self.stop(name)

    @serialized_method
    def retain_async(
        self,
        name: str,
        owner: str,
        ttl_s: float,
        *,
        force: bool = False,
    ) -> bool:
        """Keep a queued server-side operation busy across short HTTP polls."""
        owner_key = str(owner or "").strip()
        if not owner_key:
            raise ValueError("async service hold owner is required")
        spec = self._specs.get(name)
        if spec is None:
            return True
        try:
            ready = self.ensure_running(name, force=force)
        except Exception as exc:  # noqa: BLE001
            raise ManagedServiceUnavailable(
                f"managed service {name} failed to start"
            ) from exc
        if not ready:
            raise ManagedServiceUnavailable(f"managed service {name} is unavailable")
        holds = self._async_holds.setdefault(name, {})
        is_new = owner_key not in holds
        holds[owner_key] = time.monotonic() + max(_WATCHDOG_POLL_S * 2.0, float(ttl_s))
        if is_new and spec.on_acquired is not None:
            spec.on_acquired()
        self._touch(name)
        return True

    @serialized_method
    def release_async(self, name: str, owner: str) -> None:
        owner_key = str(owner or "").strip()
        holds = self._async_holds.get(name)
        if holds is not None:
            holds.pop(owner_key, None)
            if not holds:
                self._async_holds.pop(name, None)
        self._touch(name)
        self._after_busy_release(name)

    @contextmanager
    def lease(self, name: str, *, force: bool = False):
        """Wrap a synth/transcribe call: ensure running, mark in-flight (busy
        protection), touch activity on exit. No-op for unregistered services."""
        token = self._acquire_lease(name, force)
        try:
            yield
        finally:
            if token is not None:
                self._release_lease(name, token)

    # --- status --------------------------------------------------------- #

    @serialized_method
    def runtime_status(self, name: str) -> Dict[str, Any]:
        return self._compose_runtime_status(name, self.is_running(name))

    @serialized_method
    def all_runtime_status(self, category: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        names = [s.name for s in self._specs.values() if category is None or s.category == category]
        return {n: self.runtime_status(n) for n in names}

    # --- watchdog ------------------------------------------------------- #

    def _reap_dead(self) -> None:
        for name, proc in list(self._processes.items()):
            if proc.poll() is not None:
                self._processes.pop(name, None)
                spec = self._specs.get(name)
                if spec is not None:
                    self._clear_active_server(name, spec.category)
                logf = self._logfiles.pop(name, None)
                if logf is not None:
                    try:
                        logf.close()
                    except OSError:
                        pass
                self._last_activity.pop(name, None)
                self._invalidate_run_cache(name)
                THREAD_BUS.clear_signal(f"{_READY_SIGNAL_PREFIX}{name}")

    def _shutdown_idle(self) -> None:
        # Group idle seconds by category (one setting per category).
        cat_idle: Dict[str, int] = {}
        for cat, layout in self._categories.items():
            cat_idle[cat] = self._settings(cat).get("idle_s", layout.idle_default)
        now = time.monotonic()
        for name, spec in list(self._specs.items()):
            if self.in_flight(name) > 0:
                continue  # busy - never idle-stop
            idle_s = cat_idle.get(spec.category, DEFAULT_IDLE_S)
            if idle_s <= 0:
                continue
            managed = (spec.kind == "server" and self._is_managed_server(name)) \
                or (spec.kind == "model" and spec.is_loaded and spec.is_loaded())
            if not managed:
                continue
            last = self._last_activity.get(name, 0.0)
            if now - last >= idle_s:
                ColorPrint.gray(f"[managed] idle shutdown {name} ({idle_s}s)")
                self.stop(name)

    def _watchdog_loop(self) -> None:
        while True:
            try:
                self._watchdog_tick()
            except Exception:  # noqa: BLE001
                pass
            time.sleep(_WATCHDOG_POLL_S)

    @serialized_method
    def _watchdog_tick(self) -> None:
        self._reap_dead()
        self._shutdown_idle()

    @serialized_method
    def _start_watchdog(self) -> None:
        if self._watchdog_started:
            return
        self._watchdog_started = True
        start_bus_task(
            self._watchdog_loop,
            thread_name="ManagedServiceWatchdogThread",
        )

    @serialized_method
    def shutdown_all(self) -> None:
        for name in list(self._specs.keys()):
            if self.in_flight(name) > 0:
                continue
            try:
                self.stop(name)
            except Exception:  # noqa: BLE001
                pass


managed_services = ManagedServiceManager()
atexit.register(managed_services.shutdown_all)


__all__ = [
    "CategorySettings",
    "SERVER_CODE_ID_ENV",
    "ServiceSpec",
    "ManagedServiceUnavailable",
    "ManagedServiceManager",
    "managed_services",
    "service_script_code_id",
]
