# -*- coding: utf-8 -*-
"""
Logs Router - Log management endpoints
"""

from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import LogsController
from ...models.management.logs_models import LogsQuery, LogsResponse

APIRouter = fastapi.APIRouter
Query = fastapi.Query
router = APIRouter(prefix="/api/manage", tags=["System Management"])

# Initialize controller
controller = LogsController()


@router.get("/logs", response_model=LogsResponse)
async def get_logs(
    lines: Optional[int] = Query(100, ge=1, le=10000),
    level: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """
    Get system logs with filtering.

    Query parameters:
    - lines: Number of log lines to retrieve (1-10000, default: 100)
    - level: Filter by log level (DEBUG, INFO, WARNING, ERROR)
    - category: Filter by category (system, local_processing, upload, remote)
    - start_time: Filter logs after this time (ISO 8601)
    - end_time: Filter logs before this time (ISO 8601)
    - search: Search keyword in log messages

    Returns:
        LogsResponse with filtered log entries
    """
    query = LogsQuery(
        lines=lines,
        level=level,
        category=category,
        start_time=start_time,
        end_time=end_time,
        search=search
    )
    return controller.get_logs(query)


@router.delete("/logs")
async def clear_logs(category: Optional[str] = Query(None)):
    """
    Clear logs.

    Query parameters:
    - category: Optional category to clear. If not provided, clears all logs.

    Returns:
        Success status
    """
    return controller.clear_logs(category)


@router.get("/logs/stats")
async def get_log_stats():
    """
    Get log statistics.

    Returns statistics including:
    - Total log count
    - Count by level
    - Count by category
    - Buffer size
    """
    return controller.get_stats()
