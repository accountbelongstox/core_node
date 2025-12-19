# TcUi Build Scripts

This directory contains build and deployment scripts for the TcUi project.

## Prerequisites

### Windows
- **Qt 6.9** with MSVC compiler (64-bit)
- **Visual Studio 2019 or later** (for MSVC compiler)
- **CMake** (optional, for alternative build)

### Linux
- **Qt 6.9** with GCC
- **GCC 8.0 or later** (C++17 support required)
- **make**

### macOS
- **Qt 6.9** with Clang
- **Xcode Command Line Tools**
- **macOS 10.15 or later**

## Build Instructions

### Windows

1. Open **Qt Command Prompt** (e.g., "Qt 6.9.0 (MSVC 2019 64-bit)" from Start Menu)
2. Navigate to the scripts directory:
   ```cmd
   cd D:\programing\core_node\poly_apps\qtscrcpy_tc\scripts
   ```
3. Run the build script:
   ```cmd
   build-windows.bat [debug|release]
   ```
   Default: `release`

4. (Optional) Deploy the application:
   ```cmd
   deploy-windows.bat [debug|release]
   ```

**Output Locations:**
- Build: `TcUi/output/win/x64/[debug|release]/`
- Deploy: `deploy/win/x64/[debug|release]/`

### Linux

1. Ensure Qt 6.9 is in your PATH:
   ```bash
   export PATH=/opt/Qt/6.9.0/gcc_64/bin:$PATH
   ```

2. Navigate to the scripts directory:
   ```bash
   cd /path/to/core_node/poly_apps/qtscrcpy_tc/scripts
   ```

3. Make the script executable:
   ```bash
   chmod +x build-linux.sh
   ```

4. Run the build script:
   ```bash
   ./build-linux.sh [debug|release]
   ```
   Default: `release`

**Output Location:**
- `TcUi/output/linux/[debug|release]/`

### macOS

1. Ensure Qt 6.9 is in your PATH:
   ```bash
   export PATH=~/Qt/6.9.0/macos/bin:$PATH
   ```

2. Navigate to the scripts directory:
   ```bash
   cd /path/to/core_node/poly_apps/qtscrcpy_tc/scripts
   ```

3. Make the script executable:
   ```bash
   chmod +x build-macos.sh
   ```

4. Run the build script:
   ```bash
   ./build-macos.sh [debug|release]
   ```
   Default: `release`

**Output Location:**
- `TcUi/output/mac/[debug|release]/`

## Scripts Overview

### Build Scripts
- **build-windows.bat** - Compiles the project on Windows using MSVC
- **build-linux.sh** - Compiles the project on Linux using GCC
- **build-macos.sh** - Compiles the project on macOS using Clang

### Deployment Scripts
- **deploy-windows.bat** - Creates a standalone package for Windows with all dependencies

## Qt 6.9 Upgrade Notes

This project has been upgraded from Qt 5.15.2 to Qt 6.9. Key changes:

1. **C++ Standard**: Upgraded from C++11 to C++17
2. **High DPI**: `AA_EnableHighDpiScaling` removed (enabled by default in Qt 6)
3. **Deprecated APIs**: Disabled deprecated APIs up to Qt 6.9
4. **Compiler Requirements**:
   - Windows: MSVC 2019 or later
   - Linux: GCC 8.0 or later
   - macOS: Xcode 11 or later

## Troubleshooting

### "qmake not found"
- Ensure Qt 6.9 is installed
- Add Qt's bin directory to your PATH
- On Windows, use Qt Command Prompt

### "C++17 not supported"
- Update your compiler:
  - Windows: Install Visual Studio 2019 or later
  - Linux: Install GCC 8.0 or later
  - macOS: Update Xcode Command Line Tools

### FFmpeg/ADB dependencies missing
- Ensure `third_party/` directory contains:
  - `ffmpeg/bin/x64/` (Windows) or `ffmpeg/lib/` (Linux/Mac)
  - `adb/win/`, `adb/linux/`, or `adb/mac/`
  - `scrcpy-server/`

### Build fails on Windows
- Ensure you're using the correct Qt Command Prompt (MSVC, not MinGW)
- Check that Visual Studio MSVC compiler is installed
- Try cleaning the build: delete `Makefile` and `output/` directory

## Additional Resources

- **Original QtScrcpy**: https://github.com/barry-ran/QtScrcpy
- **Qt Documentation**: https://doc.qt.io/qt-6/
- **Qt 6 Porting Guide**: https://doc.qt.io/qt-6/portingguide.html

## License

This project is based on QtScrcpy. Please refer to the original project's license.
