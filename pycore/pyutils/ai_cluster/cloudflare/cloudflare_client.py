#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cloudflare Workers AI client (REST run endpoint)."""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.secret_manager import get_secret_key, get_secret_key_indexed
from pycore.pyfoundations.third_party.api import get_third_package_requests


class CloudflareAIClient:
    """Workers AI via accounts/{id}/ai/v1/chat/completions (OpenAI-compatible)."""

    def __init__(
        self,
        api_token: str,
        account_id: str,
        default_model: str = "@cf/meta/llama-3-8b-instruct",
    ):
        self.api_token = api_token
        self.account_id = account_id
        self.default_model = default_model
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1"
        self.last_error: Optional[str] = None

    @classmethod
    def from_secrets(cls, default_model: str = "@cf/meta/llama-3-8b-instruct") -> "CloudflareAIClient":
        token = get_secret_key_indexed("CLOUDFLARE_API_TOKEN") or get_secret_key("CLOUDFLARE_API_TOKEN")
        acct = get_secret_key("CLOUDFLARE_ACCOUNT_ID") or get_secret_key_indexed("CLOUDFLARE_ACCOUNT_ID")
        return cls(api_token=token or "", account_id=acct or "", default_model=default_model)

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        requests = get_third_package_requests()
        use_model = model or self.default_model
        if not self.api_token or not self.account_id:
            return {"success": False, "text": "", "model": use_model, "error": "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID"}
        try:
            resp = requests.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"},
                json={"model": use_model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
                timeout=90,
            )
            resp.raise_for_status()
            data = resp.json()
            result = data.get("result") or data
            choices = result.get("choices", [])
            if choices:
                text = (choices[0].get("message") or {}).get("content", "")
                if text:
                    return {"success": True, "text": text, "model": use_model, "error": None}
            self.last_error = "No text in response"
            return {"success": False, "text": "", "model": use_model, "error": self.last_error}
        except Exception as e:
            self.last_error = str(e)
            return {"success": False, "text": "", "model": use_model, "error": self.last_error}

    def list_models(self) -> List[str]:
        return ["@cf/meta/llama-3-8b-instruct", "@cf/meta/llama-3.1-8b-instruct", "@cf/qwen/qwen1.5-14b-chat-awq"]
