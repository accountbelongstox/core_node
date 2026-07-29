#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Proxy (Multi-Instance Mode)

Lightweight proxy that forwards MCP requests to backend.
- Displays backend ID on startup (verify singleton)
- Forwards tool calls via HTTP
- Transparent to AI (AI sees normal MCP tools)
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import requests

# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.stdio_utils import ensure_stdio_has_buffer_attributes
from pycore.pyctl.mcpctl.debug_config import debug_print, is_proxy_debug

# Ensure STDIO compatibility
ensure_stdio_has_buffer_attributes()

# Configure logging (MCP mode)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("mcp_proxy")

# Backend configuration
BACKEND_HOST = os.environ.get("MCP_BACKEND_HOST", "localhost")
BACKEND_PORT = int(os.environ.get("MCP_BACKEND_PORT", "58100"))
BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"

# Backend info (retrieved on startup)
backend_info: Optional[Dict[str, Any]] = None


def get_backend_info() -> Dict[str, Any]:
    """
    Get backend information

    Returns:
        Backend info dict with backend_id
    """
    global backend_info

    if backend_info is None:
        try:
            response = requests.get(f"{BACKEND_URL}/backend_info", timeout=2)
            response.raise_for_status()
            backend_info = response.json()

            # Display backend ID
            backend_id = backend_info.get("backend_id", "unknown")
            logger.info(f"[Proxy] Connected to backend ID: {backend_id}")
            debug_print(f"Backend info: {backend_info}", "Proxy")

        except Exception as e:
            logger.error(f"[Proxy] Failed to connect to backend at {BACKEND_URL}: {e}")
            backend_info = {"backend_id": "error", "status": "disconnected"}

    return backend_info


async def call_backend_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """
    Forward tool call to backend

    Args:
        tool_name: Tool name
        **kwargs: Tool parameters

    Returns:
        Tool result from backend
    """
    debug_print(f"Forwarding {tool_name} to backend: {kwargs}", "Proxy")

    try:
        response = requests.post(
            f"{BACKEND_URL}/tool/{tool_name}",
            json=kwargs,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        debug_print(f"Backend response: {result}", "Proxy")
        return result

    except Exception as e:
        logger.error(f"[Proxy] Backend call failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "backend_url": BACKEND_URL
        }


def start_mcp_proxy():
    """Start MCP proxy server"""
    from pycore.pyfoundations.third_party.api import get_third_package_FastMCP
    FastMCP = get_third_package_FastMCP()

    # Get backend info and display ID
    info = get_backend_info()
    backend_id = info.get("backend_id", "unknown")

    logger.info(f"[Proxy] Starting MCP Proxy (Backend ID: {backend_id})")

    # Create FastMCP server
    mcp = FastMCP("MCP Proxy", version="1.0.0")

    # Register tools (transparent to AI)
    @mcp.tool()
    async def get_file_info_with_ocr_and_document_parsing_tool(
        file_path: str,
        use_cache: bool = True,
        include_pixel_matrix: bool = False,
        ocr_model_type: str = "general",
        num_colors: int = 10,
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_hyperlinks: bool = True
    ) -> dict:
        """
        Get comprehensive file information with OCR, document parsing, and color analysis.

        For images: OCR text, positions, color palette, dimensions, pixel matrix (optional)
        For PDFs: Text extraction, positions, metadata, tables, images, hyperlinks
        For Office docs: Text content, paragraphs, metadata, tables, formulas, sheets

        Args:
            file_path: Path to file to analyze
            use_cache: Use database caching (default: True)
            include_pixel_matrix: Include pixel matrix for images (default: False)
            ocr_model_type: OCR model - scene, doc, number, general, english, chinese_traditional
            num_colors: Number of dominant colors to extract (default: 10)
            extract_images: Extract embedded images from documents (default: True)
            extract_tables: Extract tables from documents (default: True)
            extract_hyperlinks: Extract hyperlinks from PDFs (default: True)
        """
        # Forward to backend (AI doesn't know about this)
        return await call_backend_tool(
            "get_file_info",
            file_path=file_path,
            use_cache=use_cache,
            include_pixel_matrix=include_pixel_matrix,
            ocr_model_type=ocr_model_type,
            num_colors=num_colors,
            extract_images=extract_images,
            extract_tables=extract_tables,
            extract_hyperlinks=extract_hyperlinks
        )

    logger.info("[Proxy] MCP tools registered (1 tool)")
    logger.info("[Proxy] Running proxy server...")

    # Run proxy
    mcp.run(show_banner=False, log_level="INFO")


def main():
    """Main entry point"""
    start_mcp_proxy()


if __name__ == "__main__":
    main()
