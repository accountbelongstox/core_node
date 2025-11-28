# pyutils.device - Device Management and ADB Utilities

## Overview

The `device` module provides unified device management for Android devices, including ADB communication, scrcpy integration, and device lifecycle management. It supports both USB and wireless device connections.

## Module Location

```
pycore/pyutils/device/
├── __init__.py
├── device_info.py          # DeviceInfo, Resolution
├── server_params.py        # ServerParams, VideoCodec
├── android_device.py       # AndroidDevice base class
├── scrcpy_device.py        # ScrcpyDevice implementation
├── adb_manager.py          # ADBManager singleton
├── adb_device.py           # ADBDevice class
├── adb_commands.py         # ADB command utilities
├── adb_types.py            # ADB type definitions
└── adb_exceptions.py       # Exception classes
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Device Management                        │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   ADBManager    │  │   DeviceInfo    │                  │
│  │  (singleton)    │  │   Resolution    │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  ADBDevice                           │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ execute_shell() | push() | pull() | install() │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               ScrcpyDevice                           │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ start_server() | get_frame() | click()     │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### DeviceInfo

Device information container:

```python
from pycore.pyutils.device import DeviceInfo, Resolution

# Create device info
device_info = DeviceInfo(
    serial="192.168.1.100:5555",
    model="SM-G973F",
    manufacturer="samsung",
    android_version="11",
    sdk_version=30,
    resolution=Resolution(1080, 2400)
)

print(f"Device: {device_info.model}")
print(f"Resolution: {device_info.resolution.width}x{device_info.resolution.height}")
```

**Resolution Class:**

```python
@dataclass
class Resolution:
    width: int
    height: int
    
    @property
    def aspect_ratio(self) -> float:
        return self.width / self.height
    
    def scale_to_width(self, target_width: int) -> 'Resolution':
        """Scale resolution maintaining aspect ratio"""
        scale = target_width / self.width
        return Resolution(target_width, int(self.height * scale))
```

### ServerParams

Scrcpy server parameters:

```python
from pycore.pyutils.device import ServerParams, VideoCodec

params = ServerParams(
    max_size=1920,
    bit_rate=8000000,
    max_fps=60,
    video_codec=VideoCodec.H264,
    tunnel_forward=True,
    crop=None,
    control=True,
    display_id=0,
    show_touches=False,
    stay_awake=True,
    power_off_on_close=False,
    clipboard_autosync=True,
    downsize_on_error=True
)
```

**VideoCodec Enum:**

```python
class VideoCodec(Enum):
    H264 = "h264"
    H265 = "h265"
    AV1 = "av1"
```

### ADBManager

Singleton ADB manager:

```python
from pycore.pyutils.device import ADBManager

# List connected devices
devices = ADBManager.list_devices()
for device in devices:
    print(f"Serial: {device.serial}, State: {device.state}")

# Get device info
info = ADBManager.get_device_info("192.168.1.100:5555")

# Connect wireless device
success = ADBManager.connect("192.168.1.100", port=5555)

# Disconnect device
ADBManager.disconnect("192.168.1.100:5555")

# Kill ADB server
ADBManager.kill_server()

# Start ADB server
ADBManager.start_server()
```

**Available Methods:**

```python
class ADBManager:
    @staticmethod
    def list_devices() -> List[ADBDeviceBasic]:
        """List all connected devices"""
    
    @staticmethod
    def get_device_info(serial: str) -> DeviceInfo:
        """Get detailed device information"""
    
    @staticmethod
    def connect(ip: str, port: int = 5555) -> bool:
        """Connect to wireless device"""
    
    @staticmethod
    def disconnect(serial: str) -> bool:
        """Disconnect device"""
    
    @staticmethod
    def kill_server() -> bool:
        """Kill ADB server"""
    
    @staticmethod
    def start_server() -> bool:
        """Start ADB server"""
    
    @staticmethod
    def get_adb_path() -> str:
        """Get ADB executable path"""
```

### ADBDevice

Device-specific ADB operations:

```python
from pycore.pyutils.device import ADBDevice

