#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Offline word dictionary — ECDICT (English<->Chinese) + WordNet (English).

A FREE, offline word-translation source that serves ALONGSIDE GoogleTranslator:
for an English word the local ECDICT lookup is instant, free and authoritative
(770k+ entries with Chinese translation, phonetic, English definition, COCA/BNC
frequency and exam tags), so the worker tries it first and only falls back to
Google for misses / non-zh targets.

Data (downloaded by the shell prereq install_dictionaries.sh):
  ECDICT  : <pycore_db>/dictionaries/stardict.db   (skywind3000/ECDICT SQLite)
            table ``stardict`` (word, phonetic, definition, translation, pos,
            collins, oxford, tag, bnc, frq, exchange). Env override: ECDICT_DB_PATH.
  WordNet : NLTK corpus (nltk.download('wordnet','omw-1.4')) — English glosses
            + synonyms; lazy, flag-gated, optional.

Degrades gracefully: when the DB / corpus is absent ``available()`` is False and
every lookup returns empty, so callers fall back transparently. Read-only SQLite
(mode=ro) shared across worker threads behind a lock. ColorPrint logging.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import map_web_path

# Target languages ECDICT can answer directly (its ``translation`` column is
# Simplified Chinese); everything else falls back to Google upstream.
_ZH_TARGETS = {"zh", "zh-cn", "zh_cn", "zh-hans", "zh-hans-cn", "chinese", "cn", "zh-chs"}
_EN_TARGETS = {"en", "en-us", "en-gb", "english"}

# ECDICT columns we read when present (detected via PRAGMA so a trimmed build
# never breaks the query).
_ECDICT_COLUMNS = ("word", "phonetic", "definition", "translation",
                   "pos", "collins", "oxford", "tag", "bnc", "frq", "exchange")


def _ecdict_db_path():
    """Resolve the ECDICT SQLite path (env override, else pycore_db/dictionaries)."""
    override = os.environ.get("ECDICT_DB_PATH", "").strip()
    if override:
        from pathlib import Path
        return Path(override)
    return map_web_path("pycore_db") / "dictionaries" / "stardict.db"


