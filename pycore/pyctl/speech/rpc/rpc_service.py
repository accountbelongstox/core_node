#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Service - FastAPI HTTP controller service for Speech (Modular Routes)

Uses HttpServer HTTP controllers with PyHeartbeat and SpeechSwitch integration.
Routes are organized in separate modules for better maintainability.

Usage:
    from pycore.pylauncher.launcher import launch_services, create_speech_service_config
    from pycore.pyctl.speech.rpc.rpc_service import start_rpc_service

    # Launch services and start the HTTP controller server.
    config = create_speech_service_config(rpc_port=59000)
    instances = launch_services(config)

    # Register speech routes on running server
    start_rpc_service(instances.rpc_server, instances.tts_switch)
"""

from typing import Optional, Dict, Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedSingletonProvider

# Import all route registration functions
from pycore.pyctl.speech.rpc.routes.tts_routes import register_tts_routes
from pycore.pyctl.speech.rpc.routes.stt_routes import register_stt_routes
from pycore.pyctl.speech.rpc.routes.config_routes import register_config_routes
from pycore.pyctl.speech.rpc.routes.status_routes import register_status_routes
from pycore.pyctl.speech.rpc.routes.queue_routes import register_queue_routes
from pycore.pyctl.speech.rpc.routes.clipboard_routes import register_clipboard_routes


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
            rpc_server: HttpServerRunner instance
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
        ColorPrint.blue("    - POST /api/tts")
        ColorPrint.blue("    - POST /api/tts/synthesize")
        ColorPrint.blue("  STT:")
        ColorPrint.blue("    - POST /api/stt")
        ColorPrint.blue("    - POST /api/stt/recognize")
        ColorPrint.blue("  Config:")
        ColorPrint.blue("    - POST /api/config/get")
        ColorPrint.blue("    - POST /api/config/set")
        ColorPrint.blue("    - POST /api/config/get_all")
        ColorPrint.blue("    - POST /api/config/reset")
        ColorPrint.blue("  Status:")
        ColorPrint.blue("    - POST /api/status")
        ColorPrint.blue("  Queue:")
        ColorPrint.blue("    - POST /api/queue_stats")
        ColorPrint.blue("    - POST /api/task_status")
        ColorPrint.blue("  Clipboard:")
        ColorPrint.blue("    - POST /api/clipboard_get")
        ColorPrint.blue("    - POST /api/clipboard_sync")

    def get_status(self) -> Dict[str, Any]:
        """Get RPC service status"""
        return {
            'registered': self._registered,
            'tts_switch_available': self.service_instances.get('tts_switch') is not None,
            'stt_switch_available': self.service_instances.get('stt_switch') is not None,
            'server_running': self.server is not None
        }


def _create_rpc_service(rpc_server=None, tts_switch=None, stt_switch=None) -> RPCService:
    if rpc_server is None:
        raise ValueError("rpc_server required for first initialization")
    return RPCService(rpc_server, tts_switch, stt_switch)


_RPC_SERVICE_PROVIDER = SerializedSingletonProvider(
    _create_rpc_service,
    "speech.rpc_service.provider",
    "SpeechRPCServiceProvider",
)


def get_rpc_service(rpc_server=None, tts_switch=None, stt_switch=None) -> RPCService:
    """Get global RPC service singleton"""
    return _RPC_SERVICE_PROVIDER.get(rpc_server, tts_switch, stt_switch)


def start_rpc_service(rpc_server, tts_switch=None, stt_switch=None) -> RPCService:
    """
    Register speech routes on running RPC server

    Args:
        rpc_server: HttpServerRunner instance
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
