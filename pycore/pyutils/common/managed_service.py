# -*- coding: utf-8 -*-
"""
Unified managed-service lifecycle for pycore.

ONE generic manager that owns idempotent start / single-active / idle
auto-shutdown / busy (in-flight) protection for two kinds of background
services:

  - kind="server" : a subprocess HTTP API server (chattts/cosyvoice/...).
                     start = Popen + wait for HTTP health; stop = terminate.
  - kind="model"  : an in-process ML model that holds GPU/CPU memory
                     (qwen3tts/bark/.../faster-whisper/vosk). start = the
                     engine's own lazy load on first use; stop = unload +
                     torch.cuda.empty_cache(). The manager does NOT trigger
                     the model load itself (the engine does, on synth/transcribe)
                     - it owns the unload, idle timing and busy protection around
                     the call.

Guarantees (per the unified idempotent contract):
  - default no memory: nothing stays loaded by default; a service runs only
    while being called, and is auto-stopped `idle_shutdown_s` (default 60s)
    after the last call.
  - idempotent start on call: `ensure_running(name)` / `using(name)` reuse a
    running service instead of re-starting.
  - single-active per category FOR SERVERS ONLY: starting one subprocess API
    server stops other running servers in the SAME category ("tts" / "stt") -
    UNLESS a peer has an in-flight call. In-process model engines (kind="model")
    are parallel: they never evict each other; each idle-unloads on its own 60s
    timer after the last call.
  - busy protection: a service with `_in_flight > 0` is never stopped/unloaded
    (not by single-active, not by the idle watchdog).

Settings persist in user_data.json, one section per category, with a prefix
so the TTS category keeps its existing `server_*` keys (router/UI compat) and
STT uses `model_*` keys:
  <prefix>auto_manage / <prefix>single_active / <prefix>idle_shutdown_s /
  <prefix>enabled (per-service bool map)
"""

import atexit
import gc
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore import get_user_data_store
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party import get_third_package_torch


DEFAULT_IDLE_S = 60
_WATCHDOG_POLL_S = 5.0
_RUN_CACHE_TTL_S = 10.0
_START_TIMEOUT_S = 180.0
_HEALTH_POLL_S = 1.5


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
    # kind="server":
    start_command: Optional[Callable[[], Optional[Tuple[Path, List[str]]]]] = None
    health: Optional[Callable[[], bool]] = None
    # called after a successful start / after a stop, to invalidate caches.
    on_started: Optional[Callable[[], None]] = None
    on_stopped: Optional[Callable[[], None]] = None
    # kind="model":
    unload: Optional[Callable[[], None]] = None
    is_loaded: Optional[Callable[[], bool]] = None


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


