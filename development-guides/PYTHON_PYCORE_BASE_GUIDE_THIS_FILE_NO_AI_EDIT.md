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
- All third-party packages MUST be registered in `pycore/pyfoundations/third_party.py` `DEPENDENCY_MAP` (maps import name to PyPI package name)
- Windows-only packages go in `WINDOWS_ONLY_PACKAGES` dict in `third_party.py`
- **REQUIRED**: All third-party packages MUST be imported from `pycore.pyfoundations.third_party`
- **Forbidden**: Direct import of third-party packages (e.g., `import aiohttp` is forbidden, use `from pycore.pyfoundations.third_party import aiohttp`)
- `third_party.py` automatically checks and installs missing packages on first import, uses ENCYCLOPEDIA cache (runs once per process), can be skipped via `PYCORE_SKIP_DEP_CHECK=1`

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
