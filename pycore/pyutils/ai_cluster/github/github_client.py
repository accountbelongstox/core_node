#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitHub Models inference client.

Official endpoints (2026):
  Catalog : GET  https://models.github.ai/catalog/models
  Chat    : POST https://models.github.ai/inference/chat/completions

Legacy Azure URL (models.inference.ai.azure.com) no longer exposes a /models
listing — probe returned empty and surfaced "No models returned".

Token: GitHub PAT with ``models:read`` (fine-grained) or classic PAT for free tier.
See https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.third_party.api import get_third_package_requests

_DEFAULT_INFERENCE_BASE = "https://models.github.ai/inference"
_DEFAULT_CATALOG_URL = "https://models.github.ai/catalog/models"
_GITHUB_API_VERSION = "2022-11-28"


def _inference_base_url() -> str:
    """Optional override via GITHUB_MODELS_BASE_URL secret (no trailing slash)."""
    custom = (get_secret_key("GITHUB_MODELS_BASE_URL") or "").strip().rstrip("/")
    return custom or _DEFAULT_INFERENCE_BASE


class GitHubModelsClient:
    """Client for GitHub Models marketplace inference."""

    def __init__(self, api_key: str, default_model: str = "openai/gpt-4.1"):
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = _inference_base_url()
        self.catalog_url = _DEFAULT_CATALOG_URL
        self.last_error: Optional[str] = None

    def _headers(self, json_body: bool = False) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": _GITHUB_API_VERSION,
        }
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

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
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(json_body=True),
                json={
                    "model": use_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=90,
            )
            if response.status_code == 401:
                self.last_error = "HTTP 401 — token invalid or missing models:read scope"
                return {"success": False, "text": "", "model": use_model, "error": self.last_error}
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices", [])
            if choices:
                text = (choices[0].get("message") or {}).get("content", "")
                return {"success": bool(text), "text": text, "model": use_model, "error": None}
            self.last_error = "No choices in response"
            return {"success": False, "text": "", "model": use_model, "error": self.last_error}
        except Exception as e:
            self.last_error = str(e)
            return {"success": False, "text": "", "model": use_model, "error": self.last_error}

    def list_models(self) -> List[str]:
        """List model ids from GitHub Models catalog."""
        requests = get_third_package_requests()
        self.last_error = None
        try:
            resp = requests.get(
                self.catalog_url,
                headers=self._headers(),
                timeout=20,
            )
            if resp.status_code == 401:
                self.last_error = (
                    "HTTP 401 — GitHub PAT invalid or missing models:read permission "
                    "(create at github.com/settings/tokens)"
                )
                return []
            if resp.status_code == 403:
                self.last_error = "HTTP 403 — token lacks GitHub Models access"
                return []
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                ids = [m.get("id", "") for m in data if isinstance(m, dict) and m.get("id")]
                if ids:
                    return ids
            self.last_error = "Catalog returned no model ids"
            return []
        except Exception as e:
            self.last_error = str(e)
            return []

    def validate_token(self) -> bool:
        """True when catalog listing succeeds (cheap, no inference spend)."""
        return bool(self.list_models())
