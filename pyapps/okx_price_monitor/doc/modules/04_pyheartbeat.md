# pyheartbeat - Global Task Scheduler and Thread Management

## Overview

The `pyheartbeat` module provides a lightweight, thread-pool-based task dispatching system with no hardcoded dependencies. Threads register themselves with task type handlers, and the heartbeat pusher routes tasks to registered threads based on task_type.

## Module Location

```
pycore/pyheartbeat/
├── __init__.py
├── heartbeat_system.py
├── heartbeat_pusher.py
├── unified_api.py
├── PYHEARTBEAT_ARCHITECTURE.md
└── INTEGRATION_SPECIFICATION.md
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HeartbeatSystem                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ GlobalTaskQueue │  │ GlobalThreadPool│  │HeartbeatPush│ │
│  │  (pyfoundations)│  │  (pythreadpool) │  │    er       │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                  │        │
│           └────────────────────┴──────────────────┘        │
│                            ▲                               │
│                            │ 1s heartbeat                  │
│                            │                               │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     UnifiedTaskAPI                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ addTTSTask  │  │ addSTTTask  │  │ addGenericTask      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Task Submission**: Application calls `UnifiedTaskAPI.addTask()`
2. **Queue Storage**: Task stored in `GlobalTaskQueue`
3. **Heartbeat Loop**: `HeartbeatPusher` runs every 1 second
4. **Task Distribution**: Pusher reads tasks and routes to registered handlers
5. **Handler Execution**: Thread with matching handler processes task

## Core Components

### HeartbeatSystem

Central coordinator that manages all heartbeat components:

```python
from pycore.pyheartbeat import HeartbeatSystem, initialize_heartbeat_system

# Initialize and start
system = initialize_heartbeat_system()
system.start()

# Stop
system.stop()
```

**Class Definition:**
```python
class HeartbeatSystem:
    """
    Central coordinator for heartbeat-based task scheduling
    
    Manages:
    - GlobalTaskQueue (task storage)
    - GlobalThreadPool (thread registry)
    - HeartbeatPusher (task distribution)
    """
    
    def __init__(self):
        self._task_queue = None
        self._thread_pool = None
        self._pusher = None
        self._started = False
    
    def start(self):
        """Start all heartbeat components"""
        
    def stop(self):
        """Stop all heartbeat components"""
        
    def get_status(self) -> Dict[str, Any]:
        """Get system status"""
```

### HeartbeatPusher

1-second heartbeat loop that distributes tasks:

```python
class HeartbeatPusher(threading.Thread):
    """
    Heartbeat thread that runs every 1 second
    
    Responsibilities:
    - Read tasks from GlobalTaskQueue
    - Route tasks to appropriate handlers based on task_type
    - Track task execution statistics
    """
    
    HEARTBEAT_INTERVAL = 1.0  # seconds
    
    def run(self):
        while self._running:
            self._process_pending_tasks()
            time.sleep(self.HEARTBEAT_INTERVAL)
```

**Task Routing:**
```python
def _process_pending_tasks(self):
    queue = get_global_task_queue()
    pool = get_global_thread_pool()
    
    while not queue.is_empty():
        task = queue.get(block=False)
        if task is None:
            break
        
        # Find handler for task type
        handler = pool.get_handler(task.task_type)
        if handler:
            accepted = handler(task)
            if not accepted:
                # Re-queue if handler rejected
                queue.put(task)
```

### UnifiedTaskAPI

Simple task submission interface:

```python
from pycore.pyheartbeat import UnifiedTaskAPI, get_unified_api

api = get_unified_api()

# Add TTS task
task_id = api.addTTSTask(
    text='Hello World',
    voice='en-US',
    priority=TaskPriority.HIGH
)

# Add generic task
task_id = api.addTask(
    task_type='custom',
    payload={'key': 'value'},
    priority=TaskPriority.NORMAL
)

# Get task status
status = api.getTask(task_id)
print(f"State: {status.state}")

