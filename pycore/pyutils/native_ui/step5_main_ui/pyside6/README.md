# PySide6 Native UI Framework

A modern, frameless desktop application framework built with PySide6.

## Features

- ✅ **Frameless Window** with custom title bar
- ✅ **System Tray** integration
- ✅ **WebView** support (QWebEngineView)
- ✅ **Loading Pages** with animations
- ✅ **Startup Window** (tkinter) for dependency installation
- ✅ **Simple Thread Model** (Main + Tick timer)
- ✅ **Cross-platform** (Windows, Linux, macOS)

## Architecture

### Components

1. **Startup Window** (`startup_window.py`)
   - Python native (tkinter)
   - Shows BEFORE dependencies are installed
   - Displays real-time installation logs

2. **Main Window** (`main_window.py`)
   - PySide6-based frameless window
   - Custom title bar with drag support
   - Resizable with window controls

3. **Title Bar** (`title_bar.py`)
   - Custom title bar widget
   - Minimize/Maximize/Close buttons
   - Window dragging support

4. **System Tray** (`system_tray.py`)
   - System tray icon with menu
   - Notifications support
   - Show/hide window integration

5. **WebView** (`webview.py`)
   - QWebEngineView wrapper
   - Loading page system
   - JavaScript execution support

6. **Framework** (`framework.py`)
   - Main application class
   - Integrates all components
   - Simple thread management

### Thread Model

The framework uses a simple thread model:

- **Main Thread**: Qt event loop (UI)
- **Tick Thread**: Periodic tasks timer (optional)

IMPORTANT: Unlike the original tkinter version, PySide6 uses Qt's event loop which is more efficient and doesn't require manual polling.

## Usage

### Quick Start

```python
from pycore.pyutils.native_ui.pyside6 import create_framework

# Create and start application
app = create_framework(
    app_name="My Application",
    window_size=(1280, 800),
    webview_url="http://localhost:3000",
    enable_tray=True
)

app.start()
```

### With Startup Window

```python
from pycore.pyutils.native_ui.pyside6 import create_framework

# Create framework
app = create_framework(
    app_name="My App",
    webview_url="http://localhost:3000",
    show_startup=True
)

# Show startup window during initialization
app.show_startup()
app.log_startup("Installing dependencies...", "info")

# ... perform initialization ...

# Close startup and start main app
app.close_startup()
app.start()
```

### Advanced Configuration

```python
from pycore.pyutils.native_ui.pyside6 import PySide6Framework, PySide6UIConfig

config = PySide6UIConfig(
    # Application
    app_name="My Application",
    icon_path="/path/to/icon.png",

    # Window
    window_size=(1280, 800),
    frameless=True,
    show_on_start=True,

    # Title Bar
    enable_title_bar=True,
    title_bar_height=32,
    title_bar_bg="#2c3e50",

    # System Tray
    enable_tray=True,
    minimize_to_tray=True,

    # WebView
    enable_webview=True,
    webview_url="http://localhost:3000",
    enable_loading_page=True,
    loading_style=1,

    # Tick Timer
    enable_tick_timer=True,
    tick_interval=1.0,

    # Debug
    debug=True
)

app = PySide6Framework(config)
app.start()
```

## Configuration Options

### PySide6UIConfig

**Application**:
- `app_name`: Application name
- `icon_path`: Path to application icon
- `logo_path`: Path to logo image

**Window**:
- `window_size`: (width, height) tuple
- `min_window_size`: Minimum window size
- `show_on_start`: Show window on startup
- `resizable`: Allow window resize
- `frameless`: Enable frameless window

**Title Bar**:
- `enable_title_bar`: Enable custom title bar
- `title_bar_height`: Title bar height
- `title_bar_bg`: Background color
- `title_bar_fg`: Foreground color
- `show_menu_button`: Show menu button

**System Tray**:
- `enable_tray`: Enable system tray
- `tray_icon_path`: Tray icon path
- `minimize_to_tray`: Minimize hides to tray

**WebView**:
- `enable_webview`: Enable WebView
- `webview_url`: URL or local HTML path
- `enable_loading_page`: Show loading page
- `loading_style`: Animation style (1-14)
- `enable_dev_tools`: Enable web inspector

**Thread**:
- `enable_tick_timer`: Enable tick timer thread
- `tick_interval`: Tick interval in seconds

**Callbacks**:
- `on_ready`: Called when UI is ready
- `on_closing`: Called before window closes
- `on_closed`: Called after window closes

## Examples

See `example.py` for complete examples:

```bash
python example.py
```

Options:
1. Example with startup window
2. Simple example
3. Local HTML example

## Requirements

```
PySide6>=6.0.0
PySide6-WebEngine>=6.0.0  # For WebView support
```

## Differences from Tkinter Version

| Feature | Tkinter Version | PySide6 Version |
|---------|----------------|-----------------|
| UI Framework | Tkinter | PySide6 (Qt) |
| Event Loop | Manual polling | Qt event loop |
| WebView | tkinterweb | QWebEngineView |
| Signal System | Custom queue | Qt signals/slots |
| Thread Safety | Manual queues | Qt thread-safe signals |
| Performance | Moderate | High |
| Native Look | Limited | Full native |

## Migration from Tkinter

If you're migrating from the tkinter version:

1. Replace `NativeUIThread` with `PySide6Framework`
2. Replace `NativeUIThreadConfig` with `PySide6UIConfig`
3. Qt signals replace custom signal system
4. Qt event loop replaces manual polling
5. Startup window remains the same (tkinter)

## Best Practices

1. **Use Startup Window** for dependency installation
2. **Keep UI in main thread** - never create UI from tick thread
3. **Use Qt signals** for thread-safe communication
4. **Enable loading page** for remote URLs
5. **Test on all platforms** if targeting cross-platform

## Troubleshooting

**WebView not loading:**
- Ensure PySide6-WebEngine is installed
- Check if URL is accessible
- Enable dev tools for debugging

**Window not responding:**
- Don't block main thread
- Use tick timer for periodic tasks
- Keep callbacks fast

**Tray icon not showing:**
- Check system tray is enabled in OS
- Verify icon path is correct
- Some Linux systems need special configuration

## License

Same as parent project.
