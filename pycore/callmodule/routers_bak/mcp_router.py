# -*- coding: utf-8 -*-
"""
MCP Router - MCP backend routes integrated into pycore_module_caller

All MCP tools are now available via /mcp/* routes on the unified backend.
This eliminates the need for separate MCP backend process.
"""

import logging
import copy
from typing import Dict, Any
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider
from pycore.pyfoundations.third_party import get_third_package_fastapi

import uuid
import time
from pyapps.mcp.controller import (
    get_codebase_controller_singleton,
    get_database_controller_singleton,
    get_file_info_controller_singleton,
)
from pycore.pyctl.mcpctl.backend.config import BACKEND_INFO_TEMPLATE


fastapi = get_third_package_fastapi()
APIRouter = fastapi.APIRouter

from pycore.pyctl.mcpctl.backend import handlers
from pycore.pyctl.mcpctl.backend.handlers.context import set_handler_context
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict, get_global_state

# Use standard logging instead of ColorPrint (MCP standards requirement)
logger = logging.getLogger(__name__)

# Create router with /mcp prefix
mcp_router = APIRouter(prefix="/mcp", tags=["MCP Backend"])

def _initialize_mcp_backend() -> Dict[str, Any]:
    """Initialize MCP controllers on the serialized provider owner."""
    get_global_state()

    # Initialize backend info

    backend_id = str(uuid.uuid4())[:8]
    backend_metadata = BACKEND_INFO_TEMPLATE.copy()
    backend_metadata["backend_id"] = backend_id
    backend_metadata["singleton_port"] = 59000
    backend_metadata["rpc_port"] = 59000
    backend_metadata["status"] = "running"
    backend_metadata["start_time"] = int(time.time())

    # Initialize controllers
    file_controller = get_file_info_controller_singleton()
    db_controller = get_database_controller_singleton()
    codebase_controller = get_codebase_controller_singleton()

    set_handler_context(
        backend_metadata,
        file_controller,
        db_controller,
        codebase_controller,
    )

    logger.info(f"[MCP Backend] Initialized (ID: {backend_id}, integrated into port 59000)")

    return backend_metadata


_MCP_BACKEND_PROVIDER = SerializedSingletonProvider(
    _initialize_mcp_backend,
    "callmodule.mcp_backend.provider",
    "MCPBackendProviderThread",
    timeout=300.0,
)


def ensure_mcp_backend_initialized() -> Dict[str, Any]:
    """Return detached metadata for the initialized MCP backend."""
    return copy.deepcopy(_MCP_BACKEND_PROVIDER.get())


# ============================================================
# Meta Routes
# ============================================================

@mcp_router.post("/backend_info")
async def backend_info(params: Dict[str, Any] = None):
    """Get backend information (ID, ports, status)"""
    ensure_mcp_backend_initialized()
    if params is None:
        params = {}
    result = handlers.handle_backend_info(params, None, None)
    return result


@mcp_router.post("/backend_state")
async def backend_state(params: Dict[str, Any] = None):
    """Get backend processing state (IDLE/BUSY)"""
    ensure_mcp_backend_initialized()
    result = get_backend_state_dict()
    return result


@mcp_router.post("/tools_list")
async def tools_list(params: Dict[str, Any] = None):
    """List all available MCP tools"""
    backend_info = ensure_mcp_backend_initialized()
    tools = backend_info.get("tools", [])
    return {"tools": tools}


# ============================================================
# File Processing Routes
# ============================================================

@mcp_router.post("/get_file_info")
async def get_file_info(params: Dict[str, Any]):
    """Extract file info with OCR/document parsing"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_get_file_info_async(params, None, None)
    return result


@mcp_router.post("/generate_placeholder_image")
async def generate_placeholder_image(params: Dict[str, Any]):
    """Generate placeholder image"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_generate_placeholder_image_async(params, None, None)
    return result


@mcp_router.post("/query_file_processing_history")
async def query_file_processing_history(params: Dict[str, Any]):
    """Query file processing history"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_query_file_processing_history_async(params, None, None)
    return result


@mcp_router.post("/clear_file_cache")
async def clear_file_cache(params: Dict[str, Any]):
    """Clear file processing cache"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_clear_file_cache_async(params, None, None)
    return result


@mcp_router.post("/clear_file_cache_tool")
async def clear_file_cache_tool(params: Dict[str, Any]):
    """Clear file cache (alias)"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_clear_file_cache_async(params, None, None)
    return result


# ============================================================
# Database Routes
# ============================================================

@mcp_router.post("/database_namespace_negotiation")
async def database_namespace_negotiation(params: Dict[str, Any]):
    """Database namespace negotiation"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_namespace_negotiation_async(params, None, None)
    return result


@mcp_router.post("/database_register_and_connect")
async def database_register_and_connect(params: Dict[str, Any]):
    """Register and connect to database"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_register_and_connect_async(params, None, None)
    return result


@mcp_router.post("/database_execute_query")
async def database_execute_query(params: Dict[str, Any]):
    """Execute database query"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_execute_query_async(params, None, None)
    return result


@mcp_router.post("/database_batch_operations")
async def database_batch_operations(params: Dict[str, Any]):
    """Database batch operations"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_batch_operations_async(params, None, None)
    return result


@mcp_router.post("/database_schema_inspection")
async def database_schema_inspection(params: Dict[str, Any]):
    """Database schema inspection"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_schema_inspection_async(params, None, None)
    return result


@mcp_router.post("/database_get_statistics")
async def database_get_statistics(params: Dict[str, Any]):
    """Get database statistics"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_get_statistics_async(params, None, None)
    return result


@mcp_router.post("/database_health_check")
async def database_health_check(params: Dict[str, Any]):
    """Database health check"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_database_health_check_async(params, None, None)
    return result


# ============================================================
# Codebase Routes
# ============================================================

@mcp_router.post("/codebase_get_directory_tree")
async def codebase_get_directory_tree(params: Dict[str, Any]):
    """Get codebase directory tree"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_get_directory_tree_async(params, None, None)
    return result


@mcp_router.post("/codebase_find_files_by_pattern")
async def codebase_find_files_by_pattern(params: Dict[str, Any]):
    """Find files by pattern"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_find_files_by_pattern_async(params, None, None)
    return result


@mcp_router.post("/codebase_search_content")
async def codebase_search_content(params: Dict[str, Any]):
    """Search content in codebase"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_search_content_async(params, None, None)
    return result


@mcp_router.post("/codebase_get_file_content")
async def codebase_get_file_content(params: Dict[str, Any]):
    """Get file content"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_get_file_content_async(params, None, None)
    return result


@mcp_router.post("/codebase_analyze_statistics")
async def codebase_analyze_statistics(params: Dict[str, Any]):
    """Analyze codebase statistics"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_analyze_statistics_async(params, None, None)
    return result


@mcp_router.post("/codebase_describe_directory")
async def codebase_describe_directory(params: Dict[str, Any]):
    """Describe directory structure"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_describe_directory_async(params, None, None)
    return result


@mcp_router.post("/codebase_scan_framework_apps")
async def codebase_scan_framework_apps(params: Dict[str, Any]):
    """Scan framework apps"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_scan_framework_apps_async(params, None, None)
    return result


@mcp_router.post("/codebase_health_check")
async def codebase_health_check(params: Dict[str, Any]):
    """Codebase health check"""
    ensure_mcp_backend_initialized()
    result = await handlers.handle_codebase_health_check_async(params, None, None)
    return result


__all__ = ['mcp_router']