device = ADBDevice(serial="192.168.1.100:5555")

# Execute shell command
result = device.execute_shell("ls /sdcard/")
print(result.stdout)

# Push file to device
device.push("/local/file.txt", "/sdcard/file.txt")

# Pull file from device
device.pull("/sdcard/file.txt", "/local/file.txt")

# Install APK
device.install("/path/to/app.apk", reinstall=True)

# Uninstall package
device.uninstall("com.example.app")

# Get package list
packages = device.list_packages()

# Get screen resolution
resolution = device.get_resolution()

# Get battery info
battery = device.get_battery_info()
print(f"Battery: {battery.level}%, Charging: {battery.charging}")

# Take screenshot
device.screenshot("/local/screenshot.png")

# Input tap
device.input_tap(500, 500)

# Input swipe
device.input_swipe(100, 500, 900, 500, duration_ms=300)

# Input text
device.input_text("Hello World")

# Input keycode
device.input_keycode(4)  # KEYCODE_BACK
```

**ADBExecuteResult:**

```python
@dataclass
class ADBExecuteResult:
    success: bool
    stdout: str
    stderr: str
    return_code: int
    duration_ms: float
```

### ScrcpyDevice

Scrcpy-based device control:

```python
from pycore.pyutils.device import ScrcpyDevice, ServerParams

# Create device with default params
device = ScrcpyDevice(
    serial="192.168.1.100:5555",
    params=ServerParams(max_size=1920, bit_rate=8000000)
)

# Start scrcpy server
device.start_server()

# Get video frame (numpy array)
frame = device.get_frame()
if frame is not None:
    print(f"Frame shape: {frame.shape}")

# Control methods
device.click(500, 500)
device.swipe(100, 500, 900, 500)
device.key(4)  # KEYCODE_BACK
device.text("Hello")

# Touch control
device.touch_down(500, 500, pointer_id=0)
device.touch_move(600, 600, pointer_id=0)
device.touch_up(pointer_id=0)

# Get device info
info = device.get_device_info()
print(f"Model: {info.model}")
print(f"Resolution: {info.resolution}")

# Stop server
device.stop_server()
```

**ScrcpyDevice Methods:**

```python
class ScrcpyDevice:
    def start_server(self) -> bool:
        """Start scrcpy server on device"""
    
    def stop_server(self):
        """Stop scrcpy server"""
    
    def get_frame(self) -> Optional[np.ndarray]:
        """Get current video frame as numpy array"""
    
    def click(self, x: int, y: int):
        """Simulate touch click"""
    
    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300):
        """Simulate swipe gesture"""
    
    def key(self, keycode: int):
        """Send key event"""
    
    def text(self, text: str):
        """Input text"""
    
    def touch_down(self, x: int, y: int, pointer_id: int = 0):
        """Touch down event"""
    
    def touch_move(self, x: int, y: int, pointer_id: int = 0):
        """Touch move event"""
    
    def touch_up(self, pointer_id: int = 0):
        """Touch up event"""
    
    def get_device_info(self) -> DeviceInfo:
        """Get device information"""
    
    def is_connected(self) -> bool:
        """Check if device is connected"""
```

## Exception Classes

```python
from pycore.pyutils.device import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)

try:
    device = ADBDevice(serial="invalid_serial")
    device.execute_shell("ls")
except DeviceNotFoundException as e:
    print(f"Device not found: {e}")
except ADBCommandFailedException as e:
    print(f"Command failed: {e.command}, Error: {e.stderr}")
except ADBException as e:
    print(f"ADB error: {e}")
```

## Type Definitions

```python
from pycore.pyutils.device import (
    ADBDeviceState,
    ADBConnectionType,
    ADBDeviceBasic,
    ADBExecuteResult,
    ADBDeviceProperties,
    ADBDeviceBattery,
    ADBForwardSpec
)

# Device state
class ADBDeviceState(Enum):
    DEVICE = "device"
    OFFLINE = "offline"
    UNAUTHORIZED = "unauthorized"
    BOOTLOADER = "bootloader"
    RECOVERY = "recovery"
    SIDELOAD = "sideload"

