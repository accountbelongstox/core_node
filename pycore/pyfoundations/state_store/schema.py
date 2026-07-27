# -*- coding: utf-8 -*-
"""DEPRECATED shim — use pycore.database.schema.state_schema."""
from pycore.database.schema.state_schema import SCHEMA_VERSION, init_schema

__all__ = ["init_schema", "SCHEMA_VERSION"]
