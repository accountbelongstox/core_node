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

import socket
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from .runtime import (
    log as ColorPrint,
    http as requests,
    emit_event,
    is_shutdown_requested,
    register_shutdown_handler,
    THREAD_BUS,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from .peer_config import PeerConfig, _local_lan_ip


TICK_SECONDS = 5
# A light client ticks far less often (it only tracks presence, never syncs).
LIGHT_TICK_SECONDS = 30
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
                     Callable[[List[Dict[str, Any]], int, float], Any]] = None,
                 light: bool = False):
        self.config = config
        self._local_status_fn = local_status_fn
        # Light client: slower tick (LIGHT_TICK_SECONDS) and a proportionally
        # looser heartbeat-stale window so a node that checks in every 30s is not
        # flapped offline between ticks.
        self._light = bool(light)
        # Applied to the config carried back on a heartbeat response (LWW); lets a
        # NAT'd client adopt the dev's peer-config without being push-reachable.
        self._apply_remote_config_fn = apply_remote_config_fn
        self._running = False
        self._thread = None
        self._running_signal = f"codesync.peer_mesh.running.{uuid.uuid4().hex}"
        # peer_id -> {reachable, last_seen, status}  (OUTBOUND probe results)
        self._peer_state: Dict[str, Dict[str, Any]] = {}
        # sender_id -> {last_checkin, status, source, lan_ip}  (INBOUND heartbeats)
        self._heartbeats: Dict[str, Dict[str, Any]] = {}
        # peer_ids that still need the latest config pushed (offline at push time)
        self._pending: set = set()
        init_serialized_owner(self, "codesync.peer_mesh.state", "CodeSyncPeerMeshState")
        THREAD_BUS.signal(self._running_signal, False)

    # ----- lifecycle ------------------------------------------------------- #
    def start(self) -> None:
        if not self._begin_start():
            return
        self._thread = start_bus_task(self._loop, thread_name="CodeSync-PeerMesh")
        register_shutdown_handler(self.stop, priority=70, name="code_sync_peer_mesh")
        ColorPrint.green("[PeerMesh] Started")

    def stop(self) -> None:
        worker = self._begin_stop()
        if worker is None:
            return
        if worker:
            worker.join(timeout=2.0)
        ColorPrint.yellow("[PeerMesh] Stopped")

    @serialized_method
    def _begin_start(self) -> bool:
        if self._running:
            return False
        self._running = True
        THREAD_BUS.signal(self._running_signal, True)
        return True

    @serialized_method
    def _begin_stop(self):
        if not self._running:
            return None
        self._running = False
        THREAD_BUS.signal(self._running_signal, False)
        return self._thread

    # ----- tick cadence ---------------------------------------------------- #
    def _tick_seconds(self) -> int:
        """Effective tick interval: slow (LIGHT_TICK_SECONDS) for a light client."""
        return LIGHT_TICK_SECONDS if self._light else TICK_SECONDS

    def _heartbeat_stale_seconds(self) -> float:
        """A heartbeat stays "fresh" for 3 effective ticks (=90s light, 15s full)."""
        return self._tick_seconds() * 3

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
        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                if is_shutdown_requested():
                    break
                self.tick()
            except Exception as exc:
                ColorPrint.yellow(f"[PeerMesh] tick error: {exc}")
            for _ in range(self._tick_seconds() * 2):
                if not THREAD_BUS.get_signal(self._running_signal, False) or is_shutdown_requested():
                    break
                time.sleep(0.5)

    def tick(self) -> Dict[str, Any]:
        """Dev: probe peers, flush pending config, announce to clients. Client:
        PASSIVE — no outbound probe/announce; it is connected-into and only records
        inbound heartbeats + serves its own status."""
        self_id = self.config.machine_id
        my_role = self.config.get_role()
        if my_role != "client":
            for peer in self.config.list_peers():
                pid = peer.get("id")
                if pid == self_id:
                    continue
                status = self._probe(peer)
                reachable = status is not None
                newly_reachable, has_pending = self._record_probe(pid, reachable, status)
                # Deliver any queued config to a peer that just came back online.
                if reachable and (newly_reachable or has_pending):
                    self._push_config_to(peer)
        # Dev announces itself to its (reachable) clients so a client — which never
        # dials out — still shows the dev as an active inbound connection.
        self._send_heartbeats()
        snap = self.snapshot()
        try:
            emit_event("code_sync_update", snap)
        except Exception:
            pass
        return snap

    @serialized_method
    def _record_probe(
        self,
        peer_id: str,
        reachable: bool,
        status: Optional[Dict[str, Any]],
    ) -> tuple[bool, bool]:
        previous = self._peer_state.get(peer_id, {})
        was_reachable = previous.get("reachable", False)
        self._peer_state[peer_id] = {
            "reachable": reachable,
            "last_seen": time.time() if reachable else previous.get("last_seen"),
            "status": status if reachable else previous.get("status"),
        }
        return reachable and not was_reachable, peer_id in self._pending

    # ----- heartbeat (inbound presence; NAT-friendly) --------------------- #
    def _send_heartbeats(self) -> None:
        """A DEV-end (typically NAT'd, dials out) POSTs its status to each CLIENT
        (public, reachable) so the client — which never connects out — still shows
        the dev as an active inbound connection. Clients send nothing. Any newer
        peer-config returned on the response is adopted (LWW)."""
        self_id = self.config.machine_id
        if self.config.get_role() != "dev":
            return  # clients are passive: they are connected-into, never announce
        try:
            local = self._local_status_fn() or {}
        except Exception:
            return
        for peer in self.config.list_peers():
            if peer.get("id") == self_id or peer.get("role") != "client":
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
        whose id is a manually-assigned `host:port`).

        State write stays on the mesh worker; UI snapshot/emit runs AFTER so we
        never hold the mesh queue while calling manager.get_local_peer_status()."""
        self._store_heartbeat(payload, source)
        try:
            emit_event("code_sync_update", self.snapshot())
        except Exception:
            pass

    @serialized_method
    def _store_heartbeat(self, payload: Dict[str, Any],
                         source: Optional[str] = None) -> None:
        if not isinstance(payload, dict):
            return
        sender = str(payload.get("id") or source or "").strip()
        if not sender:
            return
        self._heartbeats[sender] = {
            "last_checkin": time.time(),
            "status": payload,
            "source": source,
            "lan_ip": payload.get("lan_ip"),
        }

    def _match_heartbeat(
        self,
        peer: Dict[str, Any],
        heartbeats: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Find a heartbeat belonging to a configured peer. A peer's id may be its
        machine-id (auto) or `host:port` (manually added), while a heartbeat is
        keyed by the sender's machine-id — so match on id, source addr, lan_ip, or
        the id reported inside the heartbeat status."""
        hb_map = self._heartbeats if heartbeats is None else heartbeats
        pid = peer.get("id")
        host = peer.get("host")
        for hid, hb in hb_map.items():
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
        self._record_push_result(pid, ok)
        return ok

    @serialized_method
    def _record_push_result(self, peer_id: str, succeeded: bool) -> None:
        if succeeded:
            self._pending.discard(peer_id)
        else:
            self._pending.add(peer_id)

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
        local_ip = _local_lan_ip()
        me = self.config.get_self()
        scan_port = int(me.get("port", port))
        prefix = ".".join(local_ip.split(".")[:3])
        skip_ips = {local_ip, "127.0.0.1", "localhost", "::1",
                    str(me.get("host") or "").strip()}
        try:
            skip_ips.add(socket.gethostname())
        except Exception:
            pass
        found: List[Dict[str, Any]] = []

        def check(ip: str):
            try:
                r = requests.get(f"http://{ip}:{scan_port}/code-sync/peer/status", timeout=1)
                if r.status_code == 200:
                    d = r.json()
                    candidate = {"host": ip, "port": scan_port,
                                   "name": d.get("name", ip),
                                   "role": d.get("role", "client"),
                                   "id": d.get("id")}
                    if self.config.is_self_peer(candidate):
                        return None
                    return candidate
            except Exception:
                pass
            return None

        probe_signals = []
        for i in range(1, 255):
            ip = f"{prefix}.{i}"
            if ip in skip_ips:
                continue
            response_signal = f"codesync.peer_mesh.probe.{uuid.uuid4().hex}"
            probe_signals.append(response_signal)
            start_bus_task(
                check,
                ip,
                thread_name=f"CodeSync-PeerProbe-{i}",
                response_signal=response_signal,
            )
        start = time.time()
        for response_signal in probe_signals:
            response = THREAD_BUS.wait_signal(
                response_signal,
                timeout=max(0, 5 - (time.time() - start)),
            )
            THREAD_BUS.clear_signal(response_signal)
            if isinstance(response, dict) and response.get("success") and response.get("result"):
                found.append(response["result"])

        existing = {(p.get("host"), int(p.get("port", 0))) for p in self.config.list_peers()}
        return [c for c in found
                if not self.config.is_self_peer(c)
                and (c["host"], c["port"]) not in existing]

    # ----- snapshot -------------------------------------------------------- #
    @serialized_method
    def _copy_mesh_state(self) -> Dict[str, Any]:
        """Copy raw mesh-owned state only (no cross-owner calls)."""
        return {
            "peer_state": {pid: dict(st) for pid, st in self._peer_state.items()},
            "heartbeats": {hid: dict(hb) for hid, hb in self._heartbeats.items()},
            "pending": set(self._pending),
        }

    def snapshot(self) -> Dict[str, Any]:
        """Merge probe + heartbeat into a UI/status snapshot.

        Mesh state is copied on the mesh worker; composition and
        ``_local_status_fn`` (manager) run AFTER so we never AB-BA with Manager."""
        state = self._copy_mesh_state()
        peer_state = state["peer_state"]
        heartbeats = state["heartbeats"]
        pending = state["pending"]
        self_id = self.config.machine_id
        now = time.time()
        stale_limit = self._heartbeat_stale_seconds()
        peers_out: List[Dict[str, Any]] = []
        for peer in self.config.list_peers():
            pid = peer.get("id")
            if pid == self_id:
                continue
            st = peer_state.get(pid, {})
            probe_ok = bool(st.get("reachable", False))
            probe_seen = st.get("last_seen")
            probe_status = st.get("status")

            hb = self._match_heartbeat(peer, heartbeats)
            hb_checkin = hb.get("last_checkin") if hb else None
            hb_fresh = bool(hb_checkin and (now - hb_checkin) <= stale_limit)

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
                "pending": pid in pending,
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
