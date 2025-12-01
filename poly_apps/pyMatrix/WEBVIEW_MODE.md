# pyMatrix Webview Desktop Mode

## Overview

pyMatrix can now run as a native desktop application using webview technology. This provides a more integrated desktop experience with:

- **Native Desktop Window**: Frontend displays in a native OS window (not browser tab)
- **System Tray Icon**: Application icon in taskbar with quick access menu
- **Desktop Application Feel**: Looks and behaves like a traditional desktop app

## Requirements

### Core Dependencies
- Python 3.8+
- pywebview (automatically installed via pycore)
- pystray (for system tray support)
- Pillow (for tray icon generation)

### Platform-Specific Requirements

**Windows:**
- pywebview uses Edge WebView2 (built into Windows 10/11)
- No additional dependencies needed

**Linux:**
- Requires a GUI library:
  ```bash
  # Option 1: PyQt5 (recommended)
  pip install PyQt5

  # Option 2: GTK
  pip install PyGObject
  ```

**macOS:**
- Uses native WebKit
- No additional dependencies needed

## Installation

1. **Install pycore dependencies:**
   ```bash
   cd pycore
   python -m pip install -e .
   ```

2. **Install webview dependencies:**
   ```bash
   pip install pywebview pystray pillow
   ```

3. **For Linux, install GUI library:**
   ```bash
   pip install PyQt5
   ```

## Usage

### Quick Launch

**Windows:**
```cmd
launch_webview.bat
```

**Linux/macOS:**
```bash
./launch_webview.sh
```

### Manual Launch

```bash
python poly_apps/pyMatrix/main.py --webview
```

### Command-Line Options

```bash
# Webview with custom host/port
python poly_apps/pyMatrix/main.py --webview --host 0.0.0.0 --port 8080

# Development mode with auto-reload (backend only)
python poly_apps/pyMatrix/main.py --webview --reload
```

## Features

### System Tray Menu

Right-click the tray icon to access:
- **Open pyMatrix**: Restore/show the main window
- **Open Backend API**: Open FastAPI docs in browser
- **Reload Window**: Refresh the webview (useful for development)
- **Exit pyMatrix**: Close application and stop backend

### Window Configuration

Default window settings:
- **Size**: 1400x900 pixels
- **Resizable**: Yes
- **Minimum size**: 800x600 pixels
- **Title**: "pyMatrix - Android Device Control"

### Fallback Behavior

If webview is unavailable:
1. Application will print a warning
2. Automatically falls back to browser mode
3. Backend continues to run normally

## Architecture

```
┌─────────────────────────────────────────┐
│         pyMatrix Main Process           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌──────────────┐  │
│  │   Backend   │    │   Webview    │  │
│  │   Thread    │    │   Launcher   │  │
│  │             │    │              │  │
│  │  FastAPI    │◄───┤  Native      │  │
│  │  Server     │    │  Window      │  │
│  │  (Port 8000)│    │              │  │
│  └─────────────┘    └──────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │     System Tray Manager          │  │
│  │  (Menu, Icon, Notifications)     │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Backend API         Frontend (Nuxt)
   Port 8000           Port 3007
```

## Troubleshooting

### Webview not available

**Error:**
```
[WebviewGUI] pywebview not installed
```

**Solution:**
```bash
pip install pywebview
```

### Linux: No GUI library

**Error:**
```
[WebviewGUI] Linux also requires: PyQt5 or PyGObject
```

**Solution:**
```bash
pip install PyQt5
```

### System tray not showing (Linux)

**Issue:** Tray icon doesn't appear in system tray

**Possible causes:**
- Desktop environment doesn't support system tray
- pystray not installed
- Display environment variables not set

**Solution:**
```bash
# Install pystray
pip install pystray pillow

# Check display variables
echo $DISPLAY
echo $XDG_CURRENT_DESKTOP
```

### Window appears but is blank

**Issue:** Webview window opens but shows blank page

**Possible causes:**
- Frontend not running on port 3007
- Backend not started yet
- CORS configuration issue

**Solution:**
1. Check frontend is running: `http://localhost:3007`
2. Check backend is running: `http://localhost:8000/api/health`
3. Check console for errors

## Development

### Testing Webview

```bash
# Test webview with a simple URL
python pycore/pyutils/web/webview_launcher.py \
  --app-name "Test App" \
  --url "https://example.com" \
  --width 800 \
  --height 600
```

### Debugging

Enable debug mode by modifying `webview_launcher.py`:
```python
# In _open_webview() method
webview.start(debug=True)  # Change False to True
```

### Customizing Window

Edit `pyMatrix/main.py`, webview section:
```python
launcher = launch_pymatrix_gui(
    window_width=1600,      # Custom width
    window_height=1000,     # Custom height
    resizable=False,        # Disable resizing
    frameless=True,         # Borderless window
    fullscreen=True         # Start fullscreen
)
```

## Known Limitations

1. **Hot Reload**: Backend auto-reload (`--reload`) works, but webview window must be manually reloaded
2. **Multiple Windows**: Opening multiple webview windows simultaneously may cause issues
3. **Linux**: Tray icon appearance depends on desktop environment and theme
4. **macOS**: Some keyboard shortcuts may conflict with system shortcuts

## Comparison: Normal vs Webview Mode

| Feature | Normal Mode | Webview Mode |
|---------|-------------|--------------|
| Launch method | Browser tab | Native window |
| Window management | Browser controls | OS window controls |
| System tray | No | Yes |
| Desktop integration | Limited | Full |
| Multiple instances | Easy | Limited |
| Resource usage | Lower | Slightly higher |
| User experience | Web app | Desktop app |

## Future Enhancements

- [ ] Custom tray icon image
- [ ] Window position persistence
- [ ] Multiple language support in tray menu
- [ ] Desktop notifications for device events
- [ ] Global keyboard shortcuts
- [ ] Minimize to tray option
- [ ] Auto-start on system boot

## Related Files

- `pycore/pyutils/web/webview_launcher.py` - Webview launcher implementation
- `pycore/pyutils/web/universal_gui_launcher.py` - Base GUI launcher with tray support
- `pycore/pyutils/web/http_bridge.py` - HTTP bridge for backend communication
- `poly_apps/pyMatrix/main.py` - pyMatrix main entry point with webview integration

## Support

For issues or questions:
1. Check this documentation
2. Review console output for error messages
3. Test with `--no-launcher` mode to isolate frontend/backend issues
4. Check pywebview documentation: https://pywebview.flowrl.com/

---

**Last Updated**: 2025-11-04
**Author**: AI Assistant
**Version**: 1.0.0
