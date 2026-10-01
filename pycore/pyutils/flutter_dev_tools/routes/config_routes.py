#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Config Routes Handler - Configuration management endpoints
"""

from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler


class ConfigRoutesHandler(BaseHandler):
    """Handler for configuration-related routes"""

    def get_config(self) -> None:
        """Get current configuration"""
        config_data = self.config.get_all()
        self.send_json_response({
            "success": True,
            "config": config_data
        })

    def update_config(self) -> None:
        """Update configuration"""
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

    def reset_config(self) -> None:
        """Reset configuration to defaults"""
        self.config.reset()

        self.send_success_response("Configuration reset to defaults")

