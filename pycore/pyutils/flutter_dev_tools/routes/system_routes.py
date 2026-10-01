#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Routes Handler - System operations endpoints
"""


# Import from pycore following standards
from pycore.pyfoundations.pygvar import IS_WINDOWS, CPU_COUNT
from pycore.pyfoundations.system_info import SCREEN_RESOLUTION, MEMORY_INFO, DISK_INFO

from pycore.pyutils.flutter_dev_tools.routes.base_handler import BaseHandler
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

import time


class SystemRoutesHandler(BaseHandler):
    """Handler for system-related routes"""

    def __init__(self, request_handler, shutdown_signal: str):
        """
        Initialize system routes handler

        Args:
            request_handler: HTTP request handler
            shutdown_signal: THREAD_BUS shutdown signal name
        """
        super().__init__(request_handler)
        self.shutdown_signal = shutdown_signal

    def shutdown_server(self) -> None:
        """Shutdown server"""
        self.log_request("Shutdown request received")

        self.send_success_response("Server shutting down...")

        # Set shutdown event in separate thread
        def delayed_shutdown():
            time.sleep(0.5)
            THREAD_BUS.signal(self.shutdown_signal, True)

        start_bus_task(delayed_shutdown, thread_name="FlutterDelayedShutdownThread")

    def get_system_info(self) -> None:
        """Get system information"""
        system_info = {
            "platform": {
                "is_windows": IS_WINDOWS,
                "cpu_count": CPU_COUNT
            },
            "screen": SCREEN_RESOLUTION._asdict() if SCREEN_RESOLUTION else {},
            "memory": MEMORY_INFO._asdict() if MEMORY_INFO else {},
            "disk": DISK_INFO._asdict() if DISK_INFO else {}
        }

        self.send_json_response({
            "success": True,
            "system": system_info
        })

