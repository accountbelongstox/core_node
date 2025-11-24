#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified MCP Server (NCore Edition) - Independent Implementation

Completely independent MCP server without pycore dependencies.
Provides unified access to PyCore and NCore backends via HTTP proxy.

Backends:
- PyCore Backend (localhost:59000) - File processing, Database, Codebase
- NCore Backend (localhost:58000) - Browser automation, Advanced tools

Usage:
    python ncore/mcpserver/unifiedmcp/main.py

    # Or via pymain.py:
    python pymain.py app=mcp
"""

import os
import sys
import logging
import platform
from pathlib import Path
from typing import Optional, Dict, Any, List
import json

# STDIO compatibility fix (inline implementation)
import io


def ensure_stdio_has_buffer_attributes():
    """Ensure stdin/stdout have buffer attributes required by MCP"""
    if not hasattr(sys.stdin, 'buffer'):
        try:
            sys.stdin = io.TextIOWrapper(
                io.BufferedReader(io.FileIO(sys.stdin.fileno(), 'rb')),
                encoding='utf-8',
                line_buffering=True
            )
        except (AttributeError, OSError):
            sys.stdin.buffer = io.BytesIO()

    if not hasattr(sys.stdout, 'buffer'):
        try:
            sys.stdout = io.TextIOWrapper(
                io.BufferedWriter(io.FileIO(sys.stdout.fileno(), 'wb')),
                encoding='utf-8',
                line_buffering=True
            )
        except (AttributeError, OSError):
            sys.stdout.buffer = io.BytesIO()

    if not hasattr(sys.stderr, 'buffer'):
        try:
            sys.stderr = io.TextIOWrapper(
                io.BufferedWriter(io.FileIO(sys.stderr.fileno(), 'wb')),
                encoding='utf-8',
                line_buffering=True
            )
        except (AttributeError, OSError):
            sys.stderr.buffer = io.BytesIO()


# Ensure STDIO compatibility
ensure_stdio_has_buffer_attributes()

# Third-party imports
import requests
from mcp.server.fastmcp import FastMCP

# Configure logging (use stderr for MCP compatibility)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("unified_mcp")


# ============================================================
# Configuration
# ============================================================

class BackendConfig:
    """Backend configuration"""

    # PyCore Backend
    PYCORE_HOST = os.environ.get("PYCORE_BACKEND_HOST", "localhost")
    PYCORE_PORT = int(os.environ.get("PYCORE_BACKEND_PORT", "59000"))
    PYCORE_URL = f"http://{PYCORE_HOST}:{PYCORE_PORT}/mcp"

    # NCore Backend
    NCORE_HOST = os.environ.get("NCORE_BACKEND_HOST", "localhost")
    NCORE_PORT = int(os.environ.get("NCORE_BACKEND_PORT", "58000"))
    NCORE_URL = f"http://{NCORE_HOST}:{NCORE_PORT}"

    # Timeouts
    HEALTH_CHECK_TIMEOUT = 2
    TOOL_CALL_TIMEOUT = 120

    # Retry settings
    MAX_RETRIES = 3
    RETRY_DELAY = 1


# Backend status cache
class BackendStatus:
    """Backend status tracker"""

    def __init__(self):
        self.backends = {
            "pycore": {
                "available": False,
                "info": None,
                "last_check": None
            },
            "ncore": {
                "available": False,
                "info": None,
                "last_check": None
            }
        }

    def update(self, backend: str, available: bool, info: Optional[Dict] = None):
        """Update backend status"""
        import time
        self.backends[backend]["available"] = available
        self.backends[backend]["info"] = info
        self.backends[backend]["last_check"] = time.time()

    def is_available(self, backend: str) -> bool:
        """Check if backend is available"""
        return self.backends[backend]["available"]

    def get_info(self, backend: str) -> Optional[Dict]:
        """Get backend info"""
        return self.backends[backend]["info"]


backend_status = BackendStatus()


# ============================================================
# Backend Health Checks
# ============================================================

def check_pycore_backend() -> bool:
    """Check if PyCore backend is available"""
    try:
        response = requests.post(
            f"{BackendConfig.PYCORE_URL}/backend_info",
            json={},
            timeout=BackendConfig.HEALTH_CHECK_TIMEOUT
        )
        if response.status_code == 200:
            backend_status.update("pycore", True, response.json())
            return True
    except Exception as e:
        logger.debug(f"PyCore backend check failed: {e}")

    backend_status.update("pycore", False)
    return False


def check_ncore_backend() -> bool:
    """Check if NCore backend is available"""
    try:
        response = requests.get(
            f"{BackendConfig.NCORE_URL}/health",
            timeout=BackendConfig.HEALTH_CHECK_TIMEOUT
        )
        if response.status_code == 200:
            backend_status.update("ncore", True, response.json())
            return True
    except Exception as e:
        logger.debug(f"NCore backend check failed: {e}")

    backend_status.update("ncore", False)
    return False


def check_all_backends() -> Dict[str, bool]:
    """Check all backends and return status"""
    return {
        "pycore": check_pycore_backend(),
        "ncore": check_ncore_backend()
    }


# ============================================================
# HTTP Proxy Functions
# ============================================================

async def call_pycore_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """
    Forward tool call to PyCore backend

    Args:
        tool_name: Tool name (e.g., 'get_file_info')
        **kwargs: Tool parameters

    Returns:
        Tool result from backend
    """
    try:
        response = requests.post(
            f"{BackendConfig.PYCORE_URL}/{tool_name}",
            json=kwargs,
            timeout=BackendConfig.TOOL_CALL_TIMEOUT
        )
        response.raise_for_status()
        return response.json()

    except requests.exceptions.Timeout:
        logger.error(f"PyCore backend timeout for {tool_name}")
        return {
            "success": False,
            "error": f"PyCore backend timeout for {tool_name}",
            "backend": "pycore",
            "tool": tool_name
        }

    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to PyCore backend: {BackendConfig.PYCORE_URL}")
        return {
            "success": False,
            "error": "Cannot connect to PyCore backend",
            "hint": "Start backend: python pycore_module_caller.py",
            "backend": "pycore",
            "url": BackendConfig.PYCORE_URL
        }

    except Exception as e:
        logger.error(f"PyCore backend call failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "backend": "pycore"
        }


async def call_ncore_tool(endpoint: str, method: str = "POST", **kwargs) -> Dict[str, Any]:
    """
    Forward tool call to NCore backend

    Args:
        endpoint: API endpoint (e.g., '/api/call')
        method: HTTP method (GET or POST)
        **kwargs: Tool parameters

    Returns:
        Tool result from backend
    """
    try:
        url = f"{BackendConfig.NCORE_URL}{endpoint}"

        if method.upper() == "GET":
            response = requests.get(url, params=kwargs, timeout=BackendConfig.TOOL_CALL_TIMEOUT)
        else:
            response = requests.post(url, json=kwargs, timeout=BackendConfig.TOOL_CALL_TIMEOUT)

        response.raise_for_status()
        return response.json()

    except requests.exceptions.Timeout:
        logger.error(f"NCore backend timeout for {endpoint}")
        return {
            "success": False,
            "error": f"NCore backend timeout for {endpoint}",
            "backend": "ncore",
            "endpoint": endpoint
        }

    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to NCore backend: {BackendConfig.NCORE_URL}")
        return {
            "success": False,
            "error": "Cannot connect to NCore backend",
            "hint": "Start backend: node ncore/index.js",
            "backend": "ncore",
            "url": BackendConfig.NCORE_URL
        }

    except Exception as e:
        logger.error(f"NCore backend call failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "backend": "ncore"
        }


# ============================================================
# MCP Server Setup
# ============================================================

def start_unified_mcp():
    """Start unified MCP server"""

    # Check backends (but don't fail startup if unavailable)
    backends = check_all_backends()

    # Display status
    logger.info("=" * 70)
    logger.info("Unified MCP Server (Independent Edition)")
    logger.info("=" * 70)

    if backends["pycore"]:
        info = backend_status.get_info("pycore")
        backend_id = info.get("backend_id", "unknown") if info else "unknown"
        logger.info(f"✓ PyCore Backend: {BackendConfig.PYCORE_URL}")
        logger.info(f"  Backend ID: {backend_id}")
    else:
        logger.warning(f"✗ PyCore Backend: OFFLINE ({BackendConfig.PYCORE_URL})")

    if backends["ncore"]:
        info = backend_status.get_info("ncore")
        status = info.get("status", "unknown") if info else "unknown"
        logger.info(f"✓ NCore Backend:  {BackendConfig.NCORE_URL}")
        logger.info(f"  Status: {status}")
    else:
        logger.warning(f"✗ NCore Backend:  OFFLINE ({BackendConfig.NCORE_URL})")

    logger.info("=" * 70)

    # Create FastMCP server
    mcp = FastMCP("Unified MCP")

    # ========================================
    # System Tools
    # ========================================

    @mcp.tool()
    async def mcp_server_status(detailed: bool = False) -> dict:
        """
        Get MCP server status and backend availability.

        Args:
            detailed: Include detailed backend information

        Returns:
            Server status with backend info
        """
        # Refresh backend status
        check_all_backends()

        status = {
            "server": "Unified MCP (Independent)",
            "version": "1.0.0",
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "backends": {
                "pycore": {
                    "url": BackendConfig.PYCORE_URL,
                    "available": backend_status.is_available("pycore")
                },
                "ncore": {
                    "url": BackendConfig.NCORE_URL,
                    "available": backend_status.is_available("ncore")
                }
            }
        }

        if detailed:
            status["backends"]["pycore"]["info"] = backend_status.get_info("pycore")
            status["backends"]["ncore"]["info"] = backend_status.get_info("ncore")

        return status

    # ========================================
    # PyCore Backend Tools
    # ========================================

    @mcp.tool()
    async def file_info_parser(
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
        Parse and extract info from files: images (OCR), documents (PDF, Office).

        [PyCore Backend Tool]

        Supports:
        - Images: PNG, JPG, BMP (OCR with CnOCR)
        - PDFs: Text, metadata, tables, images, hyperlinks
        - Office: DOCX, XLSX, PPTX (content, tables, formulas)

        Args:
            file_path: Local file system path
            use_cache: Use database caching (default: True)
            include_pixel_matrix: Include pixel matrix (default: False)
            ocr_model_type: OCR model type (default: "general")
            num_colors: Dominant colors to extract (default: 10)
            extract_images: Extract embedded images (default: True)
            extract_tables: Extract tables (default: True)
            extract_hyperlinks: Extract hyperlinks (default: True)

        Returns:
            Comprehensive file information
        """
        # Check backend availability at call-time
        if not backend_status.is_available("pycore"):
            return {
                "success": False,
                "error": "PyCore backend is not available",
                "hint": "Start backend: python pycore_module_caller.py",
                "backend": "pycore",
                "url": BackendConfig.PYCORE_URL
            }

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
    # NCore Backend Tools
    # ========================================

    @mcp.tool()
    async def ncore_module_call(
        module: str,
        function: str,
        args: List = None,
        kwargs: Dict = None
    ) -> dict:
        """
        Call a Node.js module function via NCore backend.

        [NCore Backend Tool]

        Args:
            module: Node.js module path (e.g., 'ncore/utils/browser')
            function: Function name to call
            args: Positional arguments (optional)
            kwargs: Keyword arguments (optional)

        Returns:
            Function execution result
        """
        # Check backend availability at call-time
        if not backend_status.is_available("ncore"):
            return {
                "success": False,
                "error": "NCore backend is not available",
                "hint": "Start backend: node ncore/index.js",
                "backend": "ncore",
                "url": BackendConfig.NCORE_URL
            }

        return await call_ncore_tool(
            "/api/call",
            module=module,
            function=function,
            args=args or [],
            kwargs=kwargs or {}
        )

    @mcp.tool()
    async def ncore_browser_action(
        action: str,
        params: Dict = None
    ) -> dict:
        """
        Control browser automation via NCore backend.

        [NCore Backend Tool - Browser Automation]

        Actions:
        - status: Get browser status
        - launch: Launch browser
        - navigate: Navigate to URL
        - screenshot: Take screenshot
        - execute: Execute JavaScript
        - close: Close browser

        Args:
            action: Browser action to perform
            params: Action parameters (optional)

        Returns:
            Action execution result
        """
        # Check backend availability at call-time
        if not backend_status.is_available("ncore"):
            return {
                "success": False,
                "error": "NCore backend is not available",
                "hint": "Start backend: node ncore/index.js",
                "backend": "ncore",
                "url": BackendConfig.NCORE_URL
            }

        return await call_ncore_tool(
            "/api/browser/action",
            action=action,
            params=params or {}
        )

    # All tools are always registered (4 tools total)
    logger.info("Registered 4 MCP tools:")
    logger.info("  - mcp_server_status (local)")
    logger.info(f"  - file_info_parser (PyCore) {'[AVAILABLE]' if backends['pycore'] else '[OFFLINE]'}")
    logger.info(f"  - ncore_module_call (NCore) {'[AVAILABLE]' if backends['ncore'] else '[OFFLINE]'}")
    logger.info(f"  - ncore_browser_action (NCore) {'[AVAILABLE]' if backends['ncore'] else '[OFFLINE]'}")

    logger.info("")
    logger.info("Starting MCP server (STDIO mode)...")
    logger.info("=" * 70)

    # Run server
    mcp.run()


def main():
    """Main entry point"""
    try:
        start_unified_mcp()
    except KeyboardInterrupt:
        logger.info("\nShutting down (Ctrl+C)...")
    except Exception as e:
        logger.error(f"\nFatal error: {e}")
        logger.error("\nMake sure backends are running:")
        logger.error("  python pycore_module_caller.py  (PyCore)")
        logger.error("  node ncore/index.js             (NCore)")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
