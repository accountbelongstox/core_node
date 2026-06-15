#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cohere AI client implementation.

Cohere provides LLMs with free tier access.
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party import get_third_package_requests


class CohereClient:
    """Cohere API client for text generation."""

    def __init__(self, api_key: str, default_model: str = "command-r-plus"):
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = "https://api.cohere.com/v1"

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        """
        Generate chat completion using Cohere API.

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

        # Cohere uses different message format - convert to chat_history
        chat_history = []
        for msg in messages[:-1]:
            if msg.get("role") == "user":
                chat_history.append({"role": "USER", "message": msg.get("content", "")})
            elif msg.get("role") == "assistant":
                chat_history.append({"role": "CHATBOT", "message": msg.get("content", "")})

        message = messages[-1].get("content", "") if messages else ""

        try:
            response = requests.post(
                f"{self.base_url}/chat",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": use_model,
                    "message": message,
                    "chat_history": chat_history,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()

            text = data.get("text", "")
            if text:
                return {
                    "success": True,
                    "text": text,
                    "model": use_model,
                    "provider": "cohere",
                    "error": None,
                }
            else:
                return {
                    "success": False,
                    "text": "",
                    "model": use_model,
                    "provider": "cohere",
                    "error": "No text in response",
                }
        except Exception as e:
            return {
                "success": False,
                "text": "",
                "model": use_model,
                "provider": "cohere",
                "error": str(e),
            }

    def list_models(self) -> List[str]:
        """List models from Cohere API when the key is valid."""
        requests = get_third_package_requests()
        try:
            resp = requests.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            models = data.get("models") or data.get("data") or []
            ids = [m.get("name") or m.get("id", "") for m in models if isinstance(m, dict)]
            return [i for i in ids if i]
        except Exception:
            return []
