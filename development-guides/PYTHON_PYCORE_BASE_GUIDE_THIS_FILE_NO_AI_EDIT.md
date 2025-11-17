# Python pycore Development Guide

## 1. Core Development Standards

### 1.1 Basic Requirements
- All code must be written in English
- Based on Python 3.10+
- Use absolute imports from pycore packages
- Only use ASCII characters in code and output

### 1.2 Architecture Principles
- All constants managed centrally in pygvar
- All logging, file operations, network functionality use pyfoundations/pyutils
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
- **Forbidden**: import statements inside functions
- **Forbidden**: import statements in try-except blocks (direct import, handle ImportError at usage if needed)

**Global Variable Pattern for Singleton Managers**
- Singleton managers (i18n, bus_manager, etc.) should be initialized as **global variables** at module level
- **i18n Pattern**: `from pycore.pyutils.native_ui.step0_i18n import i18n` (i18n is pre-initialized instance exported from step0_i18n module, base translations already loaded)
- **Forbidden**: Storing as instance variable (`self.i18n`) - use global `i18n` directly
- **Extension Pattern**: Use `i18n.extend_translations(app_dir=Path(__file__).parent, app_name="appname")` in app's `start()` function to extend base translations with app-specific translations (auto-detects `{appname}_i18n` or `i18n` directory)

**Try-Except Block Rules (AI Code Only)**
- **AI-generated code must NOT use try-except blocks**
- Reason: try-except hides errors, makes debugging difficult
- Alternatives: conditional checks, return error status, use ColorPrint, let errors propagate naturally

## 2. pycore Architecture

### 2.1 Component Overview
- `pycore/pyfoundations` - Core foundation, Python stdlib only, no third-party packages
- `pycore/pyutils` - Utility classes, can use third-party packages, exports instances/singletons
- `pycore/pyutils` - **Common area for all utils modules**. Shared models, operations, and utilities should be placed here for reuse across different utils modules
- `pycore/pyctl` - Can call pyutils to organize basic multi-functional class libraries
- `pycore/pygvar` - Global constants and variables (appname, paths, binary locations)
- `pyapps` - Applications using pycore as base services

## 3. Module Development Rules

### 3.1 pyfoundations Rules
- Store most basic modules (ColorPrint, Encyclopedia, EventBus, ThreadBus, SecretManager)
- Only use Python standard library, no third-party packages
- Can only import from other pyfoundations modules
- Provides foundational functions and base classes

### 3.2 pyutils Rules
- Can reference pyfoundations and pygvar
- Do not re-implement pyfoundations functionality
- Export instances or singletons, not classes
- Can use third-party packages
- One subdirectory per functionality
- **Common Area**: `pycore/pyutils` is the shared area for all utils modules. Shared models, operations, and utilities should be placed here for reuse across different utils modules

### 3.3 pyctl Rules
- Can call pyutils to organize basic multi-functional class libraries
- Provides higher-level abstractions that combine multiple pyutils modules
- Should focus on organizing and orchestrating pyutils functionality rather than re-implementing it

A

### 3.4 pygvar Usage
- Central location for all constants and variables
- Import pattern: `from pycore.pygvar import CONSTANT_NAME`

## 4. Application Development Standards

### 4.1 App Directory Structure
```
pyapps/{appname}/
├── {appname}_main.py       # STANDARD entry point
├── main.py                 # FALLBACK entry point
├── {appname}_config/       # [Optional] UI configuration App configuration
├── {appname}_i18n/         # [Optional] Multi-language
│   ├── i18n_keys.py       # App-specific i18n key constants (extends I18nKeys)
│   ├── translations_en.json
│   └── translations_zh.json
├── {appname}_bus_keys/     # [Required] BusKeys registration
├── controller/             # Business logic
├── service/                # [Optional] Service layer
├── routes/                 # [Optional] HTTP routes
├── model/                  # [Optional] Data models
└── scripts/                # Deployment scripts
```
**Directory Naming:** All optional directories use `{appname}_` prefix as namespace

### 4.2 Entry Point Convention
- STANDARD: `{appname}_main.py` - Primary entry point
- FALLBACK: `main.py` - Secondary entry point
- Must define `start()` or `main()` function

### 4.3 Multi-Language (i18n)

