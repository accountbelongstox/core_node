# -*- coding: utf-8 -*-
"""
OCR status router.

Endpoints (prefix /api/local/ocr):
  GET  /status  -> ocr_status(): which LOCAL OCR engines are available, in
                   priority order (windows -> easyocr -> cnocr), and the best
                   one. Cheap: it import-checks each engine's package via
                   find_spec and never runs OCR or triggers an install.
  POST /test    -> live recognition test for ONE engine (or the best
                   available) on a caller-supplied image (base64 data-URL or a
                   path); returns {success, engine, text, latency_ms, error}.

The AI-vision OCR fallback (transcribe a screenshot with a vision provider) is
NOT a local engine; its availability is visible through the AI gateway status
(/api/local/ai/gateway, providers with vision=true). The Voice & Subtitle page
shows both panels together.
"""

import fastapi
from typing import Optional
from pydantic import BaseModel

from pycore.pyutils.ocr_cluster import ocr_status, ocr_test

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


router = fastapi.APIRouter(prefix="/api/local/ocr", tags=["Local Processing - OCR"])


@router.get("/status")
def status():
    """
    OCR engine availability snapshot.

    Returns: { success, best, available_count,
               engines: [ {name, priority, available, note}, ... ] }
    """
    return ocr_status()


class _OcrTestReq(BaseModel):
    engine: Optional[str] = None
    # Base64 PNG/JPG, optionally with a `data:image/...;base64,` prefix. When
    # omitted the caller must supply image_path. The popup renders sample text
    # to a <canvas> and sends it here so "Test" works with no file upload.
    image_data: Optional[str] = None
    image_path: Optional[str] = None
    lang: Optional[str] = None


@router.post("/test")
def test(req: _OcrTestReq):
    """DEPRECATED: use WS route ``local.ocr.test`` instead.
    Live OCR test for ONE engine (or the best available) on the supplied
    image. Returns {success, engine, text, latency_ms, error} - the same
    uniform shape as /api/local/tts/test and /api/local/stt/test."""
    ColorPrint.yellow("[DEPRECATED] HTTP POST /api/local/ocr/test — use WS route local.ocr.test")
    return ocr_test(engine=req.engine, image_path=req.image_path,
                    image_data=req.image_data, lang=req.lang)
