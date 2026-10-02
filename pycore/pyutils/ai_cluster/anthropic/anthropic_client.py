# -*- coding: utf-8 -*-
"""Anthropic Messages API client (its wire format is not OpenAI-compatible)."""

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import HttpConnectError, HttpError, RESPONSE_LLM, http_client, redacted_http_error
from pycore.pyutils.ai_cluster.openai_compat.openai_compat_client import ERROR_STYLE_REQUESTS, status_text, transport_text

BASE_URL = "https://api.anthropic.com/v1"
API_VERSION = "2023-06-01"
LIST_TIMEOUT_S = 20.0
DEFAULT_MAX_TOKENS = 1024
ERROR_BODY_CHARS = 300
ERROR_NO_TEXT = "Empty response from provider"

_TRANSPORT_ERRORS = (HttpError, ValueError)


class AnthropicClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": API_VERSION,
            "Content-Type": "application/json",
        }

    def list_models(self) -> Tuple[List[str], Optional[str]]:
        try:
            response = http_client.get(f"{BASE_URL}/models", timeout=LIST_TIMEOUT_S, headers=self._headers())
            data = response.json() if response.ok else None
        except _TRANSPORT_ERRORS as exc:
            ColorPrint.yellow(f"[anthropic] list models failed: {redacted_http_error(exc)}")
            return [], transport_text(exc, ERROR_STYLE_REQUESTS)
        if data is None:
            # The historical requests-style probe text ("401 Client Error: ...").
            return [], status_text(response, ERROR_STYLE_REQUESTS)
        return [str(row.get("id")) for row in data.get("data") or [] if row.get("id")], None

    def messages(
        self,
        turns: List[Dict[str, Any]],
        model: str,
        system: Optional[str] = None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> Dict[str, Any]:
        """``{success, text, error, provider_reached}`` for one Messages call."""
        body: Dict[str, Any] = {"model": model, "max_tokens": max_tokens, "messages": turns}
        if system:
            body["system"] = system
        out: Dict[str, Any] = {"success": False, "text": "", "error": None, "provider_reached": False}
        try:
            response = http_client.post(f"{BASE_URL}/messages", json=body, headers=self._headers(), response=RESPONSE_LLM)
            data = response.json() if response.ok else None
        except _TRANSPORT_ERRORS as exc:
            out["error"] = redacted_http_error(exc)
            out["provider_reached"] = not isinstance(exc, HttpConnectError)
            ColorPrint.yellow(f"[anthropic] messages call failed: {out['error']}")
            return out
        out["provider_reached"] = True
        if data is None:
            out["error"] = f"HTTP {response.status_code}: {response.text[:ERROR_BODY_CHARS]}"
            return out
        out["text"] = "".join(
            str(block.get("text") or "")
            for block in data.get("content") or []
            if block.get("type") == "text"
        )
        out["success"] = bool(out["text"])
        if not out["success"]:
            out["error"] = ERROR_NO_TEXT
        return out


__all__ = ["AnthropicClient"]
