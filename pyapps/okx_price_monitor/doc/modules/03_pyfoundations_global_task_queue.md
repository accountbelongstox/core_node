# pyfoundations.global_task_queue - Thread-Safe Priority Queue

## Overview

The `global_task_queue.py` module provides a thread-safe priority queue for global task scheduling within a Python process. It uses Python's built-in `queue.PriorityQueue` for zero-lock thread safety and serves as the central task submission point for all application threads.

## Module Location

```
pycore/pyfoundations/global_task_queue.py
```

## Dependencies

- Python Standard Library Only:
  - `queue` - Thread-safe queue implementation
  - `threading` - Thread synchronization primitives
  - `typing` - Type hints
  - `pycore.pyfoundations.task_models` - Task and TaskState definitions

## Architecture

### Task Flow

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Thread A   │───>│                  │───>│  HeartbeatPusher│
├─────────────┤    │  GlobalTaskQueue │    │  (1s interval)  │
│  Thread B   │───>│                  │───>├─────────────────┤
├─────────────┤    │  PriorityQueue   │    │  Task Handlers  │
│  Thread C   │───>│                  │───>│                 │
└─────────────┘    └──────────────────┘    └─────────────────┘
```

### Priority Ordering

Tasks are ordered by:
1. Priority value (lower = higher priority)
2. Creation timestamp (earlier = higher priority)

## Core Class: GlobalTaskQueue

### Class Definition

```python
class GlobalTaskQueue:
    """
    Global thread-safe priority task queue
    
    Uses queue.PriorityQueue for zero-lock thread safety.
    Shared by all application threads for task submission.
    """
```

### Constructor

```python
def __init__(self, max_size: int = 10000):
    """
    Initialize global task queue
    
    Args:
        max_size: Maximum queue size (default: 10000)
    """
```

**Internal Structures:**
- `_queue` - PriorityQueue for task ordering
- `_task_map` - Dictionary for task lookup by ID
- `_map_lock` - Threading lock for map access
- `_max_size` - Maximum queue capacity
- `_total_added` - Counter for total tasks added
- `_total_removed` - Counter for total tasks removed

### Methods

#### put(task: Task, block: bool = True, timeout: Optional[float] = None) -> bool

Adds a task to the queue:

```python
def put(self, task: Task, block: bool = True, timeout: Optional[float] = None) -> bool:
    """
    Add task to queue
    
    Args:
        task: Task to add
        block: Block if queue is full (default: True)
        timeout: Timeout in seconds (default: None)
    
    Returns:
        True if task was added, False otherwise
    
    Raises:
        queue.Full: If queue is full and block=False
    """
```

**Implementation Details:**
- Uses tuple `(priority_value, created_at, task)` for ordering
- Priority value ensures higher priority tasks processed first
- Created_at timestamp breaks ties (FIFO within same priority)
- Thread-safe access to task map via lock

**Example:**
```python
from pycore.pyfoundations.task_models import Task, TaskPriority

queue = GlobalTaskQueue()

task = Task(
    task_type='tts',
    payload={'text': 'Hello World'},
    priority=TaskPriority.HIGH
)

success = queue.put(task)
print(f"Task {task.task_id} added: {success}")
```

#### get(block: bool = True, timeout: Optional[float] = None) -> Optional[Task]

Gets the highest priority task from the queue:

```python
def get(self, block: bool = True, timeout: Optional[float] = None) -> Optional[Task]:
    """
    Get highest priority task from queue
    
    Args:
        block: Block if queue is empty (default: True)
        timeout: Timeout in seconds (default: None)
    
    Returns:
        Task if available, None otherwise
    """
```

**Non-Blocking Example:**
```python
task = queue.get(block=False)
if task:
    process_task(task)
else:
    print("Queue is empty")
```

**Blocking with Timeout:**
```python
task = queue.get(block=True, timeout=5.0)
if task:
    process_task(task)
else:
    print("Timeout waiting for task")
```

#### remove(task_id: str) -> bool

Removes/cancels a task by ID:

```python
def remove(self, task_id: str) -> bool:
    """
    Remove task from task map (used for cancellation)
    
    Note: Cannot remove from PriorityQueue efficiently,
    so we just remove from map and mark as cancelled.
    
    Args:
        task_id: Task ID to remove
    
    Returns:
        True if task was found and marked cancelled
    """
