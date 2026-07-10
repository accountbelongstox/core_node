# -*- coding: utf-8 -*-
"""
Books models (request/response) for the document analyze/preview API.

Back the Books page's "drop a file/folder → see stats + preview BEFORE syncing"
flow over HTTP (prefix /api/local/books). Statistics are computed by the
multi-language engine pycore.pyutils.text_stats.compute_text_stats; document text
is extracted by callmodule.services.processors.book_processor.extract_text.

These responses carry NO Laravel coupling — they are a local, read-only preview.
The actual ingest still goes over the WS RPC ``book.sync_source``.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Statistics shapes (mirror compute_text_stats output)                         #
# --------------------------------------------------------------------------- #
class LanguageRow(BaseModel):
    """One language/script slice of a document's letters."""
    script: str = Field(..., description="Unicode script key (han/latin/cyrillic/...).")
    code: str = Field(..., description="Heuristic language code (zh/ja/en/ru/...).")
    chars: int = Field(0, description="Letters counted for this script.")
    ratio: float = Field(0.0, description="Share of all counted letters (0..1).")


class TopWord(BaseModel):
    """A frequent word and its occurrence count (case-folded)."""
    word: str
    count: int


class TextStats(BaseModel):
    """Multi-language statistics for a document (or a folder aggregate)."""
    char_count: int = 0
    char_count_no_space: int = 0
    word_count: int = 0
    unique_word_count: int = 0
    sentence_count: int = 0
    unique_sentence_count: int = 0
    line_count: int = 0
    paragraph_count: int = 0
    primary_language: str = "und"
    languages: List[LanguageRow] = Field(default_factory=list)
    top_words: List[TopWord] = Field(default_factory=list)
    truncated: bool = False


# --------------------------------------------------------------------------- #
# Supported formats (sidebar filter)                                           #
# --------------------------------------------------------------------------- #
class SupportedFormatsResponse(BaseModel):
    """The document extensions the Books pipeline can ingest (for the filter)."""
    success: bool
    formats: List[str] = Field(default_factory=list,
                               description="Lower-case extensions incl. leading dot, sorted.")
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# Scan (fast folder/file listing — no extraction)                              #
# --------------------------------------------------------------------------- #
class BookFileEntry(BaseModel):
    """A discovered book file (metadata only — no text extracted yet)."""
    path: str = Field(..., description="Absolute file path.")
    rel: str = Field("", description="Path relative to the scanned root.")
    name: str = Field(..., description="File name.")
    ext: str = Field("", description="Lower-case extension incl. leading dot.")
    size_bytes: int = Field(0, description="File size in bytes.")


class BooksScanRequest(BaseModel):
    """Recursively list book files under a path (folder) or echo a single file."""
    path: str = Field(..., description="Absolute folder or file path.")
    formats: Optional[List[str]] = Field(
        None, description="Restrict to these extensions (e.g. ['.pdf','.txt']); "
                          "omit/empty = all supported formats.")


class BooksScanResponse(BaseModel):
    """Result of a (fast, extraction-free) scan."""
    success: bool
    root: str = ""
    mode: str = Field("", description="'file' or 'folder'.")
    files: List[BookFileEntry] = Field(default_factory=list)
    count: int = 0
    formats: List[str] = Field(default_factory=list, description="Effective format filter applied.")
    supported_formats: List[str] = Field(default_factory=list)
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# Analyze (extract text → stats + preview)                                     #
# --------------------------------------------------------------------------- #
class ChapterInfo(BaseModel):
    """One detected chapter of a book (v3.1 chapter->slot tree, §3.2/§7/§8).

    A book with no detectable headings yields exactly one chapter
    (``chapter_index=0``, title ``"Chapter 1"``) covering all sentences.
    """
    chapter_index: int = Field(0, description="0-based chapter order.")
    title: str = Field("", description="Primary-language chapter title (back-compat).")
    titles: Dict[str, Optional[str]] = Field(
        default_factory=dict,
        description="Per-language chapter title map {code: title|null}; only the "
                    "detected primary is filled, every other selected language null.")
    corr_id: str = Field(
        "", description="sha1(source_key|chapter|chapter_index) cross-language group id.")
    sentence_count: int = Field(0, description="Sentence-grain slots under this chapter.")


