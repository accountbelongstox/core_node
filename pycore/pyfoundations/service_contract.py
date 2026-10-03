from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit

SERVICE_CONTRACT_PATH = Path(__file__).resolve().parents[2] / "config" / "service_contract.json"
SERVICE_CONTRACT: dict[str, Any] = json.loads(SERVICE_CONTRACT_PATH.read_text(encoding="utf-8"))


def value(contract_path: str) -> Any:
    current: Any = SERVICE_CONTRACT

    for segment in contract_path.split("."):
        if not isinstance(current, dict) or segment not in current:
            raise KeyError(f"Unknown service contract value: {contract_path}")
        current = current[segment]

    return current


def host(name: str) -> str:
    resolved = value(f"hosts.{name}")
    if not isinstance(resolved, str) or not resolved:
        raise ValueError(f"Invalid service contract host: {name}")
    return resolved


def port(name: str) -> int:
    resolved = value(f"ports.{name}")
    if not isinstance(resolved, int) or resolved < 1:
        raise ValueError(f"Invalid service contract port: {name}")
    return resolved


def path_value(name: str) -> str:
    resolved = value(f"paths.{name}")
    if not isinstance(resolved, str) or not resolved:
        raise ValueError(f"Invalid service contract path: {name}")
    return resolved


def path_values(name: str) -> tuple[str, ...]:
    resolved = value(f"paths.{name}")
    if not isinstance(resolved, list) or not resolved or not all(isinstance(item, str) and item for item in resolved):
        raise ValueError(f"Invalid service contract path list: {name}")
    return tuple(resolved)


def root_domain(index: int = 0) -> str:
    domains = value("access.root_domains")
    if not isinstance(domains, list) or index >= len(domains) or not isinstance(domains[index], str):
        raise ValueError(f"Invalid service contract root domain index: {index}")
    return domains[index]


def service_domain(name: str, replacements: dict[str, str] | None = None, root_domain_index: int = 0) -> str:
    labels = value(f"access.service_domains.{name}")
    resolved_replacements = replacements or {}
    default_region = value("access.default_api_region_prefix")
    resolved_labels: list[str] = []

    if not isinstance(labels, list) or not labels:
        raise ValueError(f"Invalid service contract domain: {name}")

    for label in labels:
        if not isinstance(label, str) or not label:
            raise ValueError(f"Invalid service contract domain label: {name}")
        if label.startswith("{") and label.endswith("}"):
            replacement_key = label[1:-1]
            resolved_labels.append(resolved_replacements.get(replacement_key, default_region))
        else:
            resolved_labels.append(label)

    return ".".join([*resolved_labels, root_domain(root_domain_index)])


MESH_DOMAIN_PLACEHOLDER = "{mesh_domain}"


def mesh_domain(provider: str = "", replacements: dict[str, str] | None = None) -> str:
    """MagicDNS domain of a mesh provider (default: access.mesh.provider_default);
    '' while a live-only label such as {tailnet} has no replacement."""
    mesh = value("access.mesh")
    settings = mesh[provider or mesh["provider_default"]]
    known = {
        "region": value("access.default_api_region_prefix"),
        "root": root_domain(int(settings.get("root_domain_index", 0))),
        **(replacements or {}),
    }
    resolved_labels: list[str] = []

    for label in settings["domain_labels"]:
        if label.startswith("{") and label.endswith("}"):
            label = known.get(label[1:-1], "")
            if not label:
                return ""
        resolved_labels.append(label)

    return ".".join(resolved_labels)


_DNS_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"


def _mesh_label_pattern(label: str) -> str:
    if label == "{root}":
        return "(?:" + "|".join(re.escape(str(domain)) for domain in value("access.root_domains")) + ")"
    if label.startswith("{") and label.endswith("}"):
        return _DNS_LABEL
    return re.escape(label)


@lru_cache(maxsize=1)
def _tailnet_host_patterns() -> tuple:
    """``[api.]<machine>.<tailnet domain>`` for every mesh provider's domain template
    (the same matcher as poly_apps/pycore_laravel_wordnew_ui/core/contracts/MeshDomain.ts)."""
    api_label = re.escape(str(value("access.tailnet.api_label")))
    patterns = []
    for settings in value("access.mesh").values():
        if not isinstance(settings, dict) or not settings.get("domain_labels"):
            continue
        domain = r"\.".join(_mesh_label_pattern(str(label)) for label in settings["domain_labels"])
        patterns.append(re.compile(f"^(?:{api_label}\\.)?{_DNS_LABEL}\\.({domain})$"))
    return tuple(patterns)


def tailnet_domain_of(hostname: str) -> str:
    """The tailnet domain of a ``[api.]<machine>.<tailnet domain>`` host of any mesh provider; '' otherwise."""
    host = str(hostname or "").strip().lower().rstrip(".")
    for pattern in _tailnet_host_patterns():
        match = pattern.match(host)
        if match:
            return match.group(1)
    return ""


def tailnet_machine_of(hostname: str) -> str:
    """``<machine>.<tailnet domain>`` of a mesh host (the api label removed); '' for a host outside every mesh domain."""
    host = str(hostname or "").strip().lower().rstrip(".")
    if not tailnet_domain_of(host):
        return ""
    api_prefix = f"{value('access.tailnet.api_label')}."
    return host[len(api_prefix):] if host.startswith(api_prefix) else host


def tailnet_api_url(machine_host: str) -> str:
    """Laravel main behind the mesh reverse proxy of one tailnet machine."""
    return build_url("https", machine_host, path=str(value("access.tailnet.api_path")))


def tailnet_client_only_os() -> frozenset:
    """Tailnet machines on these OSes (phones) never serve an API."""
    return frozenset(str(name).lower() for name in value("access.tailnet.client_only_os"))


def service_url_entries(mesh_domain_value: str = "") -> tuple[dict[str, str], ...]:
    """Contract URL entries; {mesh_domain} becomes the live tailnet domain, else the default provider's."""
    entries = value("access.service_url_entries")
    active_mesh_domain = mesh_domain_value or mesh_domain()
    resolved_entries: list[dict[str, str]] = []

    if not isinstance(entries, list):
        raise ValueError("Invalid service contract URL entries")

    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Invalid service contract URL entry")
        key = entry.get("key")
        label = entry.get("label")
        url = entry.get("url")
        if not all(isinstance(item, str) and item for item in (key, label, url)):
            raise ValueError("Invalid service contract URL entry fields")
        resolved_entries.append({"key": key, "label": label, "url": url.replace(MESH_DOMAIN_PLACEHOLDER, active_mesh_domain)})

    return tuple(resolved_entries)


def build_url(protocol: str, hostname: str, port_number: int | None = None, path: str = "") -> str:
    port_part = f":{port_number}" if port_number else ""
    path_part = f"/{path}" if path and not path.startswith("/") else path
    return f"{protocol}://{hostname}{port_part}{path_part}"


def laravel_api_catalog_urls(mesh_domain_value: str = "", mesh_machine_hosts: Iterable[str] = ()) -> tuple[str, ...]:
    """The Laravel API endpoint catalog, in the UI's order (LaravelEndpoints.ts
    getBuiltInEndpoints): every root domain's api domain, then the service URL
    entries, then every live mesh machine. A mesh service URL entry is listed
    only while its machine is among the live ``mesh_machine_hosts``; outside a
    mesh (none given) no mesh route is listed. Plain-http host:port presets are
    not part of it."""
    domains = value("access.root_domains")
    urls = [
        build_url("https", service_domain("laravel_api", root_domain_index=index))
        for index in range(len(domains) if isinstance(domains, list) else 0)
    ]
    live_machines = {str(host).strip().lower().rstrip(".") for host in mesh_machine_hosts if str(host).strip()}
    for entry in service_url_entries(mesh_domain_value):
        machine = tailnet_machine_of(urlsplit(entry["url"]).hostname or "")
        if not machine or machine in live_machines:
            urls.append(entry["url"].rstrip("/"))
    urls.extend(tailnet_api_url(machine) for machine in sorted(live_machines))
    return tuple(dict.fromkeys(urls))


def laravel_api_retired_host_urls() -> tuple[str, ...]:
    """The former plain-http catalog presets (service_host_keys.laravelApi on
    the backend port), purged from persisted endpoint lists."""
    host_keys = value("access.service_host_keys.laravelApi")
    backend_port = port("laravel_api_backend")
    return tuple(dict.fromkeys(
        build_url("http", host(str(key)), backend_port)
        for key in (host_keys if isinstance(host_keys, list) else [])
    ))
