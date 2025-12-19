# 全局任务系统 Python Caller - 开发 TODO

## 项目概述

在 `pycore/callmodule` 中开发一个 Python 客户端模块，用于调用 Laravel 全局任务系统 API。

**服务端**: Laravel Octane (http://localhost:9000/api)
**客户端**: Python Worker Client
**通信方式**: HTTP REST API + Long Polling

---

## 📋 开发任务清单

### 1. 创建核心模块文件

- [ ] `pycore/callmodule/global_task_client.py` - 主客户端类
- [ ] `pycore/callmodule/task_worker.py` - Worker 工作类
- [ ] `pycore/callmodule/task_models.py` - 数据模型定义
- [ ] `pycore/callmodule/task_exceptions.py` - 异常定义
- [ ] `pycore/callmodule/__init__.py` - 模块初始化
- [ ] `examples/global_task_example.py` - 使用示例

### 2. 实现核心功能

#### GlobalTaskClient 类
- [ ] 初始化客户端（配置 base_url, timeout 等）
- [ ] 实现所有 API 端点调用方法
- [ ] 实现错误处理和重试机制
- [ ] 实现请求日志记录
- [ ] 实现连接池管理

#### TaskWorker 类
- [ ] Worker 注册和注销
- [ ] 心跳维护（后台线程）
- [ ] 任务拉取（Long Polling）
- [ ] 任务处理循环
- [ ] 结果提交
- [ ] 优雅退出

#### 数据模型
- [ ] Task 模型
- [ ] Worker 模型
- [ ] TaskResult 模型
- [ ] 数据验证

### 3. 测试和文档

- [ ] 单元测试
- [ ] 集成测试
- [ ] 使用文档
- [ ] API 文档

---

## 🔌 API 端点规范

### 服务器信息
- **Base URL**: `http://localhost:9000/api`
- **Content-Type**: `application/json`
- **认证**: 暂无（后续可添加 Token）

---

## 📡 任务端点 (Task Endpoints)

### 1. 创建任务

**POST** `/task/create`

**请求数据格式**:
```json
{
  "app_name": "string",           // 必填：应用名称
  "task_type": "string",           // 必填：任务类型
  "execution_type": "string",      // 必填：执行类型（见下方常量）
  "payload": {                     // 必填：任务数据（任意 JSON）
    "key": "value"
  },
  "timeout_seconds": 120,          // 可选：超时秒数，默认 120
  "priority": 0,                   // 可选：优先级，默认 0
  "max_retries": 3                 // 可选：最大重试次数，默认 3
}
```

**执行类型常量**:
```python
EXECUTION_TYPES = [
    "local_timer",           # Laravel OctaneTimer 处理
    "remote_compute",        # 远程计算任务
    "remote_ocr",            # 远程 OCR 识别
    "remote_translation",    # 远程翻译
    "remote_video",          # 远程视频处理
    "remote_io"              # 远程 IO 操作
]
```

**响应数据格式**:
```json
{
  "success": true,
  "task_id": "task_b98b09e4-40b2-440d-84fc-9af21cae6b2a",
  "message": "Task created successfully"
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "错误信息",
  "errors": {
    "field_name": ["验证错误"]
  }
}
```

---

### 2. 查询任务状态

**GET** `/task/{task_id}/status`

**URL 参数**:
- `task_id`: 任务 ID（必填）

**响应数据格式**:
```json
{
  "success": true,
  "task": {
    "task_id": "task_b98b09e4-40b2-440d-84fc-9af21cae6b2a",
    "app_name": "MyApp",
    "task_type": "compute_task",
    "execution_type": "remote_compute",
    "status": "completed",           // pending, assigned, processing, completed, failed
    "progress": 100,                 // 0-100
    "assigned_to": "worker_123",     // Worker ID 或 null
    "result": {                      // 结果数据（completed 时有值）
      "output": "处理结果",
      "success": true
    },
    "error": null,                   // 错误信息（failed 时有值）
    "created_at": "2025-12-07T08:43:27.000000Z",
    "updated_at": "2025-12-07T08:43:36.000000Z"
  }
}
```

**任务状态常量**:
```python
TASK_STATUS = [
    "pending",      # 待处理
    "assigned",     # 已分配
    "processing",   # 处理中
    "completed",    # 已完成
    "failed"        # 失败
]
```

---

### 3. 查询任务列表

**GET** `/task/list`

**Query 参数**:
```
?status=pending           # 可选：按状态过滤
&execution_type=remote_compute  # 可选：按执行类型过滤
&app_name=MyApp          # 可选：按应用名过滤
&limit=20                # 可选：返回数量，默认 20
&offset=0                # 可选：偏移量，默认 0
```

**响应数据格式**:
```json
{
  "success": true,
  "total": 100,              // 总数
  "count": 20,               // 当前返回数量
  "tasks": [
    {
      "task_id": "task_...",
      "app_name": "MyApp",
      "task_type": "compute",
      "execution_type": "remote_compute",
      "status": "pending",
      "progress": 0,
      "assigned_to": null,
      "created_at": "2025-12-07T08:43:27.000000Z"
    }
    // ... 更多任务
  ]
}
```

---

### 4. 获取任务统计

**GET** `/task/stats`

**Query 参数**:
```
?app_name=MyApp          # 可选：按应用名过滤
```

**响应数据格式**:
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "pending": 10,
    "assigned": 5,
    "processing": 15,
    "completed": 65,
    "failed": 5
  }
}
```

---

## 🤖 Worker 端点 (Worker Endpoints)

### 1. 注册 Worker

**POST** `/worker/register`

**请求数据格式**:
```json
{
  "worker_name": "string",         // 必填：Worker 名称
  "processor_types": [             // 必填：支持的任务类型数组
    "remote_compute",
    "remote_ocr"
  ],
  "hostname": "localhost",         // 可选：主机名
  "platform": "linux",             // 可选：平台（linux/windows/darwin）
  "metadata": {                    // 可选：元数据（任意 JSON）
    "version": "1.0.0",
    "cpu_cores": 8,
    "memory_gb": 16
  }
}
```

**响应数据格式**:
```json
{
  "success": true,
  "worker_id": "test_worker_MyWorker_abc123",
  "message": "Worker registered successfully"
}
```

---

### 2. 发送心跳

**POST** `/worker/heartbeat`

**请求数据格式**:
```json
{
  "worker_id": "test_worker_MyWorker_abc123"  // 必填：Worker ID
}
```

**响应数据格式**:
```json
{
  "success": true,
  "message": "Heartbeat received",
  "worker": {
    "worker_id": "test_worker_MyWorker_abc123",
    "status": "online",              // online, busy, offline
    "last_heartbeat_at": "2025-12-07T08:44:08.000000Z"
  }
}
```

**重要**:
- 必须每 60 秒发送一次心跳
- 超过 120 秒未发送心跳，Worker 将被标记为 offline
- 建议使用后台线程每 30 秒发送一次

---

### 3. 拉取任务 (Long Polling)

**GET** `/worker/tasks/pull`

**Query 参数**:
```
?worker_id=test_worker_MyWorker_abc123  # 必填：Worker ID
&limit=5                                 # 可选：最多拉取数量，默认 5
```

**重要特性**:
- **Long Polling**: 如果没有任务，服务器会等待最多 30 秒
- 只返回匹配 Worker processor_types 的任务
- 按优先级排序（priority DESC）
- 使用数据库锁定防止重复分配

**响应数据格式**:
```json
{
  "success": true,
  "count": 2,
  "tasks": [
    {
      "task_id": "task_abc123",
      "app_name": "MyApp",
      "task_type": "compute_task",
      "execution_type": "remote_compute",
      "status": "pending",
      "priority": 10,
      "timeout_seconds": 120,
      "payload": {
        "input_data": "..."
      },
      "created_at": "2025-12-07T08:43:27.000000Z"
    }
    // ... 更多任务
  ]
}
```

**空响应（30 秒后无任务）**:
```json
{
  "success": true,
  "count": 0,
  "tasks": []
}
```

---

### 4. 接受任务

**POST** `/worker/tasks/accept`

**请求数据格式**:
```json
{
  "worker_id": "test_worker_MyWorker_abc123",  // 必填：Worker ID
  "task_id": "task_abc123"                     // 必填：任务 ID
}
```

**响应数据格式**:
```json
{
  "success": true,
  "message": "Task accepted",
  "task": {
    "task_id": "task_abc123",
    "status": "processing",
    "assigned_to": "test_worker_MyWorker_abc123",
    "assigned_at": "2025-12-07T08:43:30.000000Z",
    "timeout_at": "2025-12-07T08:45:30.000000Z"
  }
}
```

**错误响应（任务已被分配）**:
```json
{
  "success": false,
  "message": "Task already assigned to another worker"
}
```

---

### 5. 提交结果

**POST** `/worker/tasks/result`

**请求数据格式**:
```json
{
  "worker_id": "test_worker_MyWorker_abc123",  // 必填：Worker ID
  "task_id": "task_abc123",                    // 必填：任务 ID
  "success": true,                             // 必填：是否成功
  "result": {                                  // 可选：结果数据（任意 JSON）
    "output": "处理结果",
    "processed_items": 100,
    "duration_seconds": 5.3
  },
  "error": null,                               // 可选：错误信息（失败时填写）
  "progress": 100                              // 可选：最终进度，默认 100
}
```

**成功响应**:
```json
{
  "success": true,
  "message": "Result submitted successfully",
  "task": {
    "task_id": "task_abc123",
    "status": "completed",
    "progress": 100,
    "result": {
      "output": "处理结果"
    }
  }
}
```

**错误响应（重复提交或非分配给该 Worker）**:
```json
{
  "success": false,
  "message": "Task not assigned to this worker or already completed"
}
```

---

### 6. 查询 Worker 列表

**GET** `/worker/list`

**Query 参数**:
```
?status=online           # 可选：按状态过滤（online, busy, offline）
&limit=20                # 可选：返回数量，默认 20
```

**响应数据格式**:
```json
{
  "success": true,
  "count": 3,
  "workers": [
    {
      "worker_id": "test_worker_Worker1_abc123",
      "worker_name": "Worker1",
      "processor_types": ["remote_compute", "remote_ocr"],
      "status": "online",
      "hostname": "localhost",
      "platform": "linux",
      "completed_tasks": 15,
      "failed_tasks": 2,
      "current_task_id": null,
      "last_heartbeat_at": "2025-12-07T08:44:08.000000Z",
      "created_at": "2025-12-07T08:43:27.000000Z"
    }
    // ... 更多 workers
  ]
}
```

---

### 7. 获取 Worker 统计

**GET** `/worker/stats`

**响应数据格式**:
```json
{
  "success": true,
  "stats": {
    "total": 10,
    "online": 7,
    "busy": 2,
    "offline": 1,
    "total_completed": 1523,
    "total_failed": 47
  }
}
```

---

## 💻 Python 实现示例

### 1. 基础客户端类

```python
# pycore/callmodule/global_task_client.py

