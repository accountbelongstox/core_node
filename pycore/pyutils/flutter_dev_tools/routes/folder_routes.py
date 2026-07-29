#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Folder Routes Handler - Folder operation endpoints
"""

from http import HTTPStatus
from pathlib import Path

from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler
import pycore.pyutils.flutter_dev_tools.api.folder_opener as folder_opener
import pycore.pyutils.flutter_dev_tools.utils.path_utils as path_utils


class FolderRoutesHandler(BaseHandler):
    """Handler for folder-related routes"""

    def open_folder(self) -> None:
        """
        POST /api/folder/open
        Open folder in file explorer

        Request body:
        {
            "path": "/path/to/folder"
        }
        """
        try:
            data = self.parse_request_body()
            if data is None:
                self.send_error_response("Invalid JSON", HTTPStatus.BAD_REQUEST)
                return

            folder_path_str = data.get("path", "")
            if not folder_path_str:
                self.send_error_response("Missing path parameter", HTTPStatus.BAD_REQUEST)
                return

            folder_path = Path(folder_path_str)
            apps_dir = path_utils.get_apps_dir()

            # Security check: ensure folder is within apps directory
            if not path_utils.is_safe_path(apps_dir, folder_path):
                self.send_error_response("Access denied", HTTPStatus.FORBIDDEN)
                return

            result = folder_opener.open_folder(folder_path)
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to open folder: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
