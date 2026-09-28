#!/usr/bin/env python3
"""
Database System Usage Example
Demonstrates how to use the pycore database system
"""

from pycore.database.exports import database_manager, DATABASE_AVAILABLE
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.common.config_model import CommonConfigModel
from pycore.database.models.common.log_model import CommonLogModel
from pycore.database.models.app_example.user_model import ExampleUserModel
from pycore.database.models.app_example.task_model import ExampleTaskModel
from pycore.database.models.util_cache.cache_model import UtilCacheModel
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def main():
    """Main example function"""

    if not DATABASE_AVAILABLE:
        ColorPrint.red("[Example] Database module not available!")
        ColorPrint.yellow("[Example] Please install SQLAlchemy: pip install sqlalchemy")
        return

    ColorPrint.green("=" * 60)
    ColorPrint.green("Database System Usage Example")
    ColorPrint.green("=" * 60)

    # ===== Step 1: Register Database =====
    ColorPrint.blue("\n[Step 1] Registering database...")
    database_manager.register_database(
        database_name="example_db",
        connection_string=None  # Auto-creates SQLite in PYTOOLS_DATA_DIR
    )

    # ===== Step 2: Load Tables =====
    ColorPrint.blue("\n[Step 2] Loading tables...")

    # Load common tables
    database_manager.load_tables(
        table_keys=[TableKeys.COMMON_CONFIG, TableKeys.COMMON_LOGS],
        models=[CommonConfigModel, CommonLogModel],
        database_name="example_db"
    )

    # Load app example tables
    database_manager.load_tables(
        table_keys=[TableKeys.EXAMPLE_USERS, TableKeys.EXAMPLE_TASKS],
        models=[ExampleUserModel, ExampleTaskModel],
        database_name="example_db"
    )

    # Load cache table
    database_manager.load_tables(
        table_keys=[TableKeys.CACHE_ITEMS],
        models=[UtilCacheModel],
        database_name="example_db"
    )

    ColorPrint.green(f"[Step 2] Loaded tables: {database_manager.get_loaded_tables()}")

    # ===== Step 3: Basic CRUD Operations =====
    ColorPrint.blue("\n[Step 3] Demonstrating basic CRUD operations...")

    with database_manager.get_connection("example_db") as conn:
        # Get table references
        config = database_manager.get_table(TableKeys.COMMON_CONFIG)
        logs = database_manager.get_table(TableKeys.COMMON_LOGS)
        users = database_manager.get_table(TableKeys.EXAMPLE_USERS)
        tasks = database_manager.get_table(TableKeys.EXAMPLE_TASKS)
        cache = database_manager.get_table(TableKeys.CACHE_ITEMS)

        # --- Config operations ---
        ColorPrint.cyan("\n  [Config] Setting configuration values...")
        config.set_value(conn, "app_name", "Example App", "Application name")
        config.set_value(conn, "version", "1.0.0", "Application version")
        config.set_value(conn, "debug_mode", "true", "Debug mode flag")

        app_name = config.get_value(conn, "app_name")
        ColorPrint.green(f"  [Config] Retrieved app_name: {app_name}")

        all_configs = config.get_all_configs(conn)
        ColorPrint.green(f"  [Config] Total configs: {len(all_configs)}")

        # --- Log operations ---
        ColorPrint.cyan("\n  [Logs] Adding log entries...")
        logs.log(conn, "INFO", "example_app", "Application started")
        logs.log(conn, "DEBUG", "example_app", "Debug message")
        logs.log(conn, "ERROR", "example_app", "Example error", '{"error_code": 500}')

        recent_logs = logs.get_recent_logs(conn, limit=10)
        ColorPrint.green(f"  [Logs] Recent logs count: {len(recent_logs)}")

        # --- User operations ---
        ColorPrint.cyan("\n  [Users] Creating users...")
        user1_id = users.create_user(conn, "alice", "alice@example.com", "hashed_password_123")
        user2_id = users.create_user(conn, "bob", "bob@example.com", "hashed_password_456")

        ColorPrint.green(f"  [Users] Created user IDs: {user1_id}, {user2_id}")

        alice = users.get_by_username(conn, "alice")
        ColorPrint.green(f"  [Users] Retrieved user: {alice['username']} ({alice['email']})")

        users.update_last_login(conn, user1_id)
        ColorPrint.green(f"  [Users] Updated last login for alice")

        # --- Task operations ---
        ColorPrint.cyan("\n  [Tasks] Creating tasks...")
        task1_id = tasks.create_task(conn, user1_id, "Complete project", "Finish the database implementation", priority=3)
        task2_id = tasks.create_task(conn, user1_id, "Write documentation", priority=2)
        task3_id = tasks.create_task(conn, user2_id, "Review code", priority=3)

        ColorPrint.green(f"  [Tasks] Created task IDs: {task1_id}, {task2_id}, {task3_id}")

        alice_tasks = tasks.get_user_tasks(conn, user1_id)
        ColorPrint.green(f"  [Tasks] Alice's tasks: {len(alice_tasks)}")

        tasks.complete_task(conn, task1_id)
        ColorPrint.green(f"  [Tasks] Marked task {task1_id} as completed")

        task_stats = tasks.get_task_stats(conn, user1_id)
        ColorPrint.green(f"  [Tasks] Alice's stats: {task_stats}")

        # --- Cache operations ---
        ColorPrint.cyan("\n  [Cache] Caching values...")
        cache.set_cache(conn, "session_token", "abc123xyz", ttl_seconds=3600)
        cache.set_cache(conn, "user_preferences", '{"theme": "dark"}')

        token = cache.get_cache(conn, "session_token")
        ColorPrint.green(f"  [Cache] Retrieved token: {token}")

        prefs = cache.get_cache(conn, "user_preferences")
        ColorPrint.green(f"  [Cache] Retrieved preferences: {prefs}")

    # ===== Step 4: Transaction Example =====
    ColorPrint.blue("\n[Step 4] Demonstrating transaction...")

    try:
        with database_manager.transaction("example_db") as conn:
            users = database_manager.get_table(TableKeys.EXAMPLE_USERS)
            tasks = database_manager.get_table(TableKeys.EXAMPLE_TASKS)

            # Create user and task in same transaction
            user3_id = users.create_user(conn, "charlie", "charlie@example.com", "hashed_password_789")
            task4_id = tasks.create_task(conn, user3_id, "Test transaction", priority=1)

            ColorPrint.green(f"  [Transaction] Created user {user3_id} and task {task4_id}")
            # Auto-commit on success

    except Exception as e:
        ColorPrint.red(f"  [Transaction] Error: {e}")
        # Auto-rollback on error

    # ===== Step 5: Database Info =====
    ColorPrint.blue("\n[Step 5] Database information...")
    db_info = database_manager.get_database_info("example_db")

    ColorPrint.cyan(f"  Database: {db_info['database_name']}")
    ColorPrint.cyan(f"  Connection: {db_info['connection_string']}")
    ColorPrint.cyan(f"  Tables loaded: {db_info['table_count']}")
    ColorPrint.cyan(f"  Table keys: {', '.join(db_info['loaded_tables'])}")

    # ===== Step 6: Cleanup Example =====
    ColorPrint.blue("\n[Step 6] Cleanup examples...")

    with database_manager.get_connection("example_db") as conn:
        cache = database_manager.get_table(TableKeys.CACHE_ITEMS)
        logs = database_manager.get_table(TableKeys.COMMON_LOGS)

        # Clear expired cache
        expired_count = cache.clear_expired(conn)
        ColorPrint.green(f"  [Cache] Cleared {expired_count} expired entries")

        # Clear old logs (older than 30 days)
        deleted_count = logs.clear_old_logs(conn, days=30)
        ColorPrint.green(f"  [Logs] Cleared {deleted_count} old log entries")

    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example completed successfully!")
    ColorPrint.green("=" * 60)


if __name__ == "__main__":
    main()
