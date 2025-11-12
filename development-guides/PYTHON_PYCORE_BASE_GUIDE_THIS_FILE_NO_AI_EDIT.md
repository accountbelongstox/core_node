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

**Try-Except Block Rules (AI Code Only)**
- **AI-generated code must NOT use try-except blocks**
- Reason: try-except hides errors, makes debugging difficult
- Alternatives: conditional checks, return error status, use ColorPrint, let errors propagate naturally

## 2. pycore Architecture

### 2.1 Component Overview
- `pycore/pyfoundations` - Core foundation, Python stdlib only, no third-party packages
- `pycore/pyutils` - Utility classes, can use third-party packages, exports instances/singletons
- `pycore/pygvar` - Global constants and variables (appname, paths, binary locations)
- `pyapps` - Applications using pycore as base services

### 2.2 Unified Module Structure (Post-Refactoring)

**Migration Summary:**
- ❌ `pyfoundations/device/` → ✅ `pyutils/device/` (device utilities belong in utils)
- ❌ `pyfoundations/gvar/` → ✅ `pygvar/` (merged into unified global vars)
- ❌ `pyutils/adb/` → ✅ `pyutils/device/` (merged with device module)
- ❌ `pygvar/pyglobal_vars.py` → ✅ `pygvar/constants.py` (clearer naming)

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

### 3.3 pygvar Usage
- Central location for all constants and variables
- Import pattern: `from pycore.pygvar import CONSTANT_NAME`
- Exports system constants, global variable manager, and WS RPC constants

## 4. Import Patterns

### 4.1 Foundation Imports
- ColorPrint, ENCYCLOPEDIA, EventBus, THREAD_BUS from `pycore`
- GlobalVarManager, IS_WINDOWS, PROJECT_ROOT from `pycore.pygvar`
- get_secret_key, set_secret_key from `pycore.pyfoundations`

### 4.2 Device & ADB Imports (Unified)
- All device and ADB functionality in `pycore.pyutils.device`
- AndroidDevice, ScrcpyDevice, DeviceInfo, ServerParams, Resolution
- ADBManager, ADBDevice, ADBDeviceState, ADBExecuteResult

### 4.3 Import Rules Summary
- Only add widely used components to `pycore/__init__.py`
- For specialized modules, use direct imports
- Never use relative imports
- All import statements at file top

## 5. Application Development Standards

### 5.1 App Directory Structure
```
pyapps/{appname}/
├── {appname}_main.py       # STANDARD entry point
├── main.py                 # FALLBACK entry point
├── config/                 # App configuration
├── {appname}_config/       # [Optional] UI configuration
├── {appname}_i18n/         # [Optional] Multi-language
├── controller/             # Business logic
├── service/                # [Optional] Service layer
├── routes/                 # [Optional] HTTP routes
├── model/                  # [Optional] Data models
└── scripts/                # Deployment scripts
```

**Directory Naming:** All optional directories use `{appname}_` prefix as namespace

### 5.2 Entry Point Convention
- STANDARD: `{appname}_main.py` - Primary entry point
- FALLBACK: `main.py` - Secondary entry point
- Must define `start()` or `main()` function

### 5.3 Configuration Management
- Config in `config/` directory, export via `__init__.py`
- Absolute imports: `from pyapps.{appname}.config import Config`
- Support environment variables
- No hardcoded paths or credentials

### 5.4 UI Configuration (PySide6/Tkinter)
**Directory:** `{appname}_config/` with namespace prefix
**Purpose:** Centralizes PySide6/Tkinter UI configuration
**Key Functions:** `get_default_window_size()`, `create_ui_config()`

**Native UI Launcher:** Use `NativeUIConfig` + `launch_native_app()` for simplified launch. Auto-handles: ports, i18n, singleton detection, tray, timer. Import from `pycore.pyutils.native_ui`.

### 5.5 Multi-Language (i18n)

**Translation Key Namespace:**
- All keys **MUST** use `{appname}.` prefix
- Format: `{appname}.category.key_name`
- Examples: `matrix.app_name`, `matrix.tray.open_frontend`

