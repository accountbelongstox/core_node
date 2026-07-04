#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cerebras inference API client (OpenAI-compatible)."""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party import get_third_package_requests


class CerebrasClient:
    """Cerebras Cloud SDK-compatible REST client."""

    def __init__(self, api_key: str, default_model: str = "gpt-oss-120b"):
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = "https://api.cerebras.ai/v1"

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
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": use_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=90,
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices", [])
            if choices:
                text = (choices[0].get("message") or {}).get("content", "")
                return {"success": bool(text), "text": text, "model": use_model, "error": None}
            return {"success": False, "text": "", "model": use_model, "error": "No choices in response"}
        except Exception as e:
            return {"success": False, "text": "", "model": use_model, "error": str(e)}

    def list_models(self) -> List[str]:
        requests = get_third_package_requests()
        try:
            resp = requests.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            return [m.get("id", "") for m in data if m.get("id")]
        except Exception:
            return []
