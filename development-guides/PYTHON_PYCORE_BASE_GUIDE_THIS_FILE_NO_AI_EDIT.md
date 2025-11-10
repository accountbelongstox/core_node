# Python pycore Development Guide

## 1. Core Development Standards

### 1.1 Basic Requirements
- All code must be written in English
- Based on Python 3.10+
- Use absolute imports from pycore packages
- Only use ASCII characters in code and output

### 1.2 Architecture Principles
- All constants managed centrally in pygvar
- All logging, file operations, network functionality, subprocess execution use pyfoundations/pyutils
- Avoid relative imports, use absolute paths
- Preserve backward compatibility in pycore modifications

### 1.3 File Management
- Static files: place in root `public` folder
- Cache/tmp folders: use directories from pygvar (CACHE_DIR, TMP_DIR)
- Use ColorPrint for error output instead of raise Exception

### 1.4 Critical Code Standards

**Import Statement Rules**
- All import statements **must be at file top**
- Order: stdlib → third-party → project internal
- Example:
  ```python
  # ✅ Correct - all imports at top
  import os
  import sys
  from pathlib import Path

  import numpy as np
  from PIL import Image

  from pycore import ColorPrint
  from pycore.pyutils import DeviceManager

  def my_function():
      pass

  # ❌ Wrong - import inside function
  def my_function():
      import inspect  # Forbidden
  ```

**Try-Except Block Rules (AI Code Only)**
- **AI-generated code must NOT use try-except blocks**
- Reason: try-except hides errors, makes debugging difficult
- Alternative solutions:
  - Use conditional checks instead of exception catching
  - Return error status instead of raising exceptions
  - Use ColorPrint for error output
  - Let errors propagate naturally for easier root cause identification
- Example:
  ```python
  # ❌ Forbidden in AI code
  try:
      result = risky_operation()
  except Exception as e:
      ColorPrint.red(f"Error: {e}")
      return None

  # ✅ Recommended approach
  if not is_valid_input(data):
      ColorPrint.red("Invalid input data")
      return None

  result = risky_operation()  # Let errors surface naturally
  ```

## 2. pycore Architecture

### 2.1 Component Overview
- `pycore/pyfoundations` - Core foundation, Python stdlib only, no third-party packages
- `pycore/pyutils` - Utility classes, can use third-party packages, exports instances/singletons
- `pycore/pygvar` - Global constants and variables (appname, paths, binary locations)
- `pyapps` - Applications using pycore as base services

### 2.2 Directory Structure
```
pycore/
├── pyfoundations/          # Core foundation
│   ├── color_print.py      # Colored console output
│   ├── encyclopedia.py     # Global key-value cache
│   ├── event_bus.py        # Event pub/sub system
│   ├── secret_manager.py   # AES-256 secret management
│   ├── file_lock_manager.py
│   ├── split_file_store.py
│   ├── app_launcher.py     # Application launcher
│   ├── gvar/               # Global variable management
│   └── device/             # Device abstractions
├── pygvar/                 # Global variables
├── pyutils/                # Utility modules
│   ├── adb/                # ADB device communication
│   ├── control/            # Input/control events
│   ├── group/              # Device group management
│   ├── stream/             # Video stream processing
│   ├── launcher/           # Application launching
│   ├── web/                # Web and GUI
│   ├── wsrpc/              # WebSocket RPC
│   ├── pybrowser/          # Browser automation
│   ├── native_ui/          # Native UI framework
│   └── [25+ modules]       # Various utilities
├── pyadb/                  # ADB communication layer
└── pydevice/               # Device abstraction
```

## 3. Module Development Rules

### 3.1 pyfoundations Rules
- Store most basic modules (ColorPrint, Encyclopedia, EventBus, SecretManager)
- Only use Python standard library, no third-party packages
- Can only import from other pyfoundations modules
- Provides foundational functions, not classes

### 3.2 pyutils Rules
- Can reference pyfoundations and pygvar
- Do not re-implement pyfoundations functionality
- Export instances or singletons, not classes
- Can use third-party packages
- One subdirectory per functionality

### 3.3 pygvar Usage
- Central location for all constants and variables
- Import pattern: `from pycore.pygvar import CONSTANT_NAME`

## 4. Import Patterns

### 4.1 pycore/__init__.py
Only add widely used components to __init__.py. For others, use direct imports.

