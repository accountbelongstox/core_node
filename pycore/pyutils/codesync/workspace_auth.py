# -*- coding: utf-8 -*-
"""Static authentication configuration for the CodeSync workspace exchange."""

from __future__ import annotations

from pycore.pyutils.common.http_auth import StaticBearerAuthenticator


WORKSPACE_SHARED_SECRET = (
    "cncs_6d7d35c797a143d49ce5a00c4479f4c9451f364395e347b6a981e3bc67bccf29"
)
WORKSPACE_AUTHENTICATOR = StaticBearerAuthenticator(
    WORKSPACE_SHARED_SECRET,
    realm="codesync-workspace",
)
WORKSPACE_AUTHENTICATION_CHALLENGE = WORKSPACE_AUTHENTICATOR.challenge


def workspace_authorized(authorization: str) -> bool:
    return WORKSPACE_AUTHENTICATOR.authenticate(authorization)


__all__ = [
    "WORKSPACE_AUTHENTICATION_CHALLENGE",
    "WORKSPACE_AUTHENTICATOR",
    "WORKSPACE_SHARED_SECRET",
    "workspace_authorized",
]
