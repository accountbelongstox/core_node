#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coin Attribute Calculator - 24-Hour Analysis Engine
"""

import time
from typing import Dict, List, Optional, Tuple
from enum import Enum
from pyapps.okx_price_monitor.core.strategy_config import strategy_config
from pyapps.okx_price_monitor.foundation.redis_manager import get_redis_manager


class TrendType(Enum):
    """Trend classification types"""
    UPWARD = 'upward'            # Rising trend
    DOWNWARD = 'downward'        # Falling trend
    STABLE = 'stable'            # Sideways/stable
    UP_THEN_DOWN = 'up_then_down'      # Up then down
    DOWN_THEN_UP = 'down_then_up'      # Down then up


class CoinAttributeCalculator:
    """
    Calculate 24-hour attributes for coins

    Attributes calculated:
    - Price volatility (high-low range)
    - Trend direction
    - Period analysis (4 periods)
    """

    def __init__(self):
        """Initialize calculator"""
        self.redis_manager = get_redis_manager()

        # Config shortcuts
        self.window_hours = strategy_config.ANALYSIS_WINDOW_HOURS
        self.period_count = strategy_config.TIME_PERIODS_COUNT
        self.period_duration_hours = self.window_hours // self.period_count

        print(f"[CoinAttributeCalculator] Initialized")
        print(f"[CoinAttributeCalculator] Analysis window: {self.window_hours}h")
        print(f"[CoinAttributeCalculator] Periods: {self.period_count} x {self.period_duration_hours}h")

    def calculate_attributes(self, coin_symbol: str) -> Optional[Dict]:
        """
        Calculate all 24-hour attributes for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[Dict]: Calculated attributes or None if insufficient data
        """
        # Get price history from Redis
        current_time_ms = int(time.time() * 1000)
        window_ms = self.window_hours * 3600 * 1000
        start_time_ms = current_time_ms - window_ms

        price_history = self.redis_manager.get_price_history(
            coin_symbol,
            start_time_ms=start_time_ms,
            end_time_ms=current_time_ms,
            limit=self.window_hours * 60  # Max 1 per minute
        )

        if not price_history or len(price_history) < 10:
            # Insufficient data
            return None

        # Extract LOW prices (as specified by user)
        prices = [record['low'] for record in price_history]
        timestamps = [record['timestamp_ms'] for record in price_history]

        # Calculate attributes
        attributes = {}

        # 1. Price volatility (high-low range)
        attributes.update(self._calculate_volatility(prices))

        # 2. Trend analysis
        attributes.update(self._calculate_trend(prices, timestamps, current_time_ms))

        # 3. Period analysis
        attributes.update(self._calculate_period_analysis(prices, timestamps, current_time_ms))

        # 4. Metadata
        attributes['last_update_ms'] = current_time_ms
        attributes['data_points_count'] = len(price_history)

        return attributes

    def _calculate_volatility(self, prices: List[float]) -> Dict:
        """
        Calculate price volatility

        Args:
            prices: List of prices

        Returns:
            Dict: Volatility metrics
        """
        if not prices:
            return {}

        high = max(prices)
        low = min(prices)
        avg = sum(prices) / len(prices)

        # Volatility as percentage of average
        volatility_range = high - low
        volatility_percent = (volatility_range / avg) * 100 if avg > 0 else 0

        return {
            '24h_high': high,
            '24h_low': low,
            '24h_avg': avg,
            '24h_volatility_range': volatility_range,
            '24h_volatility_percent': volatility_percent,
        }

    def _calculate_trend(self, prices: List[float], timestamps: List[int],
                        current_time_ms: int) -> Dict:
        """
        Calculate overall trend direction

        Args:
            prices: List of prices
            timestamps: List of timestamps
            current_time_ms: Current timestamp

        Returns:
            Dict: Trend metrics
        """
        if len(prices) < 2:
            return {}

        # Calculate average price
        avg_price = sum(prices) / len(prices)

        # Count prices above/below average
        above_avg_count = sum(1 for p in prices if p > avg_price)
        below_avg_count = sum(1 for p in prices if p < avg_price)

        # Split into 4 periods and calculate average for each
        period_averages = []
        period_duration_ms = (self.period_duration_hours * 3600 * 1000)

        for i in range(self.period_count):
            period_start = current_time_ms - (self.period_count - i) * period_duration_ms
            period_end = period_start + period_duration_ms

            # Get prices in this period
            period_prices = [
                prices[j] for j in range(len(prices))
                if period_start <= timestamps[j] < period_end
            ]

            if period_prices:
                period_avg = sum(period_prices) / len(period_prices)
                period_averages.append(period_avg)
            else:
                period_averages.append(None)

        # Analyze trend based on period averages
        trend_type = self._classify_trend(period_averages, avg_price)

        return {
            '24h_avg_price': avg_price,
            'above_avg_count': above_avg_count,
            'below_avg_count': below_avg_count,
            'trend_type': trend_type.value,
            'period_averages': str(period_averages),  # Store as string for Redis
        }

    def _classify_trend(self, period_averages: List[Optional[float]],
                       overall_avg: float) -> TrendType:
        """
        Classify trend based on period analysis

        Args:
            period_averages: Average price for each period
            overall_avg: Overall average price

        Returns:
            TrendType: Classified trend
        """
        # Filter out None values
        valid_averages = [p for p in period_averages if p is not None]

        if len(valid_averages) < 2:
            return TrendType.STABLE

        # Check if later periods are above/below average
        first_half_avg = sum(valid_averages[:len(valid_averages)//2]) / (len(valid_averages)//2)
        second_half_avg = sum(valid_averages[len(valid_averages)//2:]) / (len(valid_averages) - len(valid_averages)//2)

        # Determine trend
        if second_half_avg > overall_avg and first_half_avg <= overall_avg:
            # Later periods above average, earlier below
            return TrendType.UPWARD
        elif second_half_avg < overall_avg and first_half_avg >= overall_avg:
            # Later periods below average, earlier above
            return TrendType.DOWNWARD
        elif second_half_avg > first_half_avg * 1.01:
            # Clear upward movement
            return TrendType.UPWARD
        elif second_half_avg < first_half_avg * 0.99:
            # Clear downward movement
            return TrendType.DOWNWARD
        else:
            # Stable/sideways
            return TrendType.STABLE

    def _calculate_period_analysis(self, prices: List[float], timestamps: List[int],
                                   current_time_ms: int) -> Dict:
        """
        Detailed period-by-period analysis

        Args:
            prices: List of prices
            timestamps: List of timestamps
            current_time_ms: Current timestamp

        Returns:
            Dict: Period analysis
        """
        period_duration_ms = (self.period_duration_hours * 3600 * 1000)
        period_data = []

        for i in range(self.period_count):
            period_start = current_time_ms - (self.period_count - i) * period_duration_ms
            period_end = period_start + period_duration_ms

            # Get prices in this period
            period_prices = [
                prices[j] for j in range(len(prices))
                if period_start <= timestamps[j] < period_end
            ]

            if period_prices:
                period_info = {
                    'avg': sum(period_prices) / len(period_prices),
                    'high': max(period_prices),
                    'low': min(period_prices),
                    'count': len(period_prices),
                }
                period_data.append(period_info)
            else:
                period_data.append(None)

        return {
            'period_data': str(period_data),  # Store as string for Redis
        }

    def update_all_coins(self, coin_symbols: List[str]):
        """
        Update attributes for all coins

        Args:
            coin_symbols: List of coin symbols to update
        """
        print(f"[CoinAttributeCalculator] Updating {len(coin_symbols)} coins...")

        updated = 0
        failed = 0

        for coin_symbol in coin_symbols:
            attributes = self.calculate_attributes(coin_symbol)

            if attributes:
                # Store in Redis
                self.redis_manager.set_coin_attributes(coin_symbol, attributes)
                updated += 1
            else:
                failed += 1

        print(f"[CoinAttributeCalculator] Updated: {updated}, Failed: {failed}")

    def get_filtered_coins(self, allowed_trends: Optional[List[str]] = None,
                          min_volatility: Optional[float] = None,
                          max_volatility: Optional[float] = None) -> List[str]:
        """
        Get coins matching filter criteria

        Args:
            allowed_trends: List of allowed trend types
            min_volatility: Minimum volatility percentage
            max_volatility: Maximum volatility percentage

        Returns:
            List[str]: Filtered coin symbols
        """
        allowed_trends = allowed_trends or strategy_config.ALLOWED_TRENDS
        min_volatility = min_volatility or strategy_config.MIN_VOLATILITY_PERCENT
        max_volatility = max_volatility or strategy_config.MAX_VOLATILITY_PERCENT

        # Get all coin attributes
        all_attributes = self.redis_manager.get_all_coin_attributes()

        filtered_coins = []

        for coin_symbol, attributes in all_attributes.items():
            # Check trend type
            trend_type = attributes.get('trend_type', '')
            if trend_type not in allowed_trends:
                continue

            # Check volatility
            volatility = float(attributes.get('24h_volatility_percent', 0))
            if volatility < min_volatility or volatility > max_volatility:
                continue

            # Passed all filters
            filtered_coins.append(coin_symbol)

        return filtered_coins


# Global instance
_global_calculator = None


def get_coin_attribute_calculator() -> CoinAttributeCalculator:
    """
    Get global calculator instance

    Returns:
        CoinAttributeCalculator: Global instance
    """
    global _global_calculator

    if _global_calculator is None:
        _global_calculator = CoinAttributeCalculator()

    return _global_calculator
