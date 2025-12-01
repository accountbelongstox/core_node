#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Startup Window - Python Native (Tkinter) Initialization Window

This window displays BEFORE check_and_install_dependencies() is called.
It shows a title and real-time installation logs using ColorPrint.

IMPORTANT: This is the ONLY component using pure Python/Tkinter.
All other UI components should use PySide6.

NOTE: tkinter is loaded lazily via third_party.py to ensure
system dependencies (python3-tk) are installed first on Linux.
"""

import queue
import threading
from typing import Optional, Callable, Any
import sys
import io

from pycore import THREAD_BUS, ColorPrint
from pycore.pyfoundations.third_party import get_third_package_tkinter

# Get tkinter via third_party manager (auto-installs python3-tk on Linux)
tk = get_third_package_tkinter()
ttk = tk.ttk


class StartupWindow:
    """
    Python native startup window for displaying initialization logs.

    This window:
    - Uses pure Tkinter (no external dependencies)
    - Displays before PySide6 is installed
    - Shows real-time ColorPrint logs
    - Can be closed programmatically when initialization completes

    Usage:
        startup = StartupWindow(app_name="My App")
        startup.show()

        # In initialization code:
        startup.log("Installing dependencies...")

        # When done:
        startup.close()
    """

    def __init__(
        self,
        app_name: str = "Application",
        width: int = 500,
        height: int = 400,
        on_complete: Optional[Callable] = None,
        icon_path: Optional[str] = None,
        logo_path: Optional[str] = None,
        enable_language_selector: bool = True,
        i18n_manager: Optional[Any] = None,
        daemon: bool = True
    ):
        """
        Initialize startup window.

        Args:
            app_name: Application name to display
            width: Window width
            height: Window height
            on_complete: Callback when initialization completes
            icon_path: Path to window icon (.ico or .png)
            logo_path: Path to logo image displayed in title (.png)
            enable_language_selector: Show language selector (default: True)
            i18n_manager: I18nManager instance for multi-language support
            daemon: Run as daemon thread (default: True) - auto-terminates with main thread
        """
        self.app_name = app_name
        self.width = width
        self.height = height
        self.on_complete = on_complete
        self.icon_path = icon_path
        self.logo_path = logo_path
        self.enable_language_selector = enable_language_selector
        self.i18n_manager = i18n_manager
        self.daemon = daemon

        # Type annotations as strings to avoid import errors
        self.root: Optional[Any] = None  # tk.Tk
        self.text_widget: Optional[Any] = None  # tk.Text
        self.progress_bar: Optional[Any] = None  # ttk.Progressbar
        self.status_label: Optional[Any] = None  # tk.Label
        self.language_var: Optional[Any] = None  # tk.StringVar
        self.language_frame: Optional[Any] = None  # tk.Frame

        self._running = False
        self._log_queue = queue.Queue()
        self._thread: Optional[threading.Thread] = None
        self._closed_event = threading.Event()  # Event to signal window closed

        # ColorPrint callback for automatic log capture
        self._colorprint_callback = None
        self._colorprint_registered = False

    def show(self):
        """
        Show the startup window in a separate thread.
        This allows the main thread to continue with initialization.

        Automatically registers ColorPrint callback to capture all logs.
        """
        if self._running:
            return

        self._running = True

        # Register ColorPrint callback to capture all console output
        self._register_colorprint_callback()

        # Create thread with configurable daemon mode
        self._thread = threading.Thread(target=self._run_ui, daemon=self.daemon)
        self._thread.start()

    def _register_colorprint_callback(self):
        """
        Register ColorPrint callback to capture all console output.

        This allows all ColorPrint.blue/green/red/etc messages to automatically
        appear in the startup window, without needing manual log() calls.
        """
        if self._colorprint_registered:
            return

        def colorprint_callback(message: str, color_type: str, log_level: str = None):
            """
            Callback that receives all ColorPrint output.

            Args:
                message: The log message
                color_type: Color type (green, red, blue, yellow, gray, white)
                log_level: Optional log level override
            """
            # Map color_type to log level for text widget tags
            level_map = {
                'green': 'success',
                'red': 'error',
                'yellow': 'warning',
                'blue': 'info',
                'gray': 'debug',
                'white': 'info'
            }

            # Use provided log_level or map from color_type
            level = log_level if log_level else level_map.get(color_type, 'info')

            # Send to log queue (thread-safe)
            self.log(message, level=level)

        # Register callback with ColorPrint
        ColorPrint.register_callback(colorprint_callback)
        self._colorprint_callback = colorprint_callback
        self._colorprint_registered = True

    def _run_ui(self):
        """Run the UI in its own thread."""
        # Create root window
        self.root = tk.Tk()
        self.root.title(f"{self.app_name} - Initializing...")
        self.root.geometry(f"{self.width}x{self.height}")

        # Hide window initially to prevent flash
        self.root.withdraw()

        # Set window icon if provided
        if self.icon_path:
            try:
                # Try to set icon (supports .ico and .png)
                from pathlib import Path
                if Path(self.icon_path).exists():
                    if self.icon_path.endswith('.ico'):
                        self.root.iconbitmap(self.icon_path)
                    else:
                        # For PNG, create PhotoImage
                        icon_image = tk.PhotoImage(file=self.icon_path)
                        self.root.iconphoto(True, icon_image)
            except Exception as e:
                pass  # Ignore icon errors

        # Prevent window close during startup
        self.root.protocol("WM_DELETE_WINDOW", self._on_close_attempt)

        # Create UI
        self._create_ui()

        # Center window (after UI is created)
        self._center_window()

        # Show window after everything is ready
        self.root.deiconify()

        # Start log processing
        self._process_logs()

        # Run mainloop
        self.root.mainloop()

        self._running = False

    def _center_window(self):
        """Center the window on screen."""
        self.root.update_idletasks()
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()

        x = (screen_width - self.width) // 2
        y = (screen_height - self.height) // 2

        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")

    def _create_ui(self):
        """Create the UI components."""
        # Title frame
        title_frame = tk.Frame(self.root, bg="#2c3e50", height=60)
        title_frame.pack(fill=tk.X)
        title_frame.pack_propagate(False)

        # If logo provided, create frame with logo + title
        if self.logo_path:
            try:
                from pathlib import Path
                from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageTk

                # Get PIL modules via third_party manager
                Image = get_third_package_PIL_Image()
                ImageTk = get_third_package_PIL_ImageTk()

                if Path(self.logo_path).exists():
                    # Container for logo + title
                    title_container = tk.Frame(title_frame, bg="#2c3e50")
                    title_container.pack(expand=True)

                    # Load and resize logo
                    logo_img = Image.open(self.logo_path)
                    logo_img = logo_img.resize((32, 32), Image.Resampling.LANCZOS)
                    logo_photo = ImageTk.PhotoImage(logo_img)

                    # Logo label
                    logo_label = tk.Label(
                        title_container,
                        image=logo_photo,
                        bg="#2c3e50"
                    )
                    logo_label.image = logo_photo  # Keep reference
                    logo_label.pack(side=tk.LEFT, padx=(0, 10))

                    # Title label
                    title_label = tk.Label(
                        title_container,
                        text=self.app_name,
                        font=("Microsoft YaHei UI", 16, "bold"),
                        bg="#2c3e50",
                        fg="#ecf0f1"
                    )
                    title_label.pack(side=tk.LEFT)
                else:
                    # Logo file not found, just show title
                    title_label = tk.Label(
                        title_frame,
                        text=self.app_name,
                        font=("Microsoft YaHei UI", 16, "bold"),
                        bg="#2c3e50",
                        fg="#ecf0f1"
                    )
                    title_label.pack(pady=15)
            except ImportError:
                # PIL not available, just show title
                title_label = tk.Label(
                    title_frame,
                    text=self.app_name,
                    font=("Microsoft YaHei UI", 16, "bold"),
                    bg="#2c3e50",
                    fg="#ecf0f1"
                )
                title_label.pack(pady=15)
            except Exception as e:
                # Any error, fallback to title only
                title_label = tk.Label(
                    title_frame,
                    text=self.app_name,
                    font=("Microsoft YaHei UI", 16, "bold"),
                    bg="#2c3e50",
                    fg="#ecf0f1"
                )
                title_label.pack(pady=15)
        else:
            # No logo, just show title
            title_label = tk.Label(
                title_frame,
                text=self.app_name,
                font=("Microsoft YaHei UI", 16, "bold"),
                bg="#2c3e50",
                fg="#ecf0f1"
            )
            title_label.pack(pady=15)

        # Main content frame
        content_frame = tk.Frame(self.root, bg="#34495e")
        content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Log display (Text widget with scrollbar)
        log_frame = tk.Frame(content_frame, bg="#34495e")
        log_frame.pack(fill=tk.BOTH, expand=True)

        scrollbar = tk.Scrollbar(log_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.text_widget = tk.Text(
            log_frame,
            wrap=tk.WORD,
            bg="#1e1e1e",
            fg="#d4d4d4",
            font=("Consolas", 9),
            state=tk.DISABLED,
            yscrollcommand=scrollbar.set
        )
        self.text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.text_widget.yview)

        # Configure text tags for colors
        self.text_widget.tag_config("info", foreground="#4ec9b0")
        self.text_widget.tag_config("success", foreground="#6a9955")
        self.text_widget.tag_config("warning", foreground="#dcdcaa")
        self.text_widget.tag_config("error", foreground="#f48771")
        self.text_widget.tag_config("debug", foreground="#9cdcfe")

        # Language selector (if enabled and i18n available)
        if self.enable_language_selector and self.i18n_manager:
            self._create_language_selector(self.root)

        # Status frame
        status_frame = tk.Frame(self.root, bg="#34495e", height=60)
        status_frame.pack(fill=tk.X)
        status_frame.pack_propagate(False)

        # Progress bar
        self.progress_bar = ttk.Progressbar(
            status_frame,
            mode='indeterminate',
            length=self.width - 40
        )
        self.progress_bar.pack(pady=(10, 5))
        self.progress_bar.start(10)

        # Status label
        self.status_label = tk.Label(
            status_frame,
            text="Initializing...",
            bg="#34495e",
            fg="#bdc3c7",
            font=("Microsoft YaHei UI", 9)
        )
        self.status_label.pack()

    def _process_logs(self):
        """Process log messages from queue."""
        if not self._running or not self.root:
            return

        # Process all pending logs
        while not self._log_queue.empty():
            log_data = self._log_queue.get_nowait()
            self._append_log(log_data['message'], log_data['level'])

        # Schedule next check
        if self._running:
            self.root.after(100, self._process_logs)

    def _append_log(self, message: str, level: str = "info"):
        """
        Append log message to text widget.

        Args:
            message: Log message
            level: Log level (info, success, warning, error, debug)
        """
        if not self.text_widget:
            return

        self.text_widget.config(state=tk.NORMAL)
        self.text_widget.insert(tk.END, message + "\n", level)
        self.text_widget.see(tk.END)
        self.text_widget.config(state=tk.DISABLED)

    def log(self, message: str, level: str = "info"):
        """
        Add a log message (thread-safe).

        Args:
            message: Log message
            level: Log level (info, success, warning, error, debug)
        """
        self._log_queue.put({
            'message': message,
            'level': level
        })

    def set_status(self, status: str):
        """
        Update status label (thread-safe).

        Args:
            status: Status text
        """
        if self.root and self.status_label:
            self.root.after(0, lambda: self.status_label.config(text=status))

    def close(self):
        """Close the startup window."""
        if not self._running:
            return

        # Set flag first to stop all loops
        self._running = False

        # Unregister ColorPrint callback
        if self._colorprint_registered and self._colorprint_callback:
            ColorPrint.unregister_callback(self._colorprint_callback)
            self._colorprint_registered = False
            self._colorprint_callback = None

        # Call completion callback
        if self.on_complete:
            self.on_complete()

        # Close window with proper cleanup
        if self.root:
            def _safe_close():
                # Stop progress bar animation BEFORE destroying window
                if self.progress_bar:
                    try:
                        self.progress_bar.stop()
                    except:
                        pass

                # Cancel all pending after() callbacks
                try:
                    for after_id in self.root.tk.call('after', 'info'):
                        self.root.after_cancel(after_id)
                except:
                    pass

                # Destroy window
                try:
                    self.root.quit()
                    self.root.destroy()
                except:
                    pass

            # Schedule cleanup in main thread
            self.root.after(0, _safe_close)

    def _create_language_selector(self, parent):
        """Create language selector with radio buttons

        Args:
            parent: Parent widget
        """
        self.language_frame = tk.Frame(parent, bg="#34495e")
        self.language_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

        # Title
        lang_label = tk.Label(
            self.language_frame,
            text="Language / 语言 / 言語:",
            bg="#34495e",
            fg="#ecf0f1",
            font=("Microsoft YaHei UI", 9, "bold")
        )
        lang_label.pack(anchor=tk.W, pady=(0, 5))

        # Radio buttons container
        radio_container = tk.Frame(self.language_frame, bg="#34495e")
        radio_container.pack(anchor=tk.W)

        # StringVar for selected language
        self.language_var = tk.StringVar(value="auto")

        # Option 1: Follow System (Default)
        auto_radio = tk.Radiobutton(
            radio_container,
            text="🌐 Follow System / 跟随系统 / システムに従う",
            variable=self.language_var,
            value="auto",
            bg="#34495e",
            fg="#ecf0f1",
            selectcolor="#2c3e50",
            activebackground="#34495e",
            activeforeground="#ecf0f1",
            font=("Microsoft YaHei UI", 9),
            command=self._on_language_change
        )
        auto_radio.pack(anchor=tk.W, padx=5)

        # Get supported languages from i18n
        supported_languages = self.i18n_manager.get_supported_languages()

        # Language display names
        lang_display = {
            "en": "🇬🇧 English",
            "zh": "🇨🇳 简体中文",
            "ja": "🇯🇵 日本語"
        }

        # Create radio button for each language
        for lang in supported_languages:
            display_name = lang_display.get(lang, lang.upper())

            radio = tk.Radiobutton(
                radio_container,
                text=display_name,
                variable=self.language_var,
                value=lang,
                bg="#34495e",
                fg="#ecf0f1",
                selectcolor="#2c3e50",
                activebackground="#34495e",
                activeforeground="#ecf0f1",
                font=("Microsoft YaHei UI", 9),
                command=self._on_language_change
            )
            radio.pack(anchor=tk.W, padx=5)

    def _on_language_change(self):
        """Handle language change - immediately redraw window"""
        selected = self.language_var.get()

        if selected == "auto":
            # Detect and use system language
            system_lang = self.i18n_manager._detect_system_language()
            supported = self.i18n_manager.get_supported_languages()

            if system_lang in supported:
                self.i18n_manager.set_language(system_lang)
            else:
                # Fallback to first supported language
                self.i18n_manager.set_language(supported[0])
        else:
            # Use selected language
            self.i18n_manager.set_language(selected)

        # Update app name from i18n
        new_app_name = self.i18n_manager.get("app.name", default=self.app_name)

        # Update window title
        if self.root:
            title_text = self.i18n_manager.get("window.title.initializing",
                                              default=f"{new_app_name} - Initializing...")
            self.root.title(title_text)

        # Log the language change
        current_lang = self.i18n_manager.get_current_language()
        lang_name = self.i18n_manager.get(f"language.name.{current_lang}", default=current_lang)
        self.log(f"Language changed to: {lang_name}", level="info")

    def _on_close_attempt(self):
        """Handle user attempting to close window."""
        # Check if initialization is complete via THREAD_BUS signal (thread-safe)
        if THREAD_BUS.has_signal('startup_window.initialization_complete'):
            # Initialization complete, allow user to close window
            self.close()
        else:
            # Still initializing, prevent close
            self.log("Please wait for initialization to complete...", "warning")

    def is_running(self) -> bool:
        """Check if startup window is running."""
        return self._running


class ColorPrintCapture:
    """
    Capture ColorPrint output and redirect to StartupWindow or TkinterStartupThread.

    This allows ColorPrint messages to appear in the startup window.

    Usage:
        # With StartupWindow
        startup = StartupWindow()
        startup.show()
        capture = ColorPrintCapture(startup)
        capture.start()

        # Or with TkinterStartupThread
        from pycore.pyutils.native_ui.startup_window_thread import TkinterStartupThread
        startup_thread = TkinterStartupThread()
        startup_thread.start()
        capture = ColorPrintCapture(startup_thread)
        capture.start()

        # Now ColorPrint messages will appear in startup window
        ColorPrint.blue("Installing...")

        capture.stop()
        startup.close()
    """

    def __init__(self, startup_window):
        """
        Initialize capture.

        Args:
            startup_window: StartupWindow or TkinterStartupThread instance with log() method
        """
        self.startup_window = startup_window
        self._original_stdout = None
        self._original_stderr = None
        self._capturing = False

    def start(self):
        """Start capturing ColorPrint output."""
        if self._capturing:
            return

        # Store original streams
        self._original_stdout = sys.stdout
        self._original_stderr = sys.stderr

        # Redirect to custom stream
        sys.stdout = self._StreamCapture(self.startup_window, "info")
        sys.stderr = self._StreamCapture(self.startup_window, "error")

        self._capturing = True

    def stop(self):
        """Stop capturing and restore original streams."""
        if not self._capturing:
            return

        # Restore original streams
        sys.stdout = self._original_stdout
        sys.stderr = self._original_stderr

        self._capturing = False

    class _StreamCapture(io.StringIO):
        """Custom stream that captures output to startup window."""

        def __init__(self, startup_window, level: str):
            """
            Initialize stream capture.

            Args:
                startup_window: StartupWindow or TkinterStartupThread with log() method
                level: Log level (info, error, etc.)
            """
            super().__init__()
            self.startup_window = startup_window
            self.level = level

        def write(self, text: str):
            """Write text to startup window."""
            if text and text.strip():
                self.startup_window.log(text.strip(), self.level)
            return len(text)


# Test/Example usage
if __name__ == "__main__":
    import time

    def test_startup_window():
        """Test the startup window."""
        startup = StartupWindow(app_name="Test Application")
        startup.show()

        # Simulate initialization
        time.sleep(1)
        startup.log("Checking dependencies...", "info")
        time.sleep(1)
        startup.log("Installing: pyside6", "info")
        time.sleep(2)
        startup.log("✓ pyside6 installed successfully", "success")
        time.sleep(1)
        startup.log("Installing: requests", "info")
        time.sleep(1)
        startup.log("✓ requests installed successfully", "success")
        time.sleep(1)
        startup.set_status("Initialization complete!")
        startup.log("All dependencies installed successfully", "success")
        time.sleep(2)

        startup.close()

    test_startup_window()
