# pythreadpool - Unified Thread Management

## Overview

The `pythreadpool` module provides centralized thread pool management and service registry for all pycore services. It offers a unified interface for thread registration, task handling, and service startup.

## Module Location

```
pycore/pythreadpool/
├── __init__.py
├── pool.py           # GlobalThreadPool
├── registry.py       # Thread registry
└── starters.py       # Service starters
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GlobalThreadPool                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              THREAD_REGISTRY                         │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │   │
│  │  │ heartbeat  │ │  rpc_v2    │ │  speech    │  ...  │   │
│  │  └────────────┘ └────────────┘ └────────────┘       │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SERVICE_STARTERS                        │   │
│  │  ┌───────────────┐ ┌───────────────┐               │   │
│  │  │start_heartbeat│ │ start_rpc_v2  │  ...          │   │
│  │  └───────────────┘ └───────────────┘               │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Task Handlers                           │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ Thread-specific handlers for task types    │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### GlobalThreadPool

Central thread registry:

```python
from pycore.pythreadpool import (
    GlobalThreadPool,
    get_global_thread_pool,
    ThreadStatus,
    ThreadInfo
)

# Get singleton
pool = get_global_thread_pool()

# Register thread
pool.register_thread(
    name="my_worker",
    instance=worker_thread,
    task_handlers={
        "task_type_a": handler_a,
        "task_type_b": handler_b
    },
    metadata={"max_queue": 10}
)

# Get thread info
info = pool.get_thread("my_worker")
print(f"Status: {info.status}")

# Get all threads
threads = pool.list_threads()

# Get handler for task type
handler = pool.get_handler("task_type_a")

# Unregister thread
pool.unregister_thread("my_worker")

# Get pool stats
stats = pool.get_stats()
```

### ThreadStatus

Thread state enumeration:

```python
from pycore.pythreadpool import ThreadStatus

class ThreadStatus(Enum):
    IDLE = "idle"           # Ready for tasks
    RUNNING = "running"     # Processing task
    STOPPED = "stopped"     # Stopped
    ERROR = "error"         # Error state
```

### ThreadInfo

Thread information container:

```python
from pycore.pythreadpool import ThreadInfo

@dataclass
class ThreadInfo:
    name: str                           # Thread name
    instance: threading.Thread          # Thread instance
    status: ThreadStatus                # Current status
    task_handlers: Dict[str, Callable]  # Task type handlers
    metadata: Dict[str, Any]            # Additional metadata
    registered_at: float                # Registration timestamp
    last_active: float                  # Last activity timestamp
```

### THREAD_REGISTRY

Service metadata registry:

```python
from pycore.pythreadpool import THREAD_REGISTRY

# Registry structure
THREAD_REGISTRY = {
    "heartbeat": {
        "description": "Heartbeat system for task scheduling",
        "default_config": {"interval": 1.0},
        "task_types": ["heartbeat"],
        "dependencies": []
    },
    "rpc_v2": {
        "description": "FastAPI RPC server",
        "default_config": {"port": 58100, "host": "0.0.0.0"},
        "task_types": ["rpc_request"],
        "dependencies": []
    },
    "speech": {
        "description": "TTS/STT speech services",
        "default_config": {"mode": "single"},
        "task_types": ["tts", "stt"],
        "dependencies": ["edge_tts"]
    }
}
```

### SERVICE_STARTERS

Service startup functions:

```python
from pycore.pythreadpool import SERVICE_STARTERS

# Starters registry
SERVICE_STARTERS = {
    "heartbeat": start_heartbeat,
    "rpc_v2": start_rpc_v2,
    "speech": start_speech,
    "ui": start_ui
}
```

### Service Starters

```python
from pycore.pythreadpool import (
    start_heartbeat,
    start_rpc_v2,
    start_speech,
    start_ui
)

# Start heartbeat system
heartbeat = start_heartbeat(config={"interval": 1.0})

# Start RPC server
rpc = start_rpc_v2(config={"port": 58100})

# Start speech services
speech = start_speech(config={"mode": "single"})

# Start UI framework
ui = start_ui(config={"framework": "pyside6"})
```

### register_service

Register custom service:

```python
from pycore.pythreadpool import register_service

def my_service_starter(config: dict) -> Any:
    """Start my custom service"""
    service = MyService(**config)
    service.start()
    return service

register_service(
    name="my_service",
    starter=my_service_starter,
    default_config={"param": "value"},
    task_types=["my_task"],
    dependencies=["rpc_v2"]
)
```

## Usage Examples

### Basic Thread Registration

```python
import threading
from pycore.pythreadpool import get_global_thread_pool

class MyWorkerThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.running = True
        self.task_queue = queue.Queue()
    
    def accept_task(self, task):
        if self.task_queue.qsize() < 10:
            self.task_queue.put(task)
            return True
        return False
    
    def run(self):
        while self.running:
            try:
                task = self.task_queue.get(timeout=1)
                self.process_task(task)
            except queue.Empty:
                continue

# Create and start thread
worker = MyWorkerThread()
worker.start()

# Register with pool
pool = get_global_thread_pool()
pool.register_thread(
    name="my_worker",
    instance=worker,
    task_handlers={"my_task": worker.accept_task},
    metadata={"max_queue": 10}
)
```

### Service Startup

```python
from pycore.pythreadpool import (
    start_heartbeat,
    start_rpc_v2,
    get_global_thread_pool
)

# Start services
heartbeat = start_heartbeat()
rpc = start_rpc_v2(config={"port": 58100})

# Check registered threads
pool = get_global_thread_pool()
for thread_name in pool.list_threads():
    info = pool.get_thread(thread_name)
    print(f"{thread_name}: {info.status}")
```

### Task Routing

```python
from pycore.pythreadpool import get_global_thread_pool
from pycore.pyfoundations.task_models import Task

pool = get_global_thread_pool()

def route_task(task: Task) -> bool:
    """Route task to appropriate handler"""
    handler = pool.get_handler(task.task_type)
    if handler:
        return handler(task)
    return False

# Route TTS task
tts_task = Task(task_type="tts", payload={"text": "Hello"})
routed = route_task(tts_task)
```

### Custom Service Registration

```python
from pycore.pythreadpool import register_service, get_global_thread_pool
import threading

class CustomService:
    def __init__(self, config):
        self.config = config
        self.thread = None
    
    def start(self):
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()
        
        # Register with thread pool
        pool = get_global_thread_pool()
        pool.register_thread(
            name="custom_service",
            instance=self.thread,
            task_handlers={"custom": self.handle_task}
        )
    
    def handle_task(self, task):
        # Process task
        return True
    
    def run(self):
        while True:
            time.sleep(1)

def start_custom_service(config):
    service = CustomService(config)
    service.start()
    return service

# Register service
register_service(
    name="custom_service",
    starter=start_custom_service,
    default_config={"option": "value"},
    task_types=["custom"]
)
```

### Pool Statistics

```python
from pycore.pythreadpool import get_global_thread_pool

pool = get_global_thread_pool()

stats = pool.get_stats()
print(f"Total threads: {stats['total_threads']}")
print(f"Active threads: {stats['active_threads']}")
print(f"Task handlers: {stats['task_handlers']}")

for name, info in stats['threads'].items():
    print(f"  {name}:")
    print(f"    Status: {info['status']}")
    print(f"    Task types: {info['task_types']}")
    print(f"    Last active: {info['last_active']}")
```

## Encyclopedia Integration

Thread pool uses Encyclopedia for persistence:

```python
from pycore.pythreadpool import (
    get_thread_pool_from_encyclopedia,
    THREAD_POOL_THREADS_KEY,
    THREAD_POOL_TASK_HANDLERS_KEY
)

# Get thread pool data from Encyclopedia
threads_data = get_thread_pool_from_encyclopedia()

# Keys used in Encyclopedia
print(THREAD_POOL_THREADS_KEY)       # "pythreadpool.threads"
print(THREAD_POOL_TASK_HANDLERS_KEY) # "pythreadpool.task_handlers"
```

## Best Practices

1. **Use Singleton**: Always use `get_global_thread_pool()`

2. **Register Handlers**: Define task handlers for all thread task types

3. **Set Metadata**: Include useful metadata like max_queue_size

4. **Check Status**: Verify thread status before routing tasks

5. **Clean Shutdown**: Unregister threads before stopping

## Related Modules

- `pycore.pyheartbeat` - Uses thread pool for task routing
- `pycore.pylauncher` - Service launcher
- `pycore.pyfoundations.global_task_queue` - Task queue

## Exports

```python
__all__ = [
    # Thread Pool
    'ThreadStatus',
    'ThreadInfo',
    'GlobalThreadPool',
    'get_global_thread_pool',
    'get_thread_pool_from_encyclopedia',
    'THREAD_POOL_THREADS_KEY',
    'THREAD_POOL_TASK_HANDLERS_KEY',
    
    # Registry
    'THREAD_REGISTRY',
    'SERVICE_STARTERS',
    'register_service',
    
    # Starters
    'start_heartbeat',
    'start_rpc_v2',
    'start_speech',
    'start_ui',
]
```