import requests
from typing import Dict, List, Optional, Any
from .task_models import Task, Worker, TaskResult
from .task_exceptions import TaskAPIError, TaskNotFoundError

class GlobalTaskClient:
    """全局任务系统 HTTP 客户端"""

    def __init__(self, base_url: str = "http://localhost:9000/api", timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """发送 HTTP 请求并处理响应"""
        url = f"{self.base_url}{endpoint}"

        try:
            response = self.session.request(method, url, timeout=self.timeout, **kwargs)
            response.raise_for_status()

            data = response.json()
            if not data.get('success', False):
                raise TaskAPIError(data.get('message', 'Unknown error'))

            return data

        except requests.exceptions.RequestException as e:
            raise TaskAPIError(f"Request failed: {str(e)}")

    # ==================== 任务端点 ====================

    def create_task(
        self,
        app_name: str,
        task_type: str,
        execution_type: str,
        payload: Dict[str, Any],
        timeout_seconds: int = 120,
        priority: int = 0,
        max_retries: int = 3
    ) -> str:
        """创建任务

        Returns:
            task_id: 任务 ID
        """
        data = {
            'app_name': app_name,
            'task_type': task_type,
            'execution_type': execution_type,
            'payload': payload,
            'timeout_seconds': timeout_seconds,
            'priority': priority,
            'max_retries': max_retries
        }

        result = self._request('POST', '/task/create', json=data)
        return result['task_id']

    def get_task_status(self, task_id: str) -> Task:
        """查询任务状态"""
        result = self._request('GET', f'/task/{task_id}/status')
        return Task.from_dict(result['task'])

    def list_tasks(
        self,
        status: Optional[str] = None,
        execution_type: Optional[str] = None,
        app_name: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Task]:
        """查询任务列表"""
        params = {'limit': limit, 'offset': offset}
        if status:
            params['status'] = status
        if execution_type:
            params['execution_type'] = execution_type
        if app_name:
            params['app_name'] = app_name

        result = self._request('GET', '/task/list', params=params)
        return [Task.from_dict(t) for t in result['tasks']]

    def get_task_stats(self, app_name: Optional[str] = None) -> Dict[str, int]:
        """获取任务统计"""
        params = {'app_name': app_name} if app_name else {}
        result = self._request('GET', '/task/stats', params=params)
        return result['stats']

    # ==================== Worker 端点 ====================

    def register_worker(
        self,
        worker_name: str,
        processor_types: List[str],
        hostname: Optional[str] = None,
        platform: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """注册 Worker

        Returns:
            worker_id: Worker ID
        """
        data = {
            'worker_name': worker_name,
            'processor_types': processor_types
        }
        if hostname:
            data['hostname'] = hostname
        if platform:
            data['platform'] = platform
        if metadata:
            data['metadata'] = metadata

        result = self._request('POST', '/worker/register', json=data)
        return result['worker_id']

    def send_heartbeat(self, worker_id: str) -> Dict[str, Any]:
        """发送心跳"""
        data = {'worker_id': worker_id}
        return self._request('POST', '/worker/heartbeat', json=data)

    def pull_tasks(self, worker_id: str, limit: int = 5) -> List[Task]:
        """拉取任务 (Long Polling 30s)"""
        params = {'worker_id': worker_id, 'limit': limit}
        result = self._request('GET', '/worker/tasks/pull', params=params, timeout=35)
        return [Task.from_dict(t) for t in result['tasks']]

    def accept_task(self, worker_id: str, task_id: str) -> Task:
        """接受任务"""
        data = {'worker_id': worker_id, 'task_id': task_id}
        result = self._request('POST', '/worker/tasks/accept', json=data)
        return Task.from_dict(result['task'])

    def submit_result(
        self,
        worker_id: str,
        task_id: str,
        success: bool,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: int = 100
    ) -> Task:
        """提交任务结果"""
        data = {
            'worker_id': worker_id,
            'task_id': task_id,
            'success': success,
            'progress': progress
        }
        if result:
            data['result'] = result
        if error:
            data['error'] = error

        result = self._request('POST', '/worker/tasks/result', json=data)
        return Task.from_dict(result['task'])

    def list_workers(self, status: Optional[str] = None, limit: int = 20) -> List[Worker]:
        """查询 Worker 列表"""
        params = {'limit': limit}
        if status:
            params['status'] = status

        result = self._request('GET', '/worker/list', params=params)
        return [Worker.from_dict(w) for w in result['workers']]

    def get_worker_stats(self) -> Dict[str, int]:
        """获取 Worker 统计"""
        result = self._request('GET', '/worker/stats')
        return result['stats']
```

---

### 2. 数据模型

```python
# pycore/callmodule/task_models.py

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from datetime import datetime

@dataclass
class Task:
    """任务模型"""
    task_id: str
    app_name: str
    task_type: str
    execution_type: str
    status: str
    progress: float
    assigned_to: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    priority: int = 0
    timeout_seconds: int = 120

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Task':
        """从字典创建 Task 对象"""
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})

    def is_completed(self) -> bool:
        return self.status == 'completed'

    def is_failed(self) -> bool:
        return self.status == 'failed'

    def is_processing(self) -> bool:
        return self.status == 'processing'

