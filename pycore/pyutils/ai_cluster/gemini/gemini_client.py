"""
Gemini Client - Wrapper for Google Gemini API client

Provides a simple interface to the Google Gemini API with error handling
and result formatting.
"""

import base64
import time
from typing import Dict, Any, Optional, List
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_google_genai


class GeminiClient:
    """Google Gemini API client wrapper"""

    def __init__(self, api_key: str, default_model: str = "gemini-2.5-flash"):
        """
        Initialize Gemini client

        Args:
            api_key: Google API key for Gemini
            default_model: Default model to use (default: gemini-2.5-flash)
        """
        self.api_key = api_key
        self.default_model = default_model
        self._client = None

    def _get_client(self):
        """Lazy initialize the Gemini client"""
        if self._client is None:
            genai = get_third_package_google_genai()
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def generate_content(
        self,
        prompt: str,
        model: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate content using Gemini API

        Args:
            prompt: Text prompt for generation
            model: Model to use (default: self.default_model)
            max_output_tokens: Maximum number of tokens to generate
            temperature: Temperature for sampling (0.0 to 2.0)
            top_p: Top-p sampling parameter
            top_k: Top-k sampling parameter

        Returns:
            Dictionary with generation results:
            {
                "success": bool,
                "text": str (generated text),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "text": "",
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not prompt:
            result["error"] = "Prompt cannot be empty"
            return result

        client = self._get_client()

        # Build generation config
        config = {}
        if max_output_tokens is not None:
            config["max_output_tokens"] = max_output_tokens
        if temperature is not None:
            config["temperature"] = temperature
        if top_p is not None:
            config["top_p"] = top_p
        if top_k is not None:
            config["top_k"] = top_k

        response = client.models.generate_content(
            model=result["model"],
            contents=prompt,
            config=config if config else None
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            result["text"] = response.text
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def generate_with_images(
        self,
        prompt: str,
        image_paths: List[str],
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate content with images using Gemini Vision API

        Args:
            prompt: Text prompt for generation
            image_paths: List of paths to image files
            model: Model to use (default: self.default_model)

        Returns:
            Dictionary with generation results (same format as generate_content)
        """
        start_time = time.time()
        result = {
            "success": False,
            "text": "",
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not prompt:
            result["error"] = "Prompt cannot be empty"
            return result

        if not image_paths:
            result["error"] = "At least one image is required"
            return result

        # Validate image paths
        for image_path in image_paths:
            if not Path(image_path).exists():
                result["error"] = f"Image file not found: {image_path}"
                return result

        client = self._get_client()
        genai = get_third_package_google_genai()

        # Build contents list with prompt and images
        contents = [prompt]
        for image_path in image_paths:
            image_file = genai.types.Part.from_uri(
                file_uri=f"file://{Path(image_path).absolute()}",
                mime_type="image/jpeg"
            )
            contents.append(image_file)

        response = client.models.generate_content(
            model=result["model"],
            contents=contents
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            result["text"] = response.text
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        aspect_ratio: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate an image from a text prompt using a Gemini image model

        Uses the same models/{model}:generateContent call as text generation,
        with generationConfig.responseModalities = ["IMAGE"]; the image comes
        back as candidates[0].content.parts[*].inline_data {mime_type, data}.

        Args:
            prompt: Text prompt describing the image to generate
            model: Model to use (default: self.default_model — pass an image
                   model such as gemini-2.5-flash-image)
            aspect_ratio: Optional aspect ratio like "1:1" or "16:9"

        Returns:
            Dictionary with image generation results:
            {
                "success": bool,
                "image_base64": str (base64-encoded image bytes),
                "mime_type": str (e.g. "image/png"),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "image_base64": "",
            "mime_type": "",
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not prompt:
            result["error"] = "Prompt cannot be empty"
            return result

        client = self._get_client()

        config: Dict[str, Any] = {"response_modalities": ["IMAGE"]}
        if aspect_ratio:
            config["image_config"] = {"aspect_ratio": aspect_ratio}

        response = client.models.generate_content(
            model=result["model"],
            contents=prompt,
            config=config
        )

        candidates = getattr(response, "candidates", None) or []
        content = getattr(candidates[0], "content", None) if candidates else None
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            data = getattr(inline, "data", None) if inline is not None else None
            if not data:
                continue
            if isinstance(data, (bytes, bytearray)):
                result["image_base64"] = base64.b64encode(data).decode("ascii")
            else:  # already a base64 string
                result["image_base64"] = str(data)
            result["mime_type"] = getattr(inline, "mime_type", "") or "image/png"
            result["success"] = True
            break

        if not result["success"]:
            result["error"] = "No image data in response"

        result["processing_time"] = time.time() - start_time
        return result

    def recognize_objects(
        self,
        image_path: str,
        max_objects: int = 10,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Recognize objects in an image and return their locations

        Args:
            image_path: Path to image file
            max_objects: Maximum number of objects to identify (default: 10)
            model: Model to use (default: self.default_model)

        Returns:
            Dictionary with object recognition results:
            {
                "success": bool,
                "objects": List[Dict] (objects with points and labels),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "objects": [],
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not Path(image_path).exists():
            result["error"] = f"Image file not found: {image_path}"
            return result

        client = self._get_client()
        genai = get_third_package_google_genai()

        prompt = f"""
Point to no more than {max_objects} items in the image. The label returned
should be an identifying name for the object detected.
The answer should follow the json format: [{{"point": <point>,
"label": <label1>}}, ...]. The points are in [y, x] format
normalized to 0-1000.
"""

        with open(image_path, 'rb') as f:
            image_bytes = f.read()

        response = client.models.generate_content(
            model=result["model"],
            contents=[
                genai.types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=f"image/{Path(image_path).suffix[1:]}"
                ),
                prompt
            ],
            config={"temperature": 0.5}
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            import json
            try:
                result["objects"] = json.loads(response.text)
            except json.JSONDecodeError:
                result["objects"] = []
                result["text"] = response.text
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def summarize_image(
        self,
        image_path: str,
        detail_level: str = "medium",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a summary of an image

        Args:
            image_path: Path to image file
            detail_level: Level of detail (brief, medium, detailed)
            model: Model to use (default: self.default_model)

        Returns:
            Dictionary with image summary results:
            {
                "success": bool,
                "summary": str (image summary),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "summary": "",
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not Path(image_path).exists():
            result["error"] = f"Image file not found: {image_path}"
            return result

        detail_prompts = {
            "brief": "Provide a brief one-sentence summary of this image.",
            "medium": "Provide a comprehensive summary of this image, describing the main elements, scene, and any notable details.",
            "detailed": "Provide a detailed analysis of this image, including: 1) Overall scene description, 2) Main objects and their relationships, 3) Colors and composition, 4) Any text or symbols present, 5) Context or setting."
        }

        prompt = detail_prompts.get(detail_level, detail_prompts["medium"])

        client = self._get_client()
        genai = get_third_package_google_genai()

        with open(image_path, 'rb') as f:
            image_bytes = f.read()

        response = client.models.generate_content(
            model=result["model"],
            contents=[
                genai.types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=f"image/{Path(image_path).suffix[1:]}"
                ),
                prompt
            ],
            config={"temperature": 0.7}
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            result["summary"] = response.text
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def summarize_text(
        self,
        text: str,
        summary_type: str = "paragraph",
        max_length: Optional[int] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Summarize text content

        Args:
            text: Text to summarize
            summary_type: Type of summary (paragraph, bullet_points, key_points)
            max_length: Maximum length of summary in words (optional)
            model: Model to use (default: self.default_model)

        Returns:
            Dictionary with text summary results:
            {
                "success": bool,
                "summary": str (text summary),
                "original_length": int (character count),
                "summary_length": int (character count),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "summary": "",
            "original_length": len(text),
            "summary_length": 0,
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not text:
            result["error"] = "Text cannot be empty"
            return result

        summary_prompts = {
            "paragraph": "Summarize the following text in a clear, concise paragraph:",
            "bullet_points": "Summarize the following text as a bulleted list of key points:",
            "key_points": "Extract and list the key points from the following text:"
        }

        prompt = summary_prompts.get(summary_type, summary_prompts["paragraph"])

        if max_length:
            prompt += f" (maximum {max_length} words)"

        prompt += f"\n\n{text}"

        client = self._get_client()

        response = client.models.generate_content(
            model=result["model"],
            contents=prompt,
            config={"temperature": 0.5}
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            result["summary"] = response.text
            result["summary_length"] = len(response.text)
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def organize_text(
        self,
        text: str,
        organization_type: str = "structured",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Organize and structure text content

        Args:
            text: Text to organize
            organization_type: Type of organization (structured, categorized, outline, cleaned)
            model: Model to use (default: self.default_model)

        Returns:
            Dictionary with organized text results:
            {
                "success": bool,
                "organized_text": str (organized text),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "organized_text": "",
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not text:
            result["error"] = "Text cannot be empty"
            return result

        organization_prompts = {
            "structured": "Organize the following text into clear sections with headings and subheadings:",
            "categorized": "Organize the following text by categorizing the information into logical groups:",
            "outline": "Create a hierarchical outline from the following text:",
            "cleaned": "Clean up and format the following text, fixing grammar, removing redundancy, and improving readability:"
        }

        prompt = organization_prompts.get(organization_type, organization_prompts["structured"])
        prompt += f"\n\n{text}"

        client = self._get_client()

        response = client.models.generate_content(
            model=result["model"],
            contents=prompt,
            config={"temperature": 0.5}
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            result["organized_text"] = response.text
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def ocr_and_organize(
        self,
        image_path: str,
        organization_type: str = "cleaned",
        preserve_format: bool = False,
        model: Optional[str] = None
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
            model: Model to use (default: self.default_model)

        Returns:
            Dictionary with OCR and organization results:
            {
                "success": bool,
                "raw_text": str (extracted text before organization),
                "organized_text": str (organized text),
                "model": str (model used),
                "processing_time": float (seconds),
                "error": str (if failed)
            }
        """
        start_time = time.time()
        result = {
            "success": False,
            "raw_text": "",
            "organized_text": "",
            "model": model or self.default_model,
            "processing_time": 0.0,
            "error": ""
        }

        if not Path(image_path).exists():
            result["error"] = f"Image file not found: {image_path}"
            return result

        client = self._get_client()
        genai = get_third_package_google_genai()

        organization_prompts = {
            "structured": "Extract all text from this image and organize it into clear sections with headings and subheadings. Make the content coherent and well-structured.",
            "categorized": "Extract all text from this image and organize it by categorizing the information into logical groups. Ensure the text flows naturally.",
            "outline": "Extract all text from this image and create a hierarchical outline. Make the content organized and easy to follow.",
            "cleaned": "Extract all text from this image and format it into clean, coherent paragraphs. Fix any grammar issues, remove redundancy, and improve readability."
        }

        base_prompt = organization_prompts.get(organization_type, organization_prompts["cleaned"])

        if preserve_format:
            base_prompt += " Try to preserve the original layout and formatting structure as much as possible."

        base_prompt += "\n\nFirst, extract all the text you see in the image. Then, organize and clean it up to make it coherent and readable."

        with open(image_path, 'rb') as f:
            image_bytes = f.read()

        response = client.models.generate_content(
            model=result["model"],
            contents=[
                genai.types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=f"image/{Path(image_path).suffix[1:]}"
                ),
                base_prompt
            ],
            config={"temperature": 0.5}
        )

        if response and hasattr(response, 'text'):
            result["success"] = True
            organized_text = response.text

            result["organized_text"] = organized_text

            ocr_prompt = "Extract ONLY the raw text from this image without any organization or formatting. Just output the text as you see it."

            with open(image_path, 'rb') as f:
                image_bytes = f.read()

            raw_response = client.models.generate_content(
                model=result["model"],
                contents=[
                    genai.types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=f"image/{Path(image_path).suffix[1:]}"
                    ),
                    ocr_prompt
                ],
                config={"temperature": 0.3}
            )

            if raw_response and hasattr(raw_response, 'text'):
                result["raw_text"] = raw_response.text
        else:
            result["error"] = "No response or empty response from API"

        result["processing_time"] = time.time() - start_time
        return result

    def list_models(self) -> Dict[str, Any]:
        """
        List available Gemini models

        Returns:
            Dictionary with model list:
            {
                "success": bool,
                "models": List[str] (model names),
                "error": str (if failed)
            }
        """
        result = {
            "success": False,
            "models": [],
            "error": ""
        }

        client = self._get_client()

        models_response = client.models.list()
        if models_response:
            result["success"] = True
            result["models"] = [model.name for model in models_response]
        else:
            result["error"] = "Failed to list models"

        return result


__all__ = ['GeminiClient']
