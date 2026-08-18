# -*- coding: utf-8 -*-
"""
Code Sync Manager - role-based peer mesh coordinator.

Each machine has a ROLE (from the committed peer config, peer_config.py):
  * client (default): RECEIVES code from dev-ends over persistent HTTP SSE streams.
  * dev: DISTRIBUTES code to clients. Runs the status mesh on startup; file
    distribution defaults OFF but is restored from unified user settings when the
    tray/UI last enabled it (set_distributing(True) persists per machine).

Every machine runs the PeerMeshManager (peer_mesh.py): it probes all configured
peers on a tick, replicates peer-config edits across the mesh (last-writer-wins,
offline peers get the change when they return), and broadcasts status to the UI
(THREAD_BUS 'code_sync_update' when running inside pycore; no-op standalone).

Stdlib only: logging / events / shutdown / root path via `.runtime`.
"""

import os
import socket
import time
import uuid
from contextlib import nullcontext
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.network_constants import PYCORE_HTTP_PORT
from pycore.pyfoundations.thread_bus_constants import BusSignals

import pycore.pyutils.codesync.routes as routes
from pycore.pyutils.codesync.runtime import (
    log as ColorPrint,
    http as requests,
    emit_event,
    is_shutdown_requested,
    is_light,
    get_core_node_root,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)

from pycore.pyutils.codesync.server import CodeSyncServer, get_code_sync_server
from pycore.pyutils.codesync.client import CodeSyncClient, get_code_sync_client
from pycore.pyutils.codesync.peer_config import get_peer_config, _local_lan_ip
from pycore.pyutils.codesync.peer_mesh import PeerMeshManager
from pycore.pyutils.codesync.runtime_prefs import get_runtime_prefs
from pycore.pyutils.codesync.push_receiver import PushReceiver
from pycore.pyutils.codesync.push_sender import PushSender
from pycore.pyutils.codesync.sse_receiver import SseReceiver
from pycore.pyutils.codesync.sse_transport import code_sync_transport_status

from pycore.pyutils.codesync.sync_settings import build_excluder
from pycore.pyutils.codesync.sync_settings import get_sync_settings
import os as _os
from pycore.pyutils.codesync.watcher import get_watch_manager


VALID_ROLES = ("dev", "client")
STATS_REFRESH_SECONDS = 60
SYNC_LOG_MAX = 300
# A light client keeps only a tiny sync-log ring (it barely logs sync activity).
LIGHT_SYNC_LOG_MAX = 50


