#!/usr/bin/env python3
"""
PySide6 WebView launcher for Scrcpy WebGL Test

Wraps the web interface in a native window using PySide6 WebEngineView.
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from PySide6.QtCore import QUrl, Qt
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEngineSettings

from pyapps.scrcpy_webgl_test.scrcpy_webgl_test_config import Config


class ScrcpyWebGLWindow(QMainWindow):
    """Main window for Scrcpy WebGL Test"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Scrcpy WebGL Test - YUV Streaming")
        self.setGeometry(100, 100, 1400, 900)

        # Create WebEngineView
        self.webview = QWebEngineView()
        self.setCentralWidget(self.webview)

        # Configure WebEngine settings
        settings = self.webview.settings()
        settings.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebGLEnabled, True)
        settings.setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, True)
        settings.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)

        # Load the web interface
        url = f"http://{Config.WEB_HOST}:{Config.WEB_PORT}"
        print(f"[WebView] Loading: {url}")
        self.webview.setUrl(QUrl(url))

        # Connect signals
        self.webview.loadStarted.connect(self.on_load_started)
        self.webview.loadFinished.connect(self.on_load_finished)

    def on_load_started(self):
        print("[WebView] Loading started...")

    def on_load_finished(self, success):
        if success:
            print("[WebView] Loading finished successfully")
        else:
            print("[WebView] Loading failed!")


def launch_webview():
    """Launch the PySide6 WebView window"""
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)

    window = ScrcpyWebGLWindow()
    window.show()

    return app.exec()


if __name__ == '__main__':
    sys.exit(launch_webview())
