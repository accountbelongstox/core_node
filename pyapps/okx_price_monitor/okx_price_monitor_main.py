#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX System - Unified Main Entry Point

Single entry point for all OKX modes:
- MONITOR: Price monitoring with web interface
- TRADING_TEST: Backtest from 3 days ago with virtual money
- TRADING_LIVE: Live trading with virtual money (paper trading)

Mode configured in core/okx_config.py (SYSTEM_MODE)

Usage:
  python pymain.py app=okx_price_monitor
  python pymain.py app=okx
  python okx_price_monitor_main.py  # Direct run
"""

import sys
import signal
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from pyapps.okx_price_monitor.core.okx_controller import get_okx_controller
from pyapps.okx_price_monitor.core.okx_config import okx_config


# Global controller instance
controller_instance = None


def signal_handler(sig, frame):
    """Handle Ctrl+C signal"""
    global controller_instance

    if controller_instance:
        controller_instance.stop()

    sys.exit(0)


def start():
    """
    Start OKX system

    Unified entry point that routes to appropriate mode based on configuration.
    """
    global controller_instance

    # Print startup banner
    print("\n" + "="*80)
    print("OKX UNIFIED SYSTEM - STARTING")
    print("="*80)
    print(f"System Mode: {okx_config.SYSTEM_MODE}")
    print(f"Description: {okx_config.get_description()}")
    print("="*80 + "\n")

    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Get controller
    controller_instance = get_okx_controller()

    # Initialize
    if not controller_instance.initialize():
        print("\n[ERROR] Initialization failed")
        sys.exit(1)

    # Start
    if not controller_instance.start():
        print("\n[ERROR] System failed to start")
        sys.exit(1)

    print("\n" + "="*80)
    print("OKX UNIFIED SYSTEM - COMPLETED")
    print("="*80 + "\n")


def main():
    """Main entry point"""
    start()


if __name__ == '__main__':
    start()
