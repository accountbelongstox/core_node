#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Routes Handler - File operation endpoints
"""

from http import HTTPStatus
from pathlib import Path

from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler
import pycore.pyutils.flutter_dev_tools.api.file_reader as file_reader
import pycore.pyutils.flutter_dev_tools.api.file_writer as file_writer
import pycore.pyutils.flutter_dev_tools.utils.path_utils as path_utils


class FileRoutesHandler(BaseHandler):
    """Handler for file-related routes"""

    def read_file(self) -> None:
        """
        GET /api/file/content?path=...
        Read file content
        """
        try:
            params = self.get_query_params()
            file_path_str = params.get("path", "")

            if not file_path_str:
                self.send_error_response("Missing path parameter", HTTPStatus.BAD_REQUEST)
                return

            file_path = Path(file_path_str)
            apps_dir = path_utils.get_apps_dir()

            # Security check: ensure file is within apps directory
            if not path_utils.is_safe_path(apps_dir, file_path):
                self.send_error_response("Access denied", HTTPStatus.FORBIDDEN)
                return

            result = file_reader.read_file_content(file_path)
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to read file: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def serve_image(self) -> None:
        """
        GET /api/file/image?path=...
        Serve image file
        """
        try:
            params = self.get_query_params()
            file_path_str = params.get("path", "")

            if not file_path_str:
                self.send_error_response("Missing path parameter", HTTPStatus.BAD_REQUEST)
                return

            file_path = Path(file_path_str)
            apps_dir = path_utils.get_apps_dir()

            # Security check: ensure file is within apps directory
            if not path_utils.is_safe_path(apps_dir, file_path):
                self.send_error_response("Access denied", HTTPStatus.FORBIDDEN)
                return

            # Check if file exists and is an image
            if not file_path.exists() or not file_path.is_file():
                self.send_error_response("Image file not found", HTTPStatus.NOT_FOUND)
                return

            # Determine content type
            image_extensions = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            }

            extension = file_path.suffix.lower()
            content_type = image_extensions.get(extension, 'application/octet-stream')

            # Send file
            self.send_file_response(file_path, content_type)

        except Exception as e:
            self.log_error(f"Failed to serve image: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def save_file(self) -> None:
        """
        POST /api/file/save
        Save file content

        Request body:
        {
            "path": "/path/to/file",
            "content": "file content",
            "validate_json": true/false
        }
        """
        try:
            data = self.parse_request_body()
            if data is None:
                self.send_error_response("Invalid JSON", HTTPStatus.BAD_REQUEST)
                return

            file_path_str = data.get("path", "")
            content = data.get("content", "")
            validate_json = data.get("validate_json", False)

            if not file_path_str:
                self.send_error_response("Missing path parameter", HTTPStatus.BAD_REQUEST)
                return

            file_path = Path(file_path_str)
            apps_dir = path_utils.get_apps_dir()

            # Security check: ensure file is within apps directory
            if not path_utils.is_safe_path(apps_dir, file_path):
                self.send_error_response("Access denied", HTTPStatus.FORBIDDEN)
                return

            # Save file
            result = file_writer.save_file_content(file_path, content, validate_json)
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to save file: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
