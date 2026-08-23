# -*- coding: utf-8 -*-
"""Managed subprocess lifecycle and code-identity supervision."""

from __future__ import annotations

import copy
import gc
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import serialized_method, start_bus_task
from pycore.pyfoundations.system_paths import get_app_logs_dir
from pycore.pyfoundations.third_party.api import get_third_package_torch
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
import pycore.pyutils.common.model_load_status as model_load_status


START_TIMEOUT_SECONDS = 180.0
HEALTH_POLL_SECONDS = 1.5
HEALTH_FAILURE_THRESHOLD = 3
READY_MARKER = "QWEN3TTS_READY "
READY_SIGNAL_PREFIX = "managed.service.ready_url."
CODE_IDENTITY_CURRENT = "current"
CODE_IDENTITY_DISABLED = "disabled"
CODE_IDENTITY_STALE = "stale"
CODE_IDENTITY_UNKNOWN = "unknown"
SERVER_CODE_ID_ENV = "PYCORE_MANAGED_CODE_ID"


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
            marker_index = text.find(READY_MARKER)
            if marker_index >= 0:
                endpoint = text[marker_index + len(READY_MARKER):].strip().split(" ", 1)[0]
                if endpoint:
                    THREAD_BUS.signal(f"{READY_SIGNAL_PREFIX}{service_name}", endpoint)
    except Exception:
        pass