class DictionaryService:
    """Singleton offline dictionary (ECDICT + WordNet). Lazy, thread-safe."""

    _instance: Optional["DictionaryService"] = None
    _instance_lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self._db_path = _ecdict_db_path()
        self._conn: Optional[sqlite3.Connection] = None
        self._columns: List[str] = []
        self._conn_lock = threading.Lock()
        self._connect_attempted = False
        # WordNet is optional; resolved on first use.
        self._wn = None
        self._wn_attempted = False
        self._initialized = True

    # -------------------- ECDICT --------------------

    def _ensure_conn(self) -> Optional[sqlite3.Connection]:
        """Open the read-only ECDICT connection once (None when the DB is absent)."""
        if self._conn is not None:
            return self._conn
        with self._conn_lock:
            if self._conn is not None:
                return self._conn
            if self._connect_attempted:
                return self._conn
            self._connect_attempted = True
            if not self._db_path.is_file():
                ColorPrint.yellow(
                    f"[dictionary] ECDICT db not found at {self._db_path} "
                    f"(run install_dictionaries.sh to enable offline word translation)")
                return None
            try:
                uri = f"file:{self._db_path}?mode=ro"
                conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
                cur = conn.execute("PRAGMA table_info(stardict)")
                self._columns = [row[1] for row in cur.fetchall()]
                if "word" not in self._columns:
                    ColorPrint.yellow("[dictionary] ECDICT db has no 'stardict.word' column")
                    conn.close()
                    return None
                self._conn = conn
                ColorPrint.green(f"[dictionary] ECDICT loaded ({self._db_path.name})")
            except sqlite3.Error as e:
                ColorPrint.yellow(f"[dictionary] ECDICT open failed: {e}")
                return None
        return self._conn

    def _ecdict_row(self, word: str) -> Optional[Dict[str, Any]]:
        """Raw ECDICT row for ``word`` (case-insensitive), or None."""
        conn = self._ensure_conn()
        if conn is None or not word:
            return None
        cols = [c for c in _ECDICT_COLUMNS if c in self._columns]
        if not cols:
            return None
        sql = f"SELECT {', '.join(cols)} FROM stardict WHERE word = ? COLLATE NOCASE LIMIT 1"
        try:
            with self._conn_lock:
                cur = conn.execute(sql, (word.strip(),))
                row = cur.fetchone()
        except sqlite3.Error as e:
            ColorPrint.yellow(f"[dictionary] ECDICT query failed: {e}")
            return None
        if not row:
            return None
        return dict(zip(cols, row))

    # -------------------- WordNet (optional) --------------------

    def _ensure_wordnet(self):
        """Lazily resolve the NLTK WordNet corpus (None when unavailable)."""
        if self._wn is not None or self._wn_attempted:
            return self._wn
        self._wn_attempted = True
        try:
            from nltk.corpus import wordnet as wn
            # Touch the corpus so a missing download surfaces now, not mid-lookup.
            wn.synsets("test")
            self._wn = wn
        except Exception as e:  # noqa: BLE001 — optional corpus; degrade silently-ish
            ColorPrint.yellow(f"[dictionary] WordNet unavailable ({e}); "
                              f"run install_dictionaries.sh for English definitions")
            self._wn = None
        return self._wn

    def wordnet_definition(self, word: str) -> str:
        """First WordNet gloss for ``word`` ('' when unavailable)."""
        wn = self._ensure_wordnet()
        if wn is None or not word:
            return ""
        try:
            syns = wn.synsets(word.strip())
            return syns[0].definition() if syns else ""
        except Exception:  # noqa: BLE001
            return ""

    def wordnet_synonyms(self, word: str, limit: int = 12) -> List[str]:
        """Distinct WordNet lemma synonyms for ``word`` ([] when unavailable)."""
        wn = self._ensure_wordnet()
        if wn is None or not word:
            return []
        try:
            out: List[str] = []
            for syn in wn.synsets(word.strip()):
                for lemma in syn.lemmas():
                    name = lemma.name().replace("_", " ")
                    if name.lower() != word.strip().lower() and name not in out:
                        out.append(name)
                        if len(out) >= limit:
                            return out
            return out
        except Exception:  # noqa: BLE001
            return []

    # -------------------- public API --------------------

    def available(self) -> bool:
        """True when at least the ECDICT database is loadable."""
        return self._ensure_conn() is not None

    def lookup(self, word: str) -> Dict[str, Any]:
        """Rich entry for ``word``: translation (zh), definition (en), phonetic,
        pos, exam tags, frequency, word forms, + WordNet gloss/synonyms. Empty
        ``found=False`` when ECDICT has no entry."""
        row = self._ecdict_row(word)
        wn_def = self.wordnet_definition(word)
        if not row:
            return {
                "word": word, "found": False,
                "translation": "", "definition": wn_def, "phonetic": "",
                "pos": "", "tags": [], "collins": 0, "oxford": False,
                "bnc": 0, "frq": 0, "exchange": "",
                "wordnet_definition": wn_def, "synonyms": self.wordnet_synonyms(word),
                "source": "wordnet" if wn_def else "",
            }
        tag = (row.get("tag") or "").strip()
        return {
            "word": row.get("word") or word,
            "found": True,
            "translation": (row.get("translation") or "").strip(),
            "definition": (row.get("definition") or "").strip(),
            "phonetic": (row.get("phonetic") or "").strip(),
            "pos": (row.get("pos") or "").strip(),
            "tags": tag.split() if tag else [],
            "collins": int(row.get("collins") or 0),
            "oxford": bool(row.get("oxford")),
            "bnc": int(row.get("bnc") or 0),
            "frq": int(row.get("frq") or 0),
            "exchange": (row.get("exchange") or "").strip(),
            "wordnet_definition": wn_def,
            "synonyms": self.wordnet_synonyms(word),
            "source": "ecdict",
        }

    def translate(self, word: str, dest: str) -> Optional[str]:
        """Offline translation of a single ``word`` for ``dest`` (Chinese from the
        ECDICT translation column; English from its definition). None on miss /
        unsupported target, so the caller falls back to Google."""
        if not word:
            return None
        dest_norm = (dest or "").strip().lower()
        row = self._ecdict_row(word)
        if not row:
            return None
        if dest_norm in _ZH_TARGETS:
            text = (row.get("translation") or "").strip()
        elif dest_norm in _EN_TARGETS:
            text = (row.get("definition") or "").strip()
        else:
            return None
        if not text:
            return None
        # The column holds newline-separated senses; collapse to a single line.
        return "; ".join(part.strip() for part in text.splitlines() if part.strip())

    def status(self) -> Dict[str, Any]:
        """Install/availability snapshot for the UI + the /dictionary/status route."""
        conn = self._ensure_conn()
        entries = 0
        if conn is not None:
            try:
                with self._conn_lock:
                    entries = int(conn.execute("SELECT COUNT(*) FROM stardict").fetchone()[0])
            except sqlite3.Error:
                entries = 0
        return {
            "ecdict": {
                "available": conn is not None,
                "db_path": str(self._db_path),
                "entries": entries,
            },
            "wordnet": {"available": self._ensure_wordnet() is not None},
        }


def get_dictionary_service() -> DictionaryService:
    """Get the offline DictionaryService singleton."""
    return DictionaryService()


__all__ = ["DictionaryService", "get_dictionary_service"]
