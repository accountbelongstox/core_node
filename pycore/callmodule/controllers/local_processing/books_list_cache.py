# -*- coding: utf-8 -*-
"""Books drill-down list cache - on-disk plumbing for paginated lists.

Extracted from BooksController so the (stateless) cache read/write/fingerprint
logic is reusable independent of the controller's analyze/submit flow. The cache
lets paging a huge book reuse ONE extraction+tokenization pass instead of
re-reading the source every page.

A cache file ``<data>/pycore/books_cache/<source_key>.json`` holds the full
drill-down lists (words / sentences / unique_sentences / languages / chapters /
chapter_texts) stamped with a fingerprint (``abspath|size|mtime`` of the source
files). A mismatched/missing fingerprint self-heals by rebuilding, so a stale or
empty cached list is never served forever.

These helpers are PURE plumbing (path / fingerprint / write / precompute): they
take the controller's ``_list_files`` (formats-aware book enumeration) and
``_lists_from_text`` (pure tokenization) as callables, so this module has no
dependency on the controller and stays cycle-free.

TODO(reuse-batch): the pure ``_lists_from_text`` builder still lives in
books_controller.py; a later reuse batch should move it to
callmodule/services/processors/book_structure.py (it has no controller/IO state).
"""

import os
import json
import hashlib
from typing import Callable, List, Optional

from pycore import ColorPrint
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.callmodule.services.sync.laravel_media_sync import source_key_for

# Books data lives under the SHARED repo-local data dir (<core_node>/.data),
# namespaced "pycore/..." - mirroring the laravel Books path (.data/appqyv1/...)
# so both ends' Books scratch sits under the same shared .data area. Shared with
# books_controller.staging_dir, which imports this constant.
_BOOKS_NS = "pycore"
# Cached full drill-down lists (words/sentences/...) per source_key, so paging a
# huge book never re-extracts/re-tokenizes the source.
_LIST_CACHE_SUBDIR = "books_cache"


def list_cache_path(source_key: str) -> str:
    """Absolute cache file path for ``source_key`` (dir created on demand)."""
    d = os.path.join(str(get_local_data_dir()), _BOOKS_NS, _LIST_CACHE_SUBDIR)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, source_key + ".json")


def source_fingerprint(path: str, fmt_filter: Optional[set], max_files: int,
                       list_files: Callable[[str, Optional[set]], List[str]]) -> str:
    """A stable signature of a source's files (``abspath|size|mtime``).

    Used to validate the drill-down cache: when the underlying file changes (or a
    cache was written before the file was extractable), the fingerprint no longer
    matches and the cache is rebuilt - this self-heals a stale or empty cached
    list instead of serving 0 forever. ``list_files`` is the controller's
    ``_list_files`` (formats-aware book enumeration).
    """
    files = list_files(path, fmt_filter)[:max_files]
    if not files:
        return "empty"
    sig: List[str] = []
    for f in files:
        try:
            st = os.stat(f)
            sig.append(f"{os.path.abspath(f)}|{st.st_size}|{int(st.st_mtime)}")
        except OSError:
            sig.append(f"{os.path.abspath(f)}|?")
    return hashlib.sha1("\n".join(sig).encode("utf-8")).hexdigest()


def write_list_cache(path: str, fmt_filter: Optional[set], max_files: int,
                     data: dict,
                     list_files: Callable[[str, Optional[set]], List[str]]) -> None:
    """Persist drill-down lists for a source, stamped with its fingerprint."""
    stamped = {**data, "_fp": source_fingerprint(path, fmt_filter, max_files, list_files)}
    cache_file = list_cache_path(source_key_for(os.path.abspath(path)))
    with open(cache_file, "w", encoding="utf-8") as fh:
        json.dump(stamped, fh, ensure_ascii=False)


def maybe_cache_lists(path: str, mode: str, fmt_filter: Optional[set], text: str,
                      lists_from_text: Callable[..., dict],
                      list_files: Callable[[str, Optional[set]], List[str]]) -> None:
    """Precompute the drill-down cache from text extracted during analyze.

    Only for single-file sources with no format filter (the canonical list_items
    lookup uses ``formats=None``), and only when text was extracted - so opening
    the Words/Sentences list right after Analyze is instant rather than
    re-extracting the whole book. Folders build lazily on first open.
    ``lists_from_text`` is the controller's ``_lists_from_text`` (pure
    tokenization, no IO); ``list_files`` is its ``_list_files``.
    """
    if mode != "file" or fmt_filter is not None or not (text and text.strip()):
        return
    try:
        ext = os.path.splitext(path)[1].lower()
        data = lists_from_text(text, ext, os.path.abspath(path))
        # Keep the raw extracted text alongside the lists so a later submit can
        # ingest WITHOUT re-extracting the file (see BooksController._cached_full_text).
        data["full_text"] = text
        write_list_cache(path, None, 25, data, list_files)
    except OSError as e:
        ColorPrint.yellow(f"[BooksController] precompute list cache failed: {e}")
