# -*- coding: utf-8 -*-
"""K7 gate shared by every pycore HTTP server (``client_key_auth.local_rpc``).

- The bind host is loopback unless the LAN bind setting is on (K7a).
- A loopback caller needs a loopback ``Host`` header (DNS rebinding) and, when
  it is a browser (``Origin`` present), an allowed dashboard origin.
- A non-loopback caller needs a valid K3 client-key signature. Browsers never
  sign, so remote browsers manage pycore through the relay only.
"""

import ipaddress
import os
import re
from urllib.parse import urlsplit
from typing import Any, Callable, Dict, FrozenSet, Iterable, Mapping, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.service_contract import host as contract_host
from pycore.pyfoundations.service_contract import port as contract_port
from pycore.pyfoundations.service_contract import value as contract_value
from pycore.pyutils.common.user_data_store import USER_DATA_SECTION_SYSTEM_SETTINGS, user_data_store

LOCAL_RPC_CONTRACT: Dict[str, Any] = contract_value("client_key_auth.local_rpc")
LOOPBACK_HOSTS: FrozenSet[str] = frozenset(
    contract_host(str(name)).lower() for name in LOCAL_RPC_CONTRACT["loopback_hosts"]
)
LOOPBACK_BIND_HOST = contract_host("loopback")
DASHBOARD_ORIGIN_PORTS = (contract_port("nexus_dash_frontend"), contract_port("pycore_backend"))
DASHBOARD_UI_PORT_ENV = "PYCORE_UI_PORT"
ORIGIN_SCHEMES = ("http", "https")
LAN_BIND_SETTING_KEY = "rpcLanBind"
ERROR_HOST_FORBIDDEN = str(LOCAL_RPC_CONTRACT["error_codes"]["host_forbidden"])
ERROR_ORIGIN_FORBIDDEN = str(LOCAL_RPC_CONTRACT["error_codes"]["origin_forbidden"])
ERROR_BODY_TOO_LARGE = "local_rpc_body_too_large"
# Largest body a non-loopback caller may send; it is buffered before K3
# verification, so an unsigned LAN peer can never make pycore hold more.
NON_LOOPBACK_BODY_MAX_BYTES = 256 * 1024 * 1024
STATUS_UNAUTHORIZED = 401
STATUS_FORBIDDEN = 403
STATUS_PAYLOAD_TOO_LARGE = 413

if (
    str(LOCAL_RPC_CONTRACT.get("bind_default")) != "loopback"
    or str(LOCAL_RPC_CONTRACT.get("non_loopback_rule")) != "client_key_required"
    or LOCAL_RPC_CONTRACT.get("cors_wildcard_with_credentials") is not False
):
    raise ValueError("client_key_auth.local_rpc does not match the K7 gate")


def _origin_host(hostname: str) -> str:
    return f"[{hostname}]" if ":" in hostname else hostname


def _hostname(value: str) -> str:
    """Lower-case host name with ONE trailing dot removed (``localhost.`` is
    ``localhost``), the same normalization as ncore's gate."""
    name = str(value or "").strip().lower()
    return name[:-1] if name.endswith(".") else name


def normalize_origin(origin: str) -> str:
    """``scheme://host:port`` of a browser Origin with the host normalized."""
    value = str(origin or "").strip()
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError as exc:
        ColorPrint.gray(f"[LocalRpcGuard] unparsable origin {value!r}: {exc}")
        return value
    if not parts.scheme or not parts.hostname:
        return value
    host = _origin_host(_hostname(parts.hostname))
    return f"{parts.scheme.lower()}://{host}:{port}" if port is not None else f"{parts.scheme.lower()}://{host}"


def _ui_port() -> Optional[int]:
    """The dashboard port pycore's own launcher exported (pyservice -UiPort)."""
    value = str(os.environ.get(DASHBOARD_UI_PORT_ENV) or "").strip()
    return int(value) if value.isdigit() else None


def allowed_origins(extra_ports: Iterable[int] = ()) -> FrozenSet[str]:
    """Loopback host keys x dashboard ports (contract), plus caller ports."""
    ports = {*DASHBOARD_ORIGIN_PORTS, *(int(port) for port in extra_ports)}
    if _ui_port() is not None:
        ports.add(_ui_port())
    return frozenset(
        f"{scheme}://{_origin_host(hostname)}:{port}"
        for scheme in ORIGIN_SCHEMES
        for hostname in LOOPBACK_HOSTS
        for port in ports
    )