### 4.2 Foundation Imports
```python
from pycore import ColorPrint, ENCYCLOPEDIA, EventBus, GlobalVarManager
from pycore.pyfoundations import get_secret_key, set_secret_key
from pycore.pyfoundations.device import AndroidDevice, ScrcpyDevice
```

### 4.3 Utility Imports
```python
from pycore import DeviceManager, ADBManager, H264Decoder
from pycore.pyutils import MediaCompressor, WebSocketManager
from pycore.pyutils.stream import VideoFrame, VideoFormat
```

## 5. Application Development Standards

### 5.1 App Directory Structure
``` 
pyapps/
└── {appname}/
    ├── {appname}_main.py   # STANDARD entry point
    ├── main.py             # FALLBACK entry point (optional)
    ├── config/             # App-specific configuration
    │   └── __init__.py
    ├── controller/         # Business logic controllers
    ├── service/            # [Optional] Service layer
    ├── routes/             # [Optional] HTTP routes
    ├── model/              # [Optional] Data models
    ├── middleware/         # [Optional] Framework middleware
    └── scripts/            # Deployment scripts
        ├── install.ps1
        ├── start.ps1
        ├── stop.ps1
        └── deploy.ps1
```

### 5.2 Entry Point Convention
- STANDARD: `{appname}_main.py` - Primary entry point
- FALLBACK: `main.py` - Secondary entry point
- Must define `start()` or `main()` function
- Launcher checks {appname}_main.py first, then main.py

### 5.3 App Launch Methods
```bash
python pymain.py app={appname}                    # Using launcher
python -m pyapps.{appname}.{appname}_main         # Direct module
python pymain.py app=keyword                      # Fuzzy matching
```

### 5.4 Development Process
- Pre-development: Scan pycore to evaluate requirements
- Output analysis to `pyapps/{appname}/development_analysis.md`
- Determine app vs pyutils code distribution
- Archive prompts in app directory for incremental development

### 5.5 Configuration
- Config in `config/` directory, export via `__init__.py`
- Absolute imports: `from pyapps.{appname}.config import Config`
- Support environment variables

### 5.6 Directory and Resource Usage
**Static Files**
- Use `public/` folder in project root

**Large Files (>10MB)**
- APP_LARGE_FILES_CACHE_DIR - Long-term storage
- APP_LARGE_FILES_TMP_DIR - Temporary large files

**Runtime Temporary (<10MB)**
- APP_RUNTIME_CACHE_DIR - Runtime cache
- APP_RUNTIME_TMP_DIR - Runtime temporary files

All paths exported from pygvar, auto-created by pycore.

### 5.7 Development Guidelines
- Follow minimal app code principle - main functionality in pyutils
- No requirements.txt in app directory (use project root)
- No Dockerfile in app directory
- Avoid secondary encapsulation of pycore
- File operations: Use pyfoundations
- Logging: Use ColorPrint
- Constants: From pygvar

## 6. Third-party Package Guidelines

### 6.1 Package Selection
- Ensure package supports latest Python or updated within 2 years
- If uncertain, implement with native Python
- Document in root README.md with pip install command

### 6.2 Dependency Management
- All dependencies in project root requirements.txt
- Optional dependencies documented separately
- Use dependency groups (dev, prod, test)

### 6.3 Auto-install
pycore supports auto-install via DEPENDENCY_MAP in pygvar.

## 7. Quality Standards

### 7.1 Type Hints
Use type hints for function parameters and return values.

### 7.2 Async/Await
Use async/await for I/O-bound operations.

### 7.3 Context Managers
Use context managers for resource management.

### 7.4 Dataclasses
Use dataclasses or Pydantic models for data structures.

## 8. Multi-Threading Standards

### 8.1 Core Threading Principles

**CRITICAL RULE: All threaded components MUST inherit from threading.Thread directly**

```python
# ✅ CORRECT - Direct Thread inheritance
class MyWorkerThread(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = False  # Explicitly set daemon status

    def run(self):
        # Thread logic here
        pass

# Usage
worker = MyWorkerThread()
worker.start()

# ❌ FORBIDDEN - Using Thread to wrap function
def worker_function():
    pass

thread = threading.Thread(target=worker_function)  # DO NOT DO THIS
thread.start()
```

### 8.2 Thread Architecture

**Main Thread** - Always active, manages all child threads
- Never blocks on child threads
- Coordinates thread lifecycle
- Monitors global queue

