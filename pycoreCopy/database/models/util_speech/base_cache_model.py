#!/usr/bin/env python3
"""
Speech cache base model.

Provides shared cache operations (lookup, verification, statistics) for
both TTS and STT caches. Subclasses define schema-specific column names
and table metadata.
"""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyfoundations.color_print import ColorPrint
from pycore.database.base_model import BaseModel


class SpeechCacheBaseModel(BaseModel):
    """Abstract base class for speech cache tables."""

    # Column mappings (override per subclass)
    KEY_FIELD = "entry_md5"
    INPUT_FIELD = None          # e.g., text input
    OUTPUT_FIELD = None         # e.g., recognized text
    LANGUAGE_FIELD = "language"
    PROVIDER_FIELD = "provider"
    FILE_PATH_FIELD = "file_path"
    FILE_SIZE_FIELD = "file_size"
    FILE_EXISTS_FIELD = "file_exists"
    CREATED_AT_FIELD = "created_at"
    LAST_ACCESSED_FIELD = "last_accessed_at"
    ACCESS_COUNT_FIELD = "access_count"

    @classmethod
    def _filters(cls, key_value: str, language: str, provider: str) -> Dict[str, Any]:
        return {
            cls.KEY_FIELD: key_value,
            cls.LANGUAGE_FIELD: language,
            cls.PROVIDER_FIELD: provider,
        }

    @classmethod
    def query_cache(
        cls,
        conn,
        key_value: str,
        language: str,
        provider: str,
        verify_file: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Generic cache lookup with optional filesystem verification."""
        results = cls.select(conn, where=cls._filters(key_value, language, provider), limit=1)
        if not results:
            return None

        record = results[0]
        file_path = Path(record[cls.FILE_PATH_FIELD])

        if verify_file:
            if not file_path.exists():
                ColorPrint.yellow(f"[{cls.__name__}] File missing, deleting record: {file_path}")
                cls.delete(conn, where={"id": record["id"]})
                return None

            actual_size = file_path.stat().st_size
            if record.get(cls.FILE_SIZE_FIELD) != actual_size:
                record[cls.FILE_SIZE_FIELD] = actual_size

        # Prepare update data with datetime object (will be auto-converted by BaseModel.update)
        update_data = {
            cls.LAST_ACCESSED_FIELD: datetime.utcnow(),
            cls.ACCESS_COUNT_FIELD: record.get(cls.ACCESS_COUNT_FIELD, 0) + 1,
            cls.FILE_EXISTS_FIELD: True,
        }
        if verify_file:
            update_data[cls.FILE_SIZE_FIELD] = record.get(cls.FILE_SIZE_FIELD)

        cls.update(conn, update_data, where={"id": record["id"]})

        # Update record dict with converted values (ISO string instead of datetime object)
        record[cls.LAST_ACCESSED_FIELD] = update_data[cls.LAST_ACCESSED_FIELD].isoformat()
        record[cls.ACCESS_COUNT_FIELD] = update_data[cls.ACCESS_COUNT_FIELD]
        record[cls.FILE_EXISTS_FIELD] = update_data[cls.FILE_EXISTS_FIELD]
        if verify_file:
            record[cls.FILE_SIZE_FIELD] = update_data[cls.FILE_SIZE_FIELD]

        return record

    @classmethod
    def add_cache_entry(
        cls,
        conn,
        key_value: str,
        language: str,
        provider: str,
        file_path: str,
        extra_fields: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Insert or update a cache entry."""
        extra_fields = extra_fields or {}
        path = Path(file_path)
        file_exists = path.exists()
        file_size = path.stat().st_size if file_exists else None

        existing = cls.select(conn, where=cls._filters(key_value, language, provider), limit=1)
        if existing:
            record_id = existing[0]["id"]
            update_data = {
                cls.FILE_PATH_FIELD: file_path,
                cls.FILE_SIZE_FIELD: file_size,
                cls.FILE_EXISTS_FIELD: file_exists,
                cls.LAST_ACCESSED_FIELD: datetime.utcnow(),
            }
            update_data.update(extra_fields)
            cls.update(conn, update_data, where={"id": record_id})
            ColorPrint.blue(f"[{cls.__name__}] Updated cache entry: {key_value[:8]}...")
            return record_id

        insert_data = {
            cls.KEY_FIELD: key_value,
            cls.LANGUAGE_FIELD: language,
            cls.PROVIDER_FIELD: provider,
            cls.FILE_PATH_FIELD: file_path,
            cls.FILE_SIZE_FIELD: file_size,
            cls.FILE_EXISTS_FIELD: file_exists,
            cls.CREATED_AT_FIELD: datetime.utcnow(),
            cls.LAST_ACCESSED_FIELD: datetime.utcnow(),
            cls.ACCESS_COUNT_FIELD: 0,
        }
        insert_data.update(extra_fields)
        record_id = cls.insert(conn, insert_data)
        ColorPrint.green(f"[{cls.__name__}] Added cache entry: {key_value[:8]}...")
        return record_id

    @classmethod
    def verify_all_files(cls, conn) -> Dict[str, int]:
        """Verify cached artifacts exist; delete stale entries."""
        all_records = cls.select(conn)
        stats = {"total": len(all_records), "exists": 0, "missing": 0}

        for record in all_records:
            file_path = Path(record[cls.FILE_PATH_FIELD])
            if file_path.exists():
                stats["exists"] += 1
                cls.update(
                    conn,
                    {
                        cls.FILE_EXISTS_FIELD: True,
                        cls.FILE_SIZE_FIELD: file_path.stat().st_size,
                    },
                    where={"id": record["id"]},
                )
            else:
                stats["missing"] += 1
                ColorPrint.yellow(f"[{cls.__name__}] Deleting orphaned record: {file_path}")
                cls.delete(conn, where={"id": record["id"]})

        ColorPrint.blue(f"[{cls.__name__}] File verification complete:")
        ColorPrint.blue(f"  Total: {stats['total']}")
        ColorPrint.green(f"  Exists: {stats['exists']}")
        ColorPrint.yellow(f"  Missing (deleted): {stats['missing']}")
        return stats

    @classmethod
    def get_cache_statistics(cls, conn) -> Dict[str, Any]:
        """Compute basic usage statistics."""
        all_records = cls.select(conn)
        if not all_records:
            return {
                "total_entries": 0,
                "by_language": {},
                "by_provider": {},
                "avg_access_count": 0.0,
                "total_cache_size_bytes": 0,
                "total_cache_size_mb": 0.0,
            }

        by_language: Dict[str, int] = {}
        by_provider: Dict[str, int] = {}
        total_access = 0
        total_size = 0

        for record in all_records:
            lang = record.get(cls.LANGUAGE_FIELD)
            prov = record.get(cls.PROVIDER_FIELD)
            by_language[lang] = by_language.get(lang, 0) + 1
            by_provider[prov] = by_provider.get(prov, 0) + 1
            total_access += record.get(cls.ACCESS_COUNT_FIELD, 0)
            total_size += record.get(cls.FILE_SIZE_FIELD) or 0

        return {
            "total_entries": len(all_records),
            "by_language": by_language,
            "by_provider": by_provider,
            "avg_access_count": total_access / len(all_records),
            "total_cache_size_bytes": total_size,
            "total_cache_size_mb": total_size / (1024 * 1024),
        }

    @classmethod
    def delete_by_provider(cls, conn, provider: str) -> int:
        """Delete all entries for a provider."""
        count = cls.count(conn, where={cls.PROVIDER_FIELD: provider})
        if count > 0:
            cls.delete(conn, where={cls.PROVIDER_FIELD: provider})
            ColorPrint.blue(f"[{cls.__name__}] Deleted {count} entries for provider: {provider}")
        return count

    @classmethod
    def delete_by_language(cls, conn, language: str) -> int:
        """Delete all entries for a language."""
        count = cls.count(conn, where={cls.LANGUAGE_FIELD: language})
        if count > 0:
            cls.delete(conn, where={cls.LANGUAGE_FIELD: language})
            ColorPrint.blue(f"[{cls.__name__}] Deleted {count} entries for language: {language}")
        return count

    @classmethod
    def clear_all_cache(cls, conn) -> int:
        """Drop all cache rows."""
        count = cls.count(conn)
        if count > 0:
            delete_stmt = cls.__table__.delete()
            result = conn.execute(delete_stmt)
            ColorPrint.yellow(f"[{cls.__name__}] Cleared all {count} cache entries")
            return result.rowcount
        return 0
