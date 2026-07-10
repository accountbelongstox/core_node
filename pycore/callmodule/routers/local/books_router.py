# -*- coding: utf-8 -*-
"""
Books router — local document analyze/preview for the Books page.

Endpoints (prefix /api/local/books):
  GET  /supported-formats   -> extensions the Books pipeline can ingest (filter)
  POST /scan                -> fast recursive file listing (no text extraction)
  POST /analyze             -> extract text + multi-language stats + preview
                               (single file, or a folder up to max_files)
  POST /analyze-upload      -> stage uploaded file bytes to disk, then analyze
                               them (drag-drop fallback for sandboxed browsers
                               where File.path is not exposed); returns staged
                               absolute paths so the UI can then sync them.

Read-only and local: scan/analyze are pure inspection. analyze-upload writes the
uploaded bytes into a local staging dir so they gain a real path. The actual
Laravel ingest is still the WS RPC ``book.sync_source``.
"""

import asyncio
from typing import List, Optional

import fastapi

from ...controllers.local_processing.books_controller import BooksController
from ...models.local_processing.books_models import (
    SupportedFormatsResponse,
    BooksScanRequest,
    BooksScanResponse,
    BooksAnalyzeRequest,
    BooksAnalyzeResponse,
    BooksStateResponse,
    BooksStateAddRequest,
    BooksStateRemoveRequest,
    BooksSubmitRequest,
    BooksSubmitResponse,
    BooksListRequest,
    BooksListResponse,
)

router = fastapi.APIRouter(prefix="/api/local/books", tags=["Local Processing - Books"])
controller = BooksController()


@router.get("/supported-formats", response_model=SupportedFormatsResponse)
async def supported_formats():
    """List the document extensions the Books pipeline can ingest."""
    return controller.supported_formats()


@router.post("/scan", response_model=BooksScanResponse)
async def scan(request: BooksScanRequest):
    """Recursively list book files under a folder (or echo a single file)."""
    # Off the event loop: a deep folder scan must not block the WS / other requests.
    return await asyncio.to_thread(controller.scan, request.path, request.formats)


@router.post("/analyze", response_model=BooksAnalyzeResponse)
async def analyze(request: BooksAnalyzeRequest):
    """Extract text and compute multi-language stats + preview, without syncing.

    With ``persist=true`` a compact summary is saved to the 'books' state so the
    UI can reload it after a switch/reopen.
    """
    # Off the event loop: text extraction + multi-language stats are CPU/IO heavy.
    return await asyncio.to_thread(
        controller.analyze, request.path, request.formats, request.language,
        request.preview_chars, request.max_files, request.persist, request.languages)


# --- persisted state (survives UI switch/reopen) + one-shot batch submit ---- #
@router.get("/state", response_model=BooksStateResponse)
async def get_state():
    """Return the persisted Books sources + their compact analysis + state."""
    return controller.get_state()


@router.post("/state/add", response_model=BooksStateResponse)
async def state_add(request: BooksStateAddRequest):
    """Add (or refresh) a source in the persisted state."""
    return controller.add_source(request.path, request.mode, request.language)


@router.post("/state/remove", response_model=BooksStateResponse)
async def state_remove(request: BooksStateRemoveRequest):
    """Remove a source from the persisted state (by normalized path)."""
    return controller.remove_source(request.path)


@router.post("/submit", response_model=BooksSubmitResponse)
async def submit(request: BooksSubmitRequest):
    """Build the v2 payload for the selected sources and ingest them ONCE.

    Marks each submitted source 'synced' and persists. Omitting ``paths`` submits
    every persisted source.
    """
    # CRITICAL: runs the (blocking) extract + build + chunked HTTP ingest on a
    # worker thread so the event loop stays free — otherwise the WS progress
    # events never reach the UI and the page freezes at the first 'scan' stage.
    return await asyncio.to_thread(
        controller.submit, request.paths, request.language, request.languages,
        request.source_type)


@router.post("/list", response_model=BooksListResponse)
async def list_items(request: BooksListRequest):
    """One page of a source's drill-down list (words / sentences / languages).

    The full lists are built once and cached per source, so paging is cheap even
    for a huge book. Runs off the event loop (first build can be heavy).
    """
    return await asyncio.to_thread(
        controller.list_items, request.path, request.kind, request.start,
        request.limit, request.formats, request.language, request.refresh,
        request.max_files, request.chapter_index, request.languages, request.grain,
        request.sort_order, request.query, request.view_language)


@router.post("/analyze-upload", response_model=BooksAnalyzeResponse)
async def analyze_upload(
    files: List[fastapi.UploadFile] = fastapi.File(...),
    language: Optional[str] = fastapi.Form(None),
    languages: Optional[List[str]] = fastapi.Form(None),
    preview_chars: int = fastapi.Form(800),
    persist: bool = fastapi.Form(False),
    source_type: str = fastapi.Form("book"),
):
    """Stage uploaded file bytes to disk and analyze them.

    Drag-drop fallback for browsers that sandbox the file path away: the UI sends
    the actual bytes, we save them under the local staging dir (so they gain a
    real absolute path) and return per-file stats + preview. The returned staged
    paths can then be synced via the WS RPC ``book.sync_source``. ``languages`` is
    the checked correspondence set (repeated form field; >=1, primary auto-added).
    """
    uploads = []
    for f in files:
        content = await f.read()
        uploads.append((f.filename or "book", content))
    # Off the event loop: staging + extraction + stats are heavy for large files.
    return await asyncio.to_thread(
        controller.analyze_upload, uploads, language,
        max(0, min(20000, int(preview_chars))), persist, languages, source_type)
