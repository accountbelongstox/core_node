#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Routes Handler - System operations endpoints
"""

import threading
from http import HTTPStatus

# Import from pycore following standards
from pycore.pygvar import (
    SYSTEM_SCREEN_RESOLUTION,
    SYSTEM_MEMORY_INFO,
    SYSTEM_DISK_INFO,
    IS_WINDOWS,
    CPU_COUNT
)

from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler


class SystemRoutesHandler(BaseHandler):
    """Handler for system-related routes"""

    def __init__(self, request_handler, shutdown_event: threading.Event):
        """
        Initialize system routes handler

        Args:
            request_handler: HTTP request handler
            shutdown_event: Threading event for shutdown signal
        """
        super().__init__(request_handler)
        self.shutdown_event = shutdown_event

    def shutdown_server(self) -> None:
        """Shutdown server"""
        try:
            self.log_request("Shutdown request received")

            self.send_success_response("Server shutting down...")

            # Set shutdown event in separate thread
            def delayed_shutdown():
                import time
                time.sleep(0.5)
                self.shutdown_event.set()

            threading.Thread(target=delayed_shutdown, daemon=True).start()

        except Exception as e:
            self.log_error(f"Shutdown failed: {e}")
            self.send_error_response(str(e))

    def get_system_info(self) -> None:
        """Get system information"""
        try:
            system_info = {
                "platform": {
                    "is_windows": IS_WINDOWS,
                    "cpu_count": CPU_COUNT
                },
                "screen": SYSTEM_SCREEN_RESOLUTION._asdict() if SYSTEM_SCREEN_RESOLUTION else {},
                "memory": SYSTEM_MEMORY_INFO._asdict() if SYSTEM_MEMORY_INFO else {},
                "disk": SYSTEM_DISK_INFO._asdict() if SYSTEM_DISK_INFO else {}
            }

            self.send_json_response({
                "success": True,
                "system": system_info
            })

        except Exception as e:
            self.log_error(f"Failed to get system info: {e}")
            self.send_error_response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)
