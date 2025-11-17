#!/usr/bin/env python3
"""
TableRegistry - Manages loaded table models
Tracks which tables are loaded and provides access to them
"""

from typing import Dict, Type, Optional, List
from pycore.pyfoundations.color_print import ColorPrint


class TableRegistry:
    """
    Registry for loaded table models
    Tracks table_key -> model_class mappings
    """

    def __init__(self):
        self.loaded_tables: Dict[str, Type] = {}  # table_key -> model class
        ColorPrint.blue("[TableRegistry] Initialized")

    def register_table(self, table_key: str, model_class: Type):
        """
        Register a table model

        Args:
            table_key: Table key (e.g., "app_myapp.users")
            model_class: Model class (e.g., MyAppUserModel)
        """
        if table_key in self.loaded_tables:
            ColorPrint.yellow(f"[TableRegistry] Table already registered: {table_key}")
            return

        self.loaded_tables[table_key] = model_class
        ColorPrint.green(f"[TableRegistry] Registered table: {table_key} -> {model_class.__name__}")

    def get_table(self, table_key: str) -> Type:
        """
        Get table model class by table key

        Args:
            table_key: Table key (e.g., "app_myapp.users")

        Returns:
            Model class

        Raises:
            RuntimeError if table not registered
        """
        if table_key not in self.loaded_tables:
            raise RuntimeError(
                f"Table '{table_key}' not loaded. "
                f"Call database_manager.load_tables() first to load this table. "
                f"Available tables: {list(self.loaded_tables.keys())}"
            )

        return self.loaded_tables[table_key]

    def is_table_loaded(self, table_key: str) -> bool:
        """Check if table is loaded"""
        return table_key in self.loaded_tables

    def get_loaded_tables(self) -> List[str]:
        """Get list of loaded table keys"""
        return list(self.loaded_tables.keys())

    def get_loaded_table_count(self) -> int:
        """Get count of loaded tables"""
        return len(self.loaded_tables)

    def clear(self):
        """Clear all registered tables"""
        self.loaded_tables.clear()
        ColorPrint.blue("[TableRegistry] Cleared all tables")
