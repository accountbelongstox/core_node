#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trade Executor Service

Executes trading operations based on signals.
"""

import random
from typing import List, Dict, Optional

from pyapps.okx_price_monitor.core import config
from pyapps.okx_price_monitor.foundation import Printer
from pyapps.okx_price_monitor.services.trading_strategy import TradingSignal


class TradeOrder:
    """Trade Order Data Class"""
    
    def __init__(
        self,
        inst_id: str,
        side: str,
        size: float,
        price: float,
        order_type: str = "limit"
    ):
        self.inst_id = inst_id
        self.side = side  # "buy" or "sell"
        self.size = size
        self.price = price
        self.order_type = order_type
        self.status = "pending"
        self.order_id = None
    
    def __repr__(self):
        return f"<TradeOrder {self.side.upper()} {self.size} {self.inst_id} @ {self.price}>"


class TradeExecutor:
    """
    Trade Executor Service
    
    Executes trading operations based on signals.
    Currently in simulation mode - does not execute real trades.
    """
    
    def __init__(self, simulation_mode: bool = True):
        """
        Initialize trade executor
        
        Args:
            simulation_mode (bool): If True, only simulate trades without execution
        """
        self.simulation_mode = simulation_mode
        self.printer = Printer(prefix="[TradeExecutor]")
        self.order_history = []
        
        if simulation_mode:
            self.printer.warning("Running in SIMULATION mode - no real trades will be executed")
    
    def execute_signal(self, signal: TradingSignal, size: float = 0.001) -> Optional[TradeOrder]:
        """
        Execute a trading signal
        
        Args:
            signal (TradingSignal): Trading signal to execute
            size (float): Order size
            
        Returns:
            Optional[TradeOrder]: Created order or None
        """
        if signal.signal_type not in ["BUY", "SELL"]:
            return None
        
        side = signal.signal_type.lower()
        
        order = TradeOrder(
            inst_id=signal.inst_id,
            side=side,
            size=size,
            price=signal.price
        )
        
        if self.simulation_mode:
            self._simulate_order(order)
        else:
            self._execute_real_order(order)
        
        self.order_history.append(order)
        
        return order
    
    def execute_signals(self, signals: List[TradingSignal], size: float = 0.001) -> List[TradeOrder]:
        """
        Execute multiple trading signals
        
        Args:
            signals (List[TradingSignal]): List of trading signals
            size (float): Order size for each signal
            
        Returns:
            List[TradeOrder]: List of created orders
        """
        orders = []
        
        for signal in signals:
            order = self.execute_signal(signal, size)
            if order:
                orders.append(order)
        
        return orders
    
    def _simulate_order(self, order: TradeOrder):
        """
        Simulate order execution
        
        Args:
            order (TradeOrder): Order to simulate
        """
        order.status = "filled"
        order.order_id = f"SIM-{random.randint(10000, 99999)}"
        
        self.printer.info(
            f"[SIMULATION] {order.side.upper()} {order.size} {order.inst_id} @ {order.price}"
        )
        self.printer.success(f"[SIMULATION] Order filled: {order.order_id}")
    
    def _execute_real_order(self, order: TradeOrder):
        """
        Execute real order (placeholder for future implementation)
        
        Args:
            order (TradeOrder): Order to execute
        """
        self.printer.error("[REAL MODE] Real order execution not implemented yet")
        self.printer.info(
            f"Would execute: {order.side.upper()} {order.size} {order.inst_id} @ {order.price}"
        )
        
        order.status = "failed"
        order.order_id = None
    
    def get_order_history(self, limit: int = None) -> List[TradeOrder]:
        """
        Get order history
        
        Args:
            limit (int): Maximum number of orders to return
            
        Returns:
            List[TradeOrder]: List of orders
        """
        if limit:
            return self.order_history[-limit:]
        return self.order_history
    
    def print_order_history(self, limit: int = 10):
        """
        Print order history
        
        Args:
            limit (int): Maximum number of orders to display
        """
        orders = self.get_order_history(limit)
        
        if not orders:
            self.printer.info("No orders in history")
            return
        
        self.printer.header("ORDER HISTORY")
        
        for order in orders:
            status_color = self.printer.success if order.status == "filled" else self.printer.error
            
            self.printer.info(
                f"\n{order.side.upper()} {order.size} {order.inst_id} @ {order.price}"
            )
            status_color(f"  Status: {order.status}")
            if order.order_id:
                self.printer.plain(f"  Order ID: {order.order_id}")
        
        self.printer.separator()
    
    def get_statistics(self) -> Dict:
        """
        Get execution statistics
        
        Returns:
            Dict: Statistics dictionary
        """
        total_orders = len(self.order_history)
        buy_orders = [o for o in self.order_history if o.side == "buy"]
        sell_orders = [o for o in self.order_history if o.side == "sell"]
        filled_orders = [o for o in self.order_history if o.status == "filled"]
        
        return {
            'total_orders': total_orders,
            'buy_orders': len(buy_orders),
            'sell_orders': len(sell_orders),
            'filled_orders': len(filled_orders),
            'simulation_mode': self.simulation_mode
        }
    
    def clear_history(self):
        """Clear order history"""
        self.order_history = []
        self.printer.info("Order history cleared")

