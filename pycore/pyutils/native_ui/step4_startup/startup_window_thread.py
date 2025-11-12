#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TkinterStartupThread - Thread-Safe Startup Window

Follows project multi-threading standards:
- Directly inherits threading.Thread (not using Thread(target=func))
- Uses THREAD_BUS for all communication (no callbacks or parameters)
- Signals ready/closed states via THREAD_BUS
- Main thread can wait for signals without blocking

Standard thread lifecycle:
1. __init__() - Initialize (no start)
2. start() - Start thread (from main thread)
3. run() - Thread execution (automatic)
4. THREAD_BUS signals:
   - 'TkinterStartup_ready' - Window is visible and running
   - 'TkinterStartup_closed' - Window closed by user or programmatically
   - 'TkinterStartup_stopped' - Thread finished

Usage:
    from pycore import THREAD_BUS
    from pycore.pyutils.native_ui.startup_window_thread import TkinterStartupThread

    # Start window
    startup = TkinterStartupThread(app_name="My App")
    startup.start()

    # Wait for ready
    if THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=3.0):
        print("Window is ready")

    # Add logs
    startup.log("Installing dependencies...")
    startup.set_status("Working...")

    # Close window
    startup.request_close()

    # Wait for closed
    THREAD_BUS.wait_signal('TkinterStartup_closed', timeout=3.0)
