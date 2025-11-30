#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Config Routes Handler - Configuration management endpoints
"""

from http import HTTPStatus
from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler


class ConfigRoutesHandler(BaseHandler):
    """Handler for configuration-related routes"""

    def get_config(self) -> None:
        """Get current configuration"""
        try:
            config_data = self.config.get_all()
            self.send_json_response({
                "success": True,
                "config": config_data
            })
        except Exception as e:
            self.log_error(f"Failed to get config: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def update_config(self) -> None:
        """Update configuration"""
        try:
            data = self.parse_request_body()
            if data is None:
                self.send_error_response("Invalid JSON")
                return

            key_path = data.get("key")
            value = data.get("value")

            if not key_path:
                self.send_error_response("Missing 'key' parameter")
                return

            self.config.set(key_path, value, save=True)

            self.send_success_response(f"Updated config: {key_path}")

        except Exception as e:
            self.log_error(f"Failed to update config: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    def reset_config(self) -> None:
        """Reset configuration to defaults"""
        try:
            # Delete config file
            if self.config.config_file.exists():
                self.config.config_file.unlink()

            # Reload (will recreate defaults)
            self.config.reload()

            self.send_success_response("Configuration reset to defaults")

        except Exception as e:
            self.log_error(f"Failed to reset config: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
