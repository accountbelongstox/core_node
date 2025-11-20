#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Starter Functions

All service starter functions are defined here.
Each starter function:
1. Creates service instance from original class
2. Starts the service
3. Registers shutdown handler in THREAD_BUS
4. Returns service instance
"""

from typing import Dict, Any, Optional
from pycore import ColorPrint, THREAD_BUS
from .registry import SERVICE_STARTERS, THREAD_REGISTRY


# ============================================================
# Heartbeat Service
# ============================================================

def start_heartbeat(config: Dict[str, Any]) -> Any:
    """Start heartbeat service (original class)"""
    ColorPrint.blue("[heartbeat] Starting Heartbeat System...")
    from pycore.pyheartbeat import initialize_heartbeat_system

    instance = initialize_heartbeat_system()
    instance.start()

    # Register shutdown handler
    def stop_heartbeat():
        ColorPrint.blue("[heartbeat] Stopping Heartbeat System...")
        if hasattr(instance, 'stop'):
            instance.stop()
        ColorPrint.green("[heartbeat] Heartbeat System stopped")

    priority = THREAD_REGISTRY['heartbeat']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_heartbeat,
        priority=priority,
        name="heartbeat"
    )

    ColorPrint.green("[heartbeat] Heartbeat System started")
    return instance


# ============================================================
# RPC v2 Service
# ============================================================

def start_rpc_v2(config: Dict[str, Any]) -> Any:
    """Start RPC v2 service (original class)"""
    port = config.get('port', 58100)
    host = config.get('host', '0.0.0.0')
    debug = config.get('debug', False)

    ColorPrint.blue(f"[rpc_v2] Starting RPC v2 Server on {host}:{port}...")
    from pycore.pyutils.rpc_v2 import FastAPIRPCServerRunner

    instance = FastAPIRPCServerRunner(
        host=host,
        port=port,
        debug=debug
    )
    instance.start()

    # Register shutdown handler
    def stop_rpc_v2():
        ColorPrint.blue("[rpc_v2] Stopping RPC v2 Server...")
        if hasattr(instance, 'stop'):
            instance.stop()
        ColorPrint.green("[rpc_v2] RPC v2 Server stopped")

    priority = THREAD_REGISTRY['rpc_v2']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_rpc_v2,
        priority=priority,
        name="rpc_v2"
    )

    ColorPrint.green(f"[rpc_v2] RPC v2 Server started on {host}:{port}")
    ColorPrint.blue(f"[rpc_v2] HTTP: http://{host}:{port}/rpc/<route>")
    ColorPrint.blue(f"[rpc_v2] WebSocket: ws://{host}:{port}/rpc/ws")

    return instance


# ============================================================
# Speech Service
# ============================================================

def start_speech(config: Dict[str, Any]) -> Any:
    """Start speech service (original class)"""
    mode = config.get('mode', 'single')
    mic_language = config.get('mic_language', 'zh-CN')
    system_language = config.get('system_language', 'en-US')
    daemon = config.get('daemon', True)

    ColorPrint.blue(f"[speech] Starting Speech Service (mode: {mode})...")
    from pycore.pyctl.speech.speech_thread import SpeechTranscriptionThread

    instance = SpeechTranscriptionThread(
        mode=mode,
        mic_language=mic_language,
        system_language=system_language,
        daemon=daemon
    )
    instance.start()

    # Register shutdown handler
    def stop_speech():
        ColorPrint.blue("[speech] Stopping Speech Service...")
        if hasattr(instance, 'stop'):
            instance.stop()
        ColorPrint.green("[speech] Speech Service stopped")

    priority = THREAD_REGISTRY['speech']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_speech,
        priority=priority,
        name="speech"
    )

    ColorPrint.green(f"[speech] Speech Service started (mode: {mode})")
    return instance


# ============================================================
# UI Service
# ============================================================

def start_ui(config: Dict[str, Any]) -> Any:
    """Start UI service (placeholder)"""
    ColorPrint.yellow("[ui] UI Service not implemented yet")
    return None


# ============================================================
# Auto-register all starters
# ============================================================

SERVICE_STARTERS['heartbeat'] = start_heartbeat
SERVICE_STARTERS['rpc_v2'] = start_rpc_v2
SERVICE_STARTERS['speech'] = start_speech
SERVICE_STARTERS['ui'] = start_ui