@dataclass
class Worker:
    """Worker 模型"""
    worker_id: str
    worker_name: str
    processor_types: List[str]
    status: str
    hostname: Optional[str] = None
    platform: Optional[str] = None
    completed_tasks: int = 0
    failed_tasks: int = 0
    current_task_id: Optional[str] = None
    last_heartbeat_at: Optional[str] = None
    created_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Worker':
        """从字典创建 Worker 对象"""
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})

    def is_online(self) -> bool:
        return self.status == 'online'

# 常量定义
class TaskStatus:
    PENDING = 'pending'
    ASSIGNED = 'assigned'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'

class ExecutionType:
    LOCAL_TIMER = 'local_timer'
    REMOTE_COMPUTE = 'remote_compute'
    REMOTE_OCR = 'remote_ocr'
    REMOTE_TRANSLATION = 'remote_translation'
    REMOTE_VIDEO = 'remote_video'
    REMOTE_IO = 'remote_io'

class WorkerStatus:
    ONLINE = 'online'
    BUSY = 'busy'
    OFFLINE = 'offline'
```

---

### 3. Worker 工作类

```python
# pycore/callmodule/task_worker.py

import time
import threading
import logging
from typing import Callable, Dict, Any, List
from .global_task_client import GlobalTaskClient
from .task_models import Task, ExecutionType

