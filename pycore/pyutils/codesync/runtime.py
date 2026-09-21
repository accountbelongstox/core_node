# -*- coding: utf-8 -*-
"""codesync.runtime - the bridge / shim layer."""

import hashlib
import json as _json
import os
import platform
import re
import socket
import subprocess
import sys
import threading
import time
import uuid
from collections import deque
from functools import partial
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyutils.common.http_client import HttpClient
from pycore.pyutils.common.strtools.normalization import to_bool
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS as shared_thread_bus
from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread as SharedSerializedWorkerThread,
    call_serialized as shared_call_serialized,
    init_serialized_owner as shared_init_serialized_owner,
    serialized_method,
)

try:
    import winreg
except ImportError:  # Windows-only standard-library module.
    winreg = None




class _ThreadBusProxy:
    """Forward to pycore THREAD_BUS when injected, otherwise use fallback."""

    def __init__(self) -> None:
        self._delegate = shared_thread_bus

    def attach(self, delegate: Any) -> None:
        if delegate is not None:
            self._delegate = delegate

    def __getattr__(self, name: str) -> Any:
        return getattr(self._delegate, name)


THREAD_BUS = _ThreadBusProxy()
_LOCAL_SHUTDOWN_SIGNAL = "codesync.runtime.shutdown"
_RUNTIME_CONFIG_SIGNAL = "codesync.runtime.config"
_DEFAULT_RUNTIME_CONFIG: Dict[str, Any] = {
    "logger": None,
    "light": None,
    "emit_event": None,
    "is_shutdown_requested": None,
    "register_shutdown_handler": None,
    "machine_id": None,
    "hardware_machine_id": None,
    "lan_ip": None,
    "core_node_root": None,
    "app_data_dir": None,
}
THREAD_BUS.signal(_LOCAL_SHUTDOWN_SIGNAL, False)
THREAD_BUS.signal(_RUNTIME_CONFIG_SIGNAL, dict(_DEFAULT_RUNTIME_CONFIG))


def _response_guard_name(response_signal: str) -> str:
    return f"{response_signal}.waiting"


def _publish_response(
    response_signal: str,
    response_guard: str,
    response: Dict[str, Any],
) -> None:
    if not response_signal:
        return
    if response_guard:
        THREAD_BUS.signal_if_present(response_guard, response_signal, response)
        return
    THREAD_BUS.signal(response_signal, response)


class BusTaskThread(threading.Thread):
    """Execute one callback delivered through the codesync THREAD_BUS proxy."""

    def __init__(self, queue_name: str, thread_name: str, daemon: bool = True) -> None:
        super().__init__(name=thread_name, daemon=daemon)
        self._queue_name = queue_name

    def run(self) -> None:
        request = THREAD_BUS.receive_message(self._queue_name)
        if not isinstance(request, dict):
            return
        response_signal = request.get("response_signal", "")
        response_guard = request.get("response_guard", "")
        try:
            result = request["callback"](*request.get("args", ()), **request.get("kwargs", {}))
            response = {"success": True, "result": result}
        except Exception as exc:
            response = {"success": False, "error": str(exc)}
        http.close_current_thread()
        _publish_response(response_signal, response_guard, response)
        THREAD_BUS.clear_queue(self._queue_name)


def start_bus_task(
    callback: Callable,
    *args: Any,
    thread_name: str = "CodeSyncBusTask",
    daemon: bool = True,
    response_signal: str = "",
    **kwargs: Any,
) -> BusTaskThread:
    """Start a named Thread subclass whose task payload crosses THREAD_BUS."""
    queue_name = f"codesync.bus_task.{uuid.uuid4().hex}"
    response_guard = _response_guard_name(response_signal) if response_signal else ""
    if response_guard:
        THREAD_BUS.signal(response_guard, True)
    THREAD_BUS.send_message(queue_name, {
        "callback": callback,
        "args": args,
        "kwargs": kwargs,
        "response_signal": response_signal,
        "response_guard": response_guard,
    })
    worker = BusTaskThread(queue_name, thread_name, daemon)
    try:
        worker.start()
    except Exception:
        THREAD_BUS.clear_queue(queue_name)
        if response_guard:
            THREAD_BUS.clear_signal(response_guard)
        raise
    return worker


