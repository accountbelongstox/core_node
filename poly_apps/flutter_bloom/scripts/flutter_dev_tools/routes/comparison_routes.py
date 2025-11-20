#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comparison Routes Handler - Comparison image operation endpoints
"""

import base64
from http import HTTPStatus

from routes.base_handler import BaseHandler
from api import comparison_api
from utils import path_utils


class ComparisonRoutesHandler(BaseHandler):
    """Handler for comparison-related routes"""

    def create_comparison(self, app_name: str) -> None:
        """
        POST /api/apps/:app/comparison/create
        Create comparison image

        Args:
            app_name: Application name

        Request body:
        {
            "page_key": "page_name",
            "expected_image_path": "/path/to/expected.png",
            "description": "implemented",
            "image_data": "base64_encoded_image"
        }
        """
        try:
            data = self.parse_request_body()
            if data is None:
                self.send_error_response("Invalid JSON", HTTPStatus.BAD_REQUEST)
                return

            page_key = data.get("page_key", "")
            expected_image_path = data.get("expected_image_path", "")
            description = data.get("description", "implemented")
            image_data_b64 = data.get("image_data", "")

            if not image_data_b64:
                self.send_error_response("Missing image_data", HTTPStatus.BAD_REQUEST)
                return

            image_data = base64.b64decode(image_data_b64)

            if not page_key or not expected_image_path or not image_data:
                self.send_error_response("Missing required parameters", HTTPStatus.BAD_REQUEST)
                return

            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            result = comparison_api.create_comparison(
                app_path,
                page_key,
                expected_image_path,
                image_data,
                description
            )
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to create comparison for {app_name}: {e}")
            import traceback
            traceback.print_exc()
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def list_comparisons(self, app_name: str, page_key: str) -> None:
        """
        GET /api/apps/:app/comparison/list/:page
        List comparison images for a page

        Args:
            app_name: Application name
            page_key: Page key
        """
        try:
            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            result = comparison_api.list_comparisons(app_path, page_key)
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to list comparisons for {app_name}/{page_key}: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def download_comparison(self, app_name: str, page_key: str, filename: str) -> None:
        """
        GET /api/comparison/download/:app/:page/:file
        Download comparison image

        Args:
            app_name: Application name
            page_key: Page key
            filename: Comparison filename
        """
        try:
            file_path = comparison_api.get_comparison_file_path(app_name, page_key, filename)

            if not file_path or not file_path.exists():
                self.send_error_response("Comparison image not found", HTTPStatus.NOT_FOUND)
                return

            # Send image file
            self.send_file_response(file_path, "image/png")

        except Exception as e:
            self.log_error(f"Failed to download comparison {app_name}/{page_key}/{filename}: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