logger = logging.getLogger(__name__)

class TaskWorker:
    """任务 Worker 类"""

    def __init__(
        self,
        worker_name: str,
        processor_types: List[str],
        task_handler: Callable[[Task], Dict[str, Any]],
        base_url: str = "http://localhost:9000/api",
        heartbeat_interval: int = 30,
        pull_limit: int = 5
    ):
        self.worker_name = worker_name
        self.processor_types = processor_types
        self.task_handler = task_handler
        self.heartbeat_interval = heartbeat_interval
        self.pull_limit = pull_limit

        self.client = GlobalTaskClient(base_url)
        self.worker_id: Optional[str] = None
        self.running = False
        self.heartbeat_thread: Optional[threading.Thread] = None

    def start(self):
        """启动 Worker"""
        logger.info(f"Starting worker: {self.worker_name}")

        # 注册 Worker
        import socket
        import platform
        self.worker_id = self.client.register_worker(
            worker_name=self.worker_name,
            processor_types=self.processor_types,
            hostname=socket.gethostname(),
            platform=platform.system().lower()
        )
        logger.info(f"Worker registered: {self.worker_id}")

        # 启动心跳线程
        self.running = True
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

        # 主任务处理循环
        try:
            self._task_loop()
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        finally:
            self.stop()

    def stop(self):
        """停止 Worker"""
        logger.info("Stopping worker...")
        self.running = False

        if self.heartbeat_thread:
            self.heartbeat_thread.join(timeout=5)

        logger.info("Worker stopped")

    def _heartbeat_loop(self):
        """心跳循环（后台线程）"""
        while self.running:
            try:
                self.client.send_heartbeat(self.worker_id)
                logger.debug("Heartbeat sent")
            except Exception as e:
                logger.error(f"Heartbeat failed: {e}")

            time.sleep(self.heartbeat_interval)

    def _task_loop(self):
        """任务处理循环（主线程）"""
        while self.running:
            try:
                # 拉取任务 (Long Polling 30s)
                tasks = self.client.pull_tasks(self.worker_id, self.pull_limit)

                if not tasks:
                    logger.debug("No tasks available")
                    continue

                logger.info(f"Pulled {len(tasks)} tasks")

                # 处理每个任务
                for task in tasks:
                    if not self.running:
                        break

                    self._process_task(task)

            except Exception as e:
                logger.error(f"Task loop error: {e}")
                time.sleep(5)  # 出错后等待 5 秒

    def _process_task(self, task: Task):
        """处理单个任务"""
        logger.info(f"Processing task: {task.task_id} ({task.task_type})")

        try:
            # 接受任务
            self.client.accept_task(self.worker_id, task.task_id)

            # 执行任务处理函数
            result = self.task_handler(task)

            # 提交成功结果
            self.client.submit_result(
                worker_id=self.worker_id,
                task_id=task.task_id,
                success=True,
                result=result
            )
            logger.info(f"Task completed: {task.task_id}")

        except Exception as e:
            logger.error(f"Task processing failed: {e}")

            # 提交失败结果
            try:
                self.client.submit_result(
                    worker_id=self.worker_id,
                    task_id=task.task_id,
                    success=False,
                    error=str(e)
                )
            except Exception as submit_error:
                logger.error(f"Failed to submit error result: {submit_error}")