SerializedWorkerThread = partial(SharedSerializedWorkerThread, bus=THREAD_BUS)
call_serialized = partial(shared_call_serialized, bus=THREAD_BUS)
init_serialized_owner = partial(shared_init_serialized_owner, bus=THREAD_BUS)


class LocalShutdownRegistry:
    """Own standalone shutdown handlers on a serialized codesync worker."""

    def __init__(self) -> None:
        self._handlers: List[Dict[str, Any]] = []
        init_serialized_owner(
            self,
            "codesync.runtime.shutdown_handlers",
            "CodeSyncShutdownHandlerStateThread",
        )

    @serialized_method
    def add(self, handler: Callable, priority: int, name: str) -> None:
        self._handlers.append({
            "handler": handler,
            "priority": priority,
            "name": name,
        })

    @serialized_method
    def snapshot(self) -> List[Dict[str, Any]]:
        return [dict(entry) for entry in self._handlers]


_LOCAL_SHUTDOWN_REGISTRY = LocalShutdownRegistry()


# --------------------------------------------------------------------------- #
# injectable hooks (set by configure(); stdlib fallbacks otherwise)            #
# --------------------------------------------------------------------------- #
# Light mode: a CLIENT node that only tracks the mesh (peer status / heartbeats)
# and never receives/serves files or scans the tree. Precedence:
#   explicit set_light()/configure(light=) > env CODESYNC_LIGHT > default OFF.
# None means "not explicitly set" -> fall back to the env var.
def _runtime_config() -> Dict[str, Any]:
    """Return the current injected-service snapshot from THREAD_BUS."""
    return dict(THREAD_BUS.get_signal(_RUNTIME_CONFIG_SIGNAL, _DEFAULT_RUNTIME_CONFIG))


def _runtime_hook(name: str) -> Optional[Callable]:
    return _runtime_config().get(name)


def set_light(value) -> None:
    """Explicitly set light mode (overrides the CODESYNC_LIGHT env var)."""
    config = _runtime_config()
    config["light"] = bool(value)
    THREAD_BUS.signal(_RUNTIME_CONFIG_SIGNAL, config)


def is_light() -> bool:
    """Return the effective light-mode flag: the explicitly-set value if any,
    else the CODESYNC_LIGHT env var (truthy set), else False."""
    light = _runtime_config().get("light")
    if light is not None:
        return bool(light)
    return to_bool(os.environ.get("CODESYNC_LIGHT", ""))


def configure(*, logger=None, emit_event=None, thread_bus=None, is_shutdown_requested=None,
              register_shutdown_handler=None, machine_id=None,
              hardware_machine_id=None, lan_ip=None,
              core_node_root=None, app_data_dir=None, light=None):
    """Inject the host runtime's services. Called once by full pycore at startup;
    never called in standalone mode (stdlib defaults stay in effect)."""
    config = _runtime_config()
    if logger is not None:
        config["logger"] = logger
    if light is not None:
        config["light"] = bool(light)
    THREAD_BUS.attach(thread_bus)
    for key, val in (("emit_event", emit_event),
                     ("is_shutdown_requested", is_shutdown_requested),
                     ("register_shutdown_handler", register_shutdown_handler),
                     ("machine_id", machine_id),
                     ("hardware_machine_id", hardware_machine_id),
                     ("lan_ip", lan_ip),
                     ("core_node_root", core_node_root),
                     ("app_data_dir", app_data_dir)):
        if val is not None:
            config[key] = val
    THREAD_BUS.signal(_RUNTIME_CONFIG_SIGNAL, config)


# --------------------------------------------------------------------------- #
# logging shim — same call surface as pycore.ColorPrint (.green/.blue/...)     #
# Default writes to STDERR so the CLI's JSON stdout stays clean.               #
# --------------------------------------------------------------------------- #
class _Log:
    def _emit(self, level, msg):
        external_logger = _runtime_config().get("logger")
        if external_logger is not None:
            getattr(external_logger, level, None) and getattr(external_logger, level)(msg)
            return
        sys.stderr.write(f"{msg}\n")
        sys.stderr.flush()

    def green(self, msg):
        self._emit("green", msg)

    def blue(self, msg):
        self._emit("blue", msg)

    def yellow(self, msg):
        self._emit("yellow", msg)

    def red(self, msg):
        self._emit("red", msg)


