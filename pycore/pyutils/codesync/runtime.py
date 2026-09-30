# -*- coding: utf-8 -*-
"""codesync.runtime - the bridge / shim layer."""

import json
import os
import socket
from functools import partial
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyutils.common.client_key_auth import client_key_headers
from pycore.pyutils.common.http_client import HttpClient, HttpResponse
from pycore.pyutils.common.strtools.normalization import to_bool
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS as shared_thread_bus
from pycore.pyfoundations.machine_id import (
    get_hardware_machine_id as shared_get_hardware_machine_id,
    get_machine_id as shared_get_machine_id,
)
from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.core_node_dirs import get_core_node_data_dir as _get_core_node_data_dir
from pycore.pyfoundations.system_paths import (
    get_shared_download_cache_dir as _get_shared_download_cache_dir,
)
from pycore.pyfoundations.serialized_worker import (
    BusTaskThread,
    SerializedWorkerThread as SharedSerializedWorkerThread,
    call_serialized as shared_call_serialized,
    init_serialized_owner as shared_init_serialized_owner,
    serialized_method,
    start_bus_task as shared_start_bus_task,
)


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


def _run_with_http_cleanup(callback: Callable, *args: Any, **kwargs: Any) -> Any:
    """Run one Code Sync task, then close the thread's pooled HTTP client."""
    try:
        return callback(*args, **kwargs)
    finally:
        http.close_current_thread()


def start_bus_task(
    callback: Callable,
    *args: Any,
    thread_name: str = "CodeSyncBusTask",
    daemon: bool = True,
    response_signal: str = "",
    **kwargs: Any,
) -> BusTaskThread:
    """The shared pyfoundations bus task, plus per-thread HTTP client cleanup."""
    return shared_start_bus_task(
        _run_with_http_cleanup,
        callback,
        *args,
        thread_name=thread_name,
        daemon=daemon,
        response_signal=response_signal,
        **kwargs,
    )


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
# Default is ColorPrint (STDERR) so the CLI's JSON stdout stays clean.         #
# --------------------------------------------------------------------------- #
class _Log:
    def _emit(self, level, msg):
        external_logger = _runtime_config().get("logger")
        if external_logger is not None:
            getattr(external_logger, level, None) and getattr(external_logger, level)(msg)
            return
        getattr(ColorPrint, level)(msg)

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
PEER_JSON_CONTENT_TYPE = "application/json"


def signed_peer_headers(method: str, url: str, body: bytes = b"", content_type: str = "") -> Dict[str, str]:
    """K3 headers for one call to another pycore (K7: a non-loopback caller signs)."""
    return client_key_headers(method, url, body, content_type)


def signed_peer_request(
    method: str,
    url: str,
    payload: Any = None,
    timeout: Optional[float] = None,
) -> HttpResponse:
    """Every Code Sync peer call: the JSON body is encoded once and those exact
    bytes are signed (K3), so the peer's K7 gate admits the request."""
    body = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if payload is not None
        else None
    )
    headers = {"Content-Type": PEER_JSON_CONTENT_TYPE} if body is not None else {}
    headers.update(signed_peer_headers(method, url, body or b"", headers.get("Content-Type", "")))
    return http.request(method, url, timeout=timeout, headers=headers, body=body)


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
# identity + paths                                                             #
# --------------------------------------------------------------------------- #
def get_machine_id() -> str:
    fn = _runtime_hook("machine_id")
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return shared_get_machine_id()


def get_hardware_machine_id() -> str:
    fn = _runtime_hook("hardware_machine_id")
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return shared_get_hardware_machine_id()


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
    <core_node_data_dir>/data (Windows D:\\www\\core_node; Linux /www/www/core_node
    or /www/core_node if writable, else ~/core_node)."""
    fn = _runtime_hook("app_data_dir")
    if fn is not None:
        try:
            return Path(fn())
        except Exception:
            pass
    return _ensure_dir(_get_core_node_data_dir() / "data")


def get_codesync_cache_dir() -> Path:
    """CodeSync runtime cache, isolated from the Pycore application cache."""
    return _ensure_dir(_get_shared_download_cache_dir() / 'codesync')


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
