# pyMatrix - Python Android Screen Mirroring & Control System

A Python implementation of Android device screen mirroring and multi-device group control system, based on the SmartMatrix (C++/Qt) architecture.

## Features

- 📱 **Screen Mirroring**: Real-time Android screen mirroring via USB or WiFi
- 🎮 **Device Control**: Full mouse/keyboard control support
- 🔀 **Group Control**: Control multiple devices simultaneously
- ⚡ **High Performance**: Hardware-accelerated decoding and rendering
- 🌐 **Cross-Platform**: Windows, macOS, Linux support
- 🎯 **Custom Keymaps**: Game-specific key mapping support

## Technical Stack

- **GUI**: PyQt6
- **Video Decoding**: PyAV (FFmpeg)
- **Rendering**: OpenGL
- **ADB Communication**: subprocess + adb-shell
- **Multi-threading**: threading + queue

## Architecture

Based on SmartMatrix C++ implementation with Python optimizations:

```
pyMatrix/
├── core/               # Core modules
│   ├── adb/           # ADB communication
│   ├── device/        # Device management
│   ├── stream/        # Video streaming
│   ├── control/       # Device control
│   ├── render/        # OpenGL rendering
│   └── group/         # Group control
├── ui/                # User interface
├── utils/             # Utilities
└── resources/         # Resources (scrcpy-server.jar, adb)
```

## Requirements

- Python 3.11+
- Android device with USB debugging enabled
- FFmpeg libraries
- OpenGL support

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run application
python main.py
```

## Usage

### Basic Mirroring

```python
from core.device.device_manager import DeviceManager
from core.device.device_params import ServerParams

# Configure server parameters
params = ServerParams(
    serial="ABC123DEF456",
    max_size=720,
    bit_rate=8000000,
    max_fps=60
)

# Connect device
device_manager = DeviceManager.instance()
device_manager.connect_device(params)
```

### Group Control

```python
from core.group.group_controller import GroupController

# Add devices to group
group = GroupController.instance()
group.add_device("ABC123DEF456")  # Host device
group.add_device("GHI789JKL012")  # Slave device 1
group.add_device("MNO345PQR678")  # Slave device 2
```

## Technical Highlights

### ADB Communication

- USB and WiFi connection support
- Forward/Reverse tunneling modes
- Automatic device discovery

### Video Streaming

- H.264 hardware encoding (Android side)
- FFmpeg software/hardware decoding (PC side)
- Low latency (~30-70ms)

### OpenGL Rendering

- GPU-accelerated YUV→RGB conversion
- Hardware texture upload
- High FPS support (60fps+)

### Group Control

- Observer pattern for event broadcasting
- Coordinate mapping for different resolutions
- Up to 1000 devices theoretical support

## Performance

| Configuration | Resolution | FPS | Latency | CPU Usage |
|--------------|-----------|-----|---------|-----------|
| USB 1080p    | 1920x1080 | 60  | ~30ms   | ~15%      |
| WiFi 1080p   | 1920x1080 | 60  | ~70ms   | ~15%      |
| USB 720p     | 1280x720  | 60  | ~25ms   | ~8%       |

## Development

### Project Structure

See [pyMatrix技术方案设计.md](pyMatrix技术方案设计.md) for detailed architecture design.

### Reference

This project strictly follows the SmartMatrix C++ implementation:

- [SmartMatrix技术分析文档.md](../SmartMatrix/SmartMatrix技术分析文档.md)
- [SmartMatrix多设备群控技术补充文档.md](../SmartMatrix/SmartMatrix多设备群控技术补充文档.md)

## License

Same as SmartMatrix (check original project)

## Credits

- Based on [SmartMatrix](https://github.com/barry-ran/QtScrcpy) (C++/Qt)
- Uses [scrcpy-server](https://github.com/Genymobile/scrcpy) for Android side
- Built with [PyAV](https://github.com/PyAV-Org/PyAV), [PyQt6](https://www.riverbankcomputing.com/software/pyqt/)
