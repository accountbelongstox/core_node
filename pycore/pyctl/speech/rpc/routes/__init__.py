#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Routes - Modular Route Registration

Exports all route registration functions for the speech RPC service.
Each route module handles a specific functional area.

Route Modules:
- tts_routes: Text-to-Speech endpoints
- stt_routes: Speech-to-Text endpoints
- config_routes: Configuration management endpoints
- status_routes: Service status and health
- queue_routes: Queue management and task status

Usage:
    from pycore.pyctl.speech.rpc.routes import (
        register_tts_routes,
        register_stt_routes,
        register_config_routes,
        register_status_routes,
        register_queue_routes
    )

    # Register all routes on RPC server
    register_tts_routes(rpc_server, service_instances)
    register_stt_routes(rpc_server, service_instances)
    register_config_routes(rpc_server, service_instances)
    register_status_routes(rpc_server, service_instances)
    register_queue_routes(rpc_server, service_instances)
"""

from pycore.pyctl.speech.rpc.routes.tts_routes import register_tts_routes
from pycore.pyctl.speech.rpc.routes.stt_routes import register_stt_routes
from pycore.pyctl.speech.rpc.routes.config_routes import register_config_routes
from pycore.pyctl.speech.rpc.routes.status_routes import register_status_routes
from pycore.pyctl.speech.rpc.routes.queue_routes import register_queue_routes
from pycore.pyctl.speech.rpc.routes.clipboard_routes import register_clipboard_routes

__all__ = [
    'register_tts_routes',
    'register_stt_routes',
    'register_config_routes',
    'register_status_routes',
    'register_queue_routes',
    'register_clipboard_routes'
]
