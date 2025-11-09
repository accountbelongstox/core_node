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

## 8. Web and Database

### 8.1 Web Framework
- Use Flask or FastAPI for HTTP servers
- HTTP utilities in pyutils
- Routes in app `routes/` directory
- Middleware in app `middleware/` directory

### 8.2 Database
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

## 10. pycore vs ncore Comparison

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

## 11. Quick Reference

### 11.1 Common Imports
**Foundation**: ColorPrint, ENCYCLOPEDIA, EventBus, GlobalVarManager
**Devices**: AndroidDevice, ScrcpyDevice, DeviceInfo
**Utilities**: DeviceManager, ADBManager, H264Decoder, GroupController
**Utils**: MediaCompressor, WebSocketManager, VideoFrame, TouchEvent

### 11.2 Directory Paths
APP_NAME, CACHE_DIR, TMP_DIR, APP_LARGE_FILES_CACHE_DIR, APP_LARGE_FILES_TMP_DIR, APP_RUNTIME_CACHE_DIR, APP_RUNTIME_TMP_DIR

### 11.3 ColorPrint Methods
**Available methods**: blue, green, yellow, red, white, gray, debug

## 12. Version Control

### 12.1 Commit Messages
Format: `type(scope): message`

Examples:
- `feat(pymatrix): add video streaming`
- `fix(pycore): handle encoding errors`
- `docs(guide): update development guide`

### 12.2 .gitignore
Exclude: __pycache__, *.pyc, *.pyo, .env, secrets/, venv/, env/

## 13. Troubleshooting

### 13.1 Common Issues
- **Import errors**: Use absolute imports, check __init__.py exports
- **Encoding errors**: Always specify encoding='utf-8'
- **App not detected**: Ensure {appname}_main.py exists
- **ColorPrint**: Only use blue, green, yellow, red, white, gray, debug
