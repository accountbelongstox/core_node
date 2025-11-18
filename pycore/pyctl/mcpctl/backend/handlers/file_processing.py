# -*- coding: utf-8 -*-
"""File Processing Handlers (4 tools + backend_info)"""

from typing import Dict, Any
from pycore import ColorPrint
from pycore.pyctl.mcpctl.debug_config import debug_print

# Global controllers (initialized by main)
backend_info = {}
file_controller = None


def handle_backend_info(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Get backend info handler (sync - immediate response)"""
    debug_print(f"[Backend] backend_info requested", "Backend")
    return backend_info.copy()


async def handle_get_file_info_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Get file info with comprehensive analysis (OCR, document parsing, color analysis)"""
    global file_controller

    file_path = params.get("file_path", "")
    backend_id = backend_info.get("backend_id", "unknown")

    debug_print(f"[Backend {backend_id}] get_file_info requested for: {file_path}", "Backend")

    # Extract options
    options = {
        "use_cache": params.get("use_cache", True),
        "include_pixel_matrix": params.get("include_pixel_matrix", False),
        "ocr_model_type": params.get("ocr_model_type", "general"),
        "num_colors": params.get("num_colors", 10),
        "extract_images": params.get("extract_images", True),
        "extract_tables": params.get("extract_tables", True),
        "extract_hyperlinks": params.get("extract_hyperlinks", True)
    }

    try:
        # Call controller for actual file processing
        result = await file_controller.get_file_info_with_comprehensive_analysis(
            file_path=file_path,
            options=options
        )

        # Add backend metadata
        result["backend_id"] = backend_id
        result["rpc_version"] = "v2"

        return result

    except Exception as e:
        ColorPrint.red(f"[Backend] Error processing file {file_path}: {e}")
        return {
            "success": False,
            "backend_id": backend_id,
            "error": str(e),
            "file_path": file_path,
            "rpc_version": "v2"
        }


async def handle_generate_placeholder_image_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Generate placeholder image with OCR tool handler"""
    global file_controller
    try:
        result = await file_controller.generate_placeholder_image(
            original_image_path=params.get("original_image_path"),
            output_path=params.get("output_path"),
            placeholder_text=params.get("placeholder_text"),
            style_options={
                "background_color": params.get("background_color", "#CCCCCC"),
                "text_color": params.get("text_color", "#333333"),
                "font_size": params.get("font_size", 20)
            }
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_query_file_processing_history_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Query file processing history tool handler"""
    global file_controller
    try:
        result = await file_controller.query_processing_history(
            file_type=params.get("file_type"),
            date_from=params.get("date_from"),
            date_to=params.get("date_to"),
            limit=params.get("limit", 100),
            offset=params.get("offset", 0)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_clear_file_cache_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Clear file cache tool handler"""
    global file_controller
    try:
        result = await file_controller.clear_cache(file_path=params.get("file_path"))
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}
