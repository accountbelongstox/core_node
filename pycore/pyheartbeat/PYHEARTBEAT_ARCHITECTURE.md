# PyHeartbeat Architecture Specification

## 1. Overview

### 1.1 Core Concept
PyHeartbeat is a lightweight, thread-pool-based task dispatching system. It does NOT import or hardcode any external subsystems (TTS, RPC, UI, etc.). Instead, threads register themselves with their task processing capabilities, and the heartbeat pusher routes tasks to registered threads based on task type.

### 1.2 Key Principles
1. **No Hardcoded Dependencies**: PyHeartbeat does not know about TTS, RPC, UI, or any other subsystem
2. **Thread-Centric**: Threads register with task type handlers they can process
3. **Self-Service Registration**: Each subsystem registers its own thread and capabilities
4. **State-Based Acceptance**: Threads decide whether to accept tasks based on their current state
5. **Simple Architecture**: Only 5 core components (no adapters, registries, dispatchers)
6. **Global State via Encyclopedia**: Thread pool mappings stored in Encyclopedia for cross-module access

## 2. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                  Application Entry Point                       │
│               (pylauncher/launcher.py)                         │
└────────────────────────┬───────────────────────────────────────┘
                         │ Initialize
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                   PyHeartbeat System                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         GlobalTaskQueue (in pyfoundations)               │ │
│  │   - Thread-safe priority queue                           │ │
│  │   - Stores Task objects with task_type field             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           ↑                                    │
│                           │ add_task()                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            UnifiedTaskAPI                                │ │
│  │   - addTTSTask(), addRPCTask(), etc.                     │ │
│  │   - Simple wrappers around task queue                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            GlobalThreadPool                              │ │
│  │   - name -> ThreadInfo mapping                           │ │
│  │   - task_type -> [thread_names] mapping                  │ │
│  │   - Thread health monitoring                             │ │
│  │   - Syncs to Encyclopedia on all state changes           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                    ↕ sync                  ↑                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │   Encyclopedia (Global State in pyfoundations)           │ │
│  │   - heartbeat.thread_pool.threads                        │ │
│  │   - heartbeat.thread_pool.task_type_handlers             │ │
│  │   - Globally accessible from any module                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                           ↑                                    │
│                           │ register_thread()                  │
│                           │ (with task_handlers dict)          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │          HeartbeatPusher (1s tick)                       │ │
│  │   1. Poll GlobalTaskQueue                                │ │
│  │   2. Get task.task_type                                  │ │
│  │   3. Find threads in ThreadPool by task_type             │ │
│  │   4. Call thread's handler_fn(task) function             │ │
│  │   5. Thread returns True (accepted) or False (busy)      │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                           │
                           │ Registered threads
                           ▼
┌────────────────────────────────────────────────────────────────┐
│              External Subsystem Threads                        │
│   (TTS Worker, RPC Server, UI Thread, Browser Thread, etc.)   │
│                                                                │
│   Each thread:                                                 │
│   1. Registers with GlobalThreadPool on startup                │
│   2. Provides: name, instance, task_handlers dict, metadata    │
│   3. task_handlers: {'task_type': handler_fn(task) -> bool}   │
│   4. Processes tasks in its own internal queue                 │
│   5. Updates heartbeat periodically                            │
│   6. State automatically synced to Encyclopedia                │
└────────────────────────────────────────────────────────────────┘
```

## 3. Core Components

### 3.1 GlobalTaskQueue (in pyfoundations)

**Location**: `pycore/pyfoundations/global_task_queue.py`

**Purpose**: Thread-safe priority queue for all tasks

**Key Methods**:
```python
queue.put(task: Task)           # Add task
queue.get() -> Task             # Get highest priority task
queue.get_task(task_id) -> Task # Get task by ID
```

**Task Model**:
```python
class Task:
    task_id: str          # UUID
    task_type: str        # 'tts', 'rpc', 'ui', 'browser', etc.
    task_data: Dict       # Task payload
    priority: TaskPriority
    state: TaskState      # PENDING, RUNNING, COMPLETED, FAILED
    callback: Callable    # Optional callback
