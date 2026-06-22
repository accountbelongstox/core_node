#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trading Strategy Service

Analyzes price data and generates trading signals.
"""

from typing import List, Dict, Optional

from pyapps.okx_price_monitor.core import config, calculate_change_percent
from pyapps.okx_price_monitor.foundation import Printer


class TradingSignal:
    """Trading Signal Data Class"""
    
    def __init__(
        self,
        inst_id: str,
        signal_type: str,
        price: float,
        reason: str,
        strength: str = "normal"
    ):
        self.inst_id = inst_id
        self.signal_type = signal_type  # "BUY", "SELL", "HOLD"
        self.price = price
        self.reason = reason
        self.strength = strength  # "weak", "normal", "strong"
    
    def __repr__(self):
        return f"<TradingSignal {self.signal_type} {self.inst_id} @ {self.price} ({self.strength})>"


class TradingStrategy:
    """
    Trading Strategy Service
    
    Analyzes price movements and generates trading signals based on thresholds.
    """
    
    def __init__(
        self,
        buy_threshold: float = None,
        sell_threshold: float = None,
        strong_buy_threshold: float = None,
        strong_sell_threshold: float = None
    ):
        """
        Initialize trading strategy
        
        Args:
            buy_threshold (float): Buy signal threshold (negative %)
            sell_threshold (float): Sell signal threshold (positive %)
            strong_buy_threshold (float): Strong buy threshold (negative %)
            strong_sell_threshold (float): Strong sell threshold (positive %)
        """
        self.buy_threshold = buy_threshold or config.BUY_DIP_THRESHOLD
        self.sell_threshold = sell_threshold or config.SELL_PEAK_THRESHOLD
        self.strong_buy_threshold = strong_buy_threshold or config.STRONG_BUY_THRESHOLD
        self.strong_sell_threshold = strong_sell_threshold or config.STRONG_SELL_THRESHOLD
        
        self.printer = Printer(prefix="[TradingStrategy]")
        self.signals_history = []
    
    def analyze_ticker(self, ticker: Dict) -> Optional[TradingSignal]:
        """
        Analyze single ticker and generate signal
        
        Args:
            ticker (Dict): Ticker data
            
        Returns:
            Optional[TradingSignal]: Trading signal or None
        """
        inst_id = ticker.get('instId')
        last_price = ticker.get('last')
        change_24h = ticker.get('changePercent24h', ticker.get('changeRate24h'))
        
        if not all([inst_id, last_price, change_24h]):
            return None
        
        price = float(last_price)
        change = float(change_24h) if isinstance(change_24h, str) else change_24h
        
        if change <= self.strong_buy_threshold:
            return TradingSignal(
                inst_id=inst_id,
                signal_type="BUY",
                price=price,
                reason=f"Strong dip detected: {change:.2f}%",
                strength="strong"
            )
        
        elif change <= self.buy_threshold:
            return TradingSignal(
                inst_id=inst_id,
                signal_type="BUY",
                price=price,
                reason=f"Dip detected: {change:.2f}%",
                strength="normal"
            )
        
        elif change >= self.strong_sell_threshold:
            return TradingSignal(
                inst_id=inst_id,
                signal_type="SELL",
                price=price,
                reason=f"Strong peak detected: {change:.2f}%",
                strength="strong"
            )
        
        elif change >= self.sell_threshold:
            return TradingSignal(
                inst_id=inst_id,
                signal_type="SELL",
                price=price,
                reason=f"Peak detected: {change:.2f}%",
                strength="normal"
            )
        
        else:
            return None
    
    def analyze_batch(self, tickers: List[Dict]) -> List[TradingSignal]:
        """
        Analyze batch of tickers and generate signals
        
        Args:
            tickers (List[Dict]): List of ticker data
            
        Returns:
            List[TradingSignal]: List of trading signals
        """
        signals = []
        
        for ticker in tickers:
            signal = self.analyze_ticker(ticker)
            if signal:
                signals.append(signal)
                self.signals_history.append(signal)
        
        return signals
    
    def print_signals(self, signals: List[TradingSignal]):
        """
        Print trading signals
        
        Args:
            signals (List[TradingSignal]): List of trading signals
        """
        if not signals:
            self.printer.info("No trading signals generated")
            return
        
        self.printer.header("TRADING SIGNALS")
        
        for signal in signals:
            if signal.signal_type == "BUY":
                color_func = self.printer.success if signal.strength == "strong" else self.printer.info
            else:
                color_func = self.printer.error if signal.strength == "strong" else self.printer.warning
            
            strength_label = signal.strength.upper()
            color_func(
                f"\n[{strength_label}] {signal.signal_type} {signal.inst_id} @ {signal.price}"
            )
            self.printer.plain(f"  Reason: {signal.reason}")
        
        self.printer.separator()
    
    def get_signal_statistics(self) -> Dict:
        """
        Get signal statistics
        
        Returns:
            Dict: Statistics dictionary
        """
        buy_signals = [s for s in self.signals_history if s.signal_type == "BUY"]
        sell_signals = [s for s in self.signals_history if s.signal_type == "SELL"]
        strong_signals = [s for s in self.signals_history if s.strength == "strong"]
        
        return {
            'total_signals': len(self.signals_history),
            'buy_signals': len(buy_signals),
            'sell_signals': len(sell_signals),
            'strong_signals': len(strong_signals),
            'buy_threshold': self.buy_threshold,
            'sell_threshold': self.sell_threshold
        }
    
    def clear_history(self):
        """Clear signal history"""
        self.signals_history = []
        self.printer.info("Signal history cleared")

