# -*- coding: utf-8 -*-
"""
Code Sync peer configuration (committed in the code, NOT user data).

The peer list is the source of truth for the Code Sync mesh: which machines exist,
their address and their role (dev = distributes code, client = receives code). It
lives next to this module so it travels with the repository:

    pycore/pyutils/device_sync/code_sync_peers.json

Schema:
    { "version": <int>, "updated_at": <float>,
      "peers": [ {"id","name","host","port","role"} ] }

The file is replicated across machines over the mesh (see peer_mesh.py) using
last-writer-wins on (version, updated_at). It is EXCLUDED from the bulk code
file-sync so the two mechanisms don't fight. The per-session "distributing" flag
is NOT stored here (it must reset to off on every startup).
"""

import json
import os
import socket
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore import ColorPrint

CONFIG_FILE = Path(__file__).resolve().parent / "code_sync_peers.json"
PEERS_FILE_NAME = CONFIG_FILE.name
DEFAULT_PORT = 59000
VALID_ROLES = ("dev", "client")


def _machine_id() -> str:
    try:
        from pycore.pyutils.security.machine_id import get_machine_id
        return get_machine_id()
    except Exception:
        try:
            import uuid
            return f"{socket.gethostname()}_{uuid.getnode():x}"
        except Exception:
            return socket.gethostname() or "unknown"


def _local_lan_ip() -> str:
    try:
        from pycore.pyutils.rpc_v2.discovery.local_ip_detector import get_local_lan_ip
        ip = get_local_lan_ip()
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


