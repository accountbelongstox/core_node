# PyCore Database System

A complete database management system for PyCore with centralized table definitions, namespace isolation, and auto-management features.

## Architecture Overview

```
pycore/database/
├── Core Module
│   ├── __init__.py              - Main exports (database_manager, BaseModel, DATABASE_AVAILABLE)
│   ├── base_model.py            - BaseModel abstract class with CRUD operations
│   ├── database_manager.py      - DatabaseManager singleton for connection management
│   └── table_registry.py        - TableRegistry for tracking loaded tables
│
└── Models (Centralized Definitions)
    ├── __init__.py              - Total export (all models, namespaces, table keys)
    ├── namespaces.py            - TableNamespaces class (namespace constants)
    ├── table_keys.py            - TableKeys class (table key constants)
    │
    ├── common/                  - Common namespace (shared tables)
    │   ├── __init__.py
    │   ├── config_model.py      - CommonConfigModel (key-value config)
    │   └── log_model.py         - CommonLogModel (application logs)
    │
    ├── app_example/             - Example app namespace
    │   ├── __init__.py
    │   ├── user_model.py        - ExampleUserModel (user management)
    │   └── task_model.py        - ExampleTaskModel (task tracking)
    │
    └── util_cache/              - Cache utility namespace
        ├── __init__.py
        └── cache_model.py       - UtilCacheModel (cache storage)
```

## Key Features

### 1. Independent Module
- Located in `pycore/database/` (NOT in pyutils)
- Avoids circular dependencies
- Only depends on: `pygvar`, `pyfoundations`

### 2. Centralized Definitions
- All table models in `pycore/database/models/`
- All table names as constants (no hardcoded strings)
- Namespace-based organization

### 3. Namespace System
- **Format**: `{type}_{name}` or `common`
- **Types**:
  - `common` - Shared tables for all apps/utilities
  - `app_{name}` - Application-specific tables
  - `util_{name}` - Utility-specific tables

### 4. Table Key Format
- **Format**: `{namespace}.{table_name}`
- **Examples**:
  - `common.config` → Common config table
  - `app_example.users` → Example app user table
  - `util_cache.items` → Cache utility items table

### 5. Auto-Management Features
- **Auto-Initialization**: Tables auto-created on first load
- **Lazy Loading**: Tables load on demand via `load_tables()`
- **Connection Pooling**: Managed by SQLAlchemy
- **Transaction Support**: Context managers with auto-commit/rollback

## Quick Start

### Basic Usage

```python
from pycore.database import database_manager
from pycore.database.models import TableKeys, CommonConfigModel

# 1. Register database
database_manager.register_database("myapp")

# 2. Load tables
database_manager.load_tables(
    table_keys=[TableKeys.COMMON_CONFIG],
    models=[CommonConfigModel],
    database_name="myapp"
)

# 3. Use table
with database_manager.get_connection("myapp") as conn:
    config = database_manager.get_table(TableKeys.COMMON_CONFIG)
    config.set_value(conn, "app_name", "My App")
    value = config.get_value(conn, "app_name")
    print(f"App name: {value}")
```

### Transaction Example

```python
with database_manager.transaction("myapp") as conn:
    users = database_manager.get_table(TableKeys.EXAMPLE_USERS)
    tasks = database_manager.get_table(TableKeys.EXAMPLE_TASKS)

    # Create user and task in same transaction
    user_id = users.create_user(conn, "alice", "alice@example.com", "password_hash")
    task_id = tasks.create_task(conn, user_id, "Complete project")

    # Auto-commit on success, auto-rollback on error
```

## Available Models

### Common Models (Shared)

1. **CommonConfigModel** - Key-value configuration storage
   - Methods: `get_value()`, `set_value()`, `delete_key()`, `get_all_configs()`

2. **CommonLogModel** - Application logging
   - Methods: `log()`, `get_logs_by_level()`, `get_recent_logs()`, `clear_old_logs()`

### App Example Models

3. **ExampleUserModel** - User management
   - Methods: `get_by_username()`, `create_user()`, `update_last_login()`, `deactivate_user()`

4. **ExampleTaskModel** - Task tracking
   - Methods: `create_task()`, `get_user_tasks()`, `update_status()`, `complete_task()`

### Util Cache Model

5. **UtilCacheModel** - Cache storage with TTL
   - Methods: `get_cache()`, `set_cache()`, `delete_cache()`, `clear_expired()`

## Creating Your Own Models

### Step 1: Add Namespace (if new)

