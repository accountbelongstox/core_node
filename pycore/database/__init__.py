#!/usr/bin/env python3
"""
Database - Core database management module

Independent module with NO dependencies on pyutils (avoid circular imports)
Only depends on: pygvar, pyfoundations

Exports:
- database_manager: Singleton DatabaseManager instance
- BaseModel: Base class for all table models
- DATABASE_AVAILABLE: Flag indicating if database module is available
"""

from pycore.pyfoundations.color_print import ColorPrint

# Check if database dependencies are available
DATABASE_AVAILABLE = False

try:
    from pycore.pyfoundations.third_party import get_third_package_sqlalchemy
    sqlalchemy = get_third_package_sqlalchemy()

    # Import core components
    from pycore.database.base_model import BaseModel
    from pycore.database.database_manager import database_manager

    DATABASE_AVAILABLE = True
    ColorPrint.green("[database] Database module loaded successfully")

except ImportError as e:
    ColorPrint.yellow(f"[database] Database module not available: {e}")
    ColorPrint.yellow("[database] Install SQLAlchemy to use database features")

    # Create placeholder for imports
    BaseModel = None
    database_manager = None


# Export main interfaces
__all__ = [
    'database_manager',
    'BaseModel',
    'DATABASE_AVAILABLE',
]
