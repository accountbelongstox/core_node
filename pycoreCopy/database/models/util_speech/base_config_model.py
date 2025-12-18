#!/usr/bin/env python3
"""
Speech configuration base model.

Implements generic key-value storage for speech modules (TTS or STT).
Subclasses supply metadata such as table names and TableKeys.
"""

import json
from datetime import datetime
from typing import Any, Dict, Optional

from pycore.pyfoundations.color_print import ColorPrint
from pycore.database.base_model import BaseModel


class SpeechConfigBaseModel(BaseModel):
    """Shared key-value configuration table."""

    KEY_FIELD = "key"
    VALUE_FIELD = "value"
    VALUE_TYPE_FIELD = "value_type"
    DESCRIPTION_FIELD = "description"
    CREATED_AT_FIELD = "created_at"
    UPDATED_AT_FIELD = "updated_at"

    @classmethod
    def get_config(cls, conn, key: str) -> Optional[Any]:
        """Fetch a config value with JSON deserialization support."""
        result = cls.select_one(conn, where={cls.KEY_FIELD: key})
        if not result:
            return None

        value = result[cls.VALUE_FIELD]
        value_type = result.get(cls.VALUE_TYPE_FIELD, "string")

        if value_type == "string":
            return value

        try:
            return json.loads(value)
        except json.JSONDecodeError:
            ColorPrint.yellow(f"[{cls.__name__}] Failed to deserialize {key}, returning raw value")
            return value

    @classmethod
    def set_config(cls, conn, key: str, value: Any, description: Optional[str] = None):
        """Insert or update a configuration value."""
        value_type, value_str = cls._serialize_value(value)
        existing = cls.select_one(conn, where={cls.KEY_FIELD: key})
        timestamp = datetime.utcnow()

        if existing:
            update_data = {
                cls.VALUE_FIELD: value_str,
                cls.VALUE_TYPE_FIELD: value_type,
                cls.UPDATED_AT_FIELD: timestamp,
            }
            if description is not None:
                update_data[cls.DESCRIPTION_FIELD] = description
            cls.update(conn, update_data, where={cls.KEY_FIELD: key})
            ColorPrint.blue(f"[{cls.__name__}] Updated: {key} = {value}")
        else:
            insert_data = {
                cls.KEY_FIELD: key,
                cls.VALUE_FIELD: value_str,
                cls.VALUE_TYPE_FIELD: value_type,
                cls.DESCRIPTION_FIELD: description,
                cls.CREATED_AT_FIELD: timestamp,
                cls.UPDATED_AT_FIELD: timestamp,
            }
            cls.insert(conn, insert_data)
            ColorPrint.green(f"[{cls.__name__}] Created: {key} = {value}")

    @classmethod
    def delete_config(cls, conn, key: str) -> int:
        """Remove a configuration entry."""
        count = cls.delete(conn, where={cls.KEY_FIELD: key})
        if count > 0:
            ColorPrint.yellow(f"[{cls.__name__}] Deleted: {key}")
        return count

    @classmethod
    def get_all_configs(cls, conn) -> Dict[str, Any]:
        """Return all configuration entries as a dict."""
        configs: Dict[str, Any] = {}
        for record in cls.select(conn):
            key = record[cls.KEY_FIELD]
            value = record[cls.VALUE_FIELD]
            value_type = record.get(cls.VALUE_TYPE_FIELD, "string")

            if value_type == "string":
                configs[key] = value
            else:
                try:
                    configs[key] = json.loads(value)
                except json.JSONDecodeError:
                    configs[key] = value
        return configs

    @classmethod
    def key_exists(cls, conn, key: str) -> bool:
        """Check if a configuration key exists."""
        result = cls.select_one(conn, where={cls.KEY_FIELD: key})
        return result is not None

    @staticmethod
    def _serialize_value(value: Any) -> (str, str):
        """Helper to determine value type and JSON representation."""
        if isinstance(value, str):
            return "string", value
        if isinstance(value, bool):
            return "bool", json.dumps(value)
        if isinstance(value, int):
            return "int", json.dumps(value)
        if isinstance(value, list):
            return "list", json.dumps(value)
        if isinstance(value, dict):
            return "dict", json.dumps(value)
        return "string", str(value)
