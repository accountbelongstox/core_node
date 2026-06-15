#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HuggingFace Inference Providers client (OpenAI-compatible).

Uses router.huggingface.co — the legacy api-inference.huggingface.co endpoint
was retired and no longer resolves.
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party import get_third_package_requests


class HuggingFaceClient:
    """HuggingFace Inference Providers client for chat completions."""

    def __init__(self, api_key: str, default_model: str = "meta-llama/Llama-3.1-8B-Instruct"):
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = "https://router.huggingface.co/v1"

    def validate_token(self) -> bool:
        """Cheap key check via HuggingFace whoami (no inference spend)."""
        requests = get_third_package_requests()
        try:
            resp = requests.get(
                "https://huggingface.co/api/whoami-v2",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=15,
            )
            return resp.status_code == 200
        except Exception:
            return False

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
                if text:
                    return {
                        "success": True,
                        "text": text,
                        "model": use_model,
                        "provider": "huggingface",
                        "error": None,
                    }
            return {
                "success": False,
                "text": "",
                "model": use_model,
                "provider": "huggingface",
                "error": "No text in response",
            }
        except Exception as e:
            return {
                "success": False,
                "text": "",
                "model": use_model,
                "provider": "huggingface",
                "error": str(e),
            }

    def list_models(self) -> List[str]:
        """No public catalog endpoint — caller should use ai_keys catalog_models."""
        return []
