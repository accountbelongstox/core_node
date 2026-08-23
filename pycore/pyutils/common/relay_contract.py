# -*- coding: utf-8 -*-
"""Versioned machine-readable contract for Pycore Relay V2."""

from __future__ import annotations

import hashlib
import json
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Mapping

from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.service_contract import build_url, service_domain


RELAY_CONTRACT_PATH = (
    get_core_node_root() / "config" / "pycore_relay_contract.json"
).resolve()
RELAY_CONTRACT_REQUIRED_SECTIONS = (
    "signature_profile",
    "request_digest_profile",
    "response_digest_profile",
    "endpoints",
    "topics",
    "events",
    "mercure_profile",
    "lease_profile",
    "durations",
    "limits",
    "headers",
    "operation_states",
    "operation_transitions",
    "transition_guards",
    "result_outcomes",
    "route_policy_profiles",
    "route_policies",
)
RELAY_ROUTE_PROFILE_REQUIRED_FIELDS = (
    "exposure",
    "permission",
    "payload",
    "timeout_seconds",
    "retry",
)
RELAY_LEASE_RESPONSE_REQUIRED_FIELDS = {
    "state",
    "revision",
    "claim_epoch",
    "server_time",
    "lease_expires_at",
}


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
        lease_profile = document["lease_profile"]
        if not isinstance(lease_profile, dict):
            raise ValueError("Relay lease_profile must be an object")
        if str(lease_profile.get("timestamp_format") or "") != (
            "rfc3339-with-required-offset"
        ):
            raise ValueError("Relay lease timestamp format is invalid")
        for response_name in (
            "execution_start_response_fields",
            "renew_response_fields",
        ):
            fields = {
                str(value)
                for value in lease_profile.get(response_name) or []
            }
            if not RELAY_LEASE_RESPONSE_REQUIRED_FIELDS.issubset(fields):
                raise ValueError(
                    f"Relay lease response fields are incomplete: {response_name}"
                )
        profiles = document["route_policy_profiles"]
        if not isinstance(profiles, dict):
            raise ValueError("Relay route_policy_profiles must be an object")
        for policy in document["route_policies"]:
            profile_name = str(policy.get("profile") or "")
            profile = profiles.get(profile_name)
            if not isinstance(profile, dict):
                raise ValueError(
                    f"Relay route policy profile is required: {profile_name}"
                )
            for field in RELAY_ROUTE_PROFILE_REQUIRED_FIELDS:
                if field not in profile:
                    raise ValueError(
                        f"Relay route profile field is required: "
                        f"{profile_name}.{field}"
                    )
                if field in policy and policy[field] != profile[field]:
                    raise ValueError(
                        f"Relay route policy conflicts with profile: "
                        f"{policy.get('value')}.{field}"
                    )
        states = {str(value) for value in document["operation_states"]}
        transition_states = {
            str(value) for value in document["operation_transitions"]
        }
        if states != transition_states:
            raise ValueError("Relay operation transitions must cover every state")
        for source, targets in document["operation_transitions"].items():
            unknown_targets = {str(value) for value in targets}.difference(states)
            if unknown_targets:
                raise ValueError(
                    f"Relay transition target is unknown: {source}"
                )
        lease_seconds = float(document["durations"]["operation_lease_seconds"])
        renew_seconds = float(
            document["durations"]["operation_lease_renew_seconds"]
        )
        guard_seconds = float(
            document["durations"]["operation_lease_expiry_guard_seconds"]
        )
        if (
            renew_seconds <= 0
            or guard_seconds <= 0
            or lease_seconds <= renew_seconds + guard_seconds
        ):
            raise ValueError("Relay operation lease durations are invalid")
        if int(document["limits"]["terminal_screenshot_capture_batch"]) <= 0:
            raise ValueError("Relay terminal capture batch limit is invalid")
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

    def canonical_path(self, path: str) -> str:
        raw_path = str(path or "")
        if "?" in raw_path or "#" in raw_path:
            raise ValueError("relay_signature_path_query_fragment_forbidden")
        one_slash_path = "/" + raw_path.lstrip("/")
        decoded = urllib.parse.unquote_to_bytes(one_slash_path).decode("utf-8")
        safe = str(
            self.document["signature_profile"]["canonicalization"][
                "path_safe_characters"
            ]
        )
        return urllib.parse.quote(
            decoded,
            safe=safe,
            encoding="utf-8",
            errors="strict",
        )

    @staticmethod
    def canonical_query(query: Mapping[str, Any]) -> str:
        pairs = []
        for raw_key in sorted(query, key=lambda item: str(item)):
            key = str(raw_key)
            value = query[raw_key]
            if isinstance(value, (list, tuple)):
                pairs.extend((key, str(item)) for item in value)
            else:
                pairs.append((key, str(value)))
        pairs.sort(key=lambda item: (item[0], item[1]))
        return urllib.parse.urlencode(
            pairs,
            doseq=False,
            encoding="utf-8",
            errors="strict",
        )

    def transition_allowed(self, source: str, target: str) -> bool:
        transitions = self.document["operation_transitions"]
        return str(target) in {
            str(value) for value in transitions.get(str(source), [])
        }

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
                profile = dict(
                    self.document["route_policy_profiles"][str(item["profile"])]
                )
                return {**dict(item), **profile}
        denied = dict(self.document["route_policy_profiles"]["denied"])
        return {**denied, **{
            "match": "default",
            "value": normalized_path,
            "methods": [normalized_method],
            "profile": "denied",
        }}


relay_contract = RelayContract()
relay_activity_log.success(
    "contract.loaded",
    path=relay_contract.path,
    schema_version=relay_contract.document["schema_version"],
    protocol_version=relay_contract.protocol_version,
    contract_digest=relay_contract.digest,
)


__all__ = ["RelayContract", "relay_contract"]
