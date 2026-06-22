# pycore Complete Module Reference

## 1. pyfoundations (Core Foundation - stdlib only)

### 1.1 Documented in Spec
- `color_print.py` - ColorPrint colored output
- `encyclopedia.py` - Encyclopedia global cache
- `event_bus.py` - EventBus event system
- `thread_bus.py` - ThreadBus thread communication
- `secret_manager.py` - SecretManager key management
- `pybasecommon/commander.py` - Commander command executor

### 1.2 NOT in Spec
- `app_launcher.py` - AppLauncher for pyapps/ discovery, fuzzy matching, dynamic loading
- `database_base.py` - Database base classes
- `file_lock_manager.py` - FileLockManager multi-process file locking
- `global_task_queue.py` - GlobalTaskQueue thread-safe priority queue
- `split_file_store.py` - SplitFileStore separate file storage
- `stdio_utils.py` - STDIO stream normalization for MCP
- `system_info.py` - SystemInfo screen/memory/disk/CPU info
- `system_paths.py` - SystemPaths cross-platform paths (Windows: ~/.core_node, Linux: /var/_core_node)
- `task_models.py` - Task, TaskState, TaskPriority models

---

## 2. pyutils (Utilities - third-party allowed)

### 2.1 Documented in Spec
- `ocr/` - OCR with CnOCR
- `rpc/` - UnifiedRpcServer HTTP+WebSocket

### 2.2 NOT in Spec

#### Audio/Speech
- `audio_utils/` - SilenceDetector
- `azure_speech/` - AzureSpeechClient, SpeechRecognizer
- `edge_tts/` - EdgeTTSClient, TTSProcessor, TTSTranslator, TTSThreadManager
- `whisper_stt/` - WhisperSTTProvider (file/microphone/system audio)

#### Device/ADB
- `device/` - DeviceInfo, ServerParams, AndroidDevice, ScrcpyDevice, ADBManager, ADBDevice
- `adb/` - ADB utilities

#### UI
- `native_ui/` - NativeUIConfig, launch_native_app, TimerManager, I18nManager, ShutdownManager, PySide6Framework

#### Browser
- `pybrowser/` - SpiderEngine, SessionManager, ChromeBrowser, EdgeBrowser, FirefoxBrowser, plugins

#### RPC v2
- `rpc_v2/` - FastAPIRPCServer, RPCDiscovery, NetworkScanner, RPCProtocolClient
- `wsrpc/` - WsRpcServer, WsRpcClient, SingletonBackendDetector, SingletonRpcBackend

#### Translation
- `translator/` - GoogleTranslator with MD5 caching

#### AI/ML
- `ultralytics/` - ClassificationTrainer, DetectionTrainer, YOLODatasetGenerator
- `openrouter_sdk/` - OpenRouter API

#### Clipboard
- `clipboard/` - clipboard_manager, ClipboardHistory, ClipboardMonitor

#### Control
- `control/` - TouchEvent, KeyEvent, CoordinateMapper

#### Image
- `image_tools.py` - Image utilities
- `image_annotator.py` - Image annotation
- `image_comparator.py` - Image comparison
- `image_crop.py` - Image cropping
- `image_enhancer.py` - Image enhancement
- `image_matcher.py` - Image matching
- `icon_analyzer.py` - Icon analysis
- `png_matcher.py` - PNG matching
- `unified_detector.py` - Unified detection

#### Window
- `window_activator.py` - Window activation
- `window_analyzer.py` - Window analysis
- `window_ops.py` - Window operations
- `window_screenshot.py` - Window screenshot
- `ui_analyzer.py` - UI analysis
- `integrated_window_analyzer.py` - Integrated analyzer

#### Other
- `common/` - TTS/STT switch, speech config, provider status
- `group/` - GroupController, SyncEvent, SyncStrategy
- `hotkey/` - HotkeyListener
- `launcher/` - device_sync, config_manager
- `video_stream/` - Video streaming
- `web/` - Web utilities
- `nodejs_bridge/` - Node.js bridge
- `flutter_dev_tools/` - Flutter development tools
- `mcp_bridge_with_laravel/` - Laravel MCP bridge
- `process_manager.py` - Process management
- `media_compressor.py` - Media compression
- `zip_task_queue.py` - ZIP task queue
- `desktop_shortcut_manager.py` - Desktop shortcuts
- `singleton_launcher.py` - Singleton launcher