**Key Principles:**
- **Singleton Pattern - NO Parameter Passing**
- **NEVER pass i18n_manager as parameter**
- **ALWAYS call `get_i18n_manager()` directly**
- **Initialize Once** at application start
- **No Hardcoded Text** - All UI text must use i18n keys
- **NO Default Values** - Do NOT use `i18n.get(key, default)`
- **Complete Translation** - All languages must have ALL keys

**Language Switching:**
- `i18n.set_language(lang)` - Switch language
- `i18n.add_listener(callback)` - Listen for changes

### 5.6 Directory and Resource Usage
**Static Files:** `public/` folder in project root
**Large Files (>10MB):** APP_LARGE_FILES_CACHE_DIR, APP_LARGE_FILES_TMP_DIR
**Runtime Temporary (<10MB):** APP_RUNTIME_CACHE_DIR, APP_RUNTIME_TMP_DIR

All paths exported from pygvar, auto-created by pycore.

### 5.7 Development Guidelines
- Follow minimal app code principle - main functionality in pyutils
- No requirements.txt in app directory (use project root)
- File operations: Use pyfoundations
- Logging: Use ColorPrint
- Constants: From pygvar

## 6. Multi-Threading Standards

### 6.1 Core Threading Principles
**CRITICAL RULE: All threaded components MUST inherit from threading.Thread directly**
**Naming Convention:** Use descriptive names ending with "Thread"

### 6.2 Thread Architecture
**Main Thread** - Always active, manages all child threads
**Child Threads** - TkinterStartupThread, PySide6MainThread, TickTimerThread

### 6.3 Inter-Thread Communication
**FORBIDDEN:** Direct parameter passing, cross-thread callbacks, shared mutable state
**REQUIRED:** Use THREAD_BUS for thread communication

### 6.4 THREAD_BUS - Global Thread Communication System
Located in: `pycore/pyfoundations/thread_bus.py`

**Key Features:**
- **Signal Operations** - Send/receive signals with timeout support
- **Thread State Management** - Track thread states and lifecycle
- **Message Queue** - Producer-consumer pattern support
- **Event Handlers** - Priority-based event handling

**Core Operations:**
- Signal: `signal()`, `wait_signal()`, `has_signal()`, `clear_signal()`
- Thread State: `set_thread_state()`, `get_thread_state()`, `wait_thread_state()`
- Message Queue: `send_message()`, `receive_message()`, `queue_size()`
- Event Handlers: `register_event_handler()`, `trigger_event()`

### 6.5 ENCYCLOPEDIA vs THREAD_BUS
**ENCYCLOPEDIA:** General key-value cache, application state, configuration
**THREAD_BUS:** Dedicated thread communication, signals, queues, state tracking

### 6.6 Thread Lifecycle Pattern
**Required Implementation:**
1. Inherit from threading.Thread
2. Set daemon status explicitly
3. Signal thread state changes via THREAD_BUS
4. Use _stop_event for graceful shutdown
5. Log lifecycle events with ColorPrint

**Thread States:** 'starting', 'running', 'stopping', 'stopped'

### 6.7 Daemon vs Non-Daemon
**Non-Daemon (default):** Main thread waits for completion (UI, services)
**Daemon:** Dies when main thread exits (background tasks only)

### 6.8 Common Thread Patterns
**Producer-Consumer:** Use `send_message()` and `receive_message(block=True)`
**Event-Driven:** Use `signal()` and `wait_signal()`
**State Synchronization:** Use `set_thread_state()` and `wait_thread_state()`

### 6.9 Forbidden Patterns
**DO NOT USE:** ThreadPoolExecutor, threading.Timer, Queue module, manual locks, thread-local storage, lambda in Thread()

## 7. Quality Standards

### 7.1 Type Hints
Use type hints for function parameters and return values.

### 7.2 Async/Await
Use async/await for I/O-bound operations.

### 7.3 Context Managers
Use context managers for resource management.