# Cancel task
api.cancelTask(task_id)
```

**Available Methods:**
```python
class UnifiedTaskAPI:
    def addTask(self, task_type: str, payload: dict, 
                priority: TaskPriority = TaskPriority.NORMAL,
                callback: Callable = None) -> str:
        """Add generic task"""
    
    def addTTSTask(self, text: str, voice: str = None,
                   priority: TaskPriority = TaskPriority.NORMAL) -> str:
        """Add TTS task"""
    
    def addSTTTask(self, audio_path: str = None,
                   priority: TaskPriority = TaskPriority.NORMAL) -> str:
        """Add STT task"""
    
    def getTask(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
    
    def cancelTask(self, task_id: str) -> bool:
        """Cancel task"""
    
    def getQueueStats(self) -> Dict[str, Any]:
        """Get queue statistics"""
```

## Thread Registration

Threads register with the GlobalThreadPool:

```python
from pycore.pythreadpool import get_global_thread_pool
from pycore.pyfoundations.task_models import Task

def accept_tts_task(task: Task) -> bool:
    """
    Task handler function
    
    Returns:
        True if task accepted
        False if task rejected (will be re-queued)
    """
    if tts_queue.qsize() < 10:
        tts_queue.put(task)
        task.mark_running()
        return True
    return False

# Register thread with handlers
pool = get_global_thread_pool()
pool.register_thread(
    name='tts_worker',
    instance=tts_thread,
    task_handlers={
        'tts': accept_tts_task,
        'audio': accept_audio_task
    },
    metadata={'max_queue_size': 10}
)
```

## Usage Examples

### Complete Setup

```python
from pycore.pyheartbeat import (
    initialize_heartbeat_system,
    get_unified_api,
    get_global_thread_pool
)
from pycore.pyfoundations.task_models import Task, TaskPriority
import threading
import queue

# Step 1: Create worker thread
class TTSWorkerThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.task_queue = queue.Queue()
        self._running = True
    
    def accept_task(self, task: Task) -> bool:
        if self.task_queue.qsize() < 10:
            self.task_queue.put(task)
            return True
        return False
    
    def run(self):
        while self._running:
            try:
                task = self.task_queue.get(timeout=1.0)
                task.mark_running()
                # Process task...
                result = self.process_tts(task.payload)
                task.mark_completed(result=result)
            except queue.Empty:
                continue

# Step 2: Initialize heartbeat system
system = initialize_heartbeat_system()

# Step 3: Create and register worker
worker = TTSWorkerThread()
worker.start()

pool = get_global_thread_pool()
pool.register_thread(
    name='tts_worker',
    instance=worker,
    task_handlers={'tts': worker.accept_task}
)

# Step 4: Start heartbeat
system.start()

# Step 5: Submit tasks
api = get_unified_api()
task_id = api.addTTSTask(text='Hello World')

# Monitor
import time
while True:
    task = api.getTask(task_id)
    if task and task.state.value in ('completed', 'failed'):
        print(f"Task finished: {task.state}")
        break
    time.sleep(0.5)

# Cleanup
system.stop()
```

### Multiple Task Types

```python
from pycore.pyheartbeat import get_unified_api

api = get_unified_api()

# TTS Task
tts_id = api.addTTSTask(
    text='Welcome message',
    voice='en-US',
    priority=TaskPriority.HIGH
)

# STT Task
stt_id = api.addSTTTask(
    audio_path='/path/to/audio.wav',
    priority=TaskPriority.NORMAL
)

# Custom Task
custom_id = api.addTask(
    task_type='image_processing',
    payload={
        'input': '/path/to/image.jpg',
        'operation': 'resize',
        'width': 800,
        'height': 600
    },
    priority=TaskPriority.LOW
)
```

### Status Monitoring

```python
from pycore.pyheartbeat import get_heartbeat_system

system = get_heartbeat_system()
status = system.get_status()

print(f"System running: {status['running']}")
print(f"Uptime: {status['uptime']}s")
print(f"Queue size: {status['queue_stats']['queue_size']}")
print(f"Registered threads: {status['thread_count']}")

for thread_name, thread_info in status['threads'].items():
    print(f"  {thread_name}: {thread_info['status']}")
```

## Integration with pyctl.speech

The speech module uses pyheartbeat for TTS/STT processing:

```python
from pycore.pyctl.speech import get_speech_manager

# Speech manager auto-registers with heartbeat
speech = get_speech_manager()

# Tasks submitted through speech manager
# are routed through heartbeat system
speech.speak("Hello World")
```

## Singleton Functions

```python
from pycore.pyheartbeat import (
    # System
    HeartbeatSystem,
    get_heartbeat_system,
    initialize_heartbeat_system,
    
    # API
    UnifiedTaskAPI,
    get_unified_api,
    
    # Thread Pool (re-exported)
    ThreadStatus,
    ThreadInfo,
    GlobalThreadPool,
    get_global_thread_pool,
    
    # Pusher
    HeartbeatPusher,
)
```

## Configuration

### Heartbeat Interval

Default: 1 second (hardcoded in HeartbeatPusher)

### Queue Size

Default: 10000 tasks (configurable in GlobalTaskQueue)

### Task Timeout

No built-in timeout - tasks remain until processed or cancelled

## Best Practices

1. **Register Handlers Before Starting**: Register all thread handlers before calling `system.start()`

2. **Use Task Priorities Wisely**: Reserve HIGH/URGENT for time-critical tasks

3. **Implement Handler Rejection**: Handlers should return False when overloaded

4. **Monitor Queue Statistics**: Track queue growth to detect bottlenecks

5. **Clean Up Completed Tasks**: Call `cleanup_completed()` periodically

6. **Graceful Shutdown**: Call `system.stop()` before application exit

## Error Handling

- Tasks that fail are marked with `TaskState.FAILED`
- Rejected tasks are re-queued automatically
- Handler exceptions are caught and logged

## Related Modules

- `pycore.pyfoundations.global_task_queue` - Task queue implementation
- `pycore.pyfoundations.task_models` - Task definitions
- `pycore.pythreadpool` - Thread pool registry
- `pycore.pyctl.speech` - Speech integration

## Exports

```python
__all__ = [
    # System
    'HeartbeatSystem',
    'get_heartbeat_system',
    'initialize_heartbeat_system',
    
    # Unified API
    'UnifiedTaskAPI',
    'get_unified_api',
    
    # Thread Pool
    'ThreadStatus',
    'ThreadInfo',
    'GlobalThreadPool',
    'get_global_thread_pool',
    'get_thread_pool_from_encyclopedia',
    'THREAD_POOL_THREADS_KEY',
    'THREAD_POOL_TASK_HANDLERS_KEY',
    
    # Heartbeat Pusher
    'HeartbeatPusher',
]

__version__ = '2.0.0'
```

