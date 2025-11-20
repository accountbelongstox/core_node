#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
App Routes Handler - Application management endpoints
"""

from http import HTTPStatus
from pathlib import Path

from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler
from pycore.pyutils.flutter_dev_tools.api import app_checker, file_tree
from pycore.pyutils.flutter_dev_tools.utils import path_utils


class AppRoutesHandler(BaseHandler):
    """Handler for application-related routes"""

    def list_apps(self) -> None:
        """
        GET /api/apps
        List all Flutter apps
        """
        try:
            apps_dir = path_utils.get_apps_dir()
            apps = app_checker.list_apps(apps_dir)
            results = [app_checker.check_app(app) for app in apps]

            self.send_json_response(results)

        except Exception as e:
            self.log_error(f"Failed to list apps: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def get_file_tree(self, app_name: str) -> None:
        """
        GET /api/apps/:app/tree
        Get file tree for an app

        Args:
            app_name: Application name
        """
        try:
            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            design_dir = path_utils.get_design_dir(app_path)
            if not design_dir.exists():
                self.send_json_response({"error": "Design directory not found"})
                return

            tree = file_tree.build_file_tree(design_dir, design_dir.parent)
            self.send_json_response(tree)

        except Exception as e:
            self.log_error(f"Failed to get file tree for {app_name}: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def fix_missing_items(self, app_name: str) -> None:
        """
        POST /api/apps/:app/fix
        Create missing items for an app

        Args:
            app_name: Application name
        """
        try:
            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error_response("App not found", HTTPStatus.NOT_FOUND)
                return

            created = app_checker.create_missing_items(app_path)

            self.send_json_response({
                "success": True,
                "status": "ok",
                "created": created
            })

        except Exception as e:
            self.log_error(f"Failed to fix missing items for {app_name}: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
