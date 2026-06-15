# -*- coding: utf-8 -*-
"""
Code Sync peer mesh — status probing + config replication.

Every end runs this mesh. On a tick it probes all configured peers
(GET /code-sync/peer/status), tracks reachability (so the UI can show offline
peers too), and pushes config changes to peers. Peers that are unreachable at
push time get the change queued and delivered once they come back online.

Status snapshots are broadcast to the desktop UI via the existing RPC WebSocket
by firing a THREAD_BUS 'code_sync_update' event (the RPC server relays registered
THREAD_BUS events to WS clients).
"""

import threading
import time
from typing import Any, Callable, Dict, List, Optional

import requests

from pycore import ColorPrint, THREAD_BUS
from .peer_config import PeerConfig

TICK_SECONDS = 5
PROBE_TIMEOUT = 1.5


class PeerMeshManager:
    """Periodically probes peers, replicates config, and broadcasts status."""

    def __init__(self, config: PeerConfig,
                 local_status_fn: Callable[[], Dict[str, Any]]):
        self.config = config
        self._local_status_fn = local_status_fn
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        # peer_id -> {reachable, last_seen, status}
        self._peer_state: Dict[str, Dict[str, Any]] = {}
        # peer_ids that still need the latest config pushed (offline at push time)
        self._pending: set = set()

    # ----- lifecycle ------------------------------------------------------- #
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="CodeSync-PeerMesh")
        self._thread.start()
        THREAD_BUS.register_shutdown_handler(self.stop, priority=70, name="code_sync_peer_mesh")
        ColorPrint.green("[PeerMesh] Started")

    def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        ColorPrint.yellow("[PeerMesh] Stopped")

    # ----- probing --------------------------------------------------------- #
    def _peer_url(self, peer: Dict[str, Any], path: str) -> str:
        return f"http://{peer.get('host')}:{int(peer.get('port', 59000))}{path}"

    def _probe(self, peer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            r = requests.get(self._peer_url(peer, "/code-sync/peer/status"), timeout=PROBE_TIMEOUT)
            if r.status_code == 200:
                return r.json()
        except Exception:
            return None
        return None

    def _loop(self) -> None:
        while self._running:
            try:
                if THREAD_BUS.is_shutdown_requested():
                    break
                self.tick()
            except Exception as exc:
                ColorPrint.yellow(f"[PeerMesh] tick error: {exc}")
            for _ in range(TICK_SECONDS * 2):
                if not self._running or THREAD_BUS.is_shutdown_requested():
                    break
                time.sleep(0.5)

    def tick(self) -> Dict[str, Any]:
        """Probe every peer once, flush pending pushes, broadcast the snapshot."""
        self_id = self.config.machine_id
        for peer in self.config.list_peers():
            pid = peer.get("id")
            if pid == self_id:
                continue
            status = self._probe(peer)
            reachable = status is not None
            with self._lock:
                prev = self._peer_state.get(pid, {})
                was_reachable = prev.get("reachable", False)
                self._peer_state[pid] = {
                    "reachable": reachable,
                    "last_seen": time.time() if reachable else prev.get("last_seen"),
                    "status": status if reachable else prev.get("status"),
                }
                newly_reachable = reachable and not was_reachable
                has_pending = pid in self._pending
            # Deliver any queued config to a peer that just came back online.
            if reachable and (newly_reachable or has_pending):
                self._push_config_to(peer)
        snap = self.snapshot()
        try:
            THREAD_BUS.trigger_event("code_sync_update", snap)
        except Exception:
            pass
        return snap

    # ----- config replication --------------------------------------------- #
    def _push_config_to(self, peer: Dict[str, Any]) -> bool:
        pid = peer.get("id")
        payload = self.config.to_payload()
        try:
            r = requests.post(self._peer_url(peer, "/code-sync/peer/config"),
                              json=payload, timeout=PROBE_TIMEOUT)
            ok = r.status_code == 200
        except Exception:
            ok = False
        with self._lock:
            if ok:
                self._pending.discard(pid)
            else:
                self._pending.add(pid)
        return ok

    def broadcast_config(self) -> None:
        """Push the current config to all peers; queue the ones that are offline."""
        self_id = self.config.machine_id
        for peer in self.config.list_peers():
            if peer.get("id") == self_id:
                continue
            if not self._push_config_to(peer):
                ColorPrint.yellow(f"[PeerMesh] Peer {peer.get('name')} offline; "
                                  f"config push queued.")
        # Reflect the change in the UI immediately.
        try:
            THREAD_BUS.trigger_event("code_sync_update", self.snapshot())
        except Exception:
            pass

    # ----- LAN discovery (helper) ----------------------------------------- #
    def discover(self, port: int = 59000) -> List[Dict[str, Any]]:
        """Scan the local /24 for code-sync peers not already in the config."""
        from .peer_config import _local_lan_ip
        local_ip = _local_lan_ip()
        prefix = ".".join(local_ip.split(".")[:3])
        found: List[Dict[str, Any]] = []
        flock = threading.Lock()

        def check(ip: str):
            try:
                r = requests.get(f"http://{ip}:{port}/code-sync/peer/status", timeout=1)
                if r.status_code == 200:
                    d = r.json()
                    with flock:
                        found.append({"host": ip, "port": port,
                                      "name": d.get("name", ip),
                                      "role": d.get("role", "client"),
                                      "id": d.get("id")})
            except Exception:
                pass

        threads = []
        for i in range(1, 255):
            ip = f"{prefix}.{i}"
            if ip == local_ip:
                continue
            t = threading.Thread(target=check, args=(ip,), daemon=True)
            threads.append(t)
            t.start()
        start = time.time()
        for t in threads:
            t.join(timeout=max(0, 5 - (time.time() - start)))

        existing = {(p.get("host"), int(p.get("port", 0))) for p in self.config.list_peers()}
        return [c for c in found if (c["host"], c["port"]) not in existing]

    # ----- snapshot -------------------------------------------------------- #
    def snapshot(self) -> Dict[str, Any]:
        self_id = self.config.machine_id
        peers_out: List[Dict[str, Any]] = []
        with self._lock:
            for peer in self.config.list_peers():
                pid = peer.get("id")
                if pid == self_id:
                    continue
                st = self._peer_state.get(pid, {})
                peers_out.append({
                    **peer,
                    "reachable": bool(st.get("reachable", False)),
                    "last_seen": st.get("last_seen"),
                    "status": st.get("status"),
                    "pending": pid in self._pending,
                })
        local = {}
        try:
            local = self._local_status_fn() or {}
        except Exception:
            pass
        return {
            "self": local,
            "peers": peers_out,
            "version": self.config.version(),
        }
