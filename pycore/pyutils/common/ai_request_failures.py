# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, Optional

from pycore.pyutils.common.coded_message import CodedMessage

AI_PAID_MODEL_REFUSED = "AI_PAID_MODEL_REFUSED"
AI_FREE_IMAGE_MODEL_UNAVAILABLE = "AI_FREE_IMAGE_MODEL_UNAVAILABLE"
_PAID_MODEL_TEMPLATE = "{provider} allows free models only; {model} is not free"
_FREE_IMAGE_TEMPLATE = "{provider} has no free image-generation model"


def paid_model_refused(provider: str, model: str) -> CodedMessage:
    """Coded reason of a non-free model refused by a free-only provider."""
    return CodedMessage(AI_PAID_MODEL_REFUSED, {"provider": provider, "model": model}, _PAID_MODEL_TEMPLATE)


def free_image_model_unavailable(provider: str) -> CodedMessage:
    """Coded reason of a free-only provider whose catalog has no free image model."""
    return CodedMessage(AI_FREE_IMAGE_MODEL_UNAVAILABLE, {"provider": provider}, _FREE_IMAGE_TEMPLATE)


_FAILURE_RULES = (
    (AI_PAID_MODEL_REFUSED, ("allows free models only",), False, False),
    (AI_FREE_IMAGE_MODEL_UNAVAILABLE, ("has no free image-generation model",), False, False),
    ("local_rate_limit", ("rate limit (", "provider cooldown"), True, False),
    ("dns", ("nameresolutionerror", "getaddrinfo failed", "failed to resolve", "could not resolve host"), True, False),
    ("connect_timeout", ("connect timeout", "connecttimeout", "connection timed out"), True, False),
    ("connection", ("failed to establish a new connection", "connection refused", "no route to host", "network is unreachable"), True, False),
    ("read_timeout", ("read timed out", "readtimeout", "operation timed out", "curl error 28"), True, True),
    ("tts_queue_timeout", ("queue wait timed out", "result fetch timed out"), True, False),
    ("quota", ("requests/day exceeded", "daily request limit", "quota exceeded", "insufficient quota"), True, True),
    ("rate_limit", ("http 429", "429 client error", "too many requests", "rate_limit", "ratelimit"), True, True),
    ("authentication", ("http 401", "http 403", "401 client error", "403 client error", "invalid api key", "invalid_api_key"), False, True),
    ("provider_unavailable", ("http 500", "http 502", "http 503", "http 504", "overloaded", "service unavailable", "bad gateway"), True, True),
    ("empty_response", ("empty response from provider",), True, True),
)


class AiRequestError(RuntimeError):
    def __init__(
        self,
        message: str,
        code: str = "unknown",
        retriable: bool = False,
        provider_reached: bool = False,
        retry_after_s: Optional[float] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retriable = retriable
        self.provider_reached = provider_reached
        self.retry_after_s = retry_after_s


def classify_ai_failure(error: Any) -> Dict[str, Any]:
    message = str(error or "").strip()
    normalized = message.lower()
    if not normalized:
        return {
            "code": "none",
            "retriable": False,
            "provider_reached": True,
        }
    for code, marks, retriable, provider_reached in _FAILURE_RULES:
        if any(mark in normalized for mark in marks):
            return {
                "code": code,
                "retriable": retriable,
                "provider_reached": provider_reached,
            }
    return {
        "code": "unknown",
        "retriable": False,
        "provider_reached": True,
    }


__all__ = [
    "AI_FREE_IMAGE_MODEL_UNAVAILABLE",
    "AI_PAID_MODEL_REFUSED",
    "AiRequestError",
    "classify_ai_failure",
    "free_image_model_unavailable",
    "paid_model_refused",
]