class BookFileAnalysis(BaseModel):
    """Per-file analysis: metadata + multi-language stats + a text preview."""
    path: str
    rel: str = ""
    name: str
    ext: str = ""
    size_bytes: int = 0
    stats: Optional[TextStats] = None
    preview: str = Field("", description="First N characters of the extracted text.")
    chapters: List[ChapterInfo] = Field(
        default_factory=list,
        description="Detected chapters (v3): [{chapter_index, title, sentence_count}].")
    primary_language: str = Field(
        "und", description="Detected primary language code (L0).")
    selected_languages: List[str] = Field(
        default_factory=list,
        description="The checked language set used for analysis (Lsel, >=1, includes L0).")
    error: Optional[str] = Field(None, description="Set when this file could not be read.")


class BooksAnalyzeRequest(BaseModel):
    """Analyze a single file, or a folder (scan + analyze up to ``max_files``)."""
    path: str = Field(..., description="Absolute folder or file path.")
    formats: Optional[List[str]] = Field(
        None, description="Restrict folder scans to these extensions; omit = all supported.")
    language: Optional[str] = Field(
        None, description="Declared primary language; omitted = auto-detect per file.")
    languages: Optional[List[str]] = Field(
        None, description="The checked correspondence language set (Lsel, >=1; the "
                          "detected primary is auto-added and forced first). Omitted "
                          "= just the detected/declared primary.")
    preview_chars: int = Field(800, ge=0, le=20000, description="Preview length per file.")
    max_files: int = Field(25, ge=1, le=500, description="Cap analyzed files for a folder.")
    persist: bool = Field(False, description="Persist a compact summary to the 'books' state.")


class BooksAnalyzeResponse(BaseModel):
    """Per-file analyses + a folder-level aggregate."""
    success: bool
    root: str = ""
    mode: str = Field("", description="'file' or 'folder' or 'upload'.")
    files: List[BookFileAnalysis] = Field(default_factory=list)
    aggregate: Optional[TextStats] = Field(
        None, description="Merged stats across analyzed files (unique_* are per-file sums).")
    scanned: int = Field(0, description="Total book files discovered.")
    analyzed: int = Field(0, description="Files actually analyzed (<= max_files).")
    truncated_files: bool = Field(False, description="True when scanned > analyzed (cap hit).")
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# Persisted state (the "books" user-data section) + batch submit              #
# --------------------------------------------------------------------------- #
class BookSourceState(BaseModel):
    """A persisted Books source + its (compact) analysis + submission state."""
    path: str
    mode: str = "file"
    source_key: str = ""
    language: Optional[str] = None
    source_type: str = Field(
        "book", description="'book' (default) or 'document' (Add Document sub-tab).")
    selected_languages: List[str] = Field(
        default_factory=list,
        description="Last submitted correspondence language set (Lsel) for this source.")
    submission_state: str = Field("draft", description="'draft' | 'synced'.")
    added_at: Optional[float] = None
    analyzed_at: Optional[float] = None
    synced_at: Optional[float] = None
    summary: Optional[dict] = Field(
        None, description="Compact analysis summary {scanned, analyzed, mode, aggregate, files[]}.")


class BooksStateResponse(BaseModel):
    """The full persisted Books state (sources reload on UI reopen)."""
    success: bool
    sources: List[BookSourceState] = Field(default_factory=list)
    last_options: dict = Field(default_factory=dict)
    error: Optional[str] = None


class BooksStateAddRequest(BaseModel):
    """Add (or refresh) a source in the persisted state."""
    path: str
    mode: str = Field("file", description="'file' or 'folder'.")
    language: Optional[str] = None


class BooksStateRemoveRequest(BaseModel):
    """Remove a source from the persisted state (matched by normalized path)."""
    path: str


class BookSubmitItem(BaseModel):
    """Per-source result of a batch submit (v3: chapters + correspondence slots)."""
    path: str
    files: int = 0
    sentences: int = 0
    words: int = 0
    chapters: int = Field(0, description="Detected chapters ingested for this source.")
    slots: int = Field(0, description="Correspondence slots ingested (both grains).")
    selected_languages: List[str] = Field(
        default_factory=list, description="Effective Lsel used for this source.")
    success: bool = True
    errors: Optional[List[str]] = None


