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


def check_all_backends() -> Dict[str, bool]:
    """Check all backends and return status"""
    return {
        "pycore": check_pycore_backend()
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
        logger.info("  All 19 tools available via HTTP proxy")
    else:
        logger.warning(f"✗ PyCore Backend: OFFLINE ({BackendConfig.PYCORE_URL})")
        logger.warning("  PyCore backend tools will be unavailable")
        logger.warning("  Start backend: python pycore_module_caller.py")

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
                    "available": backend_status.is_available("pycore"),
                    "tools_count": 19
                }
            }
        }

        if detailed:
            status["backends"]["pycore"]["info"] = backend_status.get_info("pycore")

        return status

    # ========================================
    # PyCore Backend Tools - File Processing (4 tools)
    # ========================================

    @mcp.tool()
    async def imgocr_doc_file_parser_info_tool(
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

    @mcp.tool()
    async def generate_placeholder_image_with_ocr_tool(
        original_image_path: str,
        output_path: str,
        placeholder_text: str,
        background_color: str = "#CCCCCC",
        text_color: str = "#333333",
        font_size: int = 20
    ) -> dict:
        """
        Generate placeholder image with text overlay.

        Args:
            original_image_path: Path to original image
            output_path: Path to save placeholder image
            placeholder_text: Text to display on placeholder
            background_color: Background color (default: #CCCCCC)
            text_color: Text color (default: #333333)
            font_size: Font size (default: 20)

        Returns:
            Operation result
        """
        return await call_pycore_tool(
            "generate_placeholder_image",
            original_image_path=original_image_path,
            output_path=output_path,
            placeholder_text=placeholder_text,
            background_color=background_color,
            text_color=text_color,
            font_size=font_size
        )

    @mcp.tool()
    async def query_file_processing_history_tool(
        file_type: str = None,
        date_from: str = None,
        date_to: str = None,
        limit: int = 100,
        offset: int = 0
    ) -> dict:
        """
        Query file processing history from database.

        Args:
            file_type: Filter by file type (optional)
            date_from: Start date filter (optional)
            date_to: End date filter (optional)
            limit: Max results to return (default: 100)
            offset: Results offset for pagination (default: 0)

        Returns:
            Processing history records
        """
        return await call_pycore_tool(
            "query_file_processing_history",
            file_type=file_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset
        )

    @mcp.tool()
    async def clear_file_cache_tool(
        file_path: str = None
    ) -> dict:
        """
        Clear file processing cache.

        Args:
            file_path: Specific file path to clear cache (optional, clears all if not provided)

        Returns:
            Operation result
        """
        return await call_pycore_tool(
            "clear_file_cache",
            file_path=file_path
        )

    # ========================================
    # PyCore Backend Tools - Database (7 tools)
    # ========================================

    @mcp.tool()
    async def database_namespace_negotiation_tool(
        client_identifier: str = "default_client",
        custom_namespace: str = None
    ) -> dict:
        """
        Negotiate database namespace for multi-client access.

        Args:
            client_identifier: Client identifier (default: default_client)
            custom_namespace: Custom namespace (optional)

        Returns:
            Namespace assignment result
        """
        return await call_pycore_tool(
            "database_namespace_negotiation",
            client_identifier=client_identifier,
            custom_namespace=custom_namespace
        )

    @mcp.tool()
    async def database_register_and_connect_tool(
        namespace: str,
        database_name: str,
        connection_string: str
    ) -> dict:
        """
        Register and connect to database.

        Args:
            namespace: Database namespace
            database_name: Database name
            connection_string: Connection string (SQLAlchemy format)

        Returns:
            Connection result
        """
        return await call_pycore_tool(
            "database_register_and_connect",
            namespace=namespace,
            database_name=database_name,
            connection_string=connection_string
        )

    @mcp.tool()
    async def database_execute_query_with_safety_tool(
        namespace: str,
        database_name: str,
        query: str,
        params: dict = None,
        max_rows: int = 1000,
        timeout_seconds: int = 30
    ) -> dict:
        """
        Execute database query with safety checks.

        Args:
            namespace: Database namespace
            database_name: Database name
            query: SQL query to execute
            params: Query parameters (optional)
            max_rows: Maximum rows to return (default: 1000)
            timeout_seconds: Query timeout (default: 30)

        Returns:
            Query execution result
        """
        return await call_pycore_tool(
            "database_execute_query",
            namespace=namespace,
            database_name=database_name,
            query=query,
            params=params,
            max_rows=max_rows,
            timeout_seconds=timeout_seconds
        )

    @mcp.tool()
    async def database_batch_operations_tool(
        namespace: str,
        database_name: str,
        operation_type: str,
        table_name: str,
        data: list,
        batch_size: int = 100
    ) -> dict:
        """
        Execute batch database operations (INSERT, UPDATE, DELETE).

        Args:
            namespace: Database namespace
            database_name: Database name
            operation_type: Operation type (insert, update, delete)
            table_name: Target table name
            data: Data list for batch operation
            batch_size: Batch size (default: 100)

        Returns:
            Batch operation result
        """
        return await call_pycore_tool(
            "database_batch_operations",
            namespace=namespace,
            database_name=database_name,
            operation_type=operation_type,
            table_name=table_name,
            data=data,
            batch_size=batch_size
        )

    @mcp.tool()
    async def database_schema_inspection_tool(
        namespace: str,
        database_name: str,
        table_pattern: str = None
    ) -> dict:
        """
        Inspect database schema (tables, columns, indexes).

        Args:
            namespace: Database namespace
            database_name: Database name
            table_pattern: Table name pattern filter (optional)

        Returns:
            Schema information
        """
        return await call_pycore_tool(
            "database_schema_inspection",
            namespace=namespace,
            database_name=database_name,
            table_pattern=table_pattern
        )

    @mcp.tool()
    async def database_get_statistics_tool(
        namespace: str,
        database_name: str
    ) -> dict:
        """
        Get database statistics (table counts, row counts, sizes).

        Args:
            namespace: Database namespace
            database_name: Database name

        Returns:
            Database statistics
        """
        return await call_pycore_tool(
            "database_get_statistics",
            namespace=namespace,
            database_name=database_name
        )

    @mcp.tool()
    async def database_health_check_tool() -> dict:
        """
        Check database service health status.

        Returns:
            Health status
        """
        return await call_pycore_tool("database_health_check")

    # ========================================
    # PyCore Backend Tools - Codebase (8 tools)
    # ========================================

    @mcp.tool()
    async def codebase_get_directory_tree_tool(
        target_path: str,
        max_depth: int = 5,
        include_files: bool = True,
        include_hidden: bool = False,
        output_format: str = "both"
    ) -> dict:
        """
        Get directory tree structure.

        Args:
            target_path: Target directory path
            max_depth: Maximum depth to scan (default: 5)
            include_files: Include files in tree (default: True)
            include_hidden: Include hidden files/folders (default: False)
            output_format: Output format (tree, json, both) (default: both)

        Returns:
            Directory tree structure
        """
        return await call_pycore_tool(
            "codebase_get_directory_tree",
            target_path=target_path,
            max_depth=max_depth,
            include_files=include_files,
            include_hidden=include_hidden,
            output_format=output_format
        )

    @mcp.tool()
    async def codebase_find_files_by_pattern_tool(
        filename_pattern: str,
        search_path: str,
        exact_match: bool = False,
        case_sensitive: bool = False,
        max_results: int = 100
    ) -> dict:
        """
        Find files by filename pattern.

        Args:
            filename_pattern: Filename pattern to search
            search_path: Search root path
            exact_match: Exact match mode (default: False)
            case_sensitive: Case sensitive search (default: False)
            max_results: Maximum results to return (default: 100)

        Returns:
            Matching files list
        """
        return await call_pycore_tool(
            "codebase_find_files_by_pattern",
            filename_pattern=filename_pattern,
            search_path=search_path,
            exact_match=exact_match,
            case_sensitive=case_sensitive,
            max_results=max_results
        )

    @mcp.tool()
    async def codebase_search_content_tool(
        search_text: str,
        search_path: str,
        file_pattern: str = None,
        case_sensitive: bool = False,
        context_lines: int = 0,
        max_results: int = 100
    ) -> dict:
        """
        Search text content in files.

        Args:
            search_text: Text to search for
            search_path: Search root path
            file_pattern: File pattern filter (optional)
            case_sensitive: Case sensitive search (default: False)
            context_lines: Context lines around match (default: 0)
            max_results: Maximum results to return (default: 100)

        Returns:
            Search results with matches
        """
        return await call_pycore_tool(
            "codebase_search_content",
            search_text=search_text,
            search_path=search_path,
            file_pattern=file_pattern,
            case_sensitive=case_sensitive,
            context_lines=context_lines,
            max_results=max_results
        )

    @mcp.tool()
    async def codebase_get_file_content_tool(
        file_path: str,
        max_chars: int = 16000,
        include_ocr: bool = True,
        include_color_analysis: bool = True,
        include_document_metadata: bool = True
    ) -> dict:
        """
        Get file content with comprehensive analysis.

        Args:
            file_path: File path to read
            max_chars: Maximum characters to return (default: 16000)
            include_ocr: Include OCR for images (default: True)
            include_color_analysis: Include color analysis (default: True)
            include_document_metadata: Include document metadata (default: True)

        Returns:
            File content and analysis
        """
        return await call_pycore_tool(
            "codebase_get_file_content",
            file_path=file_path,
            max_chars=max_chars,
            include_ocr=include_ocr,
            include_color_analysis=include_color_analysis,
            include_document_metadata=include_document_metadata
        )

    @mcp.tool()
    async def codebase_analyze_statistics_tool(
        target_path: str
    ) -> dict:
        """
        Analyze codebase statistics (file counts, sizes, languages).

        Args:
            target_path: Target directory path

        Returns:
            Codebase statistics
        """
        return await call_pycore_tool(
            "codebase_analyze_statistics",
            target_path=target_path
        )

    @mcp.tool()
    async def codebase_describe_directory_tool(
        directory_path: str,
        include_file_count: bool = True,
        include_size_stats: bool = True,
        include_type_distribution: bool = True
    ) -> dict:
        """
        Describe directory with summary information.

        Args:
            directory_path: Directory path to describe
            include_file_count: Include file count (default: True)
            include_size_stats: Include size statistics (default: True)
            include_type_distribution: Include file type distribution (default: True)

        Returns:
            Directory description
        """
        return await call_pycore_tool(
            "codebase_describe_directory",
            directory_path=directory_path,
            include_file_count=include_file_count,
            include_size_stats=include_size_stats,
            include_type_distribution=include_type_distribution
        )

    @mcp.tool()
    async def codebase_scan_framework_apps_tool(
        scan_path: str
    ) -> dict:
        """
        Scan for framework applications (Laravel, Django, React, etc.).

        Args:
            scan_path: Root path to scan

        Returns:
            Detected framework applications
        """
        return await call_pycore_tool(
            "codebase_scan_framework_apps",
            scan_path=scan_path
        )

    @mcp.tool()
    async def codebase_health_check_tool() -> dict:
        """
        Check codebase service health status.

        Returns:
            Health status
        """
        return await call_pycore_tool("codebase_health_check")

    # All tools registered (20 tools total: 1 local + 19 PyCore)
    logger.info("=" * 70)
    logger.info("Registered 20 MCP tools:")
    logger.info("  [System]")
    logger.info("    1. mcp_server_status (local)")
    logger.info(f"  [File Processing - 4 tools] {'[AVAILABLE]' if backends['pycore'] else '[OFFLINE]'}")
    logger.info("    2. imgocr_doc_file_parser_info_tool")
    logger.info("    3. generate_placeholder_image_with_ocr_tool")
    logger.info("    4. query_file_processing_history_tool")
    logger.info("    5. clear_file_cache_tool")
    logger.info(f"  [Database - 7 tools] {'[AVAILABLE]' if backends['pycore'] else '[OFFLINE]'}")
    logger.info("    6. database_namespace_negotiation_tool")
    logger.info("    7. database_register_and_connect_tool")
    logger.info("    8. database_execute_query_with_safety_tool")
    logger.info("    9. database_batch_operations_tool")
    logger.info("   10. database_schema_inspection_tool")
    logger.info("   11. database_get_statistics_tool")
    logger.info("   12. database_health_check_tool")
    logger.info(f"  [Codebase - 8 tools] {'[AVAILABLE]' if backends['pycore'] else '[OFFLINE]'}")
    logger.info("   13. codebase_get_directory_tree_tool")
    logger.info("   14. codebase_find_files_by_pattern_tool")
    logger.info("   15. codebase_search_content_tool")
    logger.info("   16. codebase_get_file_content_tool")
    logger.info("   17. codebase_analyze_statistics_tool")
    logger.info("   18. codebase_describe_directory_tool")
    logger.info("   19. codebase_scan_framework_apps_tool")
    logger.info("   20. codebase_health_check_tool")

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
        logger.error("\nMake sure PyCore backend is running:")
        logger.error("  python pycore_module_caller.py  (Port 59000)")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
