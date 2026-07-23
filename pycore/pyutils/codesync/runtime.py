# -*- coding: utf-8 -*-
"""
codesync.runtime — the bridge / shim layer (stdlib only).

This module is the ONLY place the codesync library talks to the outside world.
It has **zero** dependency on the `pycore` package and imports **only the Python
standard library**, so the whole `codesync` package can run standalone
(`pyservice.sh codesync ...`) without booting the full pycore runtime, without
`third_party`, and without the `pyservice.sh` prerequisite install.

When the full pycore runtime IS running, it calls `codesync.configure(...)` once
at startup to *inject* its richer services (ColorPrint logging, THREAD_BUS event
bus / shutdown, machine-id). Until/unless that happens, the stdlib defaults below
are used — and they are deliberately byte-for-byte compatible with the pycore
implementations they replace (same machine-id algorithm, same `~/.core_node`
cache dir, same repo-root resolution) so both modes share one committed
`code_sync_peers.json` and the same self-identity.
"""

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
import urllib.error
import urllib.request
import uuid
from collections import deque
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import winreg


class _FallbackThreadBus:
    """Lock-free in-process bus used only by standalone codesync."""

    def __init__(self) -> None:
        self._queues: Dict[str, deque] = {}
        self._signals: Dict[str, Any] = {}

    def send_message(self, name: str, message: Any) -> None:
        self._queues.setdefault(name, deque()).append(message)

    def receive_message(
        self,
        name: str,
        block: bool = False,
        timeout: Optional[float] = None,
    ) -> Any:
        started_at = time.monotonic()
        message_queue = self._queues.setdefault(name, deque())
        while True:
            try:
                return message_queue.popleft()
            except IndexError:
                if not block:
                    return None
                if timeout is not None and time.monotonic() - started_at >= timeout:
                    return None
                time.sleep(0.01)

    def queue_size(self, name: str) -> int:
        return len(self._queues.setdefault(name, deque()))

    def clear_queue(self, name: str) -> None:
        self._queues.pop(name, None)

    def signal(self, name: str, data: Any = None) -> None:
        self._signals[name] = data

    def get_signal(self, name: str, default: Any = None) -> Any:
        return self._signals.get(name, default)

    def clear_signal(self, name: str) -> None:
        self._signals.pop(name, None)

    def wait_signal(self, name: str, timeout: Optional[float] = None) -> Any:
        started_at = time.monotonic()
        while name not in self._signals:
            if timeout is not None and time.monotonic() - started_at >= timeout:
                return None
            time.sleep(0.01)
        return self._signals.get(name)


class _ThreadBusProxy:
    """Forward to pycore THREAD_BUS when injected, otherwise use fallback."""

    def __init__(self) -> None:
        self._delegate = _FallbackThreadBus()

    def attach(self, delegate: Any) -> None:
        if delegate is not None:
            self._delegate = delegate

    def __getattr__(self, name: str) -> Any:
        return getattr(self._delegate, name)


THREAD_BUS = _ThreadBusProxy()
_LOCAL_SHUTDOWN_SIGNAL = "codesync.runtime.shutdown"
THREAD_BUS.signal(_LOCAL_SHUTDOWN_SIGNAL, False)


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
        try:
            result = request["callback"](*request.get("args", ()), **request.get("kwargs", {}))
            response = {"success": True, "result": result}
        except Exception as exc:
            response = {"success": False, "error": str(exc)}
        if response_signal:
            THREAD_BUS.signal(response_signal, response)
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
    THREAD_BUS.send_message(queue_name, {
        "callback": callback,
        "args": args,
        "kwargs": kwargs,
        "response_signal": response_signal,
    })
    worker = BusTaskThread(queue_name, thread_name, daemon)
    worker.start()
    return worker


class SerializedWorkerThread(threading.Thread):
    """Own mutable state and execute requests received from THREAD_BUS."""

    def __init__(self, queue_name: str, thread_name: str) -> None:
        super().__init__(name=thread_name, daemon=True)
        self._queue_name = queue_name

    def run(self) -> None:
        while True:
            request = THREAD_BUS.receive_message(self._queue_name, block=True, timeout=0.1)
            if not isinstance(request, dict):
                continue
            response_signal = request.get("response_signal", "")
            try:
                result = request["callback"](*request.get("args", ()), **request.get("kwargs", {}))
                response = {"success": True, "result": result}
            except Exception as exc:
                response = {"success": False, "error": str(exc)}
            if response_signal:
                THREAD_BUS.signal(response_signal, response)


