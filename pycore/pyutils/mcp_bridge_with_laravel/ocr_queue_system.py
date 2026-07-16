#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Queue Processing System
Intelligent queue management, batch processing, and resource optimization
"""

import asyncio
import logging
import time
import threading
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from queue import PriorityQueue, Queue
import uuid
from pathlib import Path

from ocr_config import OCRLimits, OCRStrategy, ProcessingConfig
from image_processor import SmartImageProcessor
from pdf_processor import PDFProcessor

import socket

from pycore.pyutils.ocr_engines import OCRManager



logger = logging.getLogger(__name__)

class TaskPriority(Enum):
    """Task priority levels"""
    HIGH = 1
    NORMAL = 2
    LOW = 3

class TaskStatus(Enum):
    """Task status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class OCRTask:
    """OCR processing task"""
    task_id: str
    file_path: str
    task_type: str  # "image" or "pdf"
    priority: TaskPriority = TaskPriority.NORMAL
    target_engine: Optional[str] = None
    options: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time: float = 0.0
    retry_count: int = 0

    def __lt__(self, other):
        """Enable priority comparison"""
        return self.priority.value < other.priority.value

@dataclass
class BatchGroup:
    """Group of related OCR tasks for batch processing"""
    group_id: str
    tasks: List[OCRTask] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

class ResourceMonitor:
    """Monitor OCR engine resource usage"""

    def __init__(self):
        self.usage_stats = {
            "free": {"requests_today": 0, "requests_this_month": 0},
            "paddle": {"requests_today": 0, "requests_this_month": 0},
            "cnocr": {"requests_today": 0, "requests_this_month": 0}
        }
        self.limits = OCRLimits()
        self.last_reset = time.time()

    def can_use_engine(self, engine: str) -> bool:
        """Check if engine can be used based on quotas"""
        if engine == "free":
            monthly_limit = self.limits.FREE_OCR["requests_per_month"]
            return self.usage_stats["free"]["requests_this_month"] < monthly_limit
        elif engine == "paddle":
            # PaddleOCR has no usage limits (local processing)
            return True
        elif engine == "cnocr":
            # CnOCR has no usage limits (local processing)
            return True
        return False

    def is_network_available(self) -> bool:
        """Check if network connection is available for online OCR"""
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False

    def record_usage(self, engine: str):
        """Record usage for an engine"""
        if engine in self.usage_stats:
            self.usage_stats[engine]["requests_today"] += 1
            self.usage_stats[engine]["requests_this_month"] += 1

    def get_preferred_engine(self, content_type: str = "general") -> str:
        """Get preferred engine based on availability and content type"""
        # Check network availability first
        network_available = self.is_network_available()

        # 1. First priority: free OCR (if has quota and network available)
        if network_available and self.can_use_engine("free"):
            return "free"

        # 2. Second priority: try paddle OCR
        if self.can_use_engine("paddle"):
            # Check if paddle is actually initialized
            try:
                ocr_manager = OCRManager()
                if ocr_manager.initialize_paddle_ocr():
                    return "paddle"
            except Exception:
                pass

        # 3. Third priority: fallback to CnOCR
        if self.can_use_engine("cnocr"):
            return "cnocr"

        # 4. Last resort: try free anyway (will handle quota exceeded)
        return "free"

