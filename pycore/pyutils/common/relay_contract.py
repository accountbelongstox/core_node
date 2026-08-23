# -*- coding: utf-8 -*-
"""Versioned machine-readable contract for Pycore Relay V2."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List

from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.service_contract import build_url, service_domain


RELAY_CONTRACT_PATH = (
    get_core_node_root() / "config" / "pycore_relay_contract.json"
).resolve()
RELAY_CONTRACT_REQUIRED_SECTIONS = (
    "signature_profile",
    "endpoints",
    "topics",
    "events",
    "durations",
    "limits",
    "headers",
    "route_policies",
)


class RelayContract:
    """Load, validate, and expose Relay configuration without local defaults."""

    def __init__(self, path: Path = RELAY_CONTRACT_PATH) -> None:
        self.path = path.resolve()
        self.raw_bytes = self.path.read_bytes()
        document = json.loads(self.raw_bytes.decode("utf-8"))
        if not isinstance(document, dict):
            raise ValueError("Relay contract root must be an object")
        for section in RELAY_CONTRACT_REQUIRED_SECTIONS:
            if section not in document:
                raise ValueError(f"Relay contract section is required: {section}")
        if int(document.get("schema_version") or 0) != 2:
            raise ValueError("Relay contract schema_version must be 2")
        self.document: Dict[str, Any] = document
        self.digest = hashlib.sha256(self.raw_bytes).hexdigest()

    @property
    def protocol_version(self) -> str:
        return str(self.document["protocol_version"])

    def endpoint(self, name: str, **tokens: Any) -> str:
        template = str(self.document["endpoints"].get(name) or "")
        if not template:
            raise KeyError(f"Relay endpoint is not defined: {name}")
        return template.format(**{key: str(value) for key, value in tokens.items()})

    def topic(self, name: str, **tokens: Any) -> str:
        template = str(self.document["topics"].get(name) or "")
        if not template:
            raise KeyError(f"Relay topic is not defined: {name}")
        resolved_tokens = {
            "laravel_api_origin": build_url("https", service_domain("laravel_api")),
            **{key: str(value) for key, value in tokens.items()},
        }
        return template.format(**resolved_tokens)

    def event(self, name: str) -> str:
        value = str(self.document["events"].get(name) or "")
        if not value:
            raise KeyError(f"Relay event is not defined: {name}")
        return value

    def duration(self, name: str) -> float:
        return float(self.document["durations"][name])

    def limit(self, name: str) -> int:
        return int(self.document["limits"][name])

    def signature_header(self, name: str) -> str:
        headers = self.document["signature_profile"]["headers"]
        value = str(headers.get(name) or "")
        if not value:
            raise KeyError(f"Relay signature header is not defined: {name}")
        return value

    def allowed_headers(self, direction: str) -> List[str]:
        values = self.document["headers"][f"{direction}_allow"]
        return [str(value).lower() for value in values]

    def capabilities(self) -> List[str]:
        return [str(value) for value in self.document.get("capabilities") or []]

    def route_policy(self, path: str, method: str) -> Dict[str, Any]:
        normalized_path = str(path or "").strip().strip("/")
        normalized_method = str(method or "GET").upper()
        for item in self.document["route_policies"]:
            methods = {str(value).upper() for value in item.get("methods") or []}
            if normalized_method not in methods:
                continue
            match_kind = str(item.get("match") or "exact")
            raw_match_value = str(item.get("value") or "").strip()
            match_value = (
                raw_match_value.strip("/")
                if match_kind == "exact"
                else raw_match_value.lstrip("/")
                if match_kind == "prefix"
                else raw_match_value.rstrip("/")
                if match_kind == "suffix"
                else raw_match_value
            )
            matched = (
                normalized_path == match_value
                if match_kind == "exact"
                else normalized_path.startswith(match_value)
                if match_kind == "prefix"
                else normalized_path.endswith(match_value)
                if match_kind == "suffix"
                else False
            )
            if matched:
                return dict(item)
        return {
            "match": "default",
            "value": normalized_path,
            "methods": [normalized_method],
            "exposure": "denied",
            "retry": "at_most_once_action",
        }


relay_contract = RelayContract()
relay_activity_log.success(
    "contract.loaded",
    path=relay_contract.path,
    schema_version=relay_contract.document["schema_version"],
    protocol_version=relay_contract.protocol_version,
    contract_digest=relay_contract.digest,
)


__all__ = ["RelayContract", "relay_contract"]
