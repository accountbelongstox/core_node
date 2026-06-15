#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zhipu AI (BigModel.cn) client implementation.

Provides text generation using Zhipu AI's GLM models via REST API.
"""

from typing import Dict, Any, List, Optional
from pycore.pyfoundations.third_party import get_third_package_requests


class ZhipuAIClient:
    """
    Zhipu AI client for text generation.
    
    Uses the OpenAI-compatible API structure with base URL:
    https://open.bigmodel.cn/api/paas/v4/
    """

    def __init__(self, api_key: str, default_model: str = "glm-4"):
        """
        Initialize Zhipu AI client.
        
        Args:
            api_key: Zhipu AI API key
            default_model: Default model to use (glm-4, glm-4v, etc.)
        """
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = "https://open.bigmodel.cn/api/paas/v4"

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        """
        Generate chat completion using Zhipu AI API.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model name (defaults to client default)
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Dict with 'success', 'text', 'error' keys
        """
        model = model or self.default_model
        requests = get_third_package_requests()
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                text = data["choices"][0].get("message", {}).get("content", "")
                return {
                    "success": True,
                    "text": text,
                    "model": model,
                }
            else:
                return {
                    "success": False,
                    "error": "No response content from Zhipu AI",
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    def list_models(self) -> List[str]:
        """Validate key via OpenAI-compatible /models listing."""
        requests = get_third_package_requests()
        try:
            resp = requests.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            return [m.get("id", "") for m in data if m.get("id")]
        except Exception:
            return []
