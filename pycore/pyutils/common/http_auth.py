# -*- coding: utf-8 -*-
"""Reusable HTTP authorization helpers."""

from __future__ import annotations

import hmac


class StaticBearerAuthenticator:
    def __init__(self, secret: str, *, realm: str) -> None:
        normalized_secret = str(secret or "").strip()
        normalized_realm = str(realm or "").strip()
        if not normalized_secret:
            raise ValueError("A bearer secret is required")
        if not normalized_realm:
            raise ValueError("A bearer realm is required")
        self._secret = normalized_secret.encode("utf-8")
        self._scheme = "Bearer"
        self._challenge = f'{self._scheme} realm="{normalized_realm}"'

    @property
    def challenge(self) -> str:
        return self._challenge

    def authenticate(self, authorization: str) -> bool:
        scheme, separator, credential = str(authorization or "").strip().partition(" ")
        if not separator or scheme.lower() != self._scheme.lower():
            return False
        return hmac.compare_digest(
            credential.strip().encode("utf-8"),
            self._secret,
        )


__all__ = ["StaticBearerAuthenticator"]
