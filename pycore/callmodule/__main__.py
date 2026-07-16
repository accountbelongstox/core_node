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

from pycore.callmodule.platform.windows_tray import launch_windows_tray
from pycore.callmodule.global_config import init_global_config
from pycore.pyfoundations.third_party import get_third_package_uvicorn

from pycore.callmodule.platform import launch_platform_aware



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

    # Force specific mode if requested
    if args.tray:
        launch_windows_tray(host=args.host, port=args.port, debug=args.debug)
        return

    if args.service or args.reload:
        # Service mode or reload mode

        init_global_config(
            pycore_root=str(PYCORE_ROOT),
            http_port=args.port,
            host=args.host,
            debug=args.debug
        )

        uvicorn = get_third_package_uvicorn()
        uvicorn.run(
            "pycore.callmodule.app:create_app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            factory=True,
            log_level="debug" if args.debug else "info"
        )
        return

    # Platform-aware mode (default). The platform launcher (PySide6 tray/UI) is
    # optional - when it is unavailable (headless host, missing dep, or the
    # launcher module was removed) fall back to the same service-mode app path
    # used by --service (create_app via uvicorn). No hot-reload in fallback.
    try:
        launch_platform_aware(host=args.host, port=args.port, debug=args.debug)
        return
    except Exception as exc:  # noqa: BLE001 - launcher optional; fall back to service mode
        print(
            f"[callmodule] platform launcher unavailable ({exc}); "
            "starting service mode (no tray) instead."
        )


    init_global_config(
        pycore_root=str(PYCORE_ROOT),
        http_port=args.port,
        host=args.host,
        debug=args.debug
    )

    uvicorn = get_third_package_uvicorn()
    uvicorn.run(
        "pycore.callmodule.app:create_app",
        host=args.host,
        port=args.port,
        reload=False,
        factory=True,
        log_level="debug" if args.debug else "info"
    )


if __name__ == '__main__':
    main()