def call_serialized(queue_name: str, callback: Callable, *args: Any, **kwargs: Any) -> Any:
    response_signal = f"{queue_name}.response.{uuid.uuid4().hex}"
    THREAD_BUS.send_message(queue_name, {
        "callback": callback,
        "args": args,
        "kwargs": kwargs,
        "response_signal": response_signal,
    })
    response = THREAD_BUS.wait_signal(response_signal, timeout=30.0)
    THREAD_BUS.clear_signal(response_signal)
    if not isinstance(response, dict):
        raise TimeoutError(f"CodeSync serialized operation timed out: {queue_name}")
    if not response.get("success"):
        raise RuntimeError(response.get("error", "CodeSync serialized operation failed"))
    return response.get("result")


def init_serialized_owner(owner: Any, queue_prefix: str, thread_prefix: str) -> None:
    owner_id = uuid.uuid4().hex
    owner._serialized_queue_name = f"{queue_prefix}.{owner_id}"
    owner._serialized_thread_name = f"{thread_prefix}-{owner_id[:8]}"
    worker = SerializedWorkerThread(owner._serialized_queue_name, owner._serialized_thread_name)
    worker.start()


def _invoke_serialized_method(
    method: Callable,
    owner: Any,
    args: tuple,
    kwargs: Dict[str, Any],
) -> Any:
    return method(owner, *args, **kwargs)


def serialized_method(method: Callable) -> Callable:
    @wraps(method)
    def wrapper(owner: Any, *args: Any, **kwargs: Any) -> Any:
        if threading.current_thread().name == getattr(owner, "_serialized_thread_name", ""):
            return method(owner, *args, **kwargs)
        return call_serialized(
            owner._serialized_queue_name,
            _invoke_serialized_method,
            method,
            owner,
            args,
            kwargs,
        )
    return wrapper


# --------------------------------------------------------------------------- #
# injectable hooks (set by configure(); stdlib fallbacks otherwise)            #
# --------------------------------------------------------------------------- #
_hooks: Dict[str, Optional[Callable]] = {
    "emit_event": None,
    "is_shutdown_requested": None,
    "register_shutdown_handler": None,
    "machine_id": None,
    "hardware_machine_id": None,
    "lan_ip": None,
    "core_node_root": None,
    "app_data_dir": None,
}
_external_logger = None  # e.g. pycore.ColorPrint
_local_shutdown_handlers: List[Dict[str, Any]] = []

# Light mode: a CLIENT node that only tracks the mesh (peer status / heartbeats)
# and never receives/serves files or scans the tree. Precedence:
#   explicit set_light()/configure(light=) > env CODESYNC_LIGHT > default OFF.
# None means "not explicitly set" -> fall back to the env var.
_LIGHT_TRUTHY = ("1", "true", "True", "yes", "on")
_light: Optional[bool] = None


def set_light(value) -> None:
    """Explicitly set light mode (overrides the CODESYNC_LIGHT env var)."""
    global _light
    _light = bool(value)


def is_light() -> bool:
    """Return the effective light-mode flag: the explicitly-set value if any,
    else the CODESYNC_LIGHT env var (truthy set), else False."""
    if _light is not None:
        return _light
    return os.environ.get("CODESYNC_LIGHT", "") in _LIGHT_TRUTHY


def configure(*, logger=None, emit_event=None, thread_bus=None, is_shutdown_requested=None,
              register_shutdown_handler=None, machine_id=None,
              hardware_machine_id=None, lan_ip=None,
              core_node_root=None, app_data_dir=None, light=None):
    """Inject the host runtime's services. Called once by full pycore at startup;
    never called in standalone mode (stdlib defaults stay in effect)."""
    global _external_logger
    if logger is not None:
        _external_logger = logger
    if light is not None:
        set_light(light)
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
            _hooks[key] = val


# --------------------------------------------------------------------------- #
# logging shim — same call surface as pycore.ColorPrint (.green/.blue/...)     #
# Default writes to STDERR so the CLI's JSON stdout stays clean.               #
# --------------------------------------------------------------------------- #
class _Log:
    def _emit(self, level, msg):
        if _external_logger is not None:
            getattr(_external_logger, level, None) and getattr(_external_logger, level)(msg)
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
# HTTP client shim — `requests`-compatible subset over urllib (stdlib).        #
# Matches requests semantics the codesync code relies on: returns a response   #
# object with .status_code/.json()/.content/.text and does NOT raise on HTTP   #
# 4xx/5xx (only connection/timeout errors raise, which callers catch).         #
# --------------------------------------------------------------------------- #
class _Resp:
    def __init__(self, status_code: int, content: bytes):
        self.status_code = status_code
        self.content = content

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")

    def json(self):
        return _json.loads(self.content.decode("utf-8", errors="replace"))


