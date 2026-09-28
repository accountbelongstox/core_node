# -*- coding: utf-8 -*-
"""Codebase Handlers (8 tools)"""

from typing import Dict, Any
from pycore.pyctl.mcpctl.backend.handlers.context import get_codebase_context

async def handle_codebase_get_directory_tree_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase get directory tree tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.get_directory_tree_with_multiple_formats(
            target_path=params.get("target_path"),
            max_depth=params.get("max_depth", 5),
            include_files=params.get("include_files", True),
            include_hidden=params.get("include_hidden", False),
            output_format=params.get("output_format", "both")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_find_files_by_pattern_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase find files by pattern tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.find_files_by_pattern(
            filename_pattern=params.get("filename_pattern"),
            search_path=params.get("search_path"),
            exact_match=params.get("exact_match", False),
            case_sensitive=params.get("case_sensitive", False),
            max_results=params.get("max_results", 100)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_search_content_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase search content tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.search_content_in_files(
            search_text=params.get("search_text"),
            search_path=params.get("search_path"),
            file_pattern=params.get("file_pattern"),
            case_sensitive=params.get("case_sensitive", False),
            context_lines=params.get("context_lines", 0),
            max_results=params.get("max_results", 100)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_get_file_content_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase get file content tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.get_file_content_with_comprehensive_analysis(
            file_path=params.get("file_path"),
            max_chars=params.get("max_chars", 16000),
            include_ocr=params.get("include_ocr", True),
            include_color_analysis=params.get("include_color_analysis", True),
            include_document_metadata=params.get("include_document_metadata", True)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_analyze_statistics_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase analyze statistics tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.analyze_codebase_statistics(
            target_path=params.get("target_path")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_describe_directory_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase describe directory tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.describe_directory_with_summary(
            directory_path=params.get("directory_path"),
            include_file_count=params.get("include_file_count", True),
            include_size_stats=params.get("include_size_stats", True),
            include_type_distribution=params.get("include_type_distribution", True)
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_scan_framework_apps_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase scan framework apps tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.scan_for_framework_applications(
            scan_path=params.get("scan_path")
        )
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}


async def handle_codebase_health_check_async(params: Dict[str, Any], request_id: str = None, context: Dict = None) -> Dict[str, Any]:
    """Codebase health check tool handler"""
    backend_info, codebase_controller = get_codebase_context()
    try:
        result = await codebase_controller.health_check()
        result["backend_id"] = backend_info.get("backend_id", "unknown")
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "backend_id": backend_info.get("backend_id", "unknown")}
