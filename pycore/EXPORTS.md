# PyCore Exports Guide

Quick reference for importing PyCore components.

## Core Components

### Device Management
```python
# Centralized device manager (singleton)
from pycore.pyutils.device_manager import DeviceManager, DeviceState

manager = DeviceManager.instance()
devices = await manager.list_devices()
device = await manager.connect_device("ABC123")
```

### Event Bus
```python
# Cross-app event communication
from pycore.pyfoundations.event_bus import EventBus, EventTypes, Event

bus = EventBus.instance()
bus.subscribe(EventTypes.DEVICE_CONNECTED, callback)
await bus.emit(EventTypes.DEVICE_CONNECTED, source="myApp", data={...})
```

### Video Streaming
```python
# H.264 decoder
from pycore.pyutils.stream import H264Decoder

decoder = H264Decoder()
frames = decoder.decode(h264_data)

# fMP4 encoder (complete)
from pycore.pyutils.stream import FMP4EncoderComplete

encoder = FMP4EncoderComplete(width=1080, height=2340, fps=60)
init_segment = encoder.generate_init_segment(sps, pps)
media_segment = encoder.generate_media_segment(frame_data, timestamp, is_keyframe)

# Video stream handler (high-level streaming)
from pycore.pyutils.stream import VideoStreamHandler
from pycore.pyfoundations.device import ScrcpyDevice

device = ScrcpyDevice(serial, params, adb_path)
device.start_server()

handler = VideoStreamHandler(device)
await handler.start()

# Get init segment for MSE
init_seg = handler.get_init_segment()

# Stream fMP4 chunks
async for fmp4_chunk in handler.stream_fmp4():
    await websocket.send_bytes(fmp4_chunk)

await handler.stop()
```

### ADB Communication
```python
# ADB manager
from pycore.pyutils.adb import ADBManager, ADBDevice

devices = ADBManager.list_devices("adb")
info = ADBManager.get_device_info("ABC123", "adb")
output = ADBManager.execute_shell("ABC123", "wm size", "adb")
```

### Device Control
```python
# Touch and key events
from pycore.pyutils.control import TouchEvent, KeyEvent, MessageBuilder

touch = TouchEvent(action="down", x=100, y=200, ...)
key = KeyEvent(action="down", key_code=26, ...)
builder = MessageBuilder()
message = builder.build_touch_message(touch)
```

### Group Control
```python
# Master-slave device coordination
from pycore.pyutils.group import GroupController, AllSyncStrategy, SyncEvent

strategy = AllSyncStrategy()
controller = GroupController(
    group_id="group1",
    master_device="device1",
    slave_devices={"device2", "device3"},
    strategy=strategy
)

event = SyncEvent(type="touch", from_device="device1", data={...})
targets = controller.get_sync_targets(event)
```

### FastAPI Utilities
```python
# WebSocket manager
from pycore.pyutils.api import WebSocketManager

manager = WebSocketManager()
await manager.connect("key", websocket)
await manager.broadcast("key", data)
await manager.disconnect("key", websocket)
```

### WebSocket RPC
```python
# WebSocket RPC client/server
from pycore.pyutils.wsrpc import WSRPCClient, WSRPCServer

client = WSRPCClient("ws://localhost:8000")
await client.connect()
result = await client.call("method_name", param1="value")

server = WSRPCServer()
server.register_method("method_name", handler_func)
await server.start("0.0.0.0", 8000)
```

### Device Info Structures
```python
# Device information dataclasses
from pycore.pyfoundations.device import (
    AndroidDevice,
    ScrcpyDevice,
    DeviceInfo,
    ServerParams,
    VideoCodec
)

params = ServerParams(
    max_size=720,
    bit_rate=8000000,
    max_fps=60,
    codec=VideoCodec.H264,
    control=True
)

# Create device instance
device = ScrcpyDevice(serial="ABC123", params=params, adb_path="adb")
device.start_server()

# Read frames
frame_data = device.read_video_frame()

# Send control message
device.send_control_message(message_bytes)

device.stop_server()
```

### Global Variables
```python
# Global variable manager
from pycore.pyfoundations.gvar import GlobalVarManager

gvar = GlobalVarManager()
gvar.set("key", "value")
value = gvar.get("key")
```