class OCRQueueProcessor:
    """Intelligent OCR queue processing system"""

    def __init__(self):
        self.task_queue = PriorityQueue()
        self.batch_groups = {}
        self.active_tasks = {}
        self.completed_tasks = {}
        self.resource_monitor = ResourceMonitor()
        self.image_processor = SmartImageProcessor()
        self.pdf_processor = PDFProcessor()

        # Processing control
        self.is_running = False
        self.worker_threads = []
        self.max_concurrent_workers = ProcessingConfig.QUEUE_CONFIG["max_concurrent_requests"]

        # Statistics
        self.stats = {
            "total_processed": 0,
            "successful": 0,
            "failed": 0,
            "total_processing_time": 0.0
        }

    def add_task(self, file_path: str, task_type: str = "auto",
                priority: TaskPriority = TaskPriority.NORMAL,
                target_engine: Optional[str] = None,
                options: Optional[Dict[str, Any]] = None) -> str:
        """
        Add a single OCR task to the queue

        Args:
            file_path: Path to file to process
            task_type: Type of task ("image", "pdf", or "auto")
            priority: Task priority
            target_engine: Preferred OCR engine
            options: Additional processing options

        Returns:
            Task ID
        """
        task_id = str(uuid.uuid4())

        # Auto-detect task type
        if task_type == "auto":
            task_type = self._detect_task_type(file_path)

        # Create task
        task = OCRTask(
            task_id=task_id,
            file_path=file_path,
            task_type=task_type,
            priority=priority,
            target_engine=target_engine,
            options=options or {}
        )

        # Add to queue
        self.task_queue.put(task)
        logger.info(f"Added OCR task {task_id}: {file_path} ({task_type})")

        return task_id

    def add_batch(self, file_paths: List[str], group_metadata: Optional[Dict[str, Any]] = None,
                 priority: TaskPriority = TaskPriority.NORMAL,
                 target_engine: Optional[str] = None) -> str:
        """
        Add a batch of OCR tasks as a group

        Args:
            file_paths: List of file paths to process
            group_metadata: Metadata for the batch group
            priority: Priority for all tasks in batch
            target_engine: Preferred OCR engine for batch

        Returns:
            Group ID
        """
        group_id = str(uuid.uuid4())

        # Create batch group
        batch_group = BatchGroup(
            group_id=group_id,
            metadata=group_metadata or {}
        )

        # Create individual tasks
        for file_path in file_paths:
            task_id = self.add_task(
                file_path=file_path,
                priority=priority,
                target_engine=target_engine,
                options={"group_id": group_id}
            )

            # Add task to batch group
            task = self._find_task_by_id(task_id)
            if task:
                batch_group.tasks.append(task)

        self.batch_groups[group_id] = batch_group
        logger.info(f"Added OCR batch {group_id}: {len(file_paths)} files")

        return group_id

    def add_2d_queue(self, queue_data: List[List[str]],
                    priority: TaskPriority = TaskPriority.NORMAL) -> Dict[str, Any]:
        """
        Add 2D queue data for processing (supports single items as 2D for compatibility)

        Args:
            queue_data: 2D array of file paths [[group1_files], [group2_files], ...]
            priority: Priority for all tasks

        Returns:
            Processing information with group IDs
        """
        result = {
            "batch_id": str(uuid.uuid4()),
            "groups": [],
            "total_files": 0,
            "estimated_time": 0.0
        }

        for group_index, group_files in enumerate(queue_data):
            if not isinstance(group_files, list):
                # Convert single item to list for compatibility
                group_files = [group_files]

            group_metadata = {
                "group_index": group_index,
                "batch_id": result["batch_id"],
                "requires_merging": len(group_files) > 1
            }

            group_id = self.add_batch(
                file_paths=group_files,
                group_metadata=group_metadata,
                priority=priority
            )

            result["groups"].append({
                "group_id": group_id,
                "group_index": group_index,
                "file_count": len(group_files),
                "files": group_files
            })

            result["total_files"] += len(group_files)

        logger.info(f"Added 2D queue batch {result['batch_id']}: "
                   f"{len(result['groups'])} groups, {result['total_files']} total files")

        return result

    def _detect_task_type(self, file_path: str) -> str:
        """Auto-detect task type from file extension"""
        extension = Path(file_path).suffix.lower()

        if extension == '.pdf':
            return "pdf"
        elif extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']:
            return "image"
        else:
            return "image"  # Default to image

    def _find_task_by_id(self, task_id: str) -> Optional[OCRTask]:
        """Find task by ID in queue (for batch management)"""
        # This is a simplified implementation
        # In practice, you might need a more efficient lookup
        return None

    def start_processing(self):
        """Start the queue processing system"""
        if self.is_running:
            logger.warning("Queue processor is already running")
            return

        self.is_running = True
        logger.info("Starting OCR queue processor")

        # Start worker threads
        for i in range(self.max_concurrent_workers):
            worker_thread = threading.Thread(
                target=self._worker_loop,
                name=f"OCRWorker-{i}",
                daemon=True
            )
            worker_thread.start()
            self.worker_threads.append(worker_thread)

        logger.info(f"Started {len(self.worker_threads)} OCR worker threads")

    def stop_processing(self):
        """Stop the queue processing system"""
        if not self.is_running:
            return

        logger.info("Stopping OCR queue processor")
        self.is_running = False

        # Wait for workers to finish
        for worker in self.worker_threads:
            worker.join(timeout=10)

        self.worker_threads.clear()
        logger.info("OCR queue processor stopped")

    def _worker_loop(self):
        """Worker thread main loop"""
        while self.is_running:
            try:
                # Get next task (with timeout)
                task = self.task_queue.get(timeout=1.0)

                if task:
                    self._process_task(task)
                    self.task_queue.task_done()

            except Exception as e:
                if self.is_running:  # Only log if not shutting down
                    logger.error(f"Worker error: {e}")

    def _process_task(self, task: OCRTask):
        """Process a single OCR task"""
        start_time = time.time()
        task.status = TaskStatus.PROCESSING
        self.active_tasks[task.task_id] = task

        try:
            logger.info(f"Processing task {task.task_id}: {task.file_path}")

            # Determine engine to use
            if not task.target_engine:
                content_type = task.options.get("content_type", "general")
                task.target_engine = self.resource_monitor.get_preferred_engine(content_type)

            # Check if we can use the engine
            if not self.resource_monitor.can_use_engine(task.target_engine):
                # Try alternative engine
                alternative = "tencent" if task.target_engine == "free" else "free"
                if self.resource_monitor.can_use_engine(alternative):
                    task.target_engine = alternative
                    logger.info(f"Switched to {alternative} engine due to quota limits")
                else:
                    raise Exception("All OCR engines have exceeded their quotas")

            # Process based on task type
            if task.task_type == "image":
                result = self._process_image_task(task)
            elif task.task_type == "pdf":
                result = self._process_pdf_task(task)
            else:
                raise ValueError(f"Unknown task type: {task.task_type}")

            # Record success
            task.result = result
            task.status = TaskStatus.COMPLETED
            self.resource_monitor.record_usage(task.target_engine)
            self.stats["successful"] += 1

            logger.info(f"Task {task.task_id} completed successfully")

        except Exception as e:
            # Record failure
            task.error = str(e)
            task.status = TaskStatus.FAILED
            self.stats["failed"] += 1

            # Retry logic
            if task.retry_count < ProcessingConfig.QUEUE_CONFIG["max_retries"]:
                task.retry_count += 1
                task.status = TaskStatus.PENDING
                self.task_queue.put(task)  # Re-queue for retry
                logger.warning(f"Task {task.task_id} failed, retrying ({task.retry_count}/3): {e}")
            else:
                logger.error(f"Task {task.task_id} failed permanently: {e}")

        finally:
            # Update statistics
            task.processing_time = time.time() - start_time
            self.stats["total_processing_time"] += task.processing_time
            self.stats["total_processed"] += 1

            # Move to completed tasks
            if task.task_id in self.active_tasks:
                del self.active_tasks[task.task_id]
            self.completed_tasks[task.task_id] = task

    def _process_image_task(self, task: OCRTask) -> Dict[str, Any]:
        """Process an image OCR task"""
        try:
            # Process image for optimal OCR
            processed_path, processing_info = self.image_processor.process_for_ocr(
                task.file_path, task.target_engine
            )

            # Import OCR engine

            # Perform OCR
            ocr_result = ocr_manager.recognize(processed_path, task.target_engine)

            # Combine results
            result = {
                "success": ocr_result.success,
                "type": "image",
                "original_file": task.file_path,
                "processed_file": processed_path if processed_path != task.file_path else None,
                "processing_info": processing_info,
                "ocr_result": ocr_result.to_dict()
            }

            if ocr_result.success:
                result.update({
                    "text": ocr_result.text,
                    "confidence": ocr_result.confidence,
                    "words": ocr_result.words,
                    "provider": ocr_result.provider
                })

            return result

        except Exception as e:
            logger.error(f"Image task processing failed: {e}")
            raise

    def _process_pdf_task(self, task: OCRTask) -> Dict[str, Any]:
        """Process a PDF OCR task"""
        try:
            # Prepare PDF for processing
            chunks = self.pdf_processor.prepare_pdf_for_ocr(task.file_path, task.target_engine)

            # Process each chunk
            chunk_results = []
            for chunk in chunks:
                try:
                    # Import OCR engine

                    # Process chunk
                    chunk_result = ocr_manager.recognize(chunk["file_path"], task.target_engine)
                    chunk_results.append(chunk_result.to_dict())

                except Exception as e:
                    # Record chunk failure
                    chunk_results.append({
                        "success": False,
                        "error": str(e),
                        "chunk_id": chunk["chunk_id"]
                    })

            # Merge results
            merged_result = self.pdf_processor.merge_ocr_results(chunks, chunk_results)

            return merged_result

        except Exception as e:
            logger.error(f"PDF task processing failed: {e}")
            raise

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific task"""
        # Check active tasks
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            return {
                "task_id": task.task_id,
                "status": task.status.value,
                "progress": "processing",
                "created_at": task.created_at,
                "processing_time": time.time() - task.created_at
            }

        # Check completed tasks
        if task_id in self.completed_tasks:
            task = self.completed_tasks[task_id]
            return {
                "task_id": task.task_id,
                "status": task.status.value,
                "result": task.result,
                "error": task.error,
                "created_at": task.created_at,
                "processing_time": task.processing_time,
                "retry_count": task.retry_count
            }

        return None

    def get_batch_status(self, group_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a batch group"""
        if group_id not in self.batch_groups:
            return None

        batch_group = self.batch_groups[group_id]

        # Collect task statuses
        task_statuses = []
        completed_count = 0
        failed_count = 0

        for task in batch_group.tasks:
            status = self.get_task_status(task.task_id)
            if status:
                task_statuses.append(status)
                if status["status"] == "completed":
                    completed_count += 1
                elif status["status"] == "failed":
                    failed_count += 1

        return {
            "group_id": group_id,
            "total_tasks": len(batch_group.tasks),
            "completed": completed_count,
            "failed": failed_count,
            "in_progress": len(batch_group.tasks) - completed_count - failed_count,
            "metadata": batch_group.metadata,
            "tasks": task_statuses
        }

    def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        return {
            "queue_size": self.task_queue.qsize(),
            "active_tasks": len(self.active_tasks),
            "completed_tasks": len(self.completed_tasks),
            "batch_groups": len(self.batch_groups),
            "is_running": self.is_running,
            "worker_threads": len(self.worker_threads),
            "processing_stats": self.stats.copy(),
            "resource_usage": self.resource_monitor.usage_stats.copy()
        }

    def wait_for_task(self, task_id: str, timeout: int) -> Dict[str, Any]:
        """Wait for single task completion (reusable polling helper)."""
        start_time = time.time()

        while time.time() - start_time < timeout:
            status = self.get_task_status(task_id)
            if status and status["status"] in ["completed", "failed"]:
                return {
                    "success": True,
                    "mode": "single_file",
                    "task_id": task_id,
                    "result": status
                }
            time.sleep(1)

        return {
            "success": False,
            "error": "Timeout waiting for task completion",
            "task_id": task_id
        }

    def wait_for_group(self, group_id: str, timeout: int) -> Dict[str, Any]:
        """Wait for batch group completion (reusable polling helper)."""
        start_time = time.time()

        while time.time() - start_time < timeout:
            status = self.get_batch_status(group_id)
            if status:
                total = status["total_tasks"]
                completed = status["completed"] + status["failed"]

                if completed >= total:
                    return {
                        "success": True,
                        "mode": "batch",
                        "group_id": group_id,
                        "result": status
                    }
            time.sleep(2)

        return {
            "success": False,
            "error": "Timeout waiting for batch completion",
            "group_id": group_id
        }

    def wait_for_batch(self, batch_info: Dict[str, Any], timeout: int) -> Dict[str, Any]:
        """Wait for 2D batch completion (reusable polling helper)."""
        start_time = time.time()

        while time.time() - start_time < timeout:
            all_completed = True

            for group in batch_info["groups"]:
                group_id = group["group_id"]
                status = self.get_batch_status(group_id)

                if status:
                    total = status["total_tasks"]
                    completed = status["completed"] + status["failed"]

                    if completed < total:
                        all_completed = False
                        break
                    else:
                        # Update group result
                        group["status"] = status

            if all_completed:
                return {
                    "success": True,
                    "mode": "2d_queue",
                    "batch_id": batch_info["batch_id"],
                    "groups": batch_info["groups"],
                    "total_files": batch_info["total_files"]
                }

            time.sleep(3)

        return {
            "success": False,
            "error": "Timeout waiting for 2D batch completion",
            "batch_id": batch_info["batch_id"],
            "partial_results": batch_info["groups"]
        }

    def cleanup(self):
        """Cleanup resources"""
        self.stop_processing()
        self.image_processor.cleanup_temp_files()
        self.pdf_processor.cleanup_temp_files()

# Global queue processor instance
ocr_queue = OCRQueueProcessor()