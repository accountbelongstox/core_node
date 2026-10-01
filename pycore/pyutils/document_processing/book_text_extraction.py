# -*- coding: utf-8 -*-
"""
Book text extraction - format-specific plain-text extractors for Book Ingestion.

Each extractor reads one source format and returns its full plain text, or ''
on failure (the cause is reported via ColorPrint). The dispatcher
``extract_text`` lives in book_processor.py. Third-party readers come from the
lazy third_party getters.
"""

import os
import re
import shutil
import subprocess
import zipfile
from typing import List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_bs4,
    get_third_package_chardet,
    get_third_package_ebooklib,
    get_third_package_striprtf,
    get_third_package_win32com_client,
)

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&[a-zA-Z#0-9]+;")


def _read_text_file(path: str) -> str:
    """Read a .txt/.md file as text using the chardet-detected encoding, falling
    back to utf-8 / utf-8-sig / latin-1. Returns '' on failure.
    """
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError as exc:
        ColorPrint.yellow(f"[BookProcessor] read failed {path}: {exc}")
        return ""
    if not raw:
        return ""
    detected = (get_third_package_chardet().detect(raw) or {}).get("encoding")
    for enc in ([detected] if detected else []) + ["utf-8-sig", "utf-8", "latin-1"]:
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", errors="replace")


def _epub_text_from_zip(path: str) -> str:
    """Degraded epub reader for archives ebooklib rejects: zip read + tag strip."""
    parts: List[str] = []
    try:
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if not name.lower().endswith((".xhtml", ".html", ".htm")):
                    continue
                html = zf.read(name).decode("utf-8", errors="replace")
                text = _HTML_ENTITY_RE.sub(" ", _HTML_TAG_RE.sub(" ", html))
                if text.strip():
                    parts.append(text)
    except (OSError, zipfile.BadZipFile, KeyError) as exc:
        ColorPrint.yellow(f"[BookProcessor] epub zip extract failed {path}: {exc}")
        return ""
    return "\n\n".join(parts)


def _extract_epub(path: str) -> str:
    """Extract plain text from an .epub via ebooklib + BeautifulSoup; malformed
    archives fall back to a plain zip read. Returns '' on failure.
    """
    ebooklib = get_third_package_ebooklib()
    epub = ebooklib.epub
    beautiful_soup = get_third_package_bs4().BeautifulSoup
    try:
        book = epub.read_epub(path)
    except (OSError, zipfile.BadZipFile, KeyError, epub.EpubException) as exc:
        ColorPrint.yellow(f"[BookProcessor] ebooklib could not read {path}: {exc}; using zip fallback")
        return _epub_text_from_zip(path)
    parts = [
        text for text in (
            beautiful_soup(item.get_content(), "html.parser").get_text(separator="\n")
            for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT)
        ) if text and text.strip()
    ]
    return "\n\n".join(parts)


def _strip_html(html: str) -> str:
    """Plain text from an HTML string (drops <script>/<style>, decodes entities)."""
    if not (html and html.strip()):
        return ""
    soup = get_third_package_bs4().BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup.get_text(separator="\n")


def _extract_html(path: str) -> str:
    """Extract plain text from an .html/.htm file. Returns '' on failure."""
    return _strip_html(_read_text_file(path))


def _extract_rtf(path: str) -> str:
    """Extract plain text from an .rtf file via striprtf. Returns '' on failure."""
    raw = _read_text_file(path)
    if not (raw and raw.strip()):
        return ""
    return get_third_package_striprtf()(raw)


def _extract_doc_with_word(path: str) -> str:
    win32com_client = get_third_package_win32com_client()
    try:
        word = win32com_client.Dispatch("Word.Application")
        word.Visible = False
        try:
            doc = word.Documents.Open(path, ReadOnly=True)
            text = doc.Content.Text or ""
            doc.Close(False)
        finally:
            word.Quit()
    except win32com_client.pythoncom.com_error as exc:
        ColorPrint.yellow(f"[BookProcessor] .doc Word COM failed {path}: {exc}")
        return ""
    return text


def _extract_doc(path: str) -> str:
    """Extract plain text from a legacy binary .doc file (best effort).

    Tries Word COM automation on Windows, then the antiword/catdoc CLI
    extractors. Returns '' (with a hint) when none is available.
    """
    abs_path = os.path.abspath(path)
    if os.name == "nt":
        text = _extract_doc_with_word(abs_path)
        if text.strip():
            return text
    for binary in ("antiword", "catdoc"):
        exe = shutil.which(binary)
        if not exe:
            continue
        try:
            proc = subprocess.run([exe, abs_path], capture_output=True,
                                  text=True, encoding="utf-8", errors="replace",
                                  timeout=120)
        except (OSError, subprocess.TimeoutExpired) as exc:
            ColorPrint.yellow(f"[BookProcessor] .doc {binary} failed {path}: {exc}")
            continue
        if proc.returncode == 0 and (proc.stdout or "").strip():
            return proc.stdout
    ColorPrint.yellow(
        f"[BookProcessor] .doc has no available extractor (need Word+pywin32 on "
        f"Windows, or antiword/catdoc on Linux): {path}")
    return ""
