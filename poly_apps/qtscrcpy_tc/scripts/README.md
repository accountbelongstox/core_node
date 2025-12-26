# TcUi Build Scripts

**Qt 6.10 Build System** - Automated build and deployment scripts for TcUi project

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Build Instructions](#build-instructions)
- [Script Reference](#script-reference)
- [Qt 6.10 Upgrade Notes](#qt-610-upgrade-notes)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Windows
- **Qt 6.10.0** or later with MSVC compiler (64-bit)
- **Visual Studio 2019 or 2022** (MSVC compiler toolchain)
- **Windows 10 1809 or later** (Windows 11 recommended)

### Linux
- **Qt 6.10.0** or later with GCC
- **GCC 8.0 or later** (C++17 support required)
- **make** and standard build tools
- **Linux kernel 5.0+** recommended for PipeWire support

### macOS
- **Qt 6.10.0** or later with Clang
- **Xcode 11 or later** (Xcode Command Line Tools)
- **macOS 11 (Big Sur) or later** recommended

---

## Quick Start

### Windows

```cmd
# Open Qt Command Prompt (Qt 6.10.0 MSVC 2019 64-bit)
cd D:\programing\core_node\poly_apps\qtscrcpy_tc\scripts

# Build and deploy
build-windows.bat release
deploy-windows.bat release
```

### Linux

```bash
# Set Qt environment
export PATH=/opt/Qt/6.10.0/gcc_64/bin:$PATH

# Build
cd /path/to/qtscrcpy_tc/scripts
./build-linux.sh release
```

### macOS

```bash
# Set Qt environment
export PATH=~/Qt/6.10.0/macos/bin:$PATH

# Build
cd /path/to/qtscrcpy_tc/scripts
./build-macos.sh release
```

---

## Build Instructions

### Windows Platform

#### 1. Prepare Environment

```cmd
# Open Qt Command Prompt from Start Menu
# Search for "Qt 6.10.0 (MSVC 2019 64-bit)" or similar
```

#### 2. Build Application

```cmd
cd scripts
build-windows.bat [debug|release]
```

**Default**: `release`

**Output**: `TcUi/output/win/x64/[debug|release]/`

#### 3. Deploy Application

```cmd
deploy-windows.bat [debug|release]
```

**Output**: `deploy/win/x64/[debug|release]/TcUi/`

The deployment script automatically:
- Collects all Qt 6.10 dependencies via `windeployqt`
- Copies FFmpeg libraries for video decoding
- Copies ADB tools for Android connectivity
- Copies scrcpy-server for screen mirroring
- Creates README.txt and version.json
- Generates a portable, standalone package

---

### Linux Platform

#### 1. Install Qt 6.10

```bash
# Download from qt.io or use package manager
# Example for Ubuntu/Debian:
# sudo apt install qt6-base-dev qt6-multimedia-dev

# Or use Qt online installer
```

#### 2. Set Environment

```bash
export PATH=/opt/Qt/6.10.0/gcc_64/bin:$PATH
export LD_LIBRARY_PATH=/opt/Qt/6.10.0/gcc_64/lib:$LD_LIBRARY_PATH
```

#### 3. Build

```bash
cd scripts
chmod +x build-linux.sh
./build-linux.sh [debug|release]
```

**Output**: `TcUi/output/linux/[debug|release]/`

---

### macOS Platform

#### 1. Install Qt 6.10

```bash
# Download from qt.io
# Or use Homebrew:
# brew install qt@6
```

#### 2. Set Environment

```bash
export PATH=~/Qt/6.10.0/macos/bin:$PATH
```

#### 3. Build

```bash
cd scripts
chmod +x build-macos.sh
./build-macos.sh [debug|release]
```

**Output**: `TcUi/output/mac/[debug|release]/17_TcUi.app`

---

## Script Reference

### Build Scripts

#### `build-windows.bat`
- **Platform**: Windows
- **Function**: Compile TcUi using Qt 6.10 + MSVC
- **Features**:
  - Qt version verification
  - Compiler detection
  - Parallel build support
  - Error checking and reporting
  - Build verification

#### `build-linux.sh`
- **Platform**: Linux
- **Function**: Compile TcUi using Qt 6.10 + GCC/Clang
- **Features**:
  - Qt 6.10 version check
  - C++17 compiler verification
  - Multi-core parallel build
  - Dependency checking

#### `build-macos.sh`
- **Platform**: macOS
- **Function**: Compile TcUi using Qt 6.10 + Clang
- **Features**:
  - macOS version compatibility check
  - Xcode tools verification
  - App bundle creation
  - Code signing status check

### Deployment Scripts

#### `deploy-windows.bat`
- **Platform**: Windows
- **Function**: Create standalone deployment package
- **Includes**:
  - Qt 6.10 runtime libraries
  - FFmpeg codecs
  - ADB tools
  - scrcpy-server
  - Configuration files
  - Keymap profiles
  - README and version info

---

## Qt 6.10 Upgrade Notes

### Major Changes from Qt 5.15

This project has been upgraded from **Qt 5.15.2** to **Qt 6.10.0**.

#### C++ Standard
- **Old**: C++11
- **New**: C++17 (required)

#### API Changes
1. **High DPI Support**
   - Removed: `AA_EnableHighDpiScaling` (deprecated)
   - Qt 6 enables High DPI by default

2. **Deprecated APIs**
   - Disabled all APIs deprecated before Qt 6.10
   - Define: `QT_DISABLE_DEPRECATED_UP_TO=0x060A00`

3. **Code Changes**
   - All Chinese comments converted to English
   - All Chinese UI strings converted to English
   - Updated to Qt 6.10 best practices

#### Qt 6.10 New Features Used

1. **Enhanced Accessibility**
   - Built-in high-contrast mode support
   - Better integration with assistive technologies
   - Platform-specific contrast settings alignment

2. **Performance Improvements**
   - Optimized rendering pipeline
   - Better memory management
   - Faster startup times

3. **Platform Integration**
   - **Linux**: PipeWire audio backend support
   - **macOS**: Enhanced Retina display support
   - **Windows**: Windows 11 Snap Layout support

4. **Modern C++17 Features**
   - Structured bindings
   - Inline variables
   - `std::optional`, `std::variant`
   - Improved lambda expressions

### Compiler Requirements

| Platform | Minimum Version |
|----------|----------------|
| Windows  | Visual Studio 2019 (MSVC 19.20) |
| Linux    | GCC 8.0 or Clang 7.0 |
| macOS    | Xcode 11.0 (Clang 11.0) |

---

## Troubleshooting

### Common Issues

#### "qmake not found"

**Solution**:
- Ensure Qt 6.10 is installed
- Add Qt's bin directory to PATH
- On Windows, use Qt Command Prompt

```cmd
# Windows
set PATH=C:\Qt\6.10.0\msvc2019_64\bin;%PATH%

# Linux/macOS
export PATH=/opt/Qt/6.10.0/gcc_64/bin:$PATH
```

#### "C++17 not supported"

**Solution**: Update your compiler
- **Windows**: Install Visual Studio 2019 or later
- **Linux**: `sudo apt install g++-8` or later
- **macOS**: `xcode-select --install`

#### Qt Version Mismatch

**Symptoms**: Warning about Qt version not being 6.10

**Solution**:
- Verify Qt installation: `qmake -v`
- Ensure Qt 6.10 bin directory is first in PATH
- Remove conflicting Qt versions from PATH

#### FFmpeg/ADB Dependencies Missing

**Symptoms**: Build succeeds but deployment warnings

**Solution**: Ensure these directories exist:
```
TcUi/
  third_party/
    ffmpeg/
      bin/x64/        (Windows)
      lib/            (Linux/Mac)
    adb/
      win/            (Windows)
      linux/          (Linux)
      mac/            (macOS)
    scrcpy-server/
```

#### Build Fails on Windows

**Common causes**:
1. Not using MSVC-enabled Qt Command Prompt
2. Visual Studio MSVC compiler not installed
3. Missing Windows SDK

**Solution**:
```cmd
# Verify MSVC compiler
where cl

# If not found, open proper Qt Command Prompt:
# Start Menu → Qt 6.10.0 → MSVC 2019 64-bit
```

#### Linux: Missing PipeWire Support

**Symptoms**: Warning about PipeWire not available

**Solution** (optional, for audio features):
```bash
# Ubuntu/Debian
sudo apt install libpipewire-0.3-dev

# Fedora
sudo dnf install pipewire-devel
```

#### macOS: Code Signing Errors

**Symptoms**: App won't run or security warnings

**Solution**:
```bash
# Allow unsigned apps (development only)
xattr -dr com.apple.quarantine output/mac/release/17_TcUi.app

# Or sign the app
codesign --sign - --force --deep output/mac/release/17_TcUi.app
```

---

## Additional Resources

### Documentation
- [Qt 6.10 Release Notes](https://www.qt.io/blog/qt-6.10-released)
- [Qt 6 Documentation](https://doc.qt.io/qt-6/)
- [Qt 6 Porting Guide](https://doc.qt.io/qt-6/portingguide.html)
- [C++17 Features](https://en.cppreference.com/w/cpp/17)

### Original Projects
- [QtScrcpy](https://github.com/barry-ran/QtScrcpy) - Original Android screen mirroring project
- [scrcpy](https://github.com/Genymobile/scrcpy) - Screen mirroring technology

### Support
- **Issues**: Report build problems via GitHub Issues
- **Qt Forum**: [Qt Forum](https://forum.qt.io/)
- **Stack Overflow**: Tag questions with `qt6`, `qt-creator`

---

## License

This project is based on QtScrcpy. See LICENSE file for details.

**Copyright © 2025**

---

## Changelog

### Version 2.0.0 - Qt 6.10 Upgrade (2025-12-19)

**Major Changes**:
- ✅ Upgraded from Qt 5.15.2 to Qt 6.10.0
- ✅ Upgraded from C++11 to C++17
- ✅ Converted all code to English (comments and UI strings)
- ✅ Rewritten build scripts with Qt 6.10 optimizations
- ✅ Enhanced deployment automation
- ✅ Improved error handling and validation

**Technical Improvements**:
- Automatic Qt version detection
- Compiler compatibility checking
- Parallel build support
- Comprehensive logging
- Standalone deployment packages

**Platform Support**:
- Windows 10/11 (64-bit)
- Linux (GCC 8+, Clang 7+)
- macOS 11+ (Apple Silicon & Intel)

---

**Last Updated**: 2025-12-19
**Qt Version**: 6.10.0
**Build System**: qmake + platform-native compilers