_IP_LITERAL_CHARS = re.compile(r"[0-9A-Fa-f:.%]+")


def _ip_address(value: str) -> Optional[Any]:
    """Parsed IP address, or None for host names (screened without parsing)."""
    if not _IP_LITERAL_CHARS.fullmatch(value or ""):
        return None
    try:
        return ipaddress.ip_address(value)
    except ValueError as exc:
        ColorPrint.gray(f"[LocalRpcGuard] {value!r} is not an IP address: {exc}")
        return None


def is_loopback_peer(address: Any) -> bool:
    text = str(address or "").strip().lower()
    if text in LOOPBACK_HOSTS:
        return True
    parsed = _ip_address(text)
    if parsed is None:
        return False
    mapped = getattr(parsed, "ipv4_mapped", None)
    return bool(parsed.is_loopback or (mapped is not None and mapped.is_loopback))


def host_header_is_loopback(host_header: str) -> bool:
    value = str(host_header or "").strip().lower()
    if value.startswith("["):
        hostname = value[1:value.find("]")] if "]" in value else ""
    elif value.count(":") == 1:
        hostname = value.split(":", 1)[0]
    else:
        hostname = value
    return _hostname(hostname) in LOOPBACK_HOSTS


def lan_bind_enabled() -> bool:
    settings = user_data_store.get_section(USER_DATA_SECTION_SYSTEM_SETTINGS) or {}
    return settings.get(LAN_BIND_SETTING_KEY) is True


def resolve_bind_host(requested: str) -> str:
    """Loopback unless the LAN bind setting admits the requested host."""
    host = str(requested or "").strip() or LOOPBACK_BIND_HOST
    if host.lower() in LOOPBACK_HOSTS or lan_bind_enabled():
        return host
    ColorPrint.yellow(
        f"[local_rpc] bind {host} needs the LAN bind setting "
        f"(system settings {LAN_BIND_SETTING_KEY}=true, e.g. "
        f"`pyservice config system set --key {LAN_BIND_SETTING_KEY} --value true`); "
        f"binding {LOOPBACK_BIND_HOST}"
    )
    return LOOPBACK_BIND_HOST


def _decision(allowed: bool, status: int = 0, error_code: str = "", origin: str = "") -> Dict[str, Any]:
    return {"allowed": allowed, "status": status, "error_code": error_code, "origin": origin}


def evaluate_request(
    peer: Any,
    headers: Mapping[str, str],
    origins: FrozenSet[str],
    verify_client_key: Callable[[], Dict[str, Any]],
) -> Dict[str, Any]:
    """K7 decision for one request; ``headers`` keys are lower-case.

    ``origin`` in the result is the allowed browser origin (for CORS), or ''.
    """
    origin = str(headers.get("origin") or "").strip()
    if is_loopback_peer(peer):
        if not host_header_is_loopback(str(headers.get("host") or "")):
            return _decision(False, STATUS_FORBIDDEN, ERROR_HOST_FORBIDDEN)
        if origin and origin not in origins and normalize_origin(origin) not in origins:
            return _decision(False, STATUS_FORBIDDEN, ERROR_ORIGIN_FORBIDDEN)
        return _decision(True, origin=origin)
    result = verify_client_key()
    if result.get("ok"):
        return _decision(True)
    return _decision(False, STATUS_UNAUTHORIZED, str(result.get("error_code") or ""))


__all__ = [
    "ERROR_BODY_TOO_LARGE",
    "ERROR_HOST_FORBIDDEN",
    "ERROR_ORIGIN_FORBIDDEN",
    "LAN_BIND_SETTING_KEY",
    "LOOPBACK_BIND_HOST",
    "NON_LOOPBACK_BODY_MAX_BYTES",
    "STATUS_PAYLOAD_TOO_LARGE",
    "allowed_origins",
    "evaluate_request",
    "host_header_is_loopback",
    "is_loopback_peer",
    "lan_bind_enabled",
    "resolve_bind_host",
]
