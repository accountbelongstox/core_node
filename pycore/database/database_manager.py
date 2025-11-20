#!/usr/bin/env python3
"""
DatabaseManager - Unified database manager
Manages database connections, table loading, and operations

Features:
- Register databases
- Load tables (auto-initialization)
- Get connections (from pool)
- Execute operations
- Transactions
"""

from typing import Dict, List, Type, Optional, Any, Callable
from pathlib import Path
from contextlib import contextmanager

from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyfoundations.color_print import ColorPrint as _OriginalColorPrint
from pycore.pyfoundations.third_party import get_third_package_sqlalchemy

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

sqlalchemy = get_third_package_sqlalchemy()

from pycore.database.table_registry import TableRegistry
from pycore.database.base_model import BaseModel


class DatabaseManager:
    """
    Unified database manager with auto-initialization and management

    Singleton pattern
    """

    def __init__(self):
        self.engines: Dict[str, Any] = {}  # database_name -> engine
        self.metadatas: Dict[str, sqlalchemy.MetaData] = {}  # database_name -> metadata
        self.table_registry = TableRegistry()
        self.connection_strings: Dict[str, str] = {}  # database_name -> connection_string

        ColorPrint.blue("[DatabaseManager] Initialized")

    def register_database(
        self,
        database_name: str = "default",
        connection_string: Optional[str] = None,
        **options
    ):
        """
        Register database (lazy connection - does not connect immediately)

        Args:
            database_name: Database identifier (e.g., "myapp", "cache")
            connection_string: SQLAlchemy connection string
                             If None, auto-creates SQLite in PYTOOLS_DATA_DIR
            **options: Additional SQLAlchemy engine options
                      (pool_size, max_overflow, echo, etc.)
        """
        if database_name in self.engines:
            ColorPrint.yellow(f"[DatabaseManager] Database already registered: {database_name}")
            return

        # Auto-generate SQLite connection string if not provided
        if connection_string is None:
            db_dir = map_web_path("www", "pycore_db")
            db_dir.mkdir(parents=True, exist_ok=True)
            db_path = db_dir / f"{database_name}.db"
            connection_string = f"sqlite:///{db_path}"

        # Store connection string (engine created lazily on first use)
        self.connection_strings[database_name] = connection_string

        ColorPrint.green(f"[DatabaseManager] Registered database: {database_name}")
        ColorPrint.blue(f"  Connection: {connection_string}")

    def _ensure_engine_created(self, database_name: str):
        """
        Ensure engine is created for database (lazy initialization)

        Args:
            database_name: Database identifier
        """
        if database_name in self.engines:
            return  # Already created

        if database_name not in self.connection_strings:
            raise RuntimeError(
                f"Database '{database_name}' not registered. "
                f"Call register_database() first."
            )

        connection_string = self.connection_strings[database_name]

        try:
            # Create engine with connection pooling
            engine = sqlalchemy.create_engine(
                connection_string,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,  # Verify connections before using
                pool_recycle=3600,   # Recycle connections after 1 hour
                echo=False           # Set to True for SQL logging
            )

            # Create metadata
            metadata = sqlalchemy.MetaData()

            self.engines[database_name] = engine
            self.metadatas[database_name] = metadata

            ColorPrint.green(f"[DatabaseManager] Created engine for database: {database_name}")

        except Exception as e:
            ColorPrint.red(f"[DatabaseManager] Failed to create engine for {database_name}: {e}")
            raise

    def load_tables(
        self,
        table_keys: List[str],
        models: List[Type[BaseModel]],
        database_name: str = "default"
    ):
        """
        Load tables (auto-initialization, auto-sync, auto-backup)

        Steps:
        1. Ensure engine is created
        2. For each model:
           - Call model.initialize() (auto-create table)
           - Register in table_registry

        Args:
            table_keys: List of table key constants (e.g., [TableKeys.MYAPP_USERS])
            models: List of model classes (e.g., [MyAppUserModel])
            database_name: Database to load into

        Raises:
            RuntimeError if database not registered
            ValueError if table_keys and models length mismatch
        """
        if len(table_keys) != len(models):
            raise ValueError(
                f"table_keys and models must have same length. "
                f"Got {len(table_keys)} keys and {len(models)} models."
            )

        # Ensure engine is created
        self._ensure_engine_created(database_name)

        engine = self.engines[database_name]
        metadata = self.metadatas[database_name]

        ColorPrint.blue(f"[DatabaseManager] Loading {len(models)} table(s) for database: {database_name}")

        for table_key, model_class in zip(table_keys, models):
            # Validate table key matches model
            if model_class.get_table_key() != table_key:
                ColorPrint.yellow(
                    f"[DatabaseManager] Warning: table_key '{table_key}' does not match "
                    f"model's __table_key__ '{model_class.get_table_key()}'"
                )

            # Initialize table (auto-create if not exists)
            model_class.initialize(engine, metadata)

            # Register in table registry
            self.table_registry.register_table(table_key, model_class)

        ColorPrint.green(
            f"[DatabaseManager] Loaded {len(models)} table(s). "
            f"Total loaded: {self.table_registry.get_loaded_table_count()}"
        )

    def get_table(self, table_key: str) -> Type[BaseModel]:
        """
        Get table model class

        Args:
            table_key: Table key constant (e.g., TableKeys.MYAPP_USERS)

        Returns:
            Model class (e.g., MyAppUserModel)

        Raises:
            RuntimeError if table not loaded

        Usage:
            users = database_manager.get_table(TableKeys.MYAPP_USERS)
            users.insert(conn, {"username": "alice"})
        """
        return self.table_registry.get_table(table_key)

    def is_table_loaded(self, table_key: str) -> bool:
        """Check if table is loaded"""
        return self.table_registry.is_table_loaded(table_key)

    def get_loaded_tables(self) -> List[str]:
        """Get list of loaded table keys"""
        return self.table_registry.get_loaded_tables()

    @contextmanager
    def get_connection(self, database_name: str = "default"):
        """
        Get database connection (context manager)

        Args:
            database_name: Database identifier

        Yields:
            Database connection

        Usage:
            with database_manager.get_connection("myapp") as conn:
                users = database_manager.get_table(TableKeys.MYAPP_USERS)
                users.insert(conn, {"username": "alice"})
        """
        if database_name not in self.engines:
            raise RuntimeError(
                f"Database '{database_name}' not initialized. "
                f"Call load_tables() first to initialize database."
            )

        engine = self.engines[database_name]
        conn = engine.connect()

        try:
            yield conn
        finally:
            conn.close()

    def execute_with_connection(
        self,
        operation: Callable,
        database_name: str = "default"
    ):
        """
        Execute operation with auto-managed connection

        Args:
            operation: Function that takes connection as argument
            database_name: Database identifier

        Returns:
            Result of operation

        Usage:
            def my_operation(conn):
                users = database_manager.get_table(TableKeys.MYAPP_USERS)
                return users.select(conn, where={"username": "alice"})

            result = database_manager.execute_with_connection(my_operation, "myapp")
        """
        with self.get_connection(database_name) as conn:
            return operation(conn)

    @contextmanager
    def transaction(self, database_name: str = "default"):
        """
        Get transaction context manager

        Auto-commit on success, auto-rollback on error

        Args:
            database_name: Database identifier

        Yields:
            Database connection with transaction

        Usage:
            with database_manager.transaction("myapp") as conn:
                users.insert(conn, {"username": "alice"})
                config.update(conn, {"value": "new"}, where={"key": "test"})
                # Auto-commit on success, auto-rollback on error
        """
        if database_name not in self.engines:
            raise RuntimeError(
                f"Database '{database_name}' not initialized. "
                f"Call load_tables() first to initialize database."
            )

        engine = self.engines[database_name]
        conn = engine.connect()
        trans = conn.begin()

        try:
            yield conn
            trans.commit()
            ColorPrint.green(f"[DatabaseManager] Transaction committed for {database_name}")
        except Exception as e:
            trans.rollback()
            ColorPrint.red(f"[DatabaseManager] Transaction rolled back for {database_name}: {e}")
            raise
        finally:
            conn.close()

    def get_database_info(self, database_name: str = "default") -> Dict[str, Any]:
        """
        Get database information

        Args:
            database_name: Database identifier

        Returns:
            Dictionary with database info
        """
        is_initialized = database_name in self.engines

        info = {
            "database_name": database_name,
            "is_registered": database_name in self.connection_strings,
            "is_initialized": is_initialized,
            "connection_string": self.connection_strings.get(database_name, None)
        }

        if is_initialized:
            info["loaded_tables"] = [
                key for key in self.table_registry.get_loaded_tables()
            ]
            info["table_count"] = self.table_registry.get_loaded_table_count()

        return info

    def close_all(self):
        """Close all database connections"""
        for database_name, engine in self.engines.items():
            engine.dispose()
            ColorPrint.blue(f"[DatabaseManager] Closed database: {database_name}")

        self.engines.clear()
        self.metadatas.clear()
        self.table_registry.clear()

        ColorPrint.green("[DatabaseManager] All databases closed")


# Singleton instance
_database_manager_singleton: Optional[DatabaseManager] = None


def get_database_manager() -> DatabaseManager:
    """Get singleton instance of DatabaseManager"""
    global _database_manager_singleton
    if _database_manager_singleton is None:
        _database_manager_singleton = DatabaseManager()
    return _database_manager_singleton


# Export singleton instance
database_manager = get_database_manager()
