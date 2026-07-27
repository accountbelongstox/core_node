#!/usr/bin/env python3
from pycore.pyfoundations.third_party import get_third_package_sqlalchemy
from pycore.database.base_model import BaseModel
from pycore.database.database_manager import database_manager, get_database_manager
from pycore.database.type_converter import (
from pycore.database.json_serializer import (
"""
Database - Core database management module

Independent module with NO dependencies on pyutils (avoid circular imports)
Only depends on: pygvar, pyfoundations

Exports:
- database_manager: Singleton DatabaseManager instance
- BaseModel: Base class for all table models
- DATABASE_AVAILABLE: Flag indicating if database module is available
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint as _OriginalColorPrint

# Suppress ColorPrint output in MCP mode
class ColorPrint:
    _is_mcp = _OriginalColorPrint.is_mcp_mode()
    @staticmethod
    def blue(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.blue(msg)
    @staticmethod
    def red(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.red(msg)
    @staticmethod
    def green(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.green(msg)
    @staticmethod
    def yellow(msg):
        if not ColorPrint._is_mcp: _OriginalColorPrint.yellow(msg)

# Check if database dependencies are available
DATABASE_AVAILABLE = False

try:
    sqlalchemy = get_third_package_sqlalchemy()

    # Import core components
        DatabaseTypeConverter,
        to_db,
        to_db_dict,
        from_db,
        from_db_dict
    )
        DatabaseJSONEncoder,
        serialize_row,
        serialize_rows,
        serialize_query_result,
        to_json,
        to_json_pretty
    )

    DATABASE_AVAILABLE = True
    ColorPrint.green("[database] Database module loaded successfully")

except ImportError as e:
    ColorPrint.yellow(f"[database] Database module not available: {e}")
    ColorPrint.yellow("[database] Install SQLAlchemy to use database features")

    # Create placeholder for imports
    BaseModel = None
    database_manager = None
    get_database_manager = None
    DatabaseTypeConverter = None
    to_db = None
    to_db_dict = None
    from_db = None
    from_db_dict = None
    DatabaseJSONEncoder = None
    serialize_row = None
    serialize_rows = None
    serialize_query_result = None
    to_json = None
    to_json_pretty = None


# Export main interfaces
__all__ = [
    'database_manager',
    'get_database_manager',
    'BaseModel',
    'DATABASE_AVAILABLE',
    'DatabaseTypeConverter',
    'to_db',
    'to_db_dict',
    'from_db',
    'from_db_dict',
    'DatabaseJSONEncoder',
    'serialize_row',
    'serialize_rows',
    'serialize_query_result',
    'to_json',
    'to_json_pretty',
]
