# -*- coding: utf-8 -*-
from typing import Any, Dict

from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_DELIVERY

LARAVEL_HEALTH_SERVICE = "Laravel API"
# Laravel server identity (W7 contract, config/queue_center_contract.json
# #delivery.server_identity): ``/api/health`` answers a stable ``server_id``;
# an API response may carry it in LARAVEL_SERVER_ID_HEADER. Delivery state is
# namespaced per server id; an endpoint whose server id is unknown (legacy
# server) is namespaced by URL.
_SERVER_IDENTITY = QUEUE_CENTER_DELIVERY["server_identity"]
LARAVEL_SERVER_ID_FIELD = str(_SERVER_IDENTITY["body_field"])
LARAVEL_SERVER_ID_HEADER = str(_SERVER_IDENTITY["header"])
SERVER_NAMESPACE_PREFIX = "server:"
URL_NAMESPACE_PREFIX = "url:"


def laravel_server_namespace(server_id: str, base_url: str) -> str:
    """Delivery namespace of one Laravel server: its stable id when known,
    otherwise the endpoint URL (legacy servers without an id)."""
    server_id = str(server_id or "").strip()
    if server_id:
        return SERVER_NAMESPACE_PREFIX + server_id
    return URL_NAMESPACE_PREFIX + str(base_url or "").strip().rstrip("/")


def parse_laravel_server_identity(body: Any) -> Dict[str, str]:
    """``{server_id}`` from a health body ('' for a legacy server)."""
    body = body if isinstance(body, dict) else {}
    return {"server_id": str(body.get(LARAVEL_SERVER_ID_FIELD) or "").strip()}


__all__ = [
    "LARAVEL_SERVER_ID_HEADER",
    "SERVER_NAMESPACE_PREFIX",
    "URL_NAMESPACE_PREFIX",
    "laravel_server_namespace",
    "parse_laravel_server_identity",
]
