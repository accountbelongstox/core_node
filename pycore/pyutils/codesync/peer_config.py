# -*- coding: utf-8 -*-
"""
Code Sync peer configuration (committed in the code, NOT user data).

The peer list is the source of truth for the Code Sync mesh: which machines exist,
their address and their role (dev = distributes code, client = receives code). It
is the committed file:

    pycore/pyutils/codesync/code_sync_peers.json

Schema:
    { "version": <int>, "updated_at": <float>,
      "peers": [ {"id","name","host","port","role"} ] }

The file is replicated across machines over the mesh (see peer_mesh.py) using
last-writer-wins on (version, updated_at). It is EXCLUDED from the bulk code
file-sync so the two mechanisms don't fight. The per-session "distributing" flag
is NOT stored here (it must reset to off on every startup).

Stdlib only: identity / lan-ip / paths come from `.runtime` (no pycore import).
"""

import json
import os
import socket
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .runtime import (
    log as ColorPrint,
    get_machine_id,
    get_local_lan_ip,
    get_peers_config_file,
    get_peers_override_file,
)

# Two-tier storage:
#   BASELINE_FILE  — committed default (shipped in the repo, read-only at runtime).
#   OVERRIDE_FILE  — per-machine state under <root>/.data (gitignored). ALL runtime
#                    edits land here; it is loaded with priority over the baseline,
#                    so each machine keeps its own role/peers WITHOUT touching code.
BASELINE_FILE = get_peers_config_file()
OVERRIDE_FILE = get_peers_override_file()
PEERS_FILE_NAME = BASELINE_FILE.name  # same basename for both -> one sync-exclusion
DEFAULT_PORT = 59000
VALID_ROLES = ("dev", "client")


def _machine_id() -> str:
    return get_machine_id()


def _local_lan_ip() -> str:
    return get_local_lan_ip()


class PeerConfig:
    """Thread-safe, file-backed peer list with last-writer-wins replication."""

    def __init__(self, baseline_path: Path = BASELINE_FILE,
                 override_path: Path = OVERRIDE_FILE, port: int = DEFAULT_PORT):
        self._baseline_path = Path(baseline_path)   # committed default (read-only)
        self._override_path = Path(override_path)   # per-machine state (writable)
        self._port = port
        self._lock = threading.RLock()
        self._data: Optional[Dict[str, Any]] = None
        self.machine_id = _machine_id()

    # ----- load / save ----------------------------------------------------- #
    @staticmethod
    def _read_json(path: Path) -> Optional[Dict[str, Any]]:
        try:
            if path.exists():
                with path.open("r", encoding="utf-8") as fh:
                    loaded = json.load(fh)
                if isinstance(loaded, dict) and isinstance(loaded.get("peers"), list):
                    return loaded
        except Exception as exc:
            ColorPrint.yellow(f"[PeerConfig] Failed to read {path}: {exc}")
        return None

    def _ensure_loaded(self) -> Dict[str, Any]:
        if self._data is not None:
            return self._data
        with self._lock:
            if self._data is not None:
                return self._data
            # Priority: per-machine override (.data) wins; fall back to the committed
            # baseline as the shipped default; finally an empty config. The baseline
            # is only the SEED — the first edit writes to the override and from then
            # on the override is authoritative (so removals/renames/role stick and
            # the committed file is never churned).
            data = self._read_json(self._override_path)
            source = "override"
            if data is None:
                data = self._read_json(self._baseline_path)
                source = "baseline"
            if data is None:
                data = {"version": 0, "updated_at": 0.0, "peers": []}
                source = "default"
            self._data = data
            ColorPrint.blue(f"[PeerConfig] Loaded peer config from {source} "
                            f"({len(data.get('peers', []))} peers, v{data.get('version', 0)})")
            # Make sure this machine has an entry (defaults to client = receives).
            self._ensure_self_locked()
            return self._data

    def _save_locked(self) -> None:
        """Always persist to the per-machine OVERRIDE file (never the committed
        baseline), so edits stay out of the code tree."""
        try:
            self._override_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._override_path.with_suffix(self._override_path.suffix + ".tmp")
            with tmp.open("w", encoding="utf-8") as fh:
                json.dump(self._data, fh, ensure_ascii=False, indent=2, sort_keys=True)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(str(tmp), str(self._override_path))
        except Exception as exc:
            ColorPrint.red(f"[PeerConfig] Failed to save {self._override_path}: {exc}")

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
            # Match by id, or by host:port — but NEVER coalesce into our own self
            # entry (that would let "add peer" silently flip this machine's role).
            existing = self._find_locked(pid) or next(
                (p for p in self._data["peers"]
                 if p.get("id") != self.machine_id
                 and p.get("host") == host and int(p.get("port", 0)) == int(port)), None)
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
            # Preserve THIS machine's OWN role across replication. A machine's role
            # is locally owned; a remote config must never flip it. This is the root
            # cause of the "client shown as dev" propagation: a peer added elsewhere
            # with role=dev (an old UI default) replicated back over the mesh and
            # overwrote this node's self entry, persisting dev into its .data
            # override — so on restart it came up as a dev. (.data itself is never
            # git-tracked nor file-synced; only the peer LIST replicates via LWW.)
            local_self_role = None
            for p in d.get("peers", []):
                if p.get("id") == self.machine_id:
                    local_self_role = p.get("role")
                    break
            # If we have no local record of our own role (self pruned / fresh
            # .data), default to client — NEVER inherit a remote-claimed dev role.
            if local_self_role not in VALID_ROLES:
                local_self_role = "client"
            d["peers"] = [dict(p) for p in (peers or [])]
            d["version"] = int(version)
            d["updated_at"] = float(updated_at)
            # Keep our own entry present (we may have been pruned remotely).
            self._ensure_self_locked()
            # Re-assert our own role over whatever the remote claimed for us.
            corrected = False
            for p in d["peers"]:
                if p.get("id") == self.machine_id and p.get("role") != local_self_role:
                    p["role"] = local_self_role
                    corrected = True
                    break
            # If we actually overrode a remote-claimed role, become NEWER than the
            # incoming version so the correction propagates and wins via LWW —
            # otherwise other nodes keep our wrong role at the same version forever.
            if corrected:
                self._bump_locked()
            self._save_locked()
            ColorPrint.blue(f"[PeerConfig] Applied remote config v{version} "
                            f"({len(d['peers'])} peers"
                            f"{', self-role re-asserted' if corrected else ''})")
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
