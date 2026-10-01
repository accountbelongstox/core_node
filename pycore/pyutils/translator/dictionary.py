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
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.third_party.api import get_third_package_nltk_wordnet
from pycore.database.adapters.sqlite_local import Error as SqliteError
from pycore.database.adapters.sqlite_readonly import query_rows


# Target languages ECDICT can answer directly (its ``translation`` column is
# Simplified Chinese); everything else falls back to Google upstream.
_ZH_TARGETS = {"zh", "zh-cn", "zh_cn", "zh-hans", "zh-hans-cn", "chinese", "cn", "zh-chs"}
_EN_TARGETS = {"en", "en-us", "en-gb", "english"}

# ECDICT columns we read when present (detected via PRAGMA so a trimmed build
# never breaks the query).
_ECDICT_COLUMNS = ("word", "phonetic", "definition", "translation",
                   "pos", "collins", "oxford", "tag", "bnc", "frq", "exchange")

# SQLITE_BUSY markers: the SAME stardict.db is shared read-only with the
# Laravel app (EcdictDictionary.php), so a lock race can surface here.
_BUSY_MARKERS = ("database is locked", "database table is locked")
# Immediate-retry policy for SQLITE_BUSY: up to 3 attempts, 0s/0.05s/0.15s.
_BUSY_RETRY_DELAYS = (0.0, 0.05, 0.15)


def _is_busy_error(exc: BaseException) -> bool:
    """True when the SQLite error is a lock race (SQLITE_BUSY / locked)."""
    msg = str(exc).lower()
    return any(marker in msg for marker in _BUSY_MARKERS)


def _ecdict_db_path():
    """Resolve the ECDICT SQLite path (env override, else pycore_db/dictionaries)."""
    override = os.environ.get("ECDICT_DB_PATH", "").strip()
    if override:
        return Path(override)
    return map_web_path("pycore_db") / "dictionaries" / "stardict.db"


