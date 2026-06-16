# -*- coding: utf-8 -*-
"""
Code Sync Manager - role-based peer mesh coordinator.

Each machine has a ROLE (from the committed peer config, peer_config.py):
  * client (default): RECEIVES code from dev-ends. Runs the file client on startup
    (always on) plus the status mesh. Pulls the newest version of each file across
    ALL configured dev-ends (per-file mtime).
  * dev: DISTRIBUTES code to clients. Runs the status mesh on startup, but actual
    file distribution is OFF by default every startup and must be enabled manually
    (set_distributing(True)) - so a dev machine never pushes code unintentionally.

Every machine runs the PeerMeshManager (peer_mesh.py): it probes all configured
peers on a tick, replicates peer-config edits across the mesh (last-writer-wins,
offline peers get the change when they return), and broadcasts status to the UI
(THREAD_BUS 'code_sync_update' when running inside pycore; no-op standalone).

Stdlib only: logging / events / shutdown / root path via `.runtime`.
"""

import os
import socket
import threading
import time
from typing import Any, Dict, List, Optional

from .runtime import (
    log as ColorPrint,
    emit_event,
    is_shutdown_requested,
    get_core_node_root,
)

from .server import CodeSyncServer, get_code_sync_server
from .client import CodeSyncClient, get_code_sync_client
from .peer_config import get_peer_config, _local_lan_ip
from .peer_mesh import PeerMeshManager

VALID_ROLES = ("dev", "client")
STATS_REFRESH_SECONDS = 60


