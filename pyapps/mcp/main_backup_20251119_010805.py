#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Unified Server - Main Entry Point
Consolidates all MCP services: File Processing + Database + Codebase Analysis

Unified from:
- MCPFileProcessingV2 (file analysis, OCR, document parsing)
- McpAlchemy (database operations with namespace management)
- CodebaseScanner + CodebaseContentHub (codebase analysis)

Singleton Pattern:
    All controllers use singleton pattern for efficient resource management

Usage:
    python3 ./pymain.py app=mcp

Environment Variables:
    MCP_ALLOW_ALL_PATHS=true  - Enable global filesystem access
    MCP_PROJECT_ROOT=/path    - Set project root directory
"""

import logging
import os
import sys
from pathlib import Path
from typing import Optional, Dict, List, Any

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.stdio_utils import ensure_stdio_has_buffer_attributes

# Expose project root to downstream MCP components
os.environ.setdefault("MCP_PROJECT_ROOT", str(PROJECT_ROOT))

# Note: ColorPrint MCP mode is automatically enabled by pymain.py when app=mcp is detected
# No need to call ColorPrint.enable_mcp_mode() here

from pycore.pyfoundations.third_party import get_third_package_FastMCP, get_third_package_Context

# Ensure fastmcp can wrap sys.stdout/sys.stderr even when the host replaces the
# streams with raw BufferedWriter objects (common in sandboxed CLIs).
ensure_stdio_has_buffer_attributes()

# Configure logging for MCP STDIO mode
# INFO level is useful for debugging, just ensure clean formatting
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",  # Simple format: INFO     message
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("pyapps.mcp")

FastMCP = get_third_package_FastMCP()
Context = get_third_package_Context()

# Import controllers
from pyapps.mcp.controller import (
    get_file_info_controller_singleton,
    get_database_controller_singleton,
    get_codebase_controller_singleton
)


# Singleton instances
_mcp_server_instance: Optional[FastMCP] = None


def get_mcp_server_singleton() -> FastMCP:
    """Get singleton instance of unified MCP server"""
    global _mcp_server_instance
    if _mcp_server_instance is None:
        _mcp_server_instance = _initialize_unified_mcp_server()
    return _mcp_server_instance


def _initialize_unified_mcp_server() -> FastMCP:
    """Initialize unified MCP server with all tools from all subsystems"""
    # Note: log_level parameter is deprecated in FastMCP 2.13+
    # It should be passed to run() instead
    mcp = FastMCP(
        "MCP Unified Server",
        version="2.0.0"
    )

    # Get all controller singletons
    file_controller = get_file_info_controller_singleton()
    db_controller = get_database_controller_singleton()
    codebase_controller = get_codebase_controller_singleton()

    # Register all tools
    _register_file_processing_tools(mcp, file_controller)
    _register_database_tools(mcp, db_controller)
    _register_codebase_tools(mcp, codebase_controller)

    # Reduced log level to avoid STDIO output clutter
    logger.debug("MCP Unified Server initialized with 19 tools across 3 subsystems")

    return mcp


def _register_file_processing_tools(mcp: FastMCP, controller) -> None:
    """Register file processing tools (4 tools)"""

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
        return await controller.get_file_info_with_comprehensive_analysis(
            file_path=file_path,
            options={
                "use_cache": use_cache,
                "include_pixel_matrix": include_pixel_matrix,
                "ocr_model_type": ocr_model_type,
                "num_colors": num_colors,
                "extract_images": extract_images,
                "extract_tables": extract_tables,
                "extract_hyperlinks": extract_hyperlinks
            }
        )

    @mcp.tool()
    async def generate_placeholder_image_with_ocr_tool(
        original_image_path: str,
        output_path: str,
        placeholder_text: str = None,
        background_color: str = "#CCCCCC",
        text_color: str = "#333333",
        font_size: int = 20
    ) -> dict:
        """
        Generate placeholder image using OCR text from original image.

        Args:
            original_image_path: Path to original image
            output_path: Path to save placeholder image
            placeholder_text: Override text (if None, use OCR from original)
            background_color: Background color (default: "#CCCCCC")
            text_color: Text color (default: "#333333")
            font_size: Font size (default: 20)
        """
        return await controller.generate_placeholder_image(
            original_image_path=original_image_path,
            output_path=output_path,
            placeholder_text=placeholder_text,
            style_options={
                "background_color": background_color,
                "text_color": text_color,
                "font_size": font_size
            }
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
        Query file processing history from database cache.

        Args:
            file_type: Filter by file type (image, pdf, docx, xlsx, pptx)
            date_from: Start date filter (ISO format)
            date_to: End date filter (ISO format)
            limit: Maximum results (default: 100)
            offset: Offset for pagination (default: 0)
        """
        return await controller.query_processing_history(
            file_type=file_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset
        )

    @mcp.tool()
    async def clear_file_cache_tool(file_path: str = None) -> dict:
        """
        Clear cached file information from database.

        Args:
            file_path: Specific file path to clear (if None, prompts for confirmation)
        """
        return await controller.clear_cache(file_path=file_path)


