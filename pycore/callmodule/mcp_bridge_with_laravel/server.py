#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from ocr_engines import ocr_manager, OCRResult
from ocr_queue_system import ocr_queue, TaskPriority
from ocr_config import OCRLimits, ProcessingConfig
from image_processor import SmartImageProcessor
from pdf_processor import PDFProcessor
from code_scanner import scanner as code_scanner
"""
File Processor MCP Server - core server module.

Extracted from main.py (split into sibling sub-modules). Owns the FastMCP
singleton, logging (stderr-only for MCP JSON-RPC stdout protocol), runtime
globals (ocr_manager/ocr_queue/OCR_AVAILABLE/code_scanner), the parser/converter
singletons, path-validation helpers, OCR engine initialization, health_check tool,
and the main() entry point. Each tool group is registered by a register_*_tools(mcp)
function imported from its sibling module; analyze_image_pixels is registered here.
"""

import importlib
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# FastMCP framework
from pycore.pyfoundations.third_party.api import get_third_package_FastMCP

import tempfile
import glob


FastMCP = get_third_package_FastMCP()

# Initialize MCP server singleton
mcp = FastMCP("FileProcessor")

# Configure logging.
# IMPORTANT: Use stderr for logging to avoid interfering with MCP JSON-RPC on stdout.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)  # Use stderr instead of stdout for MCP compatibility
    ]
)
logger = logging.getLogger(__name__)

# Import OCR engines and queue system (logger is already configured above so the
# except blocks can log safely -- fixes a latent NameError in the original ordering).
try:
    OCR_AVAILABLE = True
except ImportError as e:
    logger.warning(f"OCR engines not available: {e}")
    OCR_AVAILABLE = False
    ocr_manager = None
    ocr_queue = None

# Import code scanner
try:
    CODE_SCANNER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Code scanner not available: {e}")
    CODE_SCANNER_AVAILABLE = False
    code_scanner = None

# Import split sub-modules (classes + tool-register functions).
from package_manager import PackageManager
from document_converter import DocumentConverter
from document_parser import DocumentParser
from image_pixel_analysis import analyze_image_pixels
from mcp_tools_document import register_document_tools
from mcp_tools_ocr import register_ocr_tools
from mcp_tools_image import register_image_tools
from mcp_tools_code import register_code_tools

# Initialize parser and converter singletons (referenced by tool functions via
# function-local `from server import parser, converter`).
parser = DocumentParser()
converter = DocumentConverter()

# Initialize OCR queue system
if OCR_AVAILABLE and ocr_queue:
    ocr_queue.start_processing()
    logger.info("OCR queue system started")

# Initialize packages in background
PackageManager.initialize_all_packages()

# Register all MCP tool groups against the shared mcp singleton.
register_document_tools(mcp)
register_ocr_tools(mcp)
register_image_tools(mcp)
register_code_tools(mcp)

# analyze_image_pixels is a standalone function (not a register_* group); register
# it directly. mcp.tool() returns the decorator that registers the function.
mcp.tool()(analyze_image_pixels)


@mcp.tool()
def health_check() -> Dict[str, Any]:
    """Check server health and package availability"""
    try:
        status = {
            "server": "healthy",
            "packages": {},
            "capabilities": [],
            "converters": []
        }

        # Check package availability
        for format_type, packages in PackageManager.PACKAGE_MAPPING.items():
            format_status = {}
            for package in packages:
                try:
                    importlib.import_module(package.replace('-', '_').replace('python_', ''))
                    format_status[package] = "available"
                except ImportError:
                    format_status[package] = "missing"

            status["packages"][format_type] = format_status

            # Determine capabilities
            available_packages = sum(1 for s in format_status.values() if s == "available")
            if available_packages >= len(packages) // 2 + 1:
                status["capabilities"].append(format_type)

        # Check converter capabilities
        for conversion in converter.conversion_mappings:
            status["converters"].append(conversion)

        # Check OCR availability
        status["ocr"] = {
            "available": OCR_AVAILABLE,
            "engines": ocr_manager.get_available_engines() if OCR_AVAILABLE else [],
            "queue_system": ocr_queue is not None and ocr_queue.is_running if OCR_AVAILABLE else False,
            "smart_features": {
                "image_compression": True,
                "pdf_splitting": True,
                "queue_processing": True,
                "batch_support": True,
                "2d_queue_support": True
            } if OCR_AVAILABLE else {}
        }

        # Add OCR system stats if available
        if OCR_AVAILABLE and ocr_queue:
            try:
                ocr_stats = ocr_queue.get_system_stats()
                status["ocr"]["system_stats"] = ocr_stats
            except Exception as e:
                status["ocr"]["system_stats_error"] = str(e)

        # Add image pixel analysis capability
        status["image_pixel_analysis"] = {
            "available": True,
            "supported_regions": [
                "full", "left", "center", "right",
                "top-left", "top-center", "top-right",
                "middle-left", "middle-center", "middle-right",
                "bottom-left", "bottom-center", "bottom-right",
                "custom:x1,y1,x2,y2"
            ],
            "features": {
                "region_extraction": True,
                "batch_regions": True,
                "deduplication": True,
                "sampling_strategies": ["random", "uniform", "grid", "edge"],
                "color_tolerance": True,
                "coordinate_tracking": True,
                "frequency_statistics": True,
                "performance_optimization": True,
                "file_export": True
            },
            "output_formats": ["hex", "rgb", "both"],
            "exchange_directory": "{project_root}/.cache/file_processor"
        }

        # Add code scanner capability
        status["code_scanner"] = {
            "available": CODE_SCANNER_AVAILABLE,
            "features": {
                "chinese_detection": True,
                "recursive_scanning": True,
                "multi_encoding_support": True,
                "extension_filtering": True,
                "depth_limiting": True,
                "smart_exclusions": True
            },
            "supported_languages": [
                "JavaScript/TypeScript", "Python", "Dart", "Vue",
                "Java/Kotlin", "Go", "Shell", "PowerShell",
                "C/C++", "C#", "Ruby", "PHP", "Rust", "Swift",
                "Scala", "R", "Perl", "Lua", "SQL", "HTML/CSS"
            ],
            "total_extensions": 60,
            "output_formats": ["text", "json"]
        } if CODE_SCANNER_AVAILABLE else {"available": False}

        return status

    except Exception as e:
        return {"server": "error", "error": str(e)}