```

### 3.2 GlobalThreadPool

**Location**: `pycore/pyheartbeat/thread_pool.py`

**Purpose**: Central registry for all threads and their task processing capabilities

**Thread Registration**:
```python
class ThreadInfo:
    name: str                                           # Thread identifier
    instance: threading.Thread                          # Thread instance
    task_handlers: Dict[str, Callable[[Task], bool]]    # Map: task_type -> handler_fn
    thread_id: Optional[int]                            # Thread ID
    status: ThreadStatus                                # STARTING, RUNNING, STOPPED, ERROR
    last_heartbeat: float                               # Timestamp for health monitoring
    metadata: Dict[str, Any]                            # Additional info

class GlobalThreadPool:
    _threads: Dict[str, ThreadInfo]                 # name -> ThreadInfo
    _task_type_handlers: Dict[str, List[str]]       # task_type -> [thread_names]

    def register_thread(
        name: str,
        instance: Thread,
        task_handlers: Dict[str, Callable[[Task], bool]],  # {'tts': handler_fn}
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool

    def get_handlers_for_task_type(task_type: str) -> List[Tuple[ThreadInfo, Callable]]

    def update_heartbeat(name: str)

    def _sync_to_encyclopedia()  # Syncs thread pool state to Encyclopedia
```

**Encyclopedia Keys**:
```python
THREAD_POOL_THREADS_KEY = 'heartbeat.thread_pool.threads'
THREAD_POOL_TASK_HANDLERS_KEY = 'heartbeat.thread_pool.task_type_handlers'
```

**Global Access Helper**:
```python
from pycore.pyheartbeat import get_thread_pool_from_encyclopedia

# From any module, get thread pool state
pool_data = get_thread_pool_from_encyclopedia()
# Returns: {'threads': {...}, 'task_type_handlers': {...}}
```

**Example Registration**:
```python
# In TTS subsystem initialization
from pycore.pyheartbeat import get_global_thread_pool
from pycore.pyfoundations import Task

def accept_tts_task(task: Task) -> bool:
    """Handler for 'tts' task type"""
    if tts_queue.qsize() < 10:
        tts_queue.put(task)
        task.mark_running()
        return True
    return False

def accept_audio_task(task: Task) -> bool:
    """Handler for 'audio' task type"""
    if audio_queue.qsize() < 5:
        audio_queue.put(task)
        task.mark_running()
        return True
    return False

thread_pool = get_global_thread_pool()
thread_pool.register_thread(
    name='tts_worker',
    instance=tts_thread,
    task_handlers={
        'tts': accept_tts_task,      # Register handler for 'tts' tasks
        'audio': accept_audio_task    # Register handler for 'audio' tasks
    },
    metadata={'max_queue_size': 10, 'description': 'TTS worker thread'}
)

# Thread pool automatically syncs to Encyclopedia!
# Now accessible globally via ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY)
```

### 3.3 HeartbeatPusher

**Location**: `pycore/pyheartbeat/heartbeat_pusher.py`

**Purpose**: 1-second heartbeat loop that routes tasks to threads

**Algorithm**:
```python
def _tick():
    # 1. Get next task from queue
    task = global_task_queue.get(block=False)
    if not task:
        return

    # 2. Find threads that can handle this task_type
    handler_threads = thread_pool.get_handlers_for_task_type(task.task_type)

    if not handler_threads:
        # No handler registered for this task type
        task.mark_failed(f"No handler for task_type: {task.task_type}")
        return

    # 3. Try each handler until one accepts
    for thread_info in handler_threads:
        if thread_info.status != ThreadStatus.RUNNING:
            continue  # Skip non-running threads

        # 4. Offer task to thread
        accepted = thread_info.accept_task_fn(task)

        if accepted:
            # Thread accepted task
            return

    # 5. No thread accepted - requeue task
    global_task_queue.put(task)
```

### 3.4 UnifiedTaskAPI

**Location**: `pycore/pyheartbeat/unified_api.py`

**Purpose**: Simple interface for task submission

**Methods**:
```python
class UnifiedTaskAPI:
    def addTTSTask(text: str, **kwargs) -> str
    def addRPCTask(method: str, params: Dict, **kwargs) -> str
    def addUITask(action: str, params: Dict, **kwargs) -> str
    def addBrowserTask(action: str, url: str, **kwargs) -> str

    def hasTask(task_id: str) -> bool
    def getTask(task_id: str) -> Dict
    def cancelTask(task_id: str) -> bool
    def getStats() -> Dict
```

**Implementation**:
```python
def addTTSTask(self, text: str, voice='default', priority=TaskPriority.NORMAL, **kwargs):
    task = Task(
        task_type='tts',  # Key: task type identifier
        task_data={'text': text, 'voice': voice},
        priority=priority,
        **kwargs
    )
    global_task_queue.put(task)
    return task.task_id
```

### 3.5 Encyclopedia Integration

**Location**: Thread pool mappings stored in Encyclopedia (Global State)

**Purpose**: Make thread pool state globally accessible from any module

**Encyclopedia Keys**:
```python
THREAD_POOL_THREADS_KEY = 'heartbeat.thread_pool.threads'
THREAD_POOL_TASK_HANDLERS_KEY = 'heartbeat.thread_pool.task_type_handlers'
```

**Automatic Synchronization**:
Thread pool automatically syncs to Encyclopedia on:
- Thread registration (`register_thread()`)
- Thread unregistration (`unregister_thread()`)
- Heartbeat updates (`update_heartbeat()`)
- Status changes (`update_status()`)

**Accessing Thread Pool from Any Module**:
```python
# Method 1: Direct access via Encyclopedia
from pycore.pyfoundations import ENCYCLOPEDIA
from pycore.pyheartbeat import THREAD_POOL_THREADS_KEY, THREAD_POOL_TASK_HANDLERS_KEY

threads_data = ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY)
# Returns: {'thread_name': {'name': ..., 'task_types': [...], 'status': ..., ...}}

