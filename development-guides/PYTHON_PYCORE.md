# Python pycore Project Specification

This document is the **project specification** for `pycore`. It defines language rules, architecture, and module boundaries. For pycore code, this specification takes precedence. Format follows common style-guide practice: **REQUIRED** / **FORBIDDEN** / **Rule** with explicit decisions.

---

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
- All import statements **must be at file top** — never inside functions, methods, or handlers
- Order: stdlib → third-party → project internal
- **Forbidden**: import statements inside functions
- **Forbidden**: lazy/deferred imports of pycore-internal modules (`pycore.*`): always a direct
  top-of-file import, never wrapped in try-except — a missing internal module is a bug that must
  fail loudly at import time, not be silenced into a `None` fallback
- **Only sanctioned exception** (still at file top, never in a function): optional third-party /
  platform / environment-dependent modules that may legitimately be absent (e.g. `win32gui`,
  `pystray`, `PIL`, `tkinter` on headless Linux). Prefer the lazy getters in
  `pyfoundations/third_party.py` (`get_third_package_*`); where no getter exists, use a
  top-of-file `try: import X ... except ImportError:` that sets a module-level `X_AVAILABLE`
  flag, and guard usage sites with that flag

**Global Variable Pattern for Singleton Managers**
- Singleton managers (i18n, bus_manager, etc.) should be initialized as **global variables** at module level
- **i18n Pattern**: `from pycore.pyutils.native_ui.step0_i18n import i18n` (i18n is pre-initialized instance exported from step0_i18n module, base translations already loaded)
- **Forbidden**: Storing as instance variable (`self.i18n`) - use global `i18n` directly
- **Extension Pattern**: MUST call `i18n.extend_translations(app_dir=Path(__file__).parent, app_name="appname")` in `launcher_config.py` builder function BEFORE using `i18n.get()` (auto-detects `{appname}_i18n` or `i18n` directory)

**Try-Except Block Rules (AI Code Only)**
- **AI-generated code must NOT use try-except blocks**
- Reason: try-except hides errors, makes debugging difficult
- Alternatives: conditional checks, return error status, use ColorPrint, let errors propagate naturally

## 2. pycore Architecture

### 2.1 Component Overview
- `pycore/pyfoundations` - Core foundation, Python stdlib only, no third-party packages
- `pycore/pyutils` - Utility classes, can use third-party packages, exports instances/singletons
- `pycore/pyctl` - High-level wrappers that orchestrate `pyutils`/`pyfoundations`
- `pycore/pygvar` - Global constants and variables (appname, paths, binary locations)
- `pyapps` - Applications using pycore as base services

### 2.2 Layering & Import Direction (STRICT)

Dependencies flow in ONE direction only — higher layers import lower layers, never
the reverse:

```
pyapps / callmodule        (apps — may import anything below)
        │
   pyctl                   (high-level wrappers)
        │
   pyutils                 (independent utility packages)
        │
   pyfoundations           (leaf modules — import ONLY pybasecommon + stdlib)
        │
   pyfoundations/pybasecommon + pygvar   (kernel — stdlib only, imports nothing else)
```

