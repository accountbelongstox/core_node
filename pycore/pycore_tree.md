# Directory Tree: pycore

**Path:** `D:\programing\core_node\pycore`

## New Structure (Reorganized)

```
pycore/
├── pyfoundations/          # Foundation classes and core data structures
│   ├── __init__.py
│   ├── color_print.py     # Colored console output utilities
│   ├── encyclopedia.py    # Global cache/registry system
│   ├── device/            # Device-related foundation classes
│   │   ├── __init__.py
│   │   ├── android_device.py      # AndroidDevice abstract class
│   │   ├── device_info.py         # Device information dataclasses
│   │   └── server_params.py       # Server parameter configurations
│   └── gvar/              # Global variable management
│       ├── __init__.py
│       ├── global_var_manager.py  # Global variable manager
│       ├── pyglobal_vars.py       # Global variable definitions
│       └── ws_rpc_constants.py    # WebSocket RPC constants
│
├── pyutils/               # Utility tools and functional modules
│   ├── adb/              # ADB communication utilities
│   │   ├── __init__.py
│   │   ├── adb_device.py         # ADB device representation
│   │   ├── adb_exceptions.py     # ADB exception classes
│   │   └── adb_manager.py        # ADB command manager
│   │
│   ├── api/              # FastAPI utilities
│   │   ├── __init__.py
│   │   ├── websocket_manager.py  # WebSocket connection manager
│   │   └── test_websocket_manager.py
│   │
│   ├── control/          # Device control utilities
│   │   ├── __init__.py
│   │   ├── coordinate_mapper.py  # Coordinate mapping
│   │   ├── key_event.py          # Keyboard event handling
│   │   ├── message_builder.py    # Control message builder
│   │   └── touch_event.py        # Touch event handling
│   │
│   ├── group/            # Group control algorithms
│   │   ├── __init__.py
│   │   ├── group_controller.py   # Group control logic
│   │   ├── sync_event.py         # Sync event definitions
│   │   ├── sync_strategy.py      # Sync strategies
│   │   └── test_group_controller.py
│   │
│   ├── stream/           # Video streaming utilities
│   │   ├── __init__.py
│   │   ├── fmp4_encoder.py       # fMP4 encoder
│   │   ├── h264_decoder.py       # H.264 decoder
│   │   ├── stream_types.py       # Stream type definitions
│   │   └── video_decoder.py      # Video decoder interface
│   │
│   ├── web/              # Web GUI utilities
│   │   ├── __init__.py
│   │   ├── http_bridge.py        # HTTP bridge
│   │   └── universal_gui_launcher.py
│   │
│   ├── wsrpc/            # WebSocket RPC framework
│   │   ├── examples/
│   │   │   ├── __init__.py
│   │   │   ├── client_example.py
│   │   │   └── server_example.py
│   │   ├── libs/
│   │   │   ├── __init__.py
│   │   │   ├── auth_manager.py
│   │   │   ├── heartbeat_manager.py
│   │   │   ├── interceptor_manager.py
│   │   │   ├── message_compressor.py
│   │   │   ├── middleware_chain.py
│   │   │   ├── namespace_manager.py
│   │   │   ├── performance_monitor.py
│   │   │   └── rate_limiter.py
│   │   ├── README.md
│   │   ├── __init__.py
│   │   ├── ws_rpc_client.py
│   │   └── ws_rpc_server.py
│   │
│   ├── common/           # Common utilities
│   │   ├── __init__.py
│   │   └── window_finder.py
│   │
│   ├── ultralytics/      # YOLO training utilities
│   │   ├── GPU_DETECTION_SUMMARY.md
│   │   ├── GPU_SUPPORT_README.md
│   │   ├── UNIFIED_GPU_SYSTEM_README.md
│   │   ├── __init__.py
│   │   ├── classification_trainer.py
│   │   ├── dataset_generator_yolo.py
│   │   ├── detection_trainer.py
│   │   ├── device_manager.py
│   │   ├── gpu_image_processor.py
│   │   ├── ultralytics_trainer.py
│   │   ├── unified_gpu_manager.py
│   │   └── unified_trainer.py
│   │
│   ├── examples/         # Example scripts
│   │   ├── dataset_generator_example.py
│   │   ├── ocr_example.py
│   │   └── unified_detector_example.py
│   │
│   ├── UNIFIED_DETECTOR_QUICKSTART.md
│   ├── UNIFIED_DETECTOR_README.md
│   ├── app_launcher.py
│   ├── click_handler.py
│   ├── dataset_generator.py
│   ├── hotkey_listener.py
│   ├── image_annotator.py
│   ├── image_comparator.py
│   ├── image_crop.py
│   ├── image_enhancer.py
│   ├── image_matcher.py
│   ├── integrated_window_analyzer.py
│   ├── ocr_cnocr_engine.py
│   ├── paddle_ocr.py
│   ├── png_matcher.py
│   ├── process_manager.py
│   ├── pyutils_tree.md
│   ├── tray_clicker.py
│   ├── ui_analyzer.py
│   ├── unified_detector.py
│   ├── window_activator.py
│   ├── window_analyzer.py
│   ├── window_ops.py
│   ├── window_screenshot.py
│   └── zip_task_queue.py
│
├── scripts/              # Helper scripts
│   ├── async_scheduler.py
│   ├── function_mapping.md
│   ├── migration_complete.md
│   └── migration_summary.md
│
├── GPU_INTEGRATION_GUIDE.md
├── PYCORE_CONSISTENCY_REPORT.md
├── __init__.py           # Dependency management and auto-check
├── __main__.py
└── pycore_tree.md        # This file
```

## Module Organization

### pyfoundations
Foundation classes that provide core data structures and basic functionality:
- **color_print**: Console output with colors
- **encyclopedia**: Global cache/registry (singleton pattern)
- **device**: Device-related base classes and dataclasses
- **gvar**: Global variable management and constants

### pyutils
Functional utilities organized by purpose:
- **adb**: Android Debug Bridge communication
- **api**: FastAPI and WebSocket utilities
- **control**: Device control (touch, keyboard)
- **group**: Multi-device group control
- **stream**: Video streaming and encoding
- **web**: Web GUI utilities
- **wsrpc**: WebSocket RPC framework
- **ultralytics**: YOLO/AI training tools
- Plus various standalone utilities for images, windows, OCR, etc.

## Import Examples

```python
# Foundation classes
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.device import AndroidDevice, DeviceInfo
from pycore.pyfoundations.gvar import GlobalVarManager

# Utility modules
from pycore.pyutils.adb import ADBManager, ADBDevice
from pycore.pyutils.api import WebSocketManager
from pycore.pyutils.control import TouchEvent, KeyEvent
from pycore.pyutils.group import GroupController
from pycore.pyutils.stream import H264Decoder
from pycore.pyutils.wsrpc import WSRPCClient, WSRPCServer

# Dependency management (auto-runs on import)
from pycore import check_and_install_dependencies
check_and_install_dependencies()
```

---
*Updated after restructure - all modules now organized under pyfoundations/ and pyutils/*
