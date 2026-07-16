# -*- coding: utf-8 -*-
"""
MCP Router - MCP backend routes integrated into pycore_module_caller

All MCP tools are now available via /mcp/* routes on the unified backend.
This eliminates the need for separate MCP backend process.
"""

import logging
from typing import Dict, Any
from pycore.pyfoundations.third_party import get_third_package_fastapi

import uuid
import time
from pycore.pyctl.mcpctl.backend.config import BACKEND_INFO_TEMPLATE
from pycore.pygvar import MCP_BACKEND_RPC_PORT


fastapi = get_third_package_fastapi()
APIRouter = fastapi.APIRouter

from pycore.pyctl.mcpctl.backend import handlers
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict, get_global_state

# Use standard logging instead of ColorPrint (MCP standards requirement)
logger = logging.getLogger(__name__)

# Create router with /mcp prefix
mcp_router = APIRouter(prefix="/mcp", tags=["MCP Backend"])

# Initialize global state on module load
_global_state = None
_backend_info = None
_controllers_initialized = False


def ensure_mcp_backend_initialized():
    """
    Ensure MCP backend components are initialized

    This initializes controllers and backend_info only once
    """
    global _global_state, _backend_info, _controllers_initialized

    if _controllers_initialized:
        return _backend_info

    # Initialize global state
    _global_state = get_global_state()

    # Initialize backend info

    backend_id = str(uuid.uuid4())[:8]
    _backend_info = BACKEND_INFO_TEMPLATE.copy()
    _backend_info["backend_id"] = backend_id
    _backend_info["singleton_port"] = 59000  # Integrated into pycore_module_caller
    _backend_info["rpc_port"] = 59000  # Same port as main service
    _backend_info["status"] = "running"
    _backend_info["start_time"] = int(time.time())

    # Initialize controllers
    from pyapps.mcp.controller import (
        get_file_info_controller_singleton,
        get_database_controller_singleton,
        get_codebase_controller_singleton
    )

    file_controller = get_file_info_controller_singleton()
    db_controller = get_database_controller_singleton()
    codebase_controller = get_codebase_controller_singleton()

    # Set global controllers for handlers
    handlers.file_processing.backend_info = _backend_info
    handlers.file_processing.file_controller = file_controller
    handlers.database.backend_info = _backend_info
    handlers.database.db_controller = db_controller
    handlers.codebase.backend_info = _backend_info
    handlers.codebase.codebase_controller = codebase_controller

    _controllers_initialized = True

    logger.info(f"[MCP Backend] Initialized (ID: {backend_id}, integrated into port 59000)")

    return _backend_info


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