### 7.4 Dataclasses
Use dataclasses or Pydantic models for data structures.

## 8. Third-party Packages

### 8.1 Package Selection
- Ensure package supports latest Python or updated within 2 years
- If uncertain, implement with native Python
- Document in root README.md

### 8.2 Dependency Management
- All dependencies in project root requirements.txt
- Optional dependencies documented separately
- Use dependency groups (dev, prod, test)

### 8.3 Auto-install
pycore supports auto-install via DEPENDENCY_MAP in pygvar.

## 9. Web and Database

### 9.1 Web Framework
- Use Flask or FastAPI for HTTP servers
- Routes in app `routes/` directory
- Middleware in app `middleware/` directory

### 9.2 Database
- Prioritize SQLite
- Database utilities in pyutils
- Models in app `model/` directory

## 10. Deployment

### 10.1 Deployment Scripts
All scripts in `scripts/` directory:
- install.ps1 - Dependency installation
- start.ps1 - Application startup
- stop.ps1 - Graceful shutdown
- deploy.ps1 - Deployment automation

## 11. pycore vs ncore Comparison

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

## 12. Quick Reference

### 12.1 Common Imports (Unified)
**Foundation:** ColorPrint, ENCYCLOPEDIA, EventBus, EventTypes, THREAD_BUS
**Global Vars:** GlobalVarManager, IS_WINDOWS, PROJECT_ROOT, CPU_COUNT
**Device & ADB:** AndroidDevice, ScrcpyDevice, DeviceInfo, ADBManager, ADBDevice
**Utilities:** DeviceManager, H264Decoder, GroupController, MediaCompressor

### 12.2 Directory Paths (from pygvar)
APP_NAME, PROJECT_ROOT, CACHE_DIR, TMP_DIR, APP_LARGE_FILES_CACHE_DIR, APP_LARGE_FILES_TMP_DIR, APP_RUNTIME_CACHE_DIR, APP_RUNTIME_TMP_DIR

### 12.3 ColorPrint Methods
**Available:** blue, green, yellow, red, white, gray, debug
**Usage:** For logging only, no console interaction

### 12.4 THREAD_BUS Signal Naming
- Format: `{component}_{event}` (e.g., `tk_window_ready`)
- Use lowercase with underscores
- Be descriptive and specific

## 13. Version Control

### 13.1 Commit Messages
Format: `type(scope): message`
Types: feat, fix, docs, style, refactor, test, chore

### 13.2 .gitignore
Exclude: __pycache__, *.pyc, *.pyo, .env, secrets/, venv/, env/

## 14. Troubleshooting

### 14.1 Common Issues
- **Import errors:** Check absolute imports, __init__.py exports, unified module paths
- **Encoding errors:** Always specify encoding='utf-8'
- **App not detected:** Ensure {appname}_main.py exists with start() function
- **ColorPrint:** Only use blue, green, yellow, red, white, gray, debug
- **Thread deadlocks:** Use THREAD_BUS with timeout
- **Module not found:** Check for old paths (pyfoundations.device, pyutils.adb)

### 14.2 Migration Guide
For detailed migration information, refer to: `pycore/UNIFIED_UTILS_MIGRATION_GUIDE.md`

## 15. Architecture Evolution

### 15.1 Recent Refactoring (2025)
**Unified Module Structure:**
- Merged `pyutils/device` and `pyutils/adb` into single module
- Merged `pyfoundations/gvar` into `pygvar`
- Moved device utilities from `pyfoundations/device` to `pyutils/device`
- Renamed `pygvar/pyglobal_vars.py` to `pygvar/constants.py`

**Benefits:**
- Single import path for device/ADB operations
- Clear separation: foundations (stdlib) vs utilities (third-party)
- Eliminated redundancy and confusion
- Better maintainability

### 15.2 Future Considerations
- Keep foundations minimal (stdlib only)
- Add new utilities to pyutils, not foundations
- Maintain unified module approach
- Document breaking changes in migration guide
