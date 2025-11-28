#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Redis Cache Manager - High-Performance In-Memory Cache
Redis缓存管理器 - 高性能内存缓存

Features:
- Store price data in Redis for fast access
- Store calculated coin attributes (24h analysis)
- Store virtual positions for backtesting
- Automatic TTL management
- Batch operations for efficiency
"""

import json
import time
from typing import List, Dict, Optional, Any
from pyapps.okx_price_monitor.core.strategy_config import strategy_config

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("[WARNING] redis-py not installed. Run: pip install redis")


class RedisManager:
    """
    Redis Cache Manager

    Manages Redis cache for price data, coin attributes, and positions.
    """

    def __init__(self, host: str = None, port: int = None, db: int = None, password: str = None):
        """
        Initialize Redis manager

        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
            password: Redis password (optional)
        """
        if not REDIS_AVAILABLE:
            raise ImportError("redis-py not installed. Run: pip install redis")

        self.host = host or strategy_config.REDIS_HOST
        self.port = port or strategy_config.REDIS_PORT
        self.db = db or strategy_config.REDIS_DB
        self.password = password or strategy_config.REDIS_PASSWORD

        # Connect to Redis with timeout
        import sys
        print(f"[RedisManager] Connecting to Redis at {self.host}:{self.port}...")
        sys.stdout.flush()

        self.client = redis.Redis(
            host=self.host,
            port=self.port,
            db=self.db,
            password=self.password,
            decode_responses=True,  # Auto-decode bytes to strings
            socket_connect_timeout=5,  # 5 second connection timeout
            socket_timeout=5  # 5 second operation timeout
        )

        # Test connection
        try:
            print(f"[RedisManager] Testing Redis connection (timeout: 5s)...")
            sys.stdout.flush()
            self.client.ping()
            print(f"[RedisManager] ✓ Connected to Redis at {self.host}:{self.port} (DB {self.db})")
            sys.stdout.flush()
        except redis.ConnectionError as e:
            print(f"[RedisManager] ✗ Failed to connect to Redis: {e}")
            print(f"[RedisManager] Please start Redis server:")
            print(f"[RedisManager]   Windows: redis-server.exe")
            print(f"[RedisManager]   Linux/Mac: redis-server")
            sys.stdout.flush()
            raise
        except Exception as e:
            print(f"[RedisManager] ✗ Unexpected error: {e}")
            sys.stdout.flush()
            raise

        # Statistics
        self.stats = {
            'reads': 0,
            'writes': 0,
            'deletes': 0,
        }

    # ==================== Price Data Methods ====================

    def set_price(self, coin_symbol: str, price_data: Dict, ttl: Optional[int] = None):
        """
        Store price data for a coin

        Args:
            coin_symbol: Coin symbol
            price_data: Price data dictionary (timestamp_ms, open, high, low, close, etc.)
            ttl: Time to live in seconds (default from config)
        """
        key = f"{strategy_config.REDIS_PREFIX_PRICE}{coin_symbol}"
        ttl = ttl or strategy_config.REDIS_TTL_PRICE

        # Store as JSON
        value = json.dumps(price_data)
        self.client.setex(key, ttl, value)

        self.stats['writes'] += 1

    def get_price(self, coin_symbol: str) -> Optional[Dict]:
        """
        Get latest price data for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[Dict]: Price data or None
        """
        key = f"{strategy_config.REDIS_PREFIX_PRICE}{coin_symbol}"
        value = self.client.get(key)

        self.stats['reads'] += 1

        if value:
            return json.loads(value)
        return None

    def append_price_history(self, coin_symbol: str, price_data: Dict, max_length: int = None):
        """
        Append price data to a time-series list (sorted set by timestamp)

        Args:
            coin_symbol: Coin symbol
            price_data: Price data with timestamp_ms
            max_length: Maximum number of data points to keep
        """
        key = f"{strategy_config.REDIS_PREFIX_PRICE}{coin_symbol}:history"
        max_length = max_length or strategy_config.REDIS_MAX_DATAPOINTS_PER_COIN

        timestamp_ms = price_data.get('timestamp_ms', int(time.time() * 1000))

        # Use sorted set (score = timestamp)
        self.client.zadd(key, {json.dumps(price_data): timestamp_ms})

        # Trim to max length (keep most recent)
        total_count = self.client.zcard(key)
        if total_count > max_length:
            # Remove oldest entries
            remove_count = total_count - max_length
            self.client.zremrangebyrank(key, 0, remove_count - 1)

        # Set TTL
        self.client.expire(key, strategy_config.REDIS_TTL_PRICE)

        self.stats['writes'] += 1

    def get_price_history(self, coin_symbol: str, start_time_ms: Optional[int] = None,
                         end_time_ms: Optional[int] = None, limit: int = 1000) -> List[Dict]:
        """
        Get price history for a coin

        Args:
            coin_symbol: Coin symbol
            start_time_ms: Start timestamp (optional)
            end_time_ms: End timestamp (optional)
            limit: Maximum records to return

        Returns:
            List[Dict]: Price history (newest first)
        """
        key = f"{strategy_config.REDIS_PREFIX_PRICE}{coin_symbol}:history"

        # Get from sorted set
        if start_time_ms and end_time_ms:
            # Range query
            records = self.client.zrangebyscore(
                key, start_time_ms, end_time_ms, start=0, num=limit
            )
        else:
            # Get latest N records
            records = self.client.zrevrange(key, 0, limit - 1)

        self.stats['reads'] += 1

        # Parse JSON records
        result = []
        for record in records:
            try:
                result.append(json.loads(record))
            except json.JSONDecodeError:
                continue

        return result

    # ==================== Coin Attribute Methods ====================

    def set_coin_attributes(self, coin_symbol: str, attributes: Dict, ttl: Optional[int] = None):
        """
        Store calculated coin attributes (24h analysis)

        Args:
            coin_symbol: Coin symbol
            attributes: Attribute dictionary
            ttl: Time to live in seconds
        """
        key = f"{strategy_config.REDIS_PREFIX_ATTR}{coin_symbol}"
        ttl = ttl or strategy_config.REDIS_TTL_ATTR

        # Store as hash for efficient field updates
        self.client.hset(key, mapping=attributes)
        self.client.expire(key, ttl)

        self.stats['writes'] += 1

    def get_coin_attributes(self, coin_symbol: str) -> Optional[Dict]:
        """
        Get coin attributes

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[Dict]: Attributes or None
        """
        key = f"{strategy_config.REDIS_PREFIX_ATTR}{coin_symbol}"
        attributes = self.client.hgetall(key)

        self.stats['reads'] += 1

        return attributes if attributes else None

    def get_all_coin_attributes(self) -> Dict[str, Dict]:
        """
        Get attributes for all coins

        Returns:
            Dict[str, Dict]: {coin_symbol: attributes}
        """
        pattern = f"{strategy_config.REDIS_PREFIX_ATTR}*"
        keys = self.client.keys(pattern)

        result = {}
        for key in keys:
            coin_symbol = key.replace(strategy_config.REDIS_PREFIX_ATTR, '')
            attributes = self.client.hgetall(key)
            if attributes:
                result[coin_symbol] = attributes

        self.stats['reads'] += len(keys)

        return result

    # ==================== Virtual Position Methods ====================

    def set_position(self, coin_symbol: str, position_data: Dict):
        """
        Store virtual position for backtesting

        Args:
            coin_symbol: Coin symbol
            position_data: Position data (entry_price, entry_time, size, etc.)
        """
        key = f"{strategy_config.REDIS_PREFIX_POSITION}{coin_symbol}"

        # Store as hash
        self.client.hset(key, mapping=position_data)

        self.stats['writes'] += 1

    def get_position(self, coin_symbol: str) -> Optional[Dict]:
        """
        Get virtual position

        Args:
            coin_symbol: Coin symbol

        Returns:
            Optional[Dict]: Position data or None
        """
        key = f"{strategy_config.REDIS_PREFIX_POSITION}{coin_symbol}"
        position = self.client.hgetall(key)

        self.stats['reads'] += 1

        return position if position else None

    def delete_position(self, coin_symbol: str):
        """
        Delete virtual position (on close)

        Args:
            coin_symbol: Coin symbol
        """
        key = f"{strategy_config.REDIS_PREFIX_POSITION}{coin_symbol}"
        self.client.delete(key)

        self.stats['deletes'] += 1

    def get_all_positions(self) -> Dict[str, Dict]:
        """
        Get all active virtual positions

        Returns:
            Dict[str, Dict]: {coin_symbol: position_data}
        """
        pattern = f"{strategy_config.REDIS_PREFIX_POSITION}*"
        keys = self.client.keys(pattern)

        result = {}
        for key in keys:
            coin_symbol = key.replace(strategy_config.REDIS_PREFIX_POSITION, '')
            position = self.client.hgetall(key)
            if position:
                result[coin_symbol] = position

        self.stats['reads'] += len(keys)

        return result

    # ==================== Utility Methods ====================

    def get_all_coins(self) -> List[str]:
        """
        Get all coins with price history

        Returns:
            List[str]: List of coin symbols
        """
        pattern = f"{strategy_config.REDIS_PREFIX_PRICE}*:history"
        keys = self.client.keys(pattern)

        coins = []
        for key in keys:
            # Extract coin symbol from key
            coin_symbol = key.replace(strategy_config.REDIS_PREFIX_PRICE, '').replace(':history', '')
            coins.append(coin_symbol)

        return coins

    def flush_all(self):
        """Flush all data in current database (use with caution!)"""
        self.client.flushdb()
        print("[RedisManager] Flushed all data")

    def get_stats(self) -> Dict:
        """Get Redis statistics"""
        info = self.client.info('stats')
        memory_info = self.client.info('memory')

        return {
            **self.stats,
            'total_keys': self.client.dbsize(),
            'used_memory_mb': memory_info.get('used_memory', 0) / 1024 / 1024,
            'total_commands': info.get('total_commands_processed', 0),
        }

    def close(self):
        """Close Redis connection"""
        self.client.close()
        print("[RedisManager] Connection closed")


# Global instance
_global_redis_manager = None


def get_redis_manager() -> RedisManager:
    """
    Get global Redis manager instance

    Returns:
        RedisManager: Global instance
    """
    global _global_redis_manager

    if _global_redis_manager is None:
        print("[get_redis_manager] Creating Redis manager instance...")
        _global_redis_manager = RedisManager()

    return _global_redis_manager