### Utilities
```python
# Color printing
from pycore.pyfoundations import ColorPrint

ColorPrint.success("Operation completed")
ColorPrint.error("Error occurred")
ColorPrint.warning("Warning message")
ColorPrint.info("Information")

# Encyclopedia (global cache)
from pycore.pyfoundations import ENCYCLOPEDIA

ENCYCLOPEDIA.add("key", value)
value = ENCYCLOPEDIA.get("key")
```

## App Integration Pattern

### Typical App Service
```python
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyfoundations.event_bus import EventBus, EventTypes

class MyAppService:
    def __init__(self):
        # Use centralized services
        self.device_manager = DeviceManager.instance()
        self.event_bus = EventBus.instance()

        # Subscribe to events
        self.event_bus.subscribe(
            EventTypes.DEVICE_CONNECTED,
            self._on_device_connected
        )

    async def _on_device_connected(self, event):
        print(f"[MyApp] Device {event.data['serial']} connected")

    async def start_operation(self, serial):
        # Get device from centralized manager
        device = self.device_manager.get_device(serial)

        # Emit app-specific event
        await self.event_bus.emit(
            "myapp.operation.started",
            source="myApp",
            data={"serial": serial}
        )
```

## Quick Start Template

```python
"""
New App Template

This template shows how to create a new app using pycore.
"""

from pycore.pyutils.device_manager import DeviceManager
from pycore.pyfoundations.event_bus import EventBus, EventTypes
from pycore.pyutils.stream import FMP4EncoderComplete
from pycore.pyutils.control import TouchEvent
from pycore.pyutils.group import GroupController, AllSyncStrategy

class MyNewApp:
    """My new app using pycore"""

    def __init__(self):
        # Get centralized services
        self.device_manager = DeviceManager.instance()
        self.event_bus = EventBus.instance()

        # Setup event listeners
        self._setup_events()

    def _setup_events(self):
        """Subscribe to device events"""
        self.event_bus.subscribe(
            EventTypes.DEVICE_CONNECTED,
            self._on_device_connected
        )
        self.event_bus.subscribe(
            EventTypes.DEVICE_DISCONNECTED,
            self._on_device_disconnected
        )

    async def _on_device_connected(self, event):
        """Handle device connected"""
        print(f"[MyApp] Device connected: {event.data}")

    async def _on_device_disconnected(self, event):
        """Handle device disconnected"""
        print(f"[MyApp] Device disconnected: {event.data}")

    async def start(self):
        """Start the app"""
        # List available devices
        devices = await self.device_manager.list_devices()
        print(f"Found {len(devices)} devices")

        # Connect to first device
        if devices:
            device = await self.device_manager.connect_device(
                devices[0].serial
            )

            # Emit custom event
            await self.event_bus.emit(
                "myapp.started",
                source="MyNewApp",
                data={"device_count": len(devices)}
            )

# Usage
if __name__ == "__main__":
    import asyncio

    app = MyNewApp()
    asyncio.run(app.start())
```

## Best Practices

### 1. Always Use Singletons
```python
# ✅ Good
manager = DeviceManager.instance()
bus = EventBus.instance()

# ❌ Bad
manager = DeviceManager()  # Creates new instance
```

### 2. Subscribe to Events
```python
# ✅ Good - React to device changes
bus.subscribe(EventTypes.DEVICE_CONNECTED, handler)

# ❌ Bad - Poll for changes
while True:
    check_devices()  # Inefficient
    time.sleep(1)
```

### 3. Emit Events for Cross-App Communication
```python
# ✅ Good - Other apps can listen
await bus.emit("myapp.action", source="myApp", data={...})

# ❌ Bad - Direct app coupling
other_app.notify_action(...)  # Tight coupling
```

### 4. Extend PyCore Classes
```python
# ✅ Good - Extend for customization
class MyDeviceManager(DeviceManager):
    async def connect_device(self, serial, params=None):
        # Custom logic
        result = await super().connect_device(serial, params)
        # More custom logic
        return result

# ❌ Bad - Duplicate implementation
class MyDeviceManager:
    # Reimplements everything...
```

## See Also

- **ARCHITECTURE.md** - Architecture overview
- **BACKEND_IMPLEMENTATION_SUMMARY.md** - Backend details
- **DEVELOPMENT_COMPLETE_SUMMARY.md** - Full summary
