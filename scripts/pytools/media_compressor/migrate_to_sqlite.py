"""Migrate JSON cache to SQLite database."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sqlite_store import SqliteStore


def migrate_json_to_sqlite(json_path: Path, sqlite_path: Path) -> None:
    """Migrate data from JSON file to SQLite database."""

    print(f"Migration: JSON → SQLite")
    print(f"  Source: {json_path}")
    print(f"  Target: {sqlite_path}")
    print()

    # Read JSON file
    print("Reading JSON file...", end='', flush=True)
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f" done ({len(data.get('files', {}))} entries)")
    except Exception as e:
        print(f" FAILED")
        print(f"Error: {e}")
        return

    # Create SQLite store
    print("Creating SQLite database...", end='', flush=True)
    store = SqliteStore(sqlite_path)
    print(" done")

    # Migrate data
    print("Migrating data...", end='', flush=True)
    success = store.write(data)
    if success:
        print(" done")
    else:
        print(" FAILED")
        return

    # Verify
    print("Verifying migration...", end='', flush=True)
    restored = store.read()
    json_files = len(data.get('files', {}))
    sqlite_files = len(restored.get('files', {}))

    if json_files == sqlite_files:
        print(f" OK ({sqlite_files} entries)")
    else:
        print(f" WARNING: count mismatch (JSON: {json_files}, SQLite: {sqlite_files})")
        return

    print()
    print("✓ Migration completed successfully!")
    print()
    print("Next steps:")
    print("  1. Backup your JSON file:")
    print(f"     mv '{json_path}' '{json_path}.backup'")
    print()
    print("  2. Update compressor.py to use SqliteStore:")
    print("     from sqlite_store import SqliteStore")
    print(f"     cache_store = SqliteStore('{sqlite_path}')")


if __name__ == "__main__":
    # Default paths
    source_dir = Path("E:/Evidences")
    json_file = source_dir / "compression_cache.json"
    sqlite_file = source_dir / "compression_cache.db"

    # Allow custom paths from command line
    if len(sys.argv) > 1:
        json_file = Path(sys.argv[1])
    if len(sys.argv) > 2:
        sqlite_file = Path(sys.argv[2])

    if not json_file.exists():
        print(f"Error: JSON file not found: {json_file}")
        print()
        print("Usage: python migrate_to_sqlite.py [json_path] [sqlite_path]")
        sys.exit(1)

    migrate_json_to_sqlite(json_file, sqlite_file)
