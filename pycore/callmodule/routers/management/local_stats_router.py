# -*- coding: utf-8 -*-
"""
Local Stats Router - Local processing statistics endpoint
"""

from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import LocalProcessingController
from ...models.management.local_processing_models import LocalProcessingStats

APIRouter = fastapi.APIRouter
Query = fastapi.Query
router = APIRouter(prefix="/api/manage/local", tags=["Local Processing Management"])

# Initialize controller
controller = LocalProcessingController()


@router.get("/stats", response_model=LocalProcessingStats)
async def get_stats(
    period: str = Query("today", regex="^(today|week|month|all|custom)$"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """
    Get local processing statistics.

    Query parameters:
    - period: Time period (today, week, month, all, custom) - default: today
    - start_date: Start date for custom period (YYYY-MM-DD)
    - end_date: End date for custom period (YYYY-MM-DD)

    Returns statistics including:
    - Summary (total tasks, completed, failed, average time)
    - Statistics by type (screenshot, OCR, audio, video)
    - Upload statistics
    - Timeline data
    """
    return controller.get_stats(period, start_date, end_date)
