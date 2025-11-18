# Pycore Specification Compliance Analysis

## Analysis Date
Generated automatically during code review

## Summary
This document lists all violations of the PYTHON_PYCORE_BASE_GUIDE specification found in the pycore directory.

## Specification Rules Checked

### 1. Import Statement Rules
- ✅ All imports must be at file top
- ❌ Order: stdlib → third-party → project internal
- ❌ **Forbidden**: Direct import of third-party packages (must use `from pycore.pyfoundations.third_party import ...`)

### 2. Third-Party Package Import Violations

#### Critical Violations (Must Fix)

**pyutils/unified_detector.py**
- Line 33: `import cv2` → Should be `from pycore.pyfoundations.third_party import cv2`
- Line 34: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`
- Line 35: `import yaml` → Should be `from pycore.pyfoundations.third_party import yaml`

**pyutils/media_compressor.py**
- Line 17: `import cv2` → Should be `from pycore.pyfoundations.third_party import cv2`
- Line 18: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`

**pyutils/video_stream/h264_decoder.py**
- Line 3: `import av` → Should be `from pycore.pyfoundations.third_party import av`
- Line 4: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`

**pyutils/video_stream/fmp4_encoder.py**
- Line 3: `import av` → Should be `from pycore.pyfoundations.third_party import av`
- Line 4: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`

**callmodule/app.py**
- Line 6: `from fastapi import FastAPI` → Should be `from pycore.pyfoundations.third_party import fastapi; FastAPI = fastapi.FastAPI`
- Line 7: `from fastapi.middleware.cors import CORSMiddleware` → Should be `from pycore.pyfoundations.third_party import fastapi; CORSMiddleware = fastapi.middleware.cors.CORSMiddleware`

