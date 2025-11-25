#!/usr/bin/env python3
"""
Dynamic Table Registry for OKX Price Monitor
Manages dynamic table keys for cryptocurrency price history

Since cryptocurrency symbols are dynamic and numerous, we need a runtime
table key management system instead of hardcoding all possible coin tables.
"""

from typing import Dict, Set, Optional
from pycore.database.models.namespaces import TableNamespaces


class OKXDynamicTableRegistry:
    """
    Dynamic table key registry for OKX cryptocurrency price history

    Features:
    - Runtime table key generation
    - Table key normalization (coin symbol -> table key)
    - Table key cache for performance
    - Namespace-aware key generation

    Format: app_okx.{coin_symbol}_history
    Example: app_okx.btc_history, app_okx.eth_history
    """

    _table_key_cache: Dict[str, str] = {}
    _registered_coins: Set[str] = set()

    @classmethod
    def normalize_coin_symbol(cls, coin_symbol: str) -> str:
        """
        Normalize coin symbol for use in table names

        Args:
            coin_symbol: Coin symbol (e.g., "BTC", "ETH", "BTC-USDT")

        Returns:
            Normalized symbol (e.g., "btc", "eth", "btc_usdt")
        """
        return coin_symbol.lower().replace('-', '_').replace('/', '_')

    @classmethod
    def generate_table_key(cls, coin_symbol: str) -> str:
        """
        Generate table key for a coin's price history

        Args:
            coin_symbol: Coin symbol (e.g., "BTC", "ETH")

        Returns:
            Table key (e.g., "app_okx.btc_history")
        """
        normalized = cls.normalize_coin_symbol(coin_symbol)

        # Check cache first
        if normalized in cls._table_key_cache:
            return cls._table_key_cache[normalized]

        # Generate new table key
        table_key = f"{TableNamespaces.APP_OKX}.{normalized}_history"

        # Cache for future use
        cls._table_key_cache[normalized] = table_key
        cls._registered_coins.add(normalized)

        return table_key

    @classmethod
    def generate_table_name(cls, coin_symbol: str) -> str:
        """
        Generate table name (without namespace prefix)

        Args:
            coin_symbol: Coin symbol

        Returns:
            Table name (e.g., "btc_history")
        """
        normalized = cls.normalize_coin_symbol(coin_symbol)
        return f"{normalized}_history"

    @classmethod
    def generate_full_table_name(cls, coin_symbol: str) -> str:
        """
        Generate full table name for database

        Args:
            coin_symbol: Coin symbol

        Returns:
            Full table name (e.g., "app_okx_btc_history")
        """
        table_key = cls.generate_table_key(coin_symbol)
        return table_key.replace('.', '_')

    @classmethod
    def is_coin_registered(cls, coin_symbol: str) -> bool:
        """
        Check if coin table key is registered

        Args:
            coin_symbol: Coin symbol

        Returns:
            True if registered, False otherwise
        """
        normalized = cls.normalize_coin_symbol(coin_symbol)
        return normalized in cls._registered_coins

    @classmethod
    def get_all_registered_coins(cls) -> Set[str]:
        """
        Get all registered coin symbols (normalized)

        Returns:
            Set of normalized coin symbols
        """
        return cls._registered_coins.copy()

    @classmethod
    def get_all_table_keys(cls) -> Dict[str, str]:
        """
        Get all cached table keys

        Returns:
            Dictionary mapping normalized coin symbols to table keys
        """
        return cls._table_key_cache.copy()

    @classmethod
    def clear_cache(cls):
        """
        Clear the table key cache (for testing or reset)
        """
        cls._table_key_cache.clear()
        cls._registered_coins.clear()

    @classmethod
    def register_coin(cls, coin_symbol: str) -> str:
        """
        Explicitly register a coin and return its table key

        Args:
            coin_symbol: Coin symbol to register

        Returns:
            Generated table key
        """
        return cls.generate_table_key(coin_symbol)

    @classmethod
    def register_coins_batch(cls, coin_symbols: list) -> Dict[str, str]:
        """
        Register multiple coins in batch

        Args:
            coin_symbols: List of coin symbols

        Returns:
            Dictionary mapping coin symbols to table keys
        """
        result = {}
        for symbol in coin_symbols:
            result[symbol] = cls.register_coin(symbol)
        return result
