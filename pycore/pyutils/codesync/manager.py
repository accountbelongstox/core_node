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
from pathlib import Path
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
from .sync_ws import PushSender, PushReceiver

VALID_ROLES = ("dev", "client")
STATS_REFRESH_SECONDS = 60
SYNC_LOG_MAX = 300


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

        # Status mesh runs for every role. The mesh also sends our heartbeat to
        # dev/hub peers and adopts any newer config returned on the response.
        self.mesh = PeerMeshManager(self.config, self.get_local_peer_status,
                                    apply_remote_config_fn=self._apply_remote_from_heartbeat)
        self.mesh.start()

        # WS push channel (dev dials clients out; clients accept). The receiver is
        # used by the WS server endpoint; the sender supervisor only acts while
        # this node is a distributing dev.
        self._sync_phase = {"phase": "idle", "count": 0}
        self._sync_logs = []  # ring of recent push/receive events (newest last)
        self._sync_lock = threading.Lock()
        self.push_receiver = PushReceiver(self)
        self.push_sender = PushSender(self)
        self.push_sender.start()

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
        """Count files / total bytes / newest mtime of the synced tree, applying the
        SAME live filter settings as the file-sync (excluded dirs/files/extensions/
        path-substrings + optional .gitignore), so the UI's code stats reflect what
        would actually be distributed."""
        from .sync_settings import build_excluder
        files = 0
        total = 0
        latest = 0.0
        root = get_core_node_root()
        excluder = build_excluder(root)
        # Iterative os.scandir walk: DirEntry.stat() reuses the directory listing's
        # metadata on Windows, avoiding a separate stat() syscall per file.
        stack = [str(root)]
        while stack:
            d = stack.pop()
            try:
                with os.scandir(d) as it:
                    for e in it:
                        try:
                            if e.is_dir(follow_symlinks=False):
                                if not excluder.dir_excluded(e.name, e.path):
                                    stack.append(e.path)
                            else:
                                if excluder.file_excluded(e.name, e.path):
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

    def _apply_remote_from_heartbeat(self, peers: List[Dict[str, Any]],
                                     version: int, updated_at: float) -> None:
        """Adopt the dev's peer-config carried back on a heartbeat response."""
        try:
            self.apply_remote_config(peers, version, updated_at)
        except Exception:
            pass

    def receive_heartbeat(self, payload: Dict[str, Any],
                          source: Optional[str] = None) -> dict:
        """Record an inbound heartbeat from a peer and return our current config so
        the sender (which may be unreachable for a push) converges via LWW."""
        self.mesh.record_heartbeat(payload, source)
        return {"success": True, "config": self.config.to_payload()}

    # ----- filter settings (presets + per-machine .data override) --------- #
    def get_sync_settings(self) -> dict:
        from .sync_settings import get_sync_settings
        data = get_sync_settings().get_with_source()
        return {"success": True, **data}

    def set_sync_settings(self, patch: Dict[str, Any]) -> dict:
        from .sync_settings import get_sync_settings
        settings = get_sync_settings().update(patch or {})
        # Recompute local code stats immediately so the UI reflects the new filters,
        # and let the file server rescan on its next tick.
        try:
            self._stats = self._compute_code_stats()
        except Exception:
            pass
        self._broadcast()
        return {"success": True, "settings": settings}

    def reset_sync_settings(self) -> dict:
        from .sync_settings import get_sync_settings
        settings = get_sync_settings().reset()
        try:
            self._stats = self._compute_code_stats()
        except Exception:
            pass
        self._broadcast()
        return {"success": True, "settings": settings}

    # ----- WS push: phase + sync-log ring (shared by sender & receiver) ---- #
    def sync_target_root(self) -> Path:
        """Where a CLIENT writes pushed files (mapped under this root by dest_rel)."""
        return get_core_node_root()

    def watch_dirs(self) -> List[str]:
        """The dev's effective watch dirs (configured list, or [root] if empty)."""
        try:
            from .watcher import get_watch_manager
            return get_watch_manager().watch_dirs_str()
        except Exception:
            return [str(get_core_node_root())]

    def set_sync_phase(self, phase: str, count: int = 0) -> None:
        with self._sync_lock:
            self._sync_phase = {"phase": phase, "count": int(count)}
        try:
            emit_event("code_sync_update", self.mesh.snapshot())
        except Exception:
            pass

    def get_sync_phase(self) -> Dict[str, Any]:
        with self._sync_lock:
            return dict(self._sync_phase)

    def log_sync(self, action: str, file_path: str, reason: str = "") -> None:
        entry = {"action": action, "file_path": file_path, "reason": reason,
                 "timestamp": time.time()}
        with self._sync_lock:
            self._sync_logs.append(entry)
            if len(self._sync_logs) > SYNC_LOG_MAX:
                self._sync_logs = self._sync_logs[-SYNC_LOG_MAX:]
        try:
            emit_event("code_sync_log", entry)
        except Exception:
            pass

    def get_sync_logs(self, limit: int = 100) -> dict:
        """Recent push/receive activity for the UI's log panel — the WS-push ring
        (dev 'sent' + client 'received'/'skipped'/'error'), newest last."""
        with self._sync_lock:
            logs = list(self._sync_logs)
        return {"success": True, "role": self.role, "phase": self.get_sync_phase(),
                "logs": logs[-int(limit or 100):]}

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
            "watch_root": str(self.sync_target_root()),
            "watch_dirs": self.watch_dirs(),
            "sync_phase": self.get_sync_phase(),
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
