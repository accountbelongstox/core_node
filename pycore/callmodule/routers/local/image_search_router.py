# -*- coding: utf-8 -*-
"""
Image search router — SerpApi Google-Images + AI compare + history.

Endpoints (prefix /api/local/image-search):
  GET  /status
  POST /
  POST /ai
  POST /compare
  GET  /history
  DELETE /history/{id}
  POST /history/clear
"""

from typing import Optional

import fastapi
from pydantic import BaseModel

from ...controllers.local_processing.image_search_controller import ImageSearchController

router = fastapi.APIRouter(prefix="/api/local/image-search", tags=["Local Processing - Image Search"])
controller = ImageSearchController()


class ImageSearchRequest(BaseModel):
    query: str
    num: Optional[int] = None
    country: Optional[str] = None
    record: bool = True


class ImageSearchAiRequest(BaseModel):
    query: str
    size: Optional[str] = None
    model: Optional[str] = None


class ImageSearchCompareRequest(BaseModel):
    query: str
    num: Optional[int] = None
    country: Optional[str] = None
    size: Optional[str] = None
    model: Optional[str] = None


@router.get("/status")
def status():
    return controller.status()


@router.post("")
def search(req: ImageSearchRequest):
    return controller.search(req.query, num=req.num or 12, country=req.country, record=req.record)


@router.post("/ai")
def search_ai(req: ImageSearchAiRequest):
    return controller.search_ai(req.query, size=req.size, model=req.model)


@router.post("/compare")
def compare(req: ImageSearchCompareRequest):
    return controller.compare(
        req.query, num=req.num or 12, country=req.country, size=req.size, model=req.model)


@router.get("/history")
def history(limit: int = 50):
    return controller.history(limit)


@router.delete("/history/{entry_id}")
def delete_history(entry_id: str):
    return controller.delete_history(entry_id)


@router.post("/history/clear")
def clear_history():
    return controller.clear_history()