handlers_data = ENCYCLOPEDIA.get(THREAD_POOL_TASK_HANDLERS_KEY)
# Returns: {'task_type': ['thread1', 'thread2', ...]}

# Method 2: Helper function
from pycore.pyheartbeat import get_thread_pool_from_encyclopedia

pool_data = get_thread_pool_from_encyclopedia()
if pool_data:
    threads = pool_data['threads']
    task_type_handlers = pool_data['task_type_handlers']
```

**Thread Data Structure in Encyclopedia**:
```python
{
    'thread_name': {
        'name': 'tts_worker',
        'thread_id': 12345,
        'task_types': ['tts', 'audio'],
        'status': 'running',
        'started_at': 1234567890.0,
        'last_heartbeat': 1234567890.5,
        'uptime': 600.0,
        'heartbeat_age': 0.5,
        'alive': True,
        'metadata': {'max_queue_size': 10, 'description': 'TTS worker'}
    }
}
```

**Benefits**:
- ✅ Cross-module accessibility without importing pyheartbeat
- ✅ Real-time state synchronization
- ✅ No circular dependencies
- ✅ Monitoring and debugging from anywhere

## 4. Subsystem Integration Guide

### 4.1 How to Integrate a Subsystem

**Step 1: Create Task Processing Queue**
```python
# In your subsystem (e.g., pycore/pyutils/edge_tts/__init__.py)

import queue
import threading

# Internal task queue
tts_task_queue = queue.Queue(maxsize=10)
```

**Step 2: Create Worker Thread**
```python
class TTSWorkerThread(threading.Thread):
    def __init__(self):
        super().__init__(name='tts_worker', daemon=True)

    def run(self):
        # Register with thread pool
        from pycore.pyheartbeat import get_global_thread_pool

        thread_pool = get_global_thread_pool()
        thread_pool.register_thread(
            name=self.name,
            instance=self,
            task_handlers={
                'tts': self.accept_tts_task,      # Handler for 'tts' tasks
                'audio': self.accept_audio_task   # Handler for 'audio' tasks
            },
            metadata={'max_queue_size': 10, 'description': 'TTS worker thread'}
        )

        # Main processing loop
        while True:
            try:
                task = tts_task_queue.get(timeout=1.0)
                self._process_task(task)
                thread_pool.update_heartbeat(self.name)
            except queue.Empty:
                thread_pool.update_heartbeat(self.name)
                continue

    def accept_tts_task(self, task: Task) -> bool:
        """
        Handler for 'tts' task type - called by HeartbeatPusher

        Returns:
            True if task accepted, False if busy/cannot accept
        """
        try:
            if tts_task_queue.qsize() < 10:
                tts_task_queue.put(task, block=False)
                task.mark_running()
                return True
            return False  # Queue full, cannot accept
        except queue.Full:
            return False

    def accept_audio_task(self, task: Task) -> bool:
        """Handler for 'audio' task type"""
        try:
            if tts_task_queue.qsize() < 10:
                tts_task_queue.put(task, block=False)
                task.mark_running()
                return True
            return False
        except queue.Full:
            return False

    def _process_task(self, task: Task):
        """Process TTS/audio task"""
        try:
            text = task.task_data['text']
            voice = task.task_data.get('voice', 'default')

            # Perform TTS synthesis
            result = tts_manager.synthesize(text, voice)

            # Mark task as completed
            task.mark_completed()
            task.metadata['result'] = result

            # Call callback if provided
            if task.callback:
                task.callback(task)

        except Exception as e:
            task.mark_failed(str(e))
            if task.error_callback:
                task.error_callback(task)