# Connection type
class ADBConnectionType(Enum):
    USB = "usb"
    TCP = "tcp"

# Basic device info (from adb devices)
@dataclass
class ADBDeviceBasic:
    serial: str
    state: ADBDeviceState
    connection_type: ADBConnectionType

# Battery info
@dataclass
class ADBDeviceBattery:
    level: int
    charging: bool
    usb: bool
    ac: bool
    wireless: bool
    temperature: float
```

## Usage Examples

### Device Discovery

```python
from pycore.pyutils.device import ADBManager, ADBDevice

# List all devices
devices = ADBManager.list_devices()
print(f"Found {len(devices)} device(s)")

for device_basic in devices:
    if device_basic.state == ADBDeviceState.DEVICE:
        # Get full info
        device = ADBDevice(device_basic.serial)
        info = device.get_device_info()
        print(f"  {info.model} ({info.serial})")
```

### Wireless Connection

```python
from pycore.pyutils.device import ADBManager

# Ensure device is connected via USB first
# Then get device IP (device must be on same network)

# Enable TCP/IP on device
device = ADBDevice("USB_SERIAL")
device.execute_shell("setprop service.adb.tcp.port 5555")
device.execute_shell("stop adbd")
device.execute_shell("start adbd")

# Connect wirelessly
ADBManager.connect("192.168.1.100", port=5555)
```

### Screen Mirroring

```python
from pycore.pyutils.device import ScrcpyDevice, ServerParams
import cv2

device = ScrcpyDevice(
    serial="192.168.1.100:5555",
    params=ServerParams(max_size=1280, bit_rate=4000000)
)

device.start_server()

try:
    while True:
        frame = device.get_frame()
        if frame is not None:
            cv2.imshow("Device", frame)
        
        key = cv2.waitKey(1)
        if key == ord('q'):
            break
        elif key == ord('c'):
            # Click center
            h, w = frame.shape[:2]
            device.click(w // 2, h // 2)
finally:
    device.stop_server()
    cv2.destroyAllWindows()
```

### Automation Script

```python
from pycore.pyutils.device import ADBDevice
import time

device = ADBDevice("192.168.1.100:5555")

# Open app
device.execute_shell("am start -n com.example.app/.MainActivity")
time.sleep(2)

# Tap button at coordinates
device.input_tap(500, 800)
time.sleep(1)

# Enter text
device.input_text("search query")
time.sleep(0.5)

# Press Enter
device.input_keycode(66)  # KEYCODE_ENTER
time.sleep(2)

# Take screenshot
device.screenshot("/sdcard/result.png")
device.pull("/sdcard/result.png", "result.png")

# Press Back
device.input_keycode(4)  # KEYCODE_BACK
```

## Best Practices

1. **Check Device State**: Always verify device is in "device" state before operations

2. **Handle Disconnections**: Wrap operations in try-except for connection issues

3. **Use Appropriate Timeouts**: Set reasonable timeouts for long operations

4. **Clean Up Resources**: Call `stop_server()` when done with ScrcpyDevice

5. **Prefer Wireless**: Use TCP connection for better stability in automation

## Related Modules

- `pycore.pyutils.control` - Touch and key event generation
- `pycore.pyctl.pybrowserauto` - Web automation
- `pycore.pyutils.image_tools` - Image processing for screenshots

## Exports

```python
__all__ = [
    # Device abstractions
    'DeviceInfo', 'Resolution', 'VideoCodec', 'ServerParams',
    'AndroidDevice', 'ScrcpyDevice',
    
    # ADB utilities
    'ADBManager', 'ADBDevice',
    'ADBException', 'DeviceNotFoundException', 'ADBCommandFailedException',
    
    # Types (if available)
    'ADBDeviceState', 'ADBConnectionType', 'ADBDeviceBasic',
    'ADBExecuteResult', 'ADBDeviceProperties', 'ADBDeviceBattery',
    'ADBForwardSpec',
]

__version__ = '2.0.0'
```

