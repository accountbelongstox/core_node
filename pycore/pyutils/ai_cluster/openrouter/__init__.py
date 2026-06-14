#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenRouter SDK

Python SDK for OpenRouter API - Access multiple AI models through a single API.

OpenRouter routes your requests to the best provider for each model, handling
fallbacks and rate limits automatically.

Features:
- Chat completions with 100+ AI models
- Streaming responses
- Automatic API key management
- Free models available (DeepSeek R1T2 Chimera, etc.)

Supported Models:
- DeepSeek R1T2 Chimera (free, 671B MoE)
- OpenAI GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- Anthropic Claude 3.5 Sonnet, Opus, Haiku
- Google Gemini Pro, Flash
- Meta Llama 3.3 70B, Llama 3.1 405B
- And many more...

Quick Start:
    from pycore.pyutils.openrouter_sdk import openrouter_client

    # Simple chat
    response = openrouter_client.chat(
        "What is the meaning of life?",
        model="deepseek-r1t2-chimera"
    )
    print(response)

    # Streaming chat
    response = openrouter_client.chat_stream(
        "Write a poem about AI",
        model="free",
        on_chunk=lambda chunk: print(chunk, end='', flush=True)
    )

    # Advanced chat completion
    response = openrouter_client.chat_completion(
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello!"}
        ],
        model="gpt-4o",
        temperature=0.7,
        max_tokens=1000
    )

Configuration:
    Set your OpenRouter API key in secret manager:
    - Key name: OPENROUTER_API_KEY
    - Get API key from: https://openrouter.ai/keys

    Or pass directly:
    client = get_openrouter_client(api_key="sk-or-v1-...")
"""

from pycore.pyutils.ai_cluster.openrouter.openrouter_client import (
    OpenRouterClient,
    get_openrouter_client
)
from pycore.pyutils.ai_cluster.openrouter.chat_session import (
    ChatSession,
    SessionState,
    list_free_models,
    _print_free_models_once
)

# Export singleton instance for convenience
openrouter_client = get_openrouter_client()

# Print free models once on first import
_print_free_models_once()

__all__ = [
    'OpenRouterClient',
    'get_openrouter_client',
    'openrouter_client',
    'ChatSession',
    'SessionState',
    'list_free_models',
]
