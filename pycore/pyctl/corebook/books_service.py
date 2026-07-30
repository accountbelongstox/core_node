# -*- coding: utf-8 -*-
"""Books application service for local document analysis and preview.

Read-only companion to the HTTP ``book.sync_source`` ingest: lets the UI scan a
file/folder and see per-file + aggregate statistics (word / unique-word /
sentence / unique-sentence counts, per-language breakdown, top words) plus a text
preview BEFORE syncing anything to Laravel. No network, no DB — pure local work.

Document text is extracted by book_processor.extract_text (any supported format)
and statistics by the shared multi-language text statistics engine.
Every method is defensive: a single unreadable file yields an ``error`` row, not
an exception, so a folder scan never fails as a whole.
"""

import os
import json
import time
from typing import List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.pyfoundations.text_parsing import (
    guess_language,
    normalize_language_codes,
)
from pycore.pyutils.common.strtools.filename_sanitizer import sanitize_basename
from pycore.pyutils.common.strtools.text_statistics import compute_text_stats, merge_stats
from pycore.pyutils.document_processing.book_processor import (
    BOOK_EXTENSIONS,
    iter_books,
    extract_text,
    segment_chapters,
)
# v3 chapter->slot builder (shared correspondence slot shape). book_structure is
# app-layer and cycle-free from this controller.
from pycore.pyutils.document_processing.book_structure import (
    build_book_chapters_v3,
    lists_from_text,
)
# v2 submit (build_book_payload_v2 inside) + the stable per-source key. Importing
# the sync module here is app-layer (callmodule) and cycle-free.
from pycore.pyctl.laravel.sync.media_sync import (
    source_key_for,
    sync_book_source,
)
# On-disk drill-down list cache plumbing (extracted from this controller).
# Re-exported here via thin delegating methods so the public BooksController API
# and all internal call sites stay unchanged.
from pycore.pyctl.corebook.books_list_cache import (
    list_cache_path,
    source_fingerprint,
    write_list_cache,
    maybe_cache_lists,
)
from pycore.pyctl.corebook.books_query import (
    apply_query,
    apply_slot_query,
    normalize_formats,
)
# Books user-data persistence (the "books" section) - moved to books_state.py
# (reuse-batch); thin delegators below preserve the public API.
import pycore.pyctl.corebook.books_state as books_state

# _LIST_CACHE_SUBDIR lives in books_list_cache.py; staging_dir below uses
# get_local_data_dir() directly (the shared <cache>/pycore dir).
# Where drag-dropped uploads (no OS path in the browser sandbox) are staged on
# disk so they get a stable absolute path the ingest pipeline can read + key on.
_STAGING_SUBDIR = "books_staging"


from pycore.pyctl.corebook.models import (
    SupportedFormatsResponse,
    BookFileEntry,
    BooksScanResponse,
    BookFileAnalysis,
    BooksAnalyzeResponse,
    TextStats,
    ChapterInfo,
    BookSourceState,
    BooksStateResponse,
    BookSubmitItem,
    BooksSubmitResponse,
    BooksListResponse,
)