def _register_database_tools(mcp: FastMCP, controller) -> None:
    """Register database management tools (7 tools)"""

    @mcp.tool()
    async def database_namespace_negotiation_tool(
        client_identifier: str = "default_client",
        custom_namespace: str = None
    ) -> dict:
        """
        Create or negotiate a database namespace for the client.

        Args:
            client_identifier: Client ID (e.g., "claude_desktop", "cursor", "vscode")
            custom_namespace: Optional custom namespace name

        Returns:
            Session info with namespace, session_key, and metadata
        """
        return await controller.create_and_negotiate_namespace(
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
        Register a database connection to a namespace.

        Args:
            namespace: Namespace identifier
            database_name: Friendly database name
            connection_string: SQLAlchemy connection string
                Examples:
                - SQLite: "sqlite:///path/to/db.db"
                - MySQL: "mysql://user:pass@localhost/dbname"
                - PostgreSQL: "postgresql://user:pass@localhost/dbname"

        Returns:
            Registration result with database identifier
        """
        return await controller.register_database_connection(
            namespace=namespace,
            database_name=database_name,
            connection_string=connection_string
        )

    @mcp.tool()
    async def database_execute_query_with_safety_tool(
        namespace: str,
        database_name: str,
        query: str,
        params: Dict[str, Any] = None,
        max_rows: int = 1000,
        timeout_seconds: int = 30
    ) -> dict:
        """
        Execute SQL query with comprehensive safety checks.

        Args:
            namespace: Namespace identifier
            database_name: Database name
            query: SQL query to execute
            params: Query parameters for parameterized queries
            max_rows: Maximum rows to return (default: 1000)
            timeout_seconds: Query timeout in seconds (default: 30)

        Returns:
            Query results with metadata and execution stats
        """
        return await controller.execute_safe_query(
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
        data: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> dict:
        """
        Execute batch database operations efficiently.

        Args:
            namespace: Namespace identifier
            database_name: Database name
            operation_type: Type - 'insert', 'update', 'delete', 'upsert'
            table_name: Target table name
            data: List of data dictionaries
            batch_size: Operations per batch (default: 100)

        Returns:
            Batch operation results with total processed count
        """
        return await controller.execute_batch_operations(
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
        Get database schema information with table and column details.

        Args:
            namespace: Namespace identifier
            database_name: Database name
            table_pattern: Optional SQL LIKE pattern to filter tables

        Returns:
            Schema information including tables, columns, types, constraints
        """
        return await controller.get_database_schema(
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
        Get database statistics including row counts and sizes.

        Args:
            namespace: Namespace identifier
            database_name: Database name

        Returns:
            Statistics for all tables with row counts and column counts
        """
        return await controller.get_database_statistics(
            namespace=namespace,
            database_name=database_name
        )

    @mcp.tool()
    async def database_health_check_tool() -> dict:
        """
        Perform health check on database subsystem.

        Returns:
            Health status, active namespaces, connections, recent queries
        """
        return await controller.health_check()


def _register_codebase_tools(mcp: FastMCP, controller) -> None:
    """Register codebase analysis tools (8 tools)"""

    @mcp.tool()
    async def codebase_get_directory_tree_tool(
        target_path: str = None,
        max_depth: int = 5,
        include_files: bool = True,
        include_hidden: bool = False,
        output_format: str = "both"
    ) -> dict:
        """
        Generate directory tree structure in multiple formats.

        Args:
            target_path: Path to scan (defaults to project root)
            max_depth: Maximum recursion depth (default: 5)
            include_files: Include files in tree (default: True)
            include_hidden: Include hidden files/directories (default: False)
            output_format: Format - "json", "text", "markdown", "both" (default: "both")

        Returns:
            Directory tree in requested format(s) with metadata
        """
        return await controller.get_directory_tree_with_multiple_formats(
            target_path=target_path,
            max_depth=max_depth,
            include_files=include_files,
            include_hidden=include_hidden,
            output_format=output_format
        )

    @mcp.tool()
    async def codebase_find_files_by_pattern_tool(
        filename_pattern: str,
        search_path: str = None,
        exact_match: bool = False,
        case_sensitive: bool = False,
        max_results: int = 100
    ) -> dict:
        """
        Find files by filename or regex pattern.

        Args:
            filename_pattern: Filename or regex pattern to search for
            search_path: Path to search in (defaults to project root)
            exact_match: Only exact matches (default: False)
            case_sensitive: Case-sensitive search (default: False)
            max_results: Maximum results (default: 100)

        Returns:
            Search results with file paths, sizes, and metadata
        """
        return await controller.find_files_by_pattern(
            filename_pattern=filename_pattern,
            search_path=search_path,
            exact_match=exact_match,
            case_sensitive=case_sensitive,
            max_results=max_results
        )

    @mcp.tool()
    async def codebase_search_content_tool(
        search_text: str,
        search_path: str = None,
        file_pattern: str = None,
        case_sensitive: bool = False,
        context_lines: int = 0,
        max_results: int = 100
    ) -> dict:
        """
        Search for text content within files.

        Args:
            search_text: Text or regex to search for
            search_path: Path to search in (defaults to project root)
            file_pattern: Regex pattern to filter files (e.g., ".*\\.py$")
            case_sensitive: Case-sensitive search (default: False)
            context_lines: Number of context lines before/after matches (default: 0)
            max_results: Maximum files to return (default: 100)

        Returns:
            Search results with file paths, line numbers, and content matches
        """
        return await controller.search_content_in_files(
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
        Get file content with comprehensive analysis (integrates with file processing).

        For images: OCR, color analysis, metadata
        For documents: Text extraction, metadata, page info
        For code/text: Content with syntax detection

        Args:
            file_path: Path to file
            max_chars: Maximum characters to return (default: 16000)
            include_ocr: Include OCR for images (default: True)
            include_color_analysis: Include color analysis for images (default: True)
            include_document_metadata: Include document metadata (default: True)

        Returns:
            Comprehensive file analysis based on file type
        """
        return await controller.get_file_content_with_comprehensive_analysis(
            file_path=file_path,
            max_chars=max_chars,
            include_ocr=include_ocr,
            include_color_analysis=include_color_analysis,
            include_document_metadata=include_document_metadata
        )

    @mcp.tool()
    async def codebase_analyze_statistics_tool(
        target_path: str = None
    ) -> dict:
        """
        Get comprehensive codebase statistics.

        Args:
            target_path: Path to analyze (defaults to project root)

        Returns:
            Statistics including file counts, sizes, type distribution, language analysis
        """
        return await controller.analyze_codebase_statistics(
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
        Describe directory with file overview and statistics.

        Args:
            directory_path: Path to directory
            include_file_count: Include file counts (default: True)
            include_size_stats: Include size statistics (default: True)
            include_type_distribution: Include file type distribution (default: True)

        Returns:
            Directory description with comprehensive statistics
        """
        return await controller.describe_directory_with_summary(
            directory_path=directory_path,
            include_file_count=include_file_count,
            include_size_stats=include_size_stats,
            include_type_distribution=include_type_distribution
        )

    @mcp.tool()
    async def codebase_scan_framework_apps_tool(
        scan_path: str = None
    ) -> dict:
        """
        Scan for common framework applications (Flutter, Vue, React, Laravel, etc.).

        Args:
            scan_path: Path to scan (defaults to project root)

        Returns:
            Detected frameworks and application structures
        """
        return await controller.scan_for_framework_applications(
            scan_path=scan_path
        )

    @mcp.tool()
    async def codebase_health_check_tool() -> dict:
        """
        Perform health check on codebase subsystem.

        Returns:
            Health status, project root, global access setting, utilities status
        """
        return await controller.health_check()


# Module-level singleton access
mcp_server = get_mcp_server_singleton()


def start() -> bool:
    """Launch the unified MCP server"""
    # Reduced log level to avoid STDIO output clutter in MCP mode
    logger.debug(
        "MCP UNIFIED SERVER v2.0.0 | Project Root: %s | Subsystems: File Processing (4 tools), "
        "Database (7 tools), Codebase (8 tools) | Total Tools: 19",
        PROJECT_ROOT
    )
    logger.debug("Launching unified MCP server...")

    # Run the FastMCP server with clean output for STDIO mode
    # - show_banner=False: Disable FastMCP startup banner (too verbose)
    # - log_level="INFO": Keep useful INFO logs (FastMCP 2.13+ recommended way)
    mcp_server.run(show_banner=False, log_level="INFO")
    return True


def main() -> None:
    """Compatibility wrapper for direct execution"""
    success = start()
    if not success:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
