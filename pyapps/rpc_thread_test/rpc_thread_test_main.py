#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Thread Test - Main Entry Point

Demonstrates:
1. Loading configuration from JSON file
2. Starting RPC as an independent thread using WsRpcServerThread
3. Dynamic port allocation
4. Controller-based route registration
"""

import sys
import time
import json
import socket
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.wsrpc.threads import WsRpcServerThread
from pyapps.rpc_thread_test.controllers import TestController


def load_config():
    """Load configuration from JSON file"""
    config_path = Path(__file__).parent / "config" / "launcher_config.json"

    ColorPrint.blue(f"Loading configuration from: {config_path}")

    if not config_path.exists():
        ColorPrint.red(f"Configuration file not found: {config_path}")
        ColorPrint.yellow("Using default configuration...")
        return {
            'rpc_server': {
                'host': 'localhost',
                'port': 8765,
                'debug': True,
                'thread_name': 'RpcServerThread',
                'daemon': True
            },
            'app': {
                'name': 'RPC Thread Test',
                'version': '1.0.0',
                'enable_auto_port': False,
                'port_range': [8765, 8775]
            }
        }

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    ColorPrint.green("Configuration loaded successfully")
    return config


def find_available_port(start_port, end_port):
    """
    Find an available port in the given range

    Args:
        start_port: Start of port range
        end_port: End of port range (inclusive)

    Returns:
        Available port number or None
    """
    for port in range(start_port, end_port + 1):
        try:
            # Try to bind to the port
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind(('localhost', port))
            sock.close()
            ColorPrint.green(f"Found available port: {port}")
            return port
        except OSError:
            ColorPrint.yellow(f"Port {port} is in use, trying next...")
            continue

    return None


def apply_config_overrides(config):
    """
    Apply configuration overrides

    Handles:
    - Dynamic port allocation
    - Environment-based configuration
    - Runtime parameter adjustments

    Args:
        config: Configuration dict

    Returns:
        Modified configuration dict
    """
    ColorPrint.blue("Applying configuration overrides...")

    rpc_config = config.get('rpc_server', {})
    app_config = config.get('app', {})

    # Check if auto port is enabled
    if app_config.get('enable_auto_port', False):
        ColorPrint.yellow("Auto port allocation enabled")

        port_range = app_config.get('port_range', [8765, 8775])
        available_port = find_available_port(port_range[0], port_range[1])

        if available_port:
            ColorPrint.green(f"Using dynamic port: {available_port}")
            rpc_config['port'] = available_port
        else:
            ColorPrint.red(f"No available ports in range {port_range}")
            ColorPrint.yellow(f"Falling back to default port: {rpc_config.get('port', 8765)}")

    # Display final configuration
    ColorPrint.blue("\nFinal RPC Server Configuration:")
    ColorPrint.green(f"  Host: {rpc_config.get('host', 'localhost')}")
    ColorPrint.green(f"  Port: {rpc_config.get('port', 8765)}")
    ColorPrint.green(f"  Debug: {rpc_config.get('debug', False)}")
    ColorPrint.green(f"  Thread Name: {rpc_config.get('thread_name', 'RpcServerThread')}")
    ColorPrint.green(f"  Daemon Mode: {rpc_config.get('daemon', True)}")

    return config


def main():
    """Main entry point"""
    ColorPrint.green("=" * 60)
    ColorPrint.green(" RPC Thread Test - Starting")
    ColorPrint.green("=" * 60)

    try:
        # Step 1: Load configuration
        ColorPrint.blue("\n[Step 1] Loading configuration...")
        config = load_config()

        # Step 2: Apply configuration overrides
        ColorPrint.blue("\n[Step 2] Applying configuration overrides...")
        config = apply_config_overrides(config)

        # Step 3: Create RPC server thread
        ColorPrint.blue("\n[Step 3] Creating RPC server thread...")

        rpc_config = config['rpc_server']

        server = WsRpcServerThread(
            host=rpc_config.get('host', 'localhost'),
            port=rpc_config.get('port', 8765),
            debug=rpc_config.get('debug', True),
            thread_name=rpc_config.get('thread_name', 'RpcServerThread'),
            daemon=rpc_config.get('daemon', True)
        )

        ColorPrint.green("RPC server thread created")

        # Step 4: Register routes via controller
        ColorPrint.blue("\n[Step 4] Registering routes via controller...")

        controller = TestController(config=rpc_config)
        controller.register_routes(server)

        ColorPrint.green("Routes registered successfully")

        # Step 5: Start RPC server thread
        ColorPrint.blue("\n[Step 5] Starting RPC server thread...")
        server.start()

        # Wait for server to be ready
        time.sleep(1)

        if server.is_running():
            ColorPrint.green("✓ RPC server is running")
        else:
            ColorPrint.red("✗ RPC server failed to start")
            return

        # Display server information
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue(" Server Information")
        ColorPrint.blue("=" * 60)

        ColorPrint.green(f"\nWebSocket URL: ws://{rpc_config['host']}:{rpc_config['port']}")
        ColorPrint.green(f"Server Name: {config['app']['name']}")
        ColorPrint.green(f"Version: {config['app']['version']}")

        ColorPrint.blue("\nAvailable APIs:")
        ColorPrint.green("  - echo          : Echo back a message")
        ColorPrint.green("  - add           : Add two numbers")
        ColorPrint.green("  - multiply      : Multiply two numbers")
        ColorPrint.green("  - get_info      : Get server information")
        ColorPrint.green("  - list_apis     : List all available APIs")
        ColorPrint.green("  - health_check  : Health check endpoint")
        ColorPrint.green("  - calculate     : Perform dynamic calculations")

        ColorPrint.blue("\n" + "=" * 60)

        # Test client command
        ColorPrint.yellow("\nTo test the server, run:")
        ColorPrint.yellow("  python -m pyapps.rpc_thread_test.test_client")

        ColorPrint.blue("\nPress Ctrl+C to stop the server...\n")

        # Keep running
        try:
            while server.is_running():
                time.sleep(1)
        except KeyboardInterrupt:
            ColorPrint.yellow("\nShutdown requested...")

    except Exception as e:
        ColorPrint.red(f"Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        ColorPrint.blue("\nStopping RPC server...")
        if 'server' in locals() and server:
            server.stop()
        ColorPrint.green("RPC server stopped")

        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" RPC Thread Test - Stopped")
        ColorPrint.green("=" * 60)


if __name__ == "__main__":
    main()