```

**Note:** Due to PriorityQueue implementation, tasks cannot be efficiently removed from the queue itself. Instead, tasks are marked as CANCELLED and filtered when processed.

#### get_task(task_id: str) -> Optional[Task]

Retrieves a task by its ID:

```python
task = queue.get_task('task-uuid-12345')
if task:
    print(f"Task state: {task.state}")
```

#### cleanup_completed(max_keep: int = 1000)

Cleans up completed/failed/cancelled tasks from the task map:

```python
def cleanup_completed(self, max_keep: int = 1000):
    """
    Clean up completed/failed/cancelled tasks from map
    
    Args:
        max_keep: Maximum number of completed tasks to keep
    """
```

**Implementation:**
- Sorts completed tasks by completion time
- Removes oldest tasks beyond max_keep threshold
- Should be called periodically to prevent memory growth

#### size() -> int

Returns current queue size:

```python
count = queue.size()
print(f"Queue has {count} pending tasks")
```

#### is_empty() -> bool

Checks if queue is empty:

```python
if queue.is_empty():
    print("No pending tasks")
```

#### is_full() -> bool

Checks if queue is full:

```python
if queue.is_full():
    print("Queue is full, cannot add more tasks")
```

#### get_stats() -> Dict[str, int]

Returns comprehensive queue statistics:

```python
def get_stats(self) -> Dict[str, int]:
    """
    Get queue statistics
    
    Returns:
        Dictionary with queue statistics
    """
```

**Return Format:**
```python
{
    'queue_size': 50,           # Current pending tasks
    'total_tasks': 150,         # Total tasks in map
    'total_added': 200,         # Lifetime tasks added
    'total_removed': 150,       # Lifetime tasks removed
    'max_size': 10000,          # Queue capacity
    'is_full': False,           # Full status
    'state_counts': {           # Tasks by state
        'pending': 50,
        'running': 5,
        'completed': 80,
        'failed': 10,
        'cancelled': 5
    }
}
```

#### get_pending_tasks() -> List[Task]

Returns list of all pending tasks:

```python
pending = queue.get_pending_tasks()
for task in pending:
    print(f"Pending: {task.task_id} ({task.task_type})")
```

#### get_running_tasks() -> List[Task]

Returns list of all running tasks:

```python
running = queue.get_running_tasks()
for task in running:
    print(f"Running: {task.task_id} started at {task.started_at}")
```

#### clear()

Clears all tasks from queue and map:

```python
queue.clear()
print("Queue cleared")
```

## Singleton Pattern

### get_global_task_queue() -> GlobalTaskQueue

Returns the global singleton instance:

```python
_global_task_queue: Optional[GlobalTaskQueue] = None
_queue_lock = threading.Lock()

def get_global_task_queue() -> GlobalTaskQueue:
    """
    Get global task queue singleton
    
    Returns:
        GlobalTaskQueue singleton instance
    """
    global _global_task_queue
    
    if _global_task_queue is None:
        with _queue_lock:
            if _global_task_queue is None:
                _global_task_queue = GlobalTaskQueue()
    
    return _global_task_queue
```

**Usage:**
```python
from pycore.pyfoundations.global_task_queue import get_global_task_queue

queue = get_global_task_queue()
```

## Integration with Task Models

### Task Class (from task_models.py)

```python
from pycore.pyfoundations.task_models import Task, TaskPriority, TaskState

# Create task
task = Task(
    task_type='tts',
    payload={'text': 'Hello', 'voice': 'en-US'},
    priority=TaskPriority.HIGH,
    callback=lambda result: print(f"Done: {result}")
)

# Check task state
print(task.state)  # TaskState.PENDING

# Mark running
task.mark_running()
print(task.state)  # TaskState.RUNNING

# Mark completed
task.mark_completed(result={'audio_path': '/tmp/output.mp3'})
print(task.state)  # TaskState.COMPLETED
```

### TaskPriority Enum

```python
class TaskPriority(Enum):
    URGENT = 0      # Highest priority (immediate)
    CRITICAL = 1    # Critical tasks (system-level)
    HIGH = 2        # High priority
    NORMAL = 3      # Normal priority (default)
    LOW = 4         # Low priority
    BACKGROUND = 5  # Background tasks
