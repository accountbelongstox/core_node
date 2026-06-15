#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DeepSeek SDK (OpenAI-compatible)

Thin wrapper over the official ``openai`` SDK pointed at DeepSeek's
OpenAI-compatible endpoint (https://api.deepseek.com). API key is read from the
common secret manager (DEEPSEEK_API_KEY_1 / DEEPSEEK_API_KEY).

    from pycore.pyutils.deepseek import get_deepseek_client
    client = get_deepseek_client()
    print(client.chat("Hello!"))
"""

from pycore.pyutils.ai_cluster.deepseek.deepseek_client import (
    DeepSeekClient,
    get_deepseek_client,
)

__all__ = ['DeepSeekClient', 'get_deepseek_client']
