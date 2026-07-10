# -*- coding: utf-8 -*-
"""
Book text extraction - format-specific plain-text extractors for the Book
Ingestion feature.

Split out of book_processor.py (modular 800-line rule). Each extractor reads a
single source format and returns its full plain text. extract_text NEVER raises
- it returns '' on any failure and logs the cause via ColorPrint. The dispatcher
``extract_text`` lives in book_processor.py and imports these private
``_extract_*`` helpers (no public API surface here).

Reuse-first: every optional third-party reader is obtained via the lazy
third_party getters (get_third_package_chardet / get_third_package_bs4 /
get_third_package_ebooklib / get_third_package_striprtf), so a missing dep is
auto-installed on first use and gracefully degrades to a stdlib fallback. This
fixes the previous inconsistency where _strip_html/_extract_rtf used the getters
but _read_text_file/_extract_epub/_chapters_from_epub used bare imports, and a
latent bug where get_third_package_bs4() (the MODULE) was being called as a
constructor (TypeError -> silent stdlib fallback).
"""

import os
import re
import shutil
import subprocess
import zipfile
from typing import List

from pycore import ColorPrint


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
        from pycore.pyfoundations.third_party import get_third_package_chardet
        chardet = get_third_package_chardet()
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
    # Preferred path: ebooklib + BeautifulSoup (both via lazy getters).
    try:
        from pycore.pyfoundations.third_party import (
            get_third_package_ebooklib,
            get_third_package_bs4,
        )
        ebooklib = get_third_package_ebooklib()
        epub = ebooklib.epub
        BeautifulSoup = get_third_package_bs4().BeautifulSoup

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
    # get_third_package_bs4() returns the MODULE - pull the class off it (the
    # previous code called the module as a constructor, a latent TypeError that
    # silently fell back to the stdlib strip on every HTML/epub document).
    try:
        from pycore.pyfoundations.third_party import get_third_package_bs4
        BeautifulSoup = get_third_package_bs4().BeautifulSoup
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