```

### TaskState Enum

```python
class TaskState(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
```

## Usage Examples

### Basic Task Submission

```python
from pycore.pyfoundations.global_task_queue import get_global_task_queue
from pycore.pyfoundations.task_models import Task, TaskPriority

queue = get_global_task_queue()

# Submit high priority task
task = Task(
    task_type='tts',
    payload={'text': 'Urgent message'},
    priority=TaskPriority.HIGH
)
queue.put(task)

# Submit normal priority task
task2 = Task(
    task_type='tts',
    payload={'text': 'Regular message'},
    priority=TaskPriority.NORMAL
)
queue.put(task2)
```

### Task Consumer Pattern

```python
import threading
from pycore.pyfoundations.global_task_queue import get_global_task_queue

def consumer_thread():
    queue = get_global_task_queue()
    
    while True:
        task = queue.get(timeout=1.0)
        
        if task is None:
            continue
        
        if task.state == TaskState.CANCELLED:
            continue  # Skip cancelled tasks
        
        task.mark_running()
        
        try:
            result = process_task(task)
            task.mark_completed(result=result)
        except Exception as e:
            task.mark_failed(error=str(e))

# Start consumer
thread = threading.Thread(target=consumer_thread, daemon=True)
thread.start()
```

### Priority-Based Processing

```python
queue = get_global_task_queue()

# Add tasks in random order
queue.put(Task(task_type='a', priority=TaskPriority.LOW))
queue.put(Task(task_type='b', priority=TaskPriority.URGENT))
queue.put(Task(task_type='c', priority=TaskPriority.NORMAL))

# Tasks will be retrieved in priority order:
# 1. URGENT (b)
# 2. NORMAL (c)
# 3. LOW (a)
```

### Task Status Monitoring

```python
queue = get_global_task_queue()

# Submit task
task = Task(task_type='long_running', payload={})
queue.put(task)

# Monitor status
while True:
    current_task = queue.get_task(task.task_id)
    if current_task:
        print(f"State: {current_task.state}")
        if current_task.state in (TaskState.COMPLETED, TaskState.FAILED):
            break
    time.sleep(1)
```

### Queue Statistics Monitoring

```python
queue = get_global_task_queue()

def print_stats():
    stats = queue.get_stats()
    print(f"Queue size: {stats['queue_size']}/{stats['max_size']}")
    print(f"Total added: {stats['total_added']}")
    print(f"Total removed: {stats['total_removed']}")
    print(f"State counts: {stats['state_counts']}")

# Print stats periodically
while True:
    print_stats()
    time.sleep(5)
```

## Thread Safety

### PriorityQueue Thread Safety

Python's `queue.PriorityQueue` is inherently thread-safe:
- All queue operations use internal locking
- `put()` and `get()` are atomic
- Multiple threads can safely access the queue

### Task Map Access

The `_task_map` dictionary is protected by `_map_lock`:

```python
with self._map_lock:
    self._task_map[task.task_id] = task
```

### Safe Patterns

```python
# Safe: Multiple threads submitting tasks
def producer_thread(queue, tasks):
    for task in tasks:
        queue.put(task)  # Thread-safe

# Safe: Multiple threads consuming tasks
def consumer_thread(queue):
    while True:
        task = queue.get(timeout=1.0)  # Thread-safe
        if task:
            process(task)
```

## Performance Considerations

1. **Queue Operations**: O(log n) for put/get (heap-based)
2. **Task Lookup**: O(1) for get_task (dictionary)
3. **Statistics**: O(n) for get_stats (iterates all tasks)
4. **Cleanup**: O(n log n) for cleanup_completed (sorting)

## Best Practices

1. **Use Singleton**: Always use `get_global_task_queue()` for consistency
2. **Check Cancelled Tasks**: Filter cancelled tasks when processing
3. **Periodic Cleanup**: Call `cleanup_completed()` to manage memory
4. **Appropriate Priorities**: Reserve URGENT for truly time-critical tasks
5. **Handle Timeouts**: Use `timeout` parameter for responsive shutdown

## Related Modules

- `pycore.pyfoundations.task_models` - Task and priority definitions
- `pycore.pyheartbeat` - HeartbeatPusher uses this queue
- `pycore.pythreadpool` - Thread pool task handlers

## Exports

```python
__all__ = [
    'GlobalTaskQueue',
    'get_global_task_queue'
]
```