class _Http:
    def get(self, url: str, timeout: float = 10.0) -> _Resp:
        return self._request("GET", url, None, timeout)

    def post(self, url: str, json: Any = None, timeout: float = 10.0) -> _Resp:
        return self._request("POST", url, json, timeout)

    def _request(self, method: str, url: str, json_body: Any, timeout: float) -> _Resp:
        data = None
        headers = {}
        if json_body is not None:
            data = _json.dumps(json_body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return _Resp(resp.getcode(), resp.read())
        except urllib.error.HTTPError as exc:
            # 4xx/5xx: behave like requests — return the response, don't raise.
            try:
                body = exc.read() or b""
            except Exception:
                body = b""
            return _Resp(exc.code, body)
        # urllib.error.URLError / socket.timeout / OSError propagate to the
        # caller's `except Exception` (same as requests' ConnectionError).


http = _Http()


# --------------------------------------------------------------------------- #
# event bus + shutdown                                                         #
# --------------------------------------------------------------------------- #
def emit_event(name: str, payload: Any = None, async_mode: bool = False, **_kw) -> None:
    """Fire a UI/event-bus event (e.g. 'code_sync_update'). No-op standalone."""
    fn = _hooks["emit_event"]
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
    fn = _hooks["is_shutdown_requested"]
    if fn is not None:
        try:
            return bool(fn())
        except Exception:
            return False
    return bool(THREAD_BUS.get_signal(_LOCAL_SHUTDOWN_SIGNAL, False))


def register_shutdown_handler(handler: Callable, priority: int = 50, name: str = "") -> None:
    fn = _hooks["register_shutdown_handler"]
    if fn is not None:
        try:
            fn(handler, priority=priority, name=name)
            return
        except Exception:
            pass
    _local_shutdown_handlers.append({"handler": handler, "priority": priority, "name": name})


def request_local_shutdown() -> None:
    """Standalone daemon stop: set the flag and run registered handlers (high
    priority first). No effect on the injected (pycore) path."""
    THREAD_BUS.signal(_LOCAL_SHUTDOWN_SIGNAL, True)
    for entry in sorted(_local_shutdown_handlers, key=lambda e: -e.get("priority", 50)):
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
    """Replicates pycore.pyutils.security.machine_id.get_machine_id() exactly so
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
    """Replicates pycore.pyutils.security.machine_id.get_hardware_machine_id()."""
    raw = _stdlib_read_smbios_product_uuid()
    if raw and _is_valid_smbios_uuid(raw):
        return _digest_id("smbios:", _normalize_uuid(raw))
    return _stdlib_machine_id()


def get_machine_id() -> str:
    fn = _hooks["machine_id"]
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return _stdlib_machine_id()


def get_hardware_machine_id() -> str:
    fn = _hooks["hardware_machine_id"]
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return _stdlib_hardware_machine_id()


def get_local_lan_ip() -> str:
    fn = _hooks["lan_ip"]
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
        return "127.0.0.1"


def get_core_node_root() -> Path:
    """Repo root. This file: <root>/pycore/pyutils/codesync/runtime.py → 4 up."""
    fn = _hooks["core_node_root"]
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
    fn = _hooks["app_data_dir"]
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


def get_local_data_dir() -> Path:
    """Local data dir for pycore (models/staging/state) - mirrors
    pycore.system_paths.get_local_data_dir(): <cache>/pycore.
    Windows: D:\\www\\cache\\pycore; Linux: /var/_core_node/cache/pycore."""
    env_val = os.environ.get('CORE_NODE_CACHE_DIR')
    if env_val:
        return _ensure_dir(Path(env_val) / 'pycore')
    if sys.platform == 'win32':
        return _ensure_dir(Path('D:/www/cache') / 'pycore')
    shared = Path('/var/_core_node/cache')
    try:
        _ensure_dir(shared)
    except Exception:
        pass
    if shared.is_dir() and os.access(shared, os.W_OK):
        return _ensure_dir(shared / 'pycore')
    return _ensure_dir(Path.home() / '.core_node' / 'cache' / 'pycore')


# The committed peer list — the SHIPPED DEFAULT (baseline), read-only at runtime.
# Kept at its historical path so existing repo history / full-pycore reads are
# unchanged. Runtime edits never write here (see get_peers_override_file).
def get_peers_config_file() -> Path:
    return get_core_node_root() / "pycore" / "pyutils" / "codesync" / "code_sync_peers.json"


# Per-machine override for the peer list. Gitignored (<cache>/pycore/codesync/...), so
# every machine keeps its own role/peers/edits here WITHOUT touching the committed
# baseline. Loaded with priority over the baseline; this is the only file the
# runtime writes to.
def get_peers_override_file() -> Path:
    return get_local_data_dir() / "codesync" / "code_sync_peers.json"
