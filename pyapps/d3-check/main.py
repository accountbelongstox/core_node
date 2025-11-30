#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check - Diablo III Bot Auto Control System
Main entry point for the application

Usage:
    python main.py              # Start UI mode
    python main.py --train      # Start training mode
    python main.py --help       # Show help
"""

import sys
import os
import argparse
import signal
import time
import traceback

# Add project root to path for imports
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Import application modules
from controller.http_bridge_controller import HTTPBridgeController
from d3utils.system_initializer import get_system_initializer
from d3utils.shutdown_manager import is_shutdown_requested, execute_shutdown
from d3utils.i18n_manager import i18n_manager
from providor.common_imports import ColorPrint, UniversalGUILauncher, set_menu_labels


def main():
    """Main application entry point"""

    parser = argparse.ArgumentParser(
        description="D3Check - Diablo III Bot Auto Control System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                      # Start UI mode (default)
  python main.py --train              # Train YOLO model
  python main.py --train --help       # Show training options
"""
    )

    # Mode selection
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--train", action="store_true",
                            help="Run in training mode")
    mode_group.add_argument("--validate", action="store_true",
                            help="Validate trained model")
    mode_group.add_argument("--export", action="store_true",
                            help="Export trained model")
    mode_group.add_argument("--bridge", action="store_true",
                            help="Run HTTP bridge mode (for web GUI)")

    # Bridge mode options
    parser.add_argument("--host", default="127.0.0.1",
                        help="HTTP bridge host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765,
                        help="HTTP bridge port number (default: 8765)")

    # Parse only known args to avoid conflicts with training args
    args, unknown = parser.parse_known_args()

    # Route to appropriate mode
    if args.bridge:
        # HTTP Bridge mode - for web-based GUI
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("D3Check - HTTP Bridge Mode (Web GUI)")
        ColorPrint.blue("=" * 80)

        try:
            # Get system initializer
            sys_init = get_system_initializer()

            # Initialize the system
            if not sys_init.initialize_system():
                ColorPrint.red("[MAIN] System initialization failed, exiting...")
                return 1

            # Create HTTP bridge controller
            bridge_controller = HTTPBridgeController(host=args.host, port=args.port)

            # Start bridge server
            ColorPrint.green(f"[MAIN] Starting HTTP bridge on http://{args.host}:{args.port}")
            bridge_controller.start()

            ColorPrint.green("[MAIN] HTTP bridge started. Press Ctrl+C to stop.")

            # Keep running until interrupted
            def signal_handler(sig, frame):
                ColorPrint.yellow("\n[MAIN] Shutdown signal received...")
                bridge_controller.stop()
                sys.exit(0)

            signal.signal(signal.SIGINT, signal_handler)

            # Keep main thread alive
            while bridge_controller.is_running():
                time.sleep(1)

            return 0

        except KeyboardInterrupt:
            ColorPrint.yellow("\n[MAIN] Keyboard interrupt received, shutting down...")
            if 'bridge_controller' in locals():
                bridge_controller.stop()
            return 0

        except Exception as e:
            ColorPrint.red(f"[ERROR] Fatal error in HTTP bridge mode: {e}")
            traceback.print_exc()
            return 1

    elif args.train or args.validate or args.export:
        # Training/validation/export mode - delegate to train module
        from train import main as train_main
        # Reconstruct argv for train module
        sys.argv = [sys.argv[0]] + unknown
        if args.validate:
            sys.argv.insert(1, "--action=validate")
        elif args.export:
            sys.argv.insert(1, "--action=export")
        else:
            sys.argv.insert(1, "--action=train")
        return train_main()
    else:
        # Default: Universal GUI mode (Tray + HTTP Bridge + optional web frontend)
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("D3Check - Universal GUI Mode")
        ColorPrint.blue("=" * 80)

        try:
            # Get system initializer
            sys_init = get_system_initializer()

            # Initialize the system
            if not sys_init.initialize_system():
                ColorPrint.red("[MAIN] System initialization failed, exiting...")
                return 1

            # Load i18n settings
            i18n_manager.load_language_from_config()

            # Set menu labels for i18n support
            menu_labels = {
                'open_web': i18n_manager.get_ui_text("gui_menu.open_web", "Open Web UI"),
                'restart': i18n_manager.get_ui_text("gui_menu.restart", "Restart"),
                'exit': i18n_manager.get_ui_text("gui_menu.exit", "Exit")
            }
            set_menu_labels(menu_labels)

            # Create HTTP bridge controller
            bridge_controller = HTTPBridgeController(host='127.0.0.1', port=8765)

            # Create custom menu items with callbacks
            menu_items = [
                {
                    'key': 'open_web',
                    'label': menu_labels['open_web'],
                    'callback': lambda: None  # Will use default _open_web_ui
                },
                {
                    'key': 'restart',
                    'label': menu_labels['restart'],
                    'callback': lambda: None  # Will use default _restart_application
                },
                {
                    'key': 'exit',
                    'label': menu_labels['exit'],
                    'callback': lambda: None  # Will use default _exit_application
                }
            ]

            # Create universal GUI launcher
            gui_launcher = UniversalGUILauncher(
                app_name='D3Check',
                bridge_host='127.0.0.1',
                bridge_port=8765,
                menu_items=menu_items
            )

            # Register bridge handlers via bridge controller
            # Bridge controller already registers handlers in __init__

            # Start GUI launcher (tray + bridge)
            ColorPrint.green("[MAIN] Starting universal GUI launcher...")
            gui_launcher.start()

            ColorPrint.green("[MAIN] D3Check started successfully")
            ColorPrint.green("[MAIN] Access web UI at: http://127.0.0.1:8765")
            ColorPrint.green("[MAIN] Press Ctrl+C to stop")

            # Run forever (blocks until interrupted)
            gui_launcher.run_forever()

            return 0

        except KeyboardInterrupt:
            ColorPrint.yellow("\n[MAIN] Keyboard interrupt received, shutting down...")
            if 'gui_launcher' in locals():
                gui_launcher.stop()
            return 0

        except Exception as e:
            ColorPrint.red(f"[ERROR] Fatal error in main: {e}")
            traceback.print_exc()
            return 1


if __name__ == "__main__":
    sys.exit(main())

