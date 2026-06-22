#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PageView Routes Handler - PageView map operation endpoints
"""

import base64
import re
from http import HTTPStatus

from routes.base_handler import BaseHandler
from api import pageview_updater_api
from utils import path_utils


class PageViewRoutesHandler(BaseHandler):
    """Handler for pageview-related routes"""

    def get_stats(self, app_name: str) -> None:
        """
        GET /api/apps/:app/pageview/stats
        Get pageview map statistics

        Args:
            app_name: Application name
        """
        try:
            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            result = pageview_updater_api.get_pageview_map_stats(app_path)
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to get pageview stats for {app_name}: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def update_pageview_map(self, app_name: str) -> None:
        """
        POST /api/apps/:app/pageview/update
        Update pageview_map.json with image analysis

        Args:
            app_name: Application name

        Request body:
        {
            "layer": "all"|"rough"|"detailed",
            "force": true|false
        }
        """
        try:
            data = self.parse_request_body()
            if data is None:
                data = {}

            layer = data.get("layer", "all")
            force = data.get("force", False)

            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            result = pageview_updater_api.update_app_pageview_map(app_path, layer, force)
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to update pageview map for {app_name}: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def upload_actual_image(self, app_name: str) -> None:
        """
        POST /api/apps/:app/pageview/upload-actual
        Upload actual/composite image

        Args:
            app_name: Application name

        Request body (JSON):
        {
            "page_key": "page_name",
            "description": "implemented",
            "image_data": "base64_encoded_image"
        }

        OR multipart form data:
        - page_key
        - description
        - image (binary)
        """
        try:
            # Read request body
            content_length = int(self.request.headers.get('Content-Length', 0))
            body = self.request.rfile.read(content_length)

            # Determine if multipart or JSON
            content_type = self.request.headers.get('Content-Type', '')
            boundary_match = re.search(r'boundary=(.+)', content_type)

            if not boundary_match:
                # JSON format
                import json
                data = json.loads(body.decode('utf-8'))
                page_key = data.get("page_key", "")
                description = data.get("description", "implemented")
                image_data = base64.b64decode(data.get("image_data", ""))
            else:
                # Multipart format
                boundary = boundary_match.group(1).encode()
                parts = body.split(b'--' + boundary)

                page_key = ""
                description = "implemented"
                image_data = b''

                for part in parts:
                    if b'name="page_key"' in part:
                        page_key = part.split(b'\r\n\r\n')[1].strip(b'\r\n').decode('utf-8')
                    elif b'name="description"' in part:
                        description = part.split(b'\r\n\r\n')[1].strip(b'\r\n').decode('utf-8')
                    elif b'name="image"' in part:
                        image_data = part.split(b'\r\n\r\n')[1].rsplit(b'\r\n', 1)[0]

            if not page_key or not image_data:
                self.send_error_response("Missing page_key or image data", HTTPStatus.BAD_REQUEST)
                return

            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            result = pageview_updater_api.upload_actual_image(
                app_path,
                page_key,
                description,
                image_data
            )
            self.send_json_response(result)

        except Exception as e:
            self.log_error(f"Failed to upload actual image for {app_name}: {e}")
            import traceback
            traceback.print_exc()
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