**Child Threads** - Inherit from Thread
- TkinterStartupThread - Startup window UI
- PySide6MainThread - Main application UI
- TickTimerThread - Periodic tasks
- Custom worker threads

### 8.3 Inter-Thread Communication

**FORBIDDEN: Direct parameter passing between threads**

```python
# ❌ FORBIDDEN - Passing parameters between threads
def thread_a():
    result = do_work()
    thread_b_callback(result)  # Cross-thread call - FORBIDDEN

# ❌ FORBIDDEN - Shared mutable state
shared_data = {"status": "idle"}
def thread_a():
    shared_data["status"] = "working"  # Race condition risk
```

**REQUIRED: Use global queue or signals**

```python
# ✅ CORRECT - Use ENCYCLOPEDIA global queue
from pycore import ENCYCLOPEDIA

class WorkerThread(threading.Thread):
    def run(self):
        result = do_work()
        # Write to global queue
        ENCYCLOPEDIA.add('worker_result', result)
        # Send signal
        ENCYCLOPEDIA.add('worker_complete_signal', True)

# Main thread reads from queue
result = ENCYCLOPEDIA.get('worker_result')
```

### 8.4 Global Queue System

**ENCYCLOPEDIA Thread-Safe Queue**

Located in: `pycore/pyfoundations/encyclopedia.py`

```python
from pycore import ENCYCLOPEDIA

# Thread-safe operations
ENCYCLOPEDIA.add('key', value)           # Write
value = ENCYCLOPEDIA.get('key')          # Read
value = ENCYCLOPEDIA.get('key', default) # Read with default
ENCYCLOPEDIA.remove('key')               # Delete
```

**Signal Queue Pattern**

```python
# Thread A - Producer
ENCYCLOPEDIA.add('task_queue', {
    'action': 'process_data',
    'data': {'id': 123}
})

# Thread B - Consumer
task = ENCYCLOPEDIA.get('task_queue')
if task:
    process(task['data'])
    ENCYCLOPEDIA.add('task_complete', True)
```

### 8.5 Thread Lifecycle Management

**Startup Pattern**

```python
class MyThread(threading.Thread):
    def __init__(self):
        super().__init__()
        self.daemon = False  # Non-daemon - main waits for completion
        self._stop_event = threading.Event()

    def run(self):
        # Signal ready
        ENCYCLOPEDIA.add('mythread_ready', True)

        while not self._stop_event.is_set():
            # Thread work
            pass

        # Signal stopped
        ENCYCLOPEDIA.add('mythread_stopped', True)

    def stop(self):
        self._stop_event.set()
```

**Main Thread Coordination**

```python
def main():
    # Start all threads
    thread_a = ThreadA()
    thread_b = ThreadB()

    thread_a.start()
    thread_b.start()

    # Wait for initialization via queue
    while not ENCYCLOPEDIA.get('thread_a_ready'):
        time.sleep(0.1)

    while not ENCYCLOPEDIA.get('thread_b_ready'):
        time.sleep(0.1)

    # Main thread continues, manages threads
    # Does NOT block on thread.join() unless shutting down
```

### 8.6 Thread Naming Convention

```python
class TkinterStartupThread(threading.Thread):  # ✅ Descriptive name
    pass

class PySide6MainThread(threading.Thread):     # ✅ Indicates purpose
    pass

class TickTimerThread(threading.Thread):       # ✅ Clear function
    pass
```

### 8.7 Daemon vs Non-Daemon

**Non-Daemon (default)** - Main thread waits for completion
```python
thread.daemon = False  # Program waits for this thread
```

**Daemon** - Dies when main thread exits
```python
thread.daemon = True   # For background tasks only
```

### 8.8 Thread Debugging

**Required Logging**

```python
class MyThread(threading.Thread):
    def run(self):
        ColorPrint.blue(f"[{self.__class__.__name__}] Thread starting")

        try:
            # Work here
            pass
        finally:
            ColorPrint.blue(f"[{self.__class__.__name__}] Thread stopping")
```

**Thread State Tracking**

```python
# Write state to ENCYCLOPEDIA
ENCYCLOPEDIA.add('mythread_state', {
    'status': 'running',
    'started_at': time.time(),
    'pid': os.getpid(),
    'thread_id': threading.get_ident()
})
```

### 8.9 Common Patterns

**Producer-Consumer**