```

**Step 3: Start Thread**
```python
# In pycore/pyutils/edge_tts/__init__.py

tts_worker = TTSWorkerThread()
tts_worker.start()
```

**That's it!** The subsystem is now integrated with PyHeartbeat.

### 4.2 Complete Example: RPC Subsystem

```python
# pycore/pyutils/rpc/server/heartbeat_integration.py

import queue
import threading
from pycore.pyfoundations import Task, TaskState, ColorPrint
from pycore.pyheartbeat import get_global_thread_pool

class RPCHeartbeatThread(threading.Thread):
    """RPC subsystem heartbeat integration thread"""

    def __init__(self, rpc_server):
        super().__init__(name='rpc_server', daemon=True)
        self.rpc_server = rpc_server
        self.task_queue = queue.Queue(maxsize=20)

    def run(self):
        """Main thread loop"""
        # Register with global thread pool
        thread_pool = get_global_thread_pool()
        thread_pool.register_thread(
            name=self.name,
            instance=self,
            task_handlers={
                'rpc': self.accept_rpc_task,
                'remote_call': self.accept_rpc_task  # Both types use same handler
            },
            metadata={'rpc_server': self.rpc_server.__class__.__name__, 'max_queue_size': 20}
        )

        ColorPrint.green(f"[RPC] Registered with PyHeartbeat (task_types: rpc, remote_call)")

        # Process tasks
        while True:
            try:
                task = self.task_queue.get(timeout=1.0)
                self._process_rpc_task(task)

                # Update heartbeat
                thread_pool.update_heartbeat(self.name)

            except queue.Empty:
                thread_pool.update_heartbeat(self.name)
                continue

    def accept_rpc_task(self, task: Task) -> bool:
        """Handler for 'rpc' and 'remote_call' task types"""
        if not self.rpc_server.is_running():
            return False

        if self.task_queue.qsize() >= 20:
            return False  # Overloaded

        try:
            self.task_queue.put(task, block=False)
            task.mark_running()
            ColorPrint.blue(f"[RPC] Accepted task {task.task_id}")
            return True
        except queue.Full:
            return False

    def _process_rpc_task(self, task: Task):
        """Process RPC method call"""
        try:
            method = task.task_data['method']
            params = task.task_data.get('params', {})

            # Call RPC method
            result = self.rpc_server.call_method(method, params)

            # Mark completed
            task.mark_completed()
            task.metadata['result'] = result

            if task.callback:
                task.callback(task)

        except Exception as e:
            task.mark_failed(str(e))
            if task.error_callback:
                task.error_callback(task)


# In pycore/pyutils/rpc/server/__init__.py
rpc_heartbeat_thread = RPCHeartbeatThread(unified_server)
rpc_heartbeat_thread.start()
```

## 5. Task Flow Example

### 5.1 Complete Flow: Web Request → TTS → Response

```python
# Step 1: Web server receives request
@app.post('/api/tts')
async def generate_speech(request):
    text = request.json['text']

    # Step 2: Submit task via unified API
    from pycore.pyheartbeat import get_unified_api

    api = get_unified_api()
    task_id = api.addTTSTask(
        text=text,
        voice='en-US',
        priority=TaskPriority.HIGH
    )

    return {'task_id': task_id, 'status': 'queued'}

# Step 3: HeartbeatPusher runs (1 second tick)
# - Gets task from GlobalTaskQueue
# - task.task_type = 'tts'
# - Looks up threads in GlobalThreadPool: task_type_handlers['tts'] -> ['tts_worker']
# - Gets ThreadInfo for 'tts_worker'
# - Calls: tts_worker.accept_task_fn(task)

