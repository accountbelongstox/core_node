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

Status snapshots are published to the event journal as 'code_sync_update'.
"""

import socket
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.net_probe import lan_prefix, local_lan_ip
from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    RunningFlag,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
import pycore.pyutils.codesync.routes as routes
from pycore.pyutils.codesync.events import publish_code_sync_update
from pycore.pyutils.codesync.peer_config import PeerConfig
from pycore.pyutils.codesync.peer_http import peer_url, signed_peer_request
from pycore.pyutils.common.http_client import RESPONSE_CONTROL


TICK_SECONDS = 5
# A light client ticks far less often (it only tracks presence, never syncs).
LIGHT_TICK_SECONDS = 30
PROBE_TIMEOUT = 1.5


class PeerMeshManager:
    """Periodically probes peers, replicates config, and broadcasts status."""

    def __init__(self, config: PeerConfig,
                 local_status_fn: Callable[[], Dict[str, Any]],
                 apply_remote_config_fn: Optional[
                     Callable[[List[Dict[str, Any]], int, float], Any]] = None):
        self.config = config
        self._local_status_fn = local_status_fn
        self._light = False
        # Applied to the config carried back on a heartbeat response (LWW); lets a
        # NAT'd client adopt the dev's peer-config without being push-reachable.
        self._apply_remote_config_fn = apply_remote_config_fn
        self._running = RunningFlag("codesync.peer_mesh")
        self._ready_signal = f"codesync.peer_mesh.ready.{uuid.uuid4().hex}"
        # peer_id -> {reachable, last_seen, status}  (OUTBOUND probe results)
        self._peer_state: Dict[str, Dict[str, Any]] = {}
        # sender_id -> {last_checkin, status, source, lan_ip}  (INBOUND heartbeats)
        self._heartbeats: Dict[str, Dict[str, Any]] = {}
        # peer_ids that still need the latest config pushed (offline at push time)
        self._pending: set = set()
        self._last_tick_ms = 0
        init_serialized_owner(self, "codesync.peer_mesh.state", "CodeSyncPeerMeshState")

    # ----- lifecycle ------------------------------------------------------- #
    def start(self) -> None:
        if not self._running.start():
            return
        start_bus_task(self._loop, thread_name="CodeSync-PeerMesh")
        THREAD_BUS.register_shutdown_handler(self.stop, priority=70, name="code_sync_peer_mesh")
        ColorPrint.green("[PeerMesh] Started")

    def stop(self) -> None:
        if self._running.stop():
            ColorPrint.yellow("[PeerMesh] Stopped")

    def configure_light(self, light: bool) -> None:
        """Light client: slower tick (LIGHT_TICK_SECONDS) and a proportionally
        looser heartbeat-stale window so a node that checks in every 30s is not
        flapped offline between ticks. Set before start()."""
        self._light = bool(light)

    # ----- tick cadence ---------------------------------------------------- #
    def _tick_seconds(self) -> int:
        """Effective tick interval: slow (LIGHT_TICK_SECONDS) for a light client."""
        return LIGHT_TICK_SECONDS if self._light else TICK_SECONDS

    def _heartbeat_stale_seconds(self) -> float:
        """A heartbeat stays "fresh" for 3 effective ticks (=90s light, 15s full)."""
        return self._tick_seconds() * 3

    def wait_ready(self, timeout: Optional[float] = None) -> bool:
        return bool(THREAD_BUS.wait_signal(self._ready_signal, timeout))

    # ----- probing --------------------------------------------------------- #
    @staticmethod
    def _peer_url(peer: Dict[str, Any], path: str) -> str:
        return peer_url(peer.get("host"), int(peer.get("port", PYCORE_HTTP_PORT)), path)

    @staticmethod
    def _get_json(url: str, timeout: float) -> Optional[Dict[str, Any]]:
        """GET one peer JSON document; an unreachable peer is None (expected)."""
        try:
            response = signed_peer_request("GET", url, timeout=timeout, response=RESPONSE_CONTROL)
        except OSError:
            return None
        if response.status_code != 200:
            return None
        try:
            payload = response.json()
        except ValueError:
            return None
        return payload if isinstance(payload, dict) else None

    def _probe(self, peer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self._get_json(self._peer_url(peer, routes.PEER_STATUS_PATH), PROBE_TIMEOUT)

    def _probe_all(self, peers: List[Dict[str, Any]]) -> List[tuple]:
        jobs = []
        results = []
        deadline = time.monotonic() + PROBE_TIMEOUT + 1.0
        for peer in peers:
            signal_name = f"codesync.peer_mesh.probe.{uuid.uuid4().hex}"
            start_bus_task(
                self._probe,
                peer,
                thread_name=f"CodeSync-Probe-{peer.get('id')}",
                response_signal=signal_name,
            )
            jobs.append((peer, signal_name))
        for peer, signal_name in jobs:
            response = THREAD_BUS.wait_signal(
                signal_name,
                timeout=max(0.0, deadline - time.monotonic()),
            )
            THREAD_BUS.clear_signal(signal_name)
            status = response.get("result") if isinstance(response, dict) and response.get("success") else None
            results.append((peer, status if isinstance(status, dict) else None))
        return results

    def _loop(self) -> None:
        while self._running.active():
            self.tick()
            self._running.wait(self._tick_seconds())

    def tick(self) -> Dict[str, Any]:
        """Dev: probe peers, flush pending config, announce to clients. Client:
        PASSIVE — no outbound probe/announce; it is connected-into and only records
        inbound heartbeats + serves its own status."""
        started_at = time.monotonic()
        self_id = self.config.machine_id
        my_role = self.config.get_role()
        if my_role != "client":
            peers = [
                peer for peer in self.config.list_peers()
                if peer.get("id") != self_id
            ]
            resolved = {}
            config_changed = False
            for peer, status in self._probe_all(peers):
                pid = str(peer.get("id") or "")
                remote_id = str((status or {}).get("id") or pid)
                if status is not None and remote_id != pid:
                    config_changed = self.config.reconcile_peer_identity(pid, remote_id) or config_changed
                current = resolved.get(remote_id)
                if current is None or (current[1] is None and status is not None):
                    effective_peer = dict(peer)
                    effective_peer["id"] = remote_id
                    resolved[remote_id] = (effective_peer, status)
            if config_changed:
                self._queue_config_for_all()
            for pid, (peer, status) in resolved.items():
                reachable = status is not None
                newly_reachable, has_pending = self._record_probe(pid, reachable, status)
                if reachable and (newly_reachable or has_pending):
                    self._push_config_to(peer)
        THREAD_BUS.signal(self._ready_signal, True)
        self._send_heartbeats()
        self._record_tick_metrics(int((time.monotonic() - started_at) * 1000))
        snap = self.snapshot()
        publish_code_sync_update(snap)
        return snap

    @serialized_method
    def _record_tick_metrics(self, duration_ms: int) -> None:
        self._last_tick_ms = int(duration_ms)

    @serialized_method
    def _queue_config_for_all(self) -> None:
        self_id = self.config.machine_id
        self._pending.update(
            str(peer.get("id") or "")
            for peer in self.config.list_peers()
            if peer.get("id") and peer.get("id") != self_id
        )

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
        local = self._local_status_fn() or {}
        peers = [
            peer for peer in self.config.list_peers()
            if peer.get("id") != self_id and peer.get("role") == "client"
        ]
        jobs = []
        deadline = time.monotonic() + PROBE_TIMEOUT + 1.0
        for peer in peers:
            signal_name = f"codesync.peer_mesh.heartbeat.{uuid.uuid4().hex}"
            start_bus_task(
                self._send_heartbeat,
                peer,
                local,
                thread_name=f"CodeSync-Heartbeat-{peer.get('id')}",
                response_signal=signal_name,
            )
            jobs.append(signal_name)
        for signal_name in jobs:
            response = THREAD_BUS.wait_signal(
                signal_name,
                timeout=max(0.0, deadline - time.monotonic()),
            )
            THREAD_BUS.clear_signal(signal_name)
            cfg = response.get("result") if isinstance(response, dict) and response.get("success") else None
            if isinstance(cfg, dict) and isinstance(cfg.get("peers"), list) and self._apply_remote_config_fn:
                self._apply_remote_config_fn(
                    cfg.get("peers", []),
                    int(cfg.get("version", 0)),
                    float(cfg.get("updated_at", 0.0)),
                )

    def _send_heartbeat(
        self,
        peer: Dict[str, Any],
        local: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        try:
            response = signed_peer_request(
                "POST",
                self._peer_url(peer, routes.PEER_HEARTBEAT_PATH),
                local,
                timeout=PROBE_TIMEOUT,
                response=RESPONSE_CONTROL,
            )
        except OSError:
            return None
        if response.status_code != 200:
            return None
        return (response.json() or {}).get("config")

    def record_heartbeat(self, payload: Dict[str, Any],
                         source: Optional[str] = None) -> None:
        """Record an inbound heartbeat from a peer (keyed by its reported id, with
        source addr / lan_ip kept so snapshot() can match it to a configured peer
        whose id is a manually-assigned `host:port`).

        State write stays on the mesh worker; UI snapshot/emit runs AFTER so we
        never hold the mesh queue while calling manager.get_local_peer_status()."""
        self._store_heartbeat(payload, source)
        publish_code_sync_update(self.snapshot())

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
            ok = signed_peer_request("POST", self._peer_url(peer, routes.PEER_CONFIG_PATH),
                                     payload, timeout=PROBE_TIMEOUT,
                                     response=RESPONSE_CONTROL).status_code == 200
        except OSError:
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
        publish_code_sync_update(self.snapshot())

    # ----- LAN discovery (helper) ----------------------------------------- #
    def discover(self, port: int = PYCORE_HTTP_PORT) -> List[Dict[str, Any]]:
        """Scan the local /24 for code-sync peers not already in the config."""
        local_ip = local_lan_ip()
        me = self.config.get_self()
        scan_port = int(me.get("port", port))
        prefix = lan_prefix(local_ip)
        if not prefix:
            return []
        skip_ips = {local_ip, HTTP_LOOPBACK_HOST, "localhost", "::1",
                    str(me.get("host") or "").strip(), socket.gethostname()}
        found: List[Dict[str, Any]] = []

        def check(ip: str):
            d = self._get_json(peer_url(ip, scan_port, routes.PEER_STATUS_PATH), 1.0)
            if d is None:
                return None
            candidate = {"host": ip, "port": scan_port,
                         "name": d.get("name", ip),
                         "role": d.get("role", "client"),
                         "id": d.get("id")}
            return None if self.config.is_self_peer(candidate) else candidate

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
            "last_tick_ms": self._last_tick_ms,
        }

    def client_targets(self) -> List[Dict[str, Any]]:
        state = self._copy_mesh_state()
        peer_state = state["peer_state"]
        selected = {}
        for peer in self.config.list_peers():
            if peer.get("role") != "client" or peer.get("id") == self.config.machine_id:
                continue
            status_row = peer_state.get(peer.get("id"), {})
            if not status_row.get("reachable"):
                continue
            status = status_row.get("status") or {}
            canonical_id = str(status.get("id") or peer.get("id") or "")
            candidate = dict(peer)
            candidate["canonical_id"] = canonical_id
            current = selected.get(canonical_id)
            if current is None:
                selected[canonical_id] = candidate
        return list(selected.values())

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
        local = self._local_status_fn() or {}
        return {
            "self": local,
            "peers": peers_out,
            "version": self.config.version(),
            "last_tick_ms": int(state.get("last_tick_ms") or 0),
        }
