# -*- coding: utf-8 -*-
"""
Live tailnet machine list from ``tailscale status --json`` - the same document
(TailnetPeersDocument) the UI server answers at ``/tailnet_peers.json``, so a
client (e.g. a compiled phone app, which cannot list the tailnet itself) can
discover every machine from any reachable machine that runs pycore.

Without Tailscale (binary missing, logged out, timeout) the list is empty.
"""

import json
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.commander import Commander

TAILSCALE_STATUS_COMMAND = ["tailscale", "status", "--json"]
TAILSCALE_STATUS_TIMEOUT_SECONDS = 4


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


def read_tailnet_peers() -> Dict[str, Any]:
    """{tailnet, peers:[{dnsName, hostName, os, online, self}]} of this machine's tailnet."""
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


__all__ = ["read_tailnet_peers"]