- **NEVER use hardcoded strings** - always use key constants from `I18nKeys` or app-specific `{AppName}I18nKeys`
- **Singleton Pattern** - `i18n` is pre-initialized as global variable, no parameter passing
- **App Extension** - Call `i18n.extend_translations()` in app's `start()` function
- **NO Default Values** - Do NOT use `i18n.get(key, default)` - use key constants directly

### 4.4 BusKeys Registration
- **REQUIRED** for apps using THREAD_BUS
- Directory: `{appname}_bus_keys/` with `__init__.py` exporting `{AppName}BusKeys` class and `register_bus_keys()` function
- All app-specific keys **MUST** use `{appname}.` prefix
- Call `register_bus_keys()` at the start of `start()` function

## 5. Multi-Threading Standards

### 5.1 Core Threading Principles
- **CRITICAL RULE: All threaded components MUST inherit from threading.Thread directly**
- Use descriptive names ending with "Thread"
- **FORBIDDEN:** Direct parameter passing, cross-thread callbacks, shared mutable state
- **REQUIRED:** Use THREAD_BUS for thread communication

### 5.2 Forbidden Patterns
- **DO NOT USE:** ThreadPoolExecutor, threading.Timer, Queue module, manual locks, thread-local storage, lambda in Thread()

### 5.3 Tkinter Thread Safety
- **CRITICAL RULE: Only access Tkinter objects from the Tkinter thread**
- Use threading.Event for signals, queue.Queue for data
- **FORBIDDEN: root.after() from other threads**
- **FORBIDDEN: lambda in root.after()** - Use dedicated methods instead

## 6. Third-party Packages

### 6.1 Dependency Management
- All third-party packages MUST be registered in `pycore/pyfoundations/third_party.py`:
  - **DEPENDENCY_MAP**: Maps import name to PyPI package name (required packages)
  - **OPTIONAL_PACKAGES**: Optional packages that won't cause import failure if missing (not auto-installed)
  - **WINDOWS_ONLY_PACKAGES**: Windows-specific packages (automatically skipped on Linux/Mac)
  - **SYSTEM_PACKAGES**: System packages for Linux/Debian/Ubuntu (installed via apt-get, not pip)
- `third_party.py` automatically checks and installs missing packages on first import:
  - Uses ENCYCLOPEDIA cache (runs once per process)
  - Upgrades pip first if any packages need installation
  - On Linux: checks and installs system packages via apt-get (requires sudo)
  - Windows-only packages are automatically skipped on non-Windows systems
  - Optional packages are NOT auto-installed (must be installed manually if needed)
  - Can be skipped via `PYCORE_SKIP_DEP_CHECK=1` environment variable
- Platform-specific pip flags: On Linux/Mac, uses `--break-system-packages --ignore-installed` for reliable installation

### 6.2 Lazy Loading Pattern (REQUIRED)
- **REQUIRED**: Import getter functions from `pycore.pyfoundations.third_party` (e.g., `get_third_package_torch`)
- **REQUIRED**: Call getter function to obtain package (e.g., `torch = get_third_package_torch()`)
- **Forbidden**: Direct package import (e.g., `import torch` or `from third_party import torch`)
- **Performance**: Reduces import time from ~12s to <1s, packages load only when getter is called
- **Caching**: Each package loads once, cached globally for subsequent calls
- **Naming**: All getters follow pattern `get_third_package_{package_name}` (e.g., `get_third_package_numpy`, `get_third_package_PIL_Image`)

## 7. OCR (Optical Character Recognition) Utilities

### 7.1 OCR Specification
- **Location**: `pycore/pyutils/ocr/`
- **Singleton**: `from pycore.pyutils.ocr import ocr_manager`
- **Engine**: CnOCR
- **Dependency**: `cnocr[ort-cpu]` (auto-installed)
- **Model Types**: general (default), scene, doc, number, english, chinese_traditional
- **Methods**: `recognize_image()`, `recognize_batch()`, `get_available_models()`, `get_engine_info()`
- **Result Format**: Dictionary with success, text, confidence, words (with bbox), provider, processing_time, error
- **Supported Formats**: JPEG, PNG, BMP, TIFF, WebP
- **File Size Limit**: 50MB


## 6. Module Caller Service

