# Qt 6.10 Migration Notes

This document lists all changes made to migrate the codebase from Qt 5 to Qt 6.10.

## Overview

The project has been fully migrated to Qt 6.10.1 with MSVC 2022 64-bit. All deprecated Qt 5 APIs have been replaced with Qt 6 equivalents.

### Quick Reference Table

| Qt 5 API | Qt 6 Replacement | Module Required | Files Affected |
|----------|------------------|-----------------|----------------|
| `QRegExp` | `QRegularExpression` | Qt Core | adbprocess.cpp, dialog.cpp |
| `QSettings::setIniCodec()` | Removed (UTF-8 default) | Qt Core | config.cpp |
| `QLayout::setMargin()` | `setContentsMargins()` | Qt Widgets | CustomTreeWidget.cpp |
| `QX11Info` | `QPlatformNativeInterface` | Qt Gui | xmousetap.cpp |
| `QDesktopWidget` | `QScreen` | Qt Gui | videoform.cpp |
| `QFileInfo = QString` | `setFile()` | Qt Core | adbprocess.cpp |
| `QOpenGLWidget` | Same (new module) | **Qt OpenGL Widgets** | qyuvopenglwidget.h/cpp |
| `QOpenGLTexture` | Same (new module) | **Qt OpenGL** | qyuvopenglwidget.cpp |
| `QString::SkipEmptyParts` | `Qt::SkipEmptyParts` | Qt Core | adbprocess.cpp |
| `version` file | `version.txt` | - | 17_TcUi.pro |

## Critical Changes

### 1. QRegExp → QRegularExpression (Qt 6 Removal)

**Affected Files:**
- `adb/adbprocess.cpp`
- `dialog.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
QRegExp regex("pattern", Qt::CaseInsensitive);
if (regex.indexIn(text) != -1) {
    QString match = regex.cap(0);
}
QStringList parts = text.split(QRegExp("\n"), QString::SkipEmptyParts);

// Qt 6 (New):
QRegularExpression regex("pattern", QRegularExpression::CaseInsensitiveOption);
QRegularExpressionMatch match = regex.match(text);
if (match.hasMatch()) {
    QString matched = match.captured(0);
}
QStringList parts = text.split(QRegularExpression("\n"), Qt::SkipEmptyParts);
```

**Reason:** QRegExp was deprecated in Qt 5.15 and completely removed in Qt 6.

### 2. QSettings::setIniCodec() Removal

**Affected Files:**
- `util/config.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
QSettings settings("config.ini", QSettings::IniFormat);
settings.setIniCodec("UTF-8");

// Qt 6 (New):
QSettings settings("config.ini", QSettings::IniFormat);
// UTF-8 is now the default encoding, no codec setting needed
```

**Reason:** Qt 6 uses UTF-8 encoding by default for all text operations, including INI files.

### 3. Qt OpenGL Module Separation

**Affected Files:**
- `17_TcUi.pro`
- `device/render/qyuvopenglwidget.h`
- `device/render/qyuvopenglwidget.cpp`

**Changes:**
```qmake
# Qt 5 (Old):
QT += core gui widgets network

# Qt 6 (New):
QT += core gui widgets network
QT += opengl openglwidgets  # OpenGL classes moved to separate modules
```

**Class Migrations:**
- `QOpenGLWidget` - Moved from Qt Gui to **Qt OpenGL Widgets** module
- `QOpenGLTexture` - Requires **Qt OpenGL** module
- `QOpenGLBuffer` - Requires **Qt OpenGL** module
- `QOpenGLFunctions` - Requires **Qt OpenGL** module
- `QOpenGLShaderProgram` - Requires **Qt OpenGL** module
- All `QGL*` classes (e.g., `QGLWidget`, `QGLFormat`) - **Removed**, use `QOpenGL*` equivalents

**Reason:** In Qt 6, OpenGL functionality was split into separate modules:
- `Qt OpenGL` - Core OpenGL classes and utilities
- `Qt OpenGL Widgets` - QOpenGLWidget for integrating OpenGL with Qt Widgets

This separation provides better modularity and allows applications that don't use OpenGL to have smaller binaries.

### 4. QLayout::setMargin() → setContentsMargins()

**Affected Files:**
- `groupmanage/customtreewidget/CustomTreeWidget.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
layout->setMargin(0);

// Qt 6 (New):
layout->setContentsMargins(0, 0, 0, 0);
```

**Reason:** setMargin() was deprecated and removed for clarity. Use setContentsMargins() for explicit control.

### 4. Qt X11 Extras Module Removal

