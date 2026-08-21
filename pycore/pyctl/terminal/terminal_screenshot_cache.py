# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, List

from pycore.pyutils.common.status_snapshot_cache import VersionedSnapshotCache
from pycore.pyutils.window.screen_capture import capture_screen_regions_base64


SCREENSHOT_CACHE_KEY = "terminal.windows.screenshots"
SCREENSHOT_CACHE_MAX_ENTRIES = 1
SCREENSHOT_CAPTURE_LEASE_SECONDS = 60.0


class TerminalScreenshotCache:
    """Serve the latest screenshots while one coalesced refresh runs."""

    def __init__(self) -> None:
        self._cache = VersionedSnapshotCache(
            ttl_seconds=0.0,
            max_entries=SCREENSHOT_CACHE_MAX_ENTRIES,
            load_lease_seconds=SCREENSHOT_CAPTURE_LEASE_SECONDS,
            copy_values=True,
        )
        self._cache.put(SCREENSHOT_CACHE_KEY, {})

    def read_and_refresh(
        self,
        regions: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        normalized_regions = self._normalize_regions(regions)
        region_ids = {
            str(region["id"])
            for region in normalized_regions
        }
        version = self._geometry_version(normalized_regions)
        snapshot = self._cache.get(
            SCREENSHOT_CACHE_KEY,
            loader=lambda: capture_screen_regions_base64(normalized_regions),
            refresh=True,
            version=version,
            stale_while_refresh=True,
        )
        return {
            region_id: capture
            for region_id, capture in snapshot.items()
            if region_id in region_ids and isinstance(capture, dict)
        }

    def capture_now(
        self,
        regions: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        return capture_screen_regions_base64(self._normalize_regions(regions))

    @staticmethod
    def _normalize_regions(
        regions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        normalized = [
            {
                "id": str(region.get("id") or ""),
                "left": int(region.get("left") or 0),
                "top": int(region.get("top") or 0),
                "width": int(region.get("width") or 0),
                "height": int(region.get("height") or 0),
            }
            for region in regions
            if str(region.get("id") or "")
        ]
        return sorted(normalized, key=lambda region: str(region["id"]))

    @staticmethod
    def _geometry_version(regions: List[Dict[str, Any]]) -> str:
        return "|".join(
            ":".join(
                (
                    str(region["id"]),
                    str(region["left"]),
                    str(region["top"]),
                    str(region["width"]),
                    str(region["height"]),
                )
            )
            for region in regions
        )


terminal_screenshot_cache = TerminalScreenshotCache()


__all__ = ["TerminalScreenshotCache", "terminal_screenshot_cache"]
