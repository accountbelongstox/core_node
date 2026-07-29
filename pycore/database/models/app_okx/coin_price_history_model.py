#!/usr/bin/env python3
"""
OKX Coin Price History Model - Dynamic Table Factory
Creates dynamic models for each cryptocurrency's price history
"""

from typing import Optional, List, Dict, Any, Type
from datetime import datetime

from pycore.pyfoundations.third_party.api import get_third_package_sqlalchemy

sqlalchemy = get_third_package_sqlalchemy()
from pycore.database.base_model import BaseModel
from pycore.database.models.app_okx.dynamic_table_registry import OKXDynamicTableRegistry


class CoinPriceHistoryModelFactory:
    """
    Factory for creating dynamic coin price history models

    Each coin gets its own table dynamically at runtime
    """

    _model_cache: Dict[str, Type[BaseModel]] = {}

    @classmethod
    def create_model(cls, coin_symbol: str) -> Type[BaseModel]:
        """
        Create or retrieve a model class for a specific coin

        Args:
            coin_symbol: Coin symbol (e.g., "BTC", "ETH")

        Returns:
            Model class for the coin's price history
        """
        normalized = OKXDynamicTableRegistry.normalize_coin_symbol(coin_symbol)

        # Return cached model if exists
        if normalized in cls._model_cache:
            return cls._model_cache[normalized]

        # Generate table identifiers
        table_key = OKXDynamicTableRegistry.generate_table_key(coin_symbol)
        table_name = OKXDynamicTableRegistry.generate_table_name(coin_symbol)
        full_table_name = OKXDynamicTableRegistry.generate_full_table_name(coin_symbol)

        # Create dynamic model class
        class DynamicCoinPriceHistoryModel(BaseModel):
            """
            Dynamic price history model for a specific coin

            Schema:
                - id: Integer primary key (auto-increment)
                - timestamp: String - ISO timestamp
                - timestamp_ms: Integer - Timestamp in milliseconds (indexed)
                - price: Float - Current price
                - price_change_24h: Float - 24h price change percentage
                - volume_24h: Float - 24h trading volume
                - market_cap: Float - Market capitalization
                - raw_data: String - JSON string of additional data
                - created_at: String - Record creation timestamp
            """

            __table_key__ = table_key
            __namespace__ = "app_okx"
            __table_name__ = table_name
            __full_table_name__ = full_table_name
            __schema_version__ = 1

            # Store coin symbol for reference
            __coin_symbol__ = coin_symbol

            @classmethod
            def define_table_structure(cls, metadata):
                """
                Define table structure for coin price history

                Args:
                    metadata: SQLAlchemy metadata

                Returns:
                    SQLAlchemy Table object
                """
                return sqlalchemy.Table(
                    cls.__full_table_name__,
                    metadata,
                    sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True, autoincrement=True),
                    sqlalchemy.Column('timestamp', sqlalchemy.String(50), nullable=False),
                    sqlalchemy.Column('timestamp_ms', sqlalchemy.BigInteger, nullable=False, index=True),
                    sqlalchemy.Column('price', sqlalchemy.Float, nullable=False),
                    sqlalchemy.Column('price_change_24h', sqlalchemy.Float, nullable=True),
                    sqlalchemy.Column('volume_24h', sqlalchemy.Float, nullable=True),
                    sqlalchemy.Column('market_cap', sqlalchemy.Float, nullable=True),
                    sqlalchemy.Column('raw_data', sqlalchemy.Text, nullable=True),
                    sqlalchemy.Column('created_at', sqlalchemy.String(50), nullable=False),
                )

            # ===== Custom Methods =====

            @classmethod
            def insert_price_data(cls, conn, price_data: Dict[str, Any]) -> int:
                """
                Insert price data with auto-timestamp

                Args:
                    conn: Database connection
                    price_data: Dictionary with price information

                Returns:
                    Inserted row ID
                """
                timestamp_ms = price_data.get('timestamp_ms')
                if not timestamp_ms:
                    timestamp_ms = int(datetime.utcnow().timestamp() * 1000)

                timestamp_str = price_data.get('timestamp')
                if not timestamp_str:
                    timestamp_str = datetime.utcnow().isoformat()

                data = {
                    'timestamp': timestamp_str,
                    'timestamp_ms': timestamp_ms,
                    'price': price_data['price'],
                    'price_change_24h': price_data.get('price_change_24h'),
                    'volume_24h': price_data.get('volume_24h'),
                    'market_cap': price_data.get('market_cap'),
                    'raw_data': price_data.get('raw_data'),
                    'created_at': datetime.utcnow().isoformat()
                }

                return cls.insert(conn, data)

            @classmethod
            def get_latest_record(cls, conn) -> Optional[Dict[str, Any]]:
                """
                Get the most recent price record

                Args:
                    conn: Database connection

                Returns:
                    Latest price record or None
                """
                results = cls.select(
                    conn,
                    order_by=['timestamp_ms DESC'],
                    limit=1
                )
                return results[0] if results else None

            @classmethod
            def get_records_since(cls, conn, timestamp_ms: int, limit: int = 1000) -> List[Dict[str, Any]]:
                """
                Get records since a specific timestamp

                Args:
                    conn: Database connection
                    timestamp_ms: Starting timestamp in milliseconds
                    limit: Maximum records to return

                Returns:
                    List of price records
                """
                query = cls.__table__.select().where(
                    cls.__table__.c.timestamp_ms >= timestamp_ms
                ).order_by(cls.__table__.c.timestamp_ms.asc()).limit(limit)

                result = conn.execute(query)
                return [dict(row._mapping) for row in result]

            @classmethod
            def get_records_between(
                cls,
                conn,
                start_timestamp_ms: int,
                end_timestamp_ms: int,
                limit: int = 10000
            ) -> List[Dict[str, Any]]:
                """
                Get records between two timestamps

                Args:
                    conn: Database connection
                    start_timestamp_ms: Start timestamp in milliseconds
                    end_timestamp_ms: End timestamp in milliseconds
                    limit: Maximum records to return

                Returns:
                    List of price records
                """
                query = cls.__table__.select().where(
                    sqlalchemy.and_(
                        cls.__table__.c.timestamp_ms >= start_timestamp_ms,
                        cls.__table__.c.timestamp_ms <= end_timestamp_ms
                    )
                ).order_by(cls.__table__.c.timestamp_ms.asc()).limit(limit)

                result = conn.execute(query)
                return [dict(row._mapping) for row in result]

            @classmethod
            def get_last_n_records(cls, conn, n: int = 100) -> List[Dict[str, Any]]:
                """
                Get last N records (most recent)

                Args:
                    conn: Database connection
                    n: Number of records to retrieve

                Returns:
                    List of price records (newest first)
                """
                return cls.select(
                    conn,
                    order_by=['timestamp_ms DESC'],
                    limit=n
                )

            @classmethod
            def record_exists_at_timestamp(cls, conn, timestamp_ms: int) -> bool:
                """
                Check if record exists at specific timestamp

                Args:
                    conn: Database connection
                    timestamp_ms: Timestamp in milliseconds

                Returns:
                    True if record exists, False otherwise
                """
                return cls.count(conn, where={'timestamp_ms': timestamp_ms}) > 0

            @classmethod
            def delete_old_records(cls, conn, keep_hours: int = 24) -> int:
                """
                Delete records older than specified hours

                Args:
                    conn: Database connection
                    keep_hours: Number of hours to keep

                Returns:
                    Number of deleted records
                """
                cutoff_ms = int((datetime.utcnow().timestamp() - (keep_hours * 3600)) * 1000)

                query = cls.__table__.delete().where(
                    cls.__table__.c.timestamp_ms < cutoff_ms
                )

                result = conn.execute(query)
                conn.commit()
                return result.rowcount

        # Cache the model
        cls._model_cache[normalized] = DynamicCoinPriceHistoryModel

        return DynamicCoinPriceHistoryModel

    @classmethod
    def get_model(cls, coin_symbol: str) -> Optional[Type[BaseModel]]:
        """
        Get cached model for a coin

        Args:
            coin_symbol: Coin symbol

        Returns:
            Model class or None if not created yet
        """
        normalized = OKXDynamicTableRegistry.normalize_coin_symbol(coin_symbol)
        return cls._model_cache.get(normalized)

    @classmethod
    def clear_cache(cls):
        """
        Clear model cache (for testing)
        """
        cls._model_cache.clear()
