#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 WebView - Web Content Display Widget

WebView widget using QWebEngineView for displaying web content.
"""

from PySide6.QtCore import QUrl, Signal, Slot, QTimer
from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel, QStackedWidget
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings
from PySide6.QtGui import QColor

from typing import Optional
from pathlib import Path

from pycore import ColorPrint
from .webengine_config import configure_webengine_tier3_settings, mark_gpu_fallback


class PySide6WebView(QWidget):
    """
    WebView widget for displaying HTML content.

    Features:
    - Load URLs or local HTML files
    - Built-in loading page with animations
    - JavaScript execution support
    - Navigation controls
    - Developer tools (optional)
    """

    # Signals
    load_started = Signal()
    load_finished = Signal(bool)  # success
    load_progress = Signal(int)  # 0-100
    url_changed = Signal(QUrl)
    title_changed = Signal(str)

    def __init__(
        self,
        enable_dev_tools: bool = False,
        enable_javascript: bool = True,
        parent: Optional[QWidget] = None
    ):
        """
        Initialize WebView.

        Args:
            enable_dev_tools: Enable web inspector
            enable_javascript: Enable JavaScript
            parent: Parent widget
        """
        super().__init__(parent)

        self.enable_dev_tools = enable_dev_tools
        self.enable_javascript = enable_javascript

        # Create web view
        self.web_view: Optional[QWebEngineView] = None
        self.loading_widget: Optional[QWidget] = None

        # Setup UI
        self._setup_ui()

    def _setup_ui(self):
        """Setup WebView UI."""
        # Main layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Create stacked widget for smooth transitions
        self.stacked_widget = QStackedWidget()

        # Create web view
        self.web_view = QWebEngineView()

        # Set background color to prevent white flash
        # Must match the React app's background color (#030305)
        page = self.web_view.page()
        # page.setBackgroundColor(QColor("#030305"))

        # Configure settings
        settings = self.web_view.settings()
        settings.setAttribute(
            QWebEngineSettings.JavascriptEnabled,
            self.enable_javascript
        )

        # NOTE: DeveloperExtrasEnabled does NOT exist in Qt WebEngine (it was in old QtWebKit)
        # Developer tools are enabled via:
        # 1. Environment variable QTWEBENGINE_REMOTE_DEBUGGING (set via Chromium flags)
        # 2. QWebEnginePage.setDevToolsPage() for in-app dev tools
        # Since we're already setting Chromium flags, remote debugging is handled there.
        # For additional in-app dev tools, we would need to create a separate QWebEnginePage.

        # CRITICAL: Apply Tier 3 QtWebEngine configuration for WebCodecs/WebGL support
        # This is the final redundant layer after Tier 1 (env) and Tier 2 (qputenv)
        configure_webengine_tier3_settings(settings)

        # Connect signals
        self.web_view.loadStarted.connect(self._on_load_started)
        self.web_view.loadFinished.connect(self._on_load_finished)
        self.web_view.loadProgress.connect(self.load_progress.emit)
        self.web_view.urlChanged.connect(self.url_changed.emit)
        self.web_view.titleChanged.connect(self.title_changed.emit)
        # Recover from a Chromium render/GPU process crash (e.g. the
        # DirectComposition / IDCompositionDevice4 GPU-init failure seen on some
        # drivers). Without this the view goes permanently blank; here we auto-
        # reload once, bounded by a counter so a crash-loop can't spin forever.
        self.web_view.renderProcessTerminated.connect(self._on_render_process_terminated)
        self._render_crash_count = 0
        self._load_retry_count = 0

        # Create loading widget
        self._create_loading_widget()

        # Add widgets to stacked widget
        self.stacked_widget.addWidget(self.loading_widget)  # Index 0
        self.stacked_widget.addWidget(self.web_view)        # Index 1

        # Show loading widget initially
        self.stacked_widget.setCurrentIndex(0)

        # Add stacked widget to layout
        layout.addWidget(self.stacked_widget)

    def _create_loading_widget(self):
        """Create loading page widget."""
        self.loading_widget = QWidget()

        # Layout
        layout = QVBoxLayout(self.loading_widget)
        layout.setContentsMargins(0, 0, 0, 0)

        # Loading label (will be replaced with HTML loading page)
        label = QLabel("Loading...")
        label.setStyleSheet("""
            QLabel {
                background-color: #1e1e1e;
                color: #ffffff;
                font-size: 14pt;
                qproperty-alignment: AlignCenter;
            }
        """)
        layout.addWidget(label)

    def load_url(self, url: str, show_loading: bool = True, loading_style: int = 1):
        """
        Load URL with optional loading animation.

        Args:
            url: URL to load (http:// or file://)
            show_loading: Show loading animation while loading (default: True)
            loading_style: Loading animation style (1-14, default: 1)
        """
        # Show loading page first
        if show_loading:
            self._show_default_loading_page(loading_style)

        # Load URL
        if url.startswith("http://") or url.startswith("https://"):
            self.web_view.load(QUrl(url))
        elif Path(url).exists():
            # Local file
            file_url = QUrl.fromLocalFile(str(Path(url).absolute()))
            self.web_view.load(file_url)
        else:
            self.web_view.load(QUrl(url))

    def load_html(self, html: str, base_url: Optional[str] = None, show_loading: bool = True, loading_style: int = 1):
        """
        Load HTML content with optional loading animation.

        Args:
            html: HTML content
            base_url: Base URL for resolving relative paths
            show_loading: Show loading animation while loading (default: True)
            loading_style: Loading animation style (1-14, default: 1)
        """
        # Show loading page first
        if show_loading:
            self._show_default_loading_page(loading_style)

        # Load HTML
        if base_url:
            self.web_view.setHtml(html, QUrl(base_url))
        else:
            self.web_view.setHtml(html)

    def _show_default_loading_page(self, style: int = 1):
        """Show default loading page from resource folder.

        Uses loadin{style}.html files (loadin1.html to loadin14.html).
        Falls back to loading.html or generated HTML if specific style not found.

        Args:
            style: Loading animation style (1-14), defaults to 1
        """
        resource_dir = Path(__file__).parent.parent / "resource"

        # Try to find loadin{style}.html first (new naming convention)
        loading_html_path = resource_dir / f"loadin{style}.html"

        if loading_html_path.exists():
            # Load resource loadin{style}.html
            self.show_loading_page(str(loading_html_path), style=style)
        else:
            # Fallback to loading.html (legacy)
            legacy_loading_html = resource_dir / "loading.html"
            if legacy_loading_html.exists():
                self.show_loading_page(str(legacy_loading_html), style=style)
            else:
                # Final fallback to generated HTML
                self.show_loading_page(style=style)

    def execute_javascript(self, script: str, callback: Optional[callable] = None):
        """
        Execute JavaScript code.

        Args:
            script: JavaScript code to execute
            callback: Optional callback for result
        """
        if callback:
            self.web_view.page().runJavaScript(script, callback)
        else:
            self.web_view.page().runJavaScript(script)

    def reload(self):
        """Reload current page."""
        self.web_view.reload()

    def stop(self):
        """Stop loading."""
        self.web_view.stop()

    def back(self):
        """Navigate back."""
        if self.web_view.page().history().canGoBack():
            self.web_view.back()

    def forward(self):
        """Navigate forward."""
        if self.web_view.page().history().canGoForward():
            self.web_view.forward()

    def show_loading_page(
        self,
        html_path: Optional[str] = None,
        style: int = 1,
        text: str = "Loading...",
        background: str = "#1e1e1e"
    ):
        """
        Show loading page.

        Args:
            html_path: Path to custom loading HTML (optional)
            style: Built-in loading animation style (1-14)
            text: Loading text
            background: Background color
        """
        if html_path and Path(html_path).exists():
            # Load custom loading page with parameters
            file_path = Path(html_path)
            # Build URL with query parameters
            url = QUrl.fromLocalFile(str(file_path.absolute()))
            # Add query parameters
            from PySide6.QtCore import QUrlQuery
            query = QUrlQuery()
            query.addQueryItem("style", str(style))
            query.addQueryItem("text", text)
            query.addQueryItem("bg", background)
            url.setQuery(query)

            # Load in loading widget
            temp_web = QWebEngineView(self.loading_widget)
            temp_web.load(url)
        else:
            # Use built-in loading page
            html_content = self._generate_loading_html(style, text, background)

            # Load HTML directly (no temp file needed)
            temp_web = QWebEngineView(self.loading_widget)
            temp_web.setHtml(html_content)

        # Replace loading widget layout
        layout = self.loading_widget.layout()
        while layout.count():
            item = layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        layout.addWidget(temp_web)

        # Switch to loading widget
        self.stacked_widget.setCurrentIndex(0)

    def hide_loading_page(self):
        """Hide loading page and show web view."""
        # Disable updates to prevent flicker
        self.stacked_widget.setUpdatesEnabled(False)

        # Switch to webview
        self.stacked_widget.setCurrentIndex(1)

        # Re-enable updates
        self.stacked_widget.setUpdatesEnabled(True)

    def _generate_loading_html(
        self,
        style: int = 1,
        text: str = "Loading...",
        background: str = "#1e1e1e"
    ) -> str:
        """
        Generate built-in loading page HTML.

        Args:
            style: Animation style (1-14)
            text: Loading text
            background: Background color

        Returns:
            HTML content
        """
        # Simple spinner animation
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    background-color: {background};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    font-family: 'Microsoft YaHei UI', Arial, sans-serif;
                }}
                .loading-container {{
                    text-align: center;
                }}
                .spinner {{
                    border: 4px solid rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    border-top: 4px solid #3498db;
                    width: 50px;
                    height: 50px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                }}
                @keyframes spin {{
                    0% {{ transform: rotate(0deg); }}
                    100% {{ transform: rotate(360deg); }}
                }}
                .loading-text {{
                    color: #ffffff;
                    font-size: 14pt;
                }}
            </style>
        </head>
        <body>
            <div class="loading-container">
                <div class="spinner"></div>
                <div class="loading-text">{text}</div>
            </div>
        </body>
        </html>
        """

    @Slot()
    def _on_load_started(self):
        """Handle load started."""
        self.load_started.emit()

    @Slot(bool)
    def _on_load_finished(self, success: bool):
        """Handle load finished."""
        if success:
            # Hide loading page immediately (no delay needed with QStackedWidget)
            self.hide_loading_page()
            self._load_retry_count = 0
        else:
            # A failed/aborted load (e.g. ERR_CONNECTION_REFUSED while the UI dev
            # server at :13054 is briefly unavailable during a singleton takeover /
            # dev-server restart). Auto-retry a bounded number of times before
            # giving up, so a transient gap doesn't strand the webview blank.
            self._load_retry_count += 1
            if self._load_retry_count <= 5:
                ColorPrint.yellow(
                    f"[PySide6WebView] Load failed (attempt {self._load_retry_count}/5): "
                    f"{self.get_url()} — retrying in 1s")
                QTimer.singleShot(1000, self.web_view.reload)
            else:
                ColorPrint.red(f"[PySide6WebView] Load failed after 5 retries: {self.get_url()}")
                self.hide_loading_page()

        self.load_finished.emit(success)

    def _on_render_process_terminated(self, status, exit_code):
        """
        Handle a Chromium render-process termination (crash / killed / GPU loss).

        A terminated render process leaves the page blank but does NOT exit the
        host app (the Qt loop keeps running). We attempt a single auto-reload to
        recover transient GPU/compositor crashes; a small cap prevents a reload
        crash-loop from hammering a genuinely broken renderer.
        """
        self._render_crash_count += 1
        ColorPrint.yellow(
            f"[PySide6WebView] Render process terminated "
            f"(status={status}, exit_code={exit_code}, "
            f"attempt={self._render_crash_count}) url={self.get_url()}")
        if self._render_crash_count <= 3:
            ColorPrint.yellow("[PySide6WebView] Scheduling webview reload to recover...")
            QTimer.singleShot(1500, self.web_view.reload)
        else:
            # Repeated render crashes usually mean the GPU/compositor path is broken
            # on this driver. Persist a software-rendering request so the NEXT launch
            # comes up on the safe path instead of crash-looping the GPU.
            ColorPrint.red("[PySide6WebView] Render process crashed repeatedly; "
                           "persisting software-rendering fallback for next launch.")
            mark_gpu_fallback(f"renderProcessTerminated x{self._render_crash_count}")

    def get_url(self) -> str:
        """Get current URL."""
        return self.web_view.url().toString()

    def get_title(self) -> str:
        """Get current page title."""
        return self.web_view.title()
