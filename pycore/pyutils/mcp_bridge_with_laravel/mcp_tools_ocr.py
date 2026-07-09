#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR MCP tool wrappers for the File Processor MCP Server.

Extracted from main.py. Each tool is registered against the shared mcp instance
passed into register_ocr_tools(mcp). OCR runtime globals (ocr_manager, ocr_queue,
OCR_AVAILABLE) and path helpers (_normalize_file_path, _validate_image_file) are
read via function-local imports from server to avoid stale captures and circular
imports. Polling waits delegate to ocr_queue.wait_for_* (reusable methods on the
queue singleton) instead of module-local helpers.
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Stable types (no runtime reassignment, no circular dependency) -> top-level import.
from ocr_queue_system import TaskPriority
from ocr_config import OCRLimits

logger = logging.getLogger(__name__)


def register_ocr_tools(mcp):
    """Register OCR recognition / configuration / queue MCP tools."""

    @mcp.tool()
    def ocr_recognize(
        image_path: str,
        ocr_engine: str = "auto",
        language: str = "chs",
        use_fallback: bool = True,
        confidence_threshold: int = 30,
        tencent_secret_id: Optional[str] = None,
        tencent_secret_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Perform OCR recognition on image using multiple OCR engines.

        Supported OCR engines:
        - free: Free OCR.space API (default)
        - tencent: Tencent Cloud OCR (requires credentials)
        - auto: Automatic fallback through available engines

        Args:
            image_path: Path to the image file
            ocr_engine: OCR engine to use (free, tencent, auto)
            language: Language for OCR (chs=Chinese, eng=English, auto=Auto-detect)
            use_fallback: Use fallback to other engines if primary fails
            confidence_threshold: Minimum confidence threshold for text extraction (0-100)
            tencent_secret_id: Tencent Cloud Secret ID (optional)
            tencent_secret_key: Tencent Cloud Secret Key (optional)

        Returns:
            Dictionary containing OCR results with text, confidence, and word details
        """
        try:
            # OCR runtime globals + path helpers are read function-locally.
            from server import _normalize_file_path, _validate_image_file, OCR_AVAILABLE, ocr_manager

            # Normalize file path for Chinese characters and Windows paths
            normalized_path = _normalize_file_path(image_path)
            logger.info(f"OCR recognition request: {normalized_path}, engine: {ocr_engine}")

            # Validate file exists and is accessible
            if not _validate_image_file(normalized_path):
                return {
                    "success": False,
                    "error": f"Image file not found or not accessible: {image_path}",
                    "details": "Please check the file path and ensure the file exists"
                }

            # Check if OCR is available
            if not OCR_AVAILABLE or not ocr_manager:
                return {"error": "OCR engines not available"}

            # Set Tencent credentials if provided
            if tencent_secret_id and tencent_secret_key:
                ocr_manager.set_tencent_credentials(tencent_secret_id, tencent_secret_key)

            # Prepare OCR parameters
            ocr_params = {
                'language': language,
                'confidence_threshold': confidence_threshold
            }

            # Perform OCR with enhanced fallback logic
            if ocr_engine == "auto" or use_fallback:
                available_engines = ocr_manager.get_available_engines()
                logger.info(f"Available OCR engines: {available_engines}")

                # Use normalized path for OCR processing
                ocr_result = ocr_manager.recognize_with_fallback(normalized_path, available_engines, **ocr_params)

                # If fallback also fails, try individual engines with more detailed error reporting
                if not ocr_result.success and len(available_engines) > 1:
                    logger.warning(f"Fallback OCR failed: {ocr_result.error}. Trying individual engines...")

                    for engine in available_engines:
                        try:
                            logger.info(f"Attempting OCR with {engine} engine...")
                            single_result = ocr_manager.recognize(normalized_path, engine, **ocr_params)

                            if single_result.success:
                                logger.info(f"OCR succeeded with {engine} engine")
                                ocr_result = single_result
                                break
                            else:
                                logger.warning(f"OCR failed with {engine}: {single_result.error}")
                        except Exception as engine_error:
                            logger.error(f"Engine {engine} crashed: {engine_error}")
                            continue
            else:
                ocr_result = ocr_manager.recognize(normalized_path, ocr_engine, **ocr_params)

            # Format response
            response = {
                "success": ocr_result.success,
                "provider": ocr_result.provider,
                "processing_time": ocr_result.processing_time,
                "image_path": image_path
            }

            if ocr_result.success:
                response.update({
                    "text": ocr_result.text,
                    "confidence": ocr_result.confidence,
                    "word_count": len(ocr_result.words),
                    "words": ocr_result.words[:50],  # Limit to first 50 words
                    "has_more_words": len(ocr_result.words) > 50
                })
            else:
                response["error"] = ocr_result.error

            logger.info(f"OCR completed: {response['success']}, provider: {response['provider']}")
            return response

        except Exception as e:
            error_msg = f"OCR recognition failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def configure_ocr(
        free_ocr_api_key: Optional[str] = None,
        tencent_secret_id: Optional[str] = None,
        tencent_secret_key: Optional[str] = None,
        tencent_region: str = "ap-beijing",
        test_connection: bool = False
    ) -> Dict[str, Any]:
        """
        Configure OCR engines with credentials and test connectivity.

        Args:
            free_ocr_api_key: Free OCR (OCR.space) API key
            tencent_secret_id: Tencent Cloud Secret ID
            tencent_secret_key: Tencent Cloud Secret Key
            tencent_region: Tencent Cloud region
            test_connection: Test OCR engine connectivity

        Returns:
            Dictionary containing configuration status and available engines
        """
        try:
            logger.info("Configuring OCR engines...")

            from server import OCR_AVAILABLE, ocr_manager

            if not OCR_AVAILABLE or not ocr_manager:
                return {"error": "OCR engines not available"}

            result = {
                "success": True,
                "configured_engines": [],
                "available_engines": [],
                "test_results": {}
            }

            # Configure Free OCR
            if free_ocr_api_key:
                try:
                    ocr_manager.set_free_ocr_key(free_ocr_api_key)
                    result["configured_engines"].append("free")
                    logger.info("Free OCR API key configured")
                except Exception as e:
                    result["test_results"]["free"] = {"error": str(e)}
                    logger.error(f"Free OCR configuration failed: {e}")

            # Configure Tencent Cloud
            if tencent_secret_id and tencent_secret_key:
                try:
                    ocr_manager.set_tencent_credentials(tencent_secret_id, tencent_secret_key, tencent_region)
                    result["configured_engines"].append("tencent")
                    logger.info("Tencent Cloud OCR configured")
                except Exception as e:
                    result["test_results"]["tencent"] = {"error": str(e)}
                    logger.error(f"Tencent OCR configuration failed: {e}")

            # Get available engines
            result["available_engines"] = ocr_manager.get_available_engines()

            # Test connectivity if requested
            if test_connection:
                # Create a simple test image
                test_image_path = None
                try:
                    import tempfile
                    from PIL import Image, ImageDraw, ImageFont

                    # Create test image
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                        test_image_path = tmp.name

                    # Create simple test image with text
                    img = Image.new('RGB', (200, 100), color='white')
                    draw = ImageDraw.Draw(img)
                    draw.text((10, 10), "Test OCR", fill='black')
                    img.save(test_image_path)

                    # Test each available engine
                    for engine in result["available_engines"]:
                        try:
                            test_result = ocr_manager.recognize(test_image_path, engine)
                            result["test_results"][engine] = {
                                "success": test_result.success,
                                "text": test_result.text if test_result.success else None,
                                "error": test_result.error if not test_result.success else None,
                                "processing_time": test_result.processing_time
                            }
                        except Exception as e:
                            result["test_results"][engine] = {"error": str(e)}

                except Exception as e:
                    result["test_results"]["general"] = {"error": f"Test setup failed: {e}"}
                finally:
                    # Clean up test image
                    if test_image_path and os.path.exists(test_image_path):
                        try:
                            os.unlink(test_image_path)
                        except:
                            pass

            logger.info(f"OCR configuration completed: {len(result['available_engines'])} engines available")
            return result

        except Exception as e:
            error_msg = f"OCR configuration failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def list_ocr_engines() -> Dict[str, Any]:
        """
        List all available OCR engines and their capabilities.

        Returns:
            Dictionary containing OCR engine information and capabilities
        """
        try:
            from server import OCR_AVAILABLE, ocr_manager

            if not OCR_AVAILABLE or not ocr_manager:
                return {
                    "available": False,
                    "error": "OCR engines not available",
                    "engines": {}
                }

            available_engines = ocr_manager.get_available_engines()

            engines_info = {
                "free": {
                    "name": "Free OCR",
                    "provider": "OCR.space",
                    "cost": "Free",
                    "limits": "1MB file size, rate limited",
                    "languages": ["English", "Chinese", "Auto-detect"],
                    "features": ["Text extraction", "Word coordinates", "Confidence scores"],
                    "setup_required": False
                },
                "tencent": {
                    "name": "Tencent Cloud OCR",
                    "provider": "Tencent Cloud",
                    "cost": "Paid (1000 free calls/month)",
                    "limits": "High accuracy, enterprise grade",
                    "languages": ["Chinese", "English", "Multi-language"],
                    "features": ["High accuracy", "Multi-language", "Special document types"],
                    "setup_required": True,
                    "credentials": ["TENCENT_SECRET_ID", "TENCENT_SECRET_KEY"]
                }
            }

            return {
                "available": True,
                "available_engines": available_engines,
                "total_engines": len(engines_info),
                "engines": {name: info for name, info in engines_info.items()},
                "recommendations": {
                    "for_chinese": "tencent",
                    "for_english": "free",
                    "for_production": "tencent",
                    "for_testing": "free"
                }
            }

        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def smart_ocr_recognize(
        file_paths: Union[str, List[str], List[List[str]]],
        priority: str = "normal",
        content_type: str = "general",
        batch_processing: bool = False,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Intelligent OCR recognition with smart resource management.

        Supports single files, batches, and 2D queues with automatic optimization:
        - Images are automatically compressed to meet engine limits (1MB, 720p max)
        - PDFs are split into chunks (3 pages max for free OCR)
        - Smart engine selection based on quotas and content type
        - Queue processing for large batches

        Args:
            file_paths: Single file, list of files, or 2D array [[group1], [group2]]
            priority: Processing priority ("high", "normal", "low")
            content_type: Content type hint ("chinese_text", "english_text", "mixed_content", "general")
            batch_processing: Force batch processing mode
            wait_for_completion: Wait for processing to complete
            timeout: Maximum wait time in seconds

        Returns:
            Dictionary containing OCR results or processing status
        """
        try:
            from server import OCR_AVAILABLE, ocr_queue, _normalize_file_path, _validate_image_file

            if not OCR_AVAILABLE or not ocr_queue:
                return {"error": "OCR system not available"}

            logger.info(f"Smart OCR request: {type(file_paths)} with {len(file_paths) if isinstance(file_paths, list) else 1} items")

            # Parse priority
            priority_map = {
                "high": TaskPriority.HIGH,
                "normal": TaskPriority.NORMAL,
                "low": TaskPriority.LOW
            }
            task_priority = priority_map.get(priority.lower(), TaskPriority.NORMAL)

            # Normalize all inputs to 2D array format for compatibility
            normalized_2d_queue = []

            if isinstance(file_paths, str):
                # Single file -> [[file]]
                # Normalize file path for Chinese characters and Windows paths
                normalized_path = _normalize_file_path(file_paths)
                if not _validate_image_file(normalized_path):
                    return {
                        "success": False,
                        "error": f"Image file not found or not accessible: {file_paths}",
                        "details": "Please check the file path and ensure the file exists"
                    }
                normalized_2d_queue = [[normalized_path]]
                logger.info("Single file converted to 2D queue format")

            elif isinstance(file_paths, list) and len(file_paths) > 0:
                # Check if it's already a 2D array
                is_2d = isinstance(file_paths[0], list)

                if is_2d:
                    # Already 2D format - normalize all paths in nested structure
                    normalized_2d_queue = []
                    for group in file_paths:
                        normalized_group = []
                        for file_path in group:
                            normalized_path = _normalize_file_path(file_path)
                            if _validate_image_file(normalized_path):
                                normalized_group.append(normalized_path)
                            else:
                                logger.warning(f"Skipping invalid file: {file_path}")
                        if normalized_group:  # Only add non-empty groups
                            normalized_2d_queue.append(normalized_group)
                    logger.info("Input 2D queue normalized")
                else:
                    # 1D list -> [file_paths] with normalization
                    normalized_group = []
                    for file_path in file_paths:
                        normalized_path = _normalize_file_path(file_path)
                        if _validate_image_file(normalized_path):
                            normalized_group.append(normalized_path)
                        else:
                            logger.warning(f"Skipping invalid file: {file_path}")

                    if normalized_group:
                        normalized_2d_queue = [normalized_group]
                        logger.info("1D list converted to 2D queue format")
                    else:
                        return {
                            "success": False,
                            "error": "No valid image files found in the provided list",
                            "details": "Please check that all file paths are correct and accessible"
                        }
            else:
                return {"error": "Invalid file_paths format"}

            # Process as 2D queue (all requests are now 2D arrays)
            batch_info = ocr_queue.add_2d_queue(
                queue_data=normalized_2d_queue,
                priority=task_priority
            )

            if wait_for_completion:
                # Delegate polling to the reusable queue method.
                result = ocr_queue.wait_for_batch(batch_info, timeout)
                return result
            else:
                return {
                    "success": True,
                    "mode": "2d_queue",
                    "batch_id": batch_info["batch_id"],
                    "groups": batch_info["groups"],
                    "total_files": batch_info["total_files"],
                    "status": "queued"
                }

        except Exception as e:
            error_msg = f"Smart OCR recognition failed: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    @mcp.tool()
    def get_ocr_task_status(task_id: str) -> Dict[str, Any]:
        """
        Get status of an OCR task.

        Args:
            task_id: Task ID returned from smart_ocr_recognize

        Returns:
            Dictionary containing task status and results
        """
        try:
            from server import OCR_AVAILABLE, ocr_queue

            if not OCR_AVAILABLE or not ocr_queue:
                return {"error": "OCR system not available"}

            status = ocr_queue.get_task_status(task_id)
            if status:
                return {"success": True, "task_status": status}
            else:
                return {"error": f"Task {task_id} not found"}

        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def get_ocr_batch_status(group_id: str) -> Dict[str, Any]:
        """
        Get status of an OCR batch group.

        Args:
            group_id: Group ID returned from smart_ocr_recognize

        Returns:
            Dictionary containing batch status and results
        """
        try:
            from server import OCR_AVAILABLE, ocr_queue

            if not OCR_AVAILABLE or not ocr_queue:
                return {"error": "OCR system not available"}

            # Enhanced status checking with detailed information
            status = ocr_queue.get_batch_status(group_id)
            if status:
                # Add queue system status for better debugging
                queue_stats = {
                    "queue_size": ocr_queue.task_queue.qsize() if hasattr(ocr_queue.task_queue, 'qsize') else 0,
                    "active_tasks": len(ocr_queue.active_tasks),
                    "completed_tasks": len(ocr_queue.completed_tasks),
                    "worker_count": len(ocr_queue.worker_threads)
                }

                return {
                    "success": True,
                    "batch_status": status,
                    "queue_info": queue_stats,
                    "processing_hint": "If status shows 'queued', tasks are waiting for available workers. This is normal during high load."
                }
            else:
                # Check if it might be a single task instead of batch
                task_status = ocr_queue.get_task_status(group_id) if hasattr(ocr_queue, 'get_task_status') else None
                if task_status:
                    return {
                        "success": True,
                        "task_status": task_status,
                        "note": "This appears to be a single task, not a batch"
                    }
                else:
                    return {
                        "error": f"Batch or task {group_id} not found",
                        "suggestion": "The task may have completed and been cleaned up, or the ID might be incorrect"
                    }

        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def get_ocr_system_status() -> Dict[str, Any]:
        """
        Get OCR system status and resource usage.

        Returns:
            Dictionary containing system statistics and resource limits
        """
        try:
            from server import OCR_AVAILABLE, ocr_queue

            if not OCR_AVAILABLE or not ocr_queue:
                return {"error": "OCR system not available"}

            stats = ocr_queue.get_system_stats()

            # Add resource limits information
            limits = OCRLimits()
            resource_info = {
                "free_ocr": {
                    "monthly_limit": limits.FREE_OCR["requests_per_month"],
                    "file_size_limit_mb": limits.FREE_OCR["file_size_limit"] / (1024 * 1024),
                    "pdf_page_limit": limits.FREE_OCR["pdf_page_limit"],
                    "max_resolution": limits.FREE_OCR["max_image_resolution"]
                },
                "tencent_ocr": {
                    "monthly_limit": limits.TENCENT_OCR["requests_per_month"],
                    "file_size_limit_mb": limits.TENCENT_OCR["file_size_limit"] / (1024 * 1024),
                    "pdf_page_limit": limits.TENCENT_OCR["pdf_page_limit"],
                    "max_resolution": limits.TENCENT_OCR["max_image_resolution"]
                }
            }

            return {
                "success": True,
                "system_stats": stats,
                "resource_limits": resource_info,
                "features": {
                    "smart_compression": True,
                    "pdf_splitting": True,
                    "queue_processing": True,
                    "auto_engine_selection": True,
                    "batch_processing": True,
                    "2d_queue_support": True
                }
            }

        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def scan_directory_and_ocr(
        directory_path: str,
        max_depth: int = 3,
        ocr_engine: str = "auto",
        language: str = "chs",
        recursive: bool = True,
        image_extensions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Scan directory for images and perform OCR on all found images.

        This method scans a directory (with configurable depth) for image files,
        then performs OCR recognition on each image and returns a map of results.

        Args:
            directory_path: Directory path to scan for images
            max_depth: Maximum directory depth to scan (default: 3, set to 0 for unlimited)
            ocr_engine: OCR engine to use (free, tencent, auto) - default: auto
            language: Language for OCR (chs=Chinese, eng=English, auto=Auto-detect) - default: chs
            recursive: Whether to scan subdirectories (default: True)
            image_extensions: List of image extensions to scan (default: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'])

        Returns:
            Dictionary containing:
            - success: bool
            - scanned_files: int (total image files found)
            - ocr_results: Dict[str, Dict] (map of filepath -> OCR result)
            - errors: List[Dict] (list of files that failed)
            - summary: Dict (statistics)
        """
        try:
            from server import OCR_AVAILABLE, ocr_manager, _normalize_file_path

            if not OCR_AVAILABLE or not ocr_manager:
                return {
                    "success": False,
                    "error": "OCR system not available",
                    "scanned_files": 0,
                    "ocr_results": {},
                    "errors": []
                }

            # Normalize directory path
            dir_path = Path(directory_path)
            if not dir_path.exists():
                return {
                    "success": False,
                    "error": f"Directory not found: {directory_path}",
                    "scanned_files": 0,
                    "ocr_results": {},
                    "errors": []
                }

            if not dir_path.is_dir():
                return {
                    "success": False,
                    "error": f"Path is not a directory: {directory_path}",
                    "scanned_files": 0,
                    "ocr_results": {},
                    "errors": []
                }

            # Default image extensions
            if image_extensions is None:
                image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif']

            # Normalize extensions to lowercase
            image_extensions = [ext.lower() if ext.startswith('.') else f'.{ext.lower()}' for ext in image_extensions]

            # Scan directory for images
            logger.info(f"Scanning directory: {dir_path} (max_depth={max_depth}, recursive={recursive})")
            found_images = []

            def scan_dir(current_path: Path, current_depth: int = 0):
                """Recursively scan directory with depth limit"""
                try:
                    # Check depth limit (0 means unlimited)
                    if max_depth > 0 and current_depth >= max_depth:
                        return

                    for item in current_path.iterdir():
                        try:
                            if item.is_file():
                                # Check if file has image extension
                                if item.suffix.lower() in image_extensions:
                                    found_images.append(str(item.resolve()))

                            elif item.is_dir() and recursive:
                                # Recursively scan subdirectories
                                scan_dir(item, current_depth + 1)

                        except Exception as e:
                            logger.warning(f"Error processing {item}: {e}")
                            continue

                except Exception as e:
                    logger.warning(f"Error scanning directory {current_path}: {e}")

            # Start scanning from root directory
            scan_dir(dir_path, 0)

            logger.info(f"Found {len(found_images)} image files")

            if len(found_images) == 0:
                return {
                    "success": True,
                    "scanned_files": 0,
                    "ocr_results": {},
                    "errors": [],
                    "summary": {
                        "total_files": 0,
                        "successful": 0,
                        "failed": 0,
                        "scan_path": str(dir_path),
                        "max_depth": max_depth,
                        "recursive": recursive
                    }
                }

            # Perform OCR on each image
            ocr_results = {}
            errors = []
            successful_count = 0

            for idx, image_path in enumerate(found_images, 1):
                try:
                    logger.info(f"Processing {idx}/{len(found_images)}: {image_path}")

                    # Normalize file path
                    normalized_path = _normalize_file_path(image_path)

                    # Perform OCR
                    result = ocr_manager.recognize(
                        image_path=normalized_path,
                        engine=ocr_engine,
                        language=language
                    )

                    if result and result.success:
                        ocr_results[image_path] = {
                            "success": True,
                            "text": result.text,
                            "confidence": result.confidence,
                            "provider": result.provider,
                            "word_count": len(result.text.split()) if result.text else 0,
                            "processing_time": result.processing_time,
                            "lines": result.lines if hasattr(result, 'lines') else [],
                            "words": result.words if hasattr(result, 'words') else []
                        }
                        successful_count += 1
                    else:
                        error_msg = result.error if result else "Unknown error"
                        ocr_results[image_path] = {
                            "success": False,
                            "error": error_msg
                        }
                        errors.append({
                            "file": image_path,
                            "error": error_msg
                        })

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Error processing {image_path}: {error_msg}")
                    ocr_results[image_path] = {
                        "success": False,
                        "error": error_msg
                    }
                    errors.append({
                        "file": image_path,
                        "error": error_msg
                    })

            # Generate summary
            summary = {
                "total_files": len(found_images),
                "successful": successful_count,
                "failed": len(errors),
                "scan_path": str(dir_path),
                "max_depth": max_depth,
                "recursive": recursive,
                "ocr_engine": ocr_engine,
                "language": language
            }

            return {
                "success": True,
                "scanned_files": len(found_images),
                "ocr_results": ocr_results,
                "errors": errors,
                "summary": summary
            }

        except Exception as e:
            logger.error(f"Error in scan_directory_and_ocr: {e}")
            return {
                "success": False,
                "error": str(e),
                "scanned_files": 0,
                "ocr_results": {},
                "errors": []
            }
