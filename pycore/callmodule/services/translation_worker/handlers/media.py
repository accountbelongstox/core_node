# -*- coding: utf-8 -*-
"""Subtitle-search lane handler for the translation worker."""

from typing import Any, Dict

from .. import lane_gating



def process_subtitle_search_task(worker, task: Dict[str, Any]) -> None:
    """Return unsupported subtitle tasks to Laravel for another worker."""
    task_id = task.get("task_id")
    if not lane_gating.subtitle_enabled():
        worker._post_result(task_id, "failed", error="subtitle search disabled on this worker")
        return
    worker._post_result(
        task_id,
        "failed",
        error="subtitle search is not implemented by the translation worker",
    )
