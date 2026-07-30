#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Controller - Unified System Controller

Routes to appropriate manager based on SYSTEM_MODE:
- MONITOR: MonitorManager (price monitoring + web interface)
- TRADING_TEST: TradingSystemManager (backtest from 3 days ago)
- TRADING_LIVE: TradingSystemManager (live trading with virtual money)
"""

import sys
from typing import Optional
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from pyapps.okx_price_monitor.core.okx_config import okx_config
from pycore.pyfoundations.pygvar import RPC_CONTROLLER_PREFIX


class OKXController:
    """
    Unified OKX System Controller

    Routes execution to appropriate manager based on system mode.
    """

    def __init__(self):
        """Initialize controller"""
        self.mode = okx_config.SYSTEM_MODE
        self.manager = None
        self.running = False

        print("\n" + "="*80)
        print("OKX UNIFIED SYSTEM")
        print("="*80)
        print(f"System Mode: {self.mode}")
        print(f"Description: {okx_config.get_description()}")
        print("="*80 + "\n")

    def initialize(self) -> bool:
        """
        Initialize appropriate manager based on mode

        Returns:
            bool: True if successful
        """
        if self.mode == 'MONITOR':
            return self._initialize_monitor_mode()
        elif self.mode in ('TRADING_TEST', 'TRADING_LIVE'):
            return self._initialize_trading_mode()
        else:
            print(f"[ERROR] Unknown system mode: {self.mode}")
            return False

    def _initialize_monitor_mode(self) -> bool:
        """Initialize monitoring system"""
        from pyapps.okx_price_monitor.services.monitor_manager import get_monitor_manager
        from pyapps.okx_price_monitor.core.monitor_config import monitor_config

        print("[MONITOR MODE] Initializing price monitoring system...")
        print(f"[MONITOR MODE] Startup mode: {okx_config.MONITOR_STARTUP_MODE}")
        print()

        # Update monitor config startup mode
        monitor_config.STARTUP_MODE = okx_config.MONITOR_STARTUP_MODE

        # Create monitor manager
        self.manager = get_monitor_manager()

        print("[MONITOR MODE] Initializing all coins...")
        init_results = self.manager.initialize_all_coins()

        print("\n[MONITOR MODE] Initialization complete")
        print(f"  Total Coins: {init_results['total_coins']}")
        print(f"  Trackers Initialized: {init_results['trackers_initialized']}")
        print()

        return True

    def _initialize_trading_mode(self) -> bool:
        """Initialize trading system"""
        from pyapps.okx_price_monitor.controllers.trading_controller import TradingController
        from pyapps.okx_price_monitor.core.strategy_config import strategy_config

        # Set RUN_MODE based on SYSTEM_MODE
        if self.mode == 'TRADING_TEST':
            strategy_config.RUN_MODE = 'TEST'
        else:
            strategy_config.RUN_MODE = 'LIVE'

        print(f"[TRADING MODE] Initializing trading system...")
        print(f"[TRADING MODE] Run mode: {strategy_config.RUN_MODE}")
        print()

        # Create trading controller
        import sys
        self.manager = TradingController()
        print("[OKX Controller] TradingController created successfully")
        sys.stdout.flush()

        # Initialize historical data (SQLite -> Redis)
        print("[TRADING MODE] Loading historical data...")
        sys.stdout.flush()
        self.manager.initialize_historical_data()
        print("[TRADING MODE] Historical data loaded")
        sys.stdout.flush()

        print("\n[TRADING MODE] Initialization complete")
        sys.stdout.flush()
        print()
        sys.stdout.flush()

        return True

    def start(self) -> bool:
        """
        Start the system

        Returns:
            bool: True if successful
        """
        if not self.manager:
            print("[ERROR] Manager not initialized. Call initialize() first.")
            return False

        if self.mode == 'MONITOR':
            return self._start_monitor_mode()
        elif self.mode in ('TRADING_TEST', 'TRADING_LIVE'):
            return self._start_trading_mode()
        else:
            print(f"[ERROR] Unknown system mode: {self.mode}")
            return False

    def _start_monitor_mode(self) -> bool:
        """Start monitoring mode"""
        from pyapps.okx_price_monitor.core.monitor_config import monitor_config

        startup_mode = okx_config.MONITOR_STARTUP_MODE

        if startup_mode == 'web':
            return self._start_web_server()
        elif startup_mode == 'console':
            return self._start_console_monitor()
        elif startup_mode == 'fetch':
            print("[MONITOR MODE] Fetch mode - historical data loaded, exiting")
            return True
        elif startup_mode == 'init':
            print("[MONITOR MODE] Init mode - system initialized, exiting")
            return True
        else:
            print(f"[ERROR] Unknown startup mode: {startup_mode}")
            return False

    def _start_web_server(self) -> bool:
        """Start web server for monitoring"""
        from pyapps.okx_price_monitor.core.monitor_config import monitor_config
        from pycore.pyutils.rpc_v2.server import RpcServer
        from pyapps.okx_price_monitor.api import register_monitor_routes
        from fastapi.responses import FileResponse
        from fastapi.staticfiles import StaticFiles
        import uvicorn

        # Start background monitoring
        print("[WEB MODE] Starting background monitoring...")
        self.manager.start_monitoring()
        print("[WEB MODE] Background monitoring started\n")

        # Create RPC server
        server = RpcServer(
            options={
                "host": monitor_config.WEB_HOST,
                "port": monitor_config.WEB_PORT,
                "debug": monitor_config.DEBUG_MODE
            }
        )

        # Register API routes
        register_monitor_routes(server)

        # Setup static files
        web_dir = Path(__file__).parent.parent / "web"
        if web_dir.exists():
            server.app.mount("/css", StaticFiles(directory=str(web_dir / "css")), name="css")
            server.app.mount("/js", StaticFiles(directory=str(web_dir / "js")), name="js")

            index_html = web_dir / "index.html"

            @server.app.get("/")
            async def serve_index():
                return FileResponse(str(index_html))

            @server.app.get("/index.html")
            async def serve_index_html():
                return FileResponse(str(index_html))

        # Print access information
        print("="*80)
        print("WEB SERVER STARTING")
        print("="*80)
        print(f"\nWeb Interface:")
        print(f"  http://localhost:{monitor_config.WEB_PORT}")
        print(f"\nAPI Endpoint:")
        print(f"  http://localhost:{monitor_config.WEB_PORT}{RPC_CONTROLLER_PREFIX}/<name>")
        print("\nPress Ctrl+C to stop")
        print("="*80 + "\n")

        # Start server
        try:
            uvicorn.run(
                server.app,
                host=monitor_config.WEB_HOST,
                port=monitor_config.WEB_PORT,
                log_level="debug" if monitor_config.DEBUG_MODE else "info"
            )
        except KeyboardInterrupt:
            print("\n\n[WEB MODE] Shutting down...")
            self.manager.stop_monitoring()
            print("[WEB MODE] Server stopped")

        return True

    def _start_console_monitor(self) -> bool:
        """Start console monitoring"""
        import time
        from pyapps.okx_price_monitor.core.monitor_config import monitor_config

        print("\n" + "="*80)
        print("CONSOLE MONITORING MODE")
        print("="*80)
        print(f"Update interval: {monitor_config.UPDATE_INTERVAL_MS}ms")
        print("Press Ctrl+C to stop")
        print("="*80 + "\n")

        self.manager.start_monitoring()
        self.running = True

        interval_seconds = monitor_config.UPDATE_INTERVAL_MS / 1000.0

        try:
            while self.running:
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\n\n[CONSOLE MODE] Interrupted by user")
            self.stop()

        return True

    def _start_trading_mode(self) -> bool:
        """Start trading mode"""
        # Start worker threads (Redis-only operations)
        self.manager.start_workers()

        # Run trading system
        self.manager.run(duration_minutes=None)

        return True

    def stop(self):
        """Stop the system"""
        if not self.manager:
            return

        self.running = False

        if self.mode == 'MONITOR':
            self.manager.stop_monitoring()
            print("\n[MONITOR MODE] Stopped")
        elif self.mode in ('TRADING_TEST', 'TRADING_LIVE'):
            self.manager.stop_workers()
            print("\n[TRADING MODE] Stopped")


# Global controller instance
_global_controller = None


def get_okx_controller() -> OKXController:
    """
    Get global OKX controller instance

    Returns:
        OKXController: Global instance
    """
    global _global_controller

    if _global_controller is None:
        _global_controller = OKXController()

    return _global_controller
