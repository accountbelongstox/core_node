# Native UI Framework Architecture Guide

## 1. Framework Overview

### 1.1 Purpose
Native UI Framework provides a thread-safe, cross-platform desktop application framework based on Tkinter with advanced features:
- Frameless custom windows with custom title bars
- System tray integration
- Multi-threaded architecture with thread-safe communication
- Signal-based event system
- WebView integration for hybrid applications

### 1.2 Core Design Principles
- **Thread Safety**: All UI operations execute in main thread, other threads communicate via message queues
- **Separation of Concerns**: UI rendering, event handling, and business logic are separated
- **Signal-Based Communication**: Loose coupling between components via signal system
- **Action Queue Pattern**: User callbacks can intercept and customize native behavior

## 2. Architecture Components

### 2.1 Threading Model

```
Main Thread (Tkinter Event Loop)
├── UI Rendering (tkinter widgets)
├── Signal Processing (SignalManager)
├── Main Thread Executor (MainThreadExecutor)
└── Command Queue Processing

Background Threads
├── Task Timer Thread (periodic tasks)
└── System Tray Thread (pystray)
```

**Critical Rule**: All tkinter API calls MUST happen in main thread. Other threads communicate via queues.

### 2.2 Component Hierarchy

```
NativeUIThread (threading.Thread)
├── SignalManager (signal queue + handlers)
├── ActionQueue (callback queue + native implementations)
├── MainThreadExecutor (method queue + registered methods)
├── TaskTimer (timer thread for periodic tasks)
├── CustomTitleBar (frameless window title bar)
├── SystemTray (system tray icon + menu)
└── WebView (embedded browser - optional)
```

## 3. Signal System (SignalManager)

### 3.1 Purpose
Provides asynchronous, thread-safe communication between UI components and main thread.

### 3.2 Architecture

```
[Any Thread]                    [Main Thread]
    |                               |
    emit(SignalType, data)          |
    |                               |
    v                               |
signal_queue.put(Signal)            |
    |                               |
    |------------------------------>|
                                    |
                            process_signals()
                                    |
                            for each signal:
                                handler(signal)
```

### 3.3 Signal Types
- `WINDOW_CLOSE`: Window close request
- `WINDOW_MINIMIZE`: Window minimize request
- `WINDOW_MAXIMIZE`: Window maximize request
- `WINDOW_RESTORE`: Window restore from maximized
- `WINDOW_RESTART`: Application restart request
- `WINDOW_SHOW`: Show window
- `WINDOW_HIDE`: Hide window
- `UI_READY`: UI initialization complete
- `CUSTOM`: Custom signals

### 3.4 Usage Flow
1. Component emits signal: `signal_manager.emit(SignalType.WINDOW_CLOSE)`
2. Signal is queued in `signal_queue` (thread-safe)
3. Main thread calls `process_signals()` in event loop
4. Registered handlers are invoked sequentially
5. Handlers execute in main thread (safe for tkinter operations)

### 3.5 Handler Registration
```python
signal_manager.register_handler(SignalType.WINDOW_CLOSE, handler_function)

def handler_function(signal: Signal):
    # Executes in main thread
    # Safe to call tkinter APIs
    pass
```

## 4. Action Queue System (ActionQueue)

### 4.1 Purpose
Allows user callbacks to intercept window actions and optionally call native implementations.

### 4.2 Architecture

```
Action Trigger (e.g., close button click)
    |
    v
Signal Emitted (SignalType.WINDOW_CLOSE)
    |
    v
Signal Handler Invoked
    |
    v
ActionQueue.execute(ActionType.CLOSE, native_impl)
    |
    v
Has User Callbacks?
    |
    ├─ YES --> Execute Callbacks with ActionContext
    |           |
    |           └─ Callback decides: context.call_native() or not
    |
    └─ NO  --> Execute native_impl directly (default behavior)
```

### 4.3 Action Types
- `CLOSE`: Window close (native: stop thread, cleanup)
- `MINIMIZE`: Window minimize (native: iconify window)
- `MAXIMIZE`: Window maximize (native: full screen)
- `RESTORE`: Window restore (native: normal size)
- `RESTART`: Application restart (native: stop)
- `MENU`: Menu button click (no native impl)

### 4.4 Callback Behavior
**Key Rule**: If callbacks registered, native implementation is NOT called automatically.

**Pattern 1: Custom + Native**
```python
def my_callback(context: ActionContext):
    # Custom logic
    cleanup_resources()

    # Call native
    context.call_native()

ui.register_action_callback(ActionType.CLOSE, my_callback)
```

**Pattern 2: Override Native (No Native Call)**
```python
def my_callback(context: ActionContext):
    # Fully custom behavior
    hide_to_tray()
    # Don't call context.call_native()

ui.register_action_callback(ActionType.MINIMIZE, my_callback)
```

**Pattern 3: No Callbacks (Default)**
```python
# No callbacks registered
# Native implementation executes automatically
```

## 5. Main Thread Executor (MainThreadExecutor)

### 5.1 Purpose
Allows other threads (e.g., tray menu callbacks) to safely execute methods in main thread.

### 5.2 Architecture

```
[Tray Thread]                   [Main Thread]
    |                               |
    main_executor.call('close')     |
    |                               |
    v                               |
method_queue.put(('close', args))   |
    |                               |
    |------------------------------>|
                                    |
                            execute_pending()
                                    |
                            for each method:
                                registered_methods[name](*args)
```

### 5.3 Method Registration
Methods must be registered before they can be called:

```python
main_executor.register_method('show_window', self._method_show_window)
main_executor.register_method('close', self._method_close)
```

### 5.4 Method Calling
From any thread (e.g., tray callback):
```python
main_executor.call('show_window')  # Queued, executed in main thread
```

### 5.5 Default Registered Methods
- `show_window`: Show window (direct execution)
- `hide_window`: Hide window (direct execution)
- `close`: Close window (triggers signal → action queue)
- `minimize`: Minimize window (triggers signal → action queue)
- `maximize`: Maximize window (triggers signal → action queue)
- `restore`: Restore window (triggers signal → action queue)
- `restart`: Restart application (triggers action queue)

## 6. Component Integration

### 6.1 Title Bar Integration

**Flow**: Title Bar Button → Signal → Handler → Action Queue → Native/Callback

```
CustomTitleBar (tkinter widget in main thread)
    |
    Button Click (e.g., minimize_btn)
    |
    v
_on_minimize_click()
    |
    v
signal_manager.emit(SignalType.WINDOW_MINIMIZE)
    |
    v
[Signal Queue] --> process_signals() in main loop
    |
    v
_handle_window_minimize(signal)
    |
    v
action_queue.execute(ActionType.MINIMIZE, native_minimize)
    |
    v
Execute: User Callbacks (if registered) or native_minimize
```

**Key Point**: Title bar runs in main thread, can directly call signal_manager.emit()

### 6.2 System Tray Integration

**Flow**: Tray Menu → Main Executor → Method → Signal/Action

```
SystemTray (pystray, separate thread)
    |
    Menu Click (e.g., "Minimize")
    |
    v
_tray_minimize() callback
    |
    v
main_executor.call('minimize')
    |
    v
[Method Queue] --> execute_pending() in main loop
    |
    v
_method_minimize()
    |
    v
signal_manager.emit(SignalType.WINDOW_MINIMIZE)
    |
    v
[Same flow as Title Bar above]
```

**Key Point**: Tray callbacks run in tray thread, must use main_executor to access main thread

### 6.3 Main Loop Processing Order

```python
while running:
    root.update()                    # 1. Process tkinter events
    signal_manager.process_signals() # 2. Process signals from title bar/etc
    main_executor.execute_pending()  # 3. Process methods from tray/etc
    process_command_queue()          # 4. Process direct commands
    time.sleep(0.01)                 # 5. Prevent CPU spinning
```

**Order is Critical**: Tkinter events must be processed first to ensure UI responsiveness.

## 7. WebView Integration

### 7.1 Supported Libraries (Fallback Chain)
1. **tkinterweb** (best integration, embedded in Tkinter)
2. **tkhtmlview** (fallback, basic HTML support)
3. **Fallback UI** (if no library available)

### 7.2 Loading Strategy
WebView loading is delayed until mainloop is running to prevent threading errors:

```python
# Immediate: Create widget
self.webview_widget = HtmlFrame(parent)

# Delayed: Load content after mainloop starts
self.root.after(1000, delayed_load)  # 1000ms delay
```

**Reason**: tkinterweb spawns background threads that call `after()`, which requires mainloop to be running.

## 8. Frameless Window Considerations

### 8.1 Override-Redirect Mode
When `frameless=True`:
```python
self.root.overrideredirect(True)  # Disables window manager
```

### 8.2 Limitations
**Cannot use standard window manager functions:**
- ❌ `root.iconify()` - Fails with "can't iconify: override-redirect flag is set"
- ❌ Window manager decorations disabled
- ❌ Standard minimize/maximize may not work

### 8.3 Workarounds
**Minimize**: Use `withdraw()` instead of `iconify()` in frameless mode
```python
if frameless:
    self.root.withdraw()  # Hide window
else:
    self.root.iconify()   # Minimize to taskbar
```

**Maximize**: Use `state('zoomed')` - May work in some cases
```python
self.root.state('zoomed')  # Full screen
```

## 9. Development Standards

### 9.1 Thread Safety Rules
1. **NEVER** call tkinter APIs from non-main threads
2. **ALWAYS** use SignalManager or MainThreadExecutor for cross-thread communication
3. **NEVER** directly access UI widgets from callbacks executed in other threads

### 9.2 Signal Usage
1. **Prefer signals** for UI-related events (window state changes, etc.)
2. Signals are processed in main loop, safe for tkinter operations
3. Register handlers using `signal_manager.register_handler()`

### 9.3 Action Queue Usage
1. **Register callbacks** to customize window behavior
2. **Call context.call_native()** if you want default behavior after custom logic
3. **Don't call native** if you want to completely override default behavior

### 9.4 Main Thread Executor Usage
1. **Register methods** that need to be callable from other threads
2. Methods registered will execute in main thread (tkinter-safe)
3. Use for tray menu callbacks and other external thread operations

### 9.5 Tray Integration
1. Tray callbacks execute in **tray thread** (pystray thread)
2. **Must use main_executor.call()** to interact with UI
3. **Never directly access** UI components from tray callbacks

## 10. Common Patterns

### 10.1 Add Custom Close Logic
```python
def cleanup_before_close(context: ActionContext):
    # Custom cleanup
    stop_services()
    save_state()

    # Then call native close
    context.call_native()

ui.register_action_callback(ActionType.CLOSE, cleanup_before_close)
```

### 10.2 Minimize to Tray (Override Default)
```python
def minimize_to_tray(context: ActionContext):
    # Hide window instead of minimizing
    ui.hide_window()
    # Don't call context.call_native() - we override default behavior

ui.register_action_callback(ActionType.MINIMIZE, minimize_to_tray)
```

### 10.3 Add Custom Tray Menu Action
```python
def my_action():
    # This runs in tray thread!
    # Must use main_executor to interact with UI
    ui.main_executor.call('show_window')

menu_items = [
    TrayMenuItem("My Action", callback=my_action),
    # ...
]
```

### 10.4 Add Periodic Task
```python
def check_updates():
    # This runs in timer thread
    # Use main_executor or signals to update UI
    pass

ui.add_task(check_updates, interval=60.0)  # Every 60 seconds
```

## 11. Known Issues and Limitations

### 11.1 Frameless Window Minimize
**Issue**: `iconify()` fails in override-redirect mode
**Workaround**: Use `withdraw()` to hide window instead

### 11.2 WebView Loading Errors
**Issue**: "main thread is not in main loop" when loading too early
**Solution**: Delay loading until after mainloop starts (1000ms+ delay)

### 11.3 Tray Menu Responsiveness
**Issue**: Tray callbacks may appear unresponsive if main loop is blocked
**Solution**: Keep main thread operations fast, use background threads for heavy work

### 11.4 Multiple WebView Libraries
**Issue**: Different libraries have different capabilities
**Solution**: Framework provides fallback chain, test with target library

## 12. Debugging

### 12.1 Enable Debug Mode
```python
config = NativeUIThreadConfig(
    debug=True,  # Enable debug logging
    # ...
)
ui = NativeUIThread(config=config)
```

### 12.2 Debug Output Prefixes
- `[SignalManager]` - Signal emission and processing
- `[ActionQueue]` - Action execution and callbacks
- `[MainThreadExecutor]` - Main thread method calls
- `[TitleBar]` - Title bar events
- `[SystemTray]` - Tray events
- `[TaskTimer]` - Timer task execution
- `[NativeUIThread]` - Thread lifecycle

### 12.3 Common Debug Patterns
**Signal Not Processing**:
1. Check if signal was emitted (look for `Signal emitted:` message)
2. Check if handler is registered (look for `Registered handler:` message)
3. Check if main loop is running

**Action Not Executing**:
1. Check if action was triggered (look for `Executing action:` message)
2. Check if callbacks are registered (look for `Registered callback:` message)
3. Check if native implementation exists

**Tray Menu Not Working**:
1. Check if method is registered (look for `Registered main thread method:` message)
2. Check if call was queued (look for `Executing method:` message)
3. Check if tray thread is running

## 13. Web-First UI Architecture

### 13.1 Design Philosophy
**IMPORTANT**: Native UI Framework uses **web (webview) as the primary UI component**, NOT traditional Tkinter widgets.

Tkinter is used ONLY for the application shell:
- ✅ Window frame and chrome (frameless window container)
- ✅ Custom title bar (minimize, maximize, close buttons)
- ✅ Window borders and resize handles
- ✅ System tray icon

**DO NOT** use Tkinter widgets for application content:
- ❌ No Tkinter labels, buttons, text widgets for app UI
- ❌ No Tkinter frames for content layout
- ❌ No Tkinter canvas for custom drawing

**DO** use web technologies for application content:
- ✅ HTML/CSS/JavaScript in webview
- ✅ Local HTML files or remote URLs
- ✅ Modern web frameworks (Vue, React, etc.)
- ✅ Full CSS styling and animations

### 13.2 Architecture Layers

```
┌─────────────────────────────────────────┐
│  Tkinter Shell (Window Chrome)         │
│  ┌───────────────────────────────────┐ │
│  │ Custom Title Bar (Tkinter)        │ │
│  ├───────────────────────────────────┤ │
│  │                                   │ │
│  │  WebView Content (HTML/CSS/JS)    │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │ Your Application UI         │ │ │
│  │  │ (Web Technologies)          │ │ │
│  │  │                             │ │ │
│  │  │ - HTML5                     │ │ │
│  │  │ - CSS3                      │ │ │
│  │  │ - JavaScript                │ │ │
│  │  │ - Vue/React/etc.            │ │ │
│  │  └─────────────────────────────┘ │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│  Resize Handles (Tkinter)              │
└─────────────────────────────────────────┘
```

### 13.3 WebView Integration

**Configuration**:
```python
config = NativeUIThreadConfig(
    app_name="My App",
    # WebView content
    webview_url="http://localhost:3000",  # Remote URL
    # OR
    webview_url="/path/to/index.html",    # Local HTML file

    # Loading page (optional)
    enable_loading_page=True,              # Show loading page first
    loading_style=1,                       # 1-14 animation styles
    loading_text="Loading...",             # Custom text
    loading_background="#1e1e1e"           # Custom background
)
```

**WebView Engine Fallback Chain**:
1. **tkinterweb** (preferred) - Good HTML5 support, embeddable in Tkinter
2. **tkhtmlview** (fallback) - Basic HTML support
3. **No webview** - Shows error message

### 13.4 Loading Page System

The framework provides a built-in loading page that displays **before** the actual content loads, providing better user experience.

**How it works**:
1. Application starts
2. Loading page shows immediately (fast local HTML)
3. Actual content loads in background (may be slow remote URL)
4. Loading page hides when content is ready
5. Smooth transition to actual content

**Built-in Loading Styles** (14 options):
- Style 1: Wave - expanding ripple effect
- Style 2: Spinning ring
- Style 3: Pulsing circles
- Style 4: Flip animation
- Style 5: Rotating split
- Style 6: Splitting circles
- Style 7: Filling dots
- Style 8: Rolling shadows
- Style 9: Pulsing dots
- Style 10: Dual rotation
- Style 11: Counter rotation
- Style 12: 3D layers
- Style 13: Bouncing blocks
- Style 14: Progress bar

**Custom Loading Page**:
```python
config = NativeUIThreadConfig(
    enable_loading_page=True,
    loading_page_path="/path/to/custom/loading.html",  # Use custom HTML
    # OR use built-in with custom style
    loading_style=5,                       # Choose 1-14
    loading_text="Please wait...",         # Custom text
    loading_background="#000000"           # Custom background
)
```

**Disable Loading Page**:
```python
config = NativeUIThreadConfig(
    enable_loading_page=False  # Skip loading page
)
```

### 13.5 Benefits of Web-First Approach

**1. Modern UI Capabilities**:
- Full CSS3 styling, animations, transitions
- Responsive layouts with flexbox/grid
- Modern web components
- Rich multimedia support

**2. Development Experience**:
- Use familiar web technologies
- Leverage existing web frameworks
- Hot reload during development
- Browser dev tools for debugging

**3. Cross-Platform Consistency**:
- Same UI code works on all platforms
- Web standards ensure consistency
- No platform-specific widget issues

**4. Performance**:
- Hardware-accelerated rendering
- Efficient CSS animations
- Lazy loading of resources
- Progressive enhancement

**5. Maintainability**:
- Separation of shell (Tkinter) and content (Web)
- Independent updates to UI and shell
- Easier testing of web components
- Reusable across different shells

### 13.6 Communication Between Shell and WebView

**From Python to WebView** (evaluate JavaScript):
```python
# Using tkinterweb
self.webview_widget.load_html(f"""
<script>
    window.myData = {json.dumps(data)};
</script>
""")
```

**From WebView to Python** (custom protocol handlers):
```python
# Listen for custom URL schemes
# webview navigates to: pyapp://action?data=value
# Python intercepts and handles
```

### 13.7 Best Practices

**DO**:
- ✅ Use webview for all application UI
- ✅ Design UI with HTML/CSS/JavaScript
- ✅ Use loading page for better UX
- ✅ Choose appropriate loading style for your app
- ✅ Test with different webview engines
- ✅ Provide fallback for webview failures

**DON'T**:
- ❌ Don't mix Tkinter widgets with webview for content
- ❌ Don't create complex UIs with Tkinter
- ❌ Don't skip the loading page for remote URLs
- ❌ Don't assume specific webview engine is available
- ❌ Don't create blocking operations in webview

**Example: Good vs Bad**:
```python
# ❌ BAD - Using Tkinter widgets for content
def create_ui(parent):
    label = tk.Label(parent, text="Hello")
    button = tk.Button(parent, text="Click")
    # ... more Tkinter widgets

# ✅ GOOD - Using webview for content
config = NativeUIThreadConfig(
    webview_url="/path/to/app.html",
    enable_loading_page=True
)
# app.html contains all UI with modern web tech
```

## 14. Internationalization (I18n) System

### 13.1 Overview
Native UI Framework provides a comprehensive internationalization system for multi-language support with:
- Dynamic language switching
- System language auto-detection
- Language preference caching
- Dynamic translation registration
- Nested key access with dot notation

**IMPORTANT CODING STANDARD**: Do NOT hardcode UI strings. Always use i18n keys.

### 13.2 I18n Architecture

```
I18nManager (Singleton)
├── Translation Files (JSON)
│   ├── i18n_base.json (config)
│   ├── translations_zh.json
│   ├── translations_en.json
│   └── translations_*.json (extensible)
├── Language Cache (UI_STATE_CACHE_DIR)
│   └── language_config.json (index + code)
└── Language Change Listeners
```

### 13.3 Language Priority Order
1. Explicit `i18n_default_language` parameter (highest)
2. Cached language preference
3. System language auto-detection
4. Base config default language (lowest)

### 13.4 Configuration

```python
config = NativeUIThreadConfig(
    app_name="My App",
    # I18n settings
    enable_i18n=True,                   # Enable i18n system
    i18n_default_language=None,         # None = auto-detect
    i18n_use_system_language=True,      # Detect system language
    i18n_use_cache=True                 # Save/load from cache
)
```

### 13.5 Built-in Translation Files

**Default Languages**: `zh` (Chinese), `en` (English)

**File Structure**:
```
pycore/pyutils/native_ui/i18n/
├── i18n_base.json              # Base configuration
├── translations_zh.json        # Chinese translations
├── translations_en.json        # English translations
└── translations_*.json         # Your custom languages
```

**Base Configuration** (`i18n_base.json`):
```json
{
  "default_language": "zh",
  "supported_languages": ["zh", "en"]
}
```

**Translation File Format** (`translations_zh.json`):
```json
{
  "ui": {
    "title_bar": {
      "minimize": "最小化",
      "maximize": "最大化",
      "close": "关闭"
    },
    "tray": {
      "show": "显示窗口",
      "exit": "退出"
    }
  },
  "languages": {
    "zh": "中文",
    "en": "English"
  }
}
```

### 13.6 Dynamic Translation Registration

Applications can extend the translation system with custom keys:

```python
# In your application (e.g., matrix app)
ui_thread.register_translations({
    "zh": {
        "matrix": {
            "title": "矩阵应用",
            "start": "开始",
            "stop": "停止",
            "status": {
                "running": "运行中",
                "stopped": "已停止"
            }
        }
    },
    "en": {
        "matrix": {
            "title": "Matrix App",
            "start": "Start",
            "stop": "Stop",
            "status": {
                "running": "Running",
                "stopped": "Stopped"
            }
        }
    },
    "fa": {  # Persian - fully extensible
        "matrix": {
            "title": "برنامه ماتریس",
            "start": "شروع",
            "stop": "توقف"
        }
    }
})

# Use registered translations
title = ui_thread.get_text("matrix.title")  # "矩阵应用" or "Matrix App"
```

### 13.7 Using Translations

**Get translated text**:
```python
# Method 1: Via UI thread
text = ui_thread.get_text("ui.title_bar.minimize", default="Minimize")

# Method 2: Via I18nManager directly
from pycore.pyutils.native_ui.i18n import get_i18n_manager

i18n = get_i18n_manager()
text = i18n.get("ui.title_bar.close")

# Nested keys with dot notation
status_text = i18n.get("matrix.status.running")
```

**Change language programmatically**:
```python
# Method 1: Via UI thread
ui_thread.set_language("en")

# Method 2: Via I18nManager
i18n.set_language("zh")
```

**Get language information**:
```python
current = i18n.get_current_language()        # "zh"
supported = i18n.get_supported_languages()   # ["zh", "en"]
index = i18n.get_language_index()            # 0 (for "zh")
name = i18n.get_language_name("zh")          # "中文"
```

### 13.8 Language Change Listeners

Register listeners to update UI when language changes:

```python
def on_language_changed(language: str):
    """Called when language changes"""
    print(f"Language changed to: {language}")
    # Update UI components
    update_menu_labels()
    update_button_text()

# Register listener
i18n.add_listener(on_language_changed)
```

### 13.9 System Language Detection

The framework automatically detects system language using multiple methods:

**Detection Priority**:
1. `locale.getdefaultlocale()`
2. Environment variables (`LANG`, `LANGUAGE`, `LC_ALL`)
3. Platform-specific APIs (Windows: `GetUserDefaultUILanguage`)

**Windows Language Detection Example**:
```python
# Auto-detects system language on Windows
config = NativeUIThreadConfig(
    enable_i18n=True,
    i18n_use_system_language=True  # Will detect zh, en, etc.
)
```

### 13.10 Language Cache System

Language preference is automatically cached to user data directory:

**Cache Location**: `{UI_STATE_CACHE_DIR}/language_config.json`

**Cache Format**:
```json
{
  "language": "zh",
  "language_index": 0,
  "supported_languages": ["zh", "en"]
}
```

**Cache Benefits**:
- Remembers user language preference across sessions
- Stores both language code and index for flexibility
- Automatically updated when language changes
- Falls back to system detection if cache is invalid

### 13.11 Extending with New Languages

To add a new language (e.g., French):

1. **Update base configuration** (`i18n/i18n_base.json`):
```json
{
  "default_language": "zh",
  "supported_languages": ["zh", "en", "fr"]
}
```

2. **Create translation file** (`i18n/translations_fr.json`):
```json
{
  "ui": {
    "title_bar": {
      "minimize": "Réduire",
      "maximize": "Maximiser",
      "close": "Fermer"
    }
  },
  "languages": {
    "fr": "Français"
  }
}
```

3. **No code changes required** - the framework automatically loads new languages

### 13.12 UI Integration Examples

**System Tray Language Menu** (Auto-generated):
```
Language           →  [Current: 中文]
├── 中文 (zh)
├── English (en)
└── Français (fr)
```

**Title Bar Language Dropdown** (Future feature):
```
[中文 ▼]  |  Minimize  Maximize  Close
```

### 13.13 Best Practices

**DO**:
- ✅ Use i18n keys for ALL user-facing strings
- ✅ Use nested keys for organization (`"app.feature.action"`)
- ✅ Provide meaningful default values
- ✅ Register custom translations early in app lifecycle
- ✅ Test all languages before release

**DON'T**:
- ❌ Hardcode UI strings in code
- ❌ Mix translated and untranslated strings
- ❌ Assume language order in lists
- ❌ Forget to add keys to all language files

**Example: Bad vs Good**:
```python
# ❌ BAD - Hardcoded strings
button.config(text="开始")

# ✅ GOOD - Using i18n
button.config(text=ui_thread.get_text("app.button.start"))
```

### 13.14 Image Conversion System

The framework automatically handles image format conversion for logo and icons:

**Supported Formats**: SVG, PNG, JPG, GIF, BMP, and all PIL-supported formats

**Auto-conversion Features**:
- SVG to PNG conversion (using cairosvg or fallback)
- Automatic caching in user data directory
- Smart cache validation (checks source file modification time)
- Resize during conversion

**Usage** (automatic, no code needed):
```python
config = NativeUIThreadConfig(
    logo_path="logo.svg",  # SVG automatically converted to PNG
    logo_size=24
)
```

**Cache Location**: `{APP_CACHE_DIR}/images/`

**Conversion Methods Priority**:
1. `cairosvg` (best quality)
2. `svglib` + `reportlab`
3. Placeholder fallback (diamond icon)

## 14. Extension Points

### 14.1 Custom Signals
Define custom signals for application-specific events:
```python
class MySignalType(Enum):
    DATA_UPDATED = "data_updated"
    CONNECTION_LOST = "connection_lost"

signal_manager.emit(MySignalType.DATA_UPDATED, data={'value': 123})
```

### 14.2 Custom Actions
Define custom actions that don't have native implementations:
```python
class MyActionType:
    EXPORT_DATA = "export_data"
    REFRESH = "refresh"

action_queue.register(MyActionType.EXPORT_DATA, my_export_callback)
```

### 14.3 Custom Tray Menu
Add dynamic menu items or submenus:
```python
submenu = [
    TrayMenuItem("Option 1", callback=opt1),
    TrayMenuItem("Option 2", callback=opt2)
]

menu_items = [
    TrayMenuItem("Settings", submenu=submenu),
    TrayMenuItem.SEPARATOR,
    TrayMenuItem("Exit", callback=on_exit)
]
```

## 15. Performance Considerations

### 15.1 Main Loop Frequency
Default: 100 Hz (0.01s delay)
- Faster: Lower delay, higher CPU usage, better responsiveness
- Slower: Higher delay, lower CPU usage, possible lag

### 15.2 Signal Queue Size
Unbounded queue - signals are processed ASAP in main loop
- High signal rate: Consider batching or debouncing
- Critical signals: Process immediately, skip queue

### 15.3 Timer Task Overhead
Timer runs in separate thread, minimal impact on main loop
- Heavy tasks: Offload to worker threads
- UI updates: Use signals or main_executor

### 15.4 WebView Performance
tkinterweb: Full HTML5, higher memory usage
tkhtmlview: Basic HTML, lower memory usage
- Complex content: Use tkinterweb
- Simple content: Use tkhtmlview

## 16. Testing Guidelines

### 16.1 Unit Testing
Test components independently:
- SignalManager: Test signal emission and handling
- ActionQueue: Test callback execution and native calls
- MainThreadExecutor: Test method registration and execution

### 16.2 Integration Testing
Test component interactions:
- Title Bar → Signal → Action: Test button clicks
- Tray → Executor → Signal → Action: Test tray menu
- Timer → Signal → Action: Test periodic updates

### 16.3 Thread Safety Testing
Verify thread-safe operations:
- Concurrent signal emissions
- Concurrent method calls
- Concurrent action executions

## 17. Migration Guide

### 17.1 From Direct tkinter
Replace direct tkinter calls with signals:
```python
# Before
button.config(command=lambda: root.destroy())

# After
button.config(command=lambda: signal_manager.emit(SignalType.WINDOW_CLOSE))
```

### 16.2 From Other Threads
Replace direct UI access with executors:
```python
# Before (WRONG - crashes)
def worker_thread():
    label.config(text="Done")  # Crashes!

# After (CORRECT)
def worker_thread():
    main_executor.call('update_label', text="Done")
```

### 16.3 From Callback-Based
Replace callbacks with action queue:
```python
# Before
window.protocol("WM_DELETE_WINDOW", cleanup_and_close)

# After
ui.register_action_callback(ActionType.CLOSE, cleanup_and_close)
```
