# -*- coding: utf-8 -*-
"""Bearer authentication for the CodeSync workspace exchange."""

from __future__ import annotations

import hmac
import os
import secrets
import threading
from pathlib import Path

from pycore.pyutils.codesync.file_operations import atomic_write_bytes
from pycore.pyutils.codesync.runtime import get_local_data_dir


AUTHENTICATION_SCHEME = "Bearer"
TOKEN_FILE_NAME = "workspace.token"
TOKEN_BYTES = 32


class _WorkspaceTokenProvider:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._token = ""

    def get(self) -> str:
        with self._lock:
            if self._token:
                return self._token
            token_path = self._token_path()
            if token_path.is_file():
                token = token_path.read_text(encoding="utf-8").strip()
                if token:
                    if os.name == "posix":
                        os.chmod(token_path, 0o600)
                    self._token = token
                    return token
            token = secrets.token_urlsafe(TOKEN_BYTES)
            atomic_write_bytes(token_path, f"{token}\n".encode("utf-8"))
            if os.name == "posix":
                os.chmod(token_path, 0o600)
            self._token = token
            return token

    @staticmethod
    def _token_path() -> Path:
        return get_local_data_dir() / "codesync" / TOKEN_FILE_NAME


_workspace_token_provider = _WorkspaceTokenProvider()


def get_workspace_token() -> str:
    return _workspace_token_provider.get()


def workspace_authorized(authorization: str) -> bool:
    scheme, separator, credential = str(authorization or "").strip().partition(" ")
    if not separator or scheme.lower() != AUTHENTICATION_SCHEME.lower():
        return False
    return hmac.compare_digest(
        credential.strip().encode("utf-8"),
        get_workspace_token().encode("utf-8"),
    )


__all__ = [
    "AUTHENTICATION_SCHEME",
    "get_workspace_token",
    "workspace_authorized",
]
