#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKX Price Monitor Database Models

Database models for storing cryptocurrency price trends.
"""

from datetime import datetime
from pycore.database import get_db, BaseModel, Column, String, Float, Integer, DateTime, JSON


class CoinPriceTrend(BaseModel):
    """
    Coin price trend model

    Stores price data points for each cryptocurrency.
    """
    __tablename__ = 'okx_coin_price_trends'

    currency = Column(String(50), nullable=False, index=True)
    timestamp = Column(Integer, nullable=False, index=True)  # Unix timestamp in milliseconds
    price = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Composite index for efficient queries
    __table_args__ = (
        {'mysql_engine': 'InnoDB', 'mysql_charset': 'utf8mb4'},
    )

    @classmethod
    def bulk_insert(cls, coin_data_list):
        """
        Bulk insert coin price data

        Args:
            coin_data_list (list): List of dicts with keys: currency, timestamp, price

        Returns:
            int: Number of records inserted
        """
        if not coin_data_list:
            return 0

        db = get_db()
        records = []

        for data in coin_data_list:
            record = cls(
                currency=data['currency'],
                timestamp=data['timestamp'],
                price=data['price']
            )
            records.append(record)

        db.session.bulk_save_objects(records)
        db.session.commit()

        return len(records)

    @classmethod
    def get_recent_history(cls, currency, hours=3):
        """
        Get recent price history for a currency

        Args:
            currency (str): Currency symbol
            hours (int): Number of hours to look back

        Returns:
            list: List of CoinPriceTrend objects
        """
        from datetime import timedelta

        db = get_db()
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        cutoff_timestamp = int(cutoff_time.timestamp() * 1000)

        return db.session.query(cls).filter(
            cls.currency == currency,
            cls.timestamp >= cutoff_timestamp
        ).order_by(cls.timestamp.asc()).all()

    @classmethod
    def get_all_currencies_recent_history(cls, hours=3):
        """
        Get recent price history for all currencies

        Args:
            hours (int): Number of hours to look back

        Returns:
            dict: Dict with currency as key, list of records as value
        """
        from datetime import timedelta

        db = get_db()
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        cutoff_timestamp = int(cutoff_time.timestamp() * 1000)

        records = db.session.query(cls).filter(
            cls.timestamp >= cutoff_timestamp
        ).order_by(cls.currency.asc(), cls.timestamp.asc()).all()

        # Group by currency
        result = {}
        for record in records:
            if record.currency not in result:
                result[record.currency] = []
            result[record.currency].append(record)

        return result

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'currency': self.currency,
            'timestamp': self.timestamp,
            'price': self.price,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def init_database():
    """Initialize database tables"""
    db = get_db()
    BaseModel.metadata.create_all(db.engine)
