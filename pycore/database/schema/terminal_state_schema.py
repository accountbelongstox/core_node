# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


TERMINAL_STATE_TABLE = TableKeys.get_full_table_name(TableKeys.TERMINAL_STATE)


def init_terminal_state_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TERMINAL_STATE_TABLE} (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )


__all__ = ["TERMINAL_STATE_TABLE", "init_terminal_state_schema"]
