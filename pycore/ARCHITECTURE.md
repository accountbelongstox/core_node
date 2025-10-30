# PyCore Architecture - Centralized Core Library

## 🎯 Design Philosophy

**PyCore is the centralized core library** that provides reusable functionality for all apps.

- **Data Centralization**: Device states, connections, and events are managed centrally
- **App Independence**: Apps (pyMatrix, screencast, etc.) are thin wrappers around pycore
- **Extensibility**: Apps can extend pycore classes for customization
- **Reusability**: Core functionality is shared across all apps

## 📁 Structure

```
pycore/
├── pyfoundations/          # Foundation classes and core structures
│   ├── color_print.py     # Console utilities
│   ├── encyclopedia.py    # Global cache/registry
│   ├── event_bus.py       # ✨ NEW: Cross-app event bus
│   ├── device/            # Device base classes
│   │   ├── android_device.py
│   │   ├── device_info.py
│   │   └── server_params.py
│   └── gvar/              # Global variable management
│       ├── global_var_manager.py
│       ├── pyglobal_vars.py
│       └── ws_rpc_constants.py
│
└── pyutils/               # Utility tools and services
    ├── device_manager.py  # ✨ NEW: Centralized device manager
    ├── adb/              # ADB communication
    ├── api/              # FastAPI/WebSocket utilities
    ├── control/          # Device control (touch/key)
    ├── group/            # Group control algorithms
    ├── stream/           # Video streaming
    │   ├── h264_decoder.py
    │   ├── fmp4_encoder.py
    │   └── fmp4_encoder_complete.py  # ✨ NEW: Complete fMP4 implementation
    ├── web/              # Web GUI utilities
    └── wsrpc/            # WebSocket RPC framework
```

## 🏗️ Core Components

### 1. DeviceManager (pyutils.device_manager)

**Centralized device connection pool** used by all apps.

```python
from pycore.pyutils.device_manager import DeviceManager

# Get singleton instance
manager = DeviceManager.instance()

# List devices
devices = await manager.list_devices()

# Connect device
device = await manager.connect_device(serial, params)

# Get device (from any app)
device = manager.get_device(serial)

# Subscribe to events
manager.on_device_connected(lambda serial, info: print(f"Connected: {serial}"))
```

**Features**:
- Singleton pattern - one instance across all apps
- Device connection pool
- State management
- Event emission (connected, disconnected, error)
- Global variable storage (cross-app access)

### 2. EventBus (pyfoundations.event_bus)

**Cross-app communication** without tight coupling.

```python
from pycore.pyfoundations.event_bus import EventBus, EventTypes

bus = EventBus.instance()

# Subscribe to events
bus.subscribe(EventTypes.DEVICE_CONNECTED, on_device_connected)

# Emit events
await bus.emit(
    EventTypes.DEVICE_CONNECTED,
    source="pyMatrix",
    data={"serial": "ABC123"}
)
```

**Event Types**:
- `device.connected` - Device connected
- `device.disconnected` - Device disconnected
- `video.started` - Video stream started
- `control.touch` - Touch event
- `group.enabled` - Group control enabled
- Custom events...

### 3. FMP4Encoder (pyutils.stream)

**H.264 to fMP4 conversion** for MSE playback.

```python
from pycore.pyutils.stream.fmp4_encoder_complete import FMP4Encoder

encoder = FMP4Encoder(width=1080, height=2340, fps=60)

# Generate init segment (once)
init_segment = encoder.generate_init_segment(sps, pps)

# Generate media segments (per frame)
media_segment = encoder.generate_media_segment(frame_data, timestamp, is_keyframe)
```

**Features**:
- Complete fMP4 box structure
- MSE-compatible output
- Supports keyframes and P-frames
- Timestamp management

## 🔄 App Integration Pattern

### How Apps Use PyCore:

```
┌─────────────────────────────────────────────────┐
│             App Layer (pyMatrix)                │
│  - WebSocket routes                             │
│  - REST APIs                                    │
│  - App-specific logic                           │
│  - UI launcher                                  │
└──────────────────┬──────────────────────────────┘
                   │ Uses
                   ▼
┌─────────────────────────────────────────────────┐
│           PyCore (Core Library)                 │
│  - DeviceManager (singleton)                    │
│  - EventBus (cross-app)                         │
│  - FMP4Encoder                                  │
│  - ADBManager                                   │
│  - GroupController                              │
│  - TouchEvent, KeyEvent                         │
└─────────────────────────────────────────────────┘
```

### Example: pyMatrix Service Layer

