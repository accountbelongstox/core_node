# D3 Macro WebView UI

## Overview

The WebView UI system provides a modern HTML/CSS/JavaScript interface for the Diablo 3 Macro application, built on top of the refactored Native UI Framework V2.

## Architecture

### Thread Model

The system uses a clear three-thread architecture:

1. **UI Thread** - Runs Tkinter mainloop, handles UI rendering and user interactions
2. **Main Thread** - Processes signals and executes main thread methods safely
3. **Task Thread** - Runs timer-based background tasks (1 second tick by default)

### Components

```
ui/
├── html/                    # Frontend UI
│   ├── index.html          # Main HTML structure
│   ├── styles.css          # Dark theme styling
│   └── app.js              # JavaScript logic & Python bridge
│
├── webview_launcher.py     # Main launcher
└── README_WEBVIEW.md       # This file
```

## Python-JavaScript Communication

### From JavaScript to Python

JavaScript can call Python methods via the bridge:

```javascript
// Call Python method
callPythonMethod('start_macro', { config: 'config1' });

// Call with callback
callPythonMethod('get_window_status', null, (status) => {
    console.log('Window status:', status);
});
```

### From Python to JavaScript

Python can call JavaScript methods:

```python
# Evaluate JavaScript
launcher.framework.eval_js("window.AppAPI.log('Hello from Python', 'info')")

# Update UI from Python
launcher.framework.eval_js("window.AppAPI.setMacroState(true)")
```

## Available Python API Methods

The `D3MacroWebViewAPI` class exposes the following methods to JavaScript:

### Window Control
- `minimize_window()` - Minimize the window
- `maximize_window()` - Maximize the window
- `close_window()` - Close the window

### Macro Control
- `start_macro(params)` - Start macro execution
  - `params.config` - Configuration name (e.g., 'config1')
- `stop_macro()` - Stop macro execution

### Status Queries
- `get_window_status()` - Get game window detection status
- `get_skills()` - Get configured skills list

### Language
- `change_language(params)` - Change UI language
  - `params.language` - Language code ('en', 'zh')

## JavaScript API (window.AppAPI)

The HTML UI exposes these methods for Python to call:

- `updateStatus(status)` - Update status text
- `updateWindowStatus(detected)` - Update window detection status
- `log(message, type)` - Add log entry (types: 'info', 'warning', 'error')
- `setMacroState(running)` - Update macro running state

## Usage

### Basic Launch

```python
from ui.webview_launcher import WebViewLauncher

# Create and start launcher
launcher = WebViewLauncher()
launcher.start()
```

### With Custom Configuration

```python
from pycore.pyutils.native_ui import UIConfig, WebViewFramework

config = UIConfig(
    app_name="My App",
    window_size=(800, 600),
    show_on_start=True,
    ui_source="path/to/index.html"
)

framework = WebViewFramework(config, api_instance=my_api)
framework.start()
```

### Register Timer Tasks

```python
def my_task():
    print("Task executed")

# Run every 1 second
launcher.framework.register_timer_task("my_task", my_task, interval=1)

# Run every 5 seconds (execute every 5th tick)
launcher.framework.register_timer_task("slow_task", my_task, interval=5)
```

### Handle Signals

```python
from pycore.pyutils.native_ui import SignalType

def on_custom_event(signal):
    print(f"Custom event: {signal.data}")

launcher.framework.register_signal_handler(
    SignalType.CUSTOM,
    on_custom_event
)

# Emit signal
launcher.framework.emit_signal(SignalType.CUSTOM, {'key': 'value'})
```

## Testing

Run the test script to verify the integration:

```bash
python test_webview_ui.py
```

The test script will:
1. Check framework imports
2. Verify HTML UI files exist
3. Launch the WebView UI

## Development

### Adding New Python API Methods

1. Add method to `D3MacroWebViewAPI` class in `webview_launcher.py`:

```python
def my_new_method(self, params: Optional[Dict] = None) -> Dict[str, Any]:
    # Implementation
    return {'success': True, 'data': 'result'}
```

2. Call from JavaScript:

```javascript
callPythonMethod('my_new_method', {param1: 'value'});
```

### Adding New UI Features

1. Update `ui/html/index.html` for structure
2. Update `ui/html/styles.css` for styling
3. Update `ui/html/app.js` for logic

## Framework Features

### Signal System

- Async communication between threads
- Type-safe signal types
- Data payload support

### Timer System

- Interval-based task execution
- Intercept parameter for frequency control
- Thread-safe task registration

### Main Thread Executor

- Safe UI operations from any thread
- Method registration system
- Queued execution

## Dependencies

Required Python packages:
- tkinter (built-in)
- tkinterweb or tkhtmlview (for HTML rendering)
- pywebview (optional, for better JavaScript bridge)

Install optional dependencies:
```bash
pip install tkinterweb pywebview
```

## Troubleshooting

### WebView not loading

- Check if HTML file path is correct
- Verify tkinterweb or tkhtmlview is installed
- Check console for error messages

### JavaScript bridge not working

- Ensure pywebview is installed for best support
- Check browser console for JavaScript errors
- Verify Python API methods are properly defined

### UI freezing

- Check if long-running tasks are on UI thread
- Move heavy operations to Task thread
- Use signals for async operations

## Future Enhancements

- [ ] Full pywebview integration
- [ ] Better JavaScript debugging tools
- [ ] Hot reload for HTML/CSS/JS development
- [ ] DevTools integration
- [ ] Better error handling and logging
