#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared probe/chat helpers for registry-driven OpenAI-compatible providers."""

import time
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_keys import (
    PROVIDERS,
    base_url,
    catalog_models,
    default_model,
    extra_secret,
    first_secret,
    is_configured,
)

from pycore.pyutils.ai_cluster.openai_compat import OpenAICompatClient
from pycore.pyutils.ai_cluster.cloudflare import CloudflareAIClient
from pycore.pyutils.ai_cluster.spark import SparkClient



def probe_openai_compat(name: str, _blank, _provider_secret, max_models: int) -> Dict[str, Any]:
    key = _provider_secret(name)
    result = _blank(name, key)
    if not is_configured(name):
        return result

    start = time.time()
    try:
        client = OpenAICompatClient(
            api_key=key,
            base_url=base_url(name),
            default_model=default_model(name),
            provider=name,
        )
        models = client.list_models()
        if models:
            result["available"] = True
            result["models"] = models[:max_models]
        elif catalog_models(name, max_models):
            result["available"] = True
            result["models"] = catalog_models(name, max_models)
            result["error"] = None
        else:
            result["error"] = client.last_error or "No models returned"
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def probe_cloudflare(_blank, _provider_secret, max_models: int) -> Dict[str, Any]:
    name = "cloudflare"
    key = _provider_secret(name)
    result = _blank(name, key)
    if not is_configured(name):
        result["error"] = "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID"
        return result
    start = time.time()
    try:
        client = CloudflareAIClient(
            api_token=key,
            account_id=extra_secret(name),
            default_model=default_model(name),
        )
        models = client.list_models()
        result["available"] = True
        result["models"] = models[:max_models]
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def probe_spark(_blank, _provider_secret, max_models: int) -> Dict[str, Any]:
    name = "spark"
    key = _provider_secret(name)
    result = _blank(name, key)
    if not key:
        return result
    start = time.time()
    try:
        client = SparkClient(api_password=key, default_model=default_model(name))
        models = client.list_models()
        result["available"] = True
        result["models"] = models[:max_models]
    except Exception as e:
        result["error"] = str(e)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


def chat_openai_compat(name: str, messages, model, key, out) -> Dict[str, Any]:
    use_model = model or default_model(name)
    out["model"] = use_model
    client = OpenAICompatClient(
        api_key=key,
        base_url=base_url(name),
        default_model=use_model,
        provider=name,
    )
    res = client.chat_completion(messages=messages, model=use_model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def chat_cloudflare(messages, model, key, out) -> Dict[str, Any]:
    use_model = model or default_model("cloudflare")
    out["model"] = use_model
    client = CloudflareAIClient(
        api_token=key,
        account_id=extra_secret("cloudflare"),
        default_model=use_model,
    )
    res = client.chat_completion(messages=messages, model=use_model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out


def chat_spark(messages, model, key, out) -> Dict[str, Any]:
    use_model = model or default_model("spark")
    out["model"] = use_model
    client = SparkClient(api_password=key, default_model=use_model)
    res = client.chat_completion(messages=messages, model=use_model)
    if res.get("success"):
        out["text"] = res.get("text", "")
        out["success"] = True
    else:
        out["error"] = res.get("error") or "Empty response from provider"
    return out
