#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified MCP Proxy (2025-11-23 Refactored)

Pure HTTP proxy forwarding MCP requests to dual backends:
- PyCore Backend (localhost:59000/mcp/*) - File processing, Database, Codebase tools
- NCore Backend (localhost:58000/*) - Browser automation, Advanced file processing

Architecture:
    Claude/AI Client → FastMCP Proxy → HTTP {
        → PyCore Backend (59000)
        → NCore Backend (58000)
    }

Backends:
    python pycore_module_caller.py  (pycore, port 59000)
    python ncore/ncore_backend_main.py  (ncore, port 58000)

Proxy:
    python pymain.py app=mcp  (this file)
"""

import os
import sys
import logging
import platform
from pathlib import Path
from typing import Optional, Dict, Any
import requests

# Add project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.stdio_utils import ensure_stdio_has_buffer_attributes

# Ensure STDIO compatibility
ensure_stdio_has_buffer_attributes()

# Configure logging (MCP mode - use stderr)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("mcp_proxy")

# ============================================================
# Backend Configuration
# ============================================================

# PyCore Backend (pycore_module_caller)
PYCORE_HOST = os.environ.get("PYCORE_BACKEND_HOST", "localhost")
PYCORE_PORT = int(os.environ.get("PYCORE_BACKEND_PORT", "59000"))
PYCORE_URL = f"http://{PYCORE_HOST}:{PYCORE_PORT}/mcp"

# NCore Backend (ncore_backend_main)
NCORE_HOST = os.environ.get("NCORE_BACKEND_HOST", "localhost")
NCORE_PORT = int(os.environ.get("NCORE_BACKEND_PORT", "58000"))
NCORE_URL = f"http://{NCORE_HOST}:{NCORE_PORT}"

# Backend info cache
pycore_info: Optional[Dict[str, Any]] = None
ncore_info: Optional[Dict[str, Any]] = None


# ============================================================
# Backend Health Checks
# ============================================================

def check_pycore_backend() -> bool:
    """Check if PyCore backend is available"""
    try:
        response = requests.post(
            f"{PYCORE_URL}/backend_info",
            json={},
            timeout=2
        )
        return response.status_code == 200
    except Exception:
        return False


def check_ncore_backend() -> bool:
    """Check if NCore backend is available"""
    try:
        response = requests.get(
            f"{NCORE_URL}/health",
            timeout=2
        )
        return response.status_code == 200
    except Exception:
        return False


def get_pycore_info() -> Dict[str, Any]:
    """Get PyCore backend information"""
    global pycore_info

    if pycore_info is not None:
        return pycore_info

    try:
        response = requests.post(
            f"{PYCORE_URL}/backend_info",
            json={},
            timeout=5
        )

        if response.status_code == 200:
            result = response.json()

            # Handle different response formats
            if "result" in result:
                backend_data = result["result"]
            elif "backend_id" in result:
                backend_data = result
            else:
                backend_data = {"backend_id": "unknown"}

            pycore_info = backend_data
            return pycore_info

    except Exception as e:
        logger.error(f"[Proxy] Failed to get PyCore backend info: {e}")

    return {
        "backend_id": "error",
        "status": "unavailable",
        "error": "Cannot connect to PyCore backend"
    }


def get_ncore_info() -> Dict[str, Any]:
    """Get NCore backend information"""
    global ncore_info

    if ncore_info is not None:
        return ncore_info

    try:
        response = requests.get(
            f"{NCORE_URL}/health",
            timeout=5
        )

        if response.status_code == 200:
            result = response.json()
            ncore_info = result
            return ncore_info

    except Exception as e:
        logger.error(f"[Proxy] Failed to get NCore backend info: {e}")

    return {
        "status": "error",
        "error": "Cannot connect to NCore backend"
    }


# ============================================================
# HTTP Proxy Functions
# ============================================================

async def call_pycore_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """
    Forward tool call to PyCore backend via HTTP

    Args:
        tool_name: Tool name (e.g., 'get_file_info')
        **kwargs: Tool parameters

    Returns:
        Tool result from backend
    """
    try:
        # Forward to PyCore backend at /mcp/{tool_name}
        response = requests.post(
            f"{PYCORE_URL}/{tool_name}",
            json=kwargs,
            timeout=60  # Longer timeout for OCR operations
        )
        response.raise_for_status()
        result = response.json()
        return result

    except requests.exceptions.Timeout:
        logger.error(f"[Proxy] PyCore backend timeout for {tool_name}")
        return {
            "success": False,
            "error": "PyCore backend processing timeout",
            "backend_url": PYCORE_URL
        }
    except requests.exceptions.ConnectionError:
        logger.error(f"[Proxy] Cannot connect to PyCore backend: {PYCORE_URL}")
        return {
            "success": False,
            "error": "Cannot connect to PyCore backend. Is pycore_module_caller running?",
            "backend_url": PYCORE_URL,
            "hint": "Run: python pycore_module_caller.py"
        }
    except Exception as e:
        logger.error(f"[Proxy] PyCore backend call failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "backend_url": PYCORE_URL
        }


async def call_ncore_tool(endpoint: str, **kwargs) -> Dict[str, Any]:
    """
    Forward tool call to NCore backend via HTTP

    Args:
        endpoint: API endpoint (e.g., '/file/get_info')
        **kwargs: Tool parameters

    Returns:
        Tool result from backend
    """
    try:
        # Forward to NCore backend
        response = requests.post(
            f"{NCORE_URL}{endpoint}",
            json=kwargs,
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        return result

    except requests.exceptions.Timeout:
        logger.error(f"[Proxy] NCore backend timeout for {endpoint}")
        return {
            "success": False,
            "error": "NCore backend processing timeout",
            "backend_url": NCORE_URL
        }
    except requests.exceptions.ConnectionError:
        logger.error(f"[Proxy] Cannot connect to NCore backend: {NCORE_URL}")
        return {
            "success": False,
            "error": "Cannot connect to NCore backend. Is ncore_backend_main running?",
            "backend_url": NCORE_URL,
            "hint": "Run: python ncore/ncore_backend_main.py"
        }
    except Exception as e:
        logger.error(f"[Proxy] NCore backend call failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "backend_url": NCORE_URL
        }


# ============================================================
# MCP Server Setup
# ============================================================

def start_mcp_proxy():
    """Start unified MCP proxy server"""
    from pycore.pyfoundations.third_party import get_third_package_FastMCP
    FastMCP = get_third_package_FastMCP()

    # Check backends availability
    pycore_available = check_pycore_backend()
    ncore_available = check_ncore_backend()

    if not pycore_available and not ncore_available:
        logger.error("[Proxy] NO backends available!")
        logger.error(f"[Proxy] PyCore: {PYCORE_URL}")
        logger.error(f"[Proxy] NCore: {NCORE_URL}")
        logger.error("[Proxy] Please start at least one backend:")
        logger.error("[Proxy]   python pycore_module_caller.py  (PyCore, port 59000)")
        logger.error("[Proxy]   python ncore/ncore_backend_main.py  (NCore, port 58000)")
        raise RuntimeError("No backends available")

    # Get backend info
    pycore_backend = get_pycore_info() if pycore_available else None
    ncore_backend = get_ncore_info() if ncore_available else None

    logger.info("=" * 70)
    logger.info("[Proxy] Unified MCP Proxy (Dual Backend Mode)")
    logger.info("=" * 70)

    if pycore_available:
        pycore_id = pycore_backend.get("backend_id", "unknown")
        logger.info(f"[Proxy] PyCore Backend: {PYCORE_URL}")
        logger.info(f"[Proxy] PyCore ID: {pycore_id}")
    else:
        logger.warning(f"[Proxy] PyCore Backend: OFFLINE ({PYCORE_URL})")

    if ncore_available:
        logger.info(f"[Proxy] NCore Backend: {NCORE_URL}")
        logger.info(f"[Proxy] NCore Status: {ncore_backend.get('status', 'unknown')}")
    else:
        logger.warning(f"[Proxy] NCore Backend: OFFLINE ({NCORE_URL})")

    logger.info("=" * 70)

    # Create FastMCP server
    mcp = FastMCP("Unified MCP Proxy", version="3.0.0")

    # ========================================
    # Local Test Tool
    # ========================================

    @mcp.tool()
    async def mcp_proxy_ping(message: str = "hello") -> dict:
        """
        Test tool (local, no backend required).

        Args:
            message: Test message to echo back

        Returns:
            Echo response with proxy info
        """
        return {
            "success": True,
            "mode": "unified_dual_backend_proxy",
            "message": f"Proxy echo: {message}",
            "backends": {
                "pycore": {
                    "url": PYCORE_URL,
                    "available": pycore_available,
                    "backend_id": pycore_backend.get("backend_id") if pycore_backend else None
                },
                "ncore": {
                    "url": NCORE_URL,
                    "available": ncore_available
                }
            },
            "platform": platform.system(),
            "python_version": platform.python_version()
        }

    # ========================================
    # PyCore Backend Tools (forwarded)
    # ========================================

    if pycore_available:
        @mcp.tool()
        async def img_ocr_doc_allfile_parser_info_tool(
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
            Parse and extract info from all file types: images (OCR), documents (PDF, Office), with color analysis.

            [PyCore Backend Tool]

            Supports: PNG, JPG, BMP (OCR) | PDF (text, tables, images) | DOCX, XLSX, PPTX (content extraction)

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
            return await call_pycore_tool(
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

    # ========================================
    # NCore Backend Tools (forwarded)
    # ========================================

    if ncore_available:
        @mcp.tool()
        async def ncore_file_get_info_tool(file_path: str) -> dict:
            """
            Get advanced file information using NCore backend.

            [NCore Backend Tool]

            Args:
                file_path: Path to file to analyze

            Returns:
                Advanced file information
            """
            return await call_ncore_tool(
                "/file/get_info",
                file_path=file_path
            )

        @mcp.tool()
        async def ncore_codebase_scan_tool(target_path: str = "", max_depth: int = 5) -> dict:
            """
            Scan codebase directory tree using NCore backend.

            [NCore Backend Tool]

            Args:
                target_path: Path to scan (default: project root)
                max_depth: Maximum directory depth

            Returns:
                Directory tree structure
            """
            return await call_ncore_tool(
                "/codebase/directory_tree",
                target_path=target_path,
                max_depth=max_depth
            )

        @mcp.tool()
        async def ncore_placeholder_generate_tool(
            image_path: str,
            width: int,
            height: int,
            placeholder_type: str = "unsplash_image"
        ) -> dict:
            """
            Generate placeholder image using NCore backend.

            [NCore Backend Tool]

            Args:
                image_path: Output path for placeholder
                width: Image width
                height: Image height
                placeholder_type: Type of placeholder

            Returns:
                Placeholder generation result
            """
            return await call_ncore_tool(
                "/placeholder/generate",
                image_path=image_path,
                width=width,
                height=height,
                placeholder_type=placeholder_type
            )

    # Count tools
    tool_count = 1  # mcp_proxy_ping
    if pycore_available:
        tool_count += 1
    if ncore_available:
        tool_count += 3

    logger.info(f"[Proxy] Registered {tool_count} MCP tools")
    logger.info(f"[Proxy]   - mcp_proxy_ping (local)")
    if pycore_available:
        logger.info(f"[Proxy]   - img_ocr_doc_allfile_parser_info_tool (PyCore)")
    if ncore_available:
        logger.info(f"[Proxy]   - ncore_file_get_info_tool (NCore)")
        logger.info(f"[Proxy]   - ncore_codebase_scan_tool (NCore)")
        logger.info(f"[Proxy]   - ncore_placeholder_generate_tool (NCore)")
    logger.info("[Proxy] Running proxy server (unified dual backend mode)...")

    # Run proxy
    mcp.run(show_banner=False, log_level="INFO")


def main():
    """Main entry point"""
    try:
        start_mcp_proxy()
    except KeyboardInterrupt:
        logger.info("\n[Proxy] Shutting down (Ctrl+C)...")
    except Exception as e:
        logger.error(f"[Proxy] Fatal error: {e}")
        logger.error("[Proxy] Make sure backends are running:")
        logger.error("[Proxy]   python pycore_module_caller.py  (PyCore, port 59000)")
        logger.error("[Proxy]   python ncore/ncore_backend_main.py  (NCore, port 58000)")
        raise


if __name__ == "__main__":
    main()
