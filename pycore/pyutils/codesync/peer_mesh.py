# -*- coding: utf-8 -*-
"""
Code Sync peer mesh — status probing + reverse heartbeat + config replication.

Every end runs this mesh. On a tick it:
  * PROBES all configured peers (GET /code-sync/peer/status) — the OUTBOUND
    direction, which only works when this node can open a connection to peer:port
    (LAN / tailscale / a port-forwarded public host).
  * SENDS a heartbeat (POST /code-sync/peer/heartbeat with this node's own status)
    to every configured dev/hub — the INBOUND direction, so a client behind NAT
    (home laptop, cloud box, phone) that can never be probed still reports its
    presence + code-stats to the dev. The heartbeat RESPONSE carries the dev's
    peer-config so even one-directional clients converge config (LWW).

`snapshot()` MERGES both signals per peer: a peer is reachable if it answered a
probe OR sent a fresh heartbeat; `via` records how it is connected
(probe / heartbeat / both). This is what lets the UI show each client's contact
state across WAN, not just on the LAN.

Status snapshots are broadcast to the desktop UI via the existing RPC WebSocket
by firing a 'code_sync_update' event (no-op in standalone mode).

Stdlib only: HTTP via `.runtime.http` (urllib), events/shutdown via `.runtime`.
"""

import threading
import time
from typing import Any, Callable, Dict, List, Optional

from .runtime import (
    log as ColorPrint,
    http as requests,
    emit_event,
    is_shutdown_requested,
    register_shutdown_handler,
)
from .peer_config import PeerConfig

TICK_SECONDS = 5
PROBE_TIMEOUT = 1.5
# A heartbeat counts as "fresh" (peer considered online via heartbeat) for this
# many seconds after it arrives — a few ticks of slack so a single dropped POST
# doesn't flap the peer offline.
HEARTBEAT_STALE_SECONDS = TICK_SECONDS * 3


class PeerMeshManager:
    """Periodically probes peers, replicates config, and broadcasts status."""

    def __init__(self, config: PeerConfig,
                 local_status_fn: Callable[[], Dict[str, Any]],
                 apply_remote_config_fn: Optional[
                     Callable[[List[Dict[str, Any]], int, float], Any]] = None):
        self.config = config
        self._local_status_fn = local_status_fn
        # Applied to the config carried back on a heartbeat response (LWW); lets a
        # NAT'd client adopt the dev's peer-config without being push-reachable.
        self._apply_remote_config_fn = apply_remote_config_fn
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        # peer_id -> {reachable, last_seen, status}  (OUTBOUND probe results)
        self._peer_state: Dict[str, Dict[str, Any]] = {}
        # sender_id -> {last_checkin, status, source, lan_ip}  (INBOUND heartbeats)
        self._heartbeats: Dict[str, Dict[str, Any]] = {}
        # peer_ids that still need the latest config pushed (offline at push time)
        self._pending: set = set()

    # ----- lifecycle ------------------------------------------------------- #
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="CodeSync-PeerMesh")
        self._thread.start()
        register_shutdown_handler(self.stop, priority=70, name="code_sync_peer_mesh")
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
                if is_shutdown_requested():
                    break
                self.tick()
            except Exception as exc:
                ColorPrint.yellow(f"[PeerMesh] tick error: {exc}")
            for _ in range(TICK_SECONDS * 2):
                if not self._running or is_shutdown_requested():
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
        # Reverse direction: announce ourselves to dev/hub peers (NAT-friendly).
        self._send_heartbeats()
        snap = self.snapshot()
        try:
            emit_event("code_sync_update", snap)
        except Exception:
            pass
        return snap

    # ----- heartbeat (inbound presence; NAT-friendly) --------------------- #
    def _send_heartbeats(self) -> None:
        """POST this node's status to every configured dev/hub so a client that
        cannot be probed (behind NAT) still reports presence. Adopt any newer
        peer-config returned on the response (LWW)."""
        self_id = self.config.machine_id
        try:
            local = self._local_status_fn() or {}
        except Exception:
            return
        for peer in self.config.list_peers():
            if peer.get("id") == self_id or peer.get("role") != "dev":
                continue
            try:
                r = requests.post(self._peer_url(peer, "/code-sync/peer/heartbeat"),
                                  json=local, timeout=PROBE_TIMEOUT)
                if r.status_code != 200 or not self._apply_remote_config_fn:
                    continue
                cfg = (r.json() or {}).get("config")
                if isinstance(cfg, dict) and isinstance(cfg.get("peers"), list):
                    self._apply_remote_config_fn(
                        cfg.get("peers", []),
                        int(cfg.get("version", 0)),
                        float(cfg.get("updated_at", 0.0)))
            except Exception:
                continue

    def record_heartbeat(self, payload: Dict[str, Any],
                         source: Optional[str] = None) -> None:
        """Record an inbound heartbeat from a peer (keyed by its reported id, with
        source addr / lan_ip kept so snapshot() can match it to a configured peer
        whose id is a manually-assigned `host:port`)."""
        if not isinstance(payload, dict):
            return
        sender = str(payload.get("id") or source or "").strip()
        if not sender:
            return
        with self._lock:
            self._heartbeats[sender] = {
                "last_checkin": time.time(),
                "status": payload,
                "source": source,
                "lan_ip": payload.get("lan_ip"),
            }
        # Reflect new presence in the UI immediately (snapshot() takes the lock,
        # so build it AFTER releasing ours to avoid re-entrancy).
        try:
            emit_event("code_sync_update", self.snapshot())
        except Exception:
            pass

    def _match_heartbeat(self, peer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find a heartbeat belonging to a configured peer. A peer's id may be its
        machine-id (auto) or `host:port` (manually added), while a heartbeat is
        keyed by the sender's machine-id — so match on id, source addr, lan_ip, or
        the id reported inside the heartbeat status."""
        pid = peer.get("id")
        host = peer.get("host")
        for hid, hb in self._heartbeats.items():
            if hid == pid:
                return hb
            if host and (hb.get("source") == host or hb.get("lan_ip") == host):
                return hb
            st = hb.get("status") or {}
            if st.get("id") and st.get("id") == pid:
                return hb
        return None

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
            emit_event("code_sync_update", self.snapshot())
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
        now = time.time()
        peers_out: List[Dict[str, Any]] = []
        with self._lock:
            for peer in self.config.list_peers():
                pid = peer.get("id")
                if pid == self_id:
                    continue
                st = self._peer_state.get(pid, {})
                probe_ok = bool(st.get("reachable", False))
                probe_seen = st.get("last_seen")
                probe_status = st.get("status")

                hb = self._match_heartbeat(peer)
                hb_checkin = hb.get("last_checkin") if hb else None
                hb_fresh = bool(hb_checkin and (now - hb_checkin) <= HEARTBEAT_STALE_SECONDS)

                # Merge the two directions.
                reachable = probe_ok or hb_fresh
                last_seen = max([t for t in (probe_seen, hb_checkin) if t], default=None)
                # Prefer the fresher status payload.
                if probe_ok and (not hb_fresh or (probe_seen or 0) >= (hb_checkin or 0)):
                    status = probe_status
                elif hb_fresh:
                    status = hb.get("status")
                else:
                    status = probe_status or (hb.get("status") if hb else None)
                via = ("both" if (probe_ok and hb_fresh)
                       else "probe" if probe_ok
                       else "heartbeat" if hb_fresh
                       else None)

                peers_out.append({
                    **peer,
                    "reachable": reachable,
                    "last_seen": last_seen,
                    "last_checkin": hb_checkin,
                    "via": via,
                    "status": status,
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