### 6.1 Overview
Pycore Module Caller (`pycore.callmodule`) is a FastAPI service providing HTTP API access to pycore modules. Service port: 59000 (default). See `/www/programing/core_node/pycore/callmodule/README.md` for detailed documentation.

### 6.2 Entry Points
- Primary: `python3 -m pycore.callmodule`
- Standalone: `/www/programing/core_node/run_callmodule_service.py`
- Systemd: `systemctl start pycore-module-caller`

### 6.3 Unified Utils Export
All pyutils utilities are exported from `pycore.pyutils` with `*_AVAILABLE` flags. Import pattern: `from pycore.pyutils import ocr_manager, OCR_AVAILABLE`. Use `get_available_utilities()` to check all available utilities. GUI components require `PYUTILS_LOAD_GUI=1` environment variable.

## 8. Database System

### 8.1 Database Specification
- **Location**: `pycore/database/` (independent module, NOT in pyutils)
- **Models Location**: `pycore/database/models/` (NOT `pycore/database_models/` - models are inside database module)
- **Dependencies**: Only `pygvar`, `pyfoundations`, `sqlalchemy`
- **Import**: `from pycore.database import database_manager, BaseModel, DATABASE_AVAILABLE`
- **Models Import**: `from pycore.database.models import TableKeys, TableNamespaces, {ModelName}`

### 8.2 Table Naming Rules
- **Namespace Format**: `common`, `app_{name}`, `util_{name}`
- **Table Key Format**: `{namespace}.{table_name}` (e.g., `common.config`, `app_myapp.users`)
- **FORBIDDEN**: Hardcoded table name strings - ALL table names MUST be defined in `TableKeys` class
- **Model Creation**: Add namespace to `TableNamespaces`, add table key to `TableKeys`, create model in `pycore/database/models/{namespace}/`

### 8.3 Usage Pattern
- **Register**: `database_manager.register_database("dbname")`
- **Load**: `database_manager.load_tables([TableKeys.YOUR_TABLE], [YourModel], "dbname")`
- **Access**: `with database_manager.get_connection("dbname") as conn: table = database_manager.get_table(TableKeys.YOUR_TABLE)`
- **Transaction**: `with database_manager.transaction("dbname") as conn: # auto-commit/rollback`
- **Base CRUD**: `insert()`, `select()`, `update()`, `delete()`, `count()` - Add custom methods in model class
- **Storage**: Uses `map_web_path("www", "pycore_db")` - Windows: `D:/www/pycore_db/`, Linux: `/www/pycore_db/`

## 9. Global Heartbeat System

### 9.1 Architecture Overview
- **Location**: `pycore/pyfoundations/heartbeat/`
- **Thread Type**: Direct Thread inheritance (NOT using thread to start another thread)
- **Synchronization**: NO thread locks - uses atomic operations and state machines
- **Registration**: HARD-CODED in `pycore/pyfoundations/heartbeat/registry.py`
- **Pattern**: Model-Handler with state machine (IDLE, PROCESSING, ERROR, DISABLED)

### 9.2 Core Design Principles

**Thread Design:**
- HeartbeatThread directly inherits from `threading.Thread`
- NO thread locks - relies on Python GIL for atomic operations
- State machine controls handler synchronization (IDLE → PROCESSING → IDLE)
- Base tick interval: 1 second

**Registration Pattern:**
- ALL registrations are HARD-CODED in `registry.py`
- NO dynamic discovery or runtime registration
- Each library implements: `TaskModel` (data source) + `TaskHandler` (processor)
- Handler states: `IDLE`, `PROCESSING`, `ERROR`, `DISABLED`

### 9.3 Implementation Requirements

**TaskModel (Data Source):**
```python
class MyTaskModel(TaskModel):
    def get_name(self) -> str:
        return "task_name"  # Unique identifier

    def has_pending_data(self) -> bool:
        return True  # Check if data available

    def get_pending_data(self) -> Any:
        return self._data  # Return data to process

    def get_handler_class(self) -> str:
        return "pycore.mylib.heartbeat.MyTaskHandler"  # Handler path

    def get_interval(self) -> int:
        return 5  # Check every 5 seconds

    def get_priority(self) -> int:
        return 100  # Lower = higher priority
```