class CodeSyncManager:
    """Role-based coordinator: dev distributes (manual), client receives (default)."""

    def __init__(self):
        self._state_scope = nullcontext()
        self._sync_scope = nullcontext()
        init_serialized_owner(self, "codesync.manager.state", "CodeSyncManagerState")
        self.config = get_peer_config()
        self.role: str = self.config.get_role()           # dev | client (default client)
        self.distributing: bool = False                   # dev only; restored from runtime_prefs
        # Client may TEMPORARILY reject incoming code updates ("skip update"); the
        # status mesh keeps running so peers still see this node and its skip state.
        self._skip_update: bool = False

        # Light mode: a CLIENT that only tracks the mesh (peer status/heartbeats)
        # and never receives/serves files or scans the tree. Light is IGNORED on a
        # dev node (a dev's whole job is to distribute), warned once below.
        self.light: bool = bool(is_light())
        light_client = self.light and self.role == "client"
        if self.light and self.role == "dev":
            ColorPrint.yellow("[CodeSync] light mode ignored on a dev node")

        # Sync-log ring size: tiny for a light client, full otherwise.
        self._sync_log_max = LIGHT_SYNC_LOG_MAX if light_client else SYNC_LOG_MAX

        # Local code stats are computed in the background (never inside the
        # frequently-probed /peer/status request) so probes stay fast. A light
        # client never scans the tree: it serves static zeroed stats and skips the
        # background refresher entirely.
        if light_client:
            self._stats: Dict[str, Any] = {"files": 0, "bytes": 0,
                                           "last_modified": 0.0, "light": True}
        else:
            self._stats = {"files": 0, "bytes": 0, "last_modified": 0.0}

        # Status mesh runs for every role. The mesh also sends our heartbeat to
        # dev/hub peers and adopts any newer config returned on the response.
        self.mesh = PeerMeshManager(self.config, self.get_local_peer_status,
                                    apply_remote_config_fn=self._apply_remote_from_heartbeat,
                                    light=light_client)
        self.mesh.start()

        # SSE push channel: clients hold a stream to each configured dev. The
        # sender supervisor only acts while this node is a distributing dev.
        # Per-CHANNEL sync phase: each remote end (the OTHER end's id) gets its own
        # row so concurrent peers no longer stomp a single global phase. A legacy
        # caller that passes no channel lands in the "_local" channel.
        self._peer_phases: Dict[str, Dict[str, Any]] = {}
        self._sync_logs = []  # ring of recent push/receive events (newest last)
        self._sync_log_epoch = uuid.uuid4().hex
        self._sync_log_revision = 0
        # Construct both the receiver and the sender (so the HTTP endpoint and the
        # back-compat surface keep working), but a light client never STARTS the
        # sender supervisor — it neither pushes nor receives code.
        self.push_receiver = PushReceiver(self)
        self.push_sender = PushSender(self)
        self.sse_receiver = SseReceiver(self)
        if not light_client:
            self.push_sender.start()

        # Apply the startup role (client receives by default; dev waits to distribute).
        self._apply_role(self.role)
        self._restore_runtime_prefs()
        if not light_client:
            self._start_stats_refresher()
        ColorPrint.green(f"[CodeSync Manager] Initialized role={self.role} "
                         f"(distributing={self.distributing}, light={self.light})")

    # ----- role ------------------------------------------------------------ #
    @serialized_method
    def get_role(self) -> str:
        return self.role

    def set_role(self, role: str) -> dict:
        """Switch role; mesh/UI work runs AFTER the manager state write."""
        applied = self._set_role_state(role)
        try:
            self._store_stats(self._compute_code_stats())
        except Exception:
            pass
        # Role changed -> let peers know and push a full self+peers snapshot to the UI.
        # Must not run on the manager state worker (snapshot -> get_local_peer_status
        # would AB-BA with this queue).
        self.mesh.broadcast_config()
        out = self.get_peers()
        out["role"] = applied
        return out

    @serialized_method
    def _set_role_state(self, role: str) -> str:
        role = role if role in VALID_ROLES else "client"
        with self._state_scope:
            self.role = self.config.set_role(role)
            # Switching to client clears any distribution state.
            if self.role != "dev":
                self.distributing = False
                self._persist_runtime_prefs()
            # Keep self LAN IP fresh and drop duplicate self rows after a switch.
            try:
                self.config.update_peer(self.config.machine_id, {"host": _local_lan_ip()})
            except Exception:
                pass
            self.config.prune_self_duplicates()
            self._apply_role(self.role)
            with self._sync_scope:
                self._peer_phases.clear()
        return self.role

    def _apply_role(self, role: str) -> None:
        """(Re)start the file services to match the role."""
        self._stop_services()
        if role == "client":
            if not self.light:
                self.sse_receiver.start()
            if self._skip_update:
                ColorPrint.yellow("[CodeSync Manager] Client role; updates are SKIPPED "
                                  "(SSE receiver will reject pushed code).")
            else:
                ColorPrint.green("[CodeSync Manager] Client role: receiving via SSE")
        else:  # dev
            # Mesh already runs; file distribution stays OFF until enabled.
            ColorPrint.green("[CodeSync Manager] Dev role - distribution OFF "
                             "(enable it in the UI to start pushing code)")

    # ----- runtime prefs (distributing / skip_update survive restart) ------- #
    def _persist_runtime_prefs(self) -> None:
        get_runtime_prefs().update({
            "distributing": self.distributing,
            "skip_update": self._skip_update,
        })

    def _restore_runtime_prefs(self) -> None:
        """Re-apply the last saved tray/UI toggles after a process restart."""
        prefs = get_runtime_prefs().get()
        if prefs.get("skip_update"):
            self.set_skip_update(True)
        if self.role == "dev" and prefs.get("distributing"):
            self.set_distributing(True)

    # ----- distribution (dev only) ---------------------------------------- #
    @serialized_method
    def is_distributing(self) -> bool:
        return self.role == "dev" and self.distributing

    def set_distributing(self, enabled: bool) -> dict:
        out = self._set_distributing_state(enabled)
        if out.get("success"):
            self._persist_runtime_prefs()
            self._broadcast()
        return out

    @serialized_method
    def _set_distributing_state(self, enabled: bool) -> dict:
        with self._state_scope:
            if self.role != "dev":
                return {"success": False, "distributing": False,
                        "message": "Only a dev-end can distribute code."}
            server = get_code_sync_server()
            if enabled:
                get_watch_manager().start()
                server.start()
                self.distributing = True
                msg = "Code distribution started"
            else:
                server.stop()
                self.distributing = False
                msg = "Code distribution stopped"
            ColorPrint.green(f"[CodeSync Manager] {msg}")
        return {"success": True, "distributing": self.distributing, "message": msg}

    # ----- skip update (client temporarily rejects code) ------------------ #
    @serialized_method
    def is_skip_update(self) -> bool:
        return self._skip_update

    def set_skip_update(self, enabled: bool) -> dict:
        out = self._set_skip_update_state(enabled)
        self._persist_runtime_prefs()
        self._broadcast()
        return out

    @serialized_method
    def _set_skip_update_state(self, enabled: bool) -> dict:
        with self._state_scope:
            self._skip_update = bool(enabled)
            # Enforced at the HTTP receiver (PushReceiver checks is_skip_update and
            # drops pushed manifests/files) — there is no outbound puller to stop.
            # The status mesh keeps running so peers still see this node.
            msg = ("Updates skipped (rejecting pushed code)" if self._skip_update
                   else "Updates resumed (receiving pushed code)")
            ColorPrint.yellow(f"[CodeSync Manager] {msg}")
        return {"success": True, "skip_update": self._skip_update, "message": msg}

    # ----- local code stats (background; non-blocking probes) ------------- #
    def _start_stats_refresher(self) -> None:
        start_bus_task(self._stats_loop, thread_name="CodeSync-Stats")

    def _stats_loop(self) -> None:
        while True:
            try:
                self._store_stats(self._compute_code_stats())
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
        watcher = get_watch_manager()
        if watcher.running() and watcher.wait_ready(timeout=120.0):
            return watcher.code_stats()
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

    @serialized_method
    def _store_stats(self, stats: Dict[str, Any]) -> None:
        self._stats = dict(stats)

    @serialized_method
    def local_code_stats(self) -> Dict[str, Any]:
        return dict(self._stats)

    # ----- client wiring --------------------------------------------------- #
    def _sync_client_targets(self) -> None:
        """Keep the legacy hook; inbound CLIENT routes require no target list."""
        return

    def _stop_services(self) -> None:
        receiver = getattr(self, "sse_receiver", None)
        if receiver is not None:
            receiver.stop()
        for getter in (get_code_sync_server, get_code_sync_client):
            try:
                getter().stop()
            except Exception:
                pass

    # ----- peers (config CRUD; replicated via mesh) ----------------------- #
    def add_peer(
        self,
        name: str,
        host: str,
        port: int = PYCORE_HTTP_PORT,
        role: str = "client",
    ) -> dict:
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
            # Keep the cached self.role consistent with the config after a
            # mesh-driven change (apply_remote preserves our own role, so this is
            # normally a no-op, but it guards the self-not-present edge and any
            # future config mutation from leaving manager.role stale).
            cfg_role = self.config.get_role()
            if cfg_role != self.role:
                self.role = cfg_role
                if self.role != "dev":
                    self.distributing = False
                    self._persist_runtime_prefs()
                self._apply_role(self.role)
            # If apply_remote had to OVERRIDE a remote-claimed self role, it bumped
            # our version above the incoming one — re-broadcast so the correction
            # propagates and wins via LWW (otherwise other nodes keep the bad role).
            if self.config.version() > int(version):
                self.mesh.broadcast_config()
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
        data = get_sync_settings().get_with_source()
        return {"success": True, **data}

    def set_sync_settings(self, patch: Dict[str, Any]) -> dict:
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
        settings = get_sync_settings().reset()
        try:
            self._stats = self._compute_code_stats()
        except Exception:
            pass
        self._broadcast()
        return {"success": True, "settings": settings}

    # ----- SSE push: phase + sync-log ring (shared by sender & receiver) --- #
    def sync_target_root(self) -> Path:
        """Where a CLIENT writes pushed files (mapped under this root by dest_rel)."""
        return get_core_node_root()

    def watch_dirs(self) -> List[str]:
        """The dev's effective watch dirs (configured list, or [root] if empty)."""
        try:
            return get_watch_manager().watch_dirs_str()
        except Exception:
            return [str(get_core_node_root())]

    # Phase priority for the aggregate badge (higher value wins).
    _PHASE_PRIORITY = {
        "scanning": 3,
        "pushing": 3,
        "receiving": 3,
        "retrying": 2,
        "idle": 0,
    }
    _PHASE_IDLE_TTL = 60.0  # seconds an idle channel row lingers before pruning

    def set_sync_phase(self, phase: str, count: int = 0, channel: Optional[str] = None,
                       name: str = "", direction: str = "") -> None:
        """Record the phase of ONE channel (the other end's id this phase is about).

        `channel` is the target client_id on the dev side, or the source dev_id on
        the client side. None/"" means the legacy global "_local" channel. Setting
        phase "idle" marks the channel idle (the row is kept until it is pruned by
        TTL), so a finished transfer no longer wipes a sibling channel's phase.

        UI broadcast runs AFTER the manager state write so mesh.snapshot() never
        waits on this queue while we wait on the mesh queue."""
        self._set_sync_phase_state(phase, count, channel, name, direction)
        try:
            emit_event(BusSignals.CODE_SYNC_UPDATE, self.mesh.snapshot())
        except Exception:
            pass

    @serialized_method
    def _set_sync_phase_state(self, phase: str, count: int = 0,
                              channel: Optional[str] = None,
                              name: str = "", direction: str = "") -> None:
        ch = channel or "_local"
        now = time.time()
        with self._sync_scope:
            self._peer_phases[ch] = {
                "phase": phase, "count": int(count), "name": name or "",
                "direction": direction or "", "ts": now,
            }
            # Prune idle rows that have been idle for longer than the TTL.
            stale = [c for c, row in self._peer_phases.items()
                     if row.get("phase") == "idle" and (now - row.get("ts", 0)) > self._PHASE_IDLE_TTL]
            for c in stale:
                self._peer_phases.pop(c, None)

    @serialized_method
    def get_sync_phase(self) -> Dict[str, Any]:
        """Aggregate per-channel phases into the single-badge shape the UI expects
        plus the full per-channel breakdown.

        Aggregate phase = the phase of the first non-idle channel by priority
        (pushing/receiving > retrying); "idle" if every channel is idle. Aggregate
        count = sum of counts over the non-idle channels (0 if none)."""
        now = time.time()
        with self._sync_scope:
            # Prune here too (not only on write): a channel that goes idle and never
            # sees another phase event would otherwise linger forever and the UI
            # would show a phantom idle pill for a long-gone peer.
            stale = [c for c, row in self._peer_phases.items()
                     if row.get("phase") == "idle" and (now - row.get("ts", 0)) > self._PHASE_IDLE_TTL]
            for c in stale:
                self._peer_phases.pop(c, None)
            channels = {c: dict(row) for c, row in self._peer_phases.items()}
        active = [row for row in channels.values() if row.get("phase") != "idle"]
        if active:
            active.sort(key=lambda r: self._PHASE_PRIORITY.get(r.get("phase"), 0),
                        reverse=True)
            agg_phase = active[0].get("phase")
            agg_count = sum(int(r.get("count", 0)) for r in active)
        else:
            agg_phase = "idle"
            agg_count = 0
        return {"phase": agg_phase, "count": agg_count, "channels": channels}

    @serialized_method
    def log_sync(self, action: str, file_path: str, reason: str = "",
                 details: str = "", size: int = 0, diff: int = 0,
                 peer: str = "", direction: str = "") -> None:
        """Append one structured sync-log entry.

        Back-compat: existing 3-positional callers (action, file_path, reason)
        keep working; the optional `details`/`size`/`diff` add a human-readable
        size string and signed byte delta for the richer UI log panel, and
        `peer`/`direction` attribute each entry to the other end and the flow
        ("push" on the dev side, "receive" on the client side)."""
        with self._sync_scope:
            self._sync_log_revision += 1
            revision = f"{self._sync_log_epoch}:{self._sync_log_revision}"
            entry = {"id": revision, "revision": revision,
                     "action": action, "file_path": file_path, "reason": reason,
                     "details": details, "size": int(size), "diff": int(diff),
                     "peer": peer or "", "direction": direction or "",
                     "timestamp": time.time()}
            self._sync_logs.append(entry)
            if len(self._sync_logs) > self._sync_log_max:
                self._sync_logs = self._sync_logs[-self._sync_log_max:]
        try:
            emit_event("code_sync_log", entry)
        except Exception:
            pass

    @serialized_method
    def get_sync_logs(
        self,
        limit: int = 100,
        page: int = 1,
        since_revision: str = "",
    ) -> dict:
        """Return one DIFF log page, newest page first and rows oldest first."""
        with self._sync_scope:
            revision = f"{self._sync_log_epoch}:{self._sync_log_revision}"
            if since_revision and since_revision == revision:
                return {"success": True, "revision": revision, "unchanged": True}
            logs = list(self._sync_logs)
        page_size = max(1, min(int(limit or 100), 100))
        total = len(logs)
        page_count = max(1, -(-total // page_size))
        normalized_page = max(1, min(int(page or 1), page_count))
        end = max(0, total - ((normalized_page - 1) * page_size))
        start = max(0, end - page_size)
        return {"success": True, "role": self.role, "phase": self.get_sync_phase(),
                "revision": revision, "page": normalized_page,
                "page_size": page_size, "total": total,
                "logs": logs[start:end]}

    def get_ui_runtime(
        self,
        page: int = 1,
        page_size: int = 100,
        since_revision: str = "",
    ) -> dict:
        """One UI bootstrap exchange for mesh, settings, and one log ID page."""
        return {
            "success": True,
            "data": {
                "mesh": self.get_peers(),
                "settings": self.get_sync_settings(),
                "log_page": self.get_sync_logs(page_size, page, since_revision),
            },
        }

    def discover(self) -> dict:
        # A client is passive: it never scans the network. LAN discovery is a
        # dev-side helper for finding clients to add.
        if self.role == "client":
            return {"success": True, "candidates": [],
                    "message": "Discovery disabled on a client (passive node)."}
        if not get_sync_settings().get().get("scan_lan"):
            return {"success": True, "candidates": [],
                    "message": "LAN scanning disabled (enable the toggle first)."}
        self.config.prune_self_duplicates()
        candidates = self.mesh.discover()
        return {"success": True, "candidates": candidates}

    # ----- status ---------------------------------------------------------- #
    def _get_pending_updates_for_status(self) -> Dict[str, Any]:
        receiver = getattr(self, "push_receiver", None)
        if not receiver:
            return {"count": 0, "files": []}
        try:
            pending = receiver.get_pending_updates()
            if isinstance(pending, dict):
                return pending
        except Exception:
            pass
        return {"count": 0, "files": []}

    def get_local_peer_status(self) -> dict:
        """Lightweight self status served at /code-sync/peer/status (probed often)."""
        me = self.config.get_self()
        hostname = socket.gethostname()
        distributing = self.is_distributing()
        code_stats = self.local_code_stats()
        watcher_metrics = {}
        summary: Dict[str, Any] = {
            "role": self.role,
            "distributing": distributing,
            "skip_update": self._skip_update,
            "light": self.light,
            "code": code_stats,
        }
        pending_updates = {"count": 0, "files": []}
        try:
            if self.role == "dev" and distributing:
                summary["clients"] = int(
                    self.push_sender.get_status().get("connected_clients", 0)
                )
            elif self.role == "client":
                summary["servers"] = int(
                    self.sse_receiver.get_status().get("connected_sessions", 0)
                )
                pending_updates = self._get_pending_updates_for_status()
                summary["pending_updates"] = pending_updates.get("count", 0)
        except Exception:
            pass
        if not (self.light and self.role == "client"):
            watcher_metrics = get_watch_manager().get_metrics()
        return {
            "id": self.config.machine_id,
            "name": me.get("name") or hostname,
            "role": self.role,
            "hostname": hostname,
            "lan_ip": _local_lan_ip(),
            "distributing": distributing,
            "skip_update": self._skip_update,
            "light": self.light,
            "config_version": self.config.version(),
            "code": code_stats,
            "watch_root": str(self.sync_target_root()),
            "watch_dirs": self.watch_dirs(),
            "sync_phase": self.get_sync_phase(),
            "summary": summary,
            "transport": code_sync_transport_status(),
            "watcher": watcher_metrics,
            "pending_updates": pending_updates,
        }

    def _peer_status_rows(self) -> list:
        snap = self.mesh.snapshot()
        peers = [dict(peer) for peer in snap.get("peers", [])]
        connected = set()
        if self.role == "dev" and self.distributing:
            connected.update(self.push_sender.get_status().get("clients", []))
        for peer in peers:
            peer["transport_connected"] = peer.get("id") in connected
        return peers

    def get_peers(self) -> dict:
        return {"success": True, "self": self.get_local_peer_status(),
                "peers": self._peer_status_rows(), "version": self.config.version()}

    def get_status(self) -> dict:
        self_status = self.get_local_peer_status()
        status: Dict[str, Any] = {
            "role": self.role,
            "distributing": self.is_distributing(),
            "skip_update": self._skip_update,
            "light": self.light,
            "code": self.local_code_stats(),
            "version": self.config.version(),
            "self": self_status,
            "peers": self._peer_status_rows(),
            "pending_updates": self_status.get("pending_updates", {"count": 0, "files": []}),
        }
        if not (self.light and self.role == "client"):
            status["watcher"] = get_watch_manager().get_metrics()
        try:
            if self.role == "dev" and self.distributing:
                status["server"] = self.push_sender.get_status()
            elif self.role == "client":
                status["client"] = self.sse_receiver.get_status()
        except Exception:
            pass
        return status

    # ----- pending updates (manual action hooks) -------------------------- #
    def apply_pending_update(self, rel: str) -> dict:
        if self.role != "client":
            return {"success": False, "error": "Pending updates can only be managed on client mode"}
        if self.light:
            return {"success": False, "error": "Pending updates are not available in light mode"}
        receiver = getattr(self, "push_receiver", None)
        if receiver is None:
            return {"success": False, "error": "Pending update receiver is not available"}
        return receiver.apply_pending_update(rel)

    def clear_pending_update(self, rel: str) -> dict:
        if self.role != "client":
            return {"success": False, "error": "Pending updates can only be managed on client mode"}
        if self.light:
            return {"success": False, "error": "Pending updates are not available in light mode"}
        receiver = getattr(self, "push_receiver", None)
        if receiver is None:
            return {"success": False, "error": "Pending update receiver is not available"}
        return receiver.clear_pending_update(rel)

    def get_file_tree(self, max_files: int = 60000) -> dict:
        """Build a nested file tree of the live synced set for the UI file-structure
        panel. Source = the watcher's in-memory index (the EXACT files that sync),
        so it reflects the same filtering the sync uses and updates in real time.
        Multiple watch roots map under their dest_rel paths, so they appear together
        as sibling first-level nodes. Returns the FULL tree (all depths); the UI
        chooses what to expand (default: first level only)."""
        # A light client never scans the tree (no watcher): return an empty,
        # non-scanning tree so the UI shows "no files" rather than spinning.
        if self.light and self.role == "client":
            return {"success": False, "light": True, "scanning": False, "children": []}
        wm = get_watch_manager()
        scanning = False
        try:
            wm.start()  # idempotent: ensures the index is populated on this end too
            # Wait briefly for the FIRST scan so a freshly-started watcher does not
            # return an empty tree (the panel would flash "no files" / drift would
            # read 0). Bounded; the HTTP server is threaded so this only blocks THIS
            # request. `scanning` lets the UI show "scanning…" instead of "empty".
            if not wm.wait_ready(timeout=15):
                scanning = True
        except Exception:
            pass
        snap = wm.snapshot()
        try:
            roots = wm.watch_dirs_str()
        except Exception:
            roots = []

        # Build {name -> node} maps for O(1) insert, then roll up + sort into lists.
        root_children: Dict[str, Any] = {}
        truncated = False
        count = 0
        for dest, meta in snap.items():
            if count >= max_files:
                truncated = True
                break
            count += 1
            try:
                mtime = float(meta[0]) if meta else 0.0
            except Exception:
                mtime = 0.0
            try:
                fhash = meta[1] if len(meta) > 1 else ""
            except Exception:
                fhash = ""
            try:
                abspath = meta[2] if len(meta) > 2 else ""
            except Exception:
                abspath = ""
            try:
                size = int(meta[3]) if len(meta) > 3 else (
                    _os.path.getsize(abspath) if abspath else 0
                )
            except Exception:
                size = 0
            parts = [p for p in str(dest).replace("\\", "/").split("/") if p]
            if not parts:
                continue
            cursor = root_children
            cur_path = ""
            for i, part in enumerate(parts):
                cur_path = (cur_path + "/" + part) if cur_path else part
                if i == len(parts) - 1:
                    # `hash` is the canonical (LF-normalized) content hash — used for
                    # CRLF-immune drift comparison against a peer's tree.
                    cursor[part] = {"name": part, "path": cur_path, "type": "file",
                                    "size": size, "mtime": mtime, "hash": fhash}
                else:
                    node = cursor.get(part)
                    if not node or node.get("type") != "dir":
                        node = {"name": part, "path": cur_path, "type": "dir",
                                "_children": {}}
                        cursor[part] = node
                    cursor = node["_children"]

        def _finalize(children_map: Dict[str, Any]):
            """Convert a {name: node} map into a sorted children list, rolling up
            size + file-count from descendants. Dirs first, then files; each alpha."""
            out = []
            total_size = 0
            total_files = 0
            for node in children_map.values():
                if node.get("type") == "dir":
                    kids, sz, fc = _finalize(node.pop("_children", {}))
                    node["children"] = kids
                    node["size"] = sz
                    node["count"] = fc
                    total_size += sz
                    total_files += fc
                else:
                    total_size += int(node.get("size") or 0)
                    total_files += 1
                out.append(node)
            out.sort(key=lambda n: (0 if n.get("type") == "dir" else 1,
                                    str(n.get("name", "")).lower()))
            return out, total_size, total_files

        children, total_size, total_files = _finalize(root_children)
        return {
            "success": True,
            "role": self.role,
            "roots": roots,
            "children": children,
            "count": total_files,
            "size": total_size,
            "truncated": truncated,
            "scanning": scanning,   # first index scan still running (tree may be partial)
        }

    def get_peer_file_tree(self, peer_id: str) -> dict:
        """Dev-side drift view of one CLIENT: fetch its /code-sync/file-tree and diff
        it against THIS dev's synced set by canonical content hash (CRLF-immune, so a
        Windows-dev/Linux-client EOL difference is NOT flagged as drift). Returns the
        client's actual received tree (for display) plus a drift summary:
          missing  -> on the dev, absent on the client (not yet received / lost)
          extra    -> on the client, not on the dev (stale / locally added)
          changed  -> present on both but a different content hash
        Reaches the client the same way the mesh probe does (host:port)."""
        peer = None
        for p in self.config.list_peers():
            if p.get("id") == peer_id:
                peer = p
                break
        if not peer:
            return {"success": False, "error": "unknown peer"}
        host = peer.get("host")
        port = int(peer.get("port", PYCORE_HTTP_PORT) or PYCORE_HTTP_PORT)
        name = peer.get("name") or host
        peer_meta = {"id": peer_id, "name": name, "host": host, "port": port}
        url = f"http://{host}:{port}{routes.FILE_TREE_PATH}"
        try:
            r = requests.get(url, timeout=20)
            code = getattr(r, "status_code", 0)
            if code != 200:
                return {"success": False, "peer": peer_meta,
                        "error": f"peer returned HTTP {code}"}
            peer_tree = r.json() or {}
        except Exception as exc:
            return {"success": False, "peer": peer_meta,
                    "error": f"unreachable: {exc}"}

        def _flatten(children, into):
            for n in children or []:
                if n.get("type") == "dir":
                    _flatten(n.get("children"), into)
                else:
                    into[n.get("path")] = {"hash": n.get("hash") or "",
                                           "size": int(n.get("size") or 0)}

        client_files: Dict[str, Any] = {}
        _flatten(peer_tree.get("children"), client_files)
        dev_tree = self.get_file_tree()
        dev_files: Dict[str, Any] = {}
        _flatten(dev_tree.get("children"), dev_files)
        # If EITHER side's first index scan is still running, the diff is provisional
        # (a partial tree inflates "missing"/"extra"); surface it so the UI can mark
        # the drift as not-yet-final rather than alarm the user.
        scanning = bool(peer_tree.get("scanning") or dev_tree.get("scanning"))

        missing, changed = [], []
        for path, dv in dev_files.items():
            cv = client_files.get(path)
            if cv is None:
                missing.append({"path": path, "size": dv["size"]})
            elif cv["hash"] != dv["hash"]:
                changed.append({"path": path, "size_dev": dv["size"],
                                "size_client": cv["size"]})
        extra = [{"path": p, "size": v["size"]}
                 for p, v in client_files.items() if p not in dev_files]
        missing.sort(key=lambda x: x["path"])
        extra.sort(key=lambda x: x["path"])
        changed.sort(key=lambda x: x["path"])
        return {
            "success": True,
            "peer": peer_meta,
            "tree": peer_tree,
            "scanning": scanning,   # dev and/or client index still scanning -> provisional
            "drift": {
                "dev_count": len(dev_files),
                "client_count": len(client_files),
                "in_sync": max(0, len(dev_files) - len(missing) - len(changed)),
                "missing": missing,
                "extra": extra,
                "changed": changed,
            },
        }

    def _broadcast(self) -> None:
        try:
            emit_event(BusSignals.CODE_SYNC_UPDATE, self.mesh.snapshot())
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


class _CodeSyncManagerProvider:
    def __init__(self) -> None:
        self._instance: Optional[CodeSyncManager] = None
        init_serialized_owner(self, "codesync.manager_provider", "CodeSyncManagerProvider")

    @serialized_method
    def get(self) -> CodeSyncManager:
        if self._instance is None:
            self._instance = CodeSyncManager()
        return self._instance


_code_sync_manager_provider = _CodeSyncManagerProvider()


def get_code_sync_manager() -> CodeSyncManager:
    return _code_sync_manager_provider.get()


# Preferred public alias.
get_manager = get_code_sync_manager
