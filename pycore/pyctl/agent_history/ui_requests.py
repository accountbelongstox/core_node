# -*- coding: utf-8 -*-
"""Shared request-parameter helpers of the Agent History UI routes."""

from typing import Any, Dict, List


def id_list(request: Dict[str, Any]) -> List[str]:
    ids = request.get("ids")
    if isinstance(ids, list):
        return [str(item) for item in ids]
    return []


__all__ = ["id_list"]
