#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launch Speech RPC Service

Entry point for starting speech RPC service using PyLauncher.
Starts RPC server only (no UI) with PyHeartbeat and the unified SpeechSwitch.

Usage:
    python -m pycore.pyctl.speech.launch_speech_rpc

    # Or from code:
    from pycore.pyctl.speech.launch_speech_rpc import launch_speech_rpc_service

    instances = launch_speech_rpc_service(port=59000)
"""

import time
import argparse
from typing import Optional

from pycore.pyfoundations import ColorPrint
from pycore.pylauncher import launch_services, create_speech_service_config, ServiceInstances
from pycore.pyctl.speech.rpc import start_rpc_service


def initialize_speech_config():
    """
    Initialize speech service configuration on startup

    Uses dedicated SpeechConfig (util_speech.config table).
    Auto-migrates from GlobalConfig if needed.
    """
    from pycore.pyutils.common import speech_config

    # SpeechConfig will automatically:
    # 1. Initialize defaults from SpeechConfigModel.DEFAULT_CONFIG
    # 2. Auto-migrate speech_* keys from GlobalConfig
    # Just trigger initialization by accessing config
    all_config = speech_config.get_all()

    ColorPrint.blue(f"[SpeechConfig] Loaded {len(all_config)} config keys from speech database")

    # Get statistics by category
    stats = speech_config.get_statistics()
    ColorPrint.blue(f"[SpeechConfig] By category: {stats.get('by_category', {})}")

    return len(all_config)


def launch_speech_rpc_service(
    port: int = 59000,
    host: str = "0.0.0.0",
    tts_provider: str = "edge",
    tts_queue_size: int = 50,
    debug: bool = True
) -> ServiceInstances:
    """
    Launch Speech RPC Service

    Uses pylauncher to:
    1. Start PyHeartbeat system
    2. Start the SpeechSwitch with provider routing
    3. Start the FastAPI-based RPC server (HTTP + WebSocket) in a thread
    4. Register speech routes on the running server

    Args:
        port: RPC server port
        host: RPC server host
        tts_provider: Default TTS provider (edge, azure, both)
        tts_queue_size: TTS queue size
        debug: Enable debug logging

    Returns:
        ServiceInstances containing all started services
    """
    ColorPrint.green("=== Speech RPC Service Launcher ===")

    # Step 0: Initialize speech configuration (auto-create if missing)
    initialize_speech_config()

    # Step 1: Create service configuration
    config = create_speech_service_config(
        rpc_port=port,
        rpc_host=host,
        tts_provider=tts_provider
    )

    # Override settings
    config.tts_max_queue_size = tts_queue_size
    config.rpc_debug = debug

    ColorPrint.blue(f"[SpeechRPC] Port: {port}")
    ColorPrint.blue(f"[SpeechRPC] Host: {host}")
    ColorPrint.blue(f"[SpeechRPC] TTS Provider: {tts_provider}")
    ColorPrint.blue(f"[SpeechRPC] Queue Size: {tts_queue_size}")

    # Step 2: Prepare static web directory path (BEFORE launching services)
    from pathlib import Path
    web_dir = Path(__file__).parent / 'rpc_v2' / 'web'

    # Step 3: Create RPC server and configure static directories BEFORE starting
    from pycore.pyutils.rpc_v2 import UnifiedRpcServerRunner
    rpc_server = UnifiedRpcServerRunner(
        host=config.rpc_host,
        port=config.rpc_port,
        debug=debug
    )

    # Add static directory BEFORE starting server
    if web_dir.exists():
        rpc_server.add_static_dir('/', str(web_dir))
        ColorPrint.blue(f"[SpeechRPC] Configured static web directory: / -> {web_dir}")

    # Step 4: Launch other services (Heartbeat, SpeechSwitch) WITHOUT RPC server
    config.enable_rpc = False  # We'll manage RPC server manually
    instances = launch_services(config)

    # Step 5: Start RPC server (static directories already configured)
    rpc_server.start()
    instances.rpc_server = rpc_server  # Store in instances

    if not instances.rpc_server:
        ColorPrint.red("[SpeechRPC] Failed to start RPC server thread")
        return instances

    ColorPrint.green(f"[SpeechRPC] RPC Server started on {host}:{port}")
    ColorPrint.blue(f"[SpeechRPC] Web UI: http://{host}:{port}/")

    # Step 6: Register speech routes on running RPC server
    ColorPrint.blue("[SpeechRPC] Registering speech routes...")

    rpc_service = start_rpc_service(
        rpc_server=instances.rpc_server,
        tts_switch=instances.tts_switch
    )

    ColorPrint.green("=== Speech RPC Service Started ===")
    ColorPrint.blue(f"  HTTP API: http://{host}:{port}/rpc/<route>")
    ColorPrint.blue(f"  Health: http://{host}:{port}/health")
    ColorPrint.blue(f"  Endpoints:")
    ColorPrint.blue(f"    - POST /rpc/tts")
    ColorPrint.blue(f"    - POST /rpc/stt")
    ColorPrint.blue(f"    - POST /rpc/status")
    ColorPrint.blue(f"    - POST /rpc/queue_stats")

    return instances


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Launch Speech RPC Service")
    parser.add_argument('--port', type=int, default=59000, help='RPC server port (default: 59000)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='RPC server host')
    parser.add_argument('--provider', type=str, default='edge', choices=['edge', 'azure', 'both'],
                        help='Default TTS provider')
    parser.add_argument('--queue-size', type=int, default=50, help='TTS queue size')
    parser.add_argument('--no-debug', action='store_true', help='Disable debug logging')

    args = parser.parse_args()

    # Launch service
    instances = launch_speech_rpc_service(
        port=args.port,
        host=args.host,
        tts_provider=args.provider,
        tts_queue_size=args.queue_size,
        debug=not args.no_debug
    )

    # Keep running
    ColorPrint.green("\nService running. Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(10)

            # Print stats every 10 seconds
            if instances.heartbeat_system:
                stats = instances.heartbeat_system.get_stats()
                ColorPrint.blue(
                    f"[Stats] Queue: {stats['task_queue']['size']}, "
                    f"Pushed: {stats['heartbeat_pusher']['tasks_pushed']}"
                )
    except KeyboardInterrupt:
        ColorPrint.yellow("\nShutting down...")

    # Cleanup
    from pycore.pylauncher import stop_services
    stop_services(instances)

    ColorPrint.green("Service stopped.")


if __name__ == '__main__':
    main()