```

---

### 4. 使用示例

```python
# examples/global_task_example.py

import sys
sys.path.insert(0, '/www/programing/core_node')

from pycore.callmodule.global_task_client import GlobalTaskClient
from pycore.callmodule.task_worker import TaskWorker
from pycore.callmodule.task_models import Task, ExecutionType
import time
import logging

logging.basicConfig(level=logging.INFO)

# ==================== 示例 1: 创建任务 ====================

def example_create_task():
    """创建任务示例"""
    client = GlobalTaskClient()

    task_id = client.create_task(
        app_name="MyApp",
        task_type="compute_task",
        execution_type=ExecutionType.REMOTE_COMPUTE,
        payload={
            "input": "hello world",
            "operation": "uppercase"
        },
        priority=10,
        timeout_seconds=300
    )

    print(f"Task created: {task_id}")

    # 等待任务完成
    while True:
        task = client.get_task_status(task_id)
        print(f"Status: {task.status}, Progress: {task.progress}%")

        if task.is_completed():
            print(f"Result: {task.result}")
            break
        elif task.is_failed():
            print(f"Error: {task.error}")
            break

        time.sleep(2)

# ==================== 示例 2: Worker 处理任务 ====================

def my_task_handler(task: Task) -> dict:
    """自定义任务处理函数"""
    print(f"Processing task: {task.task_id}")
    print(f"Payload: {task.payload}")

    # 模拟任务处理
    time.sleep(3)

    # 返回处理结果
    return {
        "output": "Task processed successfully",
        "input_was": task.payload,
        "processed_at": time.time()
    }

