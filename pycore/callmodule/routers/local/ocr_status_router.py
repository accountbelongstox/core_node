# -*- coding: utf-8 -*-
"""
OCR status router.

Endpoints (prefix /api/local/ocr):
  GET /status   -> ocr_status(): which LOCAL OCR engines are available, in
                   priority order (windows -> easyocr -> cnocr), and the best
                   one. Cheap: it import-checks each engine's package via
                   find_spec and never runs OCR or triggers an install.

The AI-vision OCR fallback (transcribe a screenshot with a vision provider) is
NOT a local engine; its availability is visible through the AI gateway status
(/api/local/ai/gateway, providers with vision=true). The Voice & Subtitle page
shows both panels together.
"""

import fastapi

from pycore.pyutils.ocr_cluster import ocr_status

router = fastapi.APIRouter(prefix="/api/local/ocr", tags=["Local Processing - OCR"])


@router.get("/status")
def status():
    """
    OCR engine availability snapshot.

    Returns: { success, best, available_count,
               engines: [ {name, priority, available, note}, ... ] }
    """
    return ocr_status()
