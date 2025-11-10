#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - WebView Extension
Specialized framework for HTML/CSS/JS UIs with Python-JavaScript bridge
"""

# Import ColorPrint for logging
from pycore.pyfoundations.color_print import ColorPrint

import tkinter as tk
import os
from typing import Optional, Callable, Dict, Any
from pathlib import Path

from pycore.pyutils.native_ui.config import UIConfig, WindowState
from pycore.pyutils.native_ui.signals import SignalManager, SignalType, Signal, TaskTimer, MainThreadExecutor
from pycore.pyutils.native_ui.title_bar import CustomTitleBar
from pycore.pyutils.native_ui.threads import ThreadManager


class WebViewFramework:
    """
    WebView Framework - Specialized for HTML/CSS/JS UIs
    Provides Python-JavaScript bridge for seamless communication
    """

    def __init__(self, config: UIConfig, api_instance: Optional[Any] = None):
        """
        Initialize WebView Framework

        Args:
            config: UI configuration object
            api_instance: Python API instance to expose to JavaScript
        """
        self.config = config
        self.api_instance = api_instance

        # Core managers
        self.signal_manager = SignalManager(debug=config.debug)
        self.task_timer = TaskTimer(tick_interval=1.0, debug=config.debug)
        self.main_executor = MainThreadExecutor(debug=config.debug)

        # Thread manager
        self.thread_manager = ThreadManager(self)

        # Register default signal handlers
        self._register_default_handlers()

        # Register default main thread methods
        self._register_default_methods()

        # Runtime state
        self.running = False
        self.ui_ready = False

        # UI components
        self.root: Optional[tk.Tk] = None
        self.title_bar: Optional[CustomTitleBar] = None
        self.content_frame: Optional[tk.Frame] = None
        self.webview_widget = None

        # Window state
        self.window_state = WindowState.HIDDEN if not config.show_on_start else WindowState.NORMAL

        ColorPrint.green(f"[WebViewFramework] Framework initialized: {config.app_name}")

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
        self.main_executor.register_method('eval_js', self._method_eval_js)

    # ============================================
    # Signal Handlers
    # ============================================

    def _handle_window_close(self, signal: Signal):
        """Handle window close signal"""
        ColorPrint.yellow("[WebViewFramework] Handle: Window Close")
        self.stop()

    def _handle_window_minimize(self, signal: Signal):
        """Handle window minimize signal"""
        ColorPrint.blue("[WebViewFramework] Handle: Window Minimize")
        self.main_executor.call('minimize')

    def _handle_window_maximize(self, signal: Signal):
        """Handle window maximize signal"""
        ColorPrint.blue("[WebViewFramework] Handle: Window Maximize")
        self.main_executor.call('maximize')

    def _handle_window_restore(self, signal: Signal):
        """Handle window restore signal"""
        ColorPrint.blue("[WebViewFramework] Handle: Window Restore")
        self.main_executor.call('restore')

    def _handle_window_restart(self, signal: Signal):
        """Handle window restart signal"""
        ColorPrint.yellow("[WebViewFramework] Handle: Window Restart")
        self.stop()
        import sys
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

    def _method_eval_js(self, js_code: str):
        """Main thread method: Evaluate JavaScript code"""
        if self.webview_widget and hasattr(self.webview_widget, 'evaluate_js'):
            try:
                result = self.webview_widget.evaluate_js(js_code)
                ColorPrint.blue(f"[WebViewFramework] JS eval result: {result}")
                return result
            except Exception as e:
                ColorPrint.red(f"[WebViewFramework] JS eval error: {e}")
                return None

    # ============================================
    # UI Thread Methods
    # ============================================

    def _create_tkinter_ui(self):
        """Create Tkinter UI with embedded HTML content"""
        ColorPrint.green("[WebViewFramework] Creating WebView UI...")

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

        # Load HTML content
        if self.config.ui_source:
            self._load_html_content()

        # Initial display state
        if not self.config.show_on_start:
            self.root.withdraw()

        # Bind close event
        self.root.protocol("WM_DELETE_WINDOW", self._on_window_close_event)

        # Mark UI as ready
        self.ui_ready = True
        self.signal_manager.emit(SignalType.UI_READY)

        ColorPrint.green("[WebViewFramework] WebView UI Created")

    def _run_tkinter_mainloop(self):
        """Run Tkinter mainloop"""
        ColorPrint.green("[WebViewFramework] Entering Tkinter mainloop...")
        self.root.mainloop()
        ColorPrint.yellow("[WebViewFramework] Tkinter mainloop exited")

    def _load_html_content(self):
        """Load HTML content with JavaScript bridge"""
        source = self.config.ui_source

        if not source:
            return

        # Determine if file or URL
        if source.startswith('http://') or source.startswith('https://'):
            self._load_html_from_url(source)
        elif os.path.exists(source):
            self._load_html_from_file(source)
        else:
            ColorPrint.yellow(f"[WebViewFramework] Invalid UI source: {source}")

    def _load_html_from_file(self, file_path: str):
        """Load HTML from local file with JavaScript bridge"""
        try:
            # Read HTML content
            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            # Inject JavaScript bridge code if API instance provided
            if self.api_instance:
                html_content = self._inject_js_bridge(html_content)

            # Try tkinterweb first (better HTML5 support)
            try:
                from tkinterweb import HtmlFrame
                self.webview_widget = HtmlFrame(self.content_frame)
                self.webview_widget.load_html(html_content)
                self.webview_widget.pack(fill=tk.BOTH, expand=True)
                ColorPrint.green(f"[WebViewFramework] Loaded HTML (tkinterweb): {file_path}")

            except ImportError:
                # Fall back to tkhtmlview
                try:
                    from tkhtmlview import HTMLLabel
                    self.webview_widget = HTMLLabel(self.content_frame, html=html_content)
                    self.webview_widget.pack(fill=tk.BOTH, expand=True)
                    ColorPrint.green(f"[WebViewFramework] Loaded HTML (tkhtmlview): {file_path}")

                except ImportError:
                    # No webview available
                    label = tk.Label(
                        self.content_frame,
                        text=f"WebView not available\n\nInstall: pip install tkinterweb\n\nFile: {file_path}",
                        font=("Arial", 12)
                    )
                    label.pack(expand=True)
                    ColorPrint.yellow("[WebViewFramework] WebView library not available")

        except Exception as e:
            ColorPrint.red(f"[WebViewFramework] Error loading HTML: {e}")

    def _load_html_from_url(self, url: str):
        """Load HTML from URL"""
        try:
            from tkinterweb import HtmlFrame
            self.webview_widget = HtmlFrame(self.content_frame)
            self.webview_widget.load_website(url)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)
            ColorPrint.green(f"[WebViewFramework] Loaded URL: {url}")

        except ImportError:
            label = tk.Label(
                self.content_frame,
                text=f"WebView not available\n\nInstall: pip install tkinterweb\n\nURL: {url}",
                font=("Arial", 12)
            )
            label.pack(expand=True)
            ColorPrint.yellow("[WebViewFramework] WebView library not available")

    def _inject_js_bridge(self, html_content: str) -> str:
        """
        Inject JavaScript bridge code into HTML

        Args:
            html_content: Original HTML content

        Returns:
            HTML with injected JavaScript bridge
        """
        bridge_script = """
