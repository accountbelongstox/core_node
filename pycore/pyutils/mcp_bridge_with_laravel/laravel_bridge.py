#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Laravel HTTP Bridge

Provides HTTP client for communicating with Laravel OCR API.
Replaces direct OCR processing with HTTP requests to Laravel backend.
"""

import logging
from typing import Dict, Any, Optional, List
from pathlib import Path

from pycore.pyfoundations.third_party import requests
from pycore.pyutils.mcp_bridge_with_laravel.config import (
    LARAVEL_BASE_URL,
    LARAVEL_API_PREFIX,
    DEFAULT_TIMEOUT,
    BATCH_TIMEOUT,
    QUICK_TIMEOUT
)

logger = logging.getLogger(__name__)


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
        self.session = requests.Session()

        logger.info(f"Laravel bridge initialized: {self.base_url}{self.api_prefix}")

    def _build_url(self, endpoint: str) -> str:
        """Build full API URL"""
        return f"{self.base_url}{self.api_prefix}/{endpoint.lstrip('/')}"

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle HTTP response"""
        try:
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {str(e)}",
                "status_code": response.status_code
            }
        except requests.exceptions.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return {
                "success": False,
                "error": f"Invalid JSON response: {str(e)}",
                "raw_response": response.text[:500]
            }
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def health_check(self) -> Dict[str, Any]:
        """Check Laravel OCR API health"""
        try:
            # Health endpoint is at /api/mcp/v1/health (not under /ocr prefix)
            url = f"{self.base_url}{LARAVEL_API_PREFIX}/health"
            response = self.session.get(url, timeout=self.quick_timeout)
            return self._handle_response(response)
        except requests.exceptions.RequestException as e:
            logger.error(f"Health check failed: {e}")
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
            url = self._build_url("recognize")
            payload = {
                "image_path": image_path,
                "model_type": model_type
            }

            logger.info(f"OCR request: {image_path} (model: {model_type})")

            response = self.session.post(
                url,
                json=payload,
                timeout=self.timeout
            )

            result = self._handle_response(response)
            logger.info(f"OCR completed: success={result.get('success')}")

            return result

        except requests.exceptions.Timeout:
            logger.error("OCR request timeout")
            return {
                "success": False,
                "error": f"Request timeout after {self.timeout}s"
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"OCR request failed: {e}")
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
            url = self._build_url("batch")
            payload = {
                "image_paths": image_paths,
                "model_type": model_type
            }

            logger.info(f"Batch OCR request: {len(image_paths)} images (model: {model_type})")

            response = self.session.post(
                url,
                json=payload,
                timeout=self.batch_timeout
            )

            result = self._handle_response(response)
            logger.info(f"Batch OCR completed: success={result.get('success')}")

            return result

        except requests.exceptions.Timeout:
            logger.error("Batch OCR request timeout")
            return {
                "success": False,
                "error": f"Batch request timeout after {self.batch_timeout}s"
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Batch OCR request failed: {e}")
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }

    def get_available_models(self) -> Dict[str, Any]:
        """Get available OCR models"""
        try:
            url = self._build_url("engines")
            response = self.session.get(url, timeout=self.quick_timeout)
            return self._handle_response(response)
        except requests.exceptions.RequestException as e:
            logger.error(f"Get models failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_engine_info(self, model_type: Optional[str] = None) -> Dict[str, Any]:
        """Get OCR engine information"""
        try:
            url = self._build_url("engine-info")
            params = {"model_type": model_type} if model_type else {}

            response = self.session.get(url, params=params, timeout=self.quick_timeout)
            return self._handle_response(response)
        except requests.exceptions.RequestException as e:
            logger.error(f"Get engine info failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Create singleton instance
laravel_bridge = LaravelBridge()


__all__ = ['LaravelBridge', 'laravel_bridge']
