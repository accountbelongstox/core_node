# -*- coding: utf-8 -*-
"""Image search application service."""

from typing import Any, Dict, Optional

from pycore.callmodule.controllers.local_processing.image_search_controller import ImageSearchController

controller = ImageSearchController()


def status():
    return controller.status()


def search(params: Optional[Dict[str, Any]] = None):
    p = params or {}
    return controller.search(
        str(p.get("query") or ""),
        num=int(p.get("num") or 12),
        country=p.get("country"),
        record=bool(p.get("record", True)),
    )


def search_ai(params: Optional[Dict[str, Any]] = None):
    p = params or {}
    return controller.search_ai(
        str(p.get("query") or ""),
        size=p.get("size"),
        model=p.get("model"),
    )


def compare(params: Optional[Dict[str, Any]] = None):
    p = params or {}
    return controller.compare(
        str(p.get("query") or ""),
        num=int(p.get("num") or 12),
        country=p.get("country"),
        size=p.get("size"),
        model=p.get("model"),
    )


def history(limit: int = 50):
    return controller.history(limit)


def delete_history(entry_id: str):
    return controller.delete_history(entry_id)


def clear_history():
    return controller.clear_history()
