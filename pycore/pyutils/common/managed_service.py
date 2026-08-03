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
  - default no memory: nothing stays loaded by default; a service runs only
    while being called, and is auto-stopped after `idle_shutdown_s` (default
    180s = 3 minutes; 0 disables) with no calls. Keys: TTS `server_idle_shutdown_s`,
    STT `model_idle_shutdown_s`.
  - idempotent start on call: `ensure_running(name)` / `using(name)` reuse a
    running service instead of re-starting.
  - single-active applies to kind=="server" ONLY: starting one server stops the
    OTHER servers in the SAME category ("tts"/"stt") - EXCEPT any peer with an
    in-flight call (in-flight > 0 is never killed). Starting a class-B model
    never evicts anything (models run in parallel).
  - busy protection is ABSOLUTE: a service with `_in_flight > 0` is never
    stopped/unloaded - not by single-active, not by the idle watchdog. Callers
    MUST wrap synthesis/transcription in `using(name)` so in-flight is tracked.

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
import gc
import os
import subprocess
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_logs_dir
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

from pycore.pyfoundations.third_party.api import get_third_package_torch
import pycore.pyutils.common.model_load_status as model_load_status


DEFAULT_IDLE_S = 180
_WATCHDOG_POLL_S = 5.0
_RUN_CACHE_TTL_S = 10.0
_START_TIMEOUT_S = 180.0
_HEALTH_POLL_S = 1.5
_READY_MARKER = "QWEN3TTS_READY "
_READY_SIGNAL_PREFIX = "managed.service.ready_url."
_SETTINGS_SIGNAL_PREFIX = "managed.service.settings."


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
    # kind="model":
    unload: Optional[Callable[[], None]] = None
    is_loaded: Optional[Callable[[], bool]] = None
    # kind="server": accept a healthy listener from a previous manager process
    # only when this capability probe confirms the current service contract.
    adopt_foreign: Optional[Callable[[], bool]] = None
    # kind="server": called when the health endpoint answers but the process is
    # NOT one we launched (stale orphan from a previous run, manual start). It
    # should terminate that foreign process and return True when the port is
    # free, False when a listener could not be stopped, and None when no foreign
    # listener was found. False aborts startup rather than attaching to old code.
    stop_foreign: Optional[Callable[[], Optional[bool]]] = None


def _gpu_release() -> None:
    """Best-effort GPU/CPU memory release after unloading a model."""
    try:
        gc.collect()
    except Exception:  # noqa: BLE001
        pass
    try:
        torch = get_third_package_torch()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:  # noqa: BLE001
        pass


def _relay_managed_log(proc: subprocess.Popen, logfile: Optional[Any], service_name: str) -> None:
    """Relay subprocess output after receiving all task data through THREAD_BUS."""
    try:
        for line in iter(proc.stdout.readline, b''):
            text = line.decode("utf-8", errors="replace")
            if logfile is not None:
                logfile.write(text)
                logfile.flush()
            ColorPrint.gray(f"[{service_name}] {text.strip()}")
            marker_index = text.find(_READY_MARKER)
            if marker_index >= 0:
                endpoint = text[marker_index + len(_READY_MARKER):].strip().split(" ", 1)[0]
                if endpoint:
                    THREAD_BUS.signal(f"{_READY_SIGNAL_PREFIX}{service_name}", endpoint)
    except Exception:
        pass