# Step 4: TTS Worker's accept_task() called
def accept_task(task):
    if tts_task_queue.qsize() < 10:
        tts_task_queue.put(task)
        task.mark_running()
        return True  # Accepted
    return False  # Busy

# Step 5: TTS Worker processes task
def run():
    while True:
        task = tts_task_queue.get()
        result = tts_manager.synthesize(task.task_data['text'])
        task.mark_completed()
        task.metadata['result'] = result
        if task.callback:
            task.callback(task)

# Step 6: Client polls for result
@app.get('/api/tts/{task_id}')
async def get_task_status(task_id):
    api = get_unified_api()
    status = api.getTask(task_id)
    return status
```

## 6. Initialization in pylauncher

### 6.1 Launcher Integration

```python
# pycore/pylauncher/launcher.py

from pycore.pyheartbeat import initialize_heartbeat_system
from pycore.pyfoundations import ColorPrint

def launch_application(app_name: str):
    """Application launcher with PyHeartbeat"""

    # Step 1: Initialize PyHeartbeat system
    ColorPrint.blue("[Launcher] Initializing PyHeartbeat...")
    heartbeat = initialize_heartbeat_system()

    # Step 2: Start heartbeat pusher (1s tick)
    ColorPrint.blue("[Launcher] Starting heartbeat pusher...")
    heartbeat.start()

    # Step 3: Launch application
    # Subsystems will auto-register their threads as they start

    ColorPrint.green(f"[Launcher] Launching application: {app_name}")

    # Application logic...

    # Step 4: Shutdown
    try:
        # Main loop
        pass
    except KeyboardInterrupt:
        ColorPrint.yellow("[Launcher] Shutting down...")
        heartbeat.stop()
```

## 7. Configuration

```python
# pycore/pyheartbeat/config.py

HEARTBEAT_CONFIG = {
    # Heartbeat pusher
    'tick_interval': 1.0,           # 1 second heartbeat

    # Thread pool
    'heartbeat_timeout': 30.0,      # Thread heartbeat timeout
    'health_check_interval': 5.0,   # Health check interval

    # Task queue
    'max_queue_size': 10000,        # Maximum task queue size
    'task_timeout': 300,            # Task timeout (seconds)

    # Cleanup
    'cleanup_interval': 300,        # Cleanup completed tasks
    'max_completed_tasks': 1000,    # Max completed tasks to keep
}
```

## 8. Monitoring and Statistics

### 8.1 Via Unified API

```python
from pycore.pyheartbeat import get_unified_api

api = get_unified_api()
stats = api.getStats()

# Output:
{
    'heartbeat_pusher': {
        'running': True,
        'uptime': 3600.0,
        'total_ticks': 3600,
        'tasks_pushed': 1250,
        'tasks_requeued': 45
    },
    'thread_pool': {
        'total_threads': 4,
        'threads': {
            'tts_worker': {
                'status': 'running',
                'task_types': ['tts', 'audio'],
                'heartbeat_age': 0.5,
                'uptime': 3600.0,
                'alive': True
            },
            'rpc_server': {
                'status': 'running',
                'task_types': ['rpc', 'remote_call'],
                'heartbeat_age': 0.3,
                'uptime': 3600.0,
                'alive': True
            }
        },
        'task_type_handlers': {
            'tts': ['tts_worker'],
            'rpc': ['rpc_server'],
            'ui': ['ui_main']
        }
    },
    'task_queue': {
        'size': 5,
        'pending': 3,
        'running': 2,
        'completed': 1245
    }
}
```

### 8.2 Via Encyclopedia (Global Access)

```python
# From ANY module, without importing pyheartbeat
from pycore.pyfoundations import ENCYCLOPEDIA

# Get thread pool data
threads_data = ENCYCLOPEDIA.get('heartbeat.thread_pool.threads')

# Example: Check if TTS worker is alive
if threads_data and 'tts_worker' in threads_data:
    tts_info = threads_data['tts_worker']
    if tts_info['alive'] and tts_info['status'] == 'running':
        print(f"TTS worker healthy, heartbeat age: {tts_info['heartbeat_age']:.2f}s")
    else:
        print(f"TTS worker unhealthy: {tts_info['status']}")

# Get task type handlers mapping
handlers = ENCYCLOPEDIA.get('heartbeat.thread_pool.task_type_handlers')

