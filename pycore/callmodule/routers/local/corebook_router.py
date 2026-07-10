# -*- coding: utf-8 -*-
"""
CoreBook router — portable book bundles (convert / enrich / submit).

Endpoints (prefix /api/local/corebook):
  GET    /list
  POST   /convert
  GET    /get
  DELETE /delete
  POST   /add-language
  POST   /fill-audio
  POST   /submit

Heavy work runs on worker threads so the WS/event loop stays responsive.
"""

import asyncio

import fastapi

from ...controllers.local_processing.corebook_controller import CoreBookController
from ...models.local_processing.corebook_models import (
    CoreBookListResponse,
    CoreBookConvertRequest,
    CoreBookConvertResponse,
    CoreBookGetResponse,
    CoreBookDeleteResponse,
    CoreBookAddLanguageRequest,
    CoreBookFillAudioRequest,
    CoreBookEnrichResponse,
    CoreBookSubmitRequest,
    CoreBookSubmitResponse,
)

router = fastapi.APIRouter(prefix="/api/local/corebook", tags=["Local Processing - CoreBook"])
controller = CoreBookController()


@router.get("/list", response_model=CoreBookListResponse)
async def list_books():
    return controller.list_books()


@router.post("/convert", response_model=CoreBookConvertResponse)
async def convert(request: CoreBookConvertRequest):
    return await asyncio.to_thread(
        controller.convert, request.path, request.language, request.languages,
        request.source_type, request.text)


@router.get("/get", response_model=CoreBookGetResponse)
async def get_book(
    source_key: str,
    start: int = 0,
    limit: int = 0,
):
    return await asyncio.to_thread(controller.get, source_key, start, limit)


@router.delete("/delete", response_model=CoreBookDeleteResponse)
async def delete_book(source_key: str):
    return await asyncio.to_thread(controller.delete, source_key)


@router.post("/add-language", response_model=CoreBookEnrichResponse)
async def add_language(request: CoreBookAddLanguageRequest):
    return await asyncio.to_thread(
        controller.add_language, request.source_key, request.target_language,
        request.source_language, request.chunk_size, request.grain)


@router.post("/fill-audio", response_model=CoreBookEnrichResponse)
async def fill_audio(request: CoreBookFillAudioRequest):
    return await asyncio.to_thread(
        controller.fill_audio, request.source_key, request.languages,
        request.rate, request.grain)


@router.post("/submit", response_model=CoreBookSubmitResponse)
async def submit(request: CoreBookSubmitRequest):
    items = None
    if request.assist_items:
        items = [i.model_dump() for i in request.assist_items]
    return await asyncio.to_thread(
        controller.submit, request.source_key, request.upload_audio,
        request.request_assist, items)
