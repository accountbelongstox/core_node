import time
import uuid
from pycore.pyfoundations.pybasecommon import exec_silent
from typing import Callable, Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import logging

from pycore.pyfoundations.third_party import get_third_package_psutil
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
import subprocess

psutil = get_third_package_psutil()

from pycore.pyfoundations.pygvar import (
    SEVEN_ZIP_EXECUTABLE,
    MAX_CONCURRENT_ZIP_TASKS,
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
        owner_id = uuid.uuid4().hex
        self.max_concurrent_tasks = max_concurrent_tasks
        self.task_queue_name = f"zip_task_queue.tasks.{owner_id}"
        self.running_signal = f"zip_task_queue.running.{owner_id}"
        self.active_tasks = 0

        self.tasks_registry: Dict[str, ZipTask] = {}
        self.groups_registry: Dict[str, TaskGroup] = {}

        self.global_callbacks: List[Callable] = []

        self.worker_threads = []
        self.running = False

        self.cpu_threshold = 80
        self.completed_tasks_count = 0
        self.failed_tasks_count = 0
        init_serialized_owner(
            self,
            "zip_task_queue.state",
            "ZipTaskQueueState",
        )
        THREAD_BUS.signal(self.running_signal, False)

        if not SEVEN_ZIP_EXECUTABLE:
            raise RuntimeError("7-Zip executable not found. Please install 7-Zip.")

        logger.info(f"ZipTaskQueue initialized with {max_concurrent_tasks} concurrent tasks")
        logger.info(f"Using 7-Zip executable: {SEVEN_ZIP_EXECUTABLE}")

    @serialized_method
    def start(self):
        if self.running:
            logger.warning("ZipTaskQueue is already running")
            return

        self.running = True
        THREAD_BUS.signal(self.running_signal, True)

        for i in range(self.max_concurrent_tasks):
            thread = start_bus_task(
                self._worker,
                i,
                thread_name=f"ZipTaskWorker-{i}",
            )
            self.worker_threads.append(thread)
            logger.info(f"Started worker thread {i}")

    def stop(self, wait=True):
        worker_threads = self._stop_workers()
        if worker_threads is None:
            return

        logger.info("Stopping ZipTaskQueue...")

        if wait:
            for thread in worker_threads:
                thread.join(timeout=5)

        logger.info("ZipTaskQueue stopped")

    @serialized_method
    def _stop_workers(self):
        if not self.running:
            return None
        self.running = False
        THREAD_BUS.signal(self.running_signal, False)
        worker_threads = list(self.worker_threads)
        self.worker_threads.clear()
        return worker_threads

    def _worker(self, worker_id: int):
        logger.info(f"Worker {worker_id} started")

        while THREAD_BUS.get_signal(self.running_signal, False):
            if self._should_skip_due_to_cpu():
                time.sleep(2)
                continue

            task = THREAD_BUS.receive_message(
                self.task_queue_name,
                block=True,
                timeout=1,
            )
            if not isinstance(task, ZipTask):
                time.sleep(0.5)
                continue

            try:
                self._change_active_tasks(1)
                self._execute_task(task, worker_id)

            finally:
                self._change_active_tasks(-1)

    @serialized_method
    def _change_active_tasks(self, delta: int) -> None:
        self.active_tasks = max(0, self.active_tasks + delta)

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

            exec_silent(
                command,
                shell=True,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            task.status = TaskStatus.COMPLETED
            task.end_time = time.time()

            logger.info(f"Task {task.task_id} completed in {task.end_time - task.start_time:.2f}s")

        except subprocess.CalledProcessError as e:
            task.status = TaskStatus.FAILED
            task.end_time = time.time()
            task.error = str(e)

            logger.error(f"Task {task.task_id} failed: {e}")

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.end_time = time.time()
            task.error = str(e)

            logger.error(f"Task {task.task_id} exception: {e}")

        if task.callback:
            try:
                task.callback(task)
            except Exception as callback_error:
                logger.error(f"Task callback error: {callback_error}")

        group_callback, group, global_callbacks = self._record_task_completion(task)
        if group_callback and group:
            try:
                group_callback(group)
            except Exception as callback_error:
                logger.error(f"Group callback error: {callback_error}")
        for callback in global_callbacks:
            try:
                callback(task)
            except Exception as callback_error:
                logger.error(f"Global callback error: {callback_error}")

    @serialized_method
    def _record_task_completion(self, task: ZipTask):
        group = None
        group_callback = None
        if task.status == TaskStatus.COMPLETED:
            self.completed_tasks_count += 1
        elif task.status == TaskStatus.FAILED:
            self.failed_tasks_count += 1

        if task.group_id:
            group = self.groups_registry.get(task.group_id)
            if group:
                if task.status == TaskStatus.COMPLETED:
                    group.completed_count += 1
                elif task.status == TaskStatus.FAILED:
                    group.failed_count += 1

                if (group.completed_count + group.failed_count) >= group.total_count:
                    logger.info(f"Group {task.group_id} completed: {group.completed_count}/{group.total_count} succeeded")
                    group_callback = group.callback

        return group_callback, group, list(self.global_callbacks)

    def _build_command(self, task: ZipTask) -> str:
        seven_zip = f'"{SEVEN_ZIP_EXECUTABLE}"'

        if task.is_compress:
            command = f'{seven_zip} a -t7z -mx={task.compression_level} "{task.output}" "{task.source}"'
        else:
            command = f'{seven_zip} x "{task.source}" -o"{task.output}" -y'

        return command

    @serialized_method
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

        self.tasks_registry[task_id] = task

        if group_id:
            if group_id not in self.groups_registry:
                self.groups_registry[group_id] = TaskGroup(group_id=group_id)

            group = self.groups_registry[group_id]
            group.tasks.append(task)
            group.total_count += 1

        THREAD_BUS.send_message(self.task_queue_name, task)
        logger.info(f"Task {task_id} added to queue")

        if not self.running:
            self.start()

        return task

    @serialized_method
    def add_task_group(
        self,
        group_id: str,
        tasks: List[Dict[str, Any]],
        group_callback: Optional[Callable] = None
    ) -> TaskGroup:
        group = TaskGroup(group_id=group_id, callback=group_callback)

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

    @serialized_method
    def register_global_callback(self, callback: Callable):
        if callback not in self.global_callbacks:
            self.global_callbacks.append(callback)
            logger.info("Global callback registered")

    @serialized_method
    def unregister_global_callback(self, callback: Callable):
        if callback in self.global_callbacks:
            self.global_callbacks.remove(callback)
            logger.info("Global callback unregistered")

    @serialized_method
    def get_task_status(self, task_id: str) -> Optional[ZipTask]:
        return self.tasks_registry.get(task_id)

    @serialized_method
    def get_group_status(self, group_id: str) -> Optional[TaskGroup]:
        return self.groups_registry.get(group_id)

    def wait_for_completion(self, timeout: Optional[float] = None):
        started_at = time.time()
        while True:
            statistics = self.get_statistics()
            if statistics['pending_tasks'] == 0 and statistics['active_tasks'] == 0:
                break
            if timeout is not None and time.time() - started_at >= timeout:
                return False
            time.sleep(0.1)
        logger.info("All tasks completed")
        return True

    @serialized_method
    def get_statistics(self) -> Dict[str, Any]:
        return {
            'total_tasks': len(self.tasks_registry),
            'completed_tasks': self.completed_tasks_count,
            'failed_tasks': self.failed_tasks_count,
            'active_tasks': self.active_tasks,
            'pending_tasks': THREAD_BUS.queue_size(self.task_queue_name),
            'total_groups': len(self.groups_registry),
        }


_GLOBAL_ZIP_QUEUE_PROVIDER = SerializedSingletonProvider(
    ZipTaskQueue,
    "zip_task_queue.provider",
    "GlobalZipTaskQueueProviderThread",
)


def get_global_zip_queue() -> ZipTaskQueue:
    return _GLOBAL_ZIP_QUEUE_PROVIDER.get()