```python
# OLD: App manages its own devices
class DeviceService:
    def __init__(self):
        self.devices = {}  # ❌ App-specific device pool

# NEW: App uses centralized device manager
class DeviceService:
    def __init__(self):
        self.device_manager = DeviceManager.instance()  # ✅ Shared device pool

    async def connect_device(self, serial):
        # Use centralized manager
        device = await self.device_manager.connect_device(serial)

        # Subscribe to events
        self.device_manager.on_device_error(self.handle_error)

        return device
```

## 🌟 Benefits

### 1. Data Centralization
- **Single source of truth** for device states
- Apps don't duplicate device management logic
- Consistent state across all apps

### 2. Cross-App Communication
- **EventBus** enables apps to communicate
- No tight coupling between apps
- Easy to add new apps

### 3. Code Reusability
- **80% of code** is in pycore (reusable)
- **20% of code** is in apps (app-specific)
- New apps can be created quickly

### 4. Extensibility
- Apps can **extend** pycore classes
- Add app-specific customizations
- Core functionality remains unchanged

### 5. Testing
- Core functionality tested once
- Apps only test their specific logic
- Easier to maintain

## 📝 Example: Creating a New App

To create a new app (e.g., `screencast`):

```python
# 1. Import pycore components
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyfoundations.event_bus import EventBus, EventTypes
from pycore.pyutils.stream.fmp4_encoder_complete import FMP4Encoder

# 2. Create app service
class ScreencastService:
    def __init__(self):
        self.device_manager = DeviceManager.instance()
        self.event_bus = EventBus.instance()

        # Subscribe to device events
        self.event_bus.subscribe(
            EventTypes.DEVICE_CONNECTED,
            self.on_device_connected
        )

    async def start_screencast(self, serial):
        # Get device from centralized manager
        device = self.device_manager.get_device(serial)

        # Use fMP4 encoder
        encoder = FMP4Encoder(width=1080, height=2340)

        # Stream video...

# 3. That's it! Core functionality is handled by pycore
```

## 🔧 Configuration

Apps can configure pycore components:

```python
from pycore.pyutils.device_manager import DeviceManager

manager = DeviceManager.instance()

# App-specific configuration
manager.on_device_connected(my_custom_handler)
manager.on_device_error(my_error_handler)
```

## 🎯 Guidelines

### Do's ✅
- Use `DeviceManager.instance()` for device access
- Emit events via `EventBus` for cross-app communication
- Extend pycore classes for customization
- Store shared data in `GlobalVarManager`

### Don'ts ❌
- Don't duplicate device management in apps
- Don't create app-specific device pools
- Don't bypass pycore for core functionality
- Don't tight-couple apps together

## 📊 Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                   Frontend Layer                      │
│  (Nuxt, React, Vue, etc.)                            │
└────────────────┬─────────────────────────────────────┘
                 │ WebSocket/REST
                 ▼
┌──────────────────────────────────────────────────────┐
│                    App Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │  pyMatrix  │  │ screencast │  │   Other    │     │
│  │  (routes)  │  │  (routes)  │  │   Apps     │     │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘     │
└─────────┼────────────────┼────────────────┼──────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │ Uses
                           ▼
┌──────────────────────────────────────────────────────┐
│                  PyCore Layer                         │
│  ┌──────────────────────────────────────────────┐   │
│  │  DeviceManager (Singleton)                   │   │
│  │  - Device connection pool                    │   │
│  │  - State management                          │   │
│  │  - Event emission                            │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  EventBus (Cross-app communication)          │   │
│  │  - device.*, video.*, control.*, group.*    │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Core Utilities                              │   │
│  │  - FMP4Encoder, ADBManager, GroupController │   │
│  │  - TouchEvent, KeyEvent, MessageBuilder     │   │
│  └──────────────────────────────────────────────┘   │
└────────────────┬─────────────────────────────────────┘
                 │ Controls
                 ▼
┌──────────────────────────────────────────────────────┐
│              Android Devices                          │
│  (via ADB + scrcpy-server)                           │
└──────────────────────────────────────────────────────┘
```

## 🚀 Migration Guide

For existing apps using app-specific device management:

### Before:
```python
class MyAppService:
    def __init__(self):
        self.devices = {}  # App-specific pool

    async def connect(self, serial):
        device = await self.create_device(serial)
        self.devices[serial] = device
```

### After:
```python
class MyAppService:
    def __init__(self):
        self.device_manager = DeviceManager.instance()  # Centralized pool

    async def connect(self, serial):
        device = await self.device_manager.connect_device(serial)
        # Device is now accessible from all apps!
```

---

**Status**: ✅ Centralized architecture implemented
**Ready for**: App migration and testing
**Benefits**: Code reusability, consistency, maintainability
