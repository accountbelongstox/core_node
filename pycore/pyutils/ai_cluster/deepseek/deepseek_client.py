#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeepSeek API Client

DeepSeek exposes an OpenAI-API-compatible endpoint, so this client wraps the
official ``openai`` SDK with ``base_url=https://api.deepseek.com``. The same
request/response shapes as OpenAI apply (chat.completions, models.list).

API key is read from the common secret manager (key name: DEEPSEEK_API_KEY_1,
falling back to DEEPSEEK_API_KEY). The OpenAI-compatible key is sent as the
Bearer token.

Usage:
    from pycore.pyutils.deepseek import get_deepseek_client

    client = get_deepseek_client()
    text = client.chat("Hello!")            # simple one-shot chat
    models = client.list_models()["models"] # available model ids
"""

import time
from typing import Dict, Any, Optional, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party.api import get_third_package_openai
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)


class DeepSeekClient:
    """
    DeepSeek API client (OpenAI-compatible).

    API Documentation: https://api-docs.deepseek.com
    """

    # OpenAI-compatible base URL for DeepSeek
    BASE_URL = "https://api.deepseek.com"

    # Common DeepSeek models (chat + reasoner)
    DEFAULT_MODEL = "deepseek-chat"

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None,
                 default_model: str = DEFAULT_MODEL):
        """
        Initialize DeepSeek client.

        Args:
            api_key: DeepSeek API key (if None, loads from secret manager).
            base_url: Override the OpenAI-compatible base URL (optional).
            default_model: Default model id (default: deepseek-chat).
        """
        if api_key is None:
            # Global indexed loader: DEEPSEEK_API_KEY_1.._5 then bare (never hardcode _1).
            api_key = get_secret_key_indexed("DEEPSEEK_API_KEY")

        if not api_key:
            ColorPrint.yellow("[DeepSeekClient] No API key provided")
            ColorPrint.yellow("[DeepSeekClient] Set DEEPSEEK_API_KEY_1 in secret manager")

        self.api_key = api_key
        self.base_url = base_url or self.BASE_URL
        self.default_model = default_model
        self._client = None
        init_serialized_owner(
            self,
            "deepseek.client.state",
            "DeepSeekClientState",
            timeout=300.0,
        )

    def _get_client(self):
        """Lazy-init the underlying OpenAI SDK client pointed at DeepSeek."""
        if self._client is None:
            openai = get_third_package_openai()
            self._client = openai.OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    @serialized_method
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 1.0,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a chat completion (OpenAI-compatible).

        Returns a plain dict: {"success", "text", "model", "processing_time", "error"}.
        """
        start_time = time.time()
        result = {"success": False, "text": "", "model": model or self.default_model,
                  "processing_time": 0.0, "error": ""}

        if not self.api_key:
            result["error"] = "No API key configured"
            return result

        try:
            client = self._get_client()
            resp = client.chat.completions.create(
                model=result["model"],
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            if resp and resp.choices:
                result["success"] = True
                result["text"] = resp.choices[0].message.content or ""
            else:
                result["error"] = "Empty response from API"
        except Exception as e:
            result["error"] = str(e)

        result["processing_time"] = time.time() - start_time
        return result

    @serialized_method
    def chat(self, prompt: str, model: Optional[str] = None,
             system_prompt: Optional[str] = None, **kwargs) -> str:
        """Simple one-shot chat. Returns the assistant text (or 'Error: ...')."""
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        result = self.chat_completion(messages=messages, model=model, **kwargs)
        if result.get("error"):
            return f"Error: {result['error']}"
        return result.get("text", "")

    @serialized_method
    def list_models(self) -> Dict[str, Any]:
        """
        List available DeepSeek model ids via the OpenAI-compatible /models endpoint.

        Returns: {"success": bool, "models": List[str], "error": str}.
        """
        result = {"success": False, "models": [], "error": ""}

        if not self.api_key:
            result["error"] = "No API key configured"
            return result

        try:
            client = self._get_client()
            resp = client.models.list()
            result["success"] = True
            result["models"] = [m.id for m in resp.data]
        except Exception as e:
            result["error"] = str(e)

        return result


_DEEPSEEK_CLIENT_PROVIDER = SerializedSingletonProvider(
    DeepSeekClient,
    "deepseek.client.provider",
    "DeepSeekClientProvider",
)


def get_deepseek_client(api_key: Optional[str] = None,
                        base_url: Optional[str] = None) -> DeepSeekClient:
    """Get the global DeepSeek client singleton (loads key from secret manager)."""
    return _DEEPSEEK_CLIENT_PROVIDER.get(api_key=api_key, base_url=base_url)


__all__ = ['DeepSeekClient', 'get_deepseek_client']
