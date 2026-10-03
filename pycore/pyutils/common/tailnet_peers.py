# -*- coding: utf-8 -*-
"""
Live tailnet machine list from ``tailscale status --json`` - the same document
(TailnetPeersDocument) the UI server answers at ``/tailnet_peers.json``, so a
client (e.g. a compiled phone app, which cannot list the tailnet itself) can
discover every machine from any reachable machine that runs pycore.

Without Tailscale peers (binary missing, logged out, timeout) a machine that runs the
Headscale control server answers with its ``headscale nodes list`` in the same shape;
without either the list is empty.
"""

import json
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.commander import Commander
from pycore.pyfoundations.service_contract import mesh_domain, tailnet_client_only_os

TAILSCALE_STATUS_COMMAND = ["tailscale", "status", "--json"]
TAILSCALE_STATUS_TIMEOUT_SECONDS = 4
HEADSCALE_PROVIDER = "headscale"
HEADSCALE_NODES_COMMAND = [HEADSCALE_PROVIDER, "nodes", "list", "--output", "json"]
HEADSCALE_NODES_TIMEOUT_SECONDS = 4
TAILNET_DOMAIN_CACHE_SECONDS = 60

_tailnet_document_cache: Dict[str, Any] = {"at": 0.0, "document": {"tailnet": "", "peers": []}}


def _peer(node: Any, is_self: bool, tailnet: str) -> Optional[Dict[str, Any]]:
    """One machine of the document; None for a node outside the tailnet or without a DNS name."""
    entry = node if isinstance(node, dict) else {}
    dns_name = str(entry.get("DNSName") or "").rstrip(".").lower()
    if not dns_name or (tailnet and not dns_name.endswith(f".{tailnet}")):
        return None
    return {
        "dnsName": dns_name,
        "hostName": str(entry.get("HostName") or dns_name.split(".")[0]),
        "os": str(entry.get("OS") or ""),
        "online": is_self or bool(entry.get("Online")),
        "self": is_self,
    }


def _headscale_peer(node: Any, domain: str) -> Optional[Dict[str, Any]]:
    """One machine of a Headscale node record; None for a node without a name."""
    entry = node if isinstance(node, dict) else {}
    name = str(entry.get("given_name") or entry.get("name") or "").lower()
    if not name:
        return None
    return {
        "dnsName": f"{name}.{domain}",
        "hostName": str(entry.get("name") or name),
        "os": str(entry.get("os") or ""),
        "online": bool(entry.get("online")),
        "self": False,
    }


def _read_headscale_peers() -> Dict[str, Any]:
    """The tailnet document of this machine's Headscale control server; empty without one."""
    domain = mesh_domain(HEADSCALE_PROVIDER)
    result = Commander.run_args(HEADSCALE_NODES_COMMAND, timeout=HEADSCALE_NODES_TIMEOUT_SECONDS)
    output = (result.stdout or "").strip()
    if not domain or not result.success or not output.startswith("["):
        return {"tailnet": "", "peers": []}
    peers: List[Dict[str, Any]] = [peer for peer in (_headscale_peer(node, domain) for node in json.loads(output)) if peer]
    return {"tailnet": domain, "peers": peers}


def _read_tailscale_peers() -> Dict[str, Any]:
    result = Commander.run_args(TAILSCALE_STATUS_COMMAND, timeout=TAILSCALE_STATUS_TIMEOUT_SECONDS)
    output = (result.stdout or "").strip()
    if not result.success or not output.startswith("{"):
        return {"tailnet": "", "peers": []}
    status = json.loads(output)
    current = status.get("CurrentTailnet") if isinstance(status.get("CurrentTailnet"), dict) else {}
    tailnet = str(current.get("MagicDNSSuffix") or status.get("MagicDNSSuffix") or "").rstrip(".").lower()
    nodes = [(status.get("Self"), True)] + [(node, False) for node in (status.get("Peer") or {}).values()]
    peers: List[Dict[str, Any]] = [peer for peer in (_peer(node, is_self, tailnet) for node, is_self in nodes) if peer]
    return {"tailnet": tailnet, "peers": peers}


def read_tailnet_peers() -> Dict[str, Any]:
    """{tailnet, peers:[{dnsName, hostName, os, online, self}]} of this machine's tailnet (Tailscale first, then its Headscale)."""
    document = _read_tailscale_peers()
    return document if document["peers"] else _read_headscale_peers()


def current_tailnet_document() -> Dict[str, Any]:
    """The live tailnet document of the active mesh provider (Tailscale or Headscale); empty without one. Cached briefly."""
    now = time.monotonic()
    if _tailnet_document_cache["at"] and now - _tailnet_document_cache["at"] < TAILNET_DOMAIN_CACHE_SECONDS:
        return _tailnet_document_cache["document"]
    _tailnet_document_cache.update(at=now, document=read_tailnet_peers())
    return _tailnet_document_cache["document"]


def current_tailnet_domain() -> str:
    """Live MagicDNS domain of the active mesh provider (Tailscale or Headscale); '' without one."""
    return current_tailnet_document()["tailnet"]


def tailnet_server_hosts(document: Dict[str, Any]) -> List[str]:
    """DNS names of the machines of one tailnet document that can serve an API (phones excluded)."""
    client_only = tailnet_client_only_os()
    return [
        str(peer["dnsName"])
        for peer in document.get("peers") or []
        if str(peer.get("os") or "").lower() not in client_only
    ]


__all__ = ["current_tailnet_document", "current_tailnet_domain", "read_tailnet_peers", "tailnet_server_hosts"]
