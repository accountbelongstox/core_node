# UI Thread Test Application

This application demonstrates using `pylauncher` with configuration files to start `NativeUIThread` as an independent service.

## Features

- **Configuration File-Based Launching**: Load launcher configuration from JSON file
- **NativeUIThread Integration**: Start UI as an independent thread via pylauncher
- **Custom UI Content**: Demonstrate custom UI content creation with controllers
- **Multi-Service Architecture**: Shows how to integrate UI threads into larger applications
- **Service Lifecycle Management**: Proper startup and shutdown handling

## Architecture

```
ui_thread_test/
├── ui_thread_test_main.py       # AppLauncher entry (for pymain.py)
├── main.py                      # Application implementation
├── __init__.py                  # Package exports
├── config/
│   ├── __init__.py
│   └── launcher_config.json     # JSON configuration file
├── controller/
│   ├── __init__.py
│   └── ui_controller.py         # UI content controller
└── scripts/
    ├── start.ps1                # Start application
    ├── stop.ps1                 # Stop application
    ├── install.ps1              # Install dependencies
    └── deploy.ps1               # Deploy application
```

**Entry Points**:
- `ui_thread_test_main.py`: Entry for AppLauncher/pymain.py (naming convention: `{app_name}_main.py`)
- `main.py`: Application implementation with `start()` function

## Quick Start

### Method 1: Using pymain.py (Recommended)

From project root:

```bash
# Exact match
python pymain.py app=ui_thread_test

# Fuzzy match (will find ui_thread_test)
python pymain.py app=ui_thread
python pymain.py app=ui

# Interactive selection (no app specified)
python pymain.py
```

### Method 2: Using deployment scripts

```powershell
cd pyapps/ui_thread_test

# Deploy
.\scripts\deploy.ps1

# Start
.\scripts\start.ps1

# Stop (or press Ctrl+C)
.\scripts\stop.ps1
```

### Method 3: Direct Python module execution

```bash
python -m pyapps.ui_thread_test.main
```

## Configuration

The application loads configuration from `config/launcher_config.json`:

```json
{
  "ui_service": {
    "app_name": "UI Thread Test Application",
    "window_size": [1000, 700],
    "frameless": true,
    "theme": "dark",
    "enabled": true
  },
  "auto_start_all": false,
  "startup_delay": 0.5
}
```

### Configuration Options

- **ui_service**: UI service configuration
  - `app_name`: Application window title
  - `window_size`: Window dimensions [width, height]
  - `frameless`: Frameless window mode
  - `theme`: UI theme ("dark" or "light")
  - `enabled`: Enable/disable UI service
- **auto_start_all**: Auto-start all enabled services
- **startup_delay**: Delay between service starts (seconds)

## Key Concepts Demonstrated

### 1. Configuration File Loading

```python
# Load configuration from JSON file
config = LauncherConfig.from_json_file('config/launcher_config.json')
```

### 2. Custom UI Service Registration

```python
# Register custom UI service with custom content
launcher.register_custom_service(
    service_name='custom_ui_thread',
    entry_point=custom_ui_entry,
    config=config.ui_service
)
```

### 3. NativeUIThread Creation

```python
# Create UI thread with custom content
ui_thread = NativeUIThread(
    config=ui_thread_config,
    on_create_content=ui_controller.create_ui_content,
    thread_name="CustomUIThread"
)

ui_thread.start()
ui_thread.wait_until_ready()
```

### 4. Custom UI Content

```python
class UIController:
    def create_ui_content(self, content_frame):
        # Create custom UI widgets
        button = tk.Button(
            content_frame,
            text="Click Me",
            command=self.handle_click
        )
        button.pack()
```

## UI Features

The test application includes:

- **Title Section**: Application title and description
- **Information Panel**: Feature description
- **Interactive Counter**: Increment/decrement/reset functionality
- **Action Buttons**: Styled buttons with hover effects
- **Status Bar**: Real-time status updates

## How It Works

1. **Application Start**:
   - Load configuration from JSON file
   - Create UnifiedLauncher instance
   - Create UIController for custom content

2. **Service Registration**:
   - Register custom UI thread service
   - Configure NativeUIThread with custom content callback

3. **UI Thread Start**:
   - pylauncher creates ServiceThread wrapper
   - ServiceThread starts NativeUIThread
   - NativeUIThread creates Tkinter window
   - Custom content is created via UIController

4. **Service Lifecycle**:
   - UI thread runs independently
   - Application waits for services
   - Graceful shutdown on Ctrl+C

## Code Structure

### main.py
- `UIThreadTestApp`: Main application class
- `load_configuration()`: Load config from JSON
- `_register_custom_ui_service()`: Register custom UI service
- `start()`: Application entry point

### controller/ui_controller.py
- `UIController`: UI content creation and interaction
- `create_ui_content()`: Create custom Tkinter widgets
- UI event handlers (increment, decrement, reset)

### config/launcher_config.json
- Complete launcher configuration
- Enables only UI service
- Disables other services (web, mcp, selenium)

## Extending the Application

### Add New UI Features

```python
class UIController:
    def create_ui_content(self, content_frame):
        # Add your custom widgets here
        pass
```

### Enable Additional Services

Edit `config/launcher_config.json`:

```json
{
  "web_service": {
    "enabled": true,
    "http_port": 8000
  },
  "mcp_service": {
    "enabled": true
  }
}
```

### Add Custom Services

```python
launcher.register_custom_service(
    service_name='my_custom_service',
    entry_point=my_service_function,
    config=my_config
)
```

## Dependencies

All dependencies are managed in the project root `requirements.txt`.

Required packages:
- Python 3.10+
- tkinter (included with Python)
- pycore (internal framework)

## Troubleshooting

### Import Errors
Ensure you're running from the project root:
```bash
cd D:/programing/core_node
python -m pyapps.ui_thread_test.main
```

### Configuration Not Found
The application will create default configuration on first run.

### Window Not Showing
Check `config/launcher_config.json`:
```json
{
  "ui_service": {
    "show_on_start": true
  }
}
```

## References

- **pylauncher**: `pycore/pylauncher/`
- **NativeUIThread**: `pycore/pyutils/native_ui/thread_framework.py`
- **Python Development Guide**: `development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`

## License

Part of the core_node project.
