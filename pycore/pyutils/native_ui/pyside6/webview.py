#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 WebView - Web Content Display Widget

WebView widget using QWebEngineView for displaying web content.
"""

from PySide6.QtCore import QUrl, Signal, Slot, QTimer
from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings

from typing import Optional
from pathlib import Path
import tempfile


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

        # Create web view
        self.web_view = QWebEngineView()

        # Configure settings
        settings = self.web_view.settings()
        settings.setAttribute(
            QWebEngineSettings.JavascriptEnabled,
            self.enable_javascript
        )

        if self.enable_dev_tools:
            settings.setAttribute(
                QWebEngineSettings.WebAttribute.DeveloperExtrasEnabled,
                True
            )

        # Connect signals
        self.web_view.loadStarted.connect(self._on_load_started)
        self.web_view.loadFinished.connect(self._on_load_finished)
        self.web_view.loadProgress.connect(self.load_progress.emit)
        self.web_view.urlChanged.connect(self.url_changed.emit)
        self.web_view.titleChanged.connect(self.title_changed.emit)

        # Create loading widget
        self._create_loading_widget()

        # Add to layout (loading widget shown first)
        layout.addWidget(self.loading_widget)
        layout.addWidget(self.web_view)

        # Hide web view initially
        self.web_view.hide()

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

    def load_url(self, url: str):
        """
        Load URL.

        Args:
            url: URL to load (http:// or file://)
        """
        if url.startswith("http://") or url.startswith("https://"):
            self.web_view.load(QUrl(url))
        elif Path(url).exists():
            # Local file
            file_url = QUrl.fromLocalFile(str(Path(url).absolute()))
            self.web_view.load(file_url)
        else:
            self.web_view.load(QUrl(url))

    def load_html(self, html: str, base_url: Optional[str] = None):
        """
        Load HTML content.

        Args:
            html: HTML content
            base_url: Base URL for resolving relative paths
        """
        if base_url:
            self.web_view.setHtml(html, QUrl(base_url))
        else:
            self.web_view.setHtml(html)

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
            # Load custom loading page
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
        else:
            # Use built-in loading page
            html_content = self._generate_loading_html(style, text, background)

        # Create temp loading page
        temp_file = Path(tempfile.gettempdir()) / "loading.html"
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Load in web view
        temp_web = QWebEngineView(self.loading_widget)
        temp_web.load(QUrl.fromLocalFile(str(temp_file)))

        # Replace loading widget layout
        layout = self.loading_widget.layout()
        while layout.count():
            item = layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        layout.addWidget(temp_web)

        # Show loading widget
        self.loading_widget.show()
        self.web_view.hide()

    def hide_loading_page(self):
        """Hide loading page and show web view."""
        self.loading_widget.hide()
        self.web_view.show()

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
            # Hide loading page after a short delay
            QTimer.singleShot(500, self.hide_loading_page)

        self.load_finished.emit(success)

    def get_url(self) -> str:
        """Get current URL."""
        return self.web_view.url().toString()

    def get_title(self) -> str:
        """Get current page title."""
        return self.web_view.title()
