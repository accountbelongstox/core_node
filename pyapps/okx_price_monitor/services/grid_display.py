#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Grid Display Service (RPC v2)

Displays real-time data in grid format using RPC v2 calls.
"""

from typing import List, Dict, Optional

from pyapps.okx_price_monitor.core import config, format_price
from pyapps.okx_price_monitor.foundation import Printer


class GridDisplay:
    """
    Grid Display Service
    
    Provides real-time grid display using RPC v2 interface.
    This service uses the legacy RPC system for display purposes only.
    """
    
    def __init__(self, rpc_base_url: str = None):
        """
        Initialize grid display
        
        Args:
            rpc_base_url (str): RPC server base URL
        """
        self.rpc_base_url = rpc_base_url or config.RPC_BASE_URL
        self.printer = Printer(prefix="[GridDisplay]")
        self.enabled = False
    
    def enable(self):
        """Enable grid display"""
        self.enabled = True
        self.printer.info("Grid display enabled")
    
    def disable(self):
        """Disable grid display"""
        self.enabled = False
        self.printer.info("Grid display disabled")
    
    def display_tickers(self, tickers: List[Dict], title: str = "Price Monitor"):
        """
        Display tickers in grid format
        
        Args:
            tickers (List[Dict]): List of ticker data
            title (str): Display title
        """
        if not self.enabled:
            return
        
        self.printer.header(title)
        
        self.printer.table_row(
            "Instrument", "Price", "24h Change", "Volume",
            widths=[15, 15, 12, 15]
        )
        self.printer.separator()
        
        for ticker in tickers[:20]:
            inst_id = ticker.get('instId', 'N/A')
            last = format_price(ticker.get('last', 'N/A'))
            change_24h = ticker.get('changePercent24h', ticker.get('changeRate24h', 'N/A'))
            vol_24h = ticker.get('vol24h', 'N/A')
            
            change_float = float(change_24h) if isinstance(change_24h, str) else change_24h
            change_str = f"{change_float:+.2f}%"
            
            self.printer.table_row(
                inst_id, last, change_str, str(vol_24h),
                widths=[15, 15, 12, 15]
            )
        
        if len(tickers) > 20:
            self.printer.info(f"\n... and {len(tickers) - 20} more")
        
        self.printer.separator()
    
    def display_signals(self, signals: List, title: str = "Trading Signals"):
        """
        Display trading signals in grid format
        
        Args:
            signals (List): List of trading signals
            title (str): Display title
        """
        if not self.enabled or not signals:
            return
        
        self.printer.header(title)
        
        self.printer.table_row(
            "Type", "Instrument", "Price", "Strength",
            widths=[8, 15, 15, 10]
        )
        self.printer.separator()
        
        for signal in signals:
            self.printer.table_row(
                signal.signal_type,
                signal.inst_id,
                format_price(signal.price),
                signal.strength,
                widths=[8, 15, 15, 10]
            )
        
        self.printer.separator()
    
    def display_statistics(self, stats: Dict, title: str = "Statistics"):
        """
        Display statistics in grid format
        
        Args:
            stats (Dict): Statistics dictionary
            title (str): Display title
        """
        if not self.enabled:
            return
        
        self.printer.header(title)
        
        for key, value in stats.items():
            self.printer.key_value(key.replace('_', ' ').title(), value)
        
        self.printer.separator()
    
    def call_rpc_v2_display(self, data: Dict, display_type: str = "table"):
        """
        Call RPC v2 display endpoint (placeholder for future implementation)
        
        Args:
            data (Dict): Data to display
            display_type (str): Display type ("table", "chart", "grid")
        """
        self.printer.warning("[RPC v2] Real-time display not implemented yet")
        self.printer.info(f"Would display {display_type} with {len(data)} items")
    
    def update_grid(self, grid_data: List[List], headers: List[str] = None):
        """
        Update grid display with new data
        
        Args:
            grid_data (List[List]): Grid data (rows)
            headers (List[str]): Column headers
        """
        if not self.enabled:
            return
        
        if headers:
            self.printer.table_row(*headers)
            self.printer.separator()
        
        for row in grid_data:
            self.printer.table_row(*row)

