#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base Handler - Common functionality for all route handlers
"""

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse, parse_qs

# Import from pycore following PYTHON_PYCORE.md standards
from pycore.pyfoundations import ColorPrint

from config import get_app_config


class BaseHandler:
    """
    Base handler for all route handlers

    Provides common utilities:
    - JSON response helpers
    - Error handling
    - Request body parsing
    - Configuration access
    """

    def __init__(self, request_handler: BaseHTTPRequestHandler):
        """
        Initialize handler

        Args:
            request_handler: HTTP request handler instance
        """
        self.request = request_handler
        self.config = get_app_config()

    def parse_request_body(self) -> Optional[Dict[str, Any]]:
        """
        Parse JSON request body

        Returns:
            Parsed JSON dict or None if parsing fails
        """
        try:
            content_length = int(self.request.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}

            body = self.request.rfile.read(content_length)
            return json.loads(body.decode('utf-8'))

        except json.JSONDecodeError as e:
            ColorPrint.red(f"[Handler] JSON decode error: {e}")
            return None
        except Exception as e:
            ColorPrint.red(f"[Handler] Failed to parse request body: {e}")
            return None

    def get_query_params(self) -> Dict[str, str]:
        """
        Get query parameters from request

        Returns:
            Dict of query parameters (first value only for each key)
        """
        parsed_url = urlparse(self.request.path)
        params = parse_qs(parsed_url.query)

        # Return first value for each key
        return {key: values[0] for key, values in params.items() if values}

    def send_json_response(self, data: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        """
        Send JSON response

        Args:
            data: Data to serialize as JSON
            status: HTTP status code
        """
        try:
            payload = json.dumps(data, ensure_ascii=False).encode('utf-8')

            self.request.send_response(status)
            self.request.send_header("Content-Type", "application/json; charset=utf-8")
            self.request.send_header("Content-Length", str(len(payload)))
            self.request.end_headers()
            self.request.wfile.write(payload)

        except Exception as e:
            ColorPrint.red(f"[Handler] Failed to send JSON response: {e}")
            self.send_error_response("Internal server error", HTTPStatus.INTERNAL_SERVER_ERROR)

    def send_file_response(
        self,
        file_path: Path,
        content_type: str = "application/octet-stream"
    ) -> None:
        """
        Send file as response

        Args:
            file_path: Path to file
            content_type: MIME type
        """
        try:
            if not file_path.exists():
                self.send_error_response("File not found", HTTPStatus.NOT_FOUND)
                return

            data = file_path.read_bytes()

            self.request.send_response(HTTPStatus.OK)
            self.request.send_header("Content-Type", content_type)
            self.request.send_header("Content-Length", str(len(data)))
            self.request.end_headers()
            self.request.wfile.write(data)

        except Exception as e:
            ColorPrint.red(f"[Handler] Failed to send file: {e}")
            self.send_error_response("Failed to read file", HTTPStatus.INTERNAL_SERVER_ERROR)

    def send_success_response(self, message: str = "Success", data: Optional[Dict] = None) -> None:
        """
        Send success JSON response

        Args:
            message: Success message
            data: Additional data to include
        """
        response = {
            "success": True,
            "message": message
        }

        if data:
            response.update(data)

        self.send_json_response(response)

    def send_error_response(
        self,
        error: str,
        status: HTTPStatus = HTTPStatus.BAD_REQUEST
    ) -> None:
        """
        Send error JSON response

        Args:
            error: Error message
            status: HTTP status code
        """
        self.send_json_response({
            "success": False,
            "error": error
        }, status)

    def log_request(self, message: str) -> None:
        """
        Log request with color

        Args:
            message: Log message
        """
        ColorPrint.blue(f"[Request] {message}")

    def log_error(self, message: str) -> None:
        """
        Log error with color

        Args:
            message: Error message
        """
        ColorPrint.red(f"[Error] {message}")

    def log_success(self, message: str) -> None:
        """
        Log success with color

        Args:
            message: Success message
        """
        ColorPrint.green(f"[Success] {message}")