**Affected Files:**
- `util/mousetap/mousetap.pri`
- `util/mousetap/xmousetap.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
#include <QX11Info>
QT += x11extras

xcb_connection_t *conn = QX11Info::connection();
xcb_window_t root = QX11Info::appRootWindow(QX11Info::appScreen());

// Qt 6 (New):
#include <QGuiApplication>
#include <qpa/qplatformnativeinterface.h>

QPlatformNativeInterface *native = QGuiApplication::platformNativeInterface();
xcb_connection_t *conn = reinterpret_cast<xcb_connection_t*>(
    native->nativeResourceForIntegration(QByteArrayLiteral("connection")));
xcb_window_t root = reinterpret_cast<xcb_window_t>(
    native->nativeResourceForScreen(QByteArrayLiteral("rootwindow"),
        QGuiApplication::primaryScreen()));
```

**Reason:** Qt X11 Extras was removed. Platform-specific functionality moved to QPlatformNativeInterface.

### 5. QDesktopWidget Removal

**Affected Files:**
- `device/ui/videoform.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
#include <QDesktopWidget>

// Qt 6 (New):
#include <QScreen>
// Use QGuiApplication::screens() or QGuiApplication::primaryScreen()
```

**Reason:** QDesktopWidget was deprecated. Use QScreen for multi-monitor support.

### 6. QFileInfo Assignment

**Affected Files:**
- `adb/adbprocess.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
QFileInfo fileInfo;
fileInfo = QString("/path/to/file");

// Qt 6 (New):
QFileInfo fileInfo;
fileInfo.setFile("/path/to/file");
```

**Reason:** QString to QFileInfo implicit conversion was removed for type safety.

### 7. Nodiscard Attribute Warnings

**Affected Files:**
- `main.cpp`
- `groupmanage/devicegroups/devicegroups.cpp`

**Changes:**
```cpp
// Qt 5 (Old):
translator.load(path);  // Warning in Qt 6 with /WX

// Qt 6 (New):
if (translator.load(path)) {  // Check return value
    // Use translator
}

// Or explicitly discard:
(void)file.write(data);
```

**Reason:** Qt 6 added [[nodiscard]] attributes. With /WX (warnings as errors), must handle return values.

### 8. Version File Naming Conflict

**Affected Files:**
- `version` → `version.txt`
- `17_TcUi.pro`

**Changes:**
```qmake
# Qt 5/6 (Old):
CAT_VERSION = $$cat($$PWD/version)

# Qt 6 (New):
CAT_VERSION = $$cat($$PWD/version.txt)
```

**Reason:** Qt 6 has internal header files that may conflict with generic names like "version".

### 9. UTF-8 Compiler Flag Conflict (Qt 6.10+)

**Affected Files:**
- `17_TcUi.pro`

**Changes:**
```qmake
# Qt 6.9 and earlier:
msvc{
    QMAKE_CFLAGS += -source-charset:utf-8
    QMAKE_CXXFLAGS += -source-charset:utf-8
}

# Qt 6.10+ (Removed):
# Qt 6.10+ automatically adds -utf-8 flag
# Manual -source-charset:utf-8 causes conflict error D8016
```

**Reason:** Qt 6.10+ automatically adds the `-utf-8` compiler flag. Adding `-source-charset:utf-8` manually causes compilation error.

## Build Configuration

### Qt Version
- **Target:** Qt 6.10.1
- **Compiler:** MSVC 2022 (19.34.31948) 64-bit
- **Standard:** C++17

### Compiler Flags
- `/WX` - Treat warnings as errors
- `/wd4566` - Disable specific warning 4566
- `-utf-8` - Automatic UTF-8 support (Qt 6.10+)

### Platform Support
- **Windows:** Full support (primary platform)
- **Linux:** X11 Extras migration completed
- **macOS:** No changes required

## Testing Checklist

- [x] All files compile without errors
- [x] All files compile without warnings
- [x] Qt 6.10.1 detection working
- [x] MSVC 2022 auto-detection working
- [x] FFmpeg auto-detection working
- [x] Version file parsing working
- [x] UTF-8 encoding working correctly
- [ ] Runtime testing required

## Migration Statistics

- **Total Files Modified:** 14
- **API Replacements:** 10 major categories
- **Lines Changed:** ~150+
- **Build Errors Fixed:** All resolved
- **New Modules Added:** 2 (opengl, openglwidgets)

## References

- [Qt 6.10 Release Notes](https://www.qt.io/blog/qt-6.10-released)
- [Qt 6.10 Official Documentation](https://doc.qt.io/qt-6/qt-releases.html)
- [Qt 6 Migration Guide](https://doc.qt.io/qt-6/portingguide.html)
- [Changes to Qt Core in Qt 6](https://doc.qt.io/qt-6/qtcore-changes-qt6.html)
- [Changes to Qt OpenGL in Qt 6](https://doc.qt.io/qt-6/opengl-changes-qt6.html)
- [Qt OpenGL Module Documentation](https://doc.qt.io/qt-6/qtopengl-index.html)

## Contact

For questions about this migration, refer to:
- Project repository issues
- Qt 6 documentation
- Official Qt forums

---

Last Updated: 2025-12-19
Qt Version: 6.10.1
Migration Status: ✅ Complete
