#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Example: Using Nuxt Dev Server and Vue Static Server Auto-start

This example demonstrates the new auto-start features for:
1. Nuxt development servers
2. Vue distribution static file servers

The ServerManager will automatically:
- Detect available ports
- Start the appropriate server
- Wait for it to be ready
- Clean up on application exit
"""

from pycore.pyutils.native_ui import (
    NativeUIConfig,
    launch_native_app,
    get_server_manager
)

import tempfile
from pathlib import Path
import time



def example_nuxt_dev_server():
    """
    Example 1: Nuxt Development Server Auto-start

    The ServerManager will:
    1. Locate the Nuxt app in poly_apps/nuxt_main/apps/
    2. Find an available port (starting from 3000)
    3. Run 'npm run dev' with the allocated port
    4. Wait for the server to be ready (max 60 seconds)
    5. Return the server URL
    """
    def main_entry():
        print("Main application started")
        print("Nuxt dev server will be auto-started...")

    config = NativeUIConfig(
        app_id="nuxt_example",
        app_name="Nuxt Auto-start Example",
        main_entry=main_entry,

        # Option 1: Use app name (auto-detects as nuxt_app)
        url="app_pymatrix",  # Will look for poly_apps/nuxt_main/apps/app_pymatrix

        # Option 2: Explicitly set type
        # url="app_pymatrix",
        # url_type="nuxt_app",

        debug=True,  # Enable detailed logging
        enable_tray=False  # Disable tray for this example
    )

    print("=" * 70)
    print("EXAMPLE 1: Nuxt Dev Server Auto-start")
    print("=" * 70)
    launch_native_app(config)


def example_vue_static_server():
    """
    Example 2: Vue Distribution Static Server Auto-start

    The ServerManager will:
    1. Verify the dist directory exists
    2. Find an available port (starting from 8000)
    3. Run 'python -m http.server <port>' in the dist directory
    4. Wait for the server to be ready (max 10 seconds)
    5. Return the server URL
    """

    # Create a temporary dist directory for demonstration
    temp_dist = Path(tempfile.mkdtemp())
    (temp_dist / "index.html").write_text("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Vue Static Server Example</title>
    </head>
    <body>
        <h1>Vue Static Server is Running!</h1>
        <p>This page is served by Python's http.server module.</p>
    </body>
    </html>
    """)

    def main_entry():
        print("Main application started")
        print(f"Vue static server will serve from: {temp_dist}")

    config = NativeUIConfig(
        app_id="vue_example",
        app_name="Vue Static Server Example",
        main_entry=main_entry,

        # Provide path to Vue dist directory
        url=str(temp_dist),
        url_type="vue_dist",  # Explicitly set type

        debug=True,
        enable_tray=False
    )

    print("=" * 70)
    print("EXAMPLE 2: Vue Static Server Auto-start")
    print("=" * 70)
    print(f"Temporary dist directory: {temp_dist}")
    launch_native_app(config)


def example_server_manager_api():
    """
    Example 3: Using ServerManager API directly

    This demonstrates how to use the ServerManager programmatically
    for more control over server lifecycle.
    """

    server_mgr = get_server_manager()

    print("=" * 70)
    print("EXAMPLE 3: ServerManager API")
    print("=" * 70)

    # Check port availability
    print("\n1. Checking port availability:")
    for port in [3000, 8000, 8080]:
        available = server_mgr.is_port_available(port)
        status = "Available" if available else "In use"
        print(f"   Port {port}: {status}")

    # Find available port
    print("\n2. Finding available port:")
    port = server_mgr.find_available_port(start_port=8000)
    print(f"   Found available port: {port}")

    # List running servers
    print("\n3. Listing managed servers:")
    servers = server_mgr.list_servers()
    if servers:
        for server in servers:
            print(f"   - {server.name}: {server.url} (port {server.port}, type: {server.type})")
    else:
        print("   No servers currently running")

    # Manual server start (if you have a Nuxt app)
    # print("\n4. Starting Nuxt dev server manually:")
    # project_root = Path(__file__).parent.parent.parent.parent.parent
    # server_process = server_mgr.start_nuxt_dev_server(
    #     app_name="app_pymatrix",
    #     project_root=project_root,
    #     port=3000
    # )
    # if server_process:
    #     print(f"   Server started: {server_process.url}")
    #     time.sleep(2)
    #     server_mgr.stop_server(server_process.name)
    #     print(f"   Server stopped: {server_process.name}")


def example_fallback_behavior():
    """
    Example 4: Fallback Behavior

    Demonstrates what happens when server startup fails:
    - Nuxt: Falls back to http://localhost:3000
    - Vue: Falls back to file:// protocol
    """
    def main_entry():
        print("Main application started")

    # Try to start a non-existent Nuxt app
    config = NativeUIConfig(
        app_id="fallback_example",
        app_name="Fallback Behavior Example",
        main_entry=main_entry,
        url="app_nonexistent",  # This app doesn't exist
        url_type="nuxt_app",
        debug=True,
        enable_tray=False
    )

    print("=" * 70)
    print("EXAMPLE 4: Fallback Behavior (Nuxt)")
    print("=" * 70)
    print("Attempting to start non-existent Nuxt app...")
    print("Expected: Fallback to http://localhost:3000")
    print()

    # NOTE: This will print warnings and use fallback URL
    # launch_native_app(config)


if __name__ == "__main__":
    import sys

    examples = {
        "1": ("Nuxt Dev Server Auto-start", example_nuxt_dev_server),
        "2": ("Vue Static Server Auto-start", example_vue_static_server),
        "3": ("ServerManager API", example_server_manager_api),
        "4": ("Fallback Behavior", example_fallback_behavior),
    }

    if len(sys.argv) > 1:
        choice = sys.argv[1]
        if choice in examples:
            name, func = examples[choice]
            print(f"\nRunning: {name}\n")
            func()
        else:
            print(f"Unknown example: {choice}")
            print("Available examples:", ", ".join(examples.keys()))
    else:
        # Show menu
        print("\n" + "=" * 70)
        print("Native UI Server Auto-start Examples")
        print("=" * 70)
        print("\nAvailable examples:")
        for key, (name, _) in examples.items():
            print(f"  {key}. {name}")
        print("\nUsage:")
        print(f"  python {sys.argv[0]} <example_number>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} 1")
        print()

        # Run Example 3 (ServerManager API) by default
        print("Running Example 3 by default...\n")
        example_server_manager_api()