log = _Log()


# --------------------------------------------------------------------------- #
# Shared HTTP client. It exposes the requests-compatible subset Code Sync uses. #
# --------------------------------------------------------------------------- #
http = HttpClient()


# --------------------------------------------------------------------------- #
# event bus + shutdown                                                         #
# --------------------------------------------------------------------------- #
def emit_event(name: str, payload: Any = None, async_mode: bool = False, **_kw) -> None:
    """Fire a UI/event-bus event (e.g. 'code_sync_update'). No-op standalone."""
    fn = _runtime_hook("emit_event")
    if fn is None:
        return
    try:
        fn(name, payload, async_mode=async_mode)
    except TypeError:
        try:
            fn(name, payload)
        except Exception:
            pass
    except Exception:
        pass


def is_shutdown_requested() -> bool:
    fn = _runtime_hook("is_shutdown_requested")
    if fn is not None:
        try:
            return bool(fn())
        except Exception:
            return False
    return bool(THREAD_BUS.get_signal(_LOCAL_SHUTDOWN_SIGNAL, False))


def register_shutdown_handler(handler: Callable, priority: int = 50, name: str = "") -> None:
    fn = _runtime_hook("register_shutdown_handler")
    if fn is not None:
        try:
            fn(handler, priority=priority, name=name)
            return
        except Exception:
            pass
    _LOCAL_SHUTDOWN_REGISTRY.add(handler, priority, name)


def request_local_shutdown() -> None:
    """Standalone daemon stop: set the flag and run registered handlers (high
    priority first). No effect on the injected (pycore) path."""
    THREAD_BUS.signal(_LOCAL_SHUTDOWN_SIGNAL, True)
    handlers = _LOCAL_SHUTDOWN_REGISTRY.snapshot()
    for entry in sorted(handlers, key=lambda e: -e.get("priority", 50)):
        try:
            entry["handler"]()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# identity + paths (stdlib; identical results to the pycore helpers)           #
# --------------------------------------------------------------------------- #
_INVALID_SMBIOS_UUIDS = frozenset({
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
})
_SMBIOS_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def _subprocess_no_window() -> int:
    return subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0


def _normalize_uuid(value: str) -> str:
    return value.strip().lower()


def _is_valid_smbios_uuid(value: Optional[str]) -> bool:
    if not value:
        return False
    norm = _normalize_uuid(value)
    if norm in _INVALID_SMBIOS_UUIDS:
        return False
    if norm.replace("-", "") == "0" * 32:
        return False
    return bool(_SMBIOS_UUID_RE.match(norm))


def _digest_id(prefix: str, raw: str) -> str:
    return hashlib.sha256(f"{prefix}{raw}".encode("utf-8", errors="replace")).hexdigest()


def _stdlib_windows_smbios_uuid() -> Optional[str]:
    try:
        if sys.platform != "win32":
            return None
        out = subprocess.run(
            ["wmic", "csproduct", "get", "uuid"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=_subprocess_no_window(),
        )
        if out.returncode != 0 or not out.stdout:
            return None
        lines = [l.strip() for l in out.stdout.splitlines()
                 if l.strip() and l.strip().lower() != "uuid"]
        return lines[0] if lines else None
    except Exception:
        return None


def _stdlib_linux_smbios_uuid() -> Optional[str]:
    if not sys.platform.startswith("linux"):
        return None
    for path in ("/sys/class/dmi/id/product_uuid",
                 "/sys/devices/virtual/dmi/id/product_uuid"):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                value = (fh.read() or "").strip()
                if value:
                    return value
        except Exception:
            continue
    return None


def _stdlib_read_smbios_product_uuid() -> Optional[str]:
    if sys.platform == "win32":
        return _stdlib_windows_smbios_uuid()
    if sys.platform.startswith("linux"):
        return _stdlib_linux_smbios_uuid()
    return None


def _stdlib_machine_id() -> str:
    """Replicates pycore.pyfoundations.machine_id.get_machine_id() exactly so
    the self-entry id in the committed peers file is identical in both modes."""
    raw: Optional[str] = None
    try:
        if sys.platform == "win32":
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                                     r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ)
                guid, _ = winreg.QueryValueEx(key, "MachineGuid")
                winreg.CloseKey(key)
                raw = (guid or "").strip()
            except Exception:
                raw = None
            if not raw:
                raw = _stdlib_windows_smbios_uuid()
        elif sys.platform.startswith("linux"):
            for path in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
                try:
                    with open(path, "r", encoding="utf-8", errors="replace") as fh:
                        mid = (fh.read() or "").strip()
                        if mid:
                            raw = mid
                            break
                except Exception:
                    continue
    except Exception:
        raw = None
    if not raw:
        raw = f"{platform.node()}|{uuid.getnode()}"
    return _digest_id("", raw)


