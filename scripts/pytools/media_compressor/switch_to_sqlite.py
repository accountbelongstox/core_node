"""Automated script to switch from JSON to SQLite storage."""

import shutil
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))


def switch_to_sqlite():
    """Switch compressor.py to use SQLite instead of JSON."""

    compressor_file = Path(__file__).parent / "compressor.py"

    print("Switching to SQLite storage...")
    print(f"  File: {compressor_file}")

    # Read current content
    with open(compressor_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if already using SQLite
    if 'from sqlite_store import SqliteStore' in content:
        print("  Already using SQLite!")
        return

    # Backup original file
    backup_file = compressor_file.with_suffix('.py.json_backup')
    shutil.copy2(compressor_file, backup_file)
    print(f"  Created backup: {backup_file.name}")

    # Replace import
    content = content.replace(
        'from json_store import ThreadSafeJsonStore',
        'from sqlite_store import SqliteStore'
    )

    # Replace class name
    content = content.replace(
        'ThreadSafeJsonStore',
        'SqliteStore'
    )

    # Replace cache path (.json → .db)
    content = content.replace(
        'CACHE_JSON = SOURCE_DIR / "compression_cache.json"',
        'CACHE_DB = SOURCE_DIR / "compression_cache.db"'
    )
    content = content.replace(
        'path=CACHE_JSON',
        'path=CACHE_DB'
    )

    # Write modified content
    with open(compressor_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print("  ✓ Modified compressor.py to use SQLite")
    print()
    print("Next steps:")
    print("  1. Run migration: python migrate_to_sqlite.py")
    print("  2. Restart all media_compressor clients")
    print()
    print("To rollback:")
    print(f"  cp {backup_file} {compressor_file}")


if __name__ == "__main__":
    try:
        switch_to_sqlite()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
