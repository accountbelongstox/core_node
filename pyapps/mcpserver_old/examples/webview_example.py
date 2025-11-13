#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Webview Service Example

Demonstrates how to use the webview service through MCP Server RPC.
"""

import sys
import asyncio
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import RPC client
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient


async def example_create_and_start_launcher():
    """Example: Create and start a webview launcher"""
    print("=" * 70)
    print("Example: Create and Start Webview Launcher")
    print("=" * 70)

    # Create RPC client
    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='webview_example_client'
    )

    try:
        # Connect to MCP server
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Create launcher
        print("\n2. Creating webview launcher...")
        result = await client.call(
            'webview.create_launcher',
            {
                'app_name': 'MyApp',
                'frontend_url': 'http://localhost:3000',
                'window_title': 'My Awesome Application',
                'window_width': 1200,
                'window_height': 800
            }
        )
        print(f"   Result: {result}")

        if result.get('success'):
            launcher_id = result.get('launcher_id')
            print(f"   ✓ Launcher created: {launcher_id}")

            # Start launcher
            print("\n3. Starting launcher...")
            start_result = await client.call(
                'webview.start_launcher',
                {
                    'launcher_id': launcher_id,
                    'open_window': True
                }
            )
            print(f"   Result: {start_result}")

            if start_result.get('success'):
                print("   ✓ Launcher started successfully")
            else:
                print(f"   ✗ Failed to start: {start_result.get('error')}")
        else:
            print(f"   ✗ Failed to create launcher: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        # Disconnect
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_launch_pymatrix():
    """Example: Launch pyMatrix with webview GUI"""
    print("=" * 70)
    print("Example: Launch pyMatrix")
    print("=" * 70)

    # Create RPC client
    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='pymatrix_launcher_client'
    )

    try:
        # Connect to MCP server
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Launch pyMatrix
        print("\n2. Launching pyMatrix...")
        result = await client.call(
            'webview.launch_pymatrix',
            {
                'backend_host': '127.0.0.1',
                'backend_port': 8000,
                'frontend_url': 'http://localhost:3007',
                'bridge_port': 8765
            }
        )
        print(f"   Result: {result}")

        if result.get('success'):
            print("   ✓ pyMatrix launched successfully")
            print(f"   Launcher ID: {result.get('launcher_id')}")
            print(f"   Config: {result.get('config')}")
        else:
            print(f"   ✗ Failed to launch: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        # Disconnect
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_list_launchers():
    """Example: List all active launchers"""
    print("=" * 70)
    print("Example: List Active Launchers")
    print("=" * 70)

    # Create RPC client
    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='list_launchers_client'
    )

    try:
        # Connect to MCP server
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # List launchers
        print("\n2. Listing active launchers...")
        result = await client.call('webview.list_launchers', {})
        print(f"   Result: {result}")

        if result.get('success'):
            launchers = result.get('launchers', [])
            total = result.get('total_launchers', 0)
            active_id = result.get('active_launcher_id')

            print(f"\n   Total launchers: {total}")
            print(f"   Active launcher: {active_id}")

            if launchers:
                print("\n   Launchers:")
                for launcher in launchers:
                    print(f"   - {launcher['launcher_id']}")
                    print(f"     App: {launcher['app_name']}")
                    print(f"     URL: {launcher['frontend_url']}")
                    print(f"     Webview: {'Available' if launcher['webview_available'] else 'Not Available'}")
                    print(f"     Active: {launcher['is_active']}")
                    print()
            else:
                print("   No active launchers")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        # Disconnect
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_reload_webview():
    """Example: Reload webview window"""
    print("=" * 70)
    print("Example: Reload Webview Window")
    print("=" * 70)

    # Create RPC client
    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='reload_webview_client'
    )

    try:
        # Connect to MCP server
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Reload webview
        print("\n2. Reloading active webview...")
        result = await client.call('webview.reload_webview', {})
        print(f"   Result: {result}")

        if result.get('success'):
            print("   ✓ Webview reloaded successfully")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        # Disconnect
        await client.disconnect()
        print("\n✓ Disconnected")


async def example_get_launcher_status():
    """Example: Get launcher status"""
    print("=" * 70)
    print("Example: Get Launcher Status")
    print("=" * 70)

    # Create RPC client
    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='status_client'
    )

    try:
        # Connect to MCP server
        print("\n1. Connecting to MCP Server...")
        await client.connect()
        print("   ✓ Connected")

        # Get status
        print("\n2. Getting launcher status...")
        result = await client.call('webview.get_status', {})
        print(f"   Result: {result}")

        if result.get('success'):
            status = result.get('status', {})
            print("\n   Launcher Status:")
            print(f"   - App Name: {status.get('app_name')}")
            print(f"   - Frontend URL: {status.get('frontend_url')}")
            print(f"   - Window Title: {status.get('window_title')}")
            print(f"   - Webview Available: {status.get('webview_available')}")
            print(f"   - Bridge Running: {status.get('bridge_running')}")
        else:
            print(f"   ✗ Failed: {result.get('error')}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        # Disconnect
        await client.disconnect()
        print("\n✓ Disconnected")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Webview Service Examples')
    parser.add_argument(
        'example',
        choices=[
            'create',
            'pymatrix',
            'list',
            'reload',
            'status',
            'all'
        ],
        help='Example to run'
    )

    args = parser.parse_args()

    if args.example == 'create':
        await example_create_and_start_launcher()
    elif args.example == 'pymatrix':
        await example_launch_pymatrix()
    elif args.example == 'list':
        await example_list_launchers()
    elif args.example == 'reload':
        await example_reload_webview()
    elif args.example == 'status':
        await example_get_launcher_status()
    elif args.example == 'all':
        print("\nRunning all examples...\n")
        await example_create_and_start_launcher()
        print("\n" + "=" * 70 + "\n")
        await asyncio.sleep(2)

        await example_list_launchers()
        print("\n" + "=" * 70 + "\n")
        await asyncio.sleep(2)

        await example_get_launcher_status()
        print("\n" + "=" * 70 + "\n")
        await asyncio.sleep(2)

        await example_reload_webview()
        print("\n" + "=" * 70 + "\n")


if __name__ == '__main__':
    # Note: Make sure MCP Server is running before executing examples
    # Start server with: python mcpserver_main.py

    asyncio.run(main())