def _stdlib_hardware_machine_id() -> str:
    """Replicates pycore.pyfoundations.machine_id.get_hardware_machine_id()."""
    raw = _stdlib_read_smbios_product_uuid()
    if raw and _is_valid_smbios_uuid(raw):
        return _digest_id("smbios:", _normalize_uuid(raw))
    return _stdlib_machine_id()


def get_machine_id() -> str:
    fn = _runtime_hook("machine_id")
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return _stdlib_machine_id()


def get_hardware_machine_id() -> str:
    fn = _runtime_hook("hardware_machine_id")
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return _stdlib_hardware_machine_id()


def get_local_lan_ip() -> str:
    fn = _runtime_hook("lan_ip")
    if fn is not None:
        try:
            ip = fn()
            if ip:
                return ip
        except Exception:
            pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return HTTP_LOOPBACK_HOST


def get_core_node_root() -> Path:
    """Repo root. This file: <root>/pycore/pyutils/codesync/runtime.py → 4 up."""
    fn = _runtime_hook("core_node_root")
    if fn is not None:
        try:
            return Path(fn())
        except Exception:
            pass
    return Path(__file__).resolve().parents[3]


def _ensure_dir(path: Path) -> Path:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    return path


def get_app_data_dir() -> Path:
    """Per-user persistent data dir — identical to pycore.system_paths.get_app_data_dir():
    <system_cache_dir>/data, where system_cache_dir is ~/.core_node on Windows and
    /var/_core_node (if writable) else ~/.core_node on Linux."""
    fn = _runtime_hook("app_data_dir")
    if fn is not None:
        try:
            return Path(fn())
        except Exception:
            pass
    if sys.platform == "win32":
        # Mirror pycore.system_paths.get_system_cache_dir (kept stdlib-only so
        # codesync runs standalone without importing the pycore package).
        _user = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
        cache = _ensure_dir(Path('D:/programing/Users') / _user / '.core_node')
    else:
        shared = Path("/var/_core_node")
        try:
            _ensure_dir(shared)
        except Exception:
            pass
        if shared.is_dir() and os.access(shared, os.W_OK):
            cache = shared
        else:
            cache = _ensure_dir(Path.home() / ".core_node")
    return _ensure_dir(cache / "data")


def get_codesync_cache_dir() -> Path:
    """CodeSync runtime cache, isolated from the Pycore application cache."""
    env_val = os.environ.get('CORE_NODE_CACHE_DIR')
    if env_val:
        return _ensure_dir(Path(env_val) / 'codesync')
    if sys.platform == 'win32':
        return _ensure_dir(Path('D:/www/cache') / 'codesync')
    shared = Path('/var/_core_node/cache')
    try:
        _ensure_dir(shared)
    except Exception:
        pass
    if shared.is_dir() and os.access(shared, os.W_OK):
        return _ensure_dir(shared / 'codesync')
    return _ensure_dir(Path.home() / '.core_node' / 'cache' / 'codesync')


# The committed peer list — the SHIPPED DEFAULT (baseline), read-only at runtime.
# Kept at its historical path so existing repo history / full-pycore reads are
# unchanged. Runtime edits never write here (see get_peers_override_file).
def get_peers_config_file() -> Path:
    return get_core_node_root() / "pycore" / "pyutils" / "codesync" / "code_sync_peers.json"


# Per-machine override for the peer list. Gitignored (<cache>/codesync/...), so
# every machine keeps its own role/peers/edits here WITHOUT touching the committed
# baseline. Loaded with priority over the baseline; this is the only file the
# runtime writes to.
def get_peers_override_file() -> Path:
    return get_codesync_cache_dir() / "code_sync_peers.json"