```python
# Producer thread
class ProducerThread(threading.Thread):
    def run(self):
        while True:
            item = produce_item()
            queue = ENCYCLOPEDIA.get('work_queue', [])
            queue.append(item)
            ENCYCLOPEDIA.add('work_queue', queue)

# Consumer thread
class ConsumerThread(threading.Thread):
    def run(self):
        while True:
            queue = ENCYCLOPEDIA.get('work_queue', [])
            if queue:
                item = queue.pop(0)
                ENCYCLOPEDIA.add('work_queue', queue)
                process(item)
```

**Event-Driven**

```python
# Sender
ENCYCLOPEDIA.add('event_name', {
    'timestamp': time.time(),
    'data': {'key': 'value'}
})

# Receiver
def check_events():
    event = ENCYCLOPEDIA.get('event_name')
    if event:
        handle_event(event)
        ENCYCLOPEDIA.remove('event_name')
```

### 8.10 Anti-Patterns to Avoid

```python
# ❌ FORBIDDEN - Thread pool
executor = ThreadPoolExecutor()  # Use Thread subclasses instead

# ❌ FORBIDDEN - threading.Timer
timer = threading.Timer(5.0, callback)  # Use Thread subclass with Event

# ❌ FORBIDDEN - Queue module
from queue import Queue  # Use ENCYCLOPEDIA instead
q = Queue()

# ❌ FORBIDDEN - Locks/Semaphores
lock = threading.Lock()  # ENCYCLOPEDIA is already thread-safe

# ❌ FORBIDDEN - Thread-local storage
thread_local = threading.local()  # Use ENCYCLOPEDIA instead
```

## 9. Web and Database

### 9.1 Web Framework
- Use Flask or FastAPI for HTTP servers
- HTTP utilities in pyutils
- Routes in app `routes/` directory
- Middleware in app `middleware/` directory

### 9.2 Database
- Prioritize SQLite
- Database utilities in pyutils
- Models in app `model/` directory (only if using database)

## 9. Deployment

### 9.1 Deployment Scripts
All scripts in `scripts/` directory:
- install.ps1 - Dependency installation
- start.ps1 - Application startup
- stop.ps1 - Graceful shutdown
- deploy.ps1 - Deployment automation

## 14. pycore vs ncore Comparison

| Feature | Node.js (ncore) | Python (pycore) |
|---------|-----------------|-----------------|
| Foundation | ncore/foundation | pycore/pyfoundations |
| Utilities | ncore/utils | pycore/pyutils |
| Global Vars | ncore/global_vars | pycore/pygvar |
| Apps | apps/ | pyapps/ |
| Entry Point | main.js app=xxx | {appname}_main.py |
| Import Style | ES6 import/require | Absolute imports |
| Config | gconfig.js | config/__init__.py |
| Logging | logger.js | ColorPrint |
| Constants | global_vars/index.js | pygvar/__init__.py |

## 14. Quick Reference

### 14.1 Common Imports
**Foundation**: ColorPrint, ENCYCLOPEDIA, EventBus, GlobalVarManager
**Devices**: AndroidDevice, ScrcpyDevice, DeviceInfo
**Utilities**: DeviceManager, ADBManager, H264Decoder, GroupController
**Utils**: MediaCompressor, WebSocketManager, VideoFrame, TouchEvent

### 14.2 Directory Paths
APP_NAME, CACHE_DIR, TMP_DIR, APP_LARGE_FILES_CACHE_DIR, APP_LARGE_FILES_TMP_DIR, APP_RUNTIME_CACHE_DIR, APP_RUNTIME_TMP_DIR

### 14.3 ColorPrint Methods
**Available methods**: blue, green, yellow, red, white, gray, debug

## 14. Version Control

### 14.1 Commit Messages
Format: `type(scope): message`

Examples:
- `feat(pymatrix): add video streaming`
- `fix(pycore): handle encoding errors`
- `docs(guide): update development guide`

### 14.2 .gitignore
Exclude: __pycache__, *.pyc, *.pyo, .env, secrets/, venv/, env/

## 14. Troubleshooting

### 14.1 Common Issues
- **Import errors**: Use absolute imports, check __init__.py exports
- **Encoding errors**: Always specify encoding='utf-8'
- **App not detected**: Ensure {appname}_main.py exists
- **ColorPrint**: Only use blue, green, yellow, red, white, gray, debug
