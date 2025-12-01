# QtScrcpy Upgrade Plan Report

**Document Version**: v1.0
**Date**: 2025-10-13
**Project**: qtscrcpy_tc Upgrade to NewQtScrcpy

---

## Executive Summary

This report analyzes the integration approach of the legacy qtscrcpy_tc project, compares it with the architecture and feature improvements of the new NewQtScrcpy, and provides detailed upgrade plans and risk assessments.

**Key Findings**:
- Legacy version uses qmake build system, new version uses CMake
- New version introduces modular architecture (QtScrcpyCore core library)
- New version adds audio forwarding, improved logging system, and other features
- Upgrade requires refactoring build system and some custom features

---

## Part 1: Legacy qtscrcpy_tc Integration Analysis

### 1.1 Project Overview

qtscrcpy_tc is TC software developed based on the open-source QtScrcpy project, designed to meet the following requirements:
- Support connecting 100 phones (group control)
- Phone screen mirroring and control
- Batch APK installation
- Chinese input method support
- Script execution
- USB direct connection

### 1.2 Technical Architecture

#### 1.2.1 Build System
```
Build Tool: qmake
Config File: 17_TcUi.pro (now renamed to SmartMatrix)
Qt Version: Qt 6.x (tested with Qt 6.9.3)
Compiler: MSVC 2019 (Windows) / GCC (Linux) / Clang (macOS)
C++ Standard: C++17
```

#### 1.2.2 Directory Structure
```
qtscrcpy_tc/
├── TcUi/                          # Main program directory
│   ├── adb/                       # ADB process management
│   ├── common/                    # Common code
│   ├── device/                    # Device core module
│   │   ├── controller/            # Controller (input, receiver)
│   │   ├── decoder/               # Video decoder
│   │   ├── recorder/              # Recording functionality
│   │   ├── render/                # OpenGL rendering
│   │   ├── server/                # TCP server
│   │   ├── stream/                # Video stream processing
│   │   └── ui/                    # Device UI (toolform, videoform)
│   ├── devicemanage/              # Device manager
│   ├── groupmanage/               # Group management (TC custom)
│   │   ├── customtreewidget/      # Custom tree widget
│   │   └── devicegroups/          # Device groups
│   ├── fontawesome/               # Font icons
│   ├── uibase/                    # UI base components
│   ├── util/                      # Utilities
│   ├── third_party/               # Third-party dependencies
│   │   ├── adb/                   # Android Debug Bridge
│   │   ├── ffmpeg/                # Video codec library
│   │   └── scrcpy-server          # Android-side service
│   ├── server/                    # Android-side Java code
│   ├── main.cpp                   # Program entry point
│   ├── mainwindow.cpp/h/ui        # Main window (displays "Brilliant Media - Smart Cloud Matrix")
│   └── dialog.cpp/h/ui            # Dialog
├── config/                        # Configuration files
├── docs/                          # Documentation
└── output/                        # Build output
```

#### 1.2.3 Core Module Functions