<script>
// Python Bridge API Mock (will be replaced by actual pywebview API)
window.pywebview = window.pywebview || {
    api: {
        call_method: function(method, params) {
            return new Promise((resolve, reject) => {
                console.log('[Bridge] Python call:', method, params);
                // TODO: Implement actual bridge communication
                resolve({success: true, message: 'Mock response'});
            });
        }
    }
};
</script>
"""

        # Inject before closing </head> tag or at beginning of <body>
        if '</head>' in html_content:
            html_content = html_content.replace('</head>', bridge_script + '</head>')
        elif '<body>' in html_content:
            html_content = html_content.replace('<body>', '<body>' + bridge_script)
        else:
            # No head or body tags, prepend to content
            html_content = bridge_script + html_content

        return html_content

    def _on_window_close_event(self):
        """Window close event"""
        self.signal_manager.emit(SignalType.WINDOW_CLOSE)

    # ============================================
    # Public API
    # ============================================

    def start(self):
        """Start UI framework"""
        if self.running:
            ColorPrint.yellow("[WebViewFramework] Already running")
            return

        self.running = True
        self.thread_manager.start_all()

    def stop(self):
        """Stop UI framework"""
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

        # Stop all threads
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

    def eval_js(self, js_code: str):
        """Evaluate JavaScript code in webview"""
        self.main_executor.call('eval_js', js_code)

    def is_running(self) -> bool:
        """Check if framework is running"""
        return self.running

    def get_thread_status(self) -> Dict[str, bool]:
        """Get status of all threads"""
        return self.thread_manager.get_thread_status()
