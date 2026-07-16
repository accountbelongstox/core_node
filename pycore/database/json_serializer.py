#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database JSON Serialization Utilities

Provides robust JSON serialization for database query results,
handling datetime, Decimal, and other non-JSON-native types.
"""

import json
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Union
from pathlib import Path

import base64



class DatabaseJSONEncoder(json.JSONEncoder):
    """
    Custom JSON Encoder for database query results

    Handles:
    - datetime, date, time objects → ISO format strings
    - Decimal → float
    - bytes → base64 string
    - Path → string
    - set, frozenset → list
    - Custom objects with __dict__ → dict
    """

    def default(self, obj: Any) -> Any:
        """
        Convert non-JSON-serializable objects to JSON-serializable types

        Args:
            obj: Object to serialize

        Returns:
            JSON-serializable representation
        """
        # Datetime types
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, date):
            return obj.isoformat()
        elif isinstance(obj, time):
            return obj.isoformat()
        elif isinstance(obj, timedelta):
            return obj.total_seconds()

        # Numeric types
        elif isinstance(obj, Decimal):
            return float(obj)

        # Binary types
        elif isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')

        # Path types
        elif isinstance(obj, Path):
            return str(obj)

        # Collection types
        elif isinstance(obj, (set, frozenset)):
            return list(obj)

        # SQLAlchemy Row objects (from queries)
        elif hasattr(obj, '_mapping'):
            return dict(obj._mapping)

        # Custom objects with __dict__
        elif hasattr(obj, '__dict__'):
            return obj.__dict__

        # Fallback to default encoder
        return super().default(obj)


def serialize_row(row: Any) -> Dict[str, Any]:
    """
    Serialize a SQLAlchemy Row object to a JSON-serializable dict

    Args:
        row: SQLAlchemy Row object or dict

    Returns:
        JSON-serializable dictionary
    """
    if row is None:
        return None

    # If already a dict, process values
    if isinstance(row, dict):
        result = {}
        for key, value in row.items():
            result[key] = serialize_value(value)
        return result

    # SQLAlchemy Row object
    if hasattr(row, '_mapping'):
        result = {}
        for key, value in row._mapping.items():
            result[key] = serialize_value(value)
        return result

    # Fallback: try to convert to dict
    try:
        return dict(row)
    except (TypeError, ValueError):
        return str(row)


def serialize_value(value: Any) -> Any:
    """
    Serialize a single value to JSON-serializable type

    Args:
        value: Value to serialize

    Returns:
        JSON-serializable value
    """
    if value is None:
        return None

    # Datetime types
    if isinstance(value, datetime):
        return value.isoformat()
    elif isinstance(value, date):
        return value.isoformat()
    elif isinstance(value, time):
        return value.isoformat()
    elif isinstance(value, timedelta):
        return value.total_seconds()

    # Numeric types
    elif isinstance(value, Decimal):
        return float(value)

    # Binary types
    elif isinstance(value, bytes):
        return base64.b64encode(value).decode('utf-8')

    # Path types
    elif isinstance(value, Path):
        return str(value)

    # Collection types
    elif isinstance(value, (set, frozenset)):
        return list(value)

    # Already JSON-serializable
    elif isinstance(value, (str, int, float, bool, list, dict)):
        return value

    # Fallback to string
    else:
        return str(value)


def serialize_rows(rows: List[Any]) -> List[Dict[str, Any]]:
    """
    Serialize a list of SQLAlchemy Row objects

    Args:
        rows: List of SQLAlchemy Row objects

    Returns:
        List of JSON-serializable dictionaries
    """
    if not rows:
        return []

    return [serialize_row(row) for row in rows]


def to_json(obj: Any, **kwargs) -> str:
    """
    Convert object to JSON string using DatabaseJSONEncoder

    Args:
        obj: Object to serialize
        **kwargs: Additional arguments for json.dumps

    Returns:
        JSON string
    """
    # Set default kwargs
    default_kwargs = {
        'cls': DatabaseJSONEncoder,
        'ensure_ascii': False,
        'indent': None
    }
    default_kwargs.update(kwargs)

    return json.dumps(obj, **default_kwargs)


def to_json_pretty(obj: Any, **kwargs) -> str:
    """
    Convert object to pretty-printed JSON string

    Args:
        obj: Object to serialize
        **kwargs: Additional arguments for json.dumps

    Returns:
        Pretty-printed JSON string
    """
    kwargs['indent'] = kwargs.get('indent', 2)
    return to_json(obj, **kwargs)


# Convenience functions for common use cases

def serialize_query_result(result: Union[Dict, List, Any]) -> Union[Dict, List, None]:
    """
    Serialize any database query result to JSON-serializable format

    Handles:
    - Single row (dict or Row object)
    - Multiple rows (list)
    - Scalar values

    Args:
        result: Query result

    Returns:
        JSON-serializable result
    """
    if result is None:
        return None

    # List of rows
    if isinstance(result, list):
        return serialize_rows(result)

    # Single row
    elif isinstance(result, dict) or hasattr(result, '_mapping'):
        return serialize_row(result)

    # Scalar value
    else:
        return serialize_value(result)


__all__ = [
    'DatabaseJSONEncoder',
    'serialize_row',
    'serialize_rows',
    'serialize_value',
    'serialize_query_result',
    'to_json',
    'to_json_pretty'
]
