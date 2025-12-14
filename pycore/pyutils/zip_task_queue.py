import os
import threading
import time
import subprocess
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from queue import Queue, Empty
from typing import Callable, Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import logging

from pycore.pyfoundations.third_party import get_third_package_psutil

psutil = get_third_package_psutil()

from pycore.pygvar import (
    SEVEN_ZIP_EXECUTABLE,
    MAX_CONCURRENT_ZIP_TASKS,
    CPU_COUNT,
    IS_WINDOWS
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class ZipTask:
    task_id: str
    source: str
    output: str
    is_compress: bool = True
    compression_level: int = 5
    callback: Optional[Callable] = None
    status: TaskStatus = TaskStatus.PENDING
    error: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    group_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskGroup:
    group_id: str
    tasks: List[ZipTask] = field(default_factory=list)
    callback: Optional[Callable] = None
    completed_count: int = 0
    failed_count: int = 0
    total_count: int = 0


class ZipTaskQueue:
    def __init__(self, max_concurrent_tasks: int = MAX_CONCURRENT_ZIP_TASKS):
        self.max_concurrent_tasks = max_concurrent_tasks
        self.task_queue = Queue()
        self.active_tasks = 0
        self.active_tasks_lock = threading.Lock()

        self.tasks_registry: Dict[str, ZipTask] = {}
        self.groups_registry: Dict[str, TaskGroup] = {}
        self.registry_lock = threading.Lock()

        self.global_callbacks: List[Callable] = []
        self.global_callbacks_lock = threading.Lock()

        self.worker_threads: List[threading.Thread] = []
        self.stop_event = threading.Event()
        self.running = False

        self.cpu_threshold = 80
        self.completed_tasks_count = 0
        self.failed_tasks_count = 0

        if not SEVEN_ZIP_EXECUTABLE:
            raise RuntimeError("7-Zip executable not found. Please install 7-Zip.")

        logger.info(f"ZipTaskQueue initialized with {max_concurrent_tasks} concurrent tasks")
        logger.info(f"Using 7-Zip executable: {SEVEN_ZIP_EXECUTABLE}")

    def start(self):
        if self.running:
            logger.warning("ZipTaskQueue is already running")
            return

        self.running = True
        self.stop_event.clear()

        for i in range(self.max_concurrent_tasks):
            thread = threading.Thread(target=self._worker, args=(i,), daemon=True)
            thread.start()
            self.worker_threads.append(thread)
            logger.info(f"Started worker thread {i}")

    def stop(self, wait=True):
        if not self.running:
            return

        logger.info("Stopping ZipTaskQueue...")
        self.stop_event.set()
        self.running = False

        if wait:
            for thread in self.worker_threads:
                thread.join(timeout=5)

        self.worker_threads.clear()
        logger.info("ZipTaskQueue stopped")

    def _worker(self, worker_id: int):
        logger.info(f"Worker {worker_id} started")

        while not self.stop_event.is_set():
            if self._should_skip_due_to_cpu():
                time.sleep(2)
                continue

            try:
                task = self.task_queue.get(timeout=1)
            except Empty:
                time.sleep(0.5)
                continue

            try:
                with self.active_tasks_lock:
                    self.active_tasks += 1

                self._execute_task(task, worker_id)

            finally:
                with self.active_tasks_lock:
                    self.active_tasks -= 1
                self.task_queue.task_done()

    def _should_skip_due_to_cpu(self) -> bool:
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            return cpu_percent > self.cpu_threshold
        except:
            return False

    def _execute_task(self, task: ZipTask, worker_id: int):
        logger.info(f"Worker {worker_id} executing task {task.task_id}")

        task.status = TaskStatus.RUNNING
        task.start_time = time.time()

        try:
            command = self._build_command(task)
            logger.debug(f"Executing command: {command}")

            result = exec_silent(
                command,
                shell=True,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            task.status = TaskStatus.COMPLETED
            task.end_time = time.time()
            self.completed_tasks_count += 1

            logger.info(f"Task {task.task_id} completed in {task.end_time - task.start_time:.2f}s")

            if task.callback:
                try:
                    task.callback(task)
                except Exception as e:
                    logger.error(f"Task callback error: {e}")

            self._handle_task_completion(task)

        except subprocess.CalledProcessError as e:
            task.status = TaskStatus.FAILED
            task.end_time = time.time()
            task.error = str(e)
            self.failed_tasks_count += 1

            logger.error(f"Task {task.task_id} failed: {e}")

            if task.callback:
                try:
                    task.callback(task)
                except Exception as e:
                    logger.error(f"Task callback error: {e}")

            self._handle_task_completion(task)

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.end_time = time.time()
            task.error = str(e)
            self.failed_tasks_count += 1

            logger.error(f"Task {task.task_id} exception: {e}")

            if task.callback:
                try:
                    task.callback(task)
                except Exception as e:
                    logger.error(f"Task callback error: {e}")

            self._handle_task_completion(task)

    def _handle_task_completion(self, task: ZipTask):
        if task.group_id:
            with self.registry_lock:
                if task.group_id in self.groups_registry:
                    group = self.groups_registry[task.group_id]

                    if task.status == TaskStatus.COMPLETED:
                        group.completed_count += 1
                    elif task.status == TaskStatus.FAILED:
                        group.failed_count += 1

                    if (group.completed_count + group.failed_count) >= group.total_count:
                        logger.info(f"Group {task.group_id} completed: {group.completed_count}/{group.total_count} succeeded")

                        if group.callback:
                            try:
                                group.callback(group)
                            except Exception as e:
                                logger.error(f"Group callback error: {e}")

        with self.global_callbacks_lock:
            for callback in self.global_callbacks:
                try:
                    callback(task)
                except Exception as e:
                    logger.error(f"Global callback error: {e}")

    def _build_command(self, task: ZipTask) -> str:
        seven_zip = f'"{SEVEN_ZIP_EXECUTABLE}"'

        if task.is_compress:
            command = f'{seven_zip} a -t7z -mx={task.compression_level} "{task.output}" "{task.source}"'
        else:
            command = f'{seven_zip} x "{task.source}" -o"{task.output}" -y'

        return command

    def add_task(
        self,
        task_id: str,
        source: str,
        output: str,
        is_compress: bool = True,
        compression_level: int = 5,
        callback: Optional[Callable] = None,
        group_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ZipTask:
        task = ZipTask(
            task_id=task_id,
            source=source,
            output=output,
            is_compress=is_compress,
            compression_level=compression_level,
            callback=callback,
            group_id=group_id,
            metadata=metadata or {}
        )

        with self.registry_lock:
            self.tasks_registry[task_id] = task

            if group_id:
                if group_id not in self.groups_registry:
                    self.groups_registry[group_id] = TaskGroup(group_id=group_id)

                group = self.groups_registry[group_id]
                group.tasks.append(task)
                group.total_count += 1

        self.task_queue.put(task)
        logger.info(f"Task {task_id} added to queue")

        if not self.running:
            self.start()

        return task

    def add_task_group(
        self,
        group_id: str,
        tasks: List[Dict[str, Any]],
        group_callback: Optional[Callable] = None
    ) -> TaskGroup:
        group = TaskGroup(group_id=group_id, callback=group_callback)

        with self.registry_lock:
            self.groups_registry[group_id] = group

        for task_data in tasks:
            task_id = task_data.get('task_id', f"{group_id}_{len(group.tasks)}")
            self.add_task(
                task_id=task_id,
                source=task_data['source'],
                output=task_data['output'],
                is_compress=task_data.get('is_compress', True),
                compression_level=task_data.get('compression_level', 5),
                callback=task_data.get('callback'),
                group_id=group_id,
                metadata=task_data.get('metadata')
            )

        logger.info(f"Task group {group_id} added with {len(tasks)} tasks")
        return group

    def register_global_callback(self, callback: Callable):
        with self.global_callbacks_lock:
            if callback not in self.global_callbacks:
                self.global_callbacks.append(callback)
                logger.info("Global callback registered")

    def unregister_global_callback(self, callback: Callable):
        with self.global_callbacks_lock:
            if callback in self.global_callbacks:
                self.global_callbacks.remove(callback)
                logger.info("Global callback unregistered")

    def get_task_status(self, task_id: str) -> Optional[ZipTask]:
        with self.registry_lock:
            return self.tasks_registry.get(task_id)

    def get_group_status(self, group_id: str) -> Optional[TaskGroup]:
        with self.registry_lock:
            return self.groups_registry.get(group_id)

    def wait_for_completion(self, timeout: Optional[float] = None):
        self.task_queue.join()
        logger.info("All tasks completed")

    def get_statistics(self) -> Dict[str, Any]:
        with self.active_tasks_lock:
            active = self.active_tasks

        return {
            'total_tasks': len(self.tasks_registry),
            'completed_tasks': self.completed_tasks_count,
            'failed_tasks': self.failed_tasks_count,
            'active_tasks': active,
            'pending_tasks': self.task_queue.qsize(),
            'total_groups': len(self.groups_registry),
        }


_global_queue_instance: Optional[ZipTaskQueue] = None
_queue_lock = threading.Lock()


def get_global_zip_queue() -> ZipTaskQueue:
    global _global_queue_instance

    if _global_queue_instance is None:
        with _queue_lock:
            if _global_queue_instance is None:
                _global_queue_instance = ZipTaskQueue()

    return _global_queue_instance
