from __future__ import annotations

import json
from pathlib import Path
from typing import Any

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


def laravel_api_catalog_urls(mesh_domain_value: str = "") -> tuple[str, ...]:
    """The Laravel API endpoint catalog, in the UI's order (LaravelEndpoints.ts
    getBuiltInEndpoints): every root domain's api domain, then the service URL
    entries. Plain-http host:port presets are not part of it."""
    domains = value("access.root_domains")
    urls = [
        build_url("https", service_domain("laravel_api", root_domain_index=index))
        for index in range(len(domains) if isinstance(domains, list) else 0)
    ]
    urls.extend(entry["url"].rstrip("/") for entry in service_url_entries(mesh_domain_value))
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
