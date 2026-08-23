# -*- coding: utf-8 -*-
"""Demand-leased immutable Terminal screenshot resources."""

from __future__ import annotations

import time
from typing import Any, Dict, Iterable, List, Optional

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.terminal_events import TERMINAL_CHANGED_EVENT
from pycore.pyutils.window.screen_capture import capture_screen_regions_png


TERMINAL_SCREENSHOT_FRESHNESS_SECONDS = 2.0
TERMINAL_SCREENSHOT_CAPTURE_LEASE_SECONDS = 10.0
TERMINAL_VIEWER_DEMAND_LEASE_SECONDS = 15.0
TERMINAL_VIEWER_MAX_WINDOWS = 64
TERMINAL_VIEWER_MAX_COUNT = 128
TERMINAL_SCREENSHOT_RESOURCE_RETENTION_SECONDS = 120.0
TERMINAL_SCREENSHOT_MAX_RESOURCES = 256
TERMINAL_SCREENSHOT_RESOURCE_ROUTE = "ui/terminal/screenshot"


class TerminalScreenshotCache:
    """Capture only demanded windows and expose digest-addressed byte resources."""

    def __init__(self) -> None:
        self._entries: Dict[str, Dict[str, Any]] = {}
        self._resources: Dict[str, Dict[str, Any]] = {}
        self._viewer_leases: Dict[str, Dict[str, Any]] = {}
        self._capture_leases: Dict[str, float] = {}
        self._revision = 0
        init_serialized_owner(
            self,
            "terminal.screenshot.state",
            "TerminalScreenshotStateThread",
        )

    @serialized_method
    def renew_demand(
        self,
        viewer_id: str,
        window_ids: Iterable[str],
    ) -> Dict[str, Any]:
        normalized_viewer = str(viewer_id or "").strip()
        normalized_ids = sorted({str(value) for value in window_ids if str(value)})
        if not normalized_viewer:
            raise ValueError("terminal_viewer_id_required")
        if len(normalized_ids) > TERMINAL_VIEWER_MAX_WINDOWS:
            raise ValueError("terminal_viewer_window_limit_exceeded")
        self._prune_leases(time.monotonic())
        if (
            normalized_viewer not in self._viewer_leases
            and len(self._viewer_leases) >= TERMINAL_VIEWER_MAX_COUNT
        ):
            raise ValueError("terminal_viewer_limit_exceeded")
        self._viewer_leases[normalized_viewer] = {
            "window_ids": normalized_ids,
            "expires_at": time.monotonic() + TERMINAL_VIEWER_DEMAND_LEASE_SECONDS,
        }
        terminal_activity_log.info(
            "screenshot.demand.renewed",
            viewer_id=normalized_viewer,
            window_ids=normalized_ids,
            lease_seconds=TERMINAL_VIEWER_DEMAND_LEASE_SECONDS,
        )
        return {
            "viewer_id": normalized_viewer,
            "window_ids": normalized_ids,
            "lease_seconds": TERMINAL_VIEWER_DEMAND_LEASE_SECONDS,
        }

    def refresh_demanded(
        self,
        regions: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        normalized = self._normalize_regions(regions)
        now = time.monotonic()
        self._reconcile_windows(
            [str(region["id"]) for region in normalized],
            now,
        )
        plan = self._claim_capture(normalized, (), now)
        if plan:
            terminal_activity_log.info(
                "screenshot.capture.scheduled",
                window_ids=list(plan),
                region_count=len(plan),
            )
            try:
                start_bus_task(
                    self._capture_plan,
                    plan,
                    thread_name="TerminalScreenshotCaptureThread",
                )
            except Exception as error:
                self._release_capture(plan)
                terminal_activity_log.error(
                    "screenshot.capture.schedule.failed",
                    window_ids=list(plan),
                    error_type=type(error).__name__,
                    error=error,
                )
        return self.metadata_many([region["id"] for region in normalized])

    def _capture_plan(self, plan: Dict[str, Dict[str, Any]]) -> None:
        terminal_activity_log.info(
            "screenshot.capture.started",
            window_ids=list(plan),
            region_count=len(plan),
        )
        try:
            captures = capture_screen_regions_png(list(plan.values()))
            self._commit_capture(plan, captures, time.monotonic())
        except Exception as error:
            self._release_capture(plan)
            terminal_activity_log.error(
                "screenshot.capture.failed",
                window_ids=list(plan),
                error_type=type(error).__name__,
                error=error,
            )

    @serialized_method
    def _release_capture(self, plan: Dict[str, Dict[str, Any]]) -> None:
        for window_id in plan:
            self._capture_leases.pop(str(window_id), None)

    def capture_now(self, region: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        normalized = self._normalize_regions([region])
        if not normalized:
            return None
        window_id = str(normalized[0]["id"])
        plan = self._claim_capture(
            normalized,
            (window_id,),
            time.monotonic(),
        )
        if plan:
            captures = capture_screen_regions_png(list(plan.values()))
            self._commit_capture(plan, captures, time.monotonic())
        return self.metadata(window_id)

    @serialized_method
    def _claim_capture(
        self,
        regions: List[Dict[str, Any]],
        force_window_ids: Iterable[str],
        now: float,
    ) -> Dict[str, Dict[str, Any]]:
        self._prune_leases(now)
        self._prune_resources(now)
        demanded = {
            str(window_id)
            for lease in self._viewer_leases.values()
            for window_id in lease["window_ids"]
        }
        forced = {str(value) for value in force_window_ids if str(value)}
        plan: Dict[str, Dict[str, Any]] = {}
        for region in regions:
            window_id = str(region["id"])
            if window_id not in demanded and window_id not in forced:
                continue
            capture_lease = float(self._capture_leases.get(window_id) or 0)
            if now < capture_lease:
                continue
            geometry = self._geometry_version(region)
            entry = self._entries.get(window_id)
            fresh = (
                entry is not None
                and str(entry.get("geometry") or "") == geometry
                and now - float(entry.get("stored_at") or 0)
                < TERMINAL_SCREENSHOT_FRESHNESS_SECONDS
            )
            if fresh and window_id not in forced:
                continue
            self._capture_leases[window_id] = (
                now + TERMINAL_SCREENSHOT_CAPTURE_LEASE_SECONDS
            )
            plan[window_id] = {**region, "geometry": geometry}
        return plan

    @serialized_method
    def _commit_capture(
        self,
        plan: Dict[str, Dict[str, Any]],
        captures: Dict[str, Dict[str, Any]],
        now: float,
    ) -> None:
        changed = []
        for window_id, region in plan.items():
            self._capture_leases.pop(window_id, None)
            capture = captures.get(window_id)
            if not isinstance(capture, dict):
                terminal_activity_log.warning(
                    "screenshot.capture.missing",
                    window_id=window_id,
                )
                continue
            body = capture.get("body")
            digest = str(capture.get("digest") or "")
            if not isinstance(body, bytes) or not digest:
                terminal_activity_log.error(
                    "screenshot.capture.invalid",
                    window_id=window_id,
                )
                continue
            previous = self._entries.get(window_id)
            if (
                previous is not None
                and str(previous.get("digest") or "") == digest
            ):
                previous["captured_at"] = int(capture.get("captured_at") or 0)
                previous["geometry"] = str(region["geometry"])
                previous["stored_at"] = now
                terminal_activity_log.debug(
                    "screenshot.capture.unchanged",
                    window_id=window_id,
                    digest=digest,
                )
                continue
            self._revision += 1
            entry = {
                "window_id": window_id,
                "mime": str(capture.get("mime") or "image/png"),
                "body": body,
                "digest": digest,
                "width": int(capture.get("width") or 0),
                "height": int(capture.get("height") or 0),
                "captured_at": int(capture.get("captured_at") or 0),
                "geometry": str(region["geometry"]),
                "stored_at": now,
                "revision": self._revision,
            }
            self._entries[window_id] = entry
            self._resources[self._resource_key(window_id, digest)] = entry
            changed.append(self._metadata(entry))
            terminal_activity_log.success(
                "screenshot.capture.completed",
                window_id=window_id,
                body=body,
                digest=digest,
                revision=self._revision,
            )
        self._prune_resources(now)
        if changed:
            THREAD_BUS.trigger_event(
                TERMINAL_CHANGED_EVENT,
                {
                    "schema_version": 1,
                    "event_type": TERMINAL_CHANGED_EVENT,
                    "revision": self._revision,
                    "resources": changed,
                },
                async_mode=True,
            )

    @serialized_method
    def metadata(self, window_id: str) -> Optional[Dict[str, Any]]:
        entry = self._entries.get(str(window_id))
        return self._metadata(entry) if entry is not None else None

    @serialized_method
    def metadata_many(
        self,
        window_ids: Iterable[str],
    ) -> Dict[str, Dict[str, Any]]:
        return {
            str(window_id): self._metadata(self._entries[str(window_id)])
            for window_id in window_ids
            if str(window_id) in self._entries
        }

    @serialized_method
    def revision(self) -> int:
        return int(self._revision)

    @serialized_method
    def _reconcile_windows(
        self,
        online_window_ids: Iterable[str],
        now: float,
    ) -> None:
        online = {str(value) for value in online_window_ids if str(value)}
        removed = [
            window_id
            for window_id in self._entries
            if window_id not in online
        ]
        for window_id in removed:
            self._entries.pop(window_id, None)
            self._capture_leases.pop(window_id, None)
        self._prune_resources(now)
        if removed:
            terminal_activity_log.info(
                "screenshot.windows.reconciled",
                removed_window_ids=removed,
            )

    @serialized_method
    def read_resource(
        self,
        window_id: str,
        digest: str,
    ) -> Optional[Dict[str, Any]]:
        self._prune_resources(time.monotonic())
        entry = self._resources.get(self._resource_key(window_id, digest))
        if entry is None:
            terminal_activity_log.warning(
                "screenshot.resource.missed",
                window_id=window_id,
                digest=digest,
            )
            return None
        terminal_activity_log.success(
            "screenshot.resource.read",
            window_id=window_id,
            digest=digest,
            body=entry["body"],
        )
        return dict(entry)

    def _prune_resources(self, now: float) -> None:
        current_resource_keys = {
            self._resource_key(window_id, str(entry.get("digest") or ""))
            for window_id, entry in self._entries.items()
        }
        expired_keys = [
            key
            for key, entry in self._resources.items()
            if key not in current_resource_keys
            and now - float(entry.get("stored_at") or 0)
            >= TERMINAL_SCREENSHOT_RESOURCE_RETENTION_SECONDS
        ]
        for key in expired_keys:
            self._resources.pop(key, None)
        overflow = max(
            0,
            len(self._resources) - TERMINAL_SCREENSHOT_MAX_RESOURCES,
        )
        removable = sorted(
            (
                (float(entry.get("stored_at") or 0), key)
                for key, entry in self._resources.items()
                if key not in current_resource_keys
            ),
        )
        for _stored_at, key in removable[:overflow]:
            self._resources.pop(key, None)

    @staticmethod
    def _resource_key(window_id: str, digest: str) -> str:
        return f"{str(window_id)}:{str(digest)}"

    def _prune_leases(self, now: float) -> None:
        expired_viewers = [
            viewer_id
            for viewer_id, lease in self._viewer_leases.items()
            if now >= float(lease["expires_at"])
        ]
        for viewer_id in expired_viewers:
            self._viewer_leases.pop(viewer_id, None)
            terminal_activity_log.info(
                "screenshot.demand.expired",
                viewer_id=viewer_id,
            )
        expired_captures = [
            window_id
            for window_id, expires_at in self._capture_leases.items()
            if now >= float(expires_at)
        ]
        for window_id in expired_captures:
            self._capture_leases.pop(window_id, None)

    @staticmethod
    def _metadata(entry: Dict[str, Any]) -> Dict[str, Any]:
        digest = str(entry["digest"])
        return {
            "window_id": str(entry["window_id"]),
            "mime": str(entry["mime"]),
            "digest": digest,
            "etag": f'"{digest}"',
            "width": int(entry["width"]),
            "height": int(entry["height"]),
            "captured_at": int(entry["captured_at"]),
            "revision": int(entry["revision"]),
            "resource": {
                "route": TERMINAL_SCREENSHOT_RESOURCE_ROUTE,
                "window_id": str(entry["window_id"]),
                "digest": digest,
            },
        }

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
            and int(region.get("width") or 0) > 0
            and int(region.get("height") or 0) > 0
        ]
        return sorted(normalized, key=lambda region: str(region["id"]))

    @staticmethod
    def _geometry_version(region: Dict[str, Any]) -> str:
        return ":".join(
            (
                str(region["left"]),
                str(region["top"]),
                str(region["width"]),
                str(region["height"]),
            )
        )


terminal_screenshot_cache = TerminalScreenshotCache()


__all__ = ["TerminalScreenshotCache", "terminal_screenshot_cache"]
