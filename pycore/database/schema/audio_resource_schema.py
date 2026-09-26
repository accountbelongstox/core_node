# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


AUDIO_RESOURCES_TABLE = TableKeys.get_full_table_name(TableKeys.SPEECH_AUDIO_RESOURCES)


def init_audio_resource_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {AUDIO_RESOURCES_TABLE} (
            kind TEXT NOT NULL,
            resource_key TEXT NOT NULL,
            language TEXT NOT NULL,
            variant TEXT NOT NULL DEFAULT '',
            text TEXT NOT NULL,
            path TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT '',
            recorded_at REAL NOT NULL,
            PRIMARY KEY (kind, resource_key)
        ) WITHOUT ROWID
        """
    )


__all__ = ["AUDIO_RESOURCES_TABLE", "init_audio_resource_schema"]
