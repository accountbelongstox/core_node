# -*- coding: utf-8 -*-
"""Persistent Ed25519 device identity and Relay V2 request signing."""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
import uuid
from typing import Any, Dict, Mapping

from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyfoundations.third_party.api import (
    get_third_package_cryptography_ed25519,
    get_third_package_cryptography_serialization,
)
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract


RELAY_IDENTITY_FILE_NAME = "pycore_relay_v2_identity.json"
RELAY_IDENTITY_STORE = AtomicJsonStore(
    APP_CONFIG_DIR / RELAY_IDENTITY_FILE_NAME,
    lambda: {},
)
RELAY_KEY_VERSION_INITIAL = 1


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _base64url_decode(value: str) -> bytes:
    text = str(value or "")
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _positive_int(value: Any, default: int = 0) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return int(default)
    return parsed if parsed > 0 else int(default)


class RelayDeviceIdentity:
    """Own independently repairable device, key, enrollment, and credential state."""

    def ensure_device_id(self) -> str:
        document = RELAY_IDENTITY_STORE.read()
        device_id = str(document.get("device_id") or "")
        if device_id:
            relay_activity_log.debug("identity.device_id.present", device_id=device_id)
            return device_id
        device_id = str(uuid.uuid4())
        document["device_id"] = device_id
        self._write(document)
        relay_activity_log.success("identity.device_id.created", device_id=device_id)
        return device_id

    def ensure_signing_key(self) -> str:
        document = RELAY_IDENTITY_STORE.read()
        private_key = str(document.get("private_key") or "")
        public_key = str(document.get("public_key") or "")
        ed25519 = get_third_package_cryptography_ed25519()
        serialization = get_third_package_cryptography_serialization()
        if private_key:
            try:
                private_bytes = _base64url_decode(private_key)
                if len(private_bytes) != 32:
                    raise ValueError("relay_private_key_length_invalid")
                existing = ed25519.Ed25519PrivateKey.from_private_bytes(
                    private_bytes
                )
                public_bytes = existing.public_key().public_bytes(
                    encoding=serialization.Encoding.Raw,
                    format=serialization.PublicFormat.Raw,
                )
                derived_public_key = _base64url_encode(public_bytes)
                key_version = _positive_int(
                    document.get("key_version"),
                    _positive_int(
                        document.get("credential_version"),
                        RELAY_KEY_VERSION_INITIAL,
                    ),
                )
                repaired = public_key != derived_public_key or (
                    _positive_int(document.get("key_version")) != key_version
                )
                if repaired:
                    document["public_key"] = derived_public_key
                    document["key_version"] = key_version
                    self._write(document)
                    relay_activity_log.success(
                        "identity.signing_key.metadata.repaired",
                        key_version=key_version,
                    )
                else:
                    self._repair_permissions()
                    relay_activity_log.debug(
                        "identity.signing_key.present",
                        key_version=key_version,
                    )
                return derived_public_key
            except Exception as error:
                relay_activity_log.error(
                    "identity.signing_key.private.invalid",
                    key_version=document.get("key_version"),
                    error_type=type(error).__name__,
                    error=error,
                )
        generated = ed25519.Ed25519PrivateKey.generate()
        private_bytes = generated.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_bytes = generated.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        previous_key_version = _positive_int(document.get("key_version"))
        credential_version = _positive_int(document.get("credential_version"))
        next_key_version = (
            max(previous_key_version, credential_version) + 1
            if private_key or public_key
            else RELAY_KEY_VERSION_INITIAL
        )
        credential_invalidated = bool(
            document.get("credential_id") or document.get("enrollment_id")
        )
        document["private_key"] = _base64url_encode(private_bytes)
        document["public_key"] = _base64url_encode(public_bytes)
        document["key_version"] = next_key_version
        document.pop("credential_id", None)
        document.pop("credential_version", None)
        document.pop("enrollment_id", None)
        document.pop("enrollment_claim_code", None)
        document.pop("enrollment_expires_at", None)
        self._write(document)
        relay_activity_log.success(
            (
                "identity.signing_key.rotated"
                if private_key or public_key
                else "identity.signing_key.created"
            ),
            key_version=next_key_version,
            credential_invalidated=credential_invalidated,
        )
        return str(document["public_key"])

    def ensure(self) -> Dict[str, Any]:
        self.ensure_device_id()
        self.ensure_signing_key()
        self.ensure_enrollment_state()
        self.ensure_credential_state()
        document = self.document()
        relay_activity_log.success(
            "identity.ready",
            device_id=document["device_id"],
            key_version=document["key_version"],
        )
        return document

    def ensure_enrollment_state(self) -> bool:
        document = RELAY_IDENTITY_STORE.read()
        enrollment_fields = (
            str(document.get("enrollment_id") or ""),
            str(document.get("enrollment_claim_code") or ""),
            str(document.get("enrollment_expires_at") or ""),
        )
        if all(enrollment_fields):
            relay_activity_log.debug(
                "identity.enrollment.present",
                enrollment_id=enrollment_fields[0],
                claim_code=enrollment_fields[1],
                expires_at=enrollment_fields[2],
            )
            return True
        if any(enrollment_fields):
            self.clear_enrollment()
            relay_activity_log.warning("identity.enrollment.incomplete.repaired")
        return False

    def ensure_credential_state(self) -> bool:
        document = RELAY_IDENTITY_STORE.read()
        credential_id = str(document.get("credential_id") or "")
        credential_version = _positive_int(document.get("credential_version"))
        if credential_id and credential_version > 0:
            relay_activity_log.debug(
                "identity.credential.present",
                credential_id=credential_id,
                credential_version=credential_version,
            )
            return True
        if credential_id or document.get("credential_version") is not None:
            self.clear_credential()
            relay_activity_log.warning("identity.credential.incomplete.repaired")
        return False

    @staticmethod
    def document() -> Dict[str, Any]:
        return RELAY_IDENTITY_STORE.read()

    def device_id(self) -> str:
        return str(self.ensure_device_id())

    def key_version(self) -> int:
        document = RELAY_IDENTITY_STORE.read()
        return _positive_int(
            document.get("key_version"),
            RELAY_KEY_VERSION_INITIAL,
        )

    def public_key(self) -> str:
        return self.ensure_signing_key()

    def credential_id(self) -> str:
        return str(RELAY_IDENTITY_STORE.read().get("credential_id") or "")

    def has_credential(self) -> bool:
        return self.ensure_credential_state()

    def save_enrollment(
        self,
        enrollment_id: str,
        claim_code: str,
        expires_at: str,
    ) -> None:
        document = RELAY_IDENTITY_STORE.read()
        document["enrollment_id"] = str(enrollment_id)
        document["enrollment_claim_code"] = str(claim_code)
        document["enrollment_expires_at"] = str(expires_at)
        self._write(document)
        relay_activity_log.success(
            "identity.enrollment.saved",
            device_id=document.get("device_id"),
            enrollment_id=enrollment_id,
            claim_code=claim_code,
            expires_at=expires_at,
        )

    def save_credential(self, credential_id: str, credential_version: int) -> None:
        if not str(credential_id) or int(credential_version) <= 0:
            raise ValueError("relay_credential_incomplete")
        document = RELAY_IDENTITY_STORE.read()
        document["credential_id"] = str(credential_id)
        document["credential_version"] = int(credential_version)
        document.pop("enrollment_id", None)
        document.pop("enrollment_claim_code", None)
        document.pop("enrollment_expires_at", None)
        self._write(document)
        relay_activity_log.success(
            "identity.credential.saved",
            device_id=document.get("device_id"),
            credential_id=credential_id,
            credential_version=credential_version,
        )

    def clear_enrollment(self) -> None:
        document = RELAY_IDENTITY_STORE.read()
        document.pop("enrollment_id", None)
        document.pop("enrollment_claim_code", None)
        document.pop("enrollment_expires_at", None)
        self._write(document)
        relay_activity_log.warning(
            "identity.enrollment.cleared",
            device_id=document.get("device_id"),
        )

    def clear_credential(self) -> None:
        document = RELAY_IDENTITY_STORE.read()
        document.pop("credential_id", None)
        document.pop("credential_version", None)
        self._write(document)
        relay_activity_log.warning(
            "identity.credential.cleared",
            device_id=document.get("device_id"),
        )

    def enrollment_id(self) -> str:
        return str(RELAY_IDENTITY_STORE.read().get("enrollment_id") or "")

    def descriptor(self, label: str, platform_name: str) -> Dict[str, Any]:
        document = self.ensure()
        capabilities = relay_contract.capabilities()
        capability_digest = hashlib.sha256(
            "\n".join(sorted(capabilities)).encode("utf-8")
        ).hexdigest()
        return {
            "device_id": str(document["device_id"]),
            "label": str(label),
            "platform": str(platform_name),
            "public_key": str(document["public_key"]),
            "key_algorithm": "ed25519",
            "key_version": int(document["key_version"]),
            "contract_digest": relay_contract.digest,
            "capability_digest": capability_digest,
            "capabilities": capabilities,
        }

    def signed_headers(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any],
        body: bytes,
    ) -> Dict[str, str]:
        document = self.ensure()
        timestamp = str(int(time.time()))
        nonce = secrets.token_urlsafe(24)
        content_sha256 = hashlib.sha256(body).hexdigest()
        normalized_method = str(method or "GET").upper()
        normalized_path = relay_contract.canonical_path(path)
        normalized_query = relay_contract.canonical_query(query)
        credential_version = int(
            document.get("credential_version") or document["key_version"]
        )
        canonical = "\n".join(
            (
                relay_contract.protocol_version,
                str(credential_version),
                normalized_method,
                normalized_path,
                normalized_query,
                str(document["device_id"]),
                timestamp,
                nonce,
                content_sha256,
            )
        ).encode("utf-8")
        ed25519 = get_third_package_cryptography_ed25519()
        private_key = ed25519.Ed25519PrivateKey.from_private_bytes(
            _base64url_decode(str(document["private_key"]))
        )
        signature = _base64url_encode(private_key.sign(canonical))
        headers = {
            relay_contract.signature_header("protocol"): relay_contract.protocol_version,
            relay_contract.signature_header("device_id"): str(document["device_id"]),
            relay_contract.signature_header("credential_version"): str(credential_version),
            relay_contract.signature_header("timestamp"): timestamp,
            relay_contract.signature_header("nonce"): nonce,
            relay_contract.signature_header("content_sha256"): content_sha256,
            relay_contract.signature_header("signature"): signature,
        }
        credential_id = str(document.get("credential_id") or "")
        if credential_id:
            headers[relay_contract.signature_header("credential_id")] = credential_id
        relay_activity_log.debug(
            "identity.request.signed",
            device_id=document["device_id"],
            method=normalized_method,
            path=normalized_path,
            query=normalized_query,
            body_length=len(body),
            content_sha256=content_sha256,
            credential_version=credential_version,
        )
        return headers

    @staticmethod
    def _write(document: Dict[str, Any]) -> None:
        RELAY_IDENTITY_STORE.write(document)
        RelayDeviceIdentity._repair_permissions()

    @staticmethod
    def _repair_permissions() -> None:
        if os.name != "nt":
            os.chmod(RELAY_IDENTITY_STORE.path, 0o600)


relay_device_identity = RelayDeviceIdentity()


__all__ = ["relay_device_identity"]
