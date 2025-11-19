#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Proxy (Multi-Instance Mode)

Lightweight proxy that forwards MCP requests to singleton backend via RPC.
- Displays backend ID on startup (verify singleton)
- Forwards tool calls via RPC (HTTP/WebSocket)
- Transparent to AI (AI sees normal MCP tools)

Backend Architecture:
    Proxy (Multi-Instance) → RPC → Backend (Singleton)
    - Backend: python -m pycore.pyctl.mcpctl.mcp_backend_main
    - Proxy: python pymain.py app=mcp
"""

import os
import sys
import logging
import asyncio
import time
import platform
import threading
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

# Backend thread handle (auto-started backend using launcher.py)
backend_thread: Optional[threading.Thread] = None
backend_info: Optional[Dict[str, Any]] = None


def start_backend_thread() -> bool:
    """
    Start backend in background thread using launcher.py singleton mechanism

    Uses pycore.pyctl.mcpctl.mcp_backend_main.start_mcp_backend()
    Backend uses launcher.py for singleton detection (port 58000-58099).

    Returns:
        True if backend thread started successfully
    """
    global backend_thread

    logger.info("[Proxy] Starting MCP backend thread (singleton mode via launcher.py)...")

    try:
        # Import backend starter (uses launcher.py)
        from pycore.pyctl.mcpctl.mcp_backend_main import start_mcp_backend

        # Start backend in daemon thread
        backend_thread = threading.Thread(
            target=start_mcp_backend,
            name="MCPBackendThread",
            daemon=True  # Daemon thread will exit when main thread exits
        )
        backend_thread.start()

        logger.info(f"[Proxy] Backend thread started (Thread: {backend_thread.name})")
        return True

    except Exception as e:
        logger.error(f"[Proxy] Failed to start backend thread: {e}")
        return False


def wait_for_backend_ready(max_wait: int = 10) -> bool:
    """
    Wait for backend to be ready (singleton detection + RPC startup)

    Args:
        max_wait: Maximum wait time in seconds

    Returns:
        True if backend is ready
    """
    logger.info("[Proxy] Waiting for backend to be ready...")

    for i in range(max_wait):
        try:
            response = requests.post(
                f"{BACKEND_URL}/rpc/backend_info",
                json={},
                timeout=1
            )

            if response.status_code == 200:
                logger.info(f"[Proxy] Backend ready after {i+1}s")
                return True

        except Exception:
            pass

        time.sleep(1)

    logger.error(f"[Proxy] Backend not ready after {max_wait}s")
    return False


def ensure_backend_running() -> Dict[str, Any]:
    """
    Ensure backend is running (auto-start if needed)

    Flow:
    1. Check if backend is already running
    2. If not, start backend process (singleton mode)
    3. Wait for backend to be ready
    4. Get backend info and return

    Returns:
        Backend info dict with backend_id
    """
    global backend_info

    # Try to connect to existing backend
    try:
        response = requests.post(
            f"{BACKEND_URL}/rpc/backend_info",
            json={},
            timeout=2
        )

        if response.status_code == 200:
            # Backend is running, get info
            result = response.json()

            # Handle RPC async response
            if result.get("requires_ack"):
                request_id = result.get("id")
                time.sleep(1.5)

                response = requests.post(
                    f"{BACKEND_URL}/rpc/backend_info",
                    json={"id": request_id},
                    timeout=2
                )
                result = response.json()

            # Extract backend info
            backend_data = result.get("result", {})
            backend_id = backend_data.get("backend_id", "unknown")

            logger.info(f"[Proxy] Connected to existing backend ID: {backend_id}")
            backend_info = backend_data
            return backend_info

    except Exception as e:
        logger.debug(f"[Proxy] No existing backend: {e}")

    # Backend not running, auto-start it
    logger.info("[Proxy] Backend not found, auto-starting...")

    if not start_backend_thread():
        logger.error("[Proxy] Failed to start backend thread")
        return {
            "backend_id": "error",
            "status": "failed_to_start",
            "error": "Failed to start backend thread"
        }

    # Wait for backend to be ready
    if not wait_for_backend_ready():
        logger.error("[Proxy] Backend startup timeout")
        return {
            "backend_id": "error",
            "status": "startup_timeout",
            "error": "Backend startup timeout"
        }

    # Get backend info after startup
    try:
        response = requests.post(
            f"{BACKEND_URL}/rpc/backend_info",
            json={},
            timeout=2
        )
        result = response.json()

        # Handle RPC async response
        if result.get("requires_ack"):
            request_id = result.get("id")
            time.sleep(1.5)

            response = requests.post(
                f"{BACKEND_URL}/rpc/backend_info",
                json={"id": request_id},
                timeout=2
            )
            result = response.json()

        # Extract backend info
        backend_data = result.get("result", {})
        backend_id = backend_data.get("backend_id", "unknown")

        logger.info(f"[Proxy] Backend started successfully, ID: {backend_id}")
        backend_info = backend_data
        return backend_info

    except Exception as e:
        logger.error(f"[Proxy] Failed to get backend info: {e}")
        return {
            "backend_id": "error",
            "status": "info_failed",
            "error": str(e)
        }


async def call_backend_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """
    Forward tool call to backend via RPC with async result handling

    RPC Flow (v2 with sync support):
    1. Send request → Get response
    2. If sync_response=true → Return immediately (< 100ms)
    3. If requires_ack=true → Wait and retry (async processing)

    Args:
        tool_name: Tool name (e.g., 'get_file_info')
        **kwargs: Tool parameters

    Returns:
        Tool result from backend
    """
    debug_print(f"Forwarding {tool_name} to backend: {kwargs}", "Proxy")

    try:
        # Step 1: Send initial request
        response = requests.post(
            f"{BACKEND_URL}/rpc/{tool_name}",
            json=kwargs,
            timeout=30
        )
        response.raise_for_status()
        initial_result = response.json()

        debug_print(f"Backend initial response: {initial_result}", "Proxy")

        # ✅ Check if sync response (RPC v2 sync routes)
        if initial_result.get("sync_response"):
            logger.info(f"[Proxy] Sync response received for {tool_name} (immediate return)")
            # Return result immediately (no waiting)
            return initial_result

        # Check if requires ACK (async processing)
        if initial_result.get("requires_ack"):
            request_id = initial_result.get("id")
            logger.info(f"[Proxy] Async response, waiting for result (id: {request_id})")

            # Step 2: Wait for backend processing
            await asyncio.sleep(1.5)  # Wait for processing

            # Step 3: Query result with same request_id
            max_retries = 3
            for attempt in range(max_retries):
                result_response = requests.post(
                    f"{BACKEND_URL}/rpc/{tool_name}",
                    json={"id": request_id, **kwargs},  # Use same id
                    timeout=30
                )
                result_response.raise_for_status()
                result = result_response.json()

                debug_print(f"Backend result (attempt {attempt+1}): {result}", "Proxy")

                # If still requires_ack, wait and retry
                if result.get("requires_ack"):
                    if attempt < max_retries - 1:
                        await asyncio.sleep(0.5)
                        continue
                    else:
                        return {
                            "success": False,
                            "error": "Backend processing timeout",
                            "request_id": request_id
                        }
                else:
                    # Got actual result
                    return result

        # Direct result (no ACK required, not marked as sync)
        return initial_result

    except Exception as e:
        logger.error(f"[Proxy] Backend call failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "backend_url": BACKEND_URL
        }


def start_mcp_proxy():
    """Start MCP proxy server"""
    from pycore.pyfoundations.third_party import get_third_package_FastMCP
    FastMCP = get_third_package_FastMCP()

    # Ensure backend is running (auto-start if needed)
    info = ensure_backend_running()
    backend_id = info.get("backend_id", "unknown")

    if backend_id == "error":
        logger.error("[Proxy] Failed to start/connect to backend")
        logger.error(f"[Proxy] Error: {info.get('error', 'Unknown error')}")
        raise RuntimeError("Backend not available")

    logger.info(f"[Proxy] Starting MCP Proxy (Backend ID: {backend_id})")

    # Create FastMCP server
    mcp = FastMCP("MCP Proxy", version="1.0.0")

    # Register local test tool (no backend needed - for comparison)
    @mcp.tool()
    async def mcp_proxy_ping_tool(message: str = "hello") -> dict:
        """
        Test tool that runs locally in the proxy (no backend needed).

        Use this to verify MCP server is working correctly.

        Args:
            message: Test message to echo back (default: "hello")

        Returns:
            Echo response with proxy info
        """
        return {
            "success": True,
            "mode": "local",
            "backend_required": False,
            "message": f"Proxy echo: {message}",
            "proxy_info": {
                "backend_id": backend_id,
                "backend_url": BACKEND_URL,
                "platform": platform.system(),
                "python_version": platform.python_version()
            }
        }

    # Register tools (transparent to AI)
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

        Supports: PNG, JPG, BMP (OCR) | PDF (text, tables, images) | DOCX, XLSX, PPTX (content extraction)

        Images: OCR text with positions, color palette, dimensions, pixel matrix (optional)
        PDFs: Text extraction with positions, metadata, tables, embedded images, hyperlinks
        Office: Text content, paragraphs, metadata, tables, formulas, Excel sheets

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
        # Forward to backend RPC (AI doesn't know about this)
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

    logger.info("[Proxy] MCP tools registered (2 tools)")
    logger.info("[Proxy]   - mcp_proxy_ping_tool (local, no backend)")
    logger.info("[Proxy]   - img_ocr_doc_allfile_parser_info_tool (via RPC)")
    logger.info("[Proxy] Running proxy server...")

    # Run proxy
    mcp.run(show_banner=False, log_level="INFO")


def cleanup_backend():
    """Cleanup backend thread on exit"""
    global backend_thread

    if backend_thread is not None and backend_thread.is_alive():
        logger.info(f"[Proxy] Backend thread cleanup (Thread: {backend_thread.name})")
        # Daemon thread will automatically exit when main thread exits
        # Just wait a bit for graceful shutdown
        backend_thread.join(timeout=2)
        logger.info("[Proxy] Backend thread cleanup complete")


def main():
    """Main entry point"""
    import atexit

    # Register cleanup handler
    atexit.register(cleanup_backend)

    try:
        start_mcp_proxy()
    except KeyboardInterrupt:
        logger.info("\n[Proxy] Shutting down (Ctrl+C)...")
        cleanup_backend()
    except Exception as e:
        logger.error(f"[Proxy] Fatal error: {e}")
        cleanup_backend()
        raise


if __name__ == "__main__":
    main()
