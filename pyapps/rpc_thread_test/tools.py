#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Thread Test - Toolkit

Integrated toolkit for managing RPC test server
"""

import sys
import subprocess
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint


def show_menu():
    """Show main menu"""
    ColorPrint.print_header("RPC Thread Test - Toolkit")

    ColorPrint.blue("\nAvailable Commands:")
    ColorPrint.green("  1. start          - Start RPC server")
    ColorPrint.green("  2. test           - Run test client")
    ColorPrint.green("  3. monitor        - Monitor server status")
    ColorPrint.green("  4. config         - Manage configurations")
    ColorPrint.green("  5. info           - Show server information")
    ColorPrint.green("  6. help           - Show detailed help")
    ColorPrint.green("  0. exit           - Exit toolkit")

    print()


def start_server():
    """Start RPC server"""
    ColorPrint.blue("Starting RPC server...")
    ColorPrint.yellow("Press Ctrl+C to stop the server\n")

    cmd = [sys.executable, "pymain.py", "app=rpc_thread_test"]
    subprocess.run(cmd, cwd=PROJECT_ROOT)


def run_test_client():
    """Run test client"""
    ColorPrint.blue("Running test client...\n")

    cmd = [sys.executable, "-m", "pyapps.rpc_thread_test.test_client"]
    subprocess.run(cmd, cwd=PROJECT_ROOT)


def monitor_server():
    """Monitor server"""
    ColorPrint.blue("Starting server monitor...\n")

    cmd = [sys.executable, "-m", "pyapps.rpc_thread_test.monitor"]
    subprocess.run(cmd, cwd=PROJECT_ROOT)


def manage_config():
    """Manage configurations"""
    ColorPrint.blue("Configuration Manager\n")

    cmd = [sys.executable, "pyapps/rpc_thread_test/switch_config.py"]
    subprocess.run(cmd, cwd=PROJECT_ROOT)


def show_info():
    """Show server information"""
    ColorPrint.print_header("RPC Thread Test - Information")

    ColorPrint.blue("\nServer Configuration:")
    ColorPrint.green("  Default Host: localhost")
    ColorPrint.green("  Default Port: 8765")
    ColorPrint.green("  WebSocket URL: ws://localhost:8765")

    ColorPrint.blue("\nAvailable API Routes:")
    routes = [
        ("echo", "Echo back a message"),
        ("add", "Add two numbers"),
        ("multiply", "Multiply two numbers"),
        ("get_info", "Get server information"),
        ("list_apis", "List all available APIs"),
        ("health_check", "Health check endpoint"),
        ("calculate", "Perform dynamic calculations")
    ]

    for route, description in routes:
        ColorPrint.green(f"  - {route:<15} : {description}")

    ColorPrint.blue("\nConfiguration Files:")
    config_dir = Path(__file__).parent / "config"
    for config_file in config_dir.glob("*.json"):
        ColorPrint.green(f"  - {config_file.name}")

    ColorPrint.blue("\nDocumentation:")
    ColorPrint.green("  - README.md        : Complete documentation")
    ColorPrint.green("  - USAGE_GUIDE.md   : Usage guide")

    print()


def show_help():
    """Show detailed help"""
    ColorPrint.print_header("RPC Thread Test - Help")

    ColorPrint.blue("\n1. Start Server:")
    ColorPrint.yellow("  python tools.py start")
    ColorPrint.yellow("  or")
    ColorPrint.yellow("  python pymain.py app=rpc_thread_test")

    ColorPrint.blue("\n2. Run Test Client:")
    ColorPrint.yellow("  python tools.py test")
    ColorPrint.yellow("  or")
    ColorPrint.yellow("  python -m pyapps.rpc_thread_test.test_client")

    ColorPrint.blue("\n3. Monitor Server:")
    ColorPrint.yellow("  python tools.py monitor")
    ColorPrint.yellow("  or")
    ColorPrint.yellow("  python -m pyapps.rpc_thread_test.monitor")

    ColorPrint.blue("\n4. Manage Configurations:")
    ColorPrint.yellow("  python tools.py config")
    ColorPrint.yellow("  or")
    ColorPrint.yellow("  python switch_config.py list")
    ColorPrint.yellow("  python switch_config.py switch <name>")

    ColorPrint.blue("\n5. Quick Start Scripts (Windows):")
    ColorPrint.yellow("  start_server.bat   - Start server")
    ColorPrint.yellow("  start_client.bat   - Start test client")

    ColorPrint.blue("\n6. Configuration Files:")
    ColorPrint.yellow("  config/launcher_config.json           - Default config")
    ColorPrint.yellow("  config/launcher_config_auto_port.json - Auto port config")

    ColorPrint.blue("\n7. API Testing:")
    ColorPrint.yellow("  Use test_client.py to test all routes")
    ColorPrint.yellow("  Or use monitor.py for real-time monitoring")

    print()


def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        # Command line mode
        command = sys.argv[1].lower()

        commands = {
            'start': start_server,
            'test': run_test_client,
            'monitor': monitor_server,
            'config': manage_config,
            'info': show_info,
            'help': show_help
        }

        if command in commands:
            commands[command]()
        else:
            ColorPrint.red(f"Unknown command: {command}")
            show_help()

    else:
        # Interactive mode
        while True:
            show_menu()

            try:
                choice = input("Select command (0-6): ").strip()

                if choice == '0':
                    ColorPrint.green("Goodbye!")
                    break
                elif choice == '1':
                    start_server()
                elif choice == '2':
                    run_test_client()
                elif choice == '3':
                    monitor_server()
                elif choice == '4':
                    manage_config()
                elif choice == '5':
                    show_info()
                elif choice == '6':
                    show_help()
                else:
                    ColorPrint.yellow("Invalid choice. Please try again.")

                print()

            except KeyboardInterrupt:
                print()
                ColorPrint.yellow("\nInterrupted")
                break
            except Exception as e:
                ColorPrint.red(f"Error: {e}")
                print()


if __name__ == "__main__":
    main()
