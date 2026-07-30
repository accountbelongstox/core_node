# -*- coding: utf-8 -*-
"""
Pycore Module Caller - Main Entry Point

Run as module:
    python -m pycore.callmodule                    # Platform-aware mode
    python -m pycore.callmodule --tray             # Force Windows tray mode
    python -m pycore.callmodule --service          # Force service mode (no tray)
    python -m pycore.callmodule --host 0.0.0.0 --port 8000 --debug
"""

import argparse
import sys
from pathlib import Path

from pycore.pylauncher.platform.windows_startup_manager import launch_windows_tray
from pycore.pycore_module_caller import main as launch_service



PYCORE_ROOT = Path(__file__).parent.parent
PROJECT_ROOT = PYCORE_ROOT.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.system_paths import apply_shared_cache_env

apply_shared_cache_env()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Pycore Module Caller FastAPI Service")
    parser.add_argument(
        '--host',
        default='0.0.0.0',
        help='Host to bind to (default: 0.0.0.0 for all interfaces, use 127.0.0.1 for local only)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=59000,
        help='Port to bind to (default: 59000)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug mode'
    )
    parser.add_argument(
        '--tray',
        action='store_true',
        help='Force Windows tray mode (with singleton detection)'
    )
    parser.add_argument(
        '--service',
        action='store_true',
        help='Force service mode (no tray, no singleton)'
    )
    parser.add_argument(
        '--reload',
        action='store_true',
        help='Enable auto-reload (development mode, service mode only)'
    )

    args = parser.parse_args()

    if args.tray:
        launch_windows_tray(host=args.host, port=args.port, debug=args.debug)
        return

    launch_service(
        host=args.host,
        port=args.port,
        debug=args.debug,
        reload=args.reload,
    )


if __name__ == '__main__':
    main()