Edit `pycore/database/models/namespaces.py`:

```python
class TableNamespaces:
    # ... existing namespaces ...
    APP_MYAPP = "app_myapp"
```

### Step 2: Add Table Key

Edit `pycore/database/models/table_keys.py`:

```python
class TableKeys:
    # ... existing keys ...
    MYAPP_USERS = f"{TableNamespaces.APP_MYAPP}.users"
```

### Step 3: Create Model

Create `pycore/database/models/app_myapp/user_model.py`:

```python
from pycore.pyfoundations.third_party import sqlalchemy
from pycore.database.base_model import BaseModel
from pycore.database.models.table_keys import TableKeys

class MyAppUserModel(BaseModel):
    __table_key__ = TableKeys.MYAPP_USERS
    __namespace__ = "app_myapp"
    __table_name__ = "users"
    __schema_version__ = 1

    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True),
            sqlalchemy.Column('username', sqlalchemy.String(100), nullable=False),
            # ... more columns ...
        )

    # Add custom methods here
    @classmethod
    def get_by_username(cls, conn, username: str):
        return cls.select_one(conn, where={"username": username})
```

### Step 4: Export Model

Create `pycore/database/models/app_myapp/__init__.py`:

```python
from pycore.database.models.app_myapp.user_model import MyAppUserModel

__all__ = ['MyAppUserModel']
```

Update `pycore/database/models/__init__.py`:

```python
from pycore.database.models.app_myapp import MyAppUserModel

__all__ = [
    # ... existing exports ...
    'MyAppUserModel',
]
```

### Step 5: Use Your Model

```python
from pycore.database import database_manager
from pycore.database.models import TableKeys, MyAppUserModel

database_manager.register_database("myapp")
database_manager.load_tables(
    table_keys=[TableKeys.MYAPP_USERS],
    models=[MyAppUserModel],
    database_name="myapp"
)

with database_manager.get_connection("myapp") as conn:
    users = database_manager.get_table(TableKeys.MYAPP_USERS)
    users.insert(conn, {"username": "alice", "email": "alice@example.com"})
```

## Base CRUD Operations

All models inherit these methods from `BaseModel`:

- `insert(conn, data)` - Insert one row, return primary key
- `insert_many(conn, data_list)` - Insert multiple rows
- `select(conn, where, columns, limit, offset, order_by)` - Select rows with conditions
- `select_one(conn, where)` - Select single row
- `update(conn, data, where)` - Update rows, return affected count
- `delete(conn, where)` - Delete rows, return affected count
- `count(conn, where)` - Count rows
- `exists(conn, where)` - Check if row exists

## Running the Example

```bash
cd D:/programing/core_node
python pycore/database/example_usage.py
```

This will demonstrate:
- Database registration
- Table loading
- CRUD operations on all models
- Transaction usage
- Cleanup operations

## Database Storage Location

Default database location:
- Windows: `D:/www/pycore_db/{database_name}.db`
- Linux WSL: `/mnt/d/www/pycore_db/{database_name}.db`
- Linux: `/www/pycore_db/{database_name}.db`

You can override with custom connection string:

```python
database_manager.register_database(
    database_name="myapp",
    connection_string="sqlite:///path/to/custom.db"
    # Or PostgreSQL: "postgresql://user:pass@localhost/dbname"
    # Or MySQL: "mysql://user:pass@localhost/dbname"
)
```

## Design Principles

1. **No Hardcoded Table Names** - All table names defined as constants in `TableKeys`
2. **Namespace Isolation** - Prevents naming conflicts between apps
3. **Centralized Definition** - All models in one location for easy management
4. **Lazy Loading** - Only initialize tables when needed
5. **Total Export** - Convenient imports without auto-loading
6. **Differentiated Functionality** - Base provides CRUD, models add custom methods

## Verification Status

All code verified:
✓ No Chinese comments (all English)
✓ All imports working correctly
✓ Namespace system functional
✓ Table key extraction working
✓ All 5 example models implemented
✓ Total export functional
✓ Database manager singleton working
✓ Connection pooling configured

## Notes

- SQLAlchemy is required: `pip install sqlalchemy`
- Database module gracefully handles missing SQLAlchemy
- Check `DATABASE_AVAILABLE` flag before using
- Use transactions for multi-table operations
- Models can implement custom methods on top of base CRUD

---

**Version**: 1.0.0
**Last Updated**: 2025-11-16
**Dependencies**: `pygvar`, `pyfoundations`, `sqlalchemy`