class CodeSyncManager:
    """Role-based coordinator: dev distributes (manual), client receives (default)."""

    def __init__(self):
        self._lock = threading.RLock()
        self.config = get_peer_config()
        self.role: str = self.config.get_role()           # dev | client (default client)
        self.distributing: bool = False                   # dev only; never persisted
        # Client may TEMPORARILY reject incoming code updates ("skip update"); the
        # status mesh keeps running so peers still see this node and its skip state.
        self._skip_update: bool = False

        # Local code stats are computed in the background (never inside the
        # frequently-probed /peer/status request) so probes stay fast.
        self._stats: Dict[str, Any] = {"files": 0, "bytes": 0, "last_modified": 0.0}
        self._start_stats_refresher()

        # Status mesh runs for every role.
        self.mesh = PeerMeshManager(self.config, self.get_local_peer_status)
        self.mesh.start()

        # Apply the startup role (client receives by default; dev waits to distribute).
        self._apply_role(self.role)
        ColorPrint.green(f"[CodeSync Manager] Initialized role={self.role} "
                         f"(distributing={self.distributing})")

    # ----- role ------------------------------------------------------------ #
    def get_role(self) -> str:
        return self.role

    def set_role(self, role: str) -> str:
        role = role if role in VALID_ROLES else "client"
        with self._lock:
            self.role = self.config.set_role(role)
            # Switching to client clears any distribution state.
            if self.role != "dev":
                self.distributing = False
            self._apply_role(self.role)
        # Role changed -> let peers know and refresh the UI.
        self.mesh.broadcast_config()
        return self.role

    def _apply_role(self, role: str) -> None:
        """(Re)start the file services to match the role."""
        self._stop_services()
        if role == "client":
            if self._skip_update:
                ColorPrint.yellow("[CodeSync Manager] Client role but updates are "
                                  "skipped (temporarily rejecting code).")
            else:
                client = get_code_sync_client()
                client.start()
                self._sync_client_targets()
                ColorPrint.green("[CodeSync Manager] Receiving code (client role, default on)")
        else:  # dev
            # Mesh already runs; file distribution stays OFF until enabled.
            ColorPrint.green("[CodeSync Manager] Dev role - distribution OFF "
                             "(enable it in the UI to start pushing code)")

    # ----- distribution (dev only) ---------------------------------------- #
    def is_distributing(self) -> bool:
        return self.role == "dev" and self.distributing

    def set_distributing(self, enabled: bool) -> dict:
        with self._lock:
            if self.role != "dev":
                return {"success": False, "distributing": False,
                        "message": "Only a dev-end can distribute code."}
            server = get_code_sync_server()
            if enabled:
                server.start()
                self.distributing = True
                msg = "Code distribution started"
            else:
                server.stop()
                self.distributing = False
                msg = "Code distribution stopped"
            ColorPrint.green(f"[CodeSync Manager] {msg}")
        self._broadcast()
        return {"success": True, "distributing": self.distributing, "message": msg}

    # ----- skip update (client temporarily rejects code) ------------------ #
    def is_skip_update(self) -> bool:
        return self._skip_update

    def set_skip_update(self, enabled: bool) -> dict:
        with self._lock:
            self._skip_update = bool(enabled)
            # Pause/resume the file puller (only meaningful for a client). The
            # status mesh keeps running regardless, so peers still see this node.
            if self.role == "client":
                client = get_code_sync_client()
                if self._skip_update:
                    client.stop()
                    msg = "Updates skipped (temporarily rejecting code)"
                else:
                    client.start()
                    self._sync_client_targets()
                    msg = "Updates resumed (receiving code)"
            else:
                msg = "Skip-update flag set"
            ColorPrint.yellow(f"[CodeSync Manager] {msg}")
        self._broadcast()
        return {"success": True, "skip_update": self._skip_update, "message": msg}

    # ----- local code stats (background; non-blocking probes) ------------- #
    def _start_stats_refresher(self) -> None:
        t = threading.Thread(target=self._stats_loop, daemon=True, name="CodeSync-Stats")
        t.start()

    def _stats_loop(self) -> None:
        while True:
            try:
                self._stats = self._compute_code_stats()
            except Exception:
                pass
            for _ in range(STATS_REFRESH_SECONDS * 2):
                try:
                    if is_shutdown_requested():
                        return
                except Exception:
                    pass
                time.sleep(0.5)

    def _compute_code_stats(self) -> Dict[str, Any]:
        """Count files / total bytes / newest mtime of the synced tree (excluded
        dirs/extensions/files match the file-sync), so the UI can show how much
        code each end holds and when it last changed."""
        files = 0
        total = 0
        latest = 0.0
        ed = CodeSyncServer.EXCLUDED_DIRS
        ee = tuple(CodeSyncServer.EXCLUDED_EXTENSIONS)  # str.endswith accepts a tuple
        ef = getattr(CodeSyncServer, "EXCLUDED_FILES", set())
        # Iterative os.scandir walk: DirEntry.stat() reuses the directory listing's
        # metadata on Windows, avoiding a separate stat() syscall per file.
        stack = [str(get_core_node_root())]
        while stack:
            d = stack.pop()
            try:
                with os.scandir(d) as it:
                    for e in it:
                        try:
                            if e.is_dir(follow_symlinks=False):
                                if e.name not in ed:
                                    stack.append(e.path)
                            else:
                                if e.name in ef or e.name.endswith(ee):
                                    continue
                                st = e.stat(follow_symlinks=False)
                                files += 1
                                total += st.st_size
                                if st.st_mtime > latest:
                                    latest = st.st_mtime
                        except OSError:
                            continue
            except OSError:
                continue
        return {"files": files, "bytes": total, "last_modified": latest}

    def local_code_stats(self) -> Dict[str, Any]:
        return dict(self._stats)

    # ----- client wiring --------------------------------------------------- #
    def _sync_client_targets(self) -> None:
        """Point the client at the configured dev-end peers (plus LAN discovery)."""
        if self.role != "client":
            return
        client = get_code_sync_client()
        for peer in self.config.dev_peers():
            try:
                client.add_server(peer.get("host"), int(peer.get("port", 59000)))
            except Exception as exc:
                ColorPrint.yellow(f"[CodeSync Manager] add_server failed: {exc}")

    def _stop_services(self) -> None:
        for getter in (get_code_sync_server, get_code_sync_client):
            try:
                getter().stop()
            except Exception:
                pass

    # ----- peers (config CRUD; replicated via mesh) ----------------------- #
    def add_peer(self, name: str, host: str, port: int = 59000, role: str = "client") -> dict:
        self.config.add_peer(name, host, port, role)
        self._sync_client_targets()
        self.mesh.broadcast_config()
        return self.get_peers()

    def remove_peer(self, peer_id: str) -> dict:
        self.config.remove_peer(peer_id)
        self.mesh.broadcast_config()
        return self.get_peers()

    def update_peer(self, peer_id: str, fields: Dict[str, Any]) -> dict:
        self.config.update_peer(peer_id, fields)
        self._sync_client_targets()
        self.mesh.broadcast_config()
        return self.get_peers()

    def apply_remote_config(self, peers: List[Dict[str, Any]], version: int,
                            updated_at: float) -> dict:
        applied = self.config.apply_remote(peers, version, updated_at)
        if applied:
            self._sync_client_targets()
            self._broadcast()
        return {"success": True, "applied": applied, "version": self.config.version()}

    def discover(self) -> dict:
        candidates = self.mesh.discover()
        return {"success": True, "candidates": candidates}

    # ----- status ---------------------------------------------------------- #
    def get_local_peer_status(self) -> dict:
        """Lightweight self status served at /code-sync/peer/status (probed often)."""
        me = self.config.get_self()
        summary: Dict[str, Any] = {
            "role": self.role,
            "distributing": self.is_distributing(),
            "skip_update": self._skip_update,
            "code": self.local_code_stats(),
        }
        try:
            if self.role == "dev" and self.distributing:
                summary["clients"] = len(get_code_sync_server().clients)
            elif self.role == "client":
                client = get_code_sync_client()
                summary["servers"] = len(client.servers)
        except Exception:
            pass
        return {
            "id": self.config.machine_id,
            "name": me.get("name") or socket.gethostname(),
            "role": self.role,
            "hostname": socket.gethostname(),
            "lan_ip": _local_lan_ip(),
            "distributing": self.is_distributing(),
            "skip_update": self._skip_update,
            "config_version": self.config.version(),
            "code": self.local_code_stats(),
            "summary": summary,
        }

    def get_peers(self) -> dict:
        snap = self.mesh.snapshot()
        return {"success": True, "self": self.get_local_peer_status(),
                "peers": snap.get("peers", []), "version": self.config.version()}

    def get_status(self) -> dict:
        status: Dict[str, Any] = {
            "role": self.role,
            "distributing": self.is_distributing(),
            "skip_update": self._skip_update,
            "code": self.local_code_stats(),
            "version": self.config.version(),
            "self": self.get_local_peer_status(),
            "peers": self.mesh.snapshot().get("peers", []),
        }
        try:
            if self.role == "dev" and self.distributing:
                status["server"] = get_code_sync_server().get_status()
            elif self.role == "client":
                status["client"] = get_code_sync_client().get_status()
        except Exception:
            pass
        return status

    def _broadcast(self) -> None:
        try:
            emit_event("code_sync_update", self.mesh.snapshot())
        except Exception:
            pass

    # ----- back-compat shims (used by existing transfer endpoints) -------- #
    # The file-transfer endpoints (register/initial-sync/changes/download) gate on
    # is_server_mode()/get_server(); map those to "dev AND distributing" so a dev
    # only serves files when distribution is enabled.
    def is_server_mode(self) -> bool:
        return self.is_distributing()

    def is_client_mode(self) -> bool:
        return self.role == "client"

    def get_mode(self) -> str:
        return self.role

    def get_server(self) -> Optional[CodeSyncServer]:
        return get_code_sync_server() if self.is_distributing() else None

    def get_client(self) -> Optional[CodeSyncClient]:
        return get_code_sync_client() if self.role == "client" else None

    def set_server_mode(self):
        self.set_role("dev")

    def set_client_mode(self):
        self.set_role("client")

    def stop(self):
        self.set_distributing(False)


# Global singleton
_code_sync_manager: Optional[CodeSyncManager] = None
_manager_lock = threading.Lock()


def get_code_sync_manager() -> CodeSyncManager:
    global _code_sync_manager
    if _code_sync_manager is None:
        with _manager_lock:
            if _code_sync_manager is None:
                _code_sync_manager = CodeSyncManager()
    return _code_sync_manager


# Preferred public alias.
get_manager = get_code_sync_manager