def example_start_worker():
    """启动 Worker 示例"""
    worker = TaskWorker(
        worker_name="MyWorker",
        processor_types=[
            ExecutionType.REMOTE_COMPUTE,
            ExecutionType.REMOTE_OCR
        ],
        task_handler=my_task_handler,
        heartbeat_interval=30
    )

    worker.start()

# ==================== 示例 3: 查询统计信息 ====================

def example_get_stats():
    """查询统计信息示例"""
    client = GlobalTaskClient()

    # 任务统计
    task_stats = client.get_task_stats()
    print("Task Stats:", task_stats)

    # Worker 统计
    worker_stats = client.get_worker_stats()
    print("Worker Stats:", worker_stats)

    # Worker 列表
    workers = client.list_workers(status='online')
    print(f"Online Workers: {len(workers)}")
    for w in workers:
        print(f"  - {w.worker_name}: {w.completed_tasks} completed")

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python global_task_example.py create   # 创建任务")
        print("  python global_task_example.py worker   # 启动 Worker")
        print("  python global_task_example.py stats    # 查询统计")
    elif sys.argv[1] == 'create':
        example_create_task()
    elif sys.argv[1] == 'worker':
        example_start_worker()
    elif sys.argv[1] == 'stats':
        example_get_stats()
```

---

## 🔧 开发建议

### 错误处理
- 所有 API 调用都应该包含 try-except
- 网络错误应该重试（最多 3 次）
- 记录详细的错误日志

### 超时设置
- 普通 API 调用：30 秒超时
- Long Polling 拉取任务：35 秒超时（服务器等待 30 秒）
- 心跳间隔：30 秒（服务器超时 120 秒）

### 日志记录
- 使用 Python logging 模块
- 记录所有 API 调用和响应
- 记录任务处理开始和结束时间

### 性能优化
- 使用 requests.Session() 复用连接
- 并发处理多个任务（使用线程池）
- 缓存 Worker 信息

### 安全性
- 验证所有输入数据
- 不要在日志中记录敏感信息
- 后续添加 API Token 认证

---

## 📝 测试清单

- [ ] 测试任务创建
- [ ] 测试任务状态查询
- [ ] 测试任务列表查询
- [ ] 测试 Worker 注册
- [ ] 测试心跳机制
- [ ] 测试任务拉取（Long Polling）
- [ ] 测试任务接受
- [ ] 测试结果提交
- [ ] 测试错误处理
- [ ] 测试网络中断恢复
- [ ] 测试并发处理
- [ ] 测试优雅退出

---

## 📚 参考文档

- **服务端文档**: `poly_apps/laravel_main/GLOBAL_TASK_SYSTEM_SETUP.md`
- **测试报告**: `poly_apps/laravel_main/GLOBAL_TASK_SYSTEM_TEST_RESULTS.md`
- **Python 测试脚本**: `poly_apps/laravel_main/test_scripts/`

---

**开发优先级**: 高
**预计工时**: 2-3 天
**负责人**: 待分配