class DictionaryService:
    """Singleton offline dictionary (ECDICT + WordNet). Lazy, thread-safe."""

    def __init__(self):
        self._db_path = _ecdict_db_path()
        self._columns: List[str] = []
        self._connect_attempted = False
        # Set when the last ECDICT query lost a lock race against the Laravel
        # end; surfaced to the API layer as busy=true (client retries).
        self._last_busy = False
        # WordNet is optional; resolved on first use.
        self._wn = None
        self._wn_attempted = False
        init_serialized_owner(
            self,
            'pyutils.translator.dictionary',
            'DictionaryServiceThread',
            timeout=120.0,
        )

    # -------------------- ECDICT --------------------

    @serialized_method
    def _ensure_conn(self) -> bool:
        """Probe the read-only ECDICT schema once; True when stardict.word exists."""
        if self._connect_attempted:
            return bool(self._columns)
        self._connect_attempted = True
        if not self._db_path.is_file():
            ColorPrint.yellow(
                f"[dictionary] ECDICT db not found at {self._db_path} "
                f"(run install_dictionaries.sh to enable offline word translation)")
            return False
        rows, _busy = self._query("PRAGMA table_info(stardict)", ())
        columns = [row[1] for row in rows or ()]
        if "word" not in columns:
            ColorPrint.yellow("[dictionary] ECDICT db has no 'stardict.word' column")
            return False
        self._columns = columns
        ColorPrint.green(f"[dictionary] ECDICT loaded ({self._db_path.name})")
        return True

    def _query(self, sql: str, params: tuple):
        """(rows, busy) via a read-only connection, retrying SQLITE_BUSY immediately."""
        busy = False
        for delay in _BUSY_RETRY_DELAYS:
            if delay:
                time.sleep(delay)
            try:
                return query_rows(str(self._db_path), sql, params), False
            except SqliteError as e:
                if _is_busy_error(e):
                    busy = True
                    continue
                ColorPrint.yellow(f"[dictionary] ECDICT query failed db={self._db_path}: {e}")
                return None, False
        return None, busy

    @serialized_method
    def _ecdict_row(self, word: str) -> Optional[Dict[str, Any]]:
        """Raw ECDICT row for ``word`` (case-insensitive), or None."""
        if not self._ensure_conn() or not word:
            return None
        cols = [c for c in _ECDICT_COLUMNS if c in self._columns]
        if not cols:
            return None
        sql = f"SELECT {', '.join(cols)} FROM stardict WHERE word = ? COLLATE NOCASE LIMIT 1"
        rows, self._last_busy = self._query(sql, (word.strip(),))
        row = rows[0] if rows else None
        if self._last_busy:
            ColorPrint.yellow(
                f"[dictionary] ECDICT locked by a concurrent reader/writer "
                f"(word '{word}'); API reports busy for immediate retry")
            return None
        if not row:
            return None
        return dict(zip(cols, row))

    # -------------------- WordNet (optional) --------------------

    @serialized_method
    def _ensure_wordnet(self):
        """Lazily resolve the NLTK WordNet corpus (None when unavailable)."""
        if self._wn is not None or self._wn_attempted:
            return self._wn
        self._wn_attempted = True
        try:
            wordnet = get_third_package_nltk_wordnet()
            # Touch the corpus so a missing download surfaces now, not mid-lookup.
            wordnet.synsets("test")
            self._wn = wordnet
        except (ImportError, LookupError, OSError) as e:
            ColorPrint.yellow(f"[dictionary] WordNet unavailable ({e}); "
                              f"run install_dictionaries.sh for English definitions")
            self._wn = None
        return self._wn

    @serialized_method
    def wordnet_definition(self, word: str) -> str:
        """First WordNet gloss for ``word`` ('' when unavailable)."""
        wn = self._ensure_wordnet()
        if wn is None or not word:
            return ""
        syns = wn.synsets(word.strip())
        return syns[0].definition() if syns else ""

    @serialized_method
    def wordnet_synonyms(self, word: str, limit: int = 12) -> List[str]:
        """Distinct WordNet lemma synonyms for ``word`` ([] when unavailable)."""
        wn = self._ensure_wordnet()
        if wn is None or not word:
            return []
        out: List[str] = []
        for syn in wn.synsets(word.strip()):
            for lemma in syn.lemmas():
                name = lemma.name().replace("_", " ")
                if name.lower() != word.strip().lower() and name not in out:
                    out.append(name)
                    if len(out) >= limit:
                        return out
        return out

    # -------------------- public API --------------------

    @serialized_method
    def available(self) -> bool:
        """True when at least the ECDICT database is loadable."""
        return self._ensure_conn()

    @serialized_method
    def lookup(self, word: str) -> Dict[str, Any]:
        """Rich entry for ``word``: translation (zh), definition (en), phonetic,
        pos, exam tags, frequency, word forms, + WordNet gloss/synonyms. Empty
        ``found=False`` when ECDICT has no entry."""
        row = self._ecdict_row(word)
        busy = self._last_busy
        wn_def = self.wordnet_definition(word)
        if not row:
            miss = {
                "word": word, "found": False,
                "translation": "", "definition": wn_def, "phonetic": "",
                "pos": "", "tags": [], "collins": 0, "oxford": False,
                "bnc": 0, "frq": 0, "exchange": "",
                "wordnet_definition": wn_def, "synonyms": self.wordnet_synonyms(word),
                "source": "wordnet" if wn_def else "",
            }
            if busy:
                miss["busy"] = True
                miss["error"] = ("ECDICT database is locked by a concurrent "
                                 "process; retry immediately")
            return miss
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

    @serialized_method
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

    @serialized_method
    def match(self, prefix: str, limit: int = 20) -> Dict[str, Any]:
        """Prefix suggestions for the search box: up to ``limit`` words starting
        with ``prefix`` (case-insensitive), most frequent first (COCA ``frq``
        then ``bnc``), each with its first zh sense. busy=True when a lock
        race with the Laravel end outlives the immediate retries."""
        prefix = (prefix or "").strip()
        result: Dict[str, Any] = {"prefix": prefix, "items": []}
        if not prefix:
            return result
        if not self._ensure_conn():
            return result
        limit = max(1, min(int(limit or 20), 50))
        like = (prefix.replace("\\", "\\\\").replace("%", "\\%")
                .replace("_", "\\_") + "%")
        sql = ("SELECT word, translation, frq, bnc FROM stardict "
               "WHERE word LIKE ? ESCAPE '\\' COLLATE NOCASE "
               "ORDER BY (COALESCE(frq, 0) = 0), COALESCE(frq, 0), "
               "(COALESCE(bnc, 0) = 0), COALESCE(bnc, 0), word LIMIT ?")
        rows, busy = self._query(sql, (like, limit))
        if busy:
            result["busy"] = True
            result["error"] = ("ECDICT database is locked by a concurrent "
                               "process; retry immediately")
            return result
        for word, translation, frq, bnc in rows or []:
            first_sense = ""
            for line in (translation or "").splitlines():
                line = line.strip()
                if line:
                    first_sense = line
                    break
            result["items"].append({
                "word": word,
                "translation": first_sense,
                "frq": int(frq or 0),
                "bnc": int(bnc or 0),
            })
        return result

    @serialized_method
    def status(self) -> Dict[str, Any]:
        """Install/availability snapshot for the UI + the /dictionary/status route."""
        available = self._ensure_conn()
        entries = 0
        busy = False
        if available:
            rows, busy = self._query("SELECT COUNT(*) FROM stardict", ())
            entries = int(rows[0][0]) if rows else 0
        result = {
            "ecdict": {
                "available": available,
                "db_path": str(self._db_path),
                "entries": entries,
            },
            "wordnet": {"available": self._ensure_wordnet() is not None},
        }
        if busy:
            result["busy"] = True
            result["error"] = ("ECDICT database is locked by a concurrent "
                               "process; retry immediately")
        return result


dictionary_service = DictionaryService()


__all__ = ["DictionaryService", "dictionary_service"]
