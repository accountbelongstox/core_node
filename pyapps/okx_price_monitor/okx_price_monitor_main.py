#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor - API Mode

Main entry point for the layered architecture.
Uses direct API calls to OKX API v5.
"""

import time
import signal
import sys
import threading

from pyapps.okx_price_monitor.core import config
from pyapps.okx_price_monitor.foundation import CoinProvider, DatabaseHandler, Printer
from pyapps.okx_price_monitor.services import (
    PriceMonitor,
    TradingStrategy,
    TradeExecutor,
    GridDisplay
)


class OKXMonitorApp:
    """
    OKX Monitor Application
    
    Main application class coordinating all services.
    """
    
    def __init__(self):
        self.printer = Printer(prefix="[OKXMonitor]")
        self.running = False
        
        self.coin_provider = None
        self.database_handler = None
        self.price_monitor = None
        self.trading_strategy = None
        self.trade_executor = None
        self.grid_display = None
    
    def initialize(self):
        """Initialize all components"""
        self.printer.header("OKX PRICE MONITOR - API MODE")
        
        config.print_config()
        
        self.printer.info("\n[Step 1] Initializing Coin Provider...")
        self.coin_provider = CoinProvider(
            inst_type=config.DEFAULT_INST_TYPE,
            use_auth=config.USE_AUTH
        )
        self.printer.success("Coin Provider initialized")
        
        self.printer.info("\n[Step 2] Initializing Database Handler...")
        self.database_handler = DatabaseHandler(database_name=config.DATABASE_NAME)
        if self.database_handler.initialize():
            self.printer.success("Database Handler initialized")
        else:
            self.printer.warning("Database initialization failed - continuing without database")
            self.database_handler = None
        
        self.printer.info("\n[Step 3] Setting up trading pairs...")
        
        if config.MONITOR_SPECIFIC_PAIRS:
            trading_pairs = config.MONITOR_SPECIFIC_PAIRS
            self.printer.success(f"Using {len(trading_pairs)} specified trading pairs")
        elif config.PRELOAD_ALL_INSTRUMENTS:
            instruments = self.coin_provider.fetch_instruments()
            self.printer.success(f"Fetched {len(instruments)} instruments")
            trading_pairs = self.coin_provider.get_trading_pairs(quote_currency="USDT")
            self.printer.success(f"Found {len(trading_pairs)} USDT trading pairs")
        else:
            trading_pairs = ["BTC-USDT", "ETH-USDT", "SOL-USDT"]
            self.printer.info(f"Using default {len(trading_pairs)} trading pairs")
            self.printer.info("Set MONITOR_SPECIFIC_PAIRS or PRELOAD_ALL_INSTRUMENTS=True in config for more")
        
        self.printer.info("\n[Step 4] Initializing Price Monitor...")
        self.price_monitor = PriceMonitor(
            coin_provider=self.coin_provider,
            database_handler=self.database_handler
        )
        self.price_monitor.set_trading_pairs(trading_pairs)
        self.printer.success("Price Monitor initialized")
        
        self.printer.info("\n[Step 5] Initializing Trading Strategy...")
        self.trading_strategy = TradingStrategy()
        self.printer.success("Trading Strategy initialized")
        
        self.printer.info("\n[Step 6] Initializing Trade Executor...")
        self.trade_executor = TradeExecutor(simulation_mode=True)
        self.printer.success("Trade Executor initialized (SIMULATION MODE)")
        
        self.printer.info("\n[Step 7] Initializing Grid Display...")
        self.grid_display = GridDisplay(rpc_base_url=config.RPC_BASE_URL)
        self.grid_display.enable()
        self.printer.success("Grid Display initialized")
        
        if self.database_handler:
            self.printer.info(f"\n[Step 8] Loading {config.HISTORY_HOURS}h history from database...")
            self.price_monitor.load_history_from_database(hours=config.HISTORY_HOURS)
            self.database_handler.print_statistics()
        
        self.printer.header("INITIALIZATION COMPLETE")
    
    def run_single_tick(self):
        """Run a single monitoring tick"""
        tick_result = self.price_monitor.run_tick()
        
        if not tick_result['success']:
            self.printer.error("Tick failed")
            return
        
        tickers = tick_result['tickers']
        
        self.grid_display.display_tickers(tickers, title=f"TICK #{tick_result['tick']}")
        
        signals = self.trading_strategy.analyze_batch(tickers)
        
        if signals:
            self.trading_strategy.print_signals(signals)
            self.grid_display.display_signals(signals)
            
            orders = self.trade_executor.execute_signals(signals[:5])
            if orders:
                self.trade_executor.print_order_history(limit=5)
        
        significant_changes = self.price_monitor.detect_significant_changes(
            threshold=config.ALERT_CHANGE_1MIN_THRESHOLD
        )
        
        if significant_changes:
            self.printer.warning(f"\n⚠️  {len(significant_changes)} significant price changes detected!")
            for change in significant_changes[:5]:
                self.printer.warning(
                    f"  {change['inst_id']}: {change['change_1min']:+.2f}% (1min)"
                )
    
    def run_continuous(self):
        """Run continuous monitoring loop"""
        self.running = True
        
        self.printer.header("CONTINUOUS MONITORING STARTED")
        self.printer.info(f"Fetch interval: {config.FETCH_INTERVAL_MS}ms")
        self.printer.info("Press Ctrl+C to stop")
        self.printer.separator()
        
        fetch_interval = config.get_fetch_interval_seconds()
        
        try:
            while self.running:
                start_time = time.time()
                
                self.run_single_tick()
                
                elapsed = time.time() - start_time
                sleep_time = max(0, fetch_interval - elapsed)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            self.printer.warning("\nReceived interrupt signal")
            self.stop()
    
    def stop(self):
        """Stop the application"""
        self.running = False
        
        self.printer.header("STOPPING APPLICATION")
        
        if self.price_monitor:
            stats = self.price_monitor.get_statistics()
            self.grid_display.display_statistics(stats, title="Price Monitor Statistics")
        
        if self.trading_strategy:
            stats = self.trading_strategy.get_signal_statistics()
            self.grid_display.display_statistics(stats, title="Trading Strategy Statistics")
        
        if self.trade_executor:
            stats = self.trade_executor.get_statistics()
            self.grid_display.display_statistics(stats, title="Trade Executor Statistics")
        
        self.printer.success("\nApplication stopped gracefully")


app_instance = None


def signal_handler(sig, frame):
    """Handle Ctrl+C signal"""
    global app_instance
    
    if app_instance:
        app_instance.stop()
    
    sys.exit(0)


def start():
    """Start the OKX Monitor application"""
    global app_instance
    
    signal.signal(signal.SIGINT, signal_handler)
    
    app_instance = OKXMonitorApp()
    app_instance.initialize()
    
    app_instance.run_continuous()


def main():
    """Main entry point"""
    start()


if __name__ == '__main__':
    start()

