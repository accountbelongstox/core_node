#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URL Handler - Automatic URL type detection and processing

Supports multiple URL types:
- remote: Remote HTTP/HTTPS URLs
- static: Local static HTML files
- nuxt_app: Nuxt application (from poly_apps/nuxt_main/apps/)
- vue_dist: Vue build distribution directory
- auto: Automatic detection

Handles automatic service startup for Nuxt apps.
"""

import os
from pathlib import Path
from typing import Literal, Tuple, Optional
from pycore.pyfoundations import ColorPrint

# URL type definitions
URLType = Literal["remote", "static", "nuxt_app", "vue_dist", "auto"]


class URLHandler:
    """URL type detection and processing"""

    def __init__(self, project_root: Optional[Path] = None, debug: bool = False):
        """
        Initialize URL handler

        Args:
            project_root: Project root directory (auto-detected if not provided)
            debug: Enable debug output
        """
        if project_root is None:
            # Auto-detect project root (3 levels up from this file)
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.debug = debug

    def detect_url_type(self, url: str) -> URLType:
        """
        Auto-detect URL type from URL string

        Args:
            url: URL string

        Returns:
            Detected URL type

        Examples:
            >>> handler.detect_url_type("http://localhost:3000")
            'remote'
            >>> handler.detect_url_type("app_pymatrix")
            'nuxt_app'
            >>> handler.detect_url_type("file:///path/to/index.html")
            'static'
        """
        # Remote URL (http:// or https://)
        if url.startswith(("http://", "https://")):
            return "remote"

        # Static file (file:// or ends with .html)
        if url.startswith("file://") or url.endswith(".html"):
            return "static"

        # Check if it's a nuxt app name (starts with "app_")
        if url.startswith("app_"):
            nuxt_app_dir = self.project_root / "poly_apps" / "nuxt_main" / "apps" / url
            if nuxt_app_dir.exists():
                return "nuxt_app"

        # Check if it's a directory path (Vue dist)
        url_path = Path(url)
        if url_path.is_dir():
            # Check for typical Vue dist files
            if (url_path / "index.html").exists():
                return "vue_dist"

        # Default to remote
        return "remote"

    def process_url(
        self,
        url: str,
        url_type: URLType = "auto"
    ) -> Tuple[str, URLType, Optional[dict]]:
        """
        Process URL and return final URL with type and metadata

        Args:
            url: Input URL string
            url_type: URL type hint (use "auto" for auto-detection)

        Returns:
            Tuple of (final_url, actual_type, metadata)
            - final_url: Processed URL ready for webview
            - actual_type: Actual detected URL type
            - metadata: Additional information (service info, paths, etc.)

        Examples:
            >>> handler.process_url("http://localhost:3000", "remote")
            ('http://localhost:3000', 'remote', None)

            >>> handler.process_url("app_pymatrix", "nuxt_app")
            ('http://localhost:3001', 'nuxt_app', {'app_name': 'app_pymatrix', ...})
        """
        # Auto-detect if needed
        if url_type == "auto":
            url_type = self.detect_url_type(url)

        if self.debug:
            ColorPrint.blue(f"[URLHandler] Processing URL: {url} (type: {url_type})")

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
            # Fallback to remote
            return url, "remote", None

    def _process_remote(self, url: str) -> Tuple[str, URLType, None]:
        """Process remote URL (no change needed)"""
        if self.debug:
            ColorPrint.green(f"[URLHandler] Remote URL: {url}")
        return url, "remote", None

    def _process_static(self, url: str) -> Tuple[str, URLType, dict]:
        """Process static HTML file"""
        # Convert to file:// URL if needed
        if not url.startswith("file://"):
            file_path = Path(url).resolve()
            url = f"file:///{file_path}"

        if self.debug:
            ColorPrint.green(f"[URLHandler] Static file: {url}")

        metadata = {
            "file_path": url
        }
        return url, "static", metadata

    def _process_nuxt_app(self, url: str) -> Tuple[str, URLType, dict]:
        """
        Process Nuxt app - start dev server or use build

        TODO: Implement Nuxt dev server startup
        TODO: Support production build mode
        TODO: Auto-detect available port
        """
        app_name = url
        app_dir = self.project_root / "poly_apps" / "nuxt_main" / "apps" / app_name

        if not app_dir.exists():
            ColorPrint.yellow(
                f"[URLHandler] Warning: Nuxt app directory not found: {app_dir}"
            )
            # Fallback to localhost
            return "http://localhost:3000", "nuxt_app", None

        # TODO: Start Nuxt dev server
        # For now, assume it's already running on port 3000
        final_url = "http://localhost:3000"

        if self.debug:
            ColorPrint.blue(f"[URLHandler] Nuxt app: {app_name}")
            ColorPrint.yellow("[URLHandler] TODO: Auto-start Nuxt dev server")

        metadata = {
            "app_name": app_name,
            "app_dir": str(app_dir),
            "dev_server_url": final_url,
            "auto_started": False  # TODO: Set to True when implemented
        }

        return final_url, "nuxt_app", metadata

    def _process_vue_dist(self, url: str) -> Tuple[str, URLType, dict]:
        """
        Process Vue dist directory - serve static files

        TODO: Implement local file server for Vue dist
        TODO: Find available port and start server
        """
        dist_dir = Path(url).resolve()

        if not dist_dir.exists():
            ColorPrint.yellow(
                f"[URLHandler] Warning: Vue dist directory not found: {dist_dir}"
            )
            return url, "vue_dist", None

        index_html = dist_dir / "index.html"
        if not index_html.exists():
            ColorPrint.yellow(
                f"[URLHandler] Warning: index.html not found in: {dist_dir}"
            )

        # TODO: Start local file server
        # For now, use file:// protocol
        final_url = f"file:///{index_html}"

        if self.debug:
            ColorPrint.blue(f"[URLHandler] Vue dist: {dist_dir}")
            ColorPrint.yellow("[URLHandler] TODO: Start local file server")

        metadata = {
            "dist_dir": str(dist_dir),
            "index_html": str(index_html),
            "server_started": False  # TODO: Set to True when implemented
        }

        return final_url, "vue_dist", metadata


def process_url(
    url: str,
    url_type: URLType = "auto",
    project_root: Optional[Path] = None,
    debug: bool = False
) -> Tuple[str, URLType, Optional[dict]]:
    """
    Convenience function for URL processing

    Args:
        url: Input URL string
        url_type: URL type hint (use "auto" for auto-detection)
        project_root: Project root directory (auto-detected if not provided)
        debug: Enable debug output

    Returns:
        Tuple of (final_url, actual_type, metadata)
    """
    handler = URLHandler(project_root=project_root, debug=debug)
    return handler.process_url(url, url_type)