class PeerConfig:
    """Thread-safe, file-backed peer list with last-writer-wins replication."""

    def __init__(self, path: Path = CONFIG_FILE, port: int = DEFAULT_PORT):
        self._path = Path(path)
        self._port = port
        self._lock = threading.RLock()
        self._data: Optional[Dict[str, Any]] = None
        self.machine_id = _machine_id()

    # ----- load / save ----------------------------------------------------- #
    def _ensure_loaded(self) -> Dict[str, Any]:
        if self._data is not None:
            return self._data
        with self._lock:
            if self._data is not None:
                return self._data
            data = {"version": 0, "updated_at": 0.0, "peers": []}
            try:
                if self._path.exists():
                    with self._path.open("r", encoding="utf-8") as fh:
                        loaded = json.load(fh)
                    if isinstance(loaded, dict) and isinstance(loaded.get("peers"), list):
                        data = loaded
            except Exception as exc:
                ColorPrint.yellow(f"[PeerConfig] Failed to read {self._path}: {exc}")
            self._data = data
            # Make sure this machine has an entry (defaults to client = receives).
            self._ensure_self_locked()
            return self._data

    def _save_locked(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_suffix(self._path.suffix + ".tmp")
            with tmp.open("w", encoding="utf-8") as fh:
                json.dump(self._data, fh, ensure_ascii=False, indent=2, sort_keys=True)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(str(tmp), str(self._path))
        except Exception as exc:
            ColorPrint.red(f"[PeerConfig] Failed to save {self._path}: {exc}")

    def _bump_locked(self) -> None:
        self._data["version"] = int(self._data.get("version", 0)) + 1
        self._data["updated_at"] = time.time()

    # ----- self entry ------------------------------------------------------ #
    def _ensure_self_locked(self) -> Dict[str, Any]:
        peers = self._data.setdefault("peers", [])
        for p in peers:
            if p.get("id") == self.machine_id:
                return p
        entry = {
            "id": self.machine_id,
            "name": socket.gethostname() or "this-device",
            "host": _local_lan_ip(),
            "port": self._port,
            "role": "client",  # safe default: receive code by default
        }
        peers.append(entry)
        self._bump_locked()
        self._save_locked()
        return entry

    def get_self(self) -> Dict[str, Any]:
        with self._lock:
            self._ensure_loaded()
            return dict(self._ensure_self_locked())

    def get_role(self) -> str:
        return self.get_self().get("role", "client")

    def set_role(self, role: str) -> str:
        role = role if role in VALID_ROLES else "client"
        with self._lock:
            self._ensure_loaded()
            me = self._ensure_self_locked()
            if me.get("role") != role:
                me["role"] = role
                self._bump_locked()
                self._save_locked()
            return role

    # ----- peer list ------------------------------------------------------- #
    def list_peers(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(p) for p in self._ensure_loaded().get("peers", [])]

    def dev_peers(self) -> List[Dict[str, Any]]:
        """Peers with role=dev, excluding self (clients pull from these)."""
        return [p for p in self.list_peers()
                if p.get("role") == "dev" and p.get("id") != self.machine_id]

    def _find_locked(self, peer_id: str) -> Optional[Dict[str, Any]]:
        for p in self._data.get("peers", []):
            if p.get("id") == peer_id:
                return p
        return None

    def add_peer(self, name: str, host: str, port: int = DEFAULT_PORT,
                 role: str = "client", peer_id: Optional[str] = None) -> Dict[str, Any]:
        role = role if role in VALID_ROLES else "client"
        pid = peer_id or f"{host}:{port}"
        with self._lock:
            self._ensure_loaded()
            existing = self._find_locked(pid) or next(
                (p for p in self._data["peers"]
                 if p.get("host") == host and int(p.get("port", 0)) == int(port)), None)
            if existing:
                existing.update({"name": name or existing.get("name"), "host": host,
                                 "port": int(port), "role": role})
                peer = existing
            else:
                peer = {"id": pid, "name": name or host, "host": host,
                        "port": int(port), "role": role}
                self._data["peers"].append(peer)
            self._bump_locked()
            self._save_locked()
            return dict(peer)

    def remove_peer(self, peer_id: str) -> bool:
        with self._lock:
            self._ensure_loaded()
            if peer_id == self.machine_id:
                return False  # never remove self
            before = len(self._data["peers"])
            self._data["peers"] = [p for p in self._data["peers"] if p.get("id") != peer_id]
            changed = len(self._data["peers"]) != before
            if changed:
                self._bump_locked()
                self._save_locked()
            return changed

    def update_peer(self, peer_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            self._ensure_loaded()
            peer = self._find_locked(peer_id)
            if not peer:
                return None
            for k in ("name", "host", "port", "role"):
                if k in fields and fields[k] is not None:
                    peer[k] = int(fields[k]) if k == "port" else fields[k]
            if peer.get("role") not in VALID_ROLES:
                peer["role"] = "client"
            self._bump_locked()
            self._save_locked()
            return dict(peer)

    # ----- replication (last-writer-wins) ---------------------------------- #
    def to_payload(self) -> Dict[str, Any]:
        with self._lock:
            d = self._ensure_loaded()
            return {"version": int(d.get("version", 0)),
                    "updated_at": float(d.get("updated_at", 0.0)),
                    "peers": [dict(p) for p in d.get("peers", [])]}

    def version(self) -> int:
        with self._lock:
            return int(self._ensure_loaded().get("version", 0))

    def apply_remote(self, peers: List[Dict[str, Any]], version: int,
                     updated_at: float) -> bool:
        """Adopt a remote config if it is newer (LWW on (version, updated_at))."""
        with self._lock:
            d = self._ensure_loaded()
            local = (int(d.get("version", 0)), float(d.get("updated_at", 0.0)))
            incoming = (int(version), float(updated_at))
            if incoming <= local:
                return False
            d["peers"] = [dict(p) for p in (peers or [])]
            d["version"] = int(version)
            d["updated_at"] = float(updated_at)
            # Keep our own entry present (we may have been pruned remotely).
            self._ensure_self_locked()
            self._save_locked()
            ColorPrint.blue(f"[PeerConfig] Applied remote config v{version} "
                            f"({len(d['peers'])} peers)")
            return True


# Global singleton
_peer_config: Optional[PeerConfig] = None
_pc_lock = threading.Lock()


def get_peer_config(port: int = DEFAULT_PORT) -> PeerConfig:
    global _peer_config
    if _peer_config is None:
        with _pc_lock:
            if _peer_config is None:
                _peer_config = PeerConfig(port=port)
    return _peer_config