**TaskHandler (Processor):**
```python
class MyTaskHandler(TaskHandler):
    def __init__(self):
        super().__init__()
        # self._state is HandlerState.IDLE by default

    def process(self, data: Any) -> bool:
        # Process data (state auto-managed by heartbeat)
        # Return True on success, False on failure
        return True

    def on_error(self, error: Exception):
        # Handle errors (optional)
        pass
```

### 9.4 Registration Rules (HARD-CODED)

**Registry File:** `pycore/pyfoundations/heartbeat/registry.py`

```python
HEARTBEAT_REGISTRY = {
    # Format: 'namespace.task_name' -> (model_path, handler_path)
    'rpc.ack_check': (
        'pycore.pyutils.rpc.heartbeat.RpcAckCheckModel',
        'pycore.pyutils.rpc.heartbeat.RpcAckCheckHandler'
    ),
    'tts.cache_cleanup': (
        'pycore.pyutils.tts_cache.heartbeat.TTSCacheCleanupModel',
        'pycore.pyutils.tts_cache.heartbeat.TTSCacheCleanupHandler'
    ),
    'ui.thread_bus_check': (
        'pycore.pyutils.native_ui.heartbeat.UIThreadBusModel',
        'pycore.pyutils.native_ui.heartbeat.UIThreadBusHandler'
    ),
}
```

**Adding New Task:**
1. Create `TaskModel` in your library (e.g., `pycore/pyutils/mylib/heartbeat.py`)
2. Create `TaskHandler` in your library
3. Add entry to `HEARTBEAT_REGISTRY` in `registry.py` (HARD-CODED)
4. Handler automatically loaded on heartbeat start

### 9.5 Handler State Machine

```
IDLE → PROCESSING → IDLE (success)
                  ↘
                   ERROR → IDLE (after error handling)

DISABLED (never processed)
```

**State Transitions:**
- `IDLE`: Ready to process data
- `PROCESSING`: Currently processing (skipped by heartbeat)
- `ERROR`: Error occurred (auto-resets to IDLE)
- `DISABLED`: Manually disabled (never processed)

**NO LOCKS:**
- State is atomic Python assignment (`handler._state = HandlerState.PROCESSING`)
- GIL ensures atomicity for single assignments
- No mutex, semaphore, or condition variables

### 9.6 Usage in pylauncher

```python
from pycore.pyfoundations.heartbeat import get_heartbeat_thread, load_all_handlers

def start_application():
    # Load all handlers from HARD-CODED registry
    load_all_handlers()

    # Start heartbeat thread
    heartbeat = get_heartbeat_thread()
    heartbeat.start()  # Direct Thread.start()

    # Application logic...

    # Stop on shutdown (optional - daemon thread)
    heartbeat.stop()
```

### 9.7 Best Practices

**REQUIRED:**
- Models in library's `heartbeat.py` or `heartbeat/` directory
- Hard-code ALL registrations in `registry.py`
- Keep `process()` fast (< 100ms)
- Use state machine, NOT locks

**FORBIDDEN:**
- Thread locks (mutex, semaphore, Lock, RLock)
- Dynamic/runtime registration
- `await`/async in handlers (thread-based, not asyncio)
- Starting multiple heartbeat threads

**Handler Implementation:**
- Return `True` on success, `False` on failure
- State auto-managed by heartbeat (don't set manually)
- Use `on_error()` for error logging (optional)
- Check `has_pending_data()` to avoid unnecessary processing

### 9.8 Statistics and Monitoring

```python
heartbeat = get_heartbeat_thread()
status = heartbeat.get_status()
# {
#   'running': True,
#   'total_ticks': 3600,
#   'uptime': 3600.0,
#   'model_count': 5,
#   'handlers': {
#     'rpc.ack_check': {
#       'state': 'idle',
#       'run_count': 720,
#       'error_count': 0,
#       'last_run': 1234567890.0,
#       ...
#     }
#   }
# }
```

### 9.9 Namespace Convention

- `system.*` - Built-in system tasks
- `rpc.*` - RPC server tasks
- `tts.*` - Text-to-Speech tasks
- `ui.*` - Native UI tasks
- `app_{name}.*` - Application-specific tasks
- `util_{name}.*` - Utility module tasks
