# -*- coding: utf-8 -*-
"""SQLite repository of generated agent-history article records.

One row per record: the full JSON ``body`` plus indexed projections used by
counters, pages and the rebuild lane, so no read ever loads every body to
answer a count. Every write bumps the ``revision`` meta counter.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.article_record_schema import (
    ARTICLE_META_TABLE,
    ARTICLE_RECORD_COLUMNS,
    ARTICLE_RECORD_TABLE,
    init_article_record_schema,
)

META_REVISION = "revision"
_ORDER = "ORDER BY created_at DESC, id DESC"
_UPSERT = (
    f"INSERT OR REPLACE INTO {ARTICLE_RECORD_TABLE} "
    f"(id, {', '.join(ARTICLE_RECORD_COLUMNS)}, body) "
    f"VALUES ({', '.join('?' for _ in range(len(ARTICLE_RECORD_COLUMNS) + 2))})"
)
_SUMMARY = f"""
    SELECT
        COUNT(*),
        COALESCE(SUM(uploaded), 0),
        COALESCE(SUM(audio_status = 'ready'), 0),
        COALESCE(SUM(audio_status = 'queued'), 0),
        COALESCE(SUM(tts_chunked), 0),
        COALESCE(SUM(audio_rebuilt), 0),
        COALESCE(SUM(uploaded AND tts_chunked AND NOT rebuild_upload_current), 0),
        COALESCE(SUM(video_status = 'completed'), 0),
        COALESCE(SUM(video_status NOT IN ('', 'completed', 'failed')), 0),
        COALESCE(SUM(video_status = 'failed'), 0)
    FROM {ARTICLE_RECORD_TABLE}
"""

ArticleRow = Tuple[str, Dict[str, Any], Dict[str, Any]]


class ArticleRecordRepository:
    def __init__(self, database_path: Path) -> None:
        self.path = Path(database_path)
        self._connection = open_wal_connection(database_path, synchronous="NORMAL")
        init_article_record_schema(self._connection)
        self._connection.commit()

    def meta(self, key: str) -> str:
        values = self._connection.execute(
            f"SELECT meta_value FROM {ARTICLE_META_TABLE} WHERE meta_key = ?", (key,),
        ).fetchone()
        return str(values[0]) if values is not None else ""

    def set_meta(self, key: str, value: str) -> None:
        with self._connection:
            self._set_meta(key, value)

    def _set_meta(self, key: str, value: str) -> None:
        self._connection.execute(
            f"INSERT OR REPLACE INTO {ARTICLE_META_TABLE} (meta_key, meta_value) VALUES (?, ?)",
            (key, str(value)),
        )

    def revision(self) -> int:
        return int(self.meta(META_REVISION) or 0)

    def checkpoint(self) -> None:
        self._connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    def upsert_many(self, rows: Iterable[ArticleRow]) -> int:
        """Write ``(id, columns, body)`` rows in one transaction; returns the new revision."""
        revision = self.revision() + 1
        with self._connection:
            for record_id, columns, body in rows:
                self._connection.execute(
                    _UPSERT,
                    (
                        record_id,
                        *(columns.get(name) for name in ARTICLE_RECORD_COLUMNS),
                        json.dumps(body, ensure_ascii=False),
                    ),
                )
            self._set_meta(META_REVISION, str(revision))
        return revision

    def get(self, record_id: str) -> Optional[Dict[str, Any]]:
        row = self._connection.execute(
            f"SELECT body FROM {ARTICLE_RECORD_TABLE} WHERE id = ?", (record_id,),
        ).fetchone()
        return json.loads(row[0]) if row is not None else None

    def count(self) -> int:
        return int(self._connection.execute(f"SELECT COUNT(*) FROM {ARTICLE_RECORD_TABLE}").fetchone()[0])

    def page(self, offset: int, limit: int) -> List[Dict[str, Any]]:
        rows = self._connection.execute(
            f"SELECT body FROM {ARTICLE_RECORD_TABLE} {_ORDER} LIMIT ? OFFSET ?",
            (int(limit), int(offset)),
        ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def all(self) -> List[Dict[str, Any]]:
        rows = self._connection.execute(f"SELECT body FROM {ARTICLE_RECORD_TABLE} {_ORDER}").fetchall()
        return [json.loads(row[0]) for row in rows]

    def rebuild_candidates(self) -> List[Dict[str, Any]]:
        rows = self._connection.execute(
            f"SELECT body FROM {ARTICLE_RECORD_TABLE} WHERE has_article = 1 AND tts_chunked = 0 {_ORDER}"
        ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def rebuild_candidate_count(self) -> int:
        return int(self._connection.execute(
            f"SELECT COUNT(*) FROM {ARTICLE_RECORD_TABLE} WHERE has_article = 1 AND tts_chunked = 0"
        ).fetchone()[0])

    def summary(self) -> Dict[str, int]:
        (
            total, uploaded, audio_ready, audio_queued, multi_sentence, rebuilt,
            rebuild_upload_pending, video_ready, video_pending, video_failed,
        ) = (int(value) for value in self._connection.execute(_SUMMARY).fetchone())
        return {
            "total": total,
            "uploaded": uploaded,
            "pending_upload": total - uploaded,
            "audio_ready": audio_ready,
            "audio_queued": audio_queued,
            "multi_sentence": multi_sentence,
            "legacy_audio": total - multi_sentence,
            "rebuilt": rebuilt,
            "rebuild_upload_pending": rebuild_upload_pending,
            "video_ready": video_ready,
            "video_pending": video_pending,
            "video_failed": video_failed,
        }


__all__ = ["ArticleRecordRepository", "META_REVISION"]
