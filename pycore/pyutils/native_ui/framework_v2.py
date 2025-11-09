#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Main Framework Module (Refactored)
Clear thread architecture - ASCII only
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

# Import ColorPrint for logging
from pycore.pyfoundations.color_print import ColorPrint

import tkinter as tk
import sys
import os
from typing import Optional, Callable, Dict, Any

from pycore.pyutils.native_ui.config import UIConfig, WindowState
from pycore.pyutils.native_ui.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
from pycore.pyutils.native_ui.title_bar import CustomTitleBar
from pycore.pyutils.native_ui.threads import ThreadManager


class NativeUIFrameworkV2:
    """
    Native UI Framework - Refactored with Clear Thread Architecture

    Thread Architecture:
    - UI Thread: Tkinter mainloop, user interaction
    - Main Thread: Signal processing, main thread method execution
    - Task Thread: Timer-based background tasks (1 second tick by default)
    """

    def __init__(self, config: UIConfig):
        """
        Initialize UI Framework

        Args:
            config: UI configuration object
        """
        self.config = config

        # Core managers
        self.signal_manager = SignalManager(debug=config.debug)
        self.task_timer = TaskTimer(tick_interval=1.0, debug=config.debug)
        self.main_executor = MainThreadExecutor(debug=config.debug)

        # Thread manager (clear separation of responsibilities)
        self.thread_manager = ThreadManager(self)

        # Register default signal handlers
        self._register_default_handlers()

        # Register default main thread methods
        self._register_default_methods()

        # Runtime state
        self.running = False
        self.ui_ready = False

        # UI components (created in UI thread)
        self.root: Optional[tk.Tk] = None
        self.title_bar: Optional[CustomTitleBar] = None
        self.content_frame: Optional[tk.Frame] = None
        self.webview_widget = None

        # Window state
        self.window_state = WindowState.HIDDEN if not config.show_on_start else WindowState.NORMAL

        ColorPrint.green(f"[NativeUIv2] Framework initialized: {config.app_name}")

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
        ColorPrint.yellow("[NativeUIv2] Handle: Window Close")
        self.stop()

    def _handle_window_minimize(self, signal: Signal):
        """Handle window minimize signal"""
        ColorPrint.blue("[NativeUIv2] Handle: Window Minimize")
        self.main_executor.call('minimize')

    def _handle_window_maximize(self, signal: Signal):
        """Handle window maximize signal"""
        ColorPrint.blue("[NativeUIv2] Handle: Window Maximize")
        self.main_executor.call('maximize')

    def _handle_window_restore(self, signal: Signal):
        """Handle window restore signal"""
        ColorPrint.blue("[NativeUIv2] Handle: Window Restore")
        self.main_executor.call('restore')

    def _handle_window_restart(self, signal: Signal):
        """Handle window restart signal"""
        ColorPrint.yellow("[NativeUIv2] Handle: Window Restart")
        self.stop()
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
    # UI Thread Methods (called from UI thread)
    # ============================================

    def _create_tkinter_ui(self):
        """Create Tkinter UI (called from UI thread)"""
        ColorPrint.green("[NativeUIv2] Creating Tkinter UI...")

        # Create root window
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
            self.title_bar = CustomTitleBar(self.root, self.config, self.signal_manager)
            self.title_bar.pack(side=tk.TOP, fill=tk.X)

        # Create content frame
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

        ColorPrint.green("[NativeUIv2] UI Created")

    def _run_tkinter_mainloop(self):
        """Run Tkinter mainloop (blocking)"""
        ColorPrint.green("[NativeUIv2] Entering Tkinter mainloop...")
        self.root.mainloop()
        ColorPrint.yellow("[NativeUIv2] Tkinter mainloop exited")

    def _load_ui_content(self):
        """Load UI content (URL or HTML file)"""
        if not self.config.ui_source:
            return

        source = self.config.ui_source

        # Check if URL or local file
        if source.startswith('http://') or source.startswith('https://'):
            self._load_url(source)
        elif os.path.exists(source):
            self._load_html_file(source)
        else:
            ColorPrint.yellow(f"[NativeUIv2] Invalid UI source: {source}")

    def _load_url(self, url: str):
        """Load remote URL in webview"""
        # Try pywebview first (best JavaScript bridge support)
        try:
            import webview

            # Create webview window in the content frame
            # Note: pywebview creates its own window, so we need special handling
            ColorPrint.yellow("[NativeUIv2] pywebview detected - using embedded mode")

            # For now, create a label indicating webview mode
            label = tk.Label(
                self.content_frame,
                text=f"WebView Mode Active\n\nURL: {url}",
                font=("Arial", 12),
                bg='white'
            )
            label.pack(expand=True)

            # Store URL for later use
            self.webview_url = url
            ColorPrint.green(f"[NativeUIv2] WebView URL set: {url}")

        except ImportError:
            # Fall back to tkinterweb
            try:
                from tkinterweb import HtmlFrame
                self.webview_widget = HtmlFrame(self.content_frame)
                self.webview_widget.load_website(url)
                self.webview_widget.pack(fill=tk.BOTH, expand=True)
                ColorPrint.green(f"[NativeUIv2] Loaded URL (tkinterweb): {url}")
            except ImportError:
                try:
                    from tkhtmlview import HTMLLabel
                    self.webview_widget = HTMLLabel(self.content_frame, html=f'<iframe src="{url}"></iframe>')
                    self.webview_widget.pack(fill=tk.BOTH, expand=True)
                    ColorPrint.green(f"[NativeUIv2] Loaded URL (tkhtmlview): {url}")
                except ImportError:
                    label = tk.Label(
                        self.content_frame,
                        text=f"WebView not available\n\nInstall: pip install pywebview\n\nURL: {url}",
                        font=("Arial", 12)
                    )
                    label.pack(expand=True)
                    ColorPrint.yellow("[NativeUIv2] WebView library not available")

    def _load_html_file(self, file_path: str):
        """Load local HTML file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            from tkhtmlview import HTMLLabel
            self.webview_widget = HTMLLabel(self.content_frame, html=html_content)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)
            ColorPrint.green(f"[NativeUIv2] Loaded HTML file: {file_path}")
        except ImportError:
            label = tk.Label(
                self.content_frame,
                text=f"HTML rendering not available\n\nInstall: pip install tkhtmlview\n\nFile: {file_path}",
                font=("Arial", 12)
            )
            label.pack(expand=True)
            ColorPrint.yellow("[NativeUIv2] HTML rendering library not available")

    def _on_window_close_event(self):
        """Window close event"""
        self.signal_manager.emit(SignalType.WINDOW_CLOSE)

    # ============================================
    # Public API
    # ============================================

    def start(self):
        """Start UI framework (starts all threads)"""
        if self.running:
            ColorPrint.yellow("[NativeUIv2] Already running")
            return

        self.running = True

        # Start all threads via thread manager
        self.thread_manager.start_all()

    def stop(self):
        """Stop UI framework (stops all threads)"""
        if not self.running:
            return

        self.running = False

        # Close UI window
        if self.root:
            try:
                self.root.quit()
                self.root.destroy()
            except:
                pass

        # Stop all threads via thread manager
        self.thread_manager.stop_all()

    def register_signal_handler(self, signal_type: SignalType, handler: Callable):
        """Register signal handler"""
        self.signal_manager.register_handler(signal_type, handler)

    def emit_signal(self, signal_type: SignalType, data: Optional[Dict[str, Any]] = None):
        """Emit signal"""
        self.signal_manager.emit(signal_type, data)

    def register_timer_task(self, name: str, callback: Callable, interval: int = 1):
        """Register timer task"""
        return self.task_timer.register_task(name, callback, interval)

    def register_main_method(self, name: str, method: Callable):
        """Register main thread method"""
        self.main_executor.register_method(name, method)

    def call_main_method(self, name: str, *args, **kwargs):
        """Call main thread method"""
        self.main_executor.call(name, *args, **kwargs)

    def is_running(self) -> bool:
        """Check if framework is running"""
        return self.running

    def get_thread_status(self) -> Dict[str, bool]:
        """Get status of all threads"""
        return self.thread_manager.get_thread_status()


# ============================================
# Convenience Function
# ============================================

def create_ui_framework_v2(app_name: str = "Native UI App", window_size: tuple = (1280, 800), **kwargs) -> NativeUIFrameworkV2:
    """Create UI framework instance (convenience function)"""
    config = UIConfig(app_name=app_name, window_size=window_size, **kwargs)
    return NativeUIFrameworkV2(config)
