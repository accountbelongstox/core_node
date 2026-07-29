#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OpenAI-compatible chat client shared by most LLM providers."""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party.api import get_third_package_requests


class OpenAICompatClient:
    """Minimal OpenAI-compatible REST client (chat + models list)."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        default_model: str = "",
        provider: str = "",
        extra_headers: Optional[Dict[str, str]] = None,
    ):
        self.api_key = api_key
        self.base_url = (base_url or "").rstrip("/")
        self.default_model = default_model
        self.provider = provider
        self.extra_headers = extra_headers or {}
        self.last_error: Optional[str] = None

    def _headers(self) -> Dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        h.update(self.extra_headers)
        return h

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        requests = get_third_package_requests()
        use_model = model or self.default_model
        try:
            resp = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": use_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=90,
            )
            if resp.status_code == 401:
                self.last_error = "HTTP 401 — invalid API key"
                return self._fail(use_model, self.last_error)
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                text = (choices[0].get("message") or {}).get("content", "")
                if text:
                    return {
                        "success": True,
                        "text": text,
                        "model": use_model,
                        "provider": self.provider,
                        "error": None,
                    }
            self.last_error = "No text in response"
            return self._fail(use_model, self.last_error)
        except Exception as e:
            self.last_error = str(e)
            return self._fail(use_model, self.last_error)

    def _fail(self, model: str, error: str) -> Dict[str, Any]:
        return {
            "success": False,
            "text": "",
            "model": model,
            "provider": self.provider,
            "error": error,
        }

    def list_models(self) -> List[str]:
        requests = get_third_package_requests()
        self.last_error = None
        try:
            resp = requests.get(
                f"{self.base_url}/models",
                headers={k: v for k, v in self._headers().items() if k != "Content-Type"},
                timeout=20,
            )
            if resp.status_code in (401, 403):
                self.last_error = f"HTTP {resp.status_code} — key invalid or forbidden"
                return []
            resp.raise_for_status()
            data = resp.json().get("data", [])
            return [m.get("id", "") for m in data if isinstance(m, dict) and m.get("id")]
        except Exception as e:
            self.last_error = str(e)
            return []