**callmodule/routers/*.py**
- Multiple files: `from fastapi import APIRouter, HTTPException` → Should import from `third_party`

**callmodule/__main__.py**
- Line 58: `import uvicorn` → Should be `from pycore.pyfoundations.third_party import uvicorn`

**pyutils/mcp_bridge_with_laravel/laravel_bridge.py**
- Line 10: `import requests` → Should be `from pycore.pyfoundations.third_party import requests`

**pyutils/mcp_bridge_with_laravel/ocr_engines.py**
- Line 13: `import requests` → Should be `from pycore.pyfoundations.third_party import requests`

**pyutils/launcher/device_sync/ui/tray.py**
- Line 18: `import pystray` → Should be `from pycore.pyfoundations.third_party import pystray`
- Line 19: `from PIL import Image, ImageDraw` → Should be `from pycore.pyfoundations.third_party import PIL; Image = PIL.Image; ImageDraw = PIL.ImageDraw`

**pyutils/launcher/device_sync/simple_tray_menu.py**
- Line 13: `import pystray` → Should be `from pycore.pyfoundations.third_party import pystray`
- Line 14: `from PIL import Image, ImageDraw` → Should be `from pycore.pyfoundations.third_party import PIL`

**pyutils/launcher/device_sync/_deprecated/_old_servers/websocket_server.py**
- Line 20: `import websockets` → Should be `from pycore.pyfoundations.third_party import websockets`
- Line 21: `from websockets.server import WebSocketServerProtocol` → Should be `from pycore.pyfoundations.third_party import websockets; WebSocketServerProtocol = websockets.server.WebSocketServerProtocol`

**pyutils/rpc/server/*.py**
- Multiple files: `from aiohttp import web, web_ws` → Should be `from pycore.pyfoundations.third_party import aiohttp`

**pyutils/ultralytics/dataset_generator_yolo.py**
- Line 13: `import cv2` → Should be `from pycore.pyfoundations.third_party import cv2`
- Line 14: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`

**pyutils/ultralytics/gpu_image_processor.py**
- Line 6: `import cv2` → Should be `from pycore.pyfoundations.third_party import cv2`
- Line 7: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`

**pyutils/ultralytics/ultralytics_trainer.py**
- Line 14: `import yaml` → Should be `from pycore.pyfoundations.third_party import yaml`

**pyutils/zip_task_queue.py**
- Line 5: `import psutil` → Should be `from pycore.pyfoundations.third_party import psutil`

**pyutils/png_matcher.py**
- Line 10: `import numpy as np` → Should be `from pycore.pyfoundations.third_party import numpy as np`

**pyutils/image_*.py (multiple files)**
- Multiple files: `import numpy as np`, `from PIL import ...` → Should import from `third_party`

**pyutils/mcp_bridge_with_laravel/image_*.py**
- Multiple files: `from PIL import ...` → Should import from `third_party`

**pyutils/icon_analyzer.py, ui_analyzer.py, click_handler.py, window_analyzer.py, window_screenshot.py**
- Multiple files: `from PIL import ...` → Should import from `third_party`

**pyutils/native_ui/step8_utils/image_converter.py**
- Line 29: `from PIL import Image` → Should be `from pycore.pyfoundations.third_party import PIL`

**pyutils/native_ui/step4_startup/startup_window_thread.py**
- Line 62: `from PIL import Image, ImageTk` → Should be `from pycore.pyfoundations.third_party import PIL`

**pyutils/mcp_bridge_with_laravel/main.py**
- Line 39: `from mcp.server.fastmcp import FastMCP` → Should be `from pycore.pyfoundations.third_party import FastMCP`

### 3. Imports Inside Functions

**pyutils/mcp_bridge_with_laravel/pdf_processor.py**
- Lines 64, 187: `import pypdf` inside try-except blocks
- Line 276: `from pdf2image import convert_from_path` inside function

**pyutils/mcp_bridge_with_laravel/ocr_engines.py**
- Line 267: `from paddleocr import PaddleOCR` inside try-except
- Line 293: `import paddle` inside try-except
- Lines 483-491: Multiple imports inside try-except blocks

**pyutils/mcp_bridge_with_laravel/paddle_ocr_engine.py**
- Lines 84-93, 115, 158: Imports inside try-except blocks

**callmodule/global_config.py**
- Line 83: `import time` inside function

### 4. pyfoundations Compliance

✅ **GOOD**: All pyfoundations files only use stdlib and import from other pyfoundations modules only.

**Exception**: `third_party.py` correctly imports third-party packages directly (this is the designated module for this purpose).

### 5. Correct Examples

✅ **pyutils/ultralytics/unified_gpu_manager.py**
- Line 30: Correctly imports `from pycore.pyfoundations.third_party import torch, cv2`

✅ **pyutils/image_matcher.py**
- Line 16: Correctly imports `from pycore.pyfoundations.third_party import numpy, cv2`

## Action Items

1. ✅ **Priority 1**: Fix all direct third-party imports in pyutils modules - **COMPLETED**
2. ⚠️ **Priority 2**: Fix imports inside functions/try-except blocks - **PARTIAL** (lower priority, documented)
3. ✅ **Priority 3**: Fix callmodule imports - **COMPLETED**
4. ✅ **Priority 4**: Review and fix mcp_bridge_with_laravel imports - **COMPLETED**

## Fixed Files Summary

### ✅ Completed Fixes

**Core Utilities:**
- unified_detector.py, media_compressor.py, h264_decoder.py, fmp4_encoder.py
- dataset_generator_yolo.py, gpu_image_processor.py, ultralytics_trainer.py
- dataset_generator.py, zip_task_queue.py, png_matcher.py

**Image Processing:**
- image_enhancer.py, image_crop.py, image_comparator.py, image_annotator.py, image_tools.py
- icon_analyzer.py, ui_analyzer.py, click_handler.py, window_analyzer.py, window_screenshot.py
- mcp_bridge_with_laravel/image_processor.py, mcp_bridge_with_laravel/image_tools.py
- native_ui/step8_utils/image_converter.py, native_ui/step8_utils/embedded_images.py
- native_ui/step4_startup/startup_window_thread.py

**Callmodule:**
- app.py, routers/*.py, controllers/*.py, __main__.py

**Network/Server:**
- rpc/server/*.py (aiohttp imports)
- launcher/device_sync/*.py (pystray, PIL, websockets)
- mcp_bridge_with_laravel/laravel_bridge.py, ocr_engines.py, main.py

### ✅ All Issues Fixed

**Previously Remaining Issues (Now Fixed):**
- ✅ mcp_bridge_with_laravel/pdf_processor.py - pypdf, pdf2image imports moved to module level with importlib.util.find_spec()
- ✅ mcp_bridge_with_laravel/ocr_engines.py - paddleocr imports moved to module level with importlib.util.find_spec()
- ✅ mcp_bridge_with_laravel/paddle_ocr_engine.py - paddle imports moved to module level with importlib.util.find_spec()
- ✅ callmodule/global_config.py - time import moved to top of file

**All imports now follow specification:**
- No imports inside try-except blocks
- Optional dependencies checked with importlib.util.find_spec() at module level
- All imports at file top level

## Notes

- Some packages like `pypdf`, `paddleocr`, `pdf2image` may not be in DEPENDENCY_MAP and may need to be added
- FastAPI submodules (like `fastapi.middleware.cors`) need special handling
- PIL submodules (like `PIL.Image`, `PIL.ImageDraw`) need special handling

