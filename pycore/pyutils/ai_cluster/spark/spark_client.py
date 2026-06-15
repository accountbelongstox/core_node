#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""iFlytek Spark HTTP API (OpenAI-compatible v1)."""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.third_party import get_third_package_requests


class SparkClient:
    """Spark Lite via HTTP APIPassword (Bearer)."""

    def __init__(self, api_password: str, default_model: str = "lite"):
        self.api_password = api_password
        self.default_model = default_model
        self.base_url = "https://spark-api-open.xf-yun.com/v1"
        self.last_error: Optional[str] = None

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
            resp = requests.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_password}",
                    "Content-Type": "application/json",
                },
                json={"model": use_model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
                timeout=90,
            )
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                text = (choices[0].get("message") or {}).get("content", "")
                if text:
                    return {"success": True, "text": text, "model": use_model, "error": None}
            self.last_error = "No text in response"
            return {"success": False, "text": "", "model": use_model, "error": self.last_error}
        except Exception as e:
            self.last_error = str(e)
            return {"success": False, "text": "", "model": use_model, "error": self.last_error}

    def list_models(self) -> List[str]:
        return ["lite", "generalv3.5", "4.0Ultra"]
