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


def build_url(protocol: str, hostname: str, port_number: int | None = None, path: str = "") -> str:
    port_part = f":{port_number}" if port_number else ""
    path_part = f"/{path}" if path and not path.startswith("/") else path
    return f"{protocol}://{hostname}{port_part}{path_part}"
