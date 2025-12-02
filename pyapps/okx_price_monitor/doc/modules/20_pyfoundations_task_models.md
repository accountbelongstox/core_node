# pyfoundations.task_models - Task Models

## Overview

The `task_models` module provides foundation classes for the task-based scheduling system. It defines Task, TaskState, and TaskPriority used throughout pycore.

## Module Location

```
pycore/pyfoundations/task_models.py
```

## Core Components

### TaskState

Task execution states:

```python
from pycore.pyfoundations.task_models import TaskState

class TaskState(Enum):
    PENDING = "pending"       # Not yet started
    RUNNING = "running"       # Currently executing
    COMPLETED = "completed"   # Finished successfully
    FAILED = "failed"         # Finished with error
    CANCELLED = "cancelled"   # Cancelled before completion
```

### TaskPriority

Task priority levels:

```python
from pycore.pyfoundations.task_models import TaskPriority

class TaskPriority(Enum):
    URGENT = 0      # Highest priority (immediate)
    CRITICAL = 1    # Critical system tasks
    HIGH = 2        # High priority tasks
    NORMAL = 3      # Normal priority (default)
    LOW = 4         # Low priority tasks
    BACKGROUND = 5  # Background processing
```

### Task

Task definition:

```python
from pycore.pyfoundations.task_models import Task, TaskPriority

@dataclass
class Task:
    task_id: str                          # Unique identifier (auto UUID)
    task_type: str                        # Task type for routing
    payload: Dict[str, Any]               # Task data
    priority: TaskPriority                # Priority level
    state: TaskState                      # Current state
    created_at: float                     # Creation timestamp
    started_at: Optional[float]           # Start timestamp
    completed_at: Optional[float]         # Completion timestamp
    result: Optional[Any]                 # Result data
    error: Optional[str]                  # Error message
    callback: Optional[Callable]          # Completion callback
```

## Task Methods

```python
from pycore.pyfoundations.task_models import Task, TaskPriority

# Create task
task = Task(
    task_type="tts",
    payload={"text": "Hello World"},
    priority=TaskPriority.HIGH,
    callback=lambda result: print(f"Done: {result}")
)

# Check state
print(task.state)          # TaskState.PENDING
print(task.task_id)        # uuid-12345...
print(task.created_at)     # 1699123456.789

# State transitions
task.mark_running()
print(task.state)          # TaskState.RUNNING
print(task.started_at)     # 1699123457.000

task.mark_completed(result={"audio": "/path/to/file.mp3"})
print(task.state)          # TaskState.COMPLETED
print(task.result)         # {"audio": "/path/to/file.mp3"}
print(task.completed_at)   # 1699123458.000

# Or mark failed
task.mark_failed(error="Network timeout")
print(task.state)          # TaskState.FAILED
print(task.error)          # "Network timeout"

# Or mark cancelled
task.mark_cancelled()
print(task.state)          # TaskState.CANCELLED

# Get duration
duration = task.get_duration()  # seconds
```

## Usage Examples

### Create Tasks

```python
from pycore.pyfoundations.task_models import Task, TaskPriority

# TTS task
tts_task = Task(
    task_type="tts",
    payload={
        "text": "Hello, this is a test.",
        "voice": "en-US-JennyNeural"
    },
    priority=TaskPriority.NORMAL
)

# High priority task
urgent_task = Task(
    task_type="alert",
    payload={"message": "Critical error!"},
    priority=TaskPriority.URGENT
)

# Background task
background_task = Task(
    task_type="cleanup",
    payload={"max_age": 3600},
    priority=TaskPriority.BACKGROUND
)
```

### With Callback

```python
def on_complete(result):
    if result.get("success"):
        print(f"Task completed: {result['data']}")
    else:
        print(f"Task failed: {result.get('error')}")

task = Task(
    task_type="process",
    payload={"input": "data.txt"},
    callback=on_complete
)

# After processing
task.mark_completed(result={"success": True, "data": "processed"})
# Callback is automatically invoked
```

### Task Processing

```python
def process_task(task: Task):
    task.mark_running()
    
    try:
        # Do work
        result = do_work(task.payload)
        task.mark_completed(result=result)
    except Exception as e:
        task.mark_failed(error=str(e))

# Process tasks from queue
while True:
    task = queue.get()
    if task.state == TaskState.CANCELLED:
        continue
    process_task(task)
```

### Priority Sorting

```python
tasks = [
    Task(task_type="a", priority=TaskPriority.LOW),
    Task(task_type="b", priority=TaskPriority.URGENT),
    Task(task_type="c", priority=TaskPriority.NORMAL),
]

# Sort by priority (lower value = higher priority)
sorted_tasks = sorted(tasks, key=lambda t: t.priority.value)
# Order: b (URGENT), c (NORMAL), a (LOW)
```

## Comparison Methods

```python
# Tasks support comparison for priority queues
task1 = Task(task_type="a", priority=TaskPriority.HIGH)
task2 = Task(task_type="b", priority=TaskPriority.LOW)

# Compare by (priority, created_at)
print(task1 < task2)  # True (HIGH < LOW in priority)

# Use in sorted containers
import heapq
heap = []
heapq.heappush(heap, task1)
heapq.heappush(heap, task2)
```

## Best Practices

1. **Use Appropriate Priority**: Reserve URGENT for truly time-critical tasks
2. **Set Task Type**: Use descriptive types for routing
3. **Include Callback**: For async completion notification
4. **Check State**: Verify state before processing
5. **Handle Cancellation**: Skip cancelled tasks

## Exports

```python
__all__ = [
    'TaskState',
    'TaskPriority',
    'Task',
]
```