class BooksService:
    def __init__(self) -> None:
        self._store = user_data_store

    # ----- supported formats (sidebar filter) ----------------------------- #
    def supported_formats(self) -> SupportedFormatsResponse:
        return SupportedFormatsResponse(success=True, formats=sorted(BOOK_EXTENSIONS))

    # ----- helpers --------------------------------------------------------- #
    def _resolve(self, path: str):
        """Return (root, mode) for ``path`` or raise ValueError.

        mode is 'file' for a single book file, 'folder' for a directory.
        """
        path = (path or "").strip()
        if not path:
            raise ValueError("path is required")
        abs_path = os.path.abspath(path)
        if os.path.isfile(abs_path):
            return abs_path, "file"
        if os.path.isdir(abs_path):
            return abs_path, "folder"
        raise ValueError(f"Path not found: {abs_path}")

    def _list_files(self, path: str, fmt_filter: Optional[set]) -> List[str]:
        """All book files under ``path`` honoring an optional format filter."""
        files = []
        for f in iter_books(path):
            if fmt_filter is None or os.path.splitext(f)[1].lower() in fmt_filter:
                files.append(f)
        files.sort()
        return files

    def _entry(self, abs_file: str, root: str) -> BookFileEntry:
        try:
            size = os.path.getsize(abs_file)
        except OSError:
            size = 0
        rel = os.path.relpath(abs_file, root) if root and root != abs_file else os.path.basename(abs_file)
        return BookFileEntry(
            path=abs_file, rel=rel, name=os.path.basename(abs_file),
            ext=os.path.splitext(abs_file)[1].lower(), size_bytes=size)

    # ----- scan (fast, no extraction) -------------------------------------- #
    def scan(self, path: str, formats: Optional[List[str]] = None) -> BooksScanResponse:
        try:
            root, mode = self._resolve(path)
        except ValueError as e:
            return BooksScanResponse(success=False, error=str(e),
                                     supported_formats=sorted(BOOK_EXTENSIONS))
        fmt_filter = normalize_formats(formats)
        scan_root = root if mode == "folder" else os.path.dirname(root)
        files = self._list_files(root, fmt_filter)
        entries = [self._entry(f, scan_root) for f in files]
        return BooksScanResponse(
            success=True, root=root, mode=mode, files=entries, count=len(entries),
            formats=sorted(fmt_filter) if fmt_filter else sorted(BOOK_EXTENSIONS),
            supported_formats=sorted(BOOK_EXTENSIONS),
        )

    # ----- analyze (extract → stats + preview) ----------------------------- #
    def _analyze_one(self, abs_file: str, root: str, language: Optional[str],
                     preview_chars: int,
                     languages: Optional[List[str]] = None) -> Tuple[BookFileAnalysis, str]:
        """Analyze one file; return (analysis, extracted_text).

        The text is returned (not just the stats) so callers can reuse it to
        precompute the drill-down list cache without extracting the file twice.
        Also detects the chapter tree (v3) and resolves the effective checked
        language set (``languages`` filtered to the supported set, with the
        detected primary forced first).
        """
        entry = self._entry(abs_file, root)
        analysis = BookFileAnalysis(
            path=entry.path, rel=entry.rel, name=entry.name,
            ext=entry.ext, size_bytes=entry.size_bytes)
        try:
            text = extract_text(abs_file)
        except Exception as e:
            analysis.error = f"extract failed: {e}"
            return analysis, ""
        if not (text and text.strip()):
            analysis.error = "no extractable text"
            analysis.stats = TextStats()
            return analysis, ""
        stats_dict = compute_text_stats(text, language=language)
        analysis.stats = TextStats(**stats_dict)
        # Detected primary (auto-checked, §5) + the effective checked set.
        primary = (language or "").strip() or stats_dict.get("primary_language") or guess_language(text)
        if primary in ("und", "", None):
            primary = "en"
        selected = normalize_language_codes(languages, primary) or [primary]
        analysis.primary_language = primary
        analysis.selected_languages = selected
        # Chapter tree (v3.1): [{chapter_index, corr_id, titles, sentence_count}].
        analysis.chapters = self._chapter_infos(text, entry.ext, abs_file, primary, selected)
        if preview_chars > 0:
            preview = text[:preview_chars].strip()
            analysis.preview = preview + ("…" if len(text) > preview_chars else "")
        return analysis, text

    @staticmethod
    def _chapter_infos(text: str, ext: str, path: str, primary: str,
                       selected: Optional[List[str]] = None) -> List[ChapterInfo]:
        """Detected chapters with v3.1 per-language ``titles`` + corr_id.

        Delegates to the SAME v3 builder used for ingest so the per-language
        ``titles`` map (primary filled, every other selected language null), the
        cross-language ``corr_id`` and the sentence count are computed identically.
        """
        try:
            chapters = segment_chapters(text, ext, primary, path=path)
        except Exception:
            chapters = [{"chapter_index": 0, "title": "Chapter 1", "text": text}]
        sel = selected or [primary]
        source_key = source_key_for(os.path.abspath(path)) if path else ""
        tree = build_book_chapters_v3(chapters, source_key, sel, primary)
        out: List[ChapterInfo] = []
        for ch in (tree.get("chapters") or []):
            titles = ch.get("titles") or {}
            out.append(ChapterInfo(
                chapter_index=int(ch.get("chapter_index", 0) or 0),
                title=titles.get(primary) or "Chapter 1",
                titles=titles,
                corr_id=ch.get("corr_id") or "",
                sentence_count=int(ch.get("sentence_count", 0) or 0),
            ))
        return out

    def analyze(self, path: str, formats: Optional[List[str]] = None,
                language: Optional[str] = None, preview_chars: int = 800,
                max_files: int = 25, persist: bool = False,
                languages: Optional[List[str]] = None) -> BooksAnalyzeResponse:
        try:
            root, mode = self._resolve(path)
        except ValueError as e:
            return BooksAnalyzeResponse(success=False, error=str(e))

        fmt_filter = normalize_formats(formats)
        scan_root = root if mode == "folder" else os.path.dirname(root)
        all_files = self._list_files(root, fmt_filter)
        scanned = len(all_files)
        if scanned == 0:
            return BooksAnalyzeResponse(
                success=True, root=root, mode=mode, files=[], aggregate=None,
                scanned=0, analyzed=0, truncated_files=False)

        targets = all_files[:max_files]
        analyses: List[BookFileAnalysis] = []
        texts: List[str] = []
        for f in targets:
            a, t = self._analyze_one(f, scan_root, language, preview_chars, languages)
            analyses.append(a)
            if t:
                texts.append(t)

        # Folder aggregate (merge the per-file stats that actually parsed).
        stat_dicts = [a.stats.model_dump() for a in analyses if a.stats is not None]
        aggregate = TextStats(**merge_stats(stat_dicts)) if stat_dicts else None

        ColorPrint.blue(
            f"[BooksController] analyzed {len(targets)}/{scanned} book(s) under {root}")
        resp = BooksAnalyzeResponse(
            success=True, root=root, mode=mode, files=analyses, aggregate=aggregate,
            scanned=scanned, analyzed=len(targets), truncated_files=scanned > len(targets),
        )
        if persist:
            try:
                self.persist_analysis(path, mode, resp, language)
            except Exception as e:
                ColorPrint.yellow(f"[BooksController] persist_analysis failed: {e}")
            # Reuse the text we just extracted to populate the drill-down cache,
            # so the first Words/Sentences open is instant (single-file sources).
            self._maybe_cache_lists(path, mode, fmt_filter, "\n\n".join(texts))
        return resp

    # ----- upload + analyze (drag-drop fallback for sandboxed browsers) ---- #
    def staging_dir(self) -> str:
        """Absolute staging dir for uploads (created on demand), under the shared
        <cache>/pycore/books_staging."""
        d = os.path.join(str(get_local_data_dir()), _STAGING_SUBDIR)
        os.makedirs(d, exist_ok=True)
        return d

    def analyze_upload(self, uploads: List[Tuple[str, bytes]],
                       language: Optional[str] = None,
                       preview_chars: int = 800,
                       persist: bool = False,
                       languages: Optional[List[str]] = None,
                       source_type: str = "book") -> BooksAnalyzeResponse:
        """Stage uploaded file bytes to disk, then analyze each like a local file.

        ``uploads`` is a list of ``(filename, content_bytes)``. Each is saved
        under the staging dir (sanitized basename; re-uploading the same name
        overwrites, keeping a stable source_key for later sync). Unsupported
        extensions yield an ``error`` row instead of being saved. Returns the same
        shape as ``analyze`` with ``mode='upload'``; every file row carries its
        STAGED absolute ``path`` so the UI can sync it via ``book.sync_source``.

        ``source_type`` is ``"book"`` (default) or ``"document"`` (the Add Document
        sub-tab). Analysis is identical; it is persisted on each source record so a
        later ``submit`` ingests with the right ``source_type``.
        """
        source_type = source_type if source_type in ("book", "document") else "book"
        if not uploads:
            return BooksAnalyzeResponse(success=False, error="no files uploaded", mode="upload")
        root = self.staging_dir()
        analyses: List[BookFileAnalysis] = []
        for raw_name, content in uploads:
            safe = sanitize_basename(raw_name, fallback="book")
            ext = os.path.splitext(safe)[1].lower()
            if ext not in BOOK_EXTENSIONS:
                analyses.append(BookFileAnalysis(
                    path="", rel=safe, name=safe, ext=ext, size_bytes=len(content or b""),
                    error=f"unsupported format: {ext or '(none)'}"))
                continue
            dest = os.path.join(root, safe)
            try:
                with open(dest, "wb") as fh:
                    fh.write(content or b"")
            except OSError as e:
                analyses.append(BookFileAnalysis(
                    path="", rel=safe, name=safe, ext=ext,
                    size_bytes=len(content or b""), error=f"save failed: {e}"))
                continue
            a, text = self._analyze_one(dest, root, language, preview_chars, languages)
            analyses.append(a)
            # Each staged upload is a single-file source; precompute its drill-down
            # cache from the text just extracted so the Words list opens instantly.
            self._maybe_cache_lists(dest, "file", None, text)

        stat_dicts = [a.stats.model_dump() for a in analyses if a.stats is not None]
        aggregate = TextStats(**merge_stats(stat_dicts)) if stat_dicts else None
        ok_files = sum(1 for a in analyses if a.path)
        ColorPrint.blue(f"[BooksController] staged + analyzed {ok_files}/{len(uploads)} upload(s)")
        if persist:
            # Each staged file is its own tracked 'file' source (single-file summary).
            section = self._section()
            for a in analyses:
                if not a.path:
                    continue
                single = BooksAnalyzeResponse(
                    success=True, root=root, mode="file", files=[a],
                    aggregate=a.stats, scanned=1, analyzed=1, truncated_files=False)
                self._upsert_source(section, a.path, "file", language,
                                    analyzed_at=time.time(),
                                    source_type=source_type,
                                    summary=self._compact_summary(single))
            self._save_section(section)
        return BooksAnalyzeResponse(
            success=True, root=root, mode="upload", files=analyses, aggregate=aggregate,
            scanned=len(uploads), analyzed=ok_files, truncated_files=False,
        )

    # ----- persistence (the "books" user-data section) -------------------- #
    # Moved to books_state.py (reuse-batch). Thin delegators keep the public
    # API + internal call sites (analyze_upload / submit / analyze) unchanged;
    # self._store is the shared UserDataStore singleton.
    def _section(self) -> dict:
        return books_state.get_section(self._store)

    def _save_section(self, section: dict) -> None:
        books_state.save_section(self._store, section)

    def _state_response(self, section: dict) -> BooksStateResponse:
        return books_state.state_response(section)

    def get_state(self) -> BooksStateResponse:
        return books_state.get_state(self._store)

    def _upsert_source(self, section: dict, path: str, mode: str,
                       language: Optional[str] = None, **patch) -> dict:
        return books_state.upsert_source(section, path, mode, language, **patch)

    def add_source(self, path: str, mode: str = "file",
                   language: Optional[str] = None) -> BooksStateResponse:
        return books_state.add_source(self._store, path, mode, language)

    def remove_source(self, path: str) -> BooksStateResponse:
        return books_state.remove_source(self._store, path)

    @staticmethod
    def _compact_summary(a: BooksAnalyzeResponse) -> dict:
        return books_state.compact_summary(a)

    def persist_analysis(self, path: str, mode: str, analysis: BooksAnalyzeResponse,
                         language: Optional[str] = None) -> None:
        books_state.persist_analysis(self._store, path, mode, analysis, language)

    # ----- submit: build v3 payload + ingest ONCE, mark synced ------------- #
    def submit(self, paths: Optional[List[str]] = None,
               language: Optional[str] = None,
               languages: Optional[List[str]] = None,
               source_type: str = "book") -> BooksSubmitResponse:
        """Submit selected sources to laravel_main in one batch (v3 payload).

        For each source path: expand a folder to its book files (respecting the
        supported formats), sync each file via sync_book_source (which builds the
        v3 chapter->slot payload and POSTs /media/ingest), then mark the source
        'synced' and persist. The UI-checked correspondence language set
        ``languages`` (Lsel, >=1) is forwarded per file; the detected primary is
        auto-added and forced first downstream. Returns per-source results + totals.

        ``source_type`` is ``"book"`` (default) or ``"document"`` (Add Document
        sub-tab). It is forwarded to ``sync_book_source`` so the rows ingest under
        the right bucket; per-source it falls back to the value persisted at
        analyze time when the caller passes the default.
        """
        req_source_type = source_type if source_type in ("book", "document") else "book"
        # Validate the checked set when explicitly supplied: it must resolve to at
        # least one SUPPORTED language code, else the submit is rejected (§9 >=1).
        if languages is not None:
            cleaned = normalize_language_codes(languages)
            if not cleaned:
                return BooksSubmitResponse(
                    success=False,
                    error="languages must include at least one supported language code")
            languages = cleaned

        section = self._section()
        sources = section.get("sources", [])
        # Default to ALL persisted sources when no explicit paths are given.
        targets = [p for p in (paths or [s.get("path") for s in sources]) if p and str(p).strip()]
        items: List[BookSubmitItem] = []
        total_sentences = 0
        total_words = 0
        total_chapters = 0
        total_slots = 0
        any_fail = False

        for idx, path in enumerate(targets, 1):
            abs_path = os.path.abspath(path)
            # Coarse per-source progress (helps multi-source submits); the inner
            # sync_book_source streams the fine extract/build/ingest stages.
            try:
                THREAD_BUS.trigger_event(BusSignals.VIDEO_EXTRACT_SYNC, {
                    "stage": "source", "done": idx, "total": len(targets),
                    "detail": os.path.basename(abs_path), "kind": "book",
                })
            except Exception:
                pass
            is_dir = os.path.isdir(abs_path)
            files = list(iter_books(abs_path)) if is_dir else [abs_path]
            rec = next((s for s in sources if s.get("source_key") == source_key_for(abs_path)), None)
            lang = language or (rec.get("language") if rec else None) or "en"
            # Effective source_type: an explicit 'document' from the caller wins;
            # otherwise fall back to the value persisted at analyze time (so a
            # document analyzed earlier still submits as 'document').
            src_type = req_source_type
            if src_type == "book" and rec and rec.get("source_type") == "document":
                src_type = "document"
            src_ok = True
            src_sent = 0
            src_word = 0
            src_chap = 0
            src_slot = 0
            src_selected: List[str] = []
            errs: List[str] = []
            # Precompute the drill-down cache from the text sync already extracts
            # (no second extraction). To match list_items exactly, capture text
            # ONLY for the files it would use — the first 25 in _list_files order
            # (sorted) — for both single-file and folder sources. This also bounds
            # memory: at most 25 texts are held, regardless of folder size.
            cache_files = self._list_files(abs_path, None)[:25] if is_dir else [abs_path]
            cache_set = {os.path.abspath(p) for p in cache_files}
            captured = {}  # abspath -> extracted text (cache_files only)
            used_fresh = False  # any file needed a fresh extraction (cache miss)?
            for f in files:
                want_text = os.path.abspath(f) in cache_set
                sink: List[str] = []
                # Reuse the text analyze already extracted (single-file sources)
                # so a big PDF/EPUB is not read off disk a second time. Folders
                # keep their per-file extraction (the cache holds joined text).
                reuse = self._cached_full_text(f) if not is_dir else None
                if reuse is None:
                    used_fresh = True
                try:
                    r = sync_book_source(f, language=lang, text=reuse, languages=languages,
                                         on_text=(sink.append if want_text else None),
                                         source_type=src_type)
                except Exception as e:
                    src_ok = False
                    errs.append(f"{os.path.basename(f)}: {e}")
                    continue
                if want_text and sink:
                    captured[os.path.abspath(f)] = sink[0]
                if r.get("success"):
                    src_sent += int(r.get("sentences") or 0)
                    src_word += int(r.get("words") or 0)
                    src_chap += int(r.get("chapters") or 0)
                    src_slot += int(r.get("slots") or 0)
                    if not src_selected and r.get("selected_languages"):
                        src_selected = list(r.get("selected_languages") or [])
                else:
                    src_ok = False
                    errs.extend(r.get("errors") or [f"{os.path.basename(f)}: failed"])
            # Build the cache in _list_files order so it is byte-for-byte what the
            # lazy _build_lists would produce. Independent of Laravel ingest success
            # (the drill-down is pure local analysis).
            # Only (re)build the drill-down cache when something was freshly
            # extracted; if every file's text was reused from cache, the cache is
            # already valid and re-tokenizing the whole book would be wasted work.
            if captured and used_fresh:
                joined = "\n\n".join(
                    captured[os.path.abspath(p)] for p in cache_files
                    if os.path.abspath(p) in captured)
                if joined.strip():
                    try:
                        data = self._lists_from_text(joined)
                        # Preserve the raw text for single-file sources so a later
                        # submit can again skip re-extraction (folders omit it).
                        if not is_dir:
                            data["full_text"] = joined
                        self._write_list_cache(abs_path, None, 25, data)
                    except OSError as e:
                        ColorPrint.yellow(f"[BooksController] submit precompute cache failed: {e}")
            total_sentences += src_sent
            total_words += src_word
            total_chapters += src_chap
            total_slots += src_slot
            if not src_ok:
                any_fail = True
            if rec is not None and src_ok:
                rec["submission_state"] = "synced"
                rec["synced_at"] = time.time()
                rec["source_type"] = src_type
                if src_selected:
                    rec["selected_languages"] = src_selected
            # Append a cross-feature content-ingest history entry (capped ring in
            # the unified user-data store). Best-effort: never breaks the submit.
            try:
                user_data_store.record_content_history({
                    "type": src_type,
                    "source_key": source_key_for(abs_path),
                    "path": abs_path,
                    "title": os.path.splitext(os.path.basename(abs_path))[0] or os.path.basename(abs_path),
                    "languages": src_selected or ([lang] if lang else []),
                    "counts": {"chapters": src_chap, "slots": src_slot,
                               "sentences": src_sent},
                    "status": "ok" if src_ok else "failed",
                    "ts": time.time(),
                })
            except Exception as e:
                ColorPrint.yellow(f"[BooksController] content history record failed: {e}")
            items.append(BookSubmitItem(
                path=abs_path, files=len(files), sentences=src_sent,
                words=src_word, chapters=src_chap, slots=src_slot,
                selected_languages=src_selected, success=src_ok, errors=errs or None))
        self._save_section(section)
        ColorPrint.blue(
            f"[BooksController] submitted {len(targets)} source(s): "
            f"{total_chapters} chapter(s) / {total_slots} slot(s) "
            f"({total_sentences} sentence(s))")
        return BooksSubmitResponse(
            success=not any_fail, items=items,
            total_sentences=total_sentences, total_words=total_words,
            total_chapters=total_chapters, total_slots=total_slots)

    # ----- drill-down lists (paginated words / sentences / languages) ------ #
    # On-disk drill-down cache plumbing now lives in books_list_cache.py (path /
    # fingerprint / write / precompute); these thin delegators pass the
    # controller's _list_files + _lists_from_text callables so all internal call
    # sites (self._maybe_cache_lists / self._write_list_cache / ...) stay unchanged
    # and the public BooksController API is preserved.
    def _list_cache_path(self, source_key: str) -> str:
        return list_cache_path(source_key)

    def _source_fingerprint(self, path: str, fmt_filter: Optional[set],
                            max_files: int) -> str:
        return source_fingerprint(path, fmt_filter, max_files, self._list_files)

    # Drill-down list builder moved to book_structure.lists_from_text (reuse-batch:
    # pure text->words/sentences/chapters, no IO/state). Thin delegator keeps the
    # internal call sites (_build_lists / _maybe_cache_lists / submit) unchanged.
    def _lists_from_text(self, all_text: str, ext: str = "",
                         path: Optional[str] = None) -> dict:
        return lists_from_text(all_text, ext, path)

    def _build_lists(self, path: str, fmt_filter: Optional[set],
                     max_files: int) -> dict:
        """Build the full drill-down lists for a source (single file or folder).

        Heavy (re-extracts + tokenizes) — callers cache the result. analyze /
        analyze-upload precompute this from text they ALREADY extracted (see
        _maybe_cache_lists), so the first drill-down open is normally a cache hit.
        """
        files = self._list_files(path, fmt_filter)[:max_files]
        parts: List[str] = []
        for f in files:
            try:
                t = extract_text(f)
            except Exception:
                t = ""
            if t and t.strip():
                parts.append(t)
        # For a single-file source, pass its ext + path so chapter detection can
        # use the format-specific splitter (epub spine / html headings). A folder
        # joins multiple files, so chapter detection falls back to heuristics.
        if len(files) == 1:
            ext = os.path.splitext(files[0])[1].lower()
            return self._lists_from_text("\n\n".join(parts), ext, files[0])
        return self._lists_from_text("\n\n".join(parts))

    def _write_list_cache(self, path: str, fmt_filter: Optional[set],
                          max_files: int, data: dict) -> None:
        write_list_cache(path, fmt_filter, max_files, data, self._list_files)

    def _maybe_cache_lists(self, path: str, mode: str,
                           fmt_filter: Optional[set], text: str) -> None:
        maybe_cache_lists(path, mode, fmt_filter, text,
                          self._lists_from_text, self._list_files)

    def _cached_full_text(self, path: str) -> Optional[str]:
        """Return the cached extracted text for a single-file source, or None.

        Validates the cache against the file's current fingerprint (size+mtime)
        so a changed file is re-extracted rather than served stale. Lets submit
        skip a second (slow) extraction of a file analyze already read.
        """
        cache_file = self._list_cache_path(source_key_for(os.path.abspath(path)))
        if not os.path.isfile(cache_file):
            return None
        try:
            with open(cache_file, "r", encoding="utf-8") as fh:
                cached = json.load(fh)
        except Exception:
            return None
        if not isinstance(cached, dict):
            return None
        text = cached.get("full_text")
        if not (isinstance(text, str) and text.strip()):
            return None
        if cached.get("_fp") != self._source_fingerprint(path, None, 25):
            return None
        return text

    # Drill-down kinds that map to a v3 correspondence GRAIN when chapter-scoped.
    # 'cues' -> grain 'cue'; 'sentences'/'unique_sentences' -> grain 'sentence'.
    _GRAIN_KINDS = {"sentences": "sentence", "unique_sentences": "sentence", "cues": "cue"}

    def list_items(self, path: str, kind: str = "words", start: int = 0,
                   limit: int = 100, formats: Optional[List[str]] = None,
                   language: Optional[str] = None, refresh: bool = False,
                   max_files: int = 25,
                   chapter_index: Optional[int] = None,
                   languages: Optional[List[str]] = None,
                   grain: Optional[str] = None,
                   sort_order: Optional[str] = None,
                   query: Optional[str] = None,
                   view_language: Optional[str] = None) -> BooksListResponse:
        """One page of a source's drill-down list (fingerprint-validated cache).

        Supports the v3 chapter tree:
          * ``kind='chapters'`` -> ``[{chapter_index,title,sentence_count}]``.
          * ``kind`` in {'sentences','unique_sentences','cues'} WITH a
            ``chapter_index`` -> the FE ``BookSlot[]`` correspondence shape scoped
            to that chapter + grain ('cues'=>cue, else sentence), honoring the
            ``languages`` checked set (primary text filled, every other selected
            language ``null``). An explicit ``grain`` overrides the kind->grain map.
          * Every non-chapter (whole-source) list is unchanged ({word,count} /
            {seq,text,chapter_index} / language rows).
        """
        try:
            self._resolve(path)
        except ValueError as e:
            return BooksListResponse(success=False, kind=kind, error=str(e))

        fmt_filter = normalize_formats(formats)
        cache_file = self._list_cache_path(source_key_for(os.path.abspath(path)))
        fingerprint = self._source_fingerprint(path, fmt_filter, max_files)
        data = None
        if not refresh and os.path.isfile(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as fh:
                    cached = json.load(fh)
                # Reuse ONLY when the source is unchanged AND the cache has the
                # v3.1 chapter tree (per-language ``titles``) + raw chapter texts.
                # A cache without _fp/chapter_texts, or whose chapters lack the
                # ``titles`` map (pre-v3.1), or with a mismatched _fp is rebuilt —
                # this heals an empty-list cache and migrates older caches forward.
                cached_chapters = cached.get("chapters") if isinstance(cached, dict) else None
                has_titles = bool(cached_chapters) and isinstance(cached_chapters[0], dict) \
                    and "titles" in cached_chapters[0]
                if (isinstance(cached, dict) and cached.get("_fp") == fingerprint
                        and "chapter_texts" in cached
                        and (has_titles or cached_chapters == [])):
                    data = cached
            except Exception:
                data = None
        if data is None:
            data = self._build_lists(path, fmt_filter, max_files)
            # Cache only a build that actually extracted text; a transient
            # extraction failure (0 chars) is returned but NOT frozen, so the
            # next open retries instead of serving a permanent empty list.
            if (data.get("totals") or {}).get("chars", 0) > 0:
                try:
                    self._write_list_cache(path, fmt_filter, max_files, data)
                except OSError as e:
                    ColorPrint.yellow(f"[BooksController] list cache write failed: {e}")

        start = max(0, int(start))
        limit = max(1, min(1000, int(limit)))

        # ---- chapter-scoped correspondence slots (FE BookSlot[]) --------------- #
        # When a grain-kind is requested for ONE chapter, return the v3 slot shape
        # (corr_id/grain/seq/chapter_index/primary_language/langs) instead of bare
        # {seq,text}, rebuilt from the cached raw chapter text honoring `languages`.
        want_grain = grain or self._GRAIN_KINDS.get(kind)
        if chapter_index is not None and want_grain in ("cue", "sentence"):
            slots = self._chapter_slots(
                data, path, int(chapter_index), want_grain, languages, language)
            primary = (language or "").strip() or (data.get("primary_language") or "en")
            selected = normalize_language_codes(languages, primary) or [primary]
            slots = apply_slot_query(slots, query, view_language)
            if view_language:
                kind = f"sentences_{view_language}"
            total = len(slots)
            page = slots[start:start + limit]
            return BooksListResponse(
                success=True, kind=kind, total=total, start=start, limit=limit,
                chapter_index=int(chapter_index), items=page,
                selected_languages=selected,
                totals=data.get("totals") or {})

        # 'words' and 'unique_words' share the distinct-frequency list; 'chapters'
        # serves the chapter tree directly.
        list_key = {"unique_words": "words"}.get(kind, kind)
        items = list(data.get(list_key) or [])
        if chapter_index is not None and kind in ("sentences", "unique_sentences", "cues"):
            ci = int(chapter_index)
            items = [i for i in items if int(i.get("chapter_index", 0) or 0) == ci]
        if kind in ("sentences", "unique_sentences", "cues"):
            items = apply_query(items, query)
        if kind in ("words", "unique_words"):
            order = (sort_order or "desc").strip().lower()
            if order == "asc":
                items.sort(key=lambda w: int(w.get("count", 0) or 0))
            elif order == "desc":
                items.sort(key=lambda w: int(w.get("count", 0) or 0), reverse=True)
        total = len(items)
        page = items[start:start + limit]
        sel = None
        if kind == "chapters":
            primary = (language or "").strip() or (data.get("primary_language") or "en")
            sel = normalize_language_codes(languages, primary) or [primary]
        return BooksListResponse(
            success=True, kind=kind, total=total, start=start, limit=limit,
            chapter_index=int(chapter_index) if chapter_index is not None else None,
            items=page, selected_languages=sel,
            totals=data.get("totals") or {})

    def _chapter_slots(self, data: dict, path: str, chapter_index: int,
                       grain: str, languages: Optional[List[str]],
                       language: Optional[str]) -> List[dict]:
        """Build the FE ``BookSlot[]`` for ONE chapter + grain from cached text.

        Reuses the SAME v3 slot builder (``build_book_chapters_v3``) as submit, so
        each slot carries ``{corr_id, grain, seq, chapter_index, primary_language,
        langs}`` where ``langs`` has the primary text filled and every other checked
        language ``null``. The cached ``chapter_texts`` provides the raw body, so no
        re-extraction happens. Returns [] for an unknown chapter.
        """
        chapter_texts = data.get("chapter_texts") or []
        target = next((c for c in chapter_texts
                       if int(c.get("chapter_index", 0) or 0) == chapter_index), None)
        if target is None:
            return []

        # Detected/declared primary (auto-checked, forced first). Use the whole
        # source's primary so the language set is stable across chapters.
        primary = (language or "").strip() or (data.get("primary_language") or "")
        if not primary:
            primary = guess_language(target.get("text") or "")
        if primary in ("und", "", None):
            primary = "en"
        selected = normalize_language_codes(languages, primary) or [primary]

        # corr_id/seq must agree with the whole-book ingest contract
        # (seq is GLOBAL per grain). Feed every chapter UP TO AND INCLUDING the
        # target so the builder assigns the same global seqs submit posts; later
        # chapters cannot affect the target's seqs, so they are skipped for cost.
        ordered = sorted(
            (c for c in chapter_texts if int(c.get("chapter_index", 0) or 0) <= chapter_index),
            key=lambda c: int(c.get("chapter_index", 0) or 0))
        chapters_input = [{"chapter_index": int(c.get("chapter_index", 0) or 0),
                           "title": c.get("title") or "", "text": c.get("text") or ""}
                          for c in ordered]

        source_key = source_key_for(os.path.abspath(path))
        tree = build_book_chapters_v3(chapters_input, source_key, selected, primary)

        return [s for s in (tree.get("slots") or [])
                if s.get("grain") == grain
                and int(s.get("chapter_index", 0) or 0) == chapter_index]


books_service = BooksService()