| Module | Function Description |
|--------|---------------------|
| **adb/** | ADB command execution, device connection management |
| **device/controller/** | Keyboard/mouse input conversion, touch event mapping |
| **device/decoder/** | FFmpeg video decoding, frame buffer management |
| **device/render/** | OpenGL YUV rendering |
| **device/server/** | TCP video stream reception |
| **devicemanage/** | Multi-device management, port allocation |
| **groupmanage/** | Device grouping, tree display (TC custom) |

#### 1.2.4 Dependencies

```
Qt Modules:
- Qt6::Core
- Qt6::Gui
- Qt6::Widgets
- Qt6::Network
- Qt6::OpenGL
- Qt6::OpenGLWidgets

Third-party Libraries:
- FFmpeg (avcodec, avformat, avutil, swscale)
- ADB (Android Debug Bridge)
- scrcpy-server (Android-side service)
```

### 1.3 Integration Features

#### 1.3.1 Embedded Integration
- All QtScrcpy core code directly integrated in TcUi project
- Uses `.pri` files to organize submodules
- No independent core library, high code coupling

#### 1.3.2 Custom Features
1. **Device Group Management** (`groupmanage/`)
   - Custom tree widget `CustomTreeWidget`
   - Device group JSON configuration
   - Supports drag-and-drop, context menu

2. **Multi-Window Integration**
   - Main window integrates multiple phone screen displays
   - Scaling adaptation (up to 96 windows)
   - Supports enlarging one, shrinking others

3. **Group Control Function**
   - Unified control command sending
   - Batch operation support

---

## Part 2: New NewQtScrcpy Architecture Analysis

### 2.1 Project Overview

NewQtScrcpy is the latest version of QtScrcpy, adopting a more modern architectural design.

### 2.2 Technical Architecture

#### 2.2.1 Build System
```
Build Tool: CMake (>= 3.19)
Qt Version: Qt 5.12+ / Qt 6.x
C++ Standard: C++11
Supported Platforms: Windows, macOS, Linux
```

#### 2.2.2 Directory Structure
```
NewQtScrcpy/
├── QtScrcpy/                      # Main application
│   ├── QtScrcpyCore/              # Core library (submodule/independent library)
│   ├── audio/                     # Audio output (new)
│   ├── fontawesome/               # Font icons
│   ├── groupcontroller/           # Group controller (new)
│   ├── render/                    # OpenGL rendering
│   ├── ui/                        # UI interface
│   │   ├── dialog.cpp/h/ui        # Main dialog
│   │   ├── toolform.cpp/h/ui      # Toolbar
│   │   └── videoform.cpp/h/ui     # Video window
│   ├── uibase/                    # UI base components
│   ├── util/                      # Utilities
│   ├── sndcpy/                    # Audio forwarding (new)
│   ├── res/                       # Resource files
│   ├── main.cpp                   # Program entry point
│   └── CMakeLists.txt             # CMake configuration
├── ci/                            # CI/CD scripts
├── config/                        # Configuration files
├── docs/                          # Documentation
├── keymap/                        # Key mapping
└── CMakeLists.txt                 # Root CMake configuration
```

#### 2.2.3 Architecture Improvements

1. **Modular Design**
   - `QtScrcpyCore`: Independent core library (possibly Git submodule)
   - Decoupling of application layer and core layer
   - Easy to reuse and maintain

2. **New Features**
   - `audio/`: Audio output support
   - `groupcontroller/`: Group controller
   - `sndcpy/`: Audio forwarding tool (Android 10+)

3. **Improved Logging System**
   - Supports detailed log mode (filename + line number)
   - Configurable log levels
   - Better log filtering

4. **Internationalization Support**
   - Chinese (zh_CN)
   - English (en_US)
   - Japanese (ja_JP)

---

## Part 3: New vs Old Version Comparison

### 3.1 Build System Comparison

| Item | Legacy qtscrcpy_tc | New NewQtScrcpy |
|------|-------------------|------------------|
| Build Tool | qmake | CMake |
| Config Files | .pro + .pri | CMakeLists.txt |
| Module Organization | include subprojects | add_subdirectory |
| Version Management | version.txt + qmake variables | appversion file + CMake |
| Cross-platform Support | Complex | Simpler |
| IDE Support | Qt Creator | Qt Creator / VS / CLion |

### 3.2 Architecture Comparison

| Item | Legacy qtscrcpy_tc | New NewQtScrcpy |
|------|-------------------|------------------|
| Core Library | Embedded integration | Independent QtScrcpyCore library |
| Code Coupling | High | Low (modular) |
| Directory Structure | Deep nesting (device/*) | Flatter |
| Custom UI | CustomTreeWidget | groupcontroller |
| Entry Point | MainWindow | Dialog |

### 3.3 Feature Comparison

| Feature | Legacy qtscrcpy_tc | New NewQtScrcpy | Notes |
|---------|-------------------|------------------|-------|
| Device Mirroring | ✅ | ✅ | |
| Keyboard/Mouse Control | ✅ | ✅ | |
| Key Mapping | ✅ | ✅ | |
| Screen Recording | ✅ | ✅ | |
| Screenshot | ✅ | ✅ | |
| Wireless Connection | ✅ | ✅ | |
| Multi-device Connection | ✅ | ✅ | |
| **Audio Forwarding** | ❌ | ✅ | New feature |
| **Device Group Management** | ✅ (TC custom) | ❌ | Legacy feature |
| **Custom Tree Widget** | ✅ (TC custom) | ❌ | Legacy feature |
| **Group Control** | ✅ (deeply integrated) | ✅ (groupcontroller) | Different implementation |
| **Multi-window Integration** | ✅ (TC custom) | ❌ | Legacy feature |
| **Logging System** | Basic | Enhanced | New version improved |
| **Multi-language Support** | Chinese/English | Chinese/English/Japanese | |

### 3.4 Dependencies Comparison

| Dependency | Legacy qtscrcpy_tc | New NewQtScrcpy |
|-----------|-------------------|------------------|
| Qt Version | Qt 6.x | Qt 5.12+ / Qt 6.x |
| FFmpeg | ✅ | ✅ (possibly built into Core) |
| ADB | ✅ (third_party) | ✅ (in Core) |
| scrcpy-server | ✅ (third_party) | ✅ (in Core) |
| sndcpy | ❌ | ✅ (new) |

---

## Part 4: Upgrade Plan

### 4.1 Upgrade Strategy

Considering the many TC custom features (device grouping, multi-window integration) in the legacy version, we recommend a **gradual upgrade** strategy:

#### Strategy A: Hybrid Architecture (Recommended)
**Retain TC custom features + Introduce new core**

```
qtscrcpy_tc/
├── TcUi/
│   ├── NewQtScrcpyCore/          # New core library (Git submodule)
│   ├── groupmanage/              # Keep TC custom grouping
│   ├── tcui/                     # TC custom UI
│   ├── ...
```

**Advantages**:
- Retain TC custom features
- Gain new core improvements
- Lower upgrade risk

**Disadvantages**:
- Maintain two codebases
- Need interface adaptation

#### Strategy B: Complete Migration
**Migrate to new architecture, re-implement TC features**

**Advantages**:
- Gain all new improvements
- More modern codebase
- Lower long-term maintenance cost

**Disadvantages**:
- Large workload
- Need complete retesting
- Higher upgrade risk

### 4.2 Detailed Upgrade Steps (Strategy A - Recommended)

#### Phase 1: Preparation (1-2 days)

**Task List**:
- [ ] Backup current qtscrcpy_tc project
- [ ] Create upgrade branch `upgrade-new-qtscrcpy`
- [ ] Analyze NewQtScrcpy QtScrcpyCore interface
- [ ] Develop detailed integration plan

**Deliverables**:
- Project backup
- Interface documentation
- Integration plan document

#### Phase 2: Build System Migration (2-3 days)

**2.1 Introduce CMake**

1. Create `CMakeLists.txt` in project root:
```cmake
cmake_minimum_required(VERSION 3.19 FATAL_ERROR)
project(SmartMatrix VERSION 1.0.0 LANGUAGES CXX)

# Qt setup
find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets Network OpenGL OpenGLWidgets)

# Include NewQtScrcpy core library
add_subdirectory(TcUi/NewQtScrcpyCore)

# TcUi main program
add_subdirectory(TcUi)
```

2. Create `TcUi/CMakeLists.txt`:
```cmake
# Source files
set(TC_SOURCES
    main.cpp
    mainwindow.cpp
    dialog.cpp
    # ... other source files
)

# Submodules
add_subdirectory(groupmanage)
add_subdirectory(adb)
add_subdirectory(devicemanage)
# ...

# Executable
add_executable(SmartMatrix ${TC_SOURCES})

# Link libraries
target_link_libraries(SmartMatrix PRIVATE
    Qt6::Core
    Qt6::Widgets
    Qt6::Network
    Qt6::OpenGL
    Qt6::OpenGLWidgets
    QtScrcpyCore  # New core library
    # ... TC custom modules
)
```

**2.2 Keep qmake Support (Optional)**
- Maintain both `.pro` and `CMakeLists.txt` during transition
- Easier rollback and comparison testing

#### Phase 3: Core Library Integration (3-5 days)

**3.1 Introduce QtScrcpyCore**

Method 1: Git Submodule
```bash
cd qtscrcpy_tc/TcUi
git submodule add <NewQtScrcpy-Core-URL> NewQtScrcpyCore
git submodule update --init --recursive
```

Method 2: Direct Copy (if no Git repository)
```bash
cp -r NewQtScrcpy/QtScrcpy/QtScrcpyCore qtscrcpy_tc/TcUi/
```

**3.2 Interface Adaptation**

Modules needing adaptation:
```
device/          → Use QtScrcpyCore instead
├── controller/  → Interface adaptation
├── decoder/     → Interface adaptation
├── server/      → Interface adaptation
└── stream/      → Interface adaptation
```

Example adaptation code:
```cpp
// Legacy code
#include "device/device.h"
Device* device = new Device();
device->connectDevice(serial);

// New adapted code
#include "QtScrcpyCore/device.h"
qsc::Device* device = new qsc::Device();
device->connectTo(serial);
```

**3.3 Keep TC Custom Modules**

Modules that don't need modification:
```
groupmanage/     ✅ Keep unchanged
├── customtreewidget/
└── devicegroups/
```

#### Phase 4: Feature Integration (3-5 days)

**4.1 Integrate devicemanage**

```cpp
// devicemanage.cpp adaptation example
#include "QtScrcpyCore/devicemanager.h"

// Use new device manager
m_coreDeviceManager = new qsc::DeviceManager();

// Connect signals
connect(m_coreDeviceManager, &qsc::DeviceManager::deviceConnected,
        this, &DeviceManage::onDeviceConnected);

// TC custom: group management
void DeviceManage::onDeviceConnected(const QString& serial) {
    // Use new core to manage devices
    qsc::Device* device = m_coreDeviceManager->getDevice(serial);

    // TC custom: add to group
    m_deviceGroups->addDeviceToGroup(serial, groupName);

    // TC custom: update tree widget
    m_customTreeWidget->addDevice(serial, device->getDeviceInfo());
}
```

**4.2 UI Layer Adaptation**

Keep TC's MainWindow and Dialog, but use new core:
```cpp
// mainwindow.cpp
void MainWindow::startMirror(const QString& serial) {
    // Use new core to start mirroring
    qsc::Device* device = getDevice(serial);
    device->startMirror();

    // TC custom: embed video window in main window
    QWidget* videoWidget = device->getVideoWidget();
    m_gridLayout->addWidget(videoWidget, row, col);
}
```

**4.3 Add Audio Support (Optional)**

Integrate new audio features:
```cpp
#include "QtScrcpy/audio/audiooutput.h"
#include "QtScrcpy/sndcpy/sndcpy.sh"

// Start audio forwarding
AudioOutput* audio = new AudioOutput();
audio->start(serial);
```

#### Phase 5: Testing and Optimization (3-5 days)

**5.1 Unit Testing**
- [ ] Single device connection test
- [ ] Keyboard/mouse control test
- [ ] Recording and screenshot test
- [ ] Key mapping test

**5.2 Integration Testing**
- [ ] Multi-device connection test (10 devices)
- [ ] Group control function test
- [ ] Device grouping test
- [ ] Long-term stability test

**5.3 Performance Testing**
- [ ] 100-device stress test
- [ ] CPU/memory usage monitoring
- [ ] Video latency test

**5.4 Compatibility Testing**
- [ ] Windows 10/11 test
- [ ] Different Android version tests (5.0 - 14)
- [ ] USB/WIFI connection test

#### Phase 6: Documentation and Release (1-2 days)

- [ ] Update README.md
- [ ] Write upgrade changelog
- [ ] Update build scripts
- [ ] Create release package

### 4.3 Code Migration Examples

#### Example 1: Device Connection

**Legacy Code** (qtscrcpy_tc):
```cpp
// devicemanage.cpp
void DeviceManage::connectDevice(const QString& serial) {
    Device* device = new Device();
    device->setSerial(serial);

    // Connect signals
    connect(device, &Device::onServerStarted, this, &DeviceManage::onServerStarted);

    // Start service
    device->startServer();

    m_devices.insert(serial, device);
}
```

**New Adapted Code**:
```cpp
// devicemanage.cpp
#include "QtScrcpyCore/device/device.h"

void DeviceManage::connectDevice(const QString& serial) {
    // Use new core library
    qsc::Device* device = new qsc::Device();
    device->setSerial(serial);

    // New interface may have changed
    connect(device, &qsc::Device::serverStartResult,
            this, &DeviceManage::onServerStarted);

    // Start service
    device->start();

    m_devices.insert(serial, device);

    // TC custom: add to group management
    m_deviceGroups->addDevice(serial);
}
```

#### Example 2: Video Rendering

**Legacy Code**:
```cpp
// qyuvopenglwidget.cpp
void QYUVOpenGLWidget::paintGL() {
    glUseProgram(m_program);
    glBindTexture(GL_TEXTURE_2D, m_textureY);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, m_width, m_height, 0, GL_RED, GL_UNSIGNED_BYTE, m_dataY);
    // ...
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}
```

**New Adaptation**:
```cpp
// Can directly reuse new render/qyuvopenglwidget.cpp
// Or inherit from new rendering class
#include "QtScrcpy/render/qyuvopenglwidget.h"

class TCVideoWidget : public qsc::QYUVOpenGLWidget {
public:
    // Add TC custom features
    void setScaleMode(ScaleMode mode) { /* ... */ }
    void setGridPosition(int row, int col) { /* ... */ }
};
```

---

## Part 5: Risk Assessment and Mitigation

### 5.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| **QtScrcpyCore Interface Incompatibility** | High | Medium | 1. Analyze interface differences in advance<br>2. Write adaptation layer<br>3. Keep legacy code as backup |
| **CMake Build Failure** | Medium | Low | 1. Reference new CMake config<br>2. Gradual migration, keep qmake<br>3. Use CI/CD auto-testing |
| **Third-party Library Version Incompatibility** | Medium | Medium | 1. Use libraries provided by new version<br>2. Test version compatibility<br>3. Docker unified environment |
| **Performance Degradation** | High | Low | 1. Performance baseline testing<br>2. Code profiling<br>3. Optimize hotspots |
| **TC Custom Features Failure** | High | Medium | 1. Test custom modules separately<br>2. Keep module independence<br>3. Write unit tests |

### 5.2 Functional Risks

| Module | Risk Description | Mitigation |
|--------|-----------------|------------|
| **Device Grouping** | New version lacks this feature, need to keep old code | 1. Maintain grouping module independently<br>2. Ensure compatibility with new core |
| **Multi-window Integration** | New version is single-window mode | 1. Keep TC multi-window layout<br>2. Adapt new video components |
| **Group Control** | Different implementation | 1. Compare with new groupcontroller<br>2. Choose better implementation<br>3. May need refactoring |
| **Key Mapping** | Format may have changed | 1. Test mapping file compatibility<br>2. Convert format if necessary |
| **Audio Forwarding** | New feature, not in legacy | 1. Optional integration<br>2. Need stability testing |

### 5.3 Project Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Schedule Overrun** | High | 1. Adopt agile development<br>2. Phased delivery<br>3. Prioritize core features |
| **Resource Shortage** | Medium | 1. Train team in advance<br>2. External technical support<br>3. Reasonable task allocation |
| **Compatibility Issues** | Medium | 1. Expand testing scope<br>2. Keep rollback plan<br>3. Gradual release |
| **Negative User Feedback** | High | 1. Thorough internal testing<br>2. Provide trial version<br>3. Quick issue response |

### 5.4 Rollback Plan

If upgrade fails or serious issues occur, prepare the following rollback plans:

1. **Code Rollback**
   - Use Git to rollback to pre-upgrade version
   - Keep legacy qmake build system

2. **Feature Downgrade**
   - Temporarily disable problematic new features
   - Use legacy core library

3. **Phased Rollback**
   - Rollback problematic modules first
   - Keep stabilized improvements

---

## Part 6: Expected Benefits

### 6.1 Technical Benefits

1. **More Modern Build System**
   - CMake supports better cross-platform
   - Better IDE integration
   - Faster compilation speed

2. **Modular Architecture**
   - Code decoupling, easier maintenance
   - Reusable core library
   - Convenient for future expansion

3. **New Features**
   - Audio forwarding capability
   - Improved logging system
   - Better multi-language support

4. **Community Support**
   - Follow upstream updates
   - Get community bug fixes
   - Reference community best practices

### 6.2 Business Benefits

1. **Enhanced User Experience**
   - Audio support enhances immersion
   - More stable connections
   - Lower latency

2. **Reduced Maintenance Cost**
   - Clearer codebase
   - Fewer bugs
   - Easier updates

3. **Improved Competitiveness**
   - Richer features
   - Better performance
   - Following technology trends

---

## Part 7: Time and Resource Estimation

### 7.1 Time Estimation

| Phase | Task | Workload | Time |
|-------|------|----------|------|
| Phase 1 | Preparation | 2 person-days | 1-2 days |
| Phase 2 | Build System Migration | 4 person-days | 2-3 days |
| Phase 3 | Core Library Integration | 8 person-days | 3-5 days |
| Phase 4 | Feature Integration | 8 person-days | 3-5 days |
| Phase 5 | Testing and Optimization | 8 person-days | 3-5 days |
| Phase 6 | Documentation and Release | 2 person-days | 1-2 days |
| **Total** | | **32 person-days** | **13-22 days** |

**Recommended Time**: 3-4 weeks (considering uncertainties)

### 7.2 Resource Requirements

**Personnel**:
- C++ Development Engineer: 2 people
- Qt Development Engineer: 1 person
- Test Engineer: 1 person
- Technical Advisor: 1 person (part-time, familiar with QtScrcpy)

**Equipment**:
- Development PCs: 2 (Windows + Linux)
- Test Phones: 10+ (different brands and Android versions)
- USB Hub: 1 (supporting 100 ports)

**Software Environment**:
- Qt 6.x
- CMake 3.19+
- MSVC 2019 / GCC / Clang
- Android SDK

---

## Part 8: Acceptance Criteria

### 8.1 Functional Acceptance

- [ ] Support USB/WIFI device connection
- [ ] Support connecting 100 devices simultaneously (hardware permitting)
- [ ] Device group management functions normally
- [ ] Multi-window integrated display functions normally
- [ ] Group control functions normally (unified commands, batch operations)
- [ ] Key mapping functions normally
- [ ] Screen recording and screenshot functions normally
- [ ] Audio forwarding functions normally (new, optional)
- [ ] Batch APK installation functions normally
- [ ] Chinese input method support normally

### 8.2 Performance Acceptance

- [ ] Single device latency < 50ms
- [ ] 10 devices run smoothly simultaneously (30fps+)
- [ ] 100 devices connect stably (hardware permitting)
- [ ] CPU usage reasonable (not exceeding legacy by 20%)
- [ ] Memory usage reasonable (single device < 100MB)

### 8.3 Stability Acceptance

- [ ] Runs 24 hours continuously without crashes
- [ ] Device disconnect/reconnect normally
- [ ] Stable under network jitter conditions
- [ ] No memory leaks with heavy operations

### 8.4 Compatibility Acceptance

- [ ] Runs normally on Windows 10/11
- [ ] Runs normally on Linux Ubuntu 20.04+ (if needed)
- [ ] Supports Android 5.0 - 14
- [ ] Supports mainstream phone brands (Xiaomi, Huawei, OPPO, vivo, Samsung, etc.)

---

## Part 9: Recommendations and Summary

### 9.1 Upgrade Recommendations

1. **Adopt Gradual Upgrade (Strategy A)**
   - Controllable risk
   - Retain TC custom features
   - Gain new core improvements

2. **Priority Ordering**
   - P0: Core library integration, basic feature migration
   - P1: TC custom feature adaptation
   - P2: New feature integration (audio)
   - P3: Performance optimization

3. **Phased Delivery**
   - Alpha version: Core features available
   - Beta version: All features complete
   - RC version: Testing passed
   - Release: Official release

4. **Risk Control**
   - Keep legacy version as backup
   - Thorough testing
   - Gradual release

### 9.2 Long-term Planning

1. **Continuously Follow Upstream**
   - Regularly sync NewQtScrcpy updates
   - Get community bug fixes
   - Learn community best practices

2. **Optimize TC Custom Features**
   - Refactor device group management
   - Optimize multi-window performance
   - Improve group control experience

3. **Expand New Features**
   - More complete audio support
   - Cloud device management
   - Remote collaboration features

### 9.3 Summary

**Key Points**:
1. Legacy qtscrcpy_tc uses embedded integration, rich custom features
2. New NewQtScrcpy uses modular architecture, more modern features
3. Recommend hybrid architecture (Strategy A), keep TC features + introduce new core
4. Upgrade cycle about 3-4 weeks, needs 4-person team
5. Main risks are interface compatibility and TC custom feature migration
6. Expected benefits are better maintainability, new features, and performance improvements

**Critical Success Factors**:
- Detailed interface analysis
- Thorough testing
- Complete rollback plan
- Team technical capabilities

---

## Appendix

### A. References

1. **Official Documentation**
   - QtScrcpy GitHub: https://github.com/barry-ran/QtScrcpy
   - Scrcpy Official Documentation: https://github.com/Genymobile/scrcpy

2. **Technical Documentation**
   - Qt 6 Migration Guide: https://doc.qt.io/qt-6/portingguide.html
   - CMake Official Documentation: https://cmake.org/cmake/help/latest/

3. **Project Documentation**
   - TC Software Documentation.md
   - qtscrcpy_tc/readme.md

### B. Key File List

**Legacy Core Files**:
```
TcUi/17_TcUi.pro (now renamed to SmartMatrix)
TcUi/main.cpp                     # Program entry
TcUi/mainwindow.cpp/h/ui          # Main window (displays "Brilliant Media - Smart Cloud Matrix")
TcUi/device/device.cpp/h          # Device core
TcUi/devicemanage/devicemanage.cpp/h  # Device management
TcUi/groupmanage/*                # Group management (TC custom)
```

**New Core Files**:
```
QtScrcpy/CMakeLists.txt           # CMake configuration
QtScrcpy/main.cpp                 # Program entry
QtScrcpy/ui/dialog.cpp/h/ui       # Main dialog
QtScrcpy/QtScrcpyCore/*           # Core library
QtScrcpy/groupcontroller/*        # Group control
QtScrcpy/audio/*                  # Audio (new)
```

### C. Contact Information

For questions, please contact:
- Project Manager: [To be filled]
- Technical Advisor: [To be filled]
- Document Author: Claude AI Assistant

---

**Document Change History**:

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2025-10-13 | Claude | Initial version |

---

**END OF DOCUMENT**
