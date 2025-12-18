# Pycore Utils - Unified Utility Library

Consolidated utility library for device management, networking, UI, and more.

## Directory Structure

```
pyutils/
├── adb/               # ADB communication (unified from pyadb)
├── device/            # Device utilities (re-exports pyutils.device)
├── video_stream/      # Video streaming (H264, FMP4)
├── control/           # Device control (touch, keyboard)
├── group/             # Group device control
├── mcp/               # MCP network discovery (NEW)
├── native_ui/         # Native UI frameworks (PySide6, Tkinter)
├── api/               # WebSocket and API utilities
├── web/               # Web utilities
├── wsrpc/             # WebSocket RPC framework
└── launcher/          # Application launcher utilities
```

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
