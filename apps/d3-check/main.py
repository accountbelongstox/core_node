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

# Add project root to path for imports
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)


def main():
    """Main application entry point"""
    import argparse

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

    # Parse only known args to avoid conflicts with training args
    args, unknown = parser.parse_known_args()

    # Route to appropriate mode
    if args.train or args.validate or args.export:
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
        # Default: UI mode
        from controller.d3_macro_controller import D3MacroController
        from d3utils.system_initializer import get_system_initializer
        from d3utils.shutdown_manager import is_shutdown_requested, execute_shutdown
        from providor.common_imports import ColorPrint

        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("🎮 D3Check - UI Mode")
        ColorPrint.blue("=" * 80)

        try:
            # Get system initializer
            sys_init = get_system_initializer()

            # Initialize the system
            if not sys_init.initialize_system():
                ColorPrint.red("[MAIN] System initialization failed, exiting...")
                return 1

            # Create controller
            controller = D3MacroController()

            # Run controller (this will create UI and store in ENCYCLOPEDIA, then run UI mainloop - BLOCKING)
            ColorPrint.green("[MAIN] Starting application...")
            controller.run()

            # When UI mainloop exits, check if shutdown was requested
            if is_shutdown_requested():
                ColorPrint.yellow("[MAIN] Shutdown requested, executing shutdown sequence...")
                execute_shutdown()
            else:
                ColorPrint.blue("[MAIN] UI closed normally, exiting...")

            return 0

        except KeyboardInterrupt:
            ColorPrint.yellow("\n[MAIN] Keyboard interrupt received, executing shutdown...")
            execute_shutdown()
            return 0

        except Exception as e:
            ColorPrint.red(f"[ERROR] Fatal error in main: {e}")
            import traceback
            traceback.print_exc()
            return 1


if __name__ == "__main__":
    sys.exit(main())

