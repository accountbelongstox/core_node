# -*- coding: utf-8 -*-
"""
Screenshot Processor - Core logic for screenshot capture
"""

import time
import base64
from datetime import datetime
from typing import Optional, Dict, Any

from pycore.pyfoundations.system_paths import get_app_temp_dir

try:
    import mss
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False

try:
    from PIL import Image
    import io
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


class ScreenshotProcessor:
    """Processor for screenshot capture"""

    def __init__(self):
        self.output_dir = get_app_temp_dir() / "screenshots"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def capture(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Capture screenshot.

        Args:
            config: Screenshot configuration
                - format: Image format (png, jpg, bmp)
                - quality: Image quality (1-100)
                - region: Capture region {x, y, width, height}
                - auto_ocr: Auto OCR flag
                - auto_upload: Auto upload flag

        Returns:
            Dictionary with capture result
        """
        start_time = time.time()

        try:
            if not MSS_AVAILABLE:
                return {
                    "success": False,
                    "error": "mss library not available. Install with: pip install mss",
                    "execution_time": time.time() - start_time
                }

            # Get configuration
            img_format = config.get("format", "png")
            quality = config.get("quality", 90)
            region = config.get("region")
            auto_ocr = config.get("auto_ocr", False)

            # Generate screenshot ID
            screenshot_id = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            # Capture screenshot
            with mss.mss() as sct:
                if region:
                    # Capture specific region
                    monitor = {
                        "left": region.get("x", 0),
                        "top": region.get("y", 0),
                        "width": region.get("width", 1920),
                        "height": region.get("height", 1080)
                    }
                else:
                    # Capture entire screen
                    monitor = sct.monitors[1]  # Primary monitor

                sct_img = sct.grab(monitor)

                # Convert to PIL Image
                if not PIL_AVAILABLE:
                    return {
                        "success": False,
                        "error": "Pillow library not available. Install with: pip install Pillow",
                        "execution_time": time.time() - start_time
                    }

                img = Image.frombytes("RGB", sct_img.size, sct_img.rgb)

                # Save to file
                file_ext = img_format.lower()
                file_path = self.output_dir / f"{screenshot_id}.{file_ext}"

                if file_ext == "jpg":
                    img.save(str(file_path), format="JPEG", quality=quality)
                else:
                    img.save(str(file_path), format=file_ext.upper())

                file_size = file_path.stat().st_size

                # Optionally encode to base64
                image_data = None
                if config.get("return_base64", False):
                    with open(file_path, "rb") as f:
                        image_data = base64.b64encode(f.read()).decode("utf-8")

            # Prepare result
            result = {
                "success": True,
                "screenshot_id": screenshot_id,
                "file_path": str(file_path),
                "file_size": file_size,
                "image_data": image_data,
                "execution_time": time.time() - start_time
            }

            # Optionally perform OCR
            if auto_ocr:
                try:
                    from .ocr_processor import OCRProcessor
                    ocr_processor = OCRProcessor()
                    ocr_result = ocr_processor.process_image(str(file_path), {})
                    result["ocr_result"] = ocr_result
                except Exception as e:
                    result["ocr_error"] = str(e)

            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": time.time() - start_time
            }

    def list_monitors(self) -> Dict[str, Any]:
        """
        List available monitors.

        Returns:
            Dictionary with monitor information
        """
        try:
            if not MSS_AVAILABLE:
                return {
                    "success": False,
                    "error": "mss library not available"
                }

            with mss.mss() as sct:
                monitors = []
                for i, monitor in enumerate(sct.monitors):
                    monitors.append({
                        "index": i,
                        "left": monitor.get("left", 0),
                        "top": monitor.get("top", 0),
                        "width": monitor.get("width", 0),
                        "height": monitor.get("height", 0)
                    })

                return {
                    "success": True,
                    "monitors": monitors
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
