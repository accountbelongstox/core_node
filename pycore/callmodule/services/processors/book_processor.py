# -*- coding: utf-8 -*-
"""
Book Processor - core logic for the "Book Ingestion" feature.

A pycore companion to VideoExtractProcessor, but for TEXT books in any common
document format (.txt/.md/.pdf/.docx/.doc/.epub/.html/.htm/.rtf). Unlike the
video path (which produces audio/video clips + segments),
a book maps ONLY to the shared sentence library: it has no video, no segments and
no clip uploads. Per book we:
  1. extract the full plain text,
  2. derive sentence rows in BOTH grains (per-line 'cue' + terminal-punctuation
     merged 'sentence'),
which the laravel_media_sync client then POSTs to /api/app_qy_v1/media/ingest with
``source_type:'book'``. The server computes a stable sentence_id and is fully
idempotent (fill-missing), so re-runs are safe and de-duplicate server-side.

Architecture notes (pycore):
  * Pure business logic — no HTTP/FastAPI dependency.
  * Logging only via ColorPrint (it streams to the desktop UI over the WS).
  * Reuses VideoExtractProcessor's ASCII filename transcoding
    (sanitize_relpath / to_english_ascii / _clean_token / _load_backends) and
    FileProcessor's pdfplumber / python-docx text extraction (no duplication).
  * extract_text NEVER raises — it returns '' on any failure and logs the cause.
"""

import json
import os
import re
import time
from typing import Any, Callable, Dict, List, Optional

from pycore import ColorPrint

# Reuse the video processor's ASCII filename transcoding (no duplication).
from pycore.callmodule.services.processors.video_extract_processor import (
    sanitize_relpath,
    _load_backends,
)


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
BOOK_EXTENSIONS = {
    ".txt", ".md", ".pdf", ".docx", ".doc",
    ".epub", ".html", ".htm", ".rtf",
}

# Marker/output dir written under a scanned FOLDER (skipped while scanning).
_RESULT_DIR_NAME = "_book_result"

# Sentence-terminal punctuation (Latin + CJK) used to re-split merged line text
# into real sentences — kept in sync with laravel_media_sync's splitter.
_TERMINAL_PUNCT = ".!?。！？…；"
_TERMINAL_RE = re.compile(r".*[" + re.escape(_TERMINAL_PUNCT) + r"]\s*$")


# --------------------------------------------------------------------------- #
# Scanning                                                                     #
# --------------------------------------------------------------------------- #
def iter_books(root: str):
    """Yield book file paths for ``root``.

    If ``root`` is a FILE → just that file (when its extension is a book type).
    If ``root`` is a DIR → every book file beneath it, recursively, skipping the
    ``_book_result`` marker/output dir (so re-runs never ingest their own output).
    """
    if not root:
        return
    root = os.path.abspath(root)
    if os.path.isfile(root):
        if os.path.splitext(root)[1].lower() in BOOK_EXTENSIONS:
            yield root
        return
    if not os.path.isdir(root):
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != _RESULT_DIR_NAME]
        for name in filenames:
            if os.path.splitext(name)[1].lower() in BOOK_EXTENSIONS:
                yield os.path.join(dirpath, name)


# --------------------------------------------------------------------------- #
# Text extraction (never raises — '' on failure)                              #
# --------------------------------------------------------------------------- #
def _read_text_file(path: str) -> str:
    """Read a .txt/.md file as text. Detect encoding via chardet if available,
    else fall back to utf-8 / utf-8-sig / latin-1. Returns '' on failure.
    """
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError as exc:
        ColorPrint.yellow(f"[BookProcessor] read failed {path}: {exc}")
        return ""
    if not raw:
        return ""
    # Prefer chardet's detected encoding when the package is importable.
    try:
        import chardet
        guess = chardet.detect(raw) or {}
        enc = guess.get("encoding")
        if enc:
            try:
                return raw.decode(enc, errors="replace")
            except (LookupError, UnicodeDecodeError):
                pass
    except Exception:
        pass
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _extract_epub(path: str) -> str:
    """Extract plain text from an .epub.

    Prefers ebooklib + BeautifulSoup when importable; otherwise falls back to a
    stdlib zipfile read + naive HTML-tag strip. Returns '' on failure.
    """
    # Preferred path: ebooklib + BeautifulSoup.
    try:
        import ebooklib
        from ebooklib import epub
        from bs4 import BeautifulSoup

        book = epub.read_epub(path)
        parts: List[str] = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            try:
                soup = BeautifulSoup(item.get_content(), "html.parser")
                text = soup.get_text(separator="\n")
                if text and text.strip():
                    parts.append(text)
            except Exception:
                continue
        if parts:
            return "\n\n".join(parts)
    except Exception:
        pass

    # Fallback: stdlib zipfile + naive HTML tag strip.
    try:
        import zipfile

        tag_re = re.compile(r"<[^>]+>")
        parts = []
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist()
                     if n.lower().endswith((".xhtml", ".html", ".htm"))]
            for name in names:
                try:
                    raw = zf.read(name)
                except Exception:
                    continue
                html = raw.decode("utf-8", errors="replace")
                text = tag_re.sub(" ", html)
                # collapse entities/whitespace minimally
                text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)
                if text and text.strip():
                    parts.append(text)
        if parts:
            return "\n\n".join(parts)
    except Exception as exc:
        ColorPrint.yellow(f"[BookProcessor] epub extract failed {path}: {exc}")
    return ""


