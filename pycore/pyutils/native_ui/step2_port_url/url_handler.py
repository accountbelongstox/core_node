#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL Handler - URL type detection and processing

Handles different types of URLs for native UI applications:
- Remote HTTP/HTTPS URLs
- Static local HTML files
- Nuxt application dev servers
- Vue distribution builds
"""

from typing import Literal, Tuple, Optional, Dict
from pathlib import Path
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyutils.native_ui.step2_port_url.server_manager import server_manager



URLType = Literal["remote", "static", "nuxt_app", "vue_dist", "auto"]


class URLHandler:
    """
    URL handler for native UI applications

    Detects and processes different URL types automatically.
    """

    def __init__(self, project_root: Optional[Path] = None, debug: bool = False):
        """
        Initialize URL handler

        Args:
            project_root: Project root directory
            debug: Enable debug output
        """
        self.project_root = project_root or Path.cwd()
        self.debug = debug

    def detect_url_type(self, url: str) -> URLType:
        """
        Auto-detect URL type

        Args:
            url: URL string

        Returns:
            Detected URL type

        Examples:
            >>> detect_url_type("http://localhost:3000")
            "remote"

            >>> detect_url_type("app_pymatrix")
            "nuxt_app"

            >>> detect_url_type("/path/to/dist")
            "vue_dist"
        """
        # Remote URLs
        if url.startswith(("http://", "https://")):
            return "remote"

        # Static files
        if url.startswith("file://") or url.endswith(".html"):
            return "static"

        # Nuxt apps (app_ prefix)
        if url.startswith("app_"):
            return "nuxt_app"

        # Vue dist (directory with index.html)
        path = Path(url)
        if path.is_dir() and (path / "index.html").exists():
            return "vue_dist"

        # Default to remote
        return "remote"

    def process_url(
        self, url: str, url_type: URLType = "auto"
    ) -> Tuple[str, URLType, Optional[Dict]]:
        """
        Process URL and return final URL with metadata

        Args:
            url: URL string
            url_type: URL type (auto-detected if "auto")

        Returns:
            Tuple of (final_url, actual_type, metadata)

        Examples:
            >>> process_url("http://localhost:3000")
            ("http://localhost:3000", "remote", None)

            >>> process_url("app_pymatrix", "nuxt_app")
            ("http://localhost:3000", "nuxt_app", {"dev_server": True, ...})
        """
        # Auto-detect type if needed
        if url_type == "auto":
            url_type = self.detect_url_type(url)
            if self.debug:
                ColorPrint.blue(f"[URLHandler] Auto-detected type: {url_type}")

        # Process based on type
        if url_type == "remote":
            return self._process_remote(url)
        elif url_type == "static":
            return self._process_static(url)
        elif url_type == "nuxt_app":
            return self._process_nuxt_app(url)
        elif url_type == "vue_dist":
            return self._process_vue_dist(url)
        else:
            raise ValueError(f"Unknown URL type: {url_type}")

    def _process_remote(self, url: str) -> Tuple[str, URLType, Optional[Dict]]:
        """Process remote HTTP/HTTPS URL"""
        if self.debug:
            ColorPrint.blue(f"[URLHandler] Remote URL: {url}")
        return url, "remote", None

    def _process_static(self, url: str) -> Tuple[str, URLType, Optional[Dict]]:
        """Process static HTML file"""
        # Convert to file:// URL if needed
        if not url.startswith("file://"):
            path = Path(url).resolve()
            url = f"file:///{path.as_posix()}"

        if self.debug:
            ColorPrint.blue(f"[URLHandler] Static file: {url}")

        return url, "static", {"file_path": url}

    def _process_nuxt_app(self, url: str) -> Tuple[str, URLType, Optional[Dict]]:
        """
        Process Nuxt application

        Auto-starts Nuxt dev server if not already running.

        Args:
            url: App name (e.g., "app_pymatrix")

        Returns:
            Tuple of (final_url, type, metadata)
        """

        app_name = url
        server_mgr = server_manager

        if self.debug:
            ColorPrint.blue(f"[URLHandler] Processing Nuxt app: {app_name}")

        # Try to start Nuxt dev server
        try:
            server_process = server_mgr.start_nuxt_dev_server(
                app_name=app_name,
                project_root=self.project_root,
                port=None  # Auto-allocate port
            )

            if server_process:
                # Server started or already running
                final_url = server_process.url
                metadata = {
                    "app_name": app_name,
                    "dev_server": True,
                    "auto_started": server_process.process is not None,
                    "port": server_process.port,
                    "working_dir": str(server_process.working_dir)
                }

                if self.debug:
                    ColorPrint.blue(f"[URLHandler] Nuxt app ready: {final_url}")

                return final_url, "nuxt_app", metadata
            else:
                # Failed to start server, fallback to default
                ColorPrint.print_warn(
                    f"[URLHandler] Failed to start Nuxt dev server for {app_name}, "
                    "assuming it's running at http://localhost:3000"
                )
                return "http://localhost:3000", "nuxt_app", {
                    "app_name": app_name,
                    "dev_server": True,
                    "auto_started": False,
                    "fallback": True
                }

        except Exception as e:
            ColorPrint.print_error(f"[URLHandler] Error processing Nuxt app: {e}")
            # Fallback to default URL
            return "http://localhost:3000", "nuxt_app", {
                "app_name": app_name,
                "dev_server": True,
                "auto_started": False,
                "error": str(e)
            }

    def _process_vue_dist(self, url: str) -> Tuple[str, URLType, Optional[Dict]]:
        """
        Process Vue distribution build

        Auto-starts static file server for Vue dist directory.

        Args:
            url: Path to Vue dist directory

        Returns:
            Tuple of (final_url, type, metadata)
        """

        dist_path = Path(url).resolve()
        server_mgr = server_manager

        if self.debug:
            ColorPrint.blue(f"[URLHandler] Processing Vue dist: {dist_path}")

        # Verify dist directory exists
        if not dist_path.exists() or not dist_path.is_dir():
            ColorPrint.print_error(f"[URLHandler] Dist directory not found: {dist_path}")
            # Fallback to file:// URL
            index_path = dist_path / "index.html"
            return f"file:///{index_path.as_posix()}", "vue_dist", {
                "dist_path": str(dist_path),
                "file_server": False,
                "error": "Directory not found"
            }

        # Try to start static file server
        try:
            server_process = server_mgr.start_vue_static_server(
                dist_path=dist_path,
                port=None  # Auto-allocate port
            )

            if server_process:
                # Server started successfully
                final_url = server_process.url
                metadata = {
                    "dist_path": str(dist_path),
                    "file_server": True,
                    "auto_started": True,
                    "port": server_process.port
                }

                if self.debug:
                    ColorPrint.blue(f"[URLHandler] Vue dist server ready: {final_url}")

                return final_url, "vue_dist", metadata
            else:
                # Failed to start server, fallback to file:// URL
                ColorPrint.print_warn(
                    f"[URLHandler] Failed to start static server for {dist_path}, "
                    "falling back to file:// URL"
                )
                index_path = dist_path / "index.html"
                return f"file:///{index_path.as_posix()}", "vue_dist", {
                    "dist_path": str(dist_path),
                    "file_server": False,
                    "fallback": True
                }

        except Exception as e:
            ColorPrint.print_error(f"[URLHandler] Error processing Vue dist: {e}")
            # Fallback to file:// URL
            index_path = dist_path / "index.html"
            return f"file:///{index_path.as_posix()}", "vue_dist", {
                "dist_path": str(dist_path),
                "file_server": False,
                "error": str(e)
            }


# Convenience function
def process_url(
    url: str,
    url_type: URLType = "auto",
    project_root: Optional[Path] = None,
    debug: bool = False,
) -> Tuple[str, URLType, Optional[Dict]]:
    """
    Convenience function to process URL

    Args:
        url: URL string
        url_type: URL type (auto-detected if "auto")
        project_root: Project root directory
        debug: Enable debug output

    Returns:
        Tuple of (final_url, actual_type, metadata)
    """
    handler = URLHandler(project_root=project_root, debug=debug)
    return handler.process_url(url, url_type)