- **`pyfoundations`** — base layer. **FORBIDDEN**: importing from ANY other `pycore/*`
  folder (`pyutils`, `pyctl`, `callmodule`, ...). Python stdlib + its own modules only.
  **Internal sub-layering (STRICT):** a `pyfoundations` TOP-LEVEL module may import ONLY
  `pyfoundations/pybasecommon` (+ stdlib) — never another top-level `pyfoundations`
  sibling. The package `__init__.py` facade re-exporting its own submodules is the one
  expected exception (it is the package's public API, not a cross-module dependency).
  When two pyfoundations concerns are coupled, either MERGE them into one module or push
  the shared piece DOWN into `pybasecommon`.
- **`pyfoundations/pybasecommon`** — the kernel. Stdlib-only and self-contained: it
  imports NOTHING outside itself (its internal modules may import each other freely).
  Holds: `color_print` (ColorPrint + the shared callback registry), `commander`
  (Commander — routes live output through `ColorPrint.stream` so it reaches the same
  observers), `safe_subprocess`, `encyclopedia` (process cache), `compute_caps`
  (CUDA/ONNX capability kernel: CUDADetector, ORT/CnOCR package selection,
  is_onnx_cuda_usable / ensure_onnx_cuda_usable, CudaInitializer). Anything a
  `pybasecommon` module needs is implemented INSIDE `pybasecommon`.
- **`pyutils`** — **FORBIDDEN**: importing `pyctl`. May import `pyfoundations` and
  `pygvar`. Intra-package imports (within the SAME `pyutils/<pkg>/`) are fine.
  **Shared-base tier (sanctioned):** the designated shared base inside pyutils is
  **`pyutils/common` ONLY**. (As of 2026-06-15 there are NO loose top-level modules
  under `pyutils/` — every utility lives in a group package; the only root file is
  `__init__.py`. Generic helpers that used to be loose — `robust_downloader`,
  `system_launcher`, `process_manager`, `app_launcher`, `dev_reload`, `port_utils`,
  `zip_task_queue`, `build_config_parser`, `capabilities`, the shortcut/icon engine
  `icon_generator`/`appusermodelid`, the `clipboard_text` primitive, … — now live in
  `pyutils/common`.) Any `pyutils` group package MAY import from `pyutils/common`.
  **FORBIDDEN**: a `pyutils` group package (a subdirectory) importing ANOTHER group
  package (`tts → edge_tts`, `whisper_stt → azure_speech`, `device_sync → launcher`,
  `input → clipboard`, …); and `common` MUST NOT import a group package (no
  `common → edge_tts`). Group code stays in pyutils — do NOT push domain models down
  into the stdlib-only `pyfoundations` base; put genuinely-generic shared helpers in
  `pyutils/common` instead. Cross-group coordination belongs in `pyctl` (the layer
  above), or is wired by dependency injection, never by group→group sideways imports.
- **`pyctl`** — high-level wrappers. MAY import anything lower (`pyfoundations`, `pyutils`,
  `pygvar`). **FORBIDDEN**: being imported BY any lower layer. **FORBIDDEN**: one `pyctl/*`
  module importing a sibling `pyctl/*` module (each wrapper is self-contained).
- **Shared code** belongs in a LOWER layer that all consumers already depend on (push it
  down to `pyfoundations`), NOT achieved by importing sideways between sibling packages.

#### 2.2.1 The single allowed exception — ColorPrint → rpc_v2 (live log streaming)
`pyfoundations.color_print.ColorPrint` MAY reach UP into `pycore.pyutils.rpc_v2`
**only** to stream every printed line to connected WebSocket clients in real time
(so backend output shows live in the UI). It is the ONE sanctioned upward import.
It is kept safe by construction:
- the import is **lazy** and **gated** by a flag the rpc_v2 server flips on at
  startup (`ColorPrint.enable_rpc_streaming()`), so nothing is imported until rpc_v2
  is already up — no heavy/early import, no cycle;
- it routes through `pycore/pyutils/rpc_v2/log_broadcast.py`, a **leaf module that
  imports nothing from pycore**, so the cycle cannot close;
- it is fully **guarded**: ColorPrint NEVER raises if no server / no event loop / no
  WebSocket client exists — printing always works.

Because ColorPrint auto-streams, **all backend code SHOULD print via ColorPrint**
(not bare `print()`) so output reaches the UI live.

## 3. Module Development Rules

### 3.1 pyfoundations Rules
- **Kernel** lives in `pyfoundations/pybasecommon` (stdlib-only, imports nothing else):
  `ColorPrint`, `Commander`, `safe_subprocess`, `Encyclopedia`/`ENCYCLOPEDIA`,
  `compute_caps` (CUDADetector / ORT+CnOCR package selection / ONNX-CUDA capability /
  CudaInitializer). Import via `from pycore.pyfoundations.pybasecommon import ...`.
- **Top-level leaf modules** (each imports ONLY pybasecommon + stdlib): `event_bus`,
  `thread_bus`, `secret_manager`, `database_base`, `stdio_utils`, `system_info`,
  `system_paths` (also hosts `UserDataStore`/`get_user_data_store`), `file_lock_manager`
  (also hosts `SplitFileStore`), `tasks` (Task/TaskState/TaskPriority/GlobalTaskQueue),
  `third_party` (the dependency manager — also hosts the whole HF/OCR provisioning chain:
  `hf_*` helpers, `PREWARM_SPEC`, `init_ocr_models_from_hf`, `OcrInitializer`,
  `init_third_party_cnocr`), `app_launcher`, plus the `device/` and `gvar/` packages.
- Only use Python standard library, no third-party packages.
- **FORBIDDEN**: importing from any other `pycore/*` folder, AND (per §2.2) a top-level
  module importing a `pyfoundations` sibling — only stdlib + `pybasecommon`. The sole
  sanctioned UP exception is ColorPrint's lazy, gated, guarded stream into
  `pyutils.rpc_v2` (§2.2.1).
- **Inverted dependencies** (avoid importing UP): `app_launcher` exposes
  `register_executable_launcher_provider(...)`; `pycore.pylauncher` registers its
  provider at import time, so `app_launcher` launches sidecar executables without
  importing `pylauncher`.
- Provides foundational functions and base classes.
- **Commander**: Unified command executor with real-time output and result collection
  (`from pycore.pyfoundations.pybasecommon import Commander`); its live output is routed
  through `ColorPrint.stream(...)`, reusing the shared callback registry so command
  output reaches UI observers (rpc_v2 live log) just like colored logs.

### 3.2 pyutils Rules
- Can reference pyfoundations and pygvar
- Do not re-implement pyfoundations functionality
- Export instances or singletons, not classes
- Can use third-party packages
- One subdirectory (group package) per functionality; each `pyutils/*` group is
  self-contained with respect to OTHER groups. There are NO loose `.py` files at the
  `pyutils/` root (only `__init__.py`) — when adding a new utility, place it in an
  existing group or create a new group package; do NOT drop a bare module at the root.
- **FORBIDDEN**: importing `pyctl`.
- **Shared base tier** (sanctioned): `pyutils/common` is the shared base. Any pyutils
  group MAY import from `common`. Put genuinely-generic shared helpers here.
- **FORBIDDEN**: a group package (subdirectory) importing ANOTHER group package
  (`tts → edge_tts`, `whisper_stt → azure_speech`, `device_sync → launcher`,
  `input → clipboard`, …); and `common` MUST NOT import a group package
  (`common → edge_tts` is backwards). **Canonical example of the fix:** the speech
  orchestrators (`SpeechSwitch`, `ProviderStatus`, the TTS/STT switches) that
  instantiate the `edge_tts`/`azure_speech`/`whisper_stt` groups live in
  `pycore/pyctl/speech/` (the coordination layer), NOT in `pyutils/common`;
  `pyutils/common` keeps only the speech contracts/base classes the groups depend on.
  Need cross-domain behavior? Put the coordinator in `pyctl` (the layer above), or wire
  it by dependency injection — never a domain→domain sideways import. Keep DOMAIN code
  in pyutils; only push truly-generic code into `pyutils/common` (NOT into the
  stdlib-only `pyfoundations` base). Intra-package imports within the same
  `pyutils/<pkg>/` are fine.

### 3.3 pyctl Rules
- High-level wrappers: orchestrate `pyutils`/`pyfoundations`, don't re-implement them
- MAY import anything in a lower layer (`pyfoundations`, `pyutils`, `pygvar`)
- **FORBIDDEN**: being imported by any lower layer (`pyfoundations`/`pyutils`)
- **FORBIDDEN**: one `pyctl/*` module importing a sibling `pyctl/*` module (each
  wrapper is self-contained)

### 3.4 pygvar Usage
- Central location for all constants and variables
- Import pattern: `from pycore.pygvar import CONSTANT_NAME`

### 3.5 MCP (Model Context Protocol) Rules
- **Location**: `pycore/pyutils/mcp/` (implementation), `pyapps/mcp/` (application layer)
- **FORBIDDEN**: ColorPrint usage in any MCP module (ANSI codes break MCP client logs)
- **REQUIRED**: Use Python's standard `logging` module exclusively
- **Log Levels**: WARNING in production (STDIO mode), DEBUG in development
- **Error Handling**: Return error dictionaries, never raise exceptions in MCP tools
- **Output Streams**: STDOUT reserved for MCP JSON-RPC, STDERR for logging only
- **Tool Pattern**: All tools are `async def`, return `Dict[str, Any]` with `success` field
- **Detailed Standards**: See `pycore/pyutils/mcp/MCP_CODING_STANDARDS.md`

**MCP Mode STDIO Compatibility (Critical)**:
- **Detection**: MCP mode auto-detected via `PYCORE_MCP_MODE=1` environment variable (set by `pymain.py app=mcp`)
- **ColorPrint Behavior**: Automatically suppresses ALL output in MCP mode (prevent ANSI codes interfering with JSON-RPC)
- **stdio_utils Fix**: `ensure_stdio_has_buffer_attributes()` MUST be called before FastMCP import to handle `codecs.StreamWriter`
- **scrcpy_device.py**: Skips `sys.stdout` wrapping in MCP mode (preserves binary stream for MCP protocol)
- **MCP Entry Point**: Must call `ensure_stdio_has_buffer_attributes()` after path setup, before FastMCP import
- **Non-MCP Mode**: Full ColorPrint output + scrcpy UTF-8 encoding work normally (backward compatible)

## 4. Application Development Standards

### 4.1 App Directory Structure
```
pyapps/{appname}/
├── {appname}_main.py       # Entry point
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
- STANDARD: `{appname}_main.py` - Entry point
- Must define `start()` or `main()` function

### 4.3 Multi-Language (i18n)

- **NEVER use hardcoded strings** - always use key constants from `I18nKeys` or app-specific `{AppName}I18nKeys`
- **Singleton Pattern** - `i18n` is pre-initialized as global variable, no parameter passing
- **App Extension** - MUST call `i18n.extend_translations(app_dir=Path(__file__).parent, app_name="appname")` in `launcher_config.py` builder function BEFORE using `i18n.get()`
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

## 8. RPC (Remote Procedure Call) System

### 8.1 RPC Specification
- **Location**: `pycore/pyutils/rpc/`
- **Server**: `from pycore.pyutils.rpc import UnifiedRpcServer` - Unified server supporting HTTP and WebSocket on same port
- **Client**: `pycore/pyutils/rpc/client/unified_rpc_client.js` - JavaScript client with WebSocket-first strategy
- **Architecture**: ClientManager (unique client management), AckManager (ACK confirmation), RequestProcessor (async task handling)
- **Protocol**: WebSocket preferred, HTTP fallback when WebSocket unavailable
- **Features**: Request-callback mapping, pending request persistence (localStorage), event/callback registry
- **Usage**: `server.route('route_name', handler_function)` then `await server.start()`
- **Client Lifecycle**: CONNECTING → CONNECTED → RECONNECTING (ws=None on disconnect) → removed after timeout

## 6a. Module Caller Service

### 6a.1 Overview
Pycore Module Caller (`pycore.callmodule`) is a FastAPI service providing HTTP API access to pycore modules. Service port: 59000 (default). See `/www/programing/core_node/pycore/callmodule/README.md` for detailed documentation.

### 6a.2 Entry Points
- Primary: `python3 -m pycore.callmodule`
- Standalone: `/www/programing/core_node/run_callmodule_service.py`
- Systemd: `systemctl start pycore-module-caller`

### 6a.3 Unified Utils Export
All pyutils utilities are exported from `pycore.pyutils` with `*_AVAILABLE` flags. Import pattern: `from pycore.pyutils import ocr_manager, OCR_AVAILABLE`. Use `get_available_utilities()` to check all available utilities. GUI components require `PYUTILS_LOAD_GUI=1` environment variable.

## 9. Database System

### 9.1 Database Specification
- **Location**: `pycore/database/` (independent module, NOT in pyutils)
- **Models Location**: `pycore/database/models/` (NOT `pycore/database_models/` - models are inside database module)
- **Dependencies**: Only `pygvar`, `pyfoundations`, `sqlalchemy`
- **Import**: `from pycore.database import database_manager, BaseModel, DATABASE_AVAILABLE`
- **Models Import**: `from pycore.database.models import TableKeys, TableNamespaces, {ModelName}`

### 9.2 Table Naming Rules
- **Namespace Format**: `common`, `app_{name}`, `util_{name}`
- **Table Key Format**: `{namespace}.{table_name}` (e.g., `common.config`, `app_myapp.users`)
- **FORBIDDEN**: Hardcoded table name strings - ALL table names MUST be defined in `TableKeys` class
- **Model Creation**: Add namespace to `TableNamespaces`, add table key to `TableKeys`, create model in `pycore/database/models/{namespace}/`

### 9.3 Usage Pattern
- **Register**: `database_manager.register_database("dbname")`
- **Load**: `database_manager.load_tables([TableKeys.YOUR_TABLE], [YourModel], "dbname")`
- **Access**: `with database_manager.get_connection("dbname") as conn: table = database_manager.get_table(TableKeys.YOUR_TABLE)`
- **Transaction**: `with database_manager.transaction("dbname") as conn: # auto-commit/rollback`
- **Base CRUD**: `insert()`, `select()`, `update()`, `delete()`, `count()` - Add custom methods in model class
- **Storage**: Uses `map_web_path("www", "pycore_db")` - Windows: `D:/www/pycore_db/`, Linux: `/www/pycore_db/`

## 10. Global Heartbeat System

### 10.1 Architecture Overview
- **Location**: `pycore/pyfoundations/heartbeat/`
- **Thread Type**: Direct Thread inheritance (NOT using thread to start another thread)
- **Synchronization**: NO thread locks - uses atomic operations and state machines
- **Registration**: HARD-CODED in `pycore/pyfoundations/heartbeat/registry.py`
- **Pattern**: Model-Handler with state machine (IDLE, PROCESSING, ERROR, DISABLED)

### 10.2 Core Design Principles

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

### 10.3 Implementation Requirements

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

### 10.4 Registration Rules (HARD-CODED)

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

### 10.5 Handler State Machine

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

### 10.6 Usage in pylauncher

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

### 10.7 Best Practices

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

### 10.8 Statistics and Monitoring

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

### 10.9 Namespace Convention

- `system.*` - Built-in system tasks
- `rpc.*` - RPC server tasks
- `tts.*` - Text-to-Speech tasks
- `ui.*` - Native UI tasks
- `app_{name}.*` - Application-specific tasks
- `util_{name}.*` - Utility module tasks

## 11. Native UI / WebView Development

> **UI (updated):** The pycore desktop UI is now the unified shell
> `poly_apps/pycore_laravel_wordflow_ui` — its **pycore-manager** end, loaded by `pyservice`
> (`pyservice.ps1` / `pyservice.sh`) at `http://localhost:<UiPort>/pycore-manager`
> (Vite/pnpm; the shell's `/`→`/pycore-manager` redirect serves it as the default end).
> The standalone `pycore/pyctl/desktop/desktop-manager` React app was **superseded by
> the unified shell (`poly_apps/pycore_laravel_wordflow_ui`) and has been removed**.
> Backend unchanged: rpc_v2 on `:59000`, the `/pyapi` proxy, and the direct
> `ws://host:59000/rpc/ws` channel. The live backend log is now a GLOBAL floating
> collapsible panel present on every pycore page. The PySide6 webview guidance below
> still applies to whatever URL is loaded.

### 11.1 WebView Flash Prevention (PySide6)
- **REQUIRED**: Set WebView background color to match React app background (`page.setBackgroundColor(QColor("#030305"))` in `webview.py`) and set background color immediately in HTML `<head>` script before CSS loads to prevent white flash (FOUC).