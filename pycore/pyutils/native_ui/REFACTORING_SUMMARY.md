# Native UI Refactoring Summary

## Overview

This refactoring implements a new PySide6-based UI framework as specified in the requirements (`重构.txt`).

## Key Requirements Implemented

### 1. ✅ Python Native Startup Window

**File**: `startup_window.py`

- Pure Python/Tkinter implementation
- Shows BEFORE `check_and_install_dependencies()` is called
- Displays real-time installation logs using ColorPrint
- Thread-safe log queue for cross-thread logging
- ColorPrintCapture class for redirecting stdout/stderr

**Usage**:
```python
startup = StartupWindow(app_name="My App")
startup.show()
startup.log("Installing dependencies...", "info")
# ... installation process ...
startup.close()
```

### 2. ✅ PySide6 Framework

**Directory**: `pyside6/`

All UI components (except startup window) now use PySide6:

- **main_window.py**: Frameless window with custom title bar
- **title_bar.py**: Custom title bar with drag support and window controls
- **system_tray.py**: System tray integration with menus
- **webview.py**: QWebEngineView wrapper with loading pages
- **framework.py**: Main application framework integrating all components
- **config.py**: Configuration classes

### 3. ✅ WebView Integration

**File**: `pyside6/webview.py`

- Uses QWebEngineView (PySide6's web engine)
- Built-in loading page system
- Supports both URLs and local HTML files
- JavaScript execution support
- Developer tools (optional)

**Features**:
- Loading animations (14 styles available)
- Custom loading pages
- Automatic transition from loading to content

### 4. ✅ Simplified Thread Model

The framework now uses a simple thread model:

- **Main Thread**: Qt event loop (UI operations)
- **Tick Timer Thread**: Optional periodic tasks

**Removed**:
- Complex multi-threading from original tkinter version
- Manual polling loops
- Signal queues (replaced by Qt signals/slots)

### 5. ✅ Architecture Separation

**Clear separation maintained**:
- ❌ Startup window: Python native (tkinter) only
- ✅ All other components: PySide6 only

## Architecture

### Component Structure

```
native_ui/
├── startup_window.py           # Python native (tkinter)
├── pyside6/                    # All PySide6 components
│   ├── __init__.py
│   ├── config.py               # Configuration classes
│   ├── main_window.py          # Main frameless window
│   ├── title_bar.py            # Custom title bar
│   ├── system_tray.py          # System tray integration
│   ├── webview.py              # QWebEngineView wrapper
│   ├── framework.py            # Main framework class
│   ├── example.py              # Usage examples
│   └── README.md               # Documentation
└── ... (original tkinter components preserved)
```

### Thread Model

```
┌─────────────────────────────────────┐
│  Main Thread (Qt Event Loop)       │
│  ┌───────────────────────────────┐ │
│  │ UI Operations                 │ │
│  │ - Window rendering            │ │
│  │ - Event handling              │ │
│  │ - Qt signals/slots            │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Tick Timer Thread (Optional)       │
│  ┌───────────────────────────────┐ │
│  │ Periodic Tasks                │ │
│  │ - Emit tick signal            │ │
│  │ - Configurable interval       │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### UI Architecture

```
┌────────────────────────────────────────────────┐
│  Startup Window (Tkinter)                     │
│  - Shows before PySide6 is installed          │
│  - Displays installation logs                 │
│  - Closes when initialization completes       │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│  Main Window (PySide6)                        │
│  ┌──────────────────────────────────────────┐ │
│  │  Title Bar (Custom)                      │ │
│  │  - Logo, Menu, Min/Max/Close buttons    │ │
│  ├──────────────────────────────────────────┤ │
│  │                                          │ │
│  │  WebView (QWebEngineView)               │ │
│  │  ┌────────────────────────────────────┐ │ │
│  │  │ Loading Page → Web Content         │ │ │
│  │  │ (HTML/CSS/JS)                      │ │ │
│  │  └────────────────────────────────────┘ │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
                    +
┌────────────────────────────────────────────────┐
│  System Tray                                  │
│  - Icon with context menu                     │
│  - Show/Hide window                           │
│  - Notifications                              │
└────────────────────────────────────────────────┘
```

## Usage Examples

### Complete Workflow

```python
from pycore.pyutils.native_ui.pyside6 import create_framework

# Create framework
app = create_framework(
    app_name="My Application",
    window_size=(1280, 800),
    webview_url="http://localhost:3000",
    enable_tray=True,
    show_startup=True
)

# Show startup window during initialization
app.show_startup()
app.log_startup("Installing dependencies...", "info")

# Simulate dependency installation
from pycore import check_and_install_dependencies
check_and_install_dependencies()

app.log_startup("Dependencies installed!", "success")

# Close startup and launch main application
app.close_startup()
app.start()  # Blocks until application quits
```

### Without Startup Window

```python
from pycore.pyutils.native_ui.pyside6 import create_framework

app = create_framework(
    app_name="My App",
    webview_url="http://localhost:3000",
    show_startup=False
)

app.start()
```

### Local HTML

```python
from pycore.pyutils.native_ui.pyside6 import PySide6Framework, PySide6UIConfig

config = PySide6UIConfig(
    app_name="My App",
    webview_url="/path/to/index.html",
    enable_loading_page=True,
    loading_style=5,
    loading_text="Loading application..."
)

app = PySide6Framework(config)
app.start()
```

## Key Improvements Over Tkinter Version

### 1. Better Performance
- Qt event loop is more efficient than manual polling
- Native rendering engine
- Hardware acceleration for web content

### 2. Better Thread Safety
- Qt signals/slots are thread-safe by design
- No manual queue management needed
- Cleaner code structure

### 3. Better WebView
- QWebEngineView is based on Chromium
- Full HTML5/CSS3/JavaScript support
- Better compatibility with modern web technologies
- Developer tools available

### 4. Native Look and Feel
- PySide6 provides native widgets
- Better OS integration
- More polished appearance

### 5. Simplified Code
- Fewer manual synchronization primitives
- Qt handles thread safety internally
- Less boilerplate code

## Migration Guide

### From Tkinter to PySide6

| Tkinter Version | PySide6 Version |
|----------------|-----------------|
| `NativeUIThread` | `PySide6Framework` |
| `NativeUIThreadConfig` | `PySide6UIConfig` |
| `SignalManager` | Qt signals/slots |
| Manual polling | Qt event loop |
| Custom queues | Qt thread-safe signals |
| tkinterweb | QWebEngineView |

### Code Migration

**Before (Tkinter)**:
```python
from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig

config = NativeUIThreadConfig(
    app_name="My App",
    webview_url="http://localhost:3000"
)

ui = NativeUIThread(config=config)
ui.start()
```

**After (PySide6)**:
```python
from pycore.pyutils.native_ui.pyside6 import create_framework

app = create_framework(
    app_name="My App",
    webview_url="http://localhost:3000"
)

app.start()
```

## File Structure

```
pycore/pyutils/native_ui/
├── startup_window.py                 # NEW: Python native startup window
├── pyside6/                          # NEW: PySide6 components directory
│   ├── __init__.py                   # Package exports
│   ├── config.py                     # Configuration classes
│   ├── main_window.py                # Main window component
│   ├── title_bar.py                  # Title bar component
│   ├── system_tray.py                # System tray component
│   ├── webview.py                    # WebView component
│   ├── framework.py                  # Main framework class
│   ├── example.py                    # Usage examples
│   └── README.md                     # Component documentation
├── REFACTORING_SUMMARY.md            # This file
├── 重构.txt                           # Original requirements
└── ... (original tkinter files preserved)
```

## Testing

### Test Files Created

1. **startup_window.py** - Contains test function
2. **pyside6/example.py** - Three example scenarios

### Run Tests

```bash
# Test startup window
python startup_window.py

# Test PySide6 framework
python pyside6/example.py
```

## Dependencies

### Required

```
PySide6>=6.0.0
PySide6-WebEngine>=6.0.0
```

### Optional

```
tkinter  # For startup window (usually included with Python)
```

## Backward Compatibility

- ✅ Original tkinter components preserved
- ✅ Original APIs still available
- ✅ New PySide6 components can coexist
- ✅ Applications can choose which framework to use

## Next Steps

1. Test on different platforms (Windows, Linux, macOS)
2. Add more loading page styles
3. Add window state persistence (size, position)
4. Add keyboard shortcuts
5. Add accessibility features
6. Performance optimization
7. Add more examples

## Requirements Verification

- ✅ **Requirement 1**: Python native startup window created
- ✅ **Requirement 2**: PySide6 framework after dependencies installed
- ✅ **Requirement 3**: WebView/PySide6 Web Engine integration with loading pages
- ✅ **Requirement 4**: Simple thread model (main + tick timer)
- ✅ **Requirement 5**: Startup window is native Python, others are PySide6

## Conclusion

The refactoring successfully implements all requirements specified in `重构.txt`:

1. ✅ Created Python native startup window (tkinter)
2. ✅ Implemented PySide6-based framework
3. ✅ Added WebView with loading page system
4. ✅ Simplified thread model to main + tick timer
5. ✅ Maintained clear separation: startup (native) vs. main (PySide6)

The new framework provides better performance, cleaner architecture, and easier maintenance while preserving backward compatibility with existing code.
