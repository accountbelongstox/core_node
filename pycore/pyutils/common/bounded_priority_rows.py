# -*- coding: utf-8 -*-
"""Bounded priority-row updates shared by cached queue projections."""

from typing import Any, Dict, List, Optional


class BoundedPriorityRows:
    """Apply one priority change while preserving a bounded row projection."""

    @staticmethod
    def update(
        items: Any,
        identity_groups: List[Dict[str, Any]],
        priority_field: str,
        priority: int,
        limit: int,
        move_to_head: bool,
        create_row: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        rows = [dict(item) for item in items or [] if isinstance(item, dict)]
        row_index = BoundedPriorityRows._find_index(rows, identity_groups)
        if row_index < 0:
            if create_row is None:
                return rows[:max(0, int(limit))]
            row = dict(create_row)
        else:
            row = rows.pop(row_index)

        row[priority_field] = int(priority)
        row["recently_bumped"] = bool(move_to_head)
        if move_to_head:
            rows.insert(0, row)
        else:
            rows.append(row)
            rows.sort(
                key=lambda item: int(item.get(priority_field) or 0),
                reverse=True,
            )
        return rows[:max(0, int(limit))]

    @staticmethod
    def _find_index(
        rows: List[Dict[str, Any]],
        identity_groups: List[Dict[str, Any]],
    ) -> int:
        groups = [group for group in identity_groups if group]
        for index, row in enumerate(rows):
            for group in groups:
                if all(str(row.get(key) or "") == str(value or "") for key, value in group.items()):
                    return index
        return -1


__all__ = ["BoundedPriorityRows"]
