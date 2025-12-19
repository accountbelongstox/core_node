#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status RPC Routes

Service status and health monitoring endpoints.

Endpoints:
- status: Get comprehensive service status
"""

from typing import Dict, Any

from pycore.pyfoundations import ColorPrint, ENCYCLOPEDIA, get_global_task_queue


def register_status_routes(rpc_server, service_instances: Dict[str, Any]):
    """
    Register status routes on RPC server

    Args:
        rpc_server: UnifiedRpcServerRunner instance (HTTP + WebSocket + CORS)
        service_instances: Dict with service instances
    """

    def handle_status(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get comprehensive service status

        Returns:
            {
                "success": true,
                "rpc_server": {...},
                "tts_switch": {...},
                "stt_switch": {...},
                "thread_pool": {...},
                "heartbeat": {...},
                "queue_size": 5
            }
        """
        from pycore.pyheartbeat import THREAD_POOL_THREADS_KEY, get_heartbeat_system

        # Get thread pool info from Encyclopedia
        threads_data = ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY) or {}

        # Get heartbeat stats
        heartbeat_system = get_heartbeat_system()
        heartbeat_stats = heartbeat_system.get_stats() if heartbeat_system else {}

        # Get TTS switch status
        tts_switch = service_instances.get('tts_switch')
        tts_status = tts_switch.get_status() if tts_switch and hasattr(tts_switch, 'get_status') else {}

        # Get STT switch status
        stt_switch = service_instances.get('stt_switch')
        stt_status = stt_switch.get_status() if stt_switch and hasattr(stt_switch, 'get_status') else {}

        # Get RPC server status
        rpc_status = {}
        if hasattr(rpc_server, 'get_status'):
            rpc_status = rpc_server.get_status()

        # Get task queue status
        task_queue = get_global_task_queue()
        queue_size = task_queue.size() if task_queue else 0

        return {
            'success': True,
            'rpc_server': rpc_status,
            'tts_switch': tts_status,
            'stt_switch': stt_status,
            'thread_pool': threads_data,
            'heartbeat': heartbeat_stats,
            'queue_size': queue_size
        }

    # Register route
    rpc_server.route('status', handle_status)

    ColorPrint.green("[Status Routes] Registered:")
    ColorPrint.blue("  - status")


__all__ = ['register_status_routes']
