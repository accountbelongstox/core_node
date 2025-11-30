#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Static Routes Handler - Serve static files and index
"""

from pathlib import Path
from http import HTTPStatus
from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler


class StaticRoutesHandler(BaseHandler):
    """Handler for static file serving"""

    def __init__(self, request_handler, static_dir: Path):
        super().__init__(request_handler)
        self.static_dir = static_dir

    def serve_index(self) -> None:
        """Serve index.html"""
        index_path = self.static_dir / "index.html"
        self.send_file_response(index_path, "text/html; charset=utf-8")

    def serve_static(self, filename: str) -> None:
        """Serve static file"""
        content_types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
        }

        file_path = self.static_dir / filename
        extension = file_path.suffix.lower()
        content_type = content_types.get(extension, "application/octet-stream")

        self.send_file_response(file_path, f"{content_type}; charset=utf-8")