"""

import sys
import queue
import threading
import time
import os
from typing import Optional, Any
from pathlib import Path

# Import standard library tkinter (avoid local tkinter package)
import tkinter as tk
from tkinter import ttk

# Import after tkinter to avoid circular import
from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.native_ui.step0_i18n import i18n
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TkinterSystemTray, TrayMenuItem as TkinterTrayMenuItem
from pycore.pyutils.native_ui.step1_config.tray_config import TrayMenuItem
from pycore.pyutils.native_ui.step7_managers.thread_bus_manager import get_bus_manager, BusSignals
from PIL import Image, ImageTk


class TkinterStartupThread(threading.Thread):
    """
    Tkinter startup window thread

    Follows project standards:
    - Direct Thread inheritance
    - THREAD_BUS communication
    - No parameter passing
    - Clear state signals
    """

    def __init__(
        self,
        app_name: str = "Application",
        width: int = 500,
        height: int = 400,
        icon_path: Optional[str] = None,
        logo_path: Optional[str] = None,
        enable_language_selector: bool = True,
        enable_tray: bool = False
    ):
        """
        Initialize startup window thread

        Args:
            app_name: Application name to display
            width: Window width
            height: Window height
            icon_path: Path to window icon (.ico or .png)
            logo_path: Path to logo image (.png)
            enable_language_selector: Show language selector
            enable_tray: Enable system tray menu (persists after debug window closes)
        """
        super().__init__()
        self.daemon = False  # Non-daemon - main thread should wait

        # Window configuration
        self.app_name = app_name
        self.width = width
        self.height = height
        self.icon_path = icon_path
        self.logo_path = logo_path
        self.enable_language_selector = enable_language_selector
        self.enable_tray = enable_tray

        # UI components (created in run())
        self.root: Optional[tk.Tk] = None
        self.text_widget: Optional[tk.Text] = None
        self.progress_bar: Optional[ttk.Progressbar] = None
        self.status_label: Optional[tk.Label] = None
        self.language_var: Optional[tk.StringVar] = None
        self.language_frame: Optional[tk.Frame] = None

        # Tray components (created if enable_tray is True)
        self.tray: Optional[Any] = None

        # Thread control
        self._stop_event = threading.Event()
        self._log_queue = queue.Queue()
        self._running = False

    def run(self):
        """Thread execution (called automatically by start())"""
        thread_name = self.__class__.__name__

        # 1. Log startup
        ColorPrint.blue(f"[{thread_name}] Thread starting")

        # 2. Set starting state
        THREAD_BUS.set_thread_state(thread_name, 'starting',
                                     pid=os.getpid(),
                                     thread_id=threading.get_ident())

        # 3. Initialize UI
        self._initialize_ui()

        # 4. Set running state + send ready signal
        THREAD_BUS.set_thread_state(thread_name, 'running')
        THREAD_BUS.signal('TkinterStartup_ready', {
            'app_name': self.app_name,
            'window_size': (self.width, self.height)
        })

        # 5. Run mainloop (blocks until window closes)
        self._running = True
        self.root.mainloop()

        # 6. Cleanup window resources
        self._cleanup()

        # 7. Check if tray should be started
        if self.enable_tray and not self._stop_event.is_set():
            ColorPrint.blue(f"[{thread_name}] Debug window closed, starting tray menu...")
            self._run_tray_mode()

        # 8. Set stopped state + send stopped signal
        THREAD_BUS.set_thread_state(thread_name, 'stopped')
        THREAD_BUS.signal('TkinterStartup_stopped', True)

        # 9. Log completion
        ColorPrint.blue(f"[{thread_name}] Thread stopped")

    def _initialize_ui(self):
        """Initialize Tkinter UI"""
        # Create root window
        self.root = tk.Tk()
        self.root.title(f"{self.app_name} - Initializing...")
        self.root.geometry(f"{self.width}x{self.height}")

        # Hide window initially
        self.root.withdraw()

        # Set icon if provided
        if self.icon_path and Path(self.icon_path).exists():
            try:
                if self.icon_path.endswith('.ico'):
                    self.root.iconbitmap(self.icon_path)
                else:
                    icon_image = tk.PhotoImage(file=self.icon_path)
                    self.root.iconphoto(True, icon_image)
            except:
                pass

        # Set close protocol
        self.root.protocol("WM_DELETE_WINDOW", self._on_user_close)

        # Create UI components
        self._create_ui()

        # Center window
        self._center_window()

        # Show window
        self.root.deiconify()

        # Start log processing
        self._process_logs()

    def _center_window(self):
        """Center window on screen"""
        self.root.update_idletasks()
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()

        x = (screen_width - self.width) // 2
        y = (screen_height - self.height) // 2

        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")

    def _create_ui(self):
        """Create UI components"""
        # Title frame
        title_frame = tk.Frame(self.root, bg="#2c3e50", height=60)
        title_frame.pack(fill=tk.X)
        title_frame.pack_propagate(False)

        # Logo + Title
        if self.logo_path and Path(self.logo_path).exists():
            try:
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
                logo_label.image = logo_photo
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
            except:
                # Fallback to title only
                title_label = tk.Label(
                    title_frame,
                    text=self.app_name,
                    font=("Microsoft YaHei UI", 16, "bold"),
                    bg="#2c3e50",
                    fg="#ecf0f1"
                )
                title_label.pack(pady=15)
        else:
            # No logo, just title
            title_label = tk.Label(
                title_frame,
                text=self.app_name,
                font=("Microsoft YaHei UI", 16, "bold"),
                bg="#2c3e50",
                fg="#ecf0f1"
            )
            title_label.pack(pady=15)

        # Content frame
        content_frame = tk.Frame(self.root, bg="#34495e")
        content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Log display
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

        # Language selector (if enabled)
        if self.enable_language_selector:
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

    def _create_language_selector(self, parent):
        """Create language selector with radio buttons"""
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

        # Auto option
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

        # Language options
        supported_languages = i18n.get_supported_languages()
        lang_display = {
            "en": "🇬🇧 English",
            "zh": "🇨🇳 简体中文",
            "ja": "🇯🇵 日本語"
        }

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
        """Handle language change"""
        selected = self.language_var.get()

        if selected == "auto":
            system_lang = i18n._detect_system_language()
            supported = i18n.get_supported_languages()

            if system_lang in supported:
                i18n.set_language(system_lang)
            else:
                i18n.set_language(supported[0])
        else:
            i18n.set_language(selected)

        # Update window title
        new_app_name = i18n.get("app.name", default=self.app_name)

        if self.root:
            title_text = i18n.get("window.title.initializing",
                                              default=f"{new_app_name} - Initializing...")
            self.root.title(title_text)

        # Log change
        current_lang = i18n.get_current_language()
        lang_name = i18n.get(f"language.name.{current_lang}", default=current_lang)
        self.log(f"Language changed to: {lang_name}", level="info")

    def _process_logs(self):
        """Process log messages from queue"""
        if not self._running or not self.root:
            return

        # Process all pending logs
        while not self._log_queue.empty():
            try:
                log_data = self._log_queue.get_nowait()
                self._append_log(log_data['message'], log_data['level'])
            except queue.Empty:
                break

        # Schedule next check
        if self._running:
            self.root.after(100, self._process_logs)

    def _append_log(self, message: str, level: str = "info"):
        """Append log message to text widget"""
        if not self.text_widget:
            return

        self.text_widget.config(state=tk.NORMAL)
        self.text_widget.insert(tk.END, message + "\n", level)
        self.text_widget.see(tk.END)
        self.text_widget.config(state=tk.DISABLED)

    def _run_tray_mode(self):
        """
        Run tray-only mode (after debug window closes)

        Gets tray configuration from THREAD_BUS manager and runs system tray.
        Blocks until tray.stop() is called.
        """
        # Get tray configuration from THREAD_BUS manager
        bus_mgr = get_bus_manager()
        tray_config = bus_mgr.get_tray_config()

        if not tray_config or not tray_config.enabled:
            ColorPrint.yellow("[TkinterStartupThread] No tray config found or tray disabled")
            return

        ColorPrint.green("[TkinterStartupThread] Tray config found in THREAD_BUS")

        # Store original tray_config for language updates
        self._tray_config = tray_config

        # Build initial menu items
        menu_items = self._build_tray_menu_items(tray_config)

        # Create tray
        self.tray = TkinterSystemTray(
            app_name=tray_config.app_name,
            icon_path=tray_config.icon_path,
            menu_items=menu_items
        )

        # Register event handler for TRAY_STOP signal (event-driven architecture)
        def on_tray_stop(event_data):
            """Handle TRAY_STOP event - stop the tray"""
            source = event_data.get('source', 'unknown')
            ColorPrint.yellow(f"[TkinterStartupThread] Received TRAY_STOP signal (source: {source})")
            if self.tray:
                self.tray.stop()

        THREAD_BUS.register_event_handler(BusSignals.TRAY_STOP, on_tray_stop, priority=20)
        ColorPrint.green("[TkinterStartupThread] Registered TRAY_STOP event handler")

        # Register event handler for UI redraw (language change)
        def on_ui_redraw(event_data):
            """Handle UI redraw event - update tray menu when language changes"""
            reason = event_data.get('reason', '')
            if reason == 'language_changed' and self.tray and self._tray_config:
                ColorPrint.blue("[TkinterStartupThread] Language changed, updating tray menu...")
                # Rebuild menu items with new translations
                new_menu_items = self._build_tray_menu_items(self._tray_config)
                self.tray.update_menu(new_menu_items)
                ColorPrint.green("[TkinterStartupThread] Tray menu updated with new language")

        bus_mgr.on_ui_redraw(on_ui_redraw)
        ColorPrint.green("[TkinterStartupThread] Registered UI redraw event handler")

        ColorPrint.blue("[TkinterStartupThread] Starting system tray...")

        # Signal that tray is starting
        THREAD_BUS.set_thread_state('TkinterStartupThread', 'tray_running')

        # Run tray (blocks until stopped)
        self.tray.run()

        ColorPrint.blue("[TkinterStartupThread] Tray stopped")

    def _build_tray_menu_items(self, tray_config):
        """
        Build tray menu items from tray_config
        
        Dynamically translates text_key using i18n.get() based on current language.
        
        Args:
            tray_config: TrayConfig object
            
        Returns:
            List of TrayMenuItem objects for TkinterSystemTray
        """
        menu_items = []
        for item in tray_config.menu_items:
            if item.text_key == "---":
                menu_items.append(TkinterTrayMenuItem.SEPARATOR)
            else:
                # Dynamically get translation from i18n.get(text_key) based on current language
                display_text = i18n.get(item.text_key)
                
                # Create TkinterTrayMenuItem with action_signal (tkinter_system_tray format)
                menu_item = TkinterTrayMenuItem(
                    text=display_text,
                    action_signal=item.signal,  # Convert 'signal' to 'action_signal'
                    enabled=item.enabled,
                    default=item.default
                )
                menu_items.append(menu_item)
        
        return menu_items

    def _cleanup(self):
        """Cleanup resources"""
        self._running = False

        # Stop progress bar BEFORE destroying window
        if self.progress_bar:
            try:
                self.progress_bar.stop()
            except:
                pass

        # Cancel all pending after callbacks
        if self.root:
            try:
                # Get all after callbacks and cancel them
                for after_id in self.root.tk.call('after', 'info'):
                    try:
                        self.root.after_cancel(after_id)
                    except:
                        pass
            except:
                pass

        # CRITICAL: Explicitly clean up Tkinter variables BEFORE destroying root
        # This prevents "RuntimeError: main thread is not in main loop" error
        # when Python's garbage collector tries to clean up StringVar.__del__
        # after the Tcl interpreter context has been destroyed
        if self.language_var:
            try:
                # Delete the variable while Tcl context is still valid
                del self.language_var
                self.language_var = None
            except:
                pass

    def _on_user_close(self):
        """Handle user attempting to close window"""
        self.log("Closing startup window...", "info")
        self._close_window()

    def _close_window(self):
        """Actually close the window"""
        self._running = False

        # Send closed signal
        THREAD_BUS.signal('TkinterStartup_closed', True)

        # Destroy window
        if self.root:
            self.root.quit()
            self.root.destroy()

    # ============ Public API (thread-safe) ============

    def log(self, message: str, level: str = "info"):
        """
        Add log message (thread-safe)

        Args:
            message: Log message
            level: Log level (info, success, warning, error, debug)
        """
        self._log_queue.put({
            'message': message,
            'level': level
        })

    def _colorprint_callback(self, message: str, color_type: str, log_level: str = None):
        """
        ColorPrint callback - receives all ColorPrint output

        Args:
            message: Message text
            color_type: Color type (green, red, yellow, blue, white, gray)
            log_level: Log level (SUCCESS, ERROR, WARNING, INFO, DEBUG)
        """
        # Map ColorPrint levels to startup window levels
        level_map = {
            "SUCCESS": "success",
            "ERROR": "error",
            "WARNING": "warning",
            "INFO": "info",
            "DEBUG": "debug",
        }
        level = level_map.get(log_level, "info") if log_level else "info"
        self.log(message, level)

    def set_status(self, status: str):
        """
        Update status label (thread-safe)

        Args:
            status: Status text
        """
        if self.root and self.status_label:
            self.root.after(0, lambda: self.status_label.config(text=status))

    def request_close(self):
        """
        Request window to close (thread-safe)
        Can be called from any thread
        """
        if self.root:
            self.root.after(0, self._close_window)

    def stop(self):
        """
        Stop thread (window and tray if running)

        This will:
        1. Close debug window if still open
        2. Stop tray if it's running
        3. Terminate thread
        """
        # Signal stop event
        self._stop_event.set()

        # Close window if still running
        self.request_close()

        # Stop tray if running
        if self.tray:
            self.tray.stop()

    def is_running(self) -> bool:
        """Check if window is running"""
        return self._running


# Test
if __name__ == "__main__":
    from pycore import THREAD_BUS

    ColorPrint.blue("=== Testing TkinterStartupThread ===")

    # Start window thread
    startup = TkinterStartupThread(app_name="Test Application")
    startup.start()

    # Wait for ready
    ColorPrint.yellow("Waiting for window to be ready...")
    if THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=3.0):
        ColorPrint.green("Window is ready!")
    else:
        ColorPrint.red("Window startup timeout!")

    # Add logs
    startup.log("Checking dependencies...", "info")
    time.sleep(1)
    startup.log("Installing packages...", "info")
    time.sleep(1)
    startup.log("✓ Installation complete", "success")
    time.sleep(1)
    startup.set_status("Ready!")
    time.sleep(2)

    # Close window
    ColorPrint.yellow("Closing window...")
    startup.request_close()

    # Wait for closed
    if THREAD_BUS.wait_signal('TkinterStartup_closed', timeout=3.0):
        ColorPrint.green("Window closed!")
    else:
        ColorPrint.red("Window close timeout!")

    # Wait for thread to stop
    if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
        ColorPrint.green("Thread stopped!")

    ColorPrint.blue("\n=== Test Complete ===")
    ColorPrint.blue(f"THREAD_BUS stats: {THREAD_BUS.stats()}")
