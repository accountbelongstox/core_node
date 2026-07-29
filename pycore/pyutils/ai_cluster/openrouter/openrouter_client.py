#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenRouter API Client

Provides interface to OpenRouter API for accessing multiple AI models.
OpenRouter routes requests to the best provider for each model.

Features:
- Chat completions with multiple models
- Streaming responses
- Automatic API key management
- Support for DeepSeek R1T2 Chimera and other models

Usage:
    from pycore.pyutils.ai_cluster.openrouter.openrouter_client import get_openrouter_client

    client = get_openrouter_client()
    response = client.chat_completion(
        messages=[{"role": "user", "content": "Hello!"}],
        model="tngtech/deepseek-r1t2-chimera:free"
    )
    print(response['choices'][0]['message']['content'])
"""

import json
from typing import Dict, Any, Optional, List, Iterator, Callable

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider

requests = get_third_package_requests()


class OpenRouterClient:
    """
    OpenRouter API Client

    Provides access to OpenRouter's API for multiple AI models.

    API Documentation: https://openrouter.ai/docs
    """

    # API endpoint
    BASE_URL = "https://openrouter.ai/api/v1"

    # Popular models
    MODELS = {
        # DeepSeek models
        'deepseek-r1t2-chimera': 'tngtech/deepseek-r1t2-chimera:free',
        'deepseek-r1': 'deepseek/deepseek-r1',
        'deepseek-v3': 'deepseek/deepseek-v3',

        # OpenAI models
        'gpt-4o': 'openai/gpt-4o',
        'gpt-4o-mini': 'openai/gpt-4o-mini',
        'gpt-4-turbo': 'openai/gpt-4-turbo',
        'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',

        # Anthropic models
        'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
        'claude-3-opus': 'anthropic/claude-3-opus',
        'claude-3-haiku': 'anthropic/claude-3-haiku',

        # Google models
        'gemini-pro': 'google/gemini-pro',
        'gemini-flash': 'google/gemini-flash',

        # Meta models
        'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct',
        'llama-3.1-405b': 'meta-llama/llama-3.1-405b-instruct',

        # Free Models Router — https://openrouter.ai/docs/guides/routing/routers/free-router
        'free': 'openrouter/free',
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        site_url: Optional[str] = None,
        site_name: Optional[str] = None
    ):
        """
        Initialize OpenRouter client

        Args:
            api_key: OpenRouter API key (if None, loads from secret manager)
            site_url: Your site URL for rankings (optional)
            site_name: Your site name for rankings (optional)
        """
        # Load API key from secret manager if not provided.
        # Global indexed loader: OPENROUTER_API_KEY_1.._5 then bare (never hardcode _1).
        if api_key is None:
            api_key = get_secret_key_indexed("OPENROUTER_API_KEY")

        if not api_key:
            ColorPrint.yellow("[OpenRouterClient] No API key provided")
            ColorPrint.yellow("[OpenRouterClient] Set OPENROUTER_API_KEY_1 in secret manager")

        self.api_key = api_key
        self.site_url = site_url or "https://core-node.local"
        self.site_name = site_name or "Core Node"

        # Check requests availability
        if requests is None:
            ColorPrint.red("[OpenRouterClient] requests library not available")
            ColorPrint.yellow("[OpenRouterClient] Install with: pip install requests")

    def _build_headers(self) -> Dict[str, str]:
        """Build request headers"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if self.site_url:
            headers["HTTP-Referer"] = self.site_url

        if self.site_name:
            headers["X-Title"] = self.site_name

        return headers

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 1.0,
        max_tokens: Optional[int] = None,
        top_p: float = 1.0,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a chat completion

        Args:
            messages: List of message dicts with 'role' and 'content'
                     Example: [{"role": "user", "content": "Hello!"}]
            model: Model ID (default: deepseek-r1t2-chimera:free)
                  Can use short name from MODELS dict or full model ID
            temperature: Sampling temperature (0.0 - 2.0)
            max_tokens: Maximum tokens to generate
            top_p: Nucleus sampling parameter
            stream: Enable streaming response
            **kwargs: Additional parameters for the API

        Returns:
            Dict: API response with completion result
        """
        if requests is None:
            ColorPrint.red("[OpenRouterClient] requests library not available")
            return {'error': 'requests library not available'}

        if not self.api_key:
            ColorPrint.red("[OpenRouterClient] No API key configured")
            return {'error': 'No API key configured'}

        # Resolve model name
        if model is None:
            model = self.MODELS['free']
        elif model in self.MODELS:
            model = self.MODELS[model]

        # Build request payload
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "stream": stream,
            **kwargs
        }

        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        # Make request
        try:
            response = requests.post(
                url=f"{self.BASE_URL}/chat/completions",
                headers=self._build_headers(),
                json=payload,
                stream=stream,
                timeout=60
            )

            response.raise_for_status()

            if stream:
                return response
            else:
                return response.json()

        except Exception as e:
            ColorPrint.red(f"[OpenRouterClient] Request failed: {e}")
            return {'error': str(e)}

    def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        on_chunk: Optional[Callable[[str], None]] = None,
        **kwargs
    ) -> Iterator[str]:
        """
        Create a streaming chat completion

        Args:
            messages: List of message dicts
            model: Model ID
            on_chunk: Optional callback for each chunk
            **kwargs: Additional parameters

        Yields:
            str: Content chunks as they arrive
        """
        response = self.chat_completion(
            messages=messages,
            model=model,
            stream=True,
            **kwargs
        )

        if isinstance(response, dict) and 'error' in response:
            yield response['error']
            return

        # Parse SSE stream
        for line in response.iter_lines():
            if not line:
                continue

            line = line.decode('utf-8')

            if line.startswith('data: '):
                data = line[6:]  # Remove 'data: ' prefix

                if data == '[DONE]':
                    break

                try:
                    chunk = json.loads(data)
                    delta = chunk.get('choices', [{}])[0].get('delta', {})
                    content = delta.get('content', '')

                    if content:
                        if on_chunk:
                            on_chunk(content)
                        yield content

                except json.JSONDecodeError:
                    continue

    def _extract_message_content(self, message: Dict[str, Any]) -> str:
        """
        Extract content from message, handling special model formats

        DeepSeek R1T2 Chimera and similar reasoning models put content in 'reasoning' field.

        Args:
            message: Message dict from API response

        Returns:
            str: Extracted content
        """
        # Try standard content field
        content = message.get('content', '')

        # If empty, try reasoning field (for DeepSeek R1T2 Chimera and similar models)
        if not content:
            reasoning = message.get('reasoning', '')
            if reasoning:
                content = reasoning

        # If still empty, try reasoning_details
        if not content:
            reasoning_details = message.get('reasoning_details', [])
            if reasoning_details and isinstance(reasoning_details, list):
                # Concatenate all reasoning text
                texts = [detail.get('text', '') for detail in reasoning_details if detail.get('text')]
                content = ''.join(texts)

        return content

    def chat(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Simple chat interface (non-streaming)

        Args:
            prompt: User prompt
            model: Model ID
            system_prompt: Optional system prompt
            **kwargs: Additional parameters

        Returns:
            str: Assistant's response text
        """
        messages = []

        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })

        messages.append({
            "role": "user",
            "content": prompt
        })

        response = self.chat_completion(messages=messages, model=model, **kwargs)

        if 'error' in response:
            return f"Error: {response['error']}"

        message = response.get('choices', [{}])[0].get('message', {})
        return self._extract_message_content(message)

    def chat_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        on_chunk: Optional[Callable[[str], None]] = None,
        **kwargs
    ) -> str:
        """
        Simple chat interface with streaming

        Args:
            prompt: User prompt
            model: Model ID
            system_prompt: Optional system prompt
            on_chunk: Optional callback for each chunk
            **kwargs: Additional parameters

        Returns:
            str: Complete assistant response
        """
        messages = []

        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })

        messages.append({
            "role": "user",
            "content": prompt
        })

        full_response = []

        for chunk in self.chat_completion_stream(
            messages=messages,
            model=model,
            on_chunk=on_chunk,
            **kwargs
        ):
            full_response.append(chunk)

        return ''.join(full_response)

    def get_models(self) -> Dict[str, str]:
        """
        Get available model shortcuts

        Returns:
            Dict: Model name -> Model ID mapping
        """
        return self.MODELS.copy()

    def list_models(self) -> List[str]:
        """List live model ids from OpenRouter (free-tier first)."""
        if not self.api_key or requests is None:
            return []
        try:
            resp = requests.get(
                f"{self.BASE_URL}/models",
                headers=self._build_headers(),
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            ids = [m.get("id", "") for m in data if m.get("id")]
            if "openrouter/free" in ids:
                rest = [i for i in ids if i != "openrouter/free"]
                return ["openrouter/free"] + rest
            free = [i for i in ids if i.endswith(":free")]
            rest = [i for i in ids if not i.endswith(":free")]
            return free + rest
        except Exception as e:
            ColorPrint.yellow(f"[OpenRouterClient] list_models failed: {e}")
            return []

    def list_available_models(self) -> List[str]:
        """
        List all available model shortcuts

        Returns:
            List[str]: Available model shortcuts
        """
        return list(self.MODELS.keys())


_OPENROUTER_CLIENT_PROVIDER = SerializedSingletonProvider(
    OpenRouterClient,
    "openrouter.client.provider",
    "OpenRouterClientProvider",
)


def get_openrouter_client(
    api_key: Optional[str] = None,
    site_url: Optional[str] = None,
    site_name: Optional[str] = None
) -> OpenRouterClient:
    """
    Get global OpenRouter client singleton

    Args:
        api_key: OpenRouter API key (optional, loads from secret manager)
        site_url: Site URL for rankings (optional)
        site_name: Site name for rankings (optional)

    Returns:
        OpenRouterClient: Global client instance
    """
    return _OPENROUTER_CLIENT_PROVIDER.get(
        api_key=api_key,
        site_url=site_url,
        site_name=site_name,
    )

openrouter_client = get_openrouter_client()
