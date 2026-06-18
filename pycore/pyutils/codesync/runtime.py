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
import socket
import sys
import threading
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

# --------------------------------------------------------------------------- #
# injectable hooks (set by configure(); stdlib fallbacks otherwise)            #
# --------------------------------------------------------------------------- #
_hooks: Dict[str, Optional[Callable]] = {
    "emit_event": None,
    "is_shutdown_requested": None,
    "register_shutdown_handler": None,
    "machine_id": None,
    "lan_ip": None,
    "core_node_root": None,
    "app_data_dir": None,
}
_external_logger = None  # e.g. pycore.ColorPrint
_local_shutdown = threading.Event()           # standalone stop signal
_local_shutdown_handlers: List[Dict[str, Any]] = []


def configure(*, logger=None, emit_event=None, is_shutdown_requested=None,
              register_shutdown_handler=None, machine_id=None, lan_ip=None,
              core_node_root=None, app_data_dir=None):
    """Inject the host runtime's services. Called once by full pycore at startup;
    never called in standalone mode (stdlib defaults stay in effect)."""
    global _external_logger
    if logger is not None:
        _external_logger = logger
    for key, val in (("emit_event", emit_event),
                     ("is_shutdown_requested", is_shutdown_requested),
                     ("register_shutdown_handler", register_shutdown_handler),
                     ("machine_id", machine_id),
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
    return _local_shutdown.is_set()


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
    _local_shutdown.set()
    for entry in sorted(_local_shutdown_handlers, key=lambda e: -e.get("priority", 50)):
        try:
            entry["handler"]()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# identity + paths (stdlib; identical results to the pycore helpers)           #
# --------------------------------------------------------------------------- #
def _stdlib_machine_id() -> str:
    """Replicates pycore.pyutils.security.machine_id.get_machine_id() exactly so
    the self-entry id in the committed peers file is identical in both modes."""
    raw: Optional[str] = None
    try:
        if sys.platform == "win32":
            try:
                import winreg
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                                     r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ)
                guid, _ = winreg.QueryValueEx(key, "MachineGuid")
                winreg.CloseKey(key)
                raw = (guid or "").strip()
            except Exception:
                raw = None
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
    return hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()


def get_machine_id() -> str:
    fn = _hooks["machine_id"]
    if fn is not None:
        try:
            return fn()
        except Exception:
            pass
    return _stdlib_machine_id()


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
        cache = _ensure_dir(Path.home() / ".core_node")
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


# The committed peer list — the SHIPPED DEFAULT (baseline), read-only at runtime.
# Kept at its historical path so existing repo history / full-pycore reads are
# unchanged. Runtime edits never write here (see get_peers_override_file).
def get_peers_config_file() -> Path:
    return get_core_node_root() / "pycore" / "pyutils" / "codesync" / "code_sync_peers.json"


# Per-machine override for the peer list. Gitignored (<root>/.data/...), so every
# machine keeps its own role/peers/edits here WITHOUT touching the committed
# baseline. Loaded with priority over the baseline; this is the only file the
# runtime writes to.
def get_peers_override_file() -> Path:
    return get_core_node_root() / ".data" / "pycore" / "codesync" / "code_sync_peers.json"
