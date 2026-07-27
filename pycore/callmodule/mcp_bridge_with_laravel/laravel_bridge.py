#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Laravel HTTP Bridge

Provides HTTP client for communicating with Laravel OCR API.
Replaces direct OCR processing with HTTP requests to Laravel backend.

All HTTP now flows through the unified LaravelClient (pycore.callmodule.services.
sync.laravel_client) so every call is timed + logged + recorded. The module-level
``requests`` reference is kept ONLY for its ``.exceptions`` classes and the
``Response`` type hint used by ``_handle_response``.
"""

from typing import Dict, Any, Optional, List
from pathlib import Path

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.callmodule.services.sync.laravel_client import get_laravel_client

requests = get_third_package_requests()
from pycore.callmodule.mcp_bridge_with_laravel.config import (
    LARAVEL_BASE_URL,
    LARAVEL_API_PREFIX,
    DEFAULT_TIMEOUT,
    BATCH_TIMEOUT,
    QUICK_TIMEOUT
)


class LaravelBridge:
    """HTTP bridge to Laravel OCR API"""

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize Laravel bridge

        Args:
            base_url: Laravel application base URL (default: from config)
        """
        self.base_url = (base_url or LARAVEL_BASE_URL).rstrip('/')
        self.api_prefix = f"{LARAVEL_API_PREFIX}/ocr"
        self.timeout = DEFAULT_TIMEOUT
        self.batch_timeout = BATCH_TIMEOUT
        self.quick_timeout = QUICK_TIMEOUT

        ColorPrint.blue(f"Laravel bridge initialized: {self.base_url}{self.api_prefix}")

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle HTTP response"""
        try:
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            ColorPrint.red(f"HTTP error: {e}")
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {str(e)}",
                "status_code": response.status_code
            }
        except requests.exceptions.JSONDecodeError as e:
            ColorPrint.red(f"JSON decode error: {e}")
            return {
                "success": False,
                "error": f"Invalid JSON response: {str(e)}",
                "raw_response": response.text[:500]
            }
        except Exception as e:
            ColorPrint.red(f"Unexpected error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def health_check(self) -> Dict[str, Any]:
        """Check Laravel OCR API health"""
        try:
            # Health endpoint is at /api/mcp/v1/health (not under /ocr prefix)
            resp = get_laravel_client().get(
                f"{LARAVEL_API_PREFIX}/health",
                base_url=self.base_url,
                timeout=self.quick_timeout,
            )
            return self._handle_response(resp)
        except requests.exceptions.RequestException as e:
            ColorPrint.red(f"Health check failed: {e}")
            return {
                "success": False,
                "error": f"Cannot connect to Laravel: {str(e)}"
            }

    def recognize_image(
        self,
        image_path: str,
        model_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Recognize text from single image

        Args:
            image_path: Absolute path to image file
            model_type: Model type (general, scene, doc, number, english, chinese_traditional)

        Returns:
            OCR result dictionary
        """
        # Validate image path
        if not Path(image_path).exists():
            return {
                "success": False,
                "error": f"Image file not found: {image_path}"
            }

        try:
            payload = {
                "image_path": image_path,
                "model_type": model_type
            }

            ColorPrint.blue(f"OCR request: {image_path} (model: {model_type})")

            resp = get_laravel_client().post(
                f"{self.api_prefix}/recognize",
                base_url=self.base_url,
                json=payload,
                timeout=self.timeout,
            )

            result = self._handle_response(resp)
            ColorPrint.blue(f"OCR completed: success={result.get('success')}")

            return result

        except requests.exceptions.Timeout:
            ColorPrint.red("OCR request timeout")
            return {
                "success": False,
                "error": f"Request timeout after {self.timeout}s"
            }
        except requests.exceptions.RequestException as e:
            ColorPrint.red(f"OCR request failed: {e}")
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }

    def recognize_batch(
        self,
        image_paths: List[str],
        model_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Recognize text from multiple images

        Args:
            image_paths: List of absolute paths to image files
            model_type: Model type

        Returns:
            Batch OCR results
        """
        # Validate all paths
        for path in image_paths:
            if not Path(path).exists():
                return {
                    "success": False,
                    "error": f"Image file not found: {path}"
                }

        try:
            payload = {
                "image_paths": image_paths,
                "model_type": model_type
            }

            ColorPrint.blue(f"Batch OCR request: {len(image_paths)} images (model: {model_type})")

            resp = get_laravel_client().post(
                f"{self.api_prefix}/batch",
                base_url=self.base_url,
                json=payload,
                timeout=self.batch_timeout,
            )

            result = self._handle_response(resp)
            ColorPrint.blue(f"Batch OCR completed: success={result.get('success')}")

            return result

        except requests.exceptions.Timeout:
            ColorPrint.red("Batch OCR request timeout")
            return {
                "success": False,
                "error": f"Batch request timeout after {self.batch_timeout}s"
            }
        except requests.exceptions.RequestException as e:
            ColorPrint.red(f"Batch OCR request failed: {e}")
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }

    def get_available_models(self) -> Dict[str, Any]:
        """Get available OCR models"""
        try:
            resp = get_laravel_client().get(
                f"{self.api_prefix}/engines",
                base_url=self.base_url,
                timeout=self.quick_timeout,
            )
            return self._handle_response(resp)
        except requests.exceptions.RequestException as e:
            ColorPrint.red(f"Get models failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_engine_info(self, model_type: Optional[str] = None) -> Dict[str, Any]:
        """Get OCR engine information"""
        try:
            params = {"model_type": model_type} if model_type else {}

            resp = get_laravel_client().get(
                f"{self.api_prefix}/engine-info",
                base_url=self.base_url,
                params=params,
                timeout=self.quick_timeout,
            )
            return self._handle_response(resp)
        except requests.exceptions.RequestException as e:
            ColorPrint.red(f"Get engine info failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Create singleton instance
laravel_bridge = LaravelBridge()


__all__ = ['LaravelBridge', 'laravel_bridge']