class ManagedServiceManager:
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
        # server health cache (short TTL - status polls hit many at once)
        self._run_cache: Dict[str, Tuple[float, bool]] = {}
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
        s = self.get_settings(category)
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

    @serialized_method
    def is_running(self, name: str) -> bool:
        """Reachability: server HTTP health (cached) or model loaded."""
        spec = self._specs.get(name)
        if spec is None:
            return False
        if spec.kind == "model":
            return bool(spec.is_loaded and spec.is_loaded())
        # server
        proc = self._processes.get(name)
        if proc is not None and proc.poll() is not None:
            self._processes.pop(name, None)
            logf = self._logfiles.pop(name, None)
            if logf is not None:
                try:
                    logf.close()
                except OSError:
                    pass
            self._last_activity.pop(name, None)
            self._run_cache.pop(name, None)
        now = time.monotonic()
        cached = self._run_cache.get(name)
        if cached is not None and now - cached[0] < _RUN_CACHE_TTL_S:
            return cached[1]
        ok = bool(spec.health and spec.health())
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
        return {
            "name": name,
            "category": spec.category,
            "kind": spec.kind,
            "running": running,
            "managed": managed,
            "enabled": bool(settings.get("enabled", {}).get(name, True)),
            "in_flight": self.in_flight(name),
            "idle_remaining_s": idle_remaining,
            "ready_url": THREAD_BUS.get_signal(
                f"{_READY_SIGNAL_PREFIX}{name}", None
            ),
        }

    def _touch(self, name: str) -> None:
        if name in self._specs:
            self._last_activity[name] = time.monotonic()

    @serialized_method
    def record_use(self, name: str) -> None:
        """Refresh the idle timer after a successful call."""
        self._touch(name)

    @serialized_method
    def in_flight(self, name: str) -> int:
        tokens = self._in_flight.get(name)
        return len(tokens) if tokens else 0

    # --- start / stop --------------------------------------------------- #

    @staticmethod
    def _server_log_path(spec: ServiceSpec) -> Path:
        return get_app_logs_dir() / "services" / f"{spec.category}_{spec.name}.log"

    @serialized_method
    def read_log_tail(self, name: str, lines: int = 40) -> List[str]:
        """Last `lines` of a server's per-service log (model-load progress +
        errors already captured there). Best-effort: [] when unreadable / no
        such server / model engine. Used to surface a diagnostic tail in the
        model-load status registry when a server start fails or completes."""
        spec = self._specs.get(name)
        if spec is None or spec.kind != "server":
            return []
        path = self._server_log_path(spec)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                tail = fh.readlines()[-max(1, lines):]
            return [ln.rstrip("\n") for ln in tail if ln.strip()]
        except OSError:
            return []

    def _open_server_log(self, spec: ServiceSpec):
        """Open (append) the per-service log so the subprocess's stdout/stderr - model
        load progress AND errors - land on disk instead of being discarded to DEVNULL.
        Best-effort: returns None (caller keeps DEVNULL) if it cannot be opened."""
        try:
            path = self._server_log_path(spec)
            path.parent.mkdir(parents=True, exist_ok=True)
            return open(path, "a", encoding="utf-8", errors="replace", buffering=1)
        except OSError as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[managed] {spec.name} log open failed: {exc}")
            return None

    @staticmethod
    def _popen_kwargs(cwd: Path) -> Dict[str, Any]:
        kw: Dict[str, Any] = {
            "cwd": str(cwd),
            "stdout": subprocess.DEVNULL,
            "stderr": subprocess.DEVNULL,
        }
        if sys.platform == "win32":
            flags = subprocess.CREATE_NEW_PROCESS_GROUP
            create_no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            kw["creationflags"] = flags | create_no_window
        else:
            kw["start_new_session"] = True
        return kw

    def _wait_healthy(self, spec: ServiceSpec, timeout_s: float) -> bool:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if spec.health and spec.health():
                return True
            proc = self._processes.get(spec.name)
            if proc is not None and proc.poll() is not None:
                return False
            time.sleep(_HEALTH_POLL_S)
        return bool(spec.health and spec.health())

    @staticmethod
    def _launch_env(argv: List[str], env: Dict[str, str]) -> Dict[str, str]:
        """Environment for a server subprocess. When the launch interpreter is an
        ISOLATED venv (argv[0] != this interpreter) strip PYTHONPATH/PYTHONHOME so
        the main interpreter's site-packages cannot shadow the venv's own packages
        (e.g. qwen3tts's pinned transformers). See spec §5."""
        launch = dict(env)
        interp = argv[0] if argv else ""
        try:
            same = os.path.normcase(os.path.realpath(interp)) == \
                os.path.normcase(os.path.realpath(sys.executable))
        except OSError:
            same = False
        if not same:
            launch.pop("PYTHONPATH", None)
            launch.pop("PYTHONHOME", None)
        return launch

    def _start_server(self, spec: ServiceSpec) -> bool:
        cmd = spec.start_command() if spec.start_command else None
        if cmd is None:
            return False
        # start_command() may return (cwd, argv) or (cwd, argv, env).
        env: Optional[Dict[str, str]] = None
        if len(cmd) >= 3:
            cwd, argv, env = cmd[0], cmd[1], cmd[2]
        else:
            cwd, argv = cmd[0], cmd[1]
        # The serialized state owner makes check-and-start non-reentrant.
        if self._is_managed_process(spec.name):
            self._touch(spec.name)
            return True
        self._adopted_servers.discard(spec.name)
        popen_kwargs = self._popen_kwargs(cwd)
        logf = self._open_server_log(spec)
        popen_kwargs["stdout"] = subprocess.PIPE
        popen_kwargs["stderr"] = subprocess.STDOUT
        if env is not None:
            popen_kwargs["env"] = self._launch_env(argv, env)
        THREAD_BUS.clear_signal(f"{_READY_SIGNAL_PREFIX}{spec.name}")
        try:
            proc = subprocess.Popen(argv, **popen_kwargs)
            # Keep the defensive duplicate-process check for external changes.
            existing = self._processes.setdefault(spec.name, proc)
            if existing is not proc:
                try:
                    proc.terminate()
                except Exception:  # noqa: BLE001
                    pass
                if logf is not None:
                    try:
                        logf.close()
                    except OSError:
                        pass
                self._touch(spec.name)
                return True
            if logf is not None:
                self._logfiles[spec.name] = logf
            start_bus_task(
                _relay_managed_log,
                proc,
                logf,
                spec.name,
                thread_name=f"ManagedLogRelay-{spec.name}-Thread",
            )
            self._last_activity[spec.name] = time.monotonic()
        except Exception as e:  # noqa: BLE001
            if logf is not None:
                try:
                    logf.close()
                except OSError:
                    pass
            ColorPrint.yellow(f"[managed] {spec.name} start failed: {e}")
            self._report_load_error(spec.name, f"process start failed: {e}")
            return False
        ColorPrint.blue(
            f"[managed] starting {spec.name}: {' '.join(argv)} "
            f"(log: {self._server_log_path(spec)})"
        )
        # Surface class-C load progress: the subprocess loads its model at startup,
        # so 'loading' spans the Popen -> healthy window (best-effort, never fatal).
        try:
            model_load_status.set_loading(spec.name, "starting server")
        except Exception:  # noqa: BLE001
            pass
        ok = self._wait_healthy(spec, _START_TIMEOUT_S)
        self._invalidate_run_cache(spec.name)
        if not ok:
            self.stop(spec.name)
            ColorPrint.yellow(f"[managed] {spec.name} failed to become healthy")
            self._report_load_error(spec.name, "server failed to become healthy")
            return False
        if spec.on_started:
            try:
                spec.on_started()
            except Exception:  # noqa: BLE001
                pass
        ColorPrint.green(f"[managed] {spec.name} ready")
        try:
            model_load_status.set_log_tail(spec.name, self.read_log_tail(spec.name))
            model_load_status.set_loaded(spec.name, "server ready")
        except Exception:  # noqa: BLE001
            pass
        return True

    def _report_load_error(self, name: str, message: str) -> None:
        """Best-effort: record a server start failure in the model-load registry
        with the last log lines attached for diagnosis. Never raises."""
        try:
            model_load_status.set_log_tail(name, self.read_log_tail(name))
            model_load_status.set_error(name, message)
        except Exception:  # noqa: BLE001
            pass

    def _stop_others(self, category: str, except_name: str) -> None:
        """Single-active among subprocess servers only. In-process models stay
        loaded in parallel and are freed individually by the idle watchdog."""
        except_spec = self._specs.get(except_name)
        if except_spec is None or except_spec.kind != "server":
            return
        for s in self.services_in(category):
            if s.name == except_name or s.kind != "server":
                continue
            if self.in_flight(s.name) > 0:
                continue  # never stop a busy peer
            if self._is_managed_server(s.name):
                ColorPrint.gray(f"[managed] single-active: stopping {s.name} for {except_name}")
                self.stop(s.name)

    @serialized_method
    def ensure_running(self, name: str, *, force: bool = False) -> bool:
        """Idempotent: make sure the service is usable for an upcoming call.
        For servers this may Popen+health-wait (respects auto_manage+enabled);
        for models it only touches activity (parallel — models never evict each
        other; the engine itself loads weights on synth/transcribe). ``force``
        bypasses the auto_manage/enabled gates (manual start from the UI)."""
        spec = self._specs.get(name)
        if spec is None:
            return True  # unmanaged (API/CLI) - nothing to do
        if not spec.installed():
            return False
        if not spec.config_ready():
            return False
        st = self._settings(spec.category)
        if not force:
            if not st.get("auto_manage", True):
                # Even when auto-manage is off, still track activity so an already-
                # running service gets idle-unloaded; just don't start one.
                if self.is_running(name):
                    self._touch(name)
                return self.is_running(name)
            if not st.get("enabled", {}).get(name, True):
                return self.is_running(name)
        foreign_checked = False
        running = self.is_running(name)
        if running:
            if spec.kind == "server" and name in self._adopted_servers:
                if st.get("single_active", True):
                    self._stop_others(spec.category, name)
                self._touch(name)
                return True
            if (
                spec.kind == "server"
                and not self._is_managed_process(name)
                and spec.stop_foreign is not None
            ):
                if spec.adopt_foreign is not None:
                    try:
                        compatible = bool(spec.adopt_foreign())
                    except Exception as e:  # noqa: BLE001
                        compatible = False
                        ColorPrint.yellow(
                            f"[managed] {name}: adoption probe failed: {e}"
                        )
                    if compatible:
                        self._adopted_servers.add(name)
                        self._touch(name)
                        if spec.on_started:
                            try:
                                spec.on_started()
                            except Exception as e:  # noqa: BLE001
                                ColorPrint.yellow(
                                    f"[managed] {name}: adopted start hook failed: {e}"
                                )
                        if st.get("single_active", True):
                            self._stop_others(spec.category, name)
                        ColorPrint.green(
                            f"[managed] {name}: adopted compatible healthy service"
                        )
                        return True
                # The listener is healthy but failed or lacks the service's
                # adoption contract. Reclaim it before starting current code.
                ColorPrint.yellow(
                    f"[managed] {name}: foreign process holds the service port — reclaiming"
                )
                try:
                    foreign_checked = True
                    if spec.stop_foreign() is True:
                        self._invalidate_run_cache(name)
                    else:
                        ColorPrint.yellow(
                            f"[managed] {name}: foreign listener could not be reclaimed"
                        )
                        return False
                except Exception as e:  # noqa: BLE001
                    ColorPrint.yellow(f"[managed] {name} stop_foreign failed: {e}")
                    return False
            else:
                if st.get("single_active", True):
                    self._stop_others(spec.category, name)
                self._touch(name)
                return True
        if spec.kind == "server":
            if spec.stop_foreign is not None and not foreign_checked:
                try:
                    reclaim_result = spec.stop_foreign()
                except Exception as e:  # noqa: BLE001
                    ColorPrint.yellow(f"[managed] {name} foreign preflight failed: {e}")
                    reclaim_result = None
                if reclaim_result is False:
                    ColorPrint.yellow(
                        f"[managed] {name}: occupied service port could not be reclaimed"
                    )
                    return False
                if reclaim_result is True:
                    self._invalidate_run_cache(name)
            if st.get("single_active", True):
                self._stop_others(spec.category, name)
            return self._start_server(spec)
        # model: the engine loads on use; just record activity so the watchdog
        # owns the subsequent idle-unload.
        self._touch(name)
        return True

    @serialized_method
    def stop(self, name: str) -> Dict[str, Any]:
        spec = self._specs.get(name)
        if spec is None:
            return {"success": False, "error": f"unknown service: {name}"}
        # Don't kill a busy service (caller should release first).
        if self.in_flight(name) > 0:
            return {"success": False, "error": f"{name} busy (in-flight)"}
        if spec.kind == "server":
            proc = self._processes.pop(name, None)
            adopted = name in self._adopted_servers
            self._adopted_servers.discard(name)
            logf = self._logfiles.pop(name, None)
            self._last_activity.pop(name, None)
            if proc is not None and proc.poll() is None:
                try:
                    proc.terminate()
                    proc.wait(timeout=8)
                except Exception:  # noqa: BLE001
                    try:
                        proc.kill()
                    except Exception:  # noqa: BLE001
                        pass
                ColorPrint.yellow(f"[managed] stopped server {name} (pid={proc.pid})")
            elif adopted and spec.stop_foreign is not None:
                stopped = spec.stop_foreign()
                if stopped is False:
                    self._adopted_servers.add(name)
                    self._touch(name)
                    return {
                        "success": False,
                        "error": f"adopted {name} service could not be stopped",
                    }
                ColorPrint.yellow(f"[managed] stopped adopted server {name}")
            if logf is not None:
                try:
                    logf.close()
                except OSError:
                    pass
        else:  # model
            if spec.unload and (spec.is_loaded is None or spec.is_loaded()):
                try:
                    spec.unload()
                    ColorPrint.yellow(f"[managed] unloaded model {name}")
                except Exception as e:  # noqa: BLE001
                    ColorPrint.yellow(f"[managed] unload {name} failed: {e}")
            _gpu_release()
        self._invalidate_run_cache(name)
        THREAD_BUS.clear_signal(f"{_READY_SIGNAL_PREFIX}{name}")
        # Back to idle in the model-load registry (server terminated / model unloaded).
        try:
            model_load_status.reset(name)
        except Exception:  # noqa: BLE001
            pass
        if spec.on_stopped:
            try:
                spec.on_stopped()
            except Exception:  # noqa: BLE001
                pass
        return {"success": True, "name": name, "running": self.is_running(name)}

    # --- busy-protected call wrapper ------------------------------------ #

    @serialized_method
    def _begin_use(self, name: str) -> Optional[object]:
        spec = self._specs.get(name)
        if spec is None:
            return None
        try:
            ready = self.ensure_running(name)
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[managed] ensure_running {name} failed: {e}")
            raise RuntimeError(f"managed service {name} failed to start") from e
        if not ready:
            raise RuntimeError(f"managed service {name} is unavailable")
        token = object()
        self._in_flight.setdefault(name, set()).add(token)
        self._touch(name)
        return token

    @serialized_method
    def _end_use(self, name: str, token: object) -> None:
        tokens = self._in_flight.get(name)
        if tokens is not None:
            tokens.discard(token)
        self._touch(name)

    @contextmanager
    def using(self, name: str):
        """Wrap a synth/transcribe call: ensure running, mark in-flight (busy
        protection), touch activity on exit. No-op for unregistered services."""
        token = self._begin_use(name)
        try:
            yield
        finally:
            if token is not None:
                self._end_use(name, token)

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
    "ServiceSpec",
    "ManagedServiceManager",
    "managed_services",
]
