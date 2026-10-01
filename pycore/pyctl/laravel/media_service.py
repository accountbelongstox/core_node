# -*- coding: utf-8 -*-
"""Laravel media ingestion and enrichment workflows."""

import os
from typing import Any, Dict, List

from pycore.pyctl.laravel.sync.media_sync import sync_book_source
from pycore.pyutils.document_processing.book_processor import iter_books


def _expand_targets(targets: List[str]) -> List[str]:
    expanded = []
    for target in targets:
        if os.path.isdir(target):
            expanded.extend(str(path) for path in iter_books(target))
        else:
            expanded.append(target)
    return expanded or targets

def sync_book(params: Dict[str, Any]) -> Dict[str, Any]:
    language = params.get("language") or "en"
    languages = params.get("languages")
    source_type = params.get("source_type") or "book"
    paths = params.get("paths")
    source_path = params.get("source_path")
    targets = [
        str(path)
        for path in (paths or ([source_path] if source_path else []))
        if path and str(path).strip()
    ]
    if not targets:
        return {"success": False, "error": "source_path (or paths) required"}
    targets = _expand_targets(targets)
    results = [
        sync_book_source(
            target,
            language,
            None,
            None,
            None,
            None,
            languages,
            3,
            source_type,
        )
        for target in targets
    ]
    if len(results) == 1:
        return results[0]
    return {
        "success": all(result.get("success") for result in results),
        "count": len(results),
        "results": results,
    }

__all__ = ["sync_book"]
