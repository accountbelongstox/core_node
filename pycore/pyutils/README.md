# Pycore Utils - Unified Utility Library

Consolidated utility library for device management, networking, UI, and more.

## Directory Structure

Every utility lives inside a functional **group package** - there are no loose
`.py` files at the package root (only `__init__.py`). See `pyutils_tree.md` for
the full map. Highlights:

```
pyutils/
├── common/            # SHARED BASE - generic helpers any group may import
├── window/            # window & on-screen UI (activator, screenshot, ops, analyzer, unified_detector, ...)
├── desktop/           # desktop shortcut managers + taskbar
├── input/             # input simulation (click, field typing, IME, tray)
├── image_tools/       # image & media processing (image_processor, media_compressor, dataset_generator, ...)
├── device/            # ADB / scrcpy device layer (device_manager, scrcpy_init, ...)
├── hotkey/            # hotkey listeners
├── adb/ control/ group/ video_stream/   # device control & streaming
├── mcp/ rpc_v2/ wsrpc/ api/ web/ nodejs_bridge/   # network / RPC
├── native_ui/ frontend_launcher/ launcher/         # UI & launching
├── edge_tts/ azure_speech/ whisper_stt/ tts/ translator/   # speech / language
├── ocr_cluster/ ultralytics/ voc_annotator/ ai_cluster/    # vision / ML
└── examples/          # sample & template code
```

### Layering rule (STRICT - see PYTHON_PYCORE.md S2.2 / S3.2)

- **`common/` is the only shared base.** Any group MAY import `common`,
  `pyfoundations` and `pygvar`.
- **`common/` MUST NOT import a group** (no `common -> edge_tts`).
- **A group MUST NOT import a sibling group** (no `tts -> edge_tts`,
  `input -> clipboard`, ...). Intra-package imports within one group are fine.
- **`pyutils` MUST NOT import `pyctl`.** Only `pyctl` imports `pyutils`.
  Cross-group coordination belongs in `pyctl` (the layer above) or is wired by
  dependency injection - never a sideways group->group import.

## Key Modules

### ADB (`pyutils.device`)
Unified ADB communication module.

```python
from pycore.pyutils.device import ADBManager, ADBDevice

devices = ADBManager.list_devices()
result = ADBManager.execute_shell("ABC123", "getprop")
```

### Device (`pyutils.device`)
Convenience re-exports of device structures.

```python
from pycore.pyutils.device import DeviceInfo, ServerParams, Resolution

device = DeviceInfo(serial="ABC123", model="Pixel 6")
params = ServerParams(max_size=720, bit_rate=8000000)
```

### MCP Discovery (`pyutils.mcp`)
Network discovery for MCP servers.

```python
from pycore.pyutils.mcp import MCPServerDiscovery, NetworkScanner

# Discover MCP servers
discovery = MCPServerDiscovery(debug=True)
servers = discovery.find_servers()

# Network scanning
scanner = NetworkScanner()
network_info = scanner.detect_network_segment()
active_hosts = scanner.scan_network_segment()
```

### Video Streaming (`pyutils.video_stream`)
Video encoding/decoding.

```python
from pycore.pyutils.video_stream import H264Decoder, FMP4Encoder

decoder = H264Decoder()
encoder = FMP4Encoder()
```

### Control (`pyutils.control`)
Device control utilities.

```python
from pycore.pyutils.control import TouchEvent, KeyEvent

touch = TouchEvent(x=500, y=1000, action="down")
key = KeyEvent(keycode="KEYCODE_HOME")
```

### Native UI (`pyutils.native_ui`)
Cross-platform native UI frameworks.

```python
from pycore.pyutils.native_ui import launch_app_with_startup

def main_app():
    # Your app code
    pass

launch_app_with_startup(
    app_name="My App",
    main_entry=main_app
)
```

## Version History

- **2.1.0** (2026-06-15) - Regrouped all loose top-level modules into functional
  group packages (`common`, `window`, `desktop`, `input`, `image_tools`, plus
  `device`/`hotkey`/`examples` absorbing their kin). No loose `.py` remains at the
  package root. Shared base is now `common/` only; introduced
  `common/clipboard_text.py` and moved the shortcut/icon engine
  (`icon_generator`, `appusermodelid`) into `common`. All import sites across
  `pycore`, `pyapps` and `scripts` were updated (no shims).
  - **`common` is now verified group-free.** The speech ORCHESTRATORS
    (`SpeechSwitch`, `ProviderStatus`, TTS/STT switches) moved out of `common`
    into `pycore/pyctl/speech/` (coordination is a pyctl concern); `common` keeps
    only the speech contracts/base classes. This removed the last
    `common -> group` edges.
  - Module-specific docs moved next to their code (`SHORTCUT_MANAGER_README.md`
    -> `desktop/`, `INTEGRATION_ULTRALYTICS_VOC_ANNOTATOR.md` -> `voc_annotator/`);
    only `README.md` + `pyutils_tree.md` remain at the package root.

- **2.0.0** - Unified ADB and device utilities
  - Consolidated `pyadb` into `pyutils.device`
  - Added MCP network discovery
  - Added enhanced ADB types
  - Created compatibility layers for smooth migration

- **1.0.0** - Initial modular structure

## Migration

For migration from deprecated modules:
- See `../UNIFIED_UTILS_MIGRATION_GUIDE.md`

## Dependencies

Core utilities have minimal dependencies:
- Standard library (subprocess, socket, pathlib, etc.)
- Optional: PySide6 (for native UI)
- Optional: websockets (for WebSocket features)
- Optional: av (for video streaming)

Specific dependencies are documented in each module.

## Contributing

When adding new utilities:

1. **Use existing patterns**: Follow established module structures
2. **Document thoroughly**: Include docstrings and examples
3. **Keep dependencies minimal**: Avoid heavy third-party requirements
4. **Write in English**: All code and comments in English
5. **Type hints**: Use type annotations for better IDE support

## Related Documentation

- [Migration Guide](../UNIFIED_UTILS_MIGRATION_GUIDE.md)
- [MCP Discovery](mcp/README.md)
- [Native UI Guide](native_ui/README.md)
- [Development Guide](../../development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md)