# Example: Find which thread handles 'tts' tasks
if handlers and 'tts' in handlers:
    tts_handlers = handlers['tts']
    print(f"TTS tasks handled by: {', '.join(tts_handlers)}")

# Helper function
from pycore.pyheartbeat import get_thread_pool_from_encyclopedia

pool_data = get_thread_pool_from_encyclopedia()
if pool_data:
    print(f"Total threads: {len(pool_data['threads'])}")
    print(f"Task types: {list(pool_data['task_type_handlers'].keys())}")
```

### 8.3 Health Checks

```python
from pycore.pyheartbeat import get_global_thread_pool

thread_pool = get_global_thread_pool()

# Check thread health (30s heartbeat timeout)
health = thread_pool.check_health(heartbeat_timeout=30.0)

print(f"Healthy threads: {health['healthy']}")
print(f"Unhealthy threads: {health['unhealthy']}")

# Get detailed stats
stats = thread_pool.get_stats()
print(f"Total threads: {stats['total_threads']}")
print(f"Status counts: {stats['status_counts']}")
```

## 9. Key Differences from Previous Design

### 9.1 Removed Components
- ❌ SubsystemAdapter (no longer needed)
- ❌ SubsystemRegistry (functionality moved to ThreadPool)
- ❌ TaskDispatcher (functionality in HeartbeatPusher)
- ❌ GlobalTaskScheduler (duplicate of HeartbeatSystem)
- ❌ Built-in Handlers (no hardcoded TTS/RPC/UI imports)

### 9.2 Simplified Architecture
- ✅ Only 5 core files: thread_pool.py, heartbeat_pusher.py, heartbeat_system.py, unified_api.py, __init__.py
- ✅ No hardcoded external dependencies
- ✅ Thread-centric design: threads register themselves with task_handlers dict
- ✅ State-based acceptance: threads decide if they can accept tasks
- ✅ Clean separation: PyHeartbeat doesn't know about TTS, RPC, UI, etc.
- ✅ Encyclopedia integration: thread pool state globally accessible

### 9.3 New Features
- ✅ Encyclopedia global state storage for thread pool mappings
- ✅ Automatic synchronization on all state changes
- ✅ Cross-module accessibility without circular dependencies
- ✅ `task_handlers` dict structure: `{'task_type': handler_fn}`
- ✅ Helper function `get_thread_pool_from_encyclopedia()` for easy access

## 10. Summary

PyHeartbeat is a minimalist task routing system with global state management:

**Core Components**:
1. **GlobalTaskQueue** (in pyfoundations): Thread-safe priority queue for tasks
2. **GlobalThreadPool**: Thread registry with task_type handler mappings
3. **HeartbeatPusher**: 1-second heartbeat loop for task distribution
4. **UnifiedTaskAPI**: Simple interface for task submission (addTTSTask, hasTask, etc.)
5. **Encyclopedia Integration**: Global state storage for cross-module access

**Key Architecture Principles**:
- ✅ No adapters, no registries, no hardcoded subsystems
- ✅ Threads register with `task_handlers` dict mapping task_type to handler functions
- ✅ Thread pool state automatically synced to Encyclopedia
- ✅ Globally accessible from any module via `ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY)`
- ✅ State-based task acceptance: handlers return True (accept) or False (busy)

**Integration Pattern**:
```python
# 1. Thread registers with task_handlers dict
thread_pool.register_thread(
    name='worker',
    instance=thread,
    task_handlers={'task_type': handler_fn},  # Dict of handlers
    metadata={...}
)

# 2. Handler function processes task offers
def handler_fn(task: Task) -> bool:
    if can_accept:
        queue.put(task)
        task.mark_running()
        return True
    return False  # Busy

# 3. State automatically synced to Encyclopedia
# 4. Accessible globally from any module
```

**Files**:
- `pycore/pyfoundations/task_models.py` - Task, TaskState, TaskPriority
- `pycore/pyfoundations/global_task_queue.py` - GlobalTaskQueue
- `pycore/pyheartbeat/thread_pool.py` - GlobalThreadPool + Encyclopedia sync
- `pycore/pyheartbeat/heartbeat_pusher.py` - HeartbeatPusher (1s tick)
- `pycore/pyheartbeat/heartbeat_system.py` - HeartbeatSystem coordinator
- `pycore/pyheartbeat/unified_api.py` - UnifiedTaskAPI
- `pycore/pyheartbeat/__init__.py` - Exports and public API