---

## 3. pyctl (Control Layer)

### NOT in Spec
- `speech/` - Speech management (TTS + STT + RPC + AI)
- `pybrowserauto/` - Offline web downloader
- `mcpctl/` - MCP control

---

## 4. pygvar (Global Variables)

### 4.1 Documented in Spec
- Central constants and variables

### 4.2 NOT in Spec
- `constants.py` - PROJECT_ROOT, CACHE_DIR, TMP_DIR, etc.
- `global_var_manager.py` - GlobalVarManager
- `ws_rpc_constants.py` - WebSocket RPC constants

---

## 5. Top-Level Modules (NOT in Spec)

### pyheartbeat/
Global task scheduler and thread management:
- `HeartbeatSystem` - Central coordinator
- `HeartbeatPusher` - 1-second heartbeat loop
- `UnifiedTaskAPI` - Task submission interface
- Import: `from pycore.pyheartbeat import initialize_heartbeat_system, get_unified_api`

### pylauncher/
Application launcher with singleton detection:
- `LauncherConfig` - Unified configuration
- `ServiceLauncher` - Main service launcher
- `SingletonDetector` - Cross-process singleton detection
- Import: `from pycore.pylauncher import LauncherConfig, ServiceLauncher`

### pythreadpool/
Thread pool and service registry:
- `GlobalThreadPool` - Centralized thread registry
- `THREAD_REGISTRY` - Service metadata
- `SERVICE_STARTERS` - Service starter functions
- Import: `from pycore.pythreadpool import get_global_thread_pool, start_rpc_v2`

---

## 6. database/ (Documented but details missing)

### 6.1 Models Location
`pycore/database/models/` contains:
- `common/` - Common tables
- `app_*/` - Application-specific tables
- `util_*/` - Utility module tables

### 6.2 Key Classes
- `BaseModel` - Base model class
- `TableKeys` - Table key constants
- `TableNamespaces` - Namespace definitions
- `database_manager` - Singleton manager
- `type_converter.py` - Type conversion
- `json_serializer.py` - JSON serialization

---

## 7. callmodule/ (Module Caller Service)

Port: 59000

### Components
- `controllers/` - health_controller, module_call_controller
- `routers/` - health, mcp, module_call, ocr, translator
- `platform/` - launcher, linux_service, windows_tray
- `server/` - http_server

---

## 8. Import Patterns

### pyfoundations
```python
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import get_encyclopedia
from pycore.pyfoundations.event_bus import EventBus
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.secret_manager import get_secret_key
from pycore.pyfoundations.system_info import get_system_info
from pycore.pyfoundations.system_paths import SystemPaths
from pycore.pyfoundations.task_models import Task, TaskPriority
from pycore.pyfoundations.global_task_queue import GlobalTaskQueue
```

### pyutils
```python
from pycore.pyutils.ocr import ocr_manager
from pycore.pyutils.rpc import UnifiedRpcServer
from pycore.pyutils.rpc_v2 import FastAPIRPCServer, RPCDiscovery
from pycore.pyutils.wsrpc import WsRpcServer, WsRpcClient
from pycore.pyutils.edge_tts import EdgeTTSClient, get_edge_tts_client
from pycore.pyutils.azure_speech import speech_recognizer
from pycore.pyutils.whisper_stt import whisper_stt_provider
from pycore.pyutils.device import ScrcpyDevice, ADBManager
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pycore.pyutils.pybrowser import SpiderEngine, create_session
from pycore.pyutils.translator import GoogleTranslator
from pycore.pyutils.clipboard import clipboard_manager
from pycore.pyutils.ultralytics import ClassificationTrainer, DetectionTrainer
```

### Top-level
```python
from pycore.pyheartbeat import initialize_heartbeat_system, get_unified_api
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore.pythreadpool import get_global_thread_pool
from pycore.database import database_manager, BaseModel
```

---

## 9. Summary Statistics

| Module | Documented | Undocumented |
|--------|------------|--------------|
| pyfoundations | 6 | 9 |
| pyutils | 2 | 40+ |
| pyctl | 0 | 3 |
| pygvar | 1 | 3 |
| Top-level | 1 | 3 |
| **Total** | **10** | **58+** |

