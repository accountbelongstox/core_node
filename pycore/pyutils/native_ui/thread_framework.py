"""
Native UI Framework - Thread-based Framework

This module provides a threading.Thread-based UI framework similar to SeleniumThread pattern.
The UI starts as a thread when instantiated, no additional launcher required.

Usage:
    ui_thread = NativeUIThread(
        app_name="My App",
        width=800,
        height=600,
        on_ready=callback_function
    )
    ui_thread.start()  # Starts the UI thread

    # Later...
    ui_thread.stop()   # Stops the UI thread
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import threading
import tkinter as tk
import time
import queue
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass, field

from pycore import ColorPrint

from pycore.pyutils.native_ui.config import UIConfig, WindowState
from pycore.pyutils.native_ui.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
from pycore.pyutils.native_ui.title_bar import CustomTitleBar
from pycore.pyutils.native_ui.system_tray import SystemTray, TrayMenuItem


@dataclass
class NativeUIThreadConfig:
    """Configuration for NativeUIThread"""

    # Application settings
    app_name: str = "Native UI Application"
    width: int = 800
    height: int = 600

    # Window settings
    show_on_start: bool = True
    resizable: bool = True
    frameless: bool = True
    transparent: bool = False
    always_on_top: bool = False

    # UI settings
    theme: str = "dark"
    background_color: str = "#1e1e1e"

    # WebView settings (if ui_source is provided, webview is used instead of on_create_content)
    ui_source: Optional[str] = None  # URL or file path for webview

    # System Tray settings
    enable_tray: bool = False  # Enable system tray
    tray_menu_items: Optional[List] = None  # List of TrayMenuItem objects
    tray_icon_path: Optional[str] = None  # Path to tray icon image
    tray_tooltip: Optional[str] = None  # Tray icon tooltip

    # Callbacks
    on_ready: Optional[Callable] = None
    on_close: Optional[Callable] = None
    on_create_content: Optional[Callable] = None

    # Timer settings
    task_timer_interval: float = 1.0

    # Debug
    debug: bool = False

    # Additional custom data
    custom_data: Dict[str, Any] = field(default_factory=dict)


class NativeUIThread(threading.Thread):
    """
    Native UI Thread - Threading.Thread-based UI Framework

    This class inherits from threading.Thread, allowing the UI to be started
    as a thread directly without needing external launchers.

    Architecture:
        - Main UI thread (this thread)
        - Signal processing (internal)
        - Task timer (internal)

    Usage:
        # Create UI thread
        ui = NativeUIThread(
            app_name="My App",
            width=800,
            height=600,
            on_ready=lambda: print("UI Ready!")
        )

        # Start UI thread
        ui.start()

        # Access UI components
        ui.wait_until_ready()
        ui.set_title("New Title")

        # Stop UI
        ui.stop()
    """

    def __init__(
        self,
        config: Optional[NativeUIThreadConfig] = None,
        thread_name: str = "NativeUIThread",
        daemon: bool = False,
        **kwargs
    ):
        """
        Initialize Native UI Thread

        Args:
            config: NativeUIThreadConfig object, if None will use kwargs
            thread_name: Thread name
            daemon: Daemon mode
            **kwargs: Additional config parameters (merged with config)
        """
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Create config from kwargs if not provided
        if config is None:
            config = NativeUIThreadConfig(**kwargs)
        else:
            # Merge kwargs into config
            for key, value in kwargs.items():
                if hasattr(config, key):
                    setattr(config, key, value)

        self.config = config

        # Convert to UIConfig for internal use
        # Map NativeUIThreadConfig parameters to UIConfig parameters
        self.ui_config = UIConfig(
            app_name=config.app_name,
            window_size=(config.width, config.height),
            show_on_start=config.show_on_start,
            resizable=config.resizable,
            frameless=config.frameless,
            debug=config.debug
        )

        # Thread control
        self._running = False
        self._ready = threading.Event()
        self._stop_event = threading.Event()

        # UI components (created in run())
        self.root: Optional[tk.Tk] = None
        self.title_bar: Optional[CustomTitleBar] = None
        self.content_frame: Optional[tk.Frame] = None
        self.system_tray: Optional[SystemTray] = None

        # Framework components
        self.signal_manager = SignalManager(debug=config.debug)
        self.task_timer = TaskTimer(tick_interval=config.task_timer_interval, debug=config.debug)
        self.main_executor = MainThreadExecutor(debug=config.debug)

        # Command queue for cross-thread communication
        self.command_queue = queue.Queue()

        # Window state
        self.window_state = WindowState.HIDDEN if not config.show_on_start else WindowState.NORMAL

        # Register default handlers
        self._register_default_handlers()

        ColorPrint.blue(f"[{self.name}] Native UI Thread initialized: {config.app_name}")

    def _register_default_handlers(self):
        """Register default signal handlers"""
        self.signal_manager.register_handler(SignalType.WINDOW_CLOSE, self._handle_window_close)
        self.signal_manager.register_handler(SignalType.WINDOW_MINIMIZE, self._handle_window_minimize)
        self.signal_manager.register_handler(SignalType.WINDOW_MAXIMIZE, self._handle_window_maximize)
        self.signal_manager.register_handler(SignalType.WINDOW_RESTORE, self._handle_window_restore)

    def run(self):
        """
        Thread entry point - creates and runs UI
        This method is called when thread.start() is invoked
        """
        ColorPrint.green(f"[{self.name}] Thread started")
        self._running = True

        try:
            # Create Tkinter UI
            self._create_ui()

            # Mark as ready
            self._ready.set()

            # Call on_ready callback
            if self.config.on_ready:
                try:
                    self.config.on_ready()
                except Exception as e:
                    ColorPrint.red(f"[{self.name}] on_ready callback error: {e}")

            # Start internal threads
            self._start_internal_threads()

            # Start system tray if enabled
            if self.config.enable_tray:
                self._start_system_tray()

            # Run main UI loop
            self._run_mainloop()

        except Exception as e:
            ColorPrint.red(f"[{self.name}] Error in run(): {e}")
            import traceback
            traceback.print_exc()
        finally:
            self._running = False
            self._cleanup()
            ColorPrint.yellow(f"[{self.name}] Thread stopped")

    def _create_ui(self):
        """Create Tkinter UI components"""
        ColorPrint.blue(f"[{self.name}] Creating UI...")

        # Create root window
        self.root = tk.Tk()
        self.root.title(self.config.app_name)
        self.root.geometry(f"{self.config.width}x{self.config.height}")

        # Configure root
        if self.config.frameless:
            self.root.overrideredirect(True)

        self.root.configure(bg=self.config.background_color)

        if not self.config.resizable:
            self.root.resizable(False, False)

        if self.config.always_on_top:
            self.root.attributes('-topmost', True)

        # Create title bar (if frameless)
        if self.config.frameless:
            self.title_bar = CustomTitleBar(
                self.root,
                self.ui_config,
                self.signal_manager
            )
            self.title_bar.pack(fill=tk.X)

        # Create content frame
        self.content_frame = tk.Frame(self.root, bg=self.config.background_color)
        self.content_frame.pack(fill=tk.BOTH, expand=True)

        # Create content: webview if ui_source provided, otherwise call on_create_content
        if self.config.ui_source:
            try:
                self._create_webview(self.content_frame, self.config.ui_source)
            except Exception as e:
                ColorPrint.red(f"[{self.name}] webview creation error: {e}")
        elif self.config.on_create_content:
            try:
                self.config.on_create_content(self.content_frame)
            except Exception as e:
                ColorPrint.red(f"[{self.name}] on_create_content error: {e}")

        # Bind window close
        self.root.protocol("WM_DELETE_WINDOW", self._on_window_close)

        # Initial window state
        if not self.config.show_on_start:
            self.root.withdraw()

        ColorPrint.green(f"[{self.name}] UI created")

    def _create_webview(self, parent: tk.Frame, url: str):
        """
        Create webview widget with fallback chain

        Tries in order:
        1. pywebview (best support, full browser engine)
        2. tkinterweb (good HTML5 support)
        3. tkhtmlview (basic HTML support)

        Args:
            parent: Parent frame
            url: URL or file path to display
        """
        ColorPrint.blue(f"[{self.name}] Creating webview for: {url}")

        # Try pywebview first (best support, already installed)
        try:
            import webview as pywebview

            ColorPrint.blue(f"[{self.name}] Using pywebview for webview")

            # Create pywebview window with parent window
            # Note: pywebview creates its own window, we need to embed it
            # For now, create standalone window
            self.webview_widget = pywebview.create_window(
                self.config.app_name,
                url,
                width=self.config.width,
                height=self.config.height
            )

            # Start pywebview in background thread
            def start_pywebview():
                """Start pywebview in separate thread"""
                try:
                    pywebview.start()
                except Exception as e:
                    ColorPrint.red(f"[{self.name}] pywebview start error: {e}")

            webview_thread = threading.Thread(target=start_pywebview, daemon=True)
            webview_thread.start()

            ColorPrint.green(f"[{self.name}] Pywebview started: {url}")
            return

        except ImportError:
            ColorPrint.yellow(f"[{self.name}] pywebview not available, trying alternative...")
        except Exception as e:
            ColorPrint.yellow(f"[{self.name}] pywebview error: {e}, trying alternative...")

        # Try tkinterweb second (better HTML5 support)
        try:
            from tkinterweb import HtmlFrame

            ColorPrint.blue(f"[{self.name}] Using tkinterweb for webview")

            self.webview_widget = HtmlFrame(parent)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)

            # Load URL
            if url.startswith('http://') or url.startswith('https://'):
                self.webview_widget.load_website(url)
            else:
                # Load from file
                with open(url, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                self.webview_widget.load_html(html_content)

            ColorPrint.green(f"[{self.name}] Webview loaded successfully: {url}")
            return

        except ImportError:
            ColorPrint.yellow(f"[{self.name}] tkinterweb not available, trying alternative...")
        except Exception as e:
            ColorPrint.yellow(f"[{self.name}] tkinterweb error: {e}, trying alternative...")

        # Try tkhtmlview as fallback
        try:
            from tkhtmlview import HTMLScrolledText
            import requests

            ColorPrint.blue(f"[{self.name}] Using tkhtmlview for webview")

            self.webview_widget = HTMLScrolledText(parent)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)

            # Fetch and display HTML
            if url.startswith('http://') or url.startswith('https://'):
                try:
                    response = requests.get(url, timeout=5)
                    if response.status_code == 200:
                        self.webview_widget.set_html(response.text)
                        ColorPrint.green(f"[{self.name}] HTML loaded: {url}")
                    else:
                        self._show_webview_error(parent, f"Failed to load: {url} (Status: {response.status_code})")
                except Exception as e:
                    self._show_webview_error(parent, f"Failed to fetch URL: {e}")
            else:
                # Load from file
                with open(url, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                self.webview_widget.set_html(html_content)
                ColorPrint.green(f"[{self.name}] HTML loaded from file: {url}")

            return

        except ImportError:
            ColorPrint.yellow(f"[{self.name}] tkhtmlview not available")
        except Exception as e:
            ColorPrint.yellow(f"[{self.name}] tkhtmlview error: {e}")

        # No webview available - show info message
        self._show_webview_unavailable(parent, url)

    def _show_webview_unavailable(self, parent: tk.Frame, url: str):
        """
        Show message when webview is not available

        Args:
            parent: Parent frame
            url: Target URL
        """
        info_frame = tk.Frame(parent, bg="#1e1e1e")
        info_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title_label = tk.Label(
            info_frame,
            text="WebView Not Available",
            font=("Arial", 24, "bold"),
            bg="#1e1e1e",
            fg="white"
        )
        title_label.pack(pady=30)

        # Info message
        info_lines = [
            "WebView library not available",
            "",
            "To use embedded webview, install one of:",
            "  pip install pywebview",
            "  pip install tkinterweb",
            "  pip install tkhtmlview",
            "",
            f"Target URL: {url}",
            "",
            "You can access the URL directly in your browser:"
        ]

        for line in info_lines:
            label = tk.Label(
                info_frame,
                text=line,
                font=("Courier New", 11),
                bg="#1e1e1e",
                fg="#00ff00" if line.startswith("  pip") else "white",
                justify=tk.LEFT
            )
            label.pack(pady=2)

        # URL button
        def open_in_browser():
            """Open URL in default browser"""
            import webbrowser
            webbrowser.open(url)
            ColorPrint.blue(f"[{self.name}] Opened in browser: {url}")

        url_button = tk.Button(
            info_frame,
            text=f"Open {url} in Browser",
            command=open_in_browser,
            font=("Arial", 14, "bold"),
            bg="#0078d4",
            fg="white",
            activebackground="#005a9e",
            activeforeground="white",
            relief=tk.FLAT,
            padx=30,
            pady=15,
            cursor="hand2"
        )
        url_button.pack(pady=20)

        ColorPrint.yellow(f"[{self.name}] Showing webview unavailable message")

    def _show_webview_error(self, parent: tk.Frame, error_message: str):
        """
        Show error message

        Args:
            parent: Parent frame
            error_message: Error message to display
        """
        error_frame = tk.Frame(parent, bg="#1e1e1e")
        error_frame.pack(fill=tk.BOTH, expand=True)

        error_label = tk.Label(
            error_frame,
            text=f"Error loading webview:\n\n{error_message}",
            font=("Arial", 12),
            bg="#1e1e1e",
            fg="red",
            justify=tk.CENTER
        )
        error_label.pack(expand=True)

        ColorPrint.red(f"[{self.name}] Webview error: {error_message}")

    def _start_system_tray(self):
        """Start system tray with configured menu items"""
        ColorPrint.blue(f"[{self.name}] Starting system tray...")

        # Use provided tooltip or default to app name
        tooltip = self.config.tray_tooltip or self.config.app_name

        # Create default menu items if none provided
        menu_items = self.config.tray_menu_items
        if not menu_items:
            # Create default menu
            menu_items = [
                TrayMenuItem(
                    text="Show Window",
                    callback=lambda: self.show_window(),
                    default=True
                ),
                TrayMenuItem(
                    text="Hide Window",
                    callback=lambda: self.hide_window()
                ),
                TrayMenuItem.SEPARATOR,
                TrayMenuItem(
                    text="Exit",
                    callback=lambda: self.stop()
                )
            ]

        # Create system tray
        self.system_tray = SystemTray(
            app_name=self.config.app_name,
            menu_items=menu_items,
            icon_path=self.config.tray_icon_path,
            tooltip=tooltip,
            on_left_click=lambda: self.show_window()
        )

        # Start tray in background
        self.system_tray.start_async()

        ColorPrint.green(f"[{self.name}] System tray started")

    def _start_internal_threads(self):
        """Start internal threads (signal processor, task timer)"""
        # Start signal processing thread
        self._signal_thread = threading.Thread(
            target=self._signal_processing_loop,
            name=f"{self.name}-SignalProcessor",
            daemon=True
        )
        self._signal_thread.start()

        # Start task timer thread
        self._task_thread = threading.Thread(
            target=self._task_timer_loop,
            name=f"{self.name}-TaskTimer",
            daemon=True
        )
        self._task_thread.start()

        ColorPrint.blue(f"[{self.name}] Internal threads started")

    def _signal_processing_loop(self):
        """Signal processing loop (runs in separate thread)"""
        while self._running:
            try:
                # Process signals
                self.signal_manager.process_signals()

                # Execute main thread methods
                self.main_executor.execute_pending()

                # Process command queue
                self._process_command_queue()

                time.sleep(0.01)
            except Exception as e:
                ColorPrint.red(f"[{self.name}] Signal processing error: {e}")

    def _task_timer_loop(self):
        """Task timer loop (runs in separate thread)"""
        self.task_timer.run()

    def _process_command_queue(self):
        """Process commands from command queue"""
        while not self.command_queue.empty():
            try:
                command, args, kwargs = self.command_queue.get_nowait()

                if command == 'set_title':
                    if self.root:
                        self.root.title(args[0])
                elif command == 'show':
                    if self.root:
                        self.root.deiconify()
                elif command == 'hide':
                    if self.root:
                        self.root.withdraw()
                elif command == 'close':
                    self._request_close()

            except queue.Empty:
                break
            except Exception as e:
                ColorPrint.red(f"[{self.name}] Command processing error: {e}")

    def _run_mainloop(self):
        """Run Tkinter mainloop with periodic updates"""
        ColorPrint.blue(f"[{self.name}] Starting mainloop...")

        while self._running and self.root:
            try:
                # Process Tkinter events
                self.root.update()

                # Check for stop signal
                if self._stop_event.is_set():
                    break

                time.sleep(0.01)
            except tk.TclError:
                # Window was destroyed
                break
            except Exception as e:
                ColorPrint.red(f"[{self.name}] Mainloop error: {e}")
                break

    def _cleanup(self):
        """Cleanup resources"""
        ColorPrint.blue(f"[{self.name}] Cleaning up...")

        # Stop system tray
        if self.system_tray and self.system_tray.is_running():
            self.system_tray.stop()

        # Stop task timer
        self.task_timer.stop()

        # Destroy UI
        if self.root:
            try:
                self.root.destroy()
            except:
                pass

        # Call on_close callback
        if self.config.on_close:
            try:
                self.config.on_close()
            except Exception as e:
                ColorPrint.red(f"[{self.name}] on_close callback error: {e}")

    # ============================================
    # Event Handlers
    # ============================================

    def _on_window_close(self):
        """Handle window close event"""
        self.signal_manager.emit(SignalType.WINDOW_CLOSE)

    def _handle_window_close(self, signal: Signal):
        """Handle window close signal"""
        ColorPrint.yellow(f"[{self.name}] Handling window close signal")
        self.stop()

    def _handle_window_minimize(self, signal: Signal):
        """Handle window minimize signal"""
        if self.root:
            self.root.iconify()
            self.window_state = WindowState.MINIMIZED

    def _handle_window_maximize(self, signal: Signal):
        """Handle window maximize signal"""
        if self.root:
            self.root.state('zoomed')
            self.window_state = WindowState.MAXIMIZED

    def _handle_window_restore(self, signal: Signal):
        """Handle window restore signal"""
        if self.root:
            self.root.state('normal')
            self.window_state = WindowState.NORMAL

    def _request_close(self):
        """Request to close the UI"""
        self._stop_event.set()

    # ============================================
    # Public API
    # ============================================

    def stop(self):
        """Stop the UI thread"""
        ColorPrint.yellow(f"[{self.name}] Stopping UI thread...")
        self._running = False
        self._stop_event.set()

    def wait_until_ready(self, timeout: Optional[float] = None):
        """
        Wait until UI is ready

        Args:
            timeout: Timeout in seconds (None = wait forever)

        Returns:
            bool: True if ready, False if timeout
        """
        return self._ready.wait(timeout)

    def is_ready(self) -> bool:
        """Check if UI is ready"""
        return self._ready.is_set()

    def is_running(self) -> bool:
        """Check if thread is running"""
        return self._running

    def set_title(self, title: str):
        """Set window title (thread-safe)"""
        self.command_queue.put(('set_title', (title,), {}))

    def show_window(self):
        """Show window (thread-safe)"""
        self.command_queue.put(('show', (), {}))

    def hide_window(self):
        """Hide window (thread-safe)"""
        self.command_queue.put(('hide', (), {}))

    def close_window(self):
        """Close window (thread-safe)"""
        self.command_queue.put(('close', (), {}))

    def add_task(self, task_func: Callable, interval: float = 1.0):
        """
        Add a timer task

        Args:
            task_func: Task function to execute
            interval: Interval in seconds
        """
        self.task_timer.add_task(task_func, interval)

    def remove_task(self, task_func: Callable):
        """Remove a timer task"""
        self.task_timer.remove_task(task_func)

    def emit_signal(self, signal_type: SignalType, data: Any = None):
        """Emit a signal"""
        self.signal_manager.emit(signal_type, data)

    def register_signal_handler(self, signal_type: SignalType, handler: Callable):
        """Register a signal handler"""
        self.signal_manager.register_handler(signal_type, handler)

    def get_status(self) -> Dict[str, Any]:
        """Get thread status"""
        return {
            'running': self._running,
            'ready': self._ready.is_set(),
            'alive': self.is_alive(),
            'window_state': self.window_state.name if self.window_state else None,
            'thread_name': self.name
        }
