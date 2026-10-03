# -*- coding: utf-8 -*-
"""K7 gate shared by every pycore HTTP server (``client_key_auth.local_rpc``).

- The bind host is loopback unless the LAN bind setting is on (K7a).
- A loopback caller needs a loopback ``Host`` header (DNS rebinding) and, when
  it is a browser (``Origin`` present), an allowed dashboard origin or a
  private-LAN origin (echoed for CORS like the LAN path).
- A non-loopback caller on a private LAN address (RFC 1918, link-local,
  tailnet CGNAT, ULA; ``private_lan_networks``) needs no key: it must name a
  private/loopback ``Host`` and, when it is a browser, a private/loopback
  ``Origin``, which is echoed back for CORS (never a wildcard).
- Any other non-loopback caller (public address) needs a valid K3 client-key
  signature; a private caller whose request fails the LAN rule may still
  present one.
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
LAN_BIND_HOST = contract_host("any")
DASHBOARD_ORIGIN_PORTS = (contract_port("nexus_dash_frontend"), contract_port("pycore_backend"))
DASHBOARD_UI_PORT_ENV = "PYCORE_UI_PORT"
ORIGIN_SCHEMES = ("http", "https")
LAN_BIND_SETTING_KEY = "rpcLanBind"
ERROR_HOST_FORBIDDEN = str(LOCAL_RPC_CONTRACT["error_codes"]["host_forbidden"])
ERROR_ORIGIN_FORBIDDEN = str(LOCAL_RPC_CONTRACT["error_codes"]["origin_forbidden"])
PRIVATE_LAN_NETWORKS = tuple(ipaddress.ip_network(str(network)) for network in LOCAL_RPC_CONTRACT["private_lan_networks"])
PRIVATE_LAN_HOST_SUFFIXES = tuple(str(suffix).lower() for suffix in LOCAL_RPC_CONTRACT["private_lan_host_suffixes"])
CORS_ALLOWED_METHODS = tuple(str(method) for method in LOCAL_RPC_CONTRACT["cors_allowed_methods"])
CORS_ALLOWED_HEADERS = tuple(str(name) for name in LOCAL_RPC_CONTRACT["cors_allowed_headers"])
CORS_MAX_AGE_SECONDS = int(LOCAL_RPC_CONTRACT["cors_max_age_seconds"])
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
    or str(LOCAL_RPC_CONTRACT.get("private_lan_rule")) != "open"
    or LOCAL_RPC_CONTRACT.get("cors_wildcard_with_credentials") is not False
    or not PRIVATE_LAN_NETWORKS
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


def _host_header_name(host_header: str) -> str:
    value = str(host_header or "").strip().lower()
    if value.startswith("["):
        hostname = value[1:value.find("]")] if "]" in value else ""
    elif value.count(":") == 1:
        hostname = value.split(":", 1)[0]
    else:
        hostname = value
    return _hostname(hostname)


def host_header_is_loopback(host_header: str) -> bool:
    return _host_header_name(host_header) in LOOPBACK_HOSTS


def is_private_lan_peer(address: Any) -> bool:
    """True for a private LAN address (``private_lan_networks``); IPv4-mapped IPv6 is unwrapped."""
    parsed = _ip_address(str(address or "").strip().split("%", 1)[0])
    if parsed is None:
        return False
    mapped = getattr(parsed, "ipv4_mapped", None)
    parsed = mapped if mapped is not None else parsed
    return any(parsed.version == network.version and parsed in network for network in PRIVATE_LAN_NETWORKS)


def _hostname_is_lan(hostname: str) -> bool:
    """Loopback or private LAN host: an IP literal inside the LAN networks, a
    single-label or LAN-suffixed name; a public name or address is not."""
    name = _hostname(hostname)
    if not name:
        return False
    if name in LOOPBACK_HOSTS or is_loopback_peer(name) or is_private_lan_peer(name):
        return True
    if _ip_address(name) is not None:
        return False
    return "." not in name or any(name.endswith(f".{suffix}") for suffix in PRIVATE_LAN_HOST_SUFFIXES)


def host_header_is_lan(host_header: str) -> bool:
    return _hostname_is_lan(_host_header_name(host_header))


def origin_is_lan(origin: str) -> bool:
    try:
        parts = urlsplit(str(origin or "").strip())
        hostname = parts.hostname or ""
    except ValueError as exc:
        ColorPrint.gray(f"[LocalRpcGuard] unparsable origin {origin!r}: {exc}")
        return False
    return parts.scheme.lower() in ORIGIN_SCHEMES and _hostname_is_lan(hostname)


def origin_is_private_lan_host(origin: str) -> bool:
    """A private-LAN browser origin that is not itself a loopback host."""
    if not origin_is_lan(origin):
        return False
    return _hostname(urlsplit(str(origin).strip()).hostname or "") not in LOOPBACK_HOSTS


def lan_bind_enabled() -> bool:
    settings = user_data_store.get_section(USER_DATA_SECTION_SYSTEM_SETTINGS) or {}
    return settings.get(LAN_BIND_SETTING_KEY) is True


def resolve_bind_host(requested: str) -> str:
    """Loopback unless the LAN bind setting is on; with it, a loopback request
    binds every interface (LAN callers still need K3) and any other host stays."""
    host = str(requested or "").strip() or LOOPBACK_BIND_HOST
    if lan_bind_enabled():
        return LAN_BIND_HOST if host.lower() in LOOPBACK_HOSTS else host
    if host.lower() in LOOPBACK_HOSTS:
        return host
    ColorPrint.yellow(
        f"[local_rpc] bind {host} needs the LAN bind setting "
        f"(system settings {LAN_BIND_SETTING_KEY}=true, e.g. "
        f"`pyservice config system set --key {LAN_BIND_SETTING_KEY} --value true`); "
        f"binding {LOOPBACK_BIND_HOST}"
    )
    return LOOPBACK_BIND_HOST


def _decision(
    allowed: bool, status: int = 0, error_code: str = "", origin: str = "", echo_cors: bool = False
) -> Dict[str, Any]:
    return {"allowed": allowed, "status": status, "error_code": error_code, "origin": origin, "echo_cors": echo_cors}


def _private_lan_decision(headers: Mapping[str, str], origin: str) -> Dict[str, Any]:
    if not host_header_is_lan(str(headers.get("host") or "")):
        return _decision(False, STATUS_FORBIDDEN, ERROR_HOST_FORBIDDEN)
    if origin and not origin_is_lan(origin):
        return _decision(False, STATUS_FORBIDDEN, ERROR_ORIGIN_FORBIDDEN)
    return _decision(True, origin=origin, echo_cors=bool(origin))


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
        if not origin or origin in origins or normalize_origin(origin) in origins:
            return _decision(True, origin=origin)
        if origin_is_private_lan_host(origin):
            return _decision(True, origin=origin, echo_cors=True)
        return _decision(False, STATUS_FORBIDDEN, ERROR_ORIGIN_FORBIDDEN)
    lan_decision = _private_lan_decision(headers, origin) if is_private_lan_peer(peer) else None
    if lan_decision is not None and lan_decision["allowed"]:
        return lan_decision
    result = verify_client_key()
    if result.get("ok"):
        return _decision(True)
    if lan_decision is not None:
        return lan_decision
    return _decision(False, STATUS_UNAUTHORIZED, str(result.get("error_code") or ""))


__all__ = [
    "CORS_ALLOWED_HEADERS",
    "CORS_ALLOWED_METHODS",
    "CORS_MAX_AGE_SECONDS",
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
    "is_private_lan_peer",
    "lan_bind_enabled",
    "resolve_bind_host",
]
