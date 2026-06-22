#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backtest Engine - Virtual Trading System
"""

import time
import threading
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path
from enum import Enum
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager


class OrderSide(Enum):
    """Order side"""
    BUY = 'buy'
    SELL = 'sell'


class Position:
    """Virtual trading position"""

    def __init__(self, coin_symbol: str, entry_price: float, entry_time: int,
                 size: float, side: OrderSide):
        """
        Initialize position

        Args:
            coin_symbol: Coin symbol
            entry_price: Entry price
            entry_time: Entry timestamp (ms)
            size: Position size (USDT)
            side: Order side (BUY/SELL)
        """
        self.coin_symbol = coin_symbol
        self.entry_price = entry_price
        self.entry_time = entry_time
        self.size = size
        self.side = side

        self.exit_price: Optional[float] = None
        self.exit_time: Optional[int] = None
        self.pnl: Optional[float] = None
        self.pnl_percent: Optional[float] = None

    def close(self, exit_price: float, exit_time: int):
        """
        Close position

        Args:
            exit_price: Exit price
            exit_time: Exit timestamp (ms)
        """
        self.exit_price = exit_price
        self.exit_time = exit_time

        # Calculate P&L
        if self.side == OrderSide.BUY:
            self.pnl_percent = ((exit_price - self.entry_price) / self.entry_price) * 100
        else:
            self.pnl_percent = ((self.entry_price - exit_price) / self.entry_price) * 100

        # Account for fees
        fee_percent = strategy_config.TRADING_FEE_PERCENT
        self.pnl_percent -= (fee_percent * 2)  # Entry + exit fees

        # Calculate absolute P&L
        self.pnl = (self.pnl_percent / 100) * self.size

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'coin_symbol': self.coin_symbol,
            'entry_price': str(self.entry_price),
            'entry_time': str(self.entry_time),
            'exit_price': str(self.exit_price) if self.exit_price else '',
            'exit_time': str(self.exit_time) if self.exit_time else '',
            'size': str(self.size),
            'side': self.side.value,
            'pnl': str(self.pnl) if self.pnl else '',
            'pnl_percent': str(self.pnl_percent) if self.pnl_percent else '',
        }


class BacktestEngine:
    """
    Virtual trading backtest engine

    Manages virtual balance, positions, and trade execution.
    """

    def __init__(self, initial_balance: float = None):
        """
        Initialize backtest engine

        Args:
            initial_balance: Initial USDT balance
        """
        import sys
        print("[BacktestEngine] Step 1: Starting initialization...")
        sys.stdout.flush()

        self.initial_balance = initial_balance or strategy_config.INITIAL_BALANCE_USDT
        print(f"[BacktestEngine] Step 2: Initial balance set to {self.initial_balance}")
        sys.stdout.flush()

        self.balance = self.initial_balance
        print(f"[BacktestEngine] Step 3: Current balance set")
        sys.stdout.flush()

        print(f"[BacktestEngine] Step 4: Getting Redis manager...")
        sys.stdout.flush()
        self.redis_manager = get_redis_manager()
        print(f"[BacktestEngine] Step 5: Redis manager obtained")
        sys.stdout.flush()

        # Thread lock for concurrent access protection
        self._lock = threading.Lock()
        print(f"[BacktestEngine] Step 6: Thread lock initialized")
        sys.stdout.flush()

        # Active positions
        self.positions: Dict[str, Position] = {}

        # Closed positions (trade history)
        self.trade_history: List[Position] = []

        # Statistics
        self.stats = {
            'total_trades': 0,
            'winning_trades': 0,
            'losing_trades': 0,
            'total_pnl': 0.0,
            'max_drawdown': 0.0,
            'peak_balance': self.initial_balance,
        }

        print(f"[BacktestEngine] Initialized (thread-safe)")
        print(f"[BacktestEngine] Initial balance: {self.initial_balance} USDT")
        sys.stdout.flush()

    def can_open_position(self) -> bool:
        """
        Check if can open new position

        Returns:
            bool: True if can open
        """
        # Check max positions limit
        if len(self.positions) >= strategy_config.MAX_POSITIONS:
            return False

        # Check available balance
        position_size = self.calculate_position_size()
        if position_size <= 0 or position_size > self.balance:
            return False

        return True

    def calculate_position_size(self) -> float:
        """
        Calculate position size based on balance

        Returns:
            float: Position size in USDT
        """
        return self.balance * (strategy_config.POSITION_SIZE_PERCENT / 100)

    def open_position(self, coin_symbol: str, price: float, timestamp_ms: int) -> Optional[Position]:
        """
        Open a new position (BUY)

        Args:
            coin_symbol: Coin symbol
            price: Entry price
            timestamp_ms: Entry timestamp

        Returns:
            Optional[Position]: Created position or None
        """
        with self._lock:
            if not self.can_open_position():
                return None

            if coin_symbol in self.positions:
                # Already have position for this coin
                return None

            # Calculate size
            size = self.calculate_position_size()

            # Create position
            position = Position(
                coin_symbol=coin_symbol,
                entry_price=price,
                entry_time=timestamp_ms,
                size=size,
                side=OrderSide.BUY
            )

            # Deduct from balance (CRITICAL SECTION)
            self.balance -= size

            # Store position (CRITICAL SECTION)
            self.positions[coin_symbol] = position

            # Store in Redis
            self.redis_manager.set_position(coin_symbol, position.to_dict())

            print(f"[BacktestEngine] OPEN {coin_symbol} @ {price:.4f} (size: {size:.2f} USDT)")

            return position

    def close_position(self, coin_symbol: str, price: float, timestamp_ms: int) -> Optional[Position]:
        """
        Close an existing position (SELL)

        Args:
            coin_symbol: Coin symbol
            price: Exit price
            timestamp_ms: Exit timestamp

        Returns:
            Optional[Position]: Closed position or None
        """
        with self._lock:
            if coin_symbol not in self.positions:
                return None

            # Get position (CRITICAL SECTION)
            position = self.positions.pop(coin_symbol)

            # Close position
            position.close(price, timestamp_ms)

            # Add proceeds back to balance (CRITICAL SECTION)
            proceeds = position.size + position.pnl
            self.balance += proceeds

            # Update statistics (CRITICAL SECTION)
            self.stats['total_trades'] += 1
            if position.pnl > 0:
                self.stats['winning_trades'] += 1
            else:
                self.stats['losing_trades'] += 1

            self.stats['total_pnl'] += position.pnl

            # Update peak balance and drawdown
            if self.balance > self.stats['peak_balance']:
                self.stats['peak_balance'] = self.balance

            drawdown = (self.stats['peak_balance'] - self.balance) / self.stats['peak_balance'] * 100
            if drawdown > self.stats['max_drawdown']:
                self.stats['max_drawdown'] = drawdown

            # Add to history
            self.trade_history.append(position)

            # Remove from Redis
            self.redis_manager.delete_position(coin_symbol)

            print(f"[BacktestEngine] CLOSE {coin_symbol} @ {price:.4f} "
                  f"(P&L: {position.pnl:+.2f} USDT / {position.pnl_percent:+.2f}%)")

            return position

    def check_exit_conditions(self, coin_symbol: str, current_price: float,
                              current_time_ms: int) -> bool:
        """
        Check if should exit position

        Args:
            coin_symbol: Coin symbol
            current_price: Current price
            current_time_ms: Current timestamp

        Returns:
            bool: True if should exit
        """
        with self._lock:
            if coin_symbol not in self.positions:
                return False

            position = self.positions[coin_symbol]

            # Time-based exit (5 minutes after entry)
            time_elapsed_ms = current_time_ms - position.entry_time
            if time_elapsed_ms >= strategy_config.SELL_AFTER_MINUTES * 60 * 1000:
                return True

            # Stop loss
            if strategy_config.ENABLE_STOP_LOSS:
                pnl_percent = ((current_price - position.entry_price) / position.entry_price) * 100
                if pnl_percent <= strategy_config.STOP_LOSS_PERCENT:
                    return True

            # Take profit
            if strategy_config.ENABLE_TAKE_PROFIT:
                pnl_percent = ((current_price - position.entry_price) / position.entry_price) * 100
                if pnl_percent >= strategy_config.TAKE_PROFIT_PERCENT:
                    return True

            return False

    def get_performance_summary(self) -> Dict:
        """
        Get performance summary

        Returns:
            Dict: Performance metrics
        """
        with self._lock:
            total_return = self.balance - self.initial_balance
            total_return_percent = (total_return / self.initial_balance) * 100

            win_rate = 0
            if self.stats['total_trades'] > 0:
                win_rate = (self.stats['winning_trades'] / self.stats['total_trades']) * 100

            return {
                'initial_balance': self.initial_balance,
                'current_balance': self.balance,
                'total_return': total_return,
                'total_return_percent': total_return_percent,
                'total_trades': self.stats['total_trades'],
                'winning_trades': self.stats['winning_trades'],
                'losing_trades': self.stats['losing_trades'],
                'win_rate': win_rate,
                'total_pnl': self.stats['total_pnl'],
                'max_drawdown': self.stats['max_drawdown'],
                'active_positions': len(self.positions),
            }

    def save_trade_log(self, log_dir: Path = None):
        """
        Save trade history to CSV

        Args:
            log_dir: Directory to save logs
        """
        with self._lock:
            if not self.trade_history:
                print("[BacktestEngine] No trades to save")
                return

            # Copy trade history to avoid holding lock during file I/O
            trade_history_copy = list(self.trade_history)

        # File I/O outside of lock
        if log_dir is None:
            from pyapps.okx_price_monitor.core.monitor_config import monitor_config
            log_dir = monitor_config.CACHE_DIR / "backtest_logs"

        log_dir.mkdir(parents=True, exist_ok=True)

        # Create log file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = log_dir / f"trades_{timestamp}.csv"

        with open(log_file, 'w', encoding='utf-8') as f:
            # Write header
            f.write("Coin,EntryPrice,EntryTime,ExitPrice,ExitTime,Size,PnL,PnL%\n")

            # Write trades
            for trade in trade_history_copy:
                entry_dt = datetime.fromtimestamp(trade.entry_time / 1000).strftime('%Y-%m-%d %H:%M:%S')
                exit_dt = datetime.fromtimestamp(trade.exit_time / 1000).strftime('%Y-%m-%d %H:%M:%S')

                f.write(f"{trade.coin_symbol},"
                       f"{trade.entry_price:.4f},"
                       f"{entry_dt},"
                       f"{trade.exit_price:.4f},"
                       f"{exit_dt},"
                       f"{trade.size:.2f},"
                       f"{trade.pnl:.2f},"
                       f"{trade.pnl_percent:.2f}\n")

        print(f"[BacktestEngine] Trade log saved: {log_file}")


# Global instance
_global_engine = None


def get_backtest_engine() -> BacktestEngine:
    """
    Get global backtest engine instance

    Returns:
        BacktestEngine: Global instance
    """
    global _global_engine

    if _global_engine is None:
        _global_engine = BacktestEngine()

    return _global_engine
