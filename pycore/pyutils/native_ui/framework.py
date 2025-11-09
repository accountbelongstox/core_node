#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Main Framework Module
Native UI Framework Main Module
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

# Import ColorPrint for logging
from pycore.pyfoundations.color_print import ColorPrint

import tkinter as tk
import threading
import time
import sys
import os
from typing import Optional, Callable, Dict, Any

from pycore.pyutils.native_ui.config import UIConfig, WindowState
from pycore.pyutils.native_ui.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
from pycore.pyutils.native_ui.title_bar import CustomTitleBar


class NativeUIFramework:
    """
    Native UI Framework Main Class
    Implements three-thread architecture: Main thread (signal processing), Task thread (timer), UI thread (interface)
    """

    def __init__(self, config: UIConfig):
        """
        Initialize UI framework

        Args:
            config: UI configuration object
        """
        self.config = config

        # Signal manager
        self.signal_manager = SignalManager(debug=config.debug)

        # Task timer (default 1 second tick)
        self.task_timer = TaskTimer(tick_interval=1.0, debug=config.debug)

        # Main thread method executor
        self.main_executor = MainThreadExecutor(debug=config.debug)

        # Register default signal handlers
        self._register_default_handlers()

        # Register default main thread methods
        self._register_default_methods()

        # Thread related
        self.main_thread: Optional[threading.Thread] = None
        self.task_thread: Optional[threading.Thread] = None
        self.ui_thread: Optional[threading.Thread] = None

        # Running state
        self.running = False
        self.ui_ready = False

        # UI components (created in UI thread)
        self.root: Optional[tk.Tk] = None
        self.title_bar: Optional[CustomTitleBar] = None
        self.content_frame: Optional[tk.Frame] = None
        self.webview_widget = None

        # Window state
        self.window_state = WindowState.HIDDEN if not config.show_on_start else WindowState.NORMAL

        ColorPrint.green(f"[NativeUI] UI framework initialized: {config.app_name}")

    def _register_default_handlers(self):
        """Register default signal handlers"""
        self.signal_manager.register_handler(SignalType.WINDOW_CLOSE, self._handle_window_close)
        self.signal_manager.register_handler(SignalType.WINDOW_MINIMIZE, self._handle_window_minimize)
        self.signal_manager.register_handler(SignalType.WINDOW_MAXIMIZE, self._handle_window_maximize)
        self.signal_manager.register_handler(SignalType.WINDOW_RESTORE, self._handle_window_restore)
        self.signal_manager.register_handler(SignalType.WINDOW_RESTART, self._handle_window_restart)

    def _register_default_methods(self):
        """Register default main thread methods"""
        self.main_executor.register_method('close', self._method_close)
        self.main_executor.register_method('minimize', self._method_minimize)
        self.main_executor.register_method('maximize', self._method_maximize)
        self.main_executor.register_method('restore', self._method_restore)

    # ============================================
    # Signal Handlers
    # ============================================

    def _handle_window_close(self, signal: Signal):
        """Handle window close signal"""
        ColorPrint.yellow("[NativeUI] Handling window close signal")
        self.stop()

    def _handle_window_minimize(self, signal: Signal):
        """Handle window minimize signal"""
        ColorPrint.blue("[NativeUI] Handling window minimize signal")
        self.main_executor.call('minimize')

    def _handle_window_maximize(self, signal: Signal):
        """Handle window maximize signal"""
        ColorPrint.blue("[NativeUI] Handling window maximize signal")
        self.main_executor.call('maximize')

    def _handle_window_restore(self, signal: Signal):
        """Handle window restore signal"""
        ColorPrint.blue("[NativeUI] Handling window restore signal")
        self.main_executor.call('restore')

    def _handle_window_restart(self, signal: Signal):
        """Handle application restart signal"""
        ColorPrint.yellow("[NativeUI] Handling application restart signal")
        self.stop()
        # Restart application
        import subprocess
        subprocess.Popen([sys.executable] + sys.argv)

    # ============================================
    # Main Thread Methods
    # ============================================

    def _method_close(self):
        """Main thread method: Close window"""
        if self.root:
            self.root.quit()

    def _method_minimize(self):
        """Main thread method: Minimize window"""
        if self.root:
            self.root.iconify()
            self.window_state = WindowState.MINIMIZED

    def _method_maximize(self):
        """Main thread method: Maximize window"""
        if self.root:
            self.root.state('zoomed')
            self.window_state = WindowState.MAXIMIZED

    def _method_restore(self):
        """Main thread method: Restore window"""
        if self.root:
            self.root.state('normal')
            self.window_state = WindowState.NORMAL

    # ============================================
    # Thread Entry Points
    # ============================================

    def _main_thread_entry(self):
        """Main thread entry - Process signals and main thread method calls"""
        ColorPrint.green("[NativeUI] Main thread started")

        while self.running:
            try:
                # Process signals
                self.signal_manager.process_signals()

                # Execute main thread methods
                self.main_executor.execute_pending()

                # Brief sleep to avoid high CPU usage
                time.sleep(0.01)

            except Exception as e:
                ColorPrint.red(f"[NativeUI] Main thread exception: {e}")

        ColorPrint.yellow("[NativeUI] Main thread stopped")

    def _task_thread_entry(self):
        """Task thread entry - Run Task timer"""
        ColorPrint.green("[NativeUI] Task thread started")

        # Run timer (blocking)
        self.task_timer.run()

        ColorPrint.yellow("[NativeUI] Task thread stopped")

    def _ui_thread_entry(self):
        """UI thread entry - Create and run Tkinter mainloop"""
        ColorPrint.green("[NativeUI] UI thread started")

        try:
            # Create Tkinter root window
            self.root = tk.Tk()
            self.root.title(self.config.app_name)

            # Set window size
            width, height = self.config.window_size
            self.root.geometry(f"{width}x{height}")

            # Set minimum window size
            min_width, min_height = self.config.min_window_size
            self.root.minsize(min_width, min_height)

            # Frameless window
            if self.config.frameless:
                self.root.overrideredirect(True)

            # Set icon
            if self.config.icon_path and os.path.exists(self.config.icon_path):
                try:
                    self.root.iconbitmap(self.config.icon_path)
                except:
                    pass

            # Create custom title bar
            if self.config.frameless:
                self.title_bar = CustomTitleBar(
                    self.root,
                    self.config,
                    self.signal_manager
                )
                self.title_bar.pack(side=tk.TOP, fill=tk.X)

            # Create content area
            self.content_frame = tk.Frame(self.root, bg='white')
            self.content_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

            # Load UI content
            if self.config.ui_source:
                self._load_ui_content()

            # Initial display state
            if not self.config.show_on_start:
                self.root.withdraw()

            # Bind close event
            self.root.protocol("WM_DELETE_WINDOW", self._on_window_close_event)

            # Mark UI as ready
            self.ui_ready = True
            self.signal_manager.emit(SignalType.UI_READY)

            ColorPrint.green("[NativeUI] UI ready, entering mainloop")

            # Enter Tkinter mainloop
            self.root.mainloop()

        except Exception as e:
            ColorPrint.red(f"[NativeUI] UI thread exception: {e}")

        finally:
            ColorPrint.yellow("[NativeUI] UI thread stopped")

    def _load_ui_content(self):
        """Load UI content (URL or HTML)"""
        if not self.config.ui_source:
            return

        source = self.config.ui_source

        # Determine if URL or local file
        if source.startswith('http://') or source.startswith('https://'):
            self._load_url(source)
        elif os.path.exists(source):
            self._load_html_file(source)
        else:
            ColorPrint.yellow(f"[NativeUI] Invalid UI source: {source}")

    def _load_url(self, url: str):
        """Load remote URL"""
        try:
            # Try using tkinterweb
            from tkinterweb import HtmlFrame
            self.webview_widget = HtmlFrame(self.content_frame)
            self.webview_widget.load_website(url)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)
            ColorPrint.green(f"[NativeUI] Loaded URL using tkinterweb: {url}")
        except ImportError:
            try:
                # Try using tkhtmlview
                from tkhtmlview import HTMLLabel
                self.webview_widget = HTMLLabel(self.content_frame, html=f'<iframe src="{url}"></iframe>')
                self.webview_widget.pack(fill=tk.BOTH, expand=True)
                ColorPrint.green(f"[NativeUI] Loaded URL using tkhtmlview: {url}")
            except ImportError:
                # Fallback: Display information message
                label = tk.Label(
                    self.content_frame,
                    text=f"WebView not available\n\nInstall: pip install tkinterweb\n\nURL: {url}",
                    font=("Arial", 12)
                )
                label.pack(expand=True)
                ColorPrint.yellow("[NativeUI] WebView library not available")

    def _load_html_file(self, file_path: str):
        """Load local HTML file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            # Try using tkhtmlview
            from tkhtmlview import HTMLLabel
            self.webview_widget = HTMLLabel(self.content_frame, html=html_content)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)
            ColorPrint.green(f"[NativeUI] Loaded local HTML: {file_path}")
        except ImportError:
            label = tk.Label(
                self.content_frame,
                text=f"HTML rendering not available\n\nInstall: pip install tkhtmlview\n\nFile: {file_path}",
                font=("Arial", 12)
            )
            label.pack(expand=True)
            ColorPrint.yellow("[NativeUI] HTML rendering library not available")

    def _on_window_close_event(self):
        """Window close event"""
        self.signal_manager.emit(SignalType.WINDOW_CLOSE)

    # ============================================
    # Public Interface
    # ============================================

    def start(self):
        """Start UI framework"""
        if self.running:
            ColorPrint.yellow("[NativeUI] UI framework already running")
            return

        ColorPrint.blue("=" * 60)
        ColorPrint.blue(" Starting Native UI Framework")
        ColorPrint.blue("=" * 60)

        self.running = True

        # Start UI thread (must start first)
        self.ui_thread = threading.Thread(
            target=self._ui_thread_entry,
            name="UIThread",
            daemon=False
        )
        self.ui_thread.start()

        # Wait for UI to be ready
        while not self.ui_ready:
            time.sleep(0.1)

        # Start main thread (signal processing)
        self.main_thread = threading.Thread(
            target=self._main_thread_entry,
            name="MainThread",
            daemon=True
        )
        self.main_thread.start()

        # Start task thread (timer)
        self.task_thread = threading.Thread(
            target=self._task_thread_entry,
            name="TaskThread",
            daemon=True
        )
        self.task_thread.start()

        ColorPrint.green("=" * 60)
        ColorPrint.green(f" {self.config.app_name} started")
        ColorPrint.green("=" * 60)

    def stop(self):
        """Stop UI framework"""
        if not self.running:
            return

        ColorPrint.blue("=" * 60)
        ColorPrint.blue(" Stopping Native UI Framework")
        ColorPrint.blue("=" * 60)

        self.running = False

        # Stop timer
        self.task_timer.stop()

        # Close UI window
        if self.root:
            try:
                self.root.quit()
                self.root.destroy()
            except:
                pass

        # Wait for threads to finish
        if self.main_thread and self.main_thread.is_alive():
            self.main_thread.join(timeout=2)

        if self.task_thread and self.task_thread.is_alive():
            self.task_thread.join(timeout=2)

        ColorPrint.green("=" * 60)
        ColorPrint.green(" UI framework stopped")
        ColorPrint.green("=" * 60)

    # ============================================
    # External API
    # ============================================

    def load_url(self, url: str):
        """
        Load URL (external API)

        Args:
            url: Remote URL or local file path
        """
        self.config.ui_source = url
        if self.ui_ready and self.content_frame:
            # Clear existing content
            for widget in self.content_frame.winfo_children():
                widget.destroy()
            # Load new content
            self._load_ui_content()

    def emit_signal(self, signal_type: SignalType, data: Optional[Dict[str, Any]] = None):
        """
        Emit signal (external API)

        Args:
            signal_type: Signal type
            data: Signal data
        """
        self.signal_manager.emit(signal_type, data)

    def register_signal_handler(self, signal_type: SignalType, handler: Callable):
        """
        Register signal handler (external API)

        Args:
            signal_type: Signal type
            handler: Handler function
        """
        self.signal_manager.register_handler(signal_type, handler)

    def register_timer_task(self, name: str, callback: Callable, interval: int = 1):
        """
        Register timer task (external API)

        Args:
            name: Task name
            callback: Callback function
            interval: Interval parameter, execute every N ticks
        """
        return self.task_timer.register_task(name, callback, interval)

    def register_main_method(self, name: str, method: Callable):
        """
        Register main thread method (external API)

        Args:
            name: Method name
            method: Method function
        """
        self.main_executor.register_method(name, method)

    def call_main_method(self, name: str, *args, **kwargs):
        """
        Call main thread method (external API)

        Args:
            name: Method name
            *args: Positional arguments
            **kwargs: Keyword arguments
        """
        self.main_executor.call(name, *args, **kwargs)

    def show_window(self):
        """Show window"""
        if self.root:
            self.root.deiconify()
            self.root.lift()
            self.window_state = WindowState.NORMAL

    def hide_window(self):
        """Hide window"""
        if self.root:
            self.root.withdraw()
            self.window_state = WindowState.HIDDEN

    def is_running(self) -> bool:
        """Check if running"""
        return self.running


# ============================================
# Convenience Functions
# ============================================

def create_ui_framework(
    app_name: str = "Native UI App",
    window_size: tuple = (1280, 800),
    **kwargs
) -> NativeUIFramework:
    """
    Create UI framework instance (convenience function)

    Args:
        app_name: Application name
        window_size: Window size
        **kwargs: Other UIConfig parameters

    Returns:
        NativeUIFramework instance
    """
    config = UIConfig(
        app_name=app_name,
        window_size=window_size,
        **kwargs
    )

    return NativeUIFramework(config)