class ManagedServiceProcessMixin:
    """Compose server start, adoption, stop, and result fencing."""

    @staticmethod
    def _server_log_path(spec: Any) -> Path:
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

    def _open_server_log(self, spec: Any):
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

    def _wait_healthy(self, spec: Any, timeout_s: float) -> bool:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if self._probe_server(spec) is True:
                return True
            proc = self._processes.get(spec.name)
            if proc is not None and proc.poll() is not None:
                return False
            time.sleep(HEALTH_POLL_SECONDS)
        return self._probe_server(spec) is True

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

    def _start_server(self, spec: Any) -> bool:
        if self._is_managed_process(spec.name):
            self._touch(spec.name)
            return True
        cmd = spec.start_command() if spec.start_command else None
        if cmd is None:
            return False
        # start_command() may return (cwd, argv) or (cwd, argv, env).
        env: Optional[Dict[str, str]] = None
        if len(cmd) >= 3:
            cwd, argv, env = cmd[0], cmd[1], cmd[2]
        else:
            cwd, argv = cmd[0], cmd[1]
        # Code identity: every owned class-C launch carries the digest of the
        # script set it was started from so the lifecycle probe can prove it later.
        expected_code_id = self._expected_code_id(spec)
        if expected_code_id:
            env = dict(env) if env is not None else dict(os.environ)
            env[SERVER_CODE_ID_ENV] = expected_code_id
        self._adopted_servers.discard(spec.name)
        popen_kwargs = self._popen_kwargs(cwd)
        logf = self._open_server_log(spec)
        popen_kwargs["stdout"] = subprocess.PIPE
        popen_kwargs["stderr"] = subprocess.STDOUT
        if env is not None:
            popen_kwargs["env"] = self._launch_env(argv, env)
        THREAD_BUS.clear_signal(f"{READY_SIGNAL_PREFIX}{spec.name}")
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
        ok = self._wait_healthy(spec, START_TIMEOUT_SECONDS)
        self._invalidate_run_cache(spec.name)
        if not ok:
            self.stop(spec.name)
            ColorPrint.yellow(f"[managed] {spec.name} failed to become healthy")
            self._report_load_error(spec.name, "server failed to become healthy")
            return False
        self._run_cache[spec.name] = (time.monotonic(), True)
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
        self._active_server_by_category[category] = except_name
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
        st = self._settings(spec.category)
        if not force:
            if not st.get("enabled", {}).get(name, True):
                return False
            if not st.get("auto_manage", True):
                # Even when auto-manage is off, still track activity so an already-
                # running service gets idle-unloaded; just don't start one.
                running = self.is_running(name)
                if running:
                    self._touch(name)
                return running
        if not spec.installed():
            return False
        if not spec.config_ready():
            return False
        if spec.ready_without_process is not None and spec.ready_without_process():
            self._run_cache[name] = (time.monotonic(), True)
            self._touch(name)
            return True
        foreign_checked = False
        running = self.is_running(name)
        if running and spec.kind == "server" and name in self._adopted_servers:
            # An adopted listener stays usable only while it still runs the
            # code a fresh start would launch (code-identity contract). A busy
            # service is never interrupted; it is refreshed on its next lease.
            identity_state, code_expected, code_reported = self._code_id_state(spec)
            if self.in_flight(name) > 0 or identity_state != CODE_IDENTITY_STALE:
                if st.get("single_active", True):
                    self._stop_others(spec.category, name)
                self._touch(name)
                return True
            self._log_stale_code(name, code_expected, code_reported, "adopted server")
            stopped = self.stop(name)
            if not stopped.get("success"):
                return False
            self._invalidate_run_cache(name)
            running = False
        if running:
            if (
                spec.kind == "server"
                and not self._is_managed_process(name)
                and spec.stop_foreign is not None
            ):
                adoption_contract = (
                    spec.adopt_foreign is not None
                    or bool(self._expected_code_id(spec))
                )
                if adoption_contract:
                    compatible = True
                    if spec.adopt_foreign is not None:
                        try:
                            compatible = bool(spec.adopt_foreign())
                        except Exception as e:  # noqa: BLE001
                            compatible = False
                            ColorPrint.yellow(
                                f"[managed] {name}: adoption probe failed: {e}"
                            )
                    identity_state, code_expected, code_reported = self._code_id_state(spec)
                    if identity_state == CODE_IDENTITY_UNKNOWN:
                        return False
                    if identity_state == CODE_IDENTITY_STALE:
                        compatible = False
                        self._log_stale_code(
                            name, code_expected, code_reported, "foreign listener"
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
                stale_owned = (
                    spec.kind == "server"
                    and self._is_managed_process(name)
                    and self.in_flight(name) == 0
                )
                if stale_owned:
                    identity_state, code_expected, code_reported = self._code_id_state(spec)
                    stale_owned = identity_state == CODE_IDENTITY_STALE
                    if stale_owned:
                        # Script set changed under a live owned process - restart
                        # it so the server always runs the code a start would load.
                        self._log_stale_code(name, code_expected, code_reported, "owned server")
                        stopped = self.stop(name)
                        if not stopped.get("success"):
                            return False
                        self._invalidate_run_cache(name)
                if not stale_owned:
                    if st.get("single_active", True):
                        self._stop_others(spec.category, name)
                    self._touch(name)
                    return True
        if spec.kind == "server" and self._is_managed_process(name):
            if self.in_flight(name) > 0:
                return False
            stopped = self.stop(name)
            if not stopped.get("success"):
                return False
        if spec.kind == "server" and spec.external:
            return False
        if spec.kind == "server":
            if spec.stop_foreign is not None and not foreign_checked:
                present = spec.foreign_present() if spec.foreign_present is not None else True
                if present is None:
                    return False
                reclaim_result = None
                if present:
                    identity_state, _expected, _reported = self._code_id_state(spec)
                    if identity_state == CODE_IDENTITY_UNKNOWN:
                        return False
                    try:
                        reclaim_result = spec.stop_foreign()
                    except Exception as e:  # noqa: BLE001
                        ColorPrint.yellow(f"[managed] {name} foreign preflight failed: {e}")
                if reclaim_result is False:
                    ColorPrint.yellow(
                        f"[managed] {name}: occupied service port could not be reclaimed"
                    )
                    return False
                if present and reclaim_result is True:
                    self._invalidate_run_cache(name)
            if st.get("single_active", True):
                self._stop_others(spec.category, name)
            started = self._start_server(spec)
            if not started:
                self._clear_active_server(name, spec.category)
            return started
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
        self._clear_active_server(name, spec.category)
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
        THREAD_BUS.clear_signal(f"{READY_SIGNAL_PREFIX}{name}")
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

__all__ = [
    "CODE_IDENTITY_CURRENT",
    "CODE_IDENTITY_DISABLED",
    "CODE_IDENTITY_STALE",
    "CODE_IDENTITY_UNKNOWN",
    "READY_SIGNAL_PREFIX",
    "SERVER_CODE_ID_ENV",
    "START_TIMEOUT_SECONDS",
    "ManagedServiceProcessMixin",
]
