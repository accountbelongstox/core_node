#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NVIDIA NIM client implementation.

NVIDIA provides accelerated LLM inference via NIM microservices.
Uses OpenAI-compatible API format.
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party.api import get_third_package_requests


class NVIDIAClient:
    """NVIDIA NIM API client for text generation."""

    def __init__(self, api_key: str, default_model: str = "meta/llama-3.1-405b-instruct"):
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = "https://integrate.api.nvidia.com/v1"

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        """
        Generate chat completion using NVIDIA NIM API.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name (uses default if not specified)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate

        Returns:
            Dict with success, text, model, error fields
        """
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
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()

            choices = data.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                text = message.get("content", "")
                return {
                    "success": True,
                    "text": text,
                    "model": use_model,
                    "provider": "nvidia",
                    "error": None,
                }
            else:
                return {
                    "success": False,
                    "text": "",
                    "model": use_model,
                    "provider": "nvidia",
                    "error": "No choices in response",
                }
        except Exception as e:
            return {
                "success": False,
                "text": "",
                "model": use_model,
                "provider": "nvidia",
                "error": str(e),
            }

    def list_models(self) -> List[str]:
        """List available models from NVIDIA NIM API."""
        requests = get_third_package_requests()
        try:
            response = requests.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            return [m.get("id", "") for m in data.get("data", []) if m.get("id")]
        except Exception:
            return []