def _initialize_ocr_engines():
    """Initialize all available OCR engines on startup"""
    try:

        # Check if this is a restart/reconnection scenario
        restart_file = Path("tmp_mcp_restart_marker")
        is_restart = restart_file.exists()

        if is_restart:
            logger.info("Detected MCP restart - handling reconnection scenario")
            restart_file.unlink()  # Remove restart marker
        else:
            logger.info("Fresh MCP startup - initializing OCR engines")

        ocr_manager = OCRManager()

        # Get available engines to check what's installed
        available_engines = ocr_manager.get_available_engines()
        logger.info(f"Available OCR engines: {available_engines}")

        # Try to initialize PaddleOCR first
        if 'paddle' in available_engines:
            try:
                if ocr_manager.initialize_paddle_ocr():
                    logger.info("PaddleOCR initialized successfully")
                else:
                    logger.warning("PaddleOCR initialization failed")
            except Exception as e:
                logger.warning(f"PaddleOCR initialization error: {e}")

        # Try to initialize CnOCR (with fallback models)
        if 'cnocr' in available_engines:
            model_types_to_try = ["general", "scene", "doc"]
            cnocr_initialized = False

            for model_type in model_types_to_try:
                try:
                    if ocr_manager.initialize_cnocr(model_type):
                        logger.info(f"CnOCR initialized successfully with {model_type} model")
                        cnocr_initialized = True
                        break
                except Exception as e:
                    logger.warning(f"CnOCR {model_type} model initialization error: {e}")

            if not cnocr_initialized:
                logger.warning("All CnOCR model initialization attempts failed")

        # Free OCR doesn't need initialization
        if 'free' in available_engines:
            logger.info("Free OCR service available")

        # Clean up any temporary files from previous sessions
        _cleanup_temp_files()

        logger.info("OCR engines initialization completed")

    except Exception as e:
        logger.error(f"OCR engines initialization failed: {e}")


def _normalize_file_path(file_path: str) -> str:
    """Normalize file path for better compatibility with Chinese characters and Windows paths"""
    try:
        # Convert to absolute path
        normalized = os.path.abspath(file_path)

        # Handle Windows path separators
        if os.name == 'nt':
            normalized = normalized.replace('/', '\\')

        # Ensure proper encoding for Chinese characters
        if isinstance(normalized, str):
            normalized = normalized.encode('utf-8').decode('utf-8')

        return normalized
    except Exception as e:
        logger.warning(f"Path normalization warning: {e}")
        return file_path


def _validate_image_file(file_path: str) -> bool:
    """Validate that image file exists and is accessible"""
    try:
        if not os.path.exists(file_path):
            return False

        if not os.path.isfile(file_path):
            return False

        # Check file size (should be > 0)
        if os.path.getsize(file_path) <= 0:
            return False

        # Check file extension
        valid_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp']
        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext not in valid_extensions:
            logger.warning(f"Unusual image file extension: {file_ext}")

        return True
    except Exception as e:
        logger.error(f"File validation error: {e}")
        return False


def _cleanup_temp_files():
    """Clean up temporary files from previous sessions"""
    try:

        # Clean up temporary OCR files
        temp_dir = tempfile.gettempdir()
        temp_patterns = [
            "tmp_ocr_*",
            "tmp_mcp_*",
            "tmp_paddle_*",
            "tmp_cnocr_*"
        ]

        cleaned_count = 0
        for pattern in temp_patterns:
            temp_files = glob.glob(os.path.join(temp_dir, pattern))
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                    cleaned_count += 1
                except OSError:
                    pass  # File might be in use or already deleted

        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} temporary files")

    except Exception as e:
        logger.warning(f"Temporary file cleanup warning: {e}")


def _create_restart_marker():
    """Create restart marker for next startup"""
    try:
        restart_file = Path("tmp_mcp_restart_marker")
        restart_file.touch()
        logger.info("Created restart marker for next startup")
    except Exception as e:
        logger.warning(f"Failed to create restart marker: {e}")


def main():
    """Main MCP server function using FastMCP"""
    try:
        logger.info("Starting Document Parser MCP Server...")
        logger.info("Supported formats: PDF, XMind, Word, Excel, PowerPoint, Images, Text")

        # Initialize OCR engines proactively
        logger.info("Initializing OCR engines...")
        _initialize_ocr_engines()

        # Start FastMCP server
        logger.info("[FASTMCP] Starting FastMCP Document Parser server...")
        mcp.run()

    except KeyboardInterrupt:
        logger.info("[STOP] Server stopped by user")
        _create_restart_marker()
    except Exception as e:
        logger.error(f"[ERROR] Server startup failed: {e}")
        _create_restart_marker()
        raise
