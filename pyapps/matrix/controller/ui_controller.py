"""Matrix UI Controller

Creates custom UI content with webview for Matrix application
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import tkinter as tk
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint


class MatrixUIController:
    """
    Matrix UI Controller

    Manages UI content creation with embedded webview
    """

    def __init__(self, frontend_url: str = "http://localhost:3007"):
        """
        Initialize UI controller

        Args:
            frontend_url: URL to display in webview
        """
        self.frontend_url = frontend_url
        self.content_frame: Optional[tk.Frame] = None
        self.webview_widget = None

    def create_ui_content(self, content_frame: tk.Frame):
        """
        Create UI content with webview

        This method is called by NativeUIThread to create the UI content

        Args:
            content_frame: Parent frame to create content in
        """
        self.content_frame = content_frame

        ColorPrint.blue("[MatrixUIController] Creating webview UI content...")
        ColorPrint.green(f"[MatrixUIController] Loading URL: {self.frontend_url}")

        # Configure frame
        content_frame.configure(bg="white")

        # Try to load webview
        self._create_webview(content_frame)

        ColorPrint.green("[MatrixUIController] UI content created successfully")

    def _create_webview(self, parent: tk.Frame):
        """
        Create webview widget

        Args:
            parent: Parent frame
        """
        url = self.frontend_url

        # Try pywebview first (best support, already installed)
        try:
            import webview as pywebview
            import threading

            ColorPrint.blue("[MatrixUIController] Using pywebview for webview")

            # pywebview needs to run in a separate thread for Tkinter compatibility
            def create_webview():
                """Create webview in separate thread"""
                # Create a container frame for webview
                container = tk.Frame(parent, bg="white")
                container.pack(fill=tk.BOTH, expand=True)

                # Get window ID for embedding
                window_id = container.winfo_id()

                # Create pywebview window
                self.webview_widget = pywebview.create_window(
                    'Matrix Frontend',
                    url,
                    width=1280,
                    height=900
                )

                # Start pywebview
                pywebview.start()

            # Start webview in background thread
            webview_thread = threading.Thread(target=create_webview, daemon=True)
            webview_thread.start()

            ColorPrint.green(f"[MatrixUIController] Pywebview started: {url}")
            return

        except ImportError:
            ColorPrint.yellow("[MatrixUIController] pywebview not available, trying alternative...")
        except Exception as e:
            ColorPrint.yellow(f"[MatrixUIController] pywebview error: {e}, trying alternative...")

        # Try tkinterweb second (better HTML5 support)
        try:
            from tkinterweb import HtmlFrame

            ColorPrint.blue("[MatrixUIController] Using tkinterweb for webview")

            self.webview_widget = HtmlFrame(parent)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)

            # Load URL
            self.webview_widget.load_website(url)

            ColorPrint.green(f"[MatrixUIController] Webview loaded successfully: {url}")
            return

        except ImportError:
            ColorPrint.yellow("[MatrixUIController] tkinterweb not available, trying alternative...")

        # Try tkhtmlview as fallback
        try:
            from tkhtmlview import HTMLScrolledText
            import requests

            ColorPrint.blue("[MatrixUIController] Using tkhtmlview for webview")

            self.webview_widget = HTMLScrolledText(parent)
            self.webview_widget.pack(fill=tk.BOTH, expand=True)

            # Fetch and display HTML
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    self.webview_widget.set_html(response.text)
                    ColorPrint.green(f"[MatrixUIController] HTML loaded: {url}")
                else:
                    self._show_error(parent, f"Failed to load: {url} (Status: {response.status_code})")
            except Exception as e:
                self._show_error(parent, f"Failed to fetch URL: {e}")

            return

        except ImportError:
            ColorPrint.yellow("[MatrixUIController] tkhtmlview not available")

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
            text="Matrix - Android Device Control",
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
            "  pip install tkinterweb",
            "  pip install tkhtmlview",
            "",
            f"Frontend URL: {url}",
            "",
            "You can access the frontend directly in your browser:"
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
            ColorPrint.blue(f"[MatrixUIController] Opened in browser: {url}")

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

        # Status
        status_label = tk.Label(
            info_frame,
            text="Backend API and Frontend are running normally",
            font=("Arial", 10),
            bg="#1e1e1e",
            fg="gray"
        )
        status_label.pack(side=tk.BOTTOM, pady=10)

        ColorPrint.yellow("[MatrixUIController] Showing webview unavailable message")

    def _show_error(self, parent: tk.Frame, error_message: str):
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

        ColorPrint.red(f"[MatrixUIController] Error: {error_message}")

    def update_url(self, new_url: str):
        """
        Update webview URL

        Args:
            new_url: New URL to load
        """
        self.frontend_url = new_url

        if self.webview_widget and hasattr(self.webview_widget, 'load_website'):
            try:
                self.webview_widget.load_website(new_url)
                ColorPrint.green(f"[MatrixUIController] URL updated: {new_url}")
            except Exception as e:
                ColorPrint.red(f"[MatrixUIController] Failed to update URL: {e}")