class ManagedServiceManager:
    """Singleton registry + lifecycle supervisor. Use the `managed_services` instance."""

    def __init__(self) -> None:
        self._specs: Dict[str, ServiceSpec] = {}
        self._categories: Dict[str, CategorySettings] = {}
        self._lock = threading.RLock()
        # server-only subprocess handles
        self._processes: Dict[str, subprocess.Popen] = {}
        # shared across kinds
        self._last_activity: Dict[str, float] = {}
        self._in_flight: Dict[str, int] = {}
        # server health cache (short TTL - status polls hit many at once)
        self._run_cache: Dict[str, Tuple[float, bool]] = {}
        self._watchdog_started = False
        self._start_watchdog()

    # --- registration --------------------------------------------------- #

    def register_category(self, category: str, layout: CategorySettings) -> None:
        self._categories[category] = layout

    def register(self, spec: ServiceSpec) -> None:
        self._specs[spec.name] = spec

    def is_registered(self, name: str) -> bool:
        return name in self._specs

    def spec(self, name: str) -> Optional[ServiceSpec]:
        return self._specs.get(name)

    def category(self, name: str) -> Optional[str]:
        s = self._specs.get(name)
        return s.category if s else None

    def services_in(self, category: str) -> List[ServiceSpec]:
        return [s for s in self._specs.values() if s.category == category]

    # --- settings (per category, persisted) ----------------------------- #

    @staticmethod
    def _load_section(section: str) -> Dict[str, Any]:
        try:
            return dict(get_user_data_store().get_section(section) or {})
        except Exception:  # noqa: BLE001
            return {}

    @staticmethod
    def _save_section(section: str, data: Dict[str, Any]) -> None:
        try:
            get_user_data_store().set_section(section, data)
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[managed] failed to persist {section}: {e}")

    def _layout(self, category: str) -> Optional[CategorySettings]:
        return self._categories.get(category)

    def get_settings(self, category: str) -> Dict[str, Any]:
        layout = self._layout(category)
        if layout is None:
            return {"success": False, "error": f"unknown category: {category}"}
        p = layout.prefix
        raw = self._load_section(layout.section)
        services = [s.name for s in self.services_in(category)]
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

    def apply_settings(self, category: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        layout = self._layout(category)
        if layout is None:
            return {"success": False, "error": f"unknown category: {category}"}
        p = layout.prefix
        section = self._load_section(layout.section)
        merged = self.get_settings(category)
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
        return merged

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

    def _invalidate_run_cache(self, name: str) -> None:
        self._run_cache.pop(name, None)

    def is_running(self, name: str) -> bool:
        """Reachability: server HTTP health (cached) or model loaded."""
        spec = self._specs.get(name)
        if spec is None:
            return False
        if spec.kind == "model":
            return bool(spec.is_loaded and spec.is_loaded())
        # server
        now = time.monotonic()
        cached = self._run_cache.get(name)
        if cached is not None and now - cached[0] < _RUN_CACHE_TTL_S:
            return cached[1]
        ok = bool(spec.health and spec.health())
        self._run_cache[name] = (now, ok)
        return ok

    def _touch(self, name: str) -> None:
        if name in self._specs:
            self._last_activity[name] = time.monotonic()

    def record_use(self, name: str) -> None:
        """Refresh the idle timer after a successful call."""
        self._touch(name)

    def in_flight(self, name: str) -> int:
        return self._in_flight.get(name, 0)

    # --- start / stop --------------------------------------------------- #

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

    def _start_server(self, spec: ServiceSpec) -> bool:
        cmd = spec.start_command() if spec.start_command else None
        if cmd is None:
            return False
        cwd, argv = cmd
        with self._lock:
            if self._is_managed_process(spec.name):
                self._touch(spec.name)
                return True
            try:
                proc = subprocess.Popen(argv, **self._popen_kwargs(cwd))
                self._processes[spec.name] = proc
                self._last_activity[spec.name] = time.monotonic()
            except Exception as e:  # noqa: BLE001
                ColorPrint.yellow(f"[managed] {spec.name} start failed: {e}")
                return False
        ColorPrint.blue(f"[managed] starting {spec.name}: {' '.join(argv)}")
        ok = self._wait_healthy(spec, _START_TIMEOUT_S)
        self._invalidate_run_cache(spec.name)
        if spec.on_started:
            try:
                spec.on_started()
            except Exception:  # noqa: BLE001
                pass
        if not ok:
            self.stop(spec.name)
            ColorPrint.yellow(f"[managed] {spec.name} failed to become healthy")
            return False
        ColorPrint.green(f"[managed] {spec.name} ready")
        return True

    def _stop_others(self, category: str, except_name: str) -> None:
        """Single-active among subprocess servers only. In-process models stay
        loaded in parallel and are freed individually by the idle watchdog."""
        except_spec = self._specs.get(except_name)
        if except_spec is None or except_spec.kind != "server":
            return
        for s in self.services_in(category):
            if s.name == except_name or s.kind != "server":
                continue
            if self._in_flight.get(s.name, 0) > 0:
                continue  # never stop a busy peer
            if self._is_managed_process(s.name):
                ColorPrint.gray(f"[managed] single-active: stopping {s.name} for {except_name}")
                self.stop(s.name)

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
        if st.get("single_active", True):
            self._stop_others(spec.category, name)
        if not force:
            if not st.get("auto_manage", True):
                # Even when auto-manage is off, still track activity so an already-
                # running service gets idle-unloaded; just don't start one.
                if self.is_running(name):
                    self._touch(name)
                return self.is_running(name)
            if not st.get("enabled", {}).get(name, True):
                return self.is_running(name)
        if self.is_running(name):
            self._touch(name)
            return True
        if spec.kind == "server":
            return self._start_server(spec)
        # model: the engine loads on use; just record activity so the watchdog
        # owns the subsequent idle-unload.
        self._touch(name)
        return True

    def stop(self, name: str) -> Dict[str, Any]:
        spec = self._specs.get(name)
        if spec is None:
            return {"success": False, "error": f"unknown service: {name}"}
        # Don't kill a busy service (caller should release first).
        if self._in_flight.get(name, 0) > 0:
            return {"success": False, "error": f"{name} busy (in-flight)"}
        if spec.kind == "server":
            with self._lock:
                proc = self._processes.pop(name, None)
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
        else:  # model
            if spec.unload and (spec.is_loaded is None or spec.is_loaded()):
                try:
                    spec.unload()
                    ColorPrint.yellow(f"[managed] unloaded model {name}")
                except Exception as e:  # noqa: BLE001
                    ColorPrint.yellow(f"[managed] unload {name} failed: {e}")
            _gpu_release()
        self._invalidate_run_cache(name)
        if spec.on_stopped:
            try:
                spec.on_stopped()
            except Exception:  # noqa: BLE001
                pass
        return {"success": True, "name": name, "running": self.is_running(name)}

    # --- busy-protected call wrapper ------------------------------------ #

    @contextmanager
    def using(self, name: str):
        """Wrap a synth/transcribe call: ensure running, mark in-flight (busy
        protection), touch activity on exit. No-op for unregistered services."""
        spec = self._specs.get(name)
        if spec is None:
            yield
            return
        try:
            self.ensure_running(name)
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[managed] ensure_running {name} failed: {e}")
        self._in_flight[name] = self._in_flight.get(name, 0) + 1
        self._touch(name)
        try:
            yield
        finally:
            self._in_flight[name] = max(0, self._in_flight.get(name, 0) - 1)
            self._touch(name)

    # --- status --------------------------------------------------------- #

    def runtime_status(self, name: str) -> Dict[str, Any]:
        spec = self._specs.get(name)
        if spec is None:
            return {}
        running = self.is_running(name)
        managed = (spec.kind == "server" and self._is_managed_process(name)) \
            or (spec.kind == "model" and running)
        st = self._settings(spec.category)
        idle_s = st.get("idle_s", DEFAULT_IDLE_S)
        idle_remaining: Optional[float] = None
        if managed and idle_s > 0 and name in self._last_activity:
            idle_remaining = max(0.0, float(idle_s) - (time.monotonic() - self._last_activity[name]))
        return {
            "name": name,
            "category": spec.category,
            "kind": spec.kind,
            "running": running,
            "managed": managed,
            "enabled": bool(st.get("enabled", {}).get(name, True)),
            "in_flight": self._in_flight.get(name, 0),
            "idle_remaining_s": idle_remaining,
        }

    def all_runtime_status(self, category: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        names = [s.name for s in self._specs.values() if category is None or s.category == category]
        return {n: self.runtime_status(n) for n in names}

    # --- watchdog ------------------------------------------------------- #

    def _reap_dead(self) -> None:
        for name, proc in list(self._processes.items()):
            if proc.poll() is not None:
                self._processes.pop(name, None)
                self._last_activity.pop(name, None)
                self._invalidate_run_cache(name)

    def _shutdown_idle(self) -> None:
        # Group idle seconds by category (one setting per category).
        cat_idle: Dict[str, int] = {}
        for cat, layout in self._categories.items():
            cat_idle[cat] = self._settings(cat).get("idle_s", layout.idle_default)
        now = time.monotonic()
        for name, spec in list(self._specs.items()):
            if self._in_flight.get(name, 0) > 0:
                continue  # busy - never idle-stop
            idle_s = cat_idle.get(spec.category, DEFAULT_IDLE_S)
            if idle_s <= 0:
                continue
            managed = (spec.kind == "server" and self._is_managed_process(name)) \
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
                with self._lock:
                    self._reap_dead()
                self._shutdown_idle()
            except Exception:  # noqa: BLE001
                pass
            time.sleep(_WATCHDOG_POLL_S)

    def _start_watchdog(self) -> None:
        if self._watchdog_started:
            return
        self._watchdog_started = True
        threading.Thread(target=self._watchdog_loop, name="managed-service-idle", daemon=True).start()

    def shutdown_all(self) -> None:
        for name in list(self._specs.keys()):
            if self._in_flight.get(name, 0) > 0:
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
