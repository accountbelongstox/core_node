#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Service - WebSocket-enabled RPC Service for Speech (Modular Routes)

Uses the FastAPIRPCServer (HTTP + WebSocket + CORS) with PyHeartbeat + SpeechSwitch integration.
Routes are organized in separate modules for better maintainability.

Usage:
    from pycore.pylauncher import launch_services, create_speech_service_config
    from pycore.pyctl.speech.rpc import start_rpc_service

    # Launch services (starts UnifiedRpcServer with WebSocket support)
    config = create_speech_service_config(rpc_port=59000)
    instances = launch_services(config)

    # Register speech routes on running server
    start_rpc_service(instances.rpc_server, instances.tts_switch)
"""

from typing import Optional, Dict, Any

from pycore.pyfoundations import ColorPrint

# Import all route registration functions
from pycore.pyctl.speech.rpc.routes import (
    register_tts_routes,
    register_stt_routes,
    register_config_routes,
    register_status_routes,
    register_queue_routes,
    register_clipboard_routes
)


class RPCService:
    """
    RPC Service - Registers speech routes on the FastAPI RPC server

    Modular design with routes organized by functional area:
    - TTS Routes: Text-to-Speech endpoints
    - STT Routes: Speech-to-Text endpoints
    - Config Routes: Configuration management
    - Status Routes: Service health and monitoring
    - Queue Routes: Task queue management

    NO asyncio, NO wrapper threads. Just registers handlers on existing server.
    """

    def __init__(
        self,
        rpc_server,
        tts_switch=None,
        stt_switch=None
    ):
        """
        Initialize RPC Service

        Args:
            rpc_server: FastAPIRPCServerRunner instance (HTTP + WebSocket + CORS)
            tts_switch: SpeechSwitch instance (optional, kept for compatibility)
            stt_switch: SpeechSwitch instance (optional, kept for compatibility)
        """
        self.server = rpc_server
        self.service_instances = {
            'tts_switch': tts_switch,
            'stt_switch': stt_switch
        }
        self._registered = False

    def register_routes(self):
        """Register all speech-related routes on the server"""
        if self._registered:
            ColorPrint.yellow("[RPCService] Routes already registered")
            return

        ColorPrint.blue("\n[RPCService] Registering speech routes...")

        # Register modular routes
        register_tts_routes(self.server, self.service_instances)
        register_stt_routes(self.server, self.service_instances)
        register_config_routes(self.server, self.service_instances)
        register_status_routes(self.server, self.service_instances)
        register_queue_routes(self.server, self.service_instances)
        register_clipboard_routes(self.server, self.service_instances)

        self._registered = True

        ColorPrint.green("\n[RPCService] ✅ All routes registered successfully")
        ColorPrint.blue("\nAvailable Endpoints:")
        ColorPrint.blue("  TTS:")
        ColorPrint.blue("    - POST /rpc/tts")
        ColorPrint.blue("    - POST /rpc/tts.synthesize")
        ColorPrint.blue("  STT:")
        ColorPrint.blue("    - POST /rpc/stt")
        ColorPrint.blue("    - POST /rpc/stt.recognize")
        ColorPrint.blue("  Config:")
        ColorPrint.blue("    - POST /rpc/config.get")
        ColorPrint.blue("    - POST /rpc/config.set")
        ColorPrint.blue("    - POST /rpc/config.get_all")
        ColorPrint.blue("    - POST /rpc/config.reset")
        ColorPrint.blue("  Status:")
        ColorPrint.blue("    - POST /rpc/status")
        ColorPrint.blue("  Queue:")
        ColorPrint.blue("    - POST /rpc/queue_stats")
        ColorPrint.blue("    - POST /rpc/task_status")
        ColorPrint.blue("  Clipboard:")
        ColorPrint.blue("    - POST /rpc/clipboard_get")
        ColorPrint.blue("    - POST /rpc/clipboard_sync")

    def get_status(self) -> Dict[str, Any]:
        """Get RPC service status"""
        return {
            'registered': self._registered,
            'tts_switch_available': self.service_instances.get('tts_switch') is not None,
            'stt_switch_available': self.service_instances.get('stt_switch') is not None,
            'server_running': self.server is not None
        }


# Global singleton
_global_rpc_service: Optional[RPCService] = None


def get_rpc_service(rpc_server=None, tts_switch=None, stt_switch=None) -> RPCService:
    """Get global RPC service singleton"""
    global _global_rpc_service
    if _global_rpc_service is None:
        if rpc_server is None:
            raise ValueError("rpc_server required for first initialization")
        _global_rpc_service = RPCService(rpc_server, tts_switch, stt_switch)
    return _global_rpc_service


def start_rpc_service(rpc_server, tts_switch=None, stt_switch=None) -> RPCService:
    """
    Register speech routes on running RPC server

    Args:
        rpc_server: FastAPIRPCServerRunner instance (HTTP + WebSocket + CORS)
        tts_switch: SpeechSwitch instance (optional)
        stt_switch: SpeechSwitch instance (optional)

    Returns:
        RPCService instance
    """
    service = get_rpc_service(rpc_server, tts_switch, stt_switch)
    service.register_routes()
    return service


__all__ = [
    'RPCService',
    'get_rpc_service',
    'start_rpc_service'
]
