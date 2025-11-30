"""
Gemini Manager - Singleton interface for Google Gemini API operations

Provides unified interface to Google Gemini API with automatic API key loading
from secret manager.
"""

import json
from typing import Dict, Any, Optional, List

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyutils.gemini.gemini_client import GeminiClient


class GeminiManager:
    """Unified Gemini manager with API key management"""

    def __init__(self):
        """Initialize Gemini manager"""
        self.clients: Dict[str, GeminiClient] = {}
        self.default_api_key_name = "GOOGLE_API_KEY_1"
        self.default_model = "gemini-2.5-flash"

    def _get_client(self, api_key_name: Optional[str] = None) -> Optional[GeminiClient]:
        """
        Get or create Gemini client for specified API key

        Args:
            api_key_name: Name of API key in secret manager (default: GOOGLE_API_KEY_1)

        Returns:
            GeminiClient instance or None if API key not found
        """
        key_name = api_key_name or self.default_api_key_name

        if key_name not in self.clients:
            # Load API key from secret manager
            api_key = get_secret_key(key_name)

            if not api_key:
                ColorPrint.red(f"[ERROR] Failed to load API key: {key_name}")
                return None

            ColorPrint.blue(f"[INFO] Creating Gemini client with API key: {key_name}")
            self.clients[key_name] = GeminiClient(
                api_key=api_key,
                default_model=self.default_model
            )

        return self.clients[key_name]

    def generate_content(
        self,
        prompt: str,
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Generate content using Gemini API

        Args:
            prompt: Text prompt for generation
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            max_output_tokens: Maximum number of tokens to generate
            temperature: Temperature for sampling (0.0 to 2.0)
            top_p: Top-p sampling parameter
            top_k: Top-k sampling parameter
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with generation results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "text": "",
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.generate_content(
            prompt=prompt,
            model=model,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def generate_with_images(
        self,
        prompt: str,
        image_paths: List[str],
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Generate content with images using Gemini Vision API

        Args:
            prompt: Text prompt for generation
            image_paths: List of paths to image files
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with generation results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "text": "",
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.generate_with_images(
            prompt=prompt,
            image_paths=image_paths,
            model=model
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def recognize_objects(
        self,
        image_path: str,
        max_objects: int = 10,
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Recognize objects in an image and return their locations

        Args:
            image_path: Path to image file
            max_objects: Maximum number of objects to identify (default: 10)
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with object recognition results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "objects": [],
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.recognize_objects(
            image_path=image_path,
            max_objects=max_objects,
            model=model
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def summarize_image(
        self,
        image_path: str,
        detail_level: str = "medium",
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Generate a summary of an image

        Args:
            image_path: Path to image file
            detail_level: Level of detail (brief, medium, detailed)
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with image summary results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "summary": "",
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.summarize_image(
            image_path=image_path,
            detail_level=detail_level,
            model=model
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def summarize_text(
        self,
        text: str,
        summary_type: str = "paragraph",
        max_length: Optional[int] = None,
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Summarize text content

        Args:
            text: Text to summarize
            summary_type: Type of summary (paragraph, bullet_points, key_points)
            max_length: Maximum length of summary in words (optional)
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with text summary results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "summary": "",
                "original_length": len(text) if text else 0,
                "summary_length": 0,
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.summarize_text(
            text=text,
            summary_type=summary_type,
            max_length=max_length,
            model=model
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def organize_text(
        self,
        text: str,
        organization_type: str = "structured",
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Organize and structure text content

        Args:
            text: Text to organize
            organization_type: Type of organization (structured, categorized, outline, cleaned)
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with organized text results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "organized_text": "",
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.organize_text(
            text=text,
            organization_type=organization_type,
            model=model
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def ocr_and_organize(
        self,
        image_path: str,
        organization_type: str = "cleaned",
        preserve_format: bool = False,
        model: Optional[str] = None,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Extract text from image and organize it into coherent content

        This is a combined operation that:
        1. Extracts all text from the image using OCR
        2. Organizes and structures the text to make it coherent and readable

        Args:
            image_path: Path to image file
            organization_type: Type of organization (structured, categorized, outline, cleaned)
            preserve_format: If True, try to preserve original formatting/layout
            model: Model to use (default: gemini-2.5-flash)
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with OCR and organization results or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "raw_text": "",
                "organized_text": "",
                "model": model or self.default_model,
                "processing_time": 0.0,
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.ocr_and_organize(
            image_path=image_path,
            organization_type=organization_type,
            preserve_format=preserve_format,
            model=model
        )

        return json.dumps(result, ensure_ascii=False) if return_json else result

    def list_models(
        self,
        api_key_name: Optional[str] = None,
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        List available Gemini models

        Args:
            api_key_name: Name of API key in secret manager
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with model list or JSON string
        """
        client = self._get_client(api_key_name)

        if not client:
            result = {
                "success": False,
                "models": [],
                "error": "Failed to initialize Gemini client - API key not found"
            }
            return json.dumps(result, ensure_ascii=False) if return_json else result

        result = client.list_models()
        return json.dumps(result, ensure_ascii=False) if return_json else result

    def set_default_model(self, model: str) -> bool:
        """
        Set default model for new clients

        Args:
            model: Model name to set as default

        Returns:
            True if successful
        """
        self.default_model = model
        ColorPrint.green(f"[SUCCESS] Default model set to: {model}")
        return True

    def get_client_info(self, api_key_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about loaded clients

        Args:
            api_key_name: Name of API key to get info for (optional)

        Returns:
            Dictionary with client information
        """
        if api_key_name:
            client = self._get_client(api_key_name)
            if client:
                return {
                    "api_key_name": api_key_name,
                    "default_model": client.default_model,
                    "status": "initialized"
                }
            else:
                return {
                    "api_key_name": api_key_name,
                    "status": "not_initialized",
                    "error": "API key not found"
                }
        else:
            return {
                "loaded_clients": list(self.clients.keys()),
                "default_api_key_name": self.default_api_key_name,
                "default_model": self.default_model
            }


# Create singleton instance
gemini_manager = GeminiManager()


__all__ = ['GeminiManager', 'gemini_manager']
