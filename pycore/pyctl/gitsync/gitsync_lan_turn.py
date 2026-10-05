# -*- coding: utf-8 -*-
"""LAN turn lease of automatic gitsync: one pycore on the LAN runs gitsync at a time.

A machine waiting for its turn holds a ticket (the time it started waiting); a peer grants
a claim unless it runs gitsync itself, already granted another machine, or waits with an
older ticket (ties by machine id). The finishing machine releases the turn to every LAN
peer with a compact run summary, which is also the LAN view each pycore shows its UI."""

from __future__ import annotations

import random
import socket
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.service_contract import value as service_contract_value
from pycore.pyutils.common.client_key_auth import get_pycore_machine_id
from pycore.pyutils.rpc.lan_peers import lan_peers

LABEL = "GitSyncLanTurn"
PIPELINE = service_contract_value("code_sync.pipeline")
CLAIM_ROUTE_KEY = "gitsyncPeerClaim"
RELEASE_ROUTE_KEY = "gitsyncPeerRelease"
CLAIM_TTL_SECONDS = int(PIPELINE["claim_ttl_seconds"])
PEER_TIMEOUT_SECONDS = float(PIPELINE["peer_timeout_seconds"])
RETRY_MIN_SECONDS = float(PIPELINE["retry_min_seconds"])
RETRY_MAX_SECONDS = float(PIPELINE["retry_max_seconds"])
RETRY_JITTER_SECONDS = float(PIPELINE["retry_jitter_seconds"])
PEER_VIEW_MAX = int(PIPELINE["peer_view_max"])
SUMMARY_FIELDS = ("result", "finished_at", "head", "pushed", "pulled", "branch")


def _priority(ticket: float, machine: str) -> Tuple[float, str]:
    return (ticket, machine)


class GitSyncLanTurn:
    def __init__(self) -> None:
        self.machine = get_pycore_machine_id()
        self.hostname = socket.gethostname()
        self._holder: Optional[Dict[str, Any]] = None
        self._own_ticket: Optional[float] = None
        self._local_running = False
        self._views: Dict[str, Dict[str, Any]] = {}
        init_serialized_owner(self, "pyctl.gitsync.lan_turn", "GitSyncLanTurnThread")

    # ---- state owned by the serialized thread ----

    def _prune(self, now: float) -> None:
        if self._holder is not None and self._holder["expires"] <= now:
            ColorPrint.yellow(f"[{LABEL}] turn of {self._holder['hostname']} expired")
            self._view(self._holder["machine"], self._holder["hostname"], {"running": False})
            self._holder = None

    def _view(self, machine: str, hostname: str, fields: Dict[str, Any]) -> None:
        view = {**self._views.get(machine, {}), **fields, "machine": machine, "hostname": hostname, "seen_at": time.time()}
        self._views[machine] = view
        if len(self._views) > PEER_VIEW_MAX:
            oldest = min(self._views.values(), key=lambda entry: entry["seen_at"])
            self._views.pop(oldest["machine"])

    @serialized_method
    def decide_claim(self, machine: str, hostname: str, ticket: float) -> Dict[str, Any]:
        now = time.time()
        self._prune(now)
        reason = ""
        if self._holder is not None and self._holder["machine"] != machine:
            reason = "granted_other"
        elif self._local_running:
            reason = "running"
        elif self._own_ticket is not None and _priority(self._own_ticket, self.machine) < _priority(ticket, machine):
            reason = "older_ticket"
        if reason:
            retry_after = self._holder["expires"] - now if reason == "granted_other" else RETRY_MIN_SECONDS
            holder = self._holder["hostname"] if reason == "granted_other" else self.hostname
            return {"success": True, "granted": False, "reason": reason, "holder": holder, "retry_after": retry_after}
        self._holder = {"machine": machine, "hostname": hostname, "ticket": ticket, "expires": now + CLAIM_TTL_SECONDS}
        self._view(machine, hostname, {"running": True})
        return {"success": True, "granted": True}

    @serialized_method
    def apply_release(self, machine: str, hostname: str, summary: Dict[str, Any]) -> None:
        if self._holder is not None and self._holder["machine"] == machine:
            self._holder = None
        self._view(machine, hostname, {"running": False, **{key: summary.get(key) for key in SUMMARY_FIELDS if key in summary}})

    @serialized_method
    def _begin_wait(self) -> float:
        if self._own_ticket is None:
            self._own_ticket = time.time()
        return self._own_ticket

    @serialized_method
    def _try_start_local(self) -> bool:
        self._prune(time.time())
        if self._holder is not None and self._holder["machine"] != self.machine:
            return False
        self._holder = None
        self._own_ticket = None
        self._local_running = True
        return True

    @serialized_method
    def _finish_local(self) -> None:
        self._local_running = False
        self._own_ticket = None

    @serialized_method
    def snapshot(self) -> Dict[str, Any]:
        self._prune(time.time())
        return {
            "waiting": self._own_ticket is not None,
            "holder": self._holder["hostname"] if self._holder is not None else "",
            "peers": sorted(self._views.values(), key=lambda entry: entry["hostname"]),
        }

    # ---- caller side (the gitsync watch thread) ----

    def _claim_payload(self, ticket: float) -> Dict[str, Any]:
        return {"machine": self.machine, "hostname": self.hostname, "ticket": ticket}

    def acquire(self, wait: Callable[[float], bool], on_wait: Callable[[str], None]) -> Optional[List[Dict[str, Any]]]:
        """Block until this machine holds the LAN turn; the granting peers, or None when ``wait`` reports a stop."""
        while True:
            ticket = self._begin_wait()
            granted: List[Dict[str, Any]] = []
            denial: Optional[Dict[str, Any]] = None
            for peer in lan_peers.peers():
                reply = lan_peers.post(peer["url"], CLAIM_ROUTE_KEY, self._claim_payload(ticket), PEER_TIMEOUT_SECONDS)
                if reply is None:
                    continue
                if not reply.get("granted"):
                    denial = reply
                    break
                granted.append(peer)
            if denial is None and self._try_start_local():
                return granted
            self._release(granted, {})
            holder = str((denial or {}).get("holder") or "")
            on_wait(holder)
            delay = float((denial or {}).get("retry_after") or RETRY_MIN_SECONDS)
            delay = min(RETRY_MAX_SECONDS, max(RETRY_MIN_SECONDS, delay)) + random.uniform(0, RETRY_JITTER_SECONDS)
            ColorPrint.blue(f"[{LABEL}] waiting {delay:.0f}s for the LAN turn held by {holder or 'this machine'}")
            if wait(delay):
                self._finish_local()
                return None

    def release(self, granted: List[Dict[str, Any]], summary: Dict[str, Any]) -> None:
        """End the local run and hand the turn back to every LAN peer, announcing ``summary``."""
        self._finish_local()
        urls = {peer["url"] for peer in granted} | {peer["url"] for peer in lan_peers.peers()}
        compact = {key: summary[key] for key in SUMMARY_FIELDS if key in summary}
        self._release([{"url": url} for url in sorted(urls)], compact)

    def _release(self, peers: List[Dict[str, Any]], summary: Dict[str, Any]) -> None:
        payload = {"machine": self.machine, "hostname": self.hostname, "summary": summary}
        for peer in peers:
            lan_peers.post(peer["url"], RELEASE_ROUTE_KEY, payload, PEER_TIMEOUT_SECONDS)


gitsync_lan_turn = GitSyncLanTurn()


__all__ = ["GitSyncLanTurn", "gitsync_lan_turn"]