def _strip_html(html: str) -> str:
    """Plain text from an HTML string. Prefers BeautifulSoup; stdlib tag-strip
    fallback. Returns '' for empty input.
    """
    if not (html and html.strip()):
        return ""
    # Preferred: BeautifulSoup (drops <script>/<style>, decodes entities).
    try:
        from pycore.pyfoundations.third_party import get_third_package_bs4
        BeautifulSoup = get_third_package_bs4()
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
        if text and text.strip():
            return text
    except Exception:
        pass
    # Fallback: naive tag + entity strip (same approach as the epub fallback).
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)
    return text


def _extract_html(path: str) -> str:
    """Extract plain text from an .html/.htm file. Returns '' on failure."""
    raw_text = _read_text_file(path)
    return _strip_html(raw_text)


def _extract_rtf(path: str) -> str:
    """Extract plain text from an .rtf file.

    Prefers striprtf when importable; otherwise a stdlib control-word strip.
    Returns '' on failure.
    """
    raw = _read_text_file(path)
    if not (raw and raw.strip()):
        return ""
    try:
        from pycore.pyfoundations.third_party import get_third_package_striprtf
        rtf_to_text = get_third_package_striprtf()
        text = rtf_to_text(raw)
        if text and text.strip():
            return text
    except Exception:
        pass
    # Fallback: drop RTF groups/control words (good enough for plain prose).
    text = re.sub(r"\\par[d]?", "\n", raw)
    text = re.sub(r"\\'[0-9a-fA-F]{2}", " ", text)     # hex-escaped chars
    text = re.sub(r"\\[a-zA-Z]+-?\d* ?", " ", text)    # control words
    text = text.replace("{", " ").replace("}", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return text


def _extract_doc(path: str) -> str:
    """Extract plain text from a legacy binary .doc file (best effort).

    No reliable pure-python reader exists for the old Word format, so we try, in
    order: Word COM automation (Windows + pywin32 + Word installed), then the
    antiword/catdoc CLI extractors (Debian side, installed by
    install_document_parsing.sh). Returns '' (with a hint) when none is available.
    """
    abs_path = os.path.abspath(path)
    # 1) Windows: Microsoft Word via COM automation (pywin32 ships in this env).
    if os.name == "nt":
        try:
            import win32com.client  # type: ignore
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            try:
                doc = word.Documents.Open(abs_path, ReadOnly=True)
                text = doc.Content.Text or ""
                doc.Close(False)
                if text.strip():
                    return text
            finally:
                word.Quit()
        except Exception as exc:
            ColorPrint.yellow(f"[BookProcessor] .doc Word COM failed {path}: {exc}")
    # 2) Linux/Mac: antiword / catdoc CLI.
    import shutil
    import subprocess
    for binary in ("antiword", "catdoc"):
        exe = shutil.which(binary)
        if not exe:
            continue
        try:
            proc = subprocess.run([exe, abs_path], capture_output=True,
                                  text=True, encoding="utf-8", errors="replace",
                                  timeout=120)
            if proc.returncode == 0 and (proc.stdout or "").strip():
                return proc.stdout
        except Exception as exc:
            ColorPrint.yellow(f"[BookProcessor] .doc {binary} failed {path}: {exc}")
    ColorPrint.yellow(
        f"[BookProcessor] .doc has no available extractor (need Word+pywin32 on "
        f"Windows, or antiword/catdoc on Linux): {path}")
    return ""


def extract_text(path: str) -> str:
    """Extract the full plain text of a book file. NEVER raises — returns '' on
    any failure (and logs the cause via ColorPrint).

    .txt/.md      -> stdlib read (chardet/utf-8 fallbacks)
    .pdf/.docx    -> FileProcessor (pdfplumber / python-docx)
    .doc          -> Word COM (Windows) / antiword|catdoc (Linux), best effort
    .epub         -> ebooklib+BeautifulSoup, else stdlib zipfile+tag-strip
    .html/.htm    -> BeautifulSoup, else stdlib tag-strip
    .rtf          -> striprtf, else stdlib control-word strip
    """
    if not (path and os.path.isfile(path)):
        return ""
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in (".txt", ".md"):
            return _read_text_file(path)
        if ext in (".pdf", ".docx"):
            from pycore.callmodule.services.processors.file_processor import FileProcessor
            proc = FileProcessor()
            result = proc.analyze_file(path, {"extract_text": True})
            if result.get("success"):
                return result.get("text_content") or ""
            ColorPrint.yellow(
                f"[BookProcessor] {ext} extract failed {path}: {result.get('error')}")
            return ""
        if ext == ".doc":
            return _extract_doc(path)
        if ext == ".epub":
            return _extract_epub(path)
        if ext in (".html", ".htm"):
            return _extract_html(path)
        if ext == ".rtf":
            return _extract_rtf(path)
    except Exception as exc:
        ColorPrint.yellow(f"[BookProcessor] extract_text failed {path}: {exc}")
        return ""
    return ""


# --------------------------------------------------------------------------- #
# Sentence segmentation (BOTH grains) — mirrors derive_sentences              #
# --------------------------------------------------------------------------- #
def segment_sentences(text: str, language: str = "en") -> List[Dict[str, Any]]:
    """Split ``text`` into sentence rows in BOTH grains (no timing for books).

    cue grain  — one row per non-empty line/paragraph (the source's natural unit).
    sentence grain — line text accumulated and re-split on terminal punctuation
        ``.!?。！？…；`` into real sentences (same rule as laravel_media_sync's
        derive_sentences).

    Each row: {grain, seq, text, language}. Returns [] for empty text.
    """
    rows: List[Dict[str, Any]] = []
    if not (text and text.strip()):
        return rows
    language = (language or "en").strip() or "en"

    # ---- cue grain: per non-empty line/paragraph --------------------------- #
    cue_seq = 0
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        cue_seq += 1
        rows.append({"grain": "cue", "seq": cue_seq, "text": line, "language": language})

    # ---- sentence grain: merge lines, re-split on terminal punctuation ------ #
    acc_parts: List[str] = []
    sent_seq = 0

    def _flush():
        nonlocal sent_seq, acc_parts
        merged = " ".join(p for p in acc_parts if p).strip()
        merged = re.sub(r"\s+", " ", merged)
        if merged:
            sent_seq += 1
            rows.append({"grain": "sentence", "seq": sent_seq,
                         "text": merged, "language": language})
        acc_parts = []

    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        acc_parts.append(line)
        if _TERMINAL_RE.match(" ".join(acc_parts)):
            _flush()
    _flush()  # trailing remainder that never hit terminal punctuation

    return rows


# --------------------------------------------------------------------------- #
# Processor                                                                    #
# --------------------------------------------------------------------------- #
class BookProcessor:
    """Batch / single book -> shared sentence library. pycore architecture.

    Mirrors VideoExtractProcessor's shape (preview / run with progress_cb +
    should_stop) but produces text-only sentence rows. The REAL idempotency is
    server-side (sentence_id dedup), so run() always re-derives; it additionally
    writes a small per-book marker under ``<output>/_book_result/<ascii>.json`` so
    re-runs are observable and never crash.
    """

    def _resolve_io(self, config: Dict[str, Any]):
        """Return (root, output_dir, books[], mode) or raise ValueError."""
        path = (config.get("path") or config.get("source_path") or "").strip()
        if not path:
            raise ValueError("path is required")
        path = os.path.abspath(path)

        if os.path.isfile(path):
            root = os.path.dirname(path)
            output_dir = os.path.abspath(config["output"]) if config.get("output") else root
            books = list(iter_books(path))
            return root, output_dir, books, "file"

        if not os.path.isdir(path):
            raise ValueError(f"Path not found: {path}")
        root = path
        output_dir = (os.path.abspath(config["output"]) if config.get("output")
                      else os.path.join(root, _RESULT_DIR_NAME))
        books = list(iter_books(root))
        return root, output_dir, books, "folder"

    # ----- dry-run preview ------------------------------------------------- #
    def preview(self, config: Dict[str, Any]) -> Dict[str, Any]:
        try:
            root, output_dir, books, mode = self._resolve_io(config)
        except ValueError as e:
            return {"success": False, "error": str(e)}
        rels = [os.path.relpath(b, root) for b in books]
        return {
            "success": True,
            "root": root,
            "output": output_dir,
            "books": rels,
            "count": len(rels),
            "extensions": sorted(BOOK_EXTENSIONS),
            "message": f"{len(rels)} book(s) found ({mode} mode).",
        }

    # ----- full run -------------------------------------------------------- #
    def run(self, config: Dict[str, Any],
            progress_cb: Optional[Callable[[int, Dict[str, Any]], None]] = None,
            should_stop: Optional[Callable[[], bool]] = None) -> Dict[str, Any]:
        start_time = time.time()
        logs: List[str] = []

        def log(msg: str):
            logs.append(msg)
            if len(logs) > 300:
                del logs[:len(logs) - 300]
            ColorPrint.blue("[BookProcessor] " + msg)

        def stopped() -> bool:
            return bool(should_stop and should_stop())

        try:
            root, output_dir, books, mode = self._resolve_io(config)
        except ValueError as e:
            return {"success": False, "error": str(e),
                    "execution_time": time.time() - start_time}

        language = (config.get("language") or config.get("lang") or "en").strip() or "en"
        backends = _load_backends(bool(config.get("translate")))
        os.makedirs(output_dir, exist_ok=True)
        result_dir = os.path.join(output_dir, _RESULT_DIR_NAME) \
            if os.path.basename(output_dir) != _RESULT_DIR_NAME else output_dir
        os.makedirs(result_dir, exist_ok=True)

        total = len(books)
        stats = {"books": 0, "ok": 0, "empty": 0, "failed": 0,
                 "sentences_cue": 0, "sentences_merged": 0}
        items: List[Dict[str, Any]] = []

        log(f"{total} book(s) to process ({mode} mode). output={output_dir}")

        def emit(idx: int, current: Optional[Dict[str, Any]] = None):
            if not progress_cb:
                return
            pct = int(idx / total * 100) if total else 100
            progress_cb(pct, {
                "processed": idx, "total": total, "mode": mode,
                "root": root, "output": output_dir,
                "stats": dict(stats), "items": items[-50:], "logs": logs[-60:],
                "current": current,
                "elapsed_total": round(time.time() - start_time, 2),
            })

        for idx, src in enumerate(books, 1):
            if stopped():
                log("Stop requested - aborting remaining books.")
                break
            stats["books"] += 1
            rel = os.path.relpath(src, root)
            _dir_parts, ascii_stem, _ext = sanitize_relpath(rel, backends)
            item: Dict[str, Any] = {
                "src": rel, "ascii": ascii_stem,
                "sentences_cue": 0, "sentences_merged": 0, "status": "ok",
            }
            log(f"[{idx}/{total}] {rel}")

            text = extract_text(src)
            if not (text and text.strip()):
                stats["empty"] += 1
                item["status"] = "empty"
                items.append(item)
                log("    skip: no extractable text")
                emit(idx, {"rel": rel})
                continue

            rows = segment_sentences(text, language)
            cue_n = sum(1 for r in rows if r.get("grain") == "cue")
            mer_n = sum(1 for r in rows if r.get("grain") == "sentence")
            stats["sentences_cue"] += cue_n
            stats["sentences_merged"] += mer_n
            stats["ok"] += 1
            item["sentences_cue"] = cue_n
            item["sentences_merged"] = mer_n

            # Write a small marker/mapping for observability + re-run friendliness.
            try:
                marker = os.path.join(result_dir, (ascii_stem or "book") + ".json")
                with open(marker, "w", encoding="utf-8") as fh:
                    json.dump({
                        "src": rel,
                        "abs": os.path.abspath(src),
                        "ascii": ascii_stem,
                        "language": language,
                        "char_count": len(text),
                        "sentences_cue": cue_n,
                        "sentences_merged": mer_n,
                        "updated_at": time.time(),
                    }, fh, ensure_ascii=False, indent=2)
                item["marker"] = marker
            except OSError as exc:
                log(f"    marker write failed: {exc}")

            items.append(item)
            log(f"    text: {len(text)} chars -> {cue_n} cue / {mer_n} sentence row(s)")
            emit(idx, {"rel": rel, "sentences_cue": cue_n, "sentences_merged": mer_n})

        result = {
            "success": True,
            "mode": mode,
            "root": root,
            "output": output_dir,
            "total": total,
            "processed": stats["books"],
            "stats": stats,
            "items": items,
            "logs": logs[-60:],
            "stopped": stopped(),
            "execution_time": time.time() - start_time,
            "message": f"Processed {stats['books']}/{total} book(s).",
        }
        return result