class BooksSubmitRequest(BaseModel):
    """Submit selected sources to laravel_main in one batch (v3 payload)."""
    paths: Optional[List[str]] = Field(
        None, description="Source paths to submit; omit/empty = all persisted sources.")
    language: Optional[str] = None
    languages: Optional[List[str]] = Field(
        None, description="The checked correspondence language set (Lsel, >=1; the "
                          "detected primary is auto-added and forced first). Omitted "
                          "= just the detected/declared primary.")
    source_type: str = Field(
        "book", description="'book' (default) or 'document' (Add Document sub-tab); "
                            "sets the ingest source_type so rows land in that bucket.")


class BooksSubmitResponse(BaseModel):
    """Aggregate result of a batch submit."""
    success: bool
    items: List[BookSubmitItem] = Field(default_factory=list)
    total_sentences: int = 0
    total_words: int = 0
    total_chapters: int = Field(0, description="Total chapters ingested across sources.")
    total_slots: int = Field(0, description="Total correspondence slots ingested.")
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# Drill-down lists (paginated words / sentences / languages behind the stats)  #
# --------------------------------------------------------------------------- #
class BooksListRequest(BaseModel):
    """Paginated drill-down into a source's computed lists.

    kind: 'words' | 'unique_words' (distinct word-frequency list, shared) |
          'sentences' (all, in order) | 'unique_sentences' | 'cues' | 'languages' |
          'chapters' (the detected chapter tree). When ``chapter_index`` is set for
          a grain-kind ('sentences'/'unique_sentences'/'cues') the page is the FE
          ``BookSlot[]`` correspondence shape scoped to that chapter + grain.
    The full lists are built once and cached (per source_key) so paging is cheap.
    """
    path: str
    kind: str = Field(
        "words",
        description="words|unique_words|sentences|unique_sentences|cues|languages|chapters")
    start: int = Field(0, ge=0)
    limit: int = Field(100, ge=1, le=1000)
    formats: Optional[List[str]] = None
    language: Optional[str] = None
    languages: Optional[List[str]] = Field(
        None, description="Checked correspondence set (Lsel) for chapter-scoped "
                          "BookSlot[] responses; primary auto-added + forced first.")
    chapter_index: Optional[int] = Field(
        None, ge=0, description="Scope a sentence/cue list to one chapter (v3 tree). "
                                "With a grain-kind this returns BookSlot[] items.")
    grain: Optional[str] = Field(
        None, description="Override grain for chapter scoping: 'cue' | 'sentence' "
                          "(otherwise derived from kind: cues=>cue, else sentence).")
    refresh: bool = Field(False, description="Rebuild the cached lists from the source.")
    max_files: int = Field(25, ge=1, le=500)
    sort_order: Optional[str] = Field(
        None, description="Word list order: 'asc' | 'desc' by occurrence count (default desc).")
    query: Optional[str] = Field(
        None, description="Case-insensitive substring filter for sentence/cue/slot lists.")
    view_language: Optional[str] = Field(
        None, description="When chapter-scoped: flatten slots to sentences for one language code.")


class BooksListResponse(BaseModel):
    """One page of a drill-down list."""
    success: bool
    kind: str = "words"
    total: int = Field(0, description="Total items in the selected list.")
    start: int = 0
    limit: int = 100
    chapter_index: Optional[int] = Field(
        None, description="Echoed chapter scope when a sentence list was chapter-scoped.")
    items: List[dict] = Field(
        default_factory=list,
        description="words:[{word,count}] · sentences:[{seq,text,chapter_index}] · "
                    "languages:[{script,code,chars,ratio}] · "
                    "chapters:[{chapter_index,title,titles:{code:title|null},"
                    "sentence_count}] · chapter-scoped grain (BookSlot[]):[{corr_id,"
                    "grain,seq,chapter_index,primary_language,langs:{code:text|null}}]")
    totals: dict = Field(default_factory=dict,
                         description="{words, unique_words, sentences, unique_sentences, chars, chapters}.")
    selected_languages: Optional[List[str]] = Field(
        None, description="Checked correspondence languages echoed for multi-lang sentence views.")
    error: Optional[str] = None
