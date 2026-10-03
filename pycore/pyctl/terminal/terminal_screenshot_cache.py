# -*- coding: utf-8 -*-
"""Demand-leased immutable Terminal screenshot resources."""

from __future__ import annotations

import time
from typing import Any, Dict, Iterable, List, Optional, Set

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyutils.common.relay_contract import relay_contract
from pycore.pyutils.window.screen_capture import (
    encode_capture_image,
    frame_signature,
    frame_signature_distance,
)
from pycore.pyutils.window.terminal_platform import terminal_backend


TERMINAL_SCREENSHOT_FRESHNESS_SECONDS = relay_contract.duration(
    "terminal_screenshot_freshness_seconds"
)
TERMINAL_SCREENSHOT_FOCUS_INTERVAL_SECONDS = relay_contract.duration(
    "terminal_screenshot_focus_interval_seconds"
)
TERMINAL_SCREENSHOT_CAPTURE_LEASE_SECONDS = relay_contract.duration(
    "terminal_screenshot_capture_lease_seconds"
)
TERMINAL_VIEWER_DEMAND_LEASE_SECONDS = relay_contract.duration(
    "terminal_viewer_demand_lease_seconds"
)
TERMINAL_VIEWER_MAX_WINDOWS = relay_contract.limit("terminal_viewer_windows")
TERMINAL_VIEWER_MAX_COUNT = relay_contract.limit("terminal_viewers")
TERMINAL_SCREENSHOT_RESOURCE_RETENTION_SECONDS = relay_contract.duration(
    "terminal_screenshot_resource_retention_seconds"
)
TERMINAL_SCREENSHOT_MAX_RESOURCES = relay_contract.limit(
    "terminal_screenshot_resources"
)
TERMINAL_SCREENSHOT_CAPTURE_BATCH = relay_contract.limit(
    "terminal_screenshot_capture_batch"
)
TERMINAL_SCREENSHOT_CHANGE_THRESHOLD = relay_contract.limit(
    "terminal_screenshot_change_threshold"
)


class TerminalScreenshotCache:
    """Capture only demanded windows, encode only changed frames, and expose digest-addressed byte resources."""

    def __init__(self) -> None:
        self._entries: Dict[str, Dict[str, Any]] = {}
        self._resources: Dict[str, Dict[str, Any]] = {}
        self._viewer_leases: Dict[str, Dict[str, Any]] = {}
        self._capture_leases: Dict[str, float] = {}
        self._capture_epochs: Dict[str, int] = {}
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
        focus_window_id: Optional[str] = None,
        force_window_ids: Iterable[str] = (),
    ) -> Dict[str, Any]:
        normalized_viewer = str(viewer_id or "").strip()
        normalized_ids = sorted({str(value) for value in window_ids if str(value)})
        normalized_forced = sorted(
            {str(value) for value in force_window_ids if str(value)}
        )
        if not normalized_viewer:
            raise ValueError("terminal_viewer_id_required")
        now = time.monotonic()
        self._prune_leases(now)
        previous = self._viewer_leases.get(normalized_viewer)
        if focus_window_id is None:
            focus = str(previous["focus_window_id"]) if previous else ""
        else:
            focus = str(focus_window_id).strip()
        if focus:
            normalized_ids = [focus]
        if len(normalized_ids) > TERMINAL_VIEWER_MAX_WINDOWS:
            raise ValueError("terminal_viewer_window_limit_exceeded")
        if len(normalized_forced) > TERMINAL_VIEWER_MAX_WINDOWS:
            raise ValueError("terminal_viewer_force_window_limit_exceeded")
        if (
            previous is None
            and len(self._viewer_leases) >= TERMINAL_VIEWER_MAX_COUNT
        ):
            raise ValueError("terminal_viewer_limit_exceeded")
        self._viewer_leases[normalized_viewer] = {
            "window_ids": normalized_ids,
            "focus_window_id": focus,
            "expires_at": now + TERMINAL_VIEWER_DEMAND_LEASE_SECONDS,
        }
        terminal_activity_log.debug(
            "screenshot.demand.renewed",
            viewer_id=normalized_viewer,
            window_ids=normalized_ids,
            focus_window_id=focus,
            force_window_ids=normalized_forced,
            lease_seconds=TERMINAL_VIEWER_DEMAND_LEASE_SECONDS,
        )
        return {
            "viewer_id": normalized_viewer,
            "window_ids": normalized_ids,
            "lease_seconds": TERMINAL_VIEWER_DEMAND_LEASE_SECONDS,
            "focus_window_id": focus,
            "force_window_ids": normalized_forced,
        }

    @serialized_method
    def has_demand(self) -> bool:
        self._prune_leases(time.monotonic())
        return bool(self._viewer_leases)

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
        self._schedule_capture(normalized, now)
        return self.metadata_many([region["id"] for region in normalized])

    def refresh_focus(self, region: Dict[str, Any]) -> None:
        self._schedule_capture(
            self._normalize_regions([region]),
            time.monotonic(),
        )

    def _schedule_capture(
        self,
        normalized: List[Dict[str, Any]],
        now: float,
    ) -> None:
        plan = self._claim_capture(normalized, (), now)
        if plan:
            terminal_activity_log.info(
                "screenshot.capture.scheduled",
                window_ids=list(plan),
                region_count=len(plan),
            )
            start_bus_task(
                self._capture_plan,
                plan,
                thread_name="TerminalScreenshotCaptureThread",
            )

    def _capture_plan(self, plan: Dict[str, Dict[str, Any]]) -> None:
        terminal_activity_log.info(
            "screenshot.capture.started",
            window_ids=list(plan),
            region_count=len(plan),
        )
        try:
            frames = self._capture_frames(plan)
            self._commit_capture(plan, frames, time.monotonic())
        except Exception as error:
            self._release_capture(plan)
            terminal_activity_log.error(
                "screenshot.capture.failed",
                window_ids=list(plan),
                error_type=type(error).__name__,
                error=error,
            )

    def _capture_frames(
        self,
        plan: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        captured_at = int(time.time() * 1000)
        images = {
            str(window_id): image
            for window_id, image in terminal_backend.capture_windows(
                list(plan.values())
            ).items()
        }
        observations = {
            window_id: {
                "signature": frame_signature(image),
                "raw_size": tuple(image.size),
            }
            for window_id, image in images.items()
        }
        changed = self._filter_changed(observations)
        return {
            window_id: {
                **observation,
                "capture": (
                    encode_capture_image(images[window_id], captured_at)
                    if window_id in changed
                    else None
                ),
            }
            for window_id, observation in observations.items()
        }

    @serialized_method
    def _filter_changed(
        self,
        observations: Dict[str, Dict[str, Any]],
    ) -> Set[str]:
        changed = set()
        for window_id, observation in observations.items():
            entry = self._entries.get(window_id)
            if (
                entry is None
                or tuple(entry["raw_size"]) != observation["raw_size"]
                or frame_signature_distance(
                    entry["signature"],
                    observation["signature"],
                )
                > TERMINAL_SCREENSHOT_CHANGE_THRESHOLD
            ):
                changed.add(window_id)
        return changed

    @serialized_method
    def _release_capture(self, plan: Dict[str, Dict[str, Any]]) -> None:
        for window_id, region in plan.items():
            capture_epoch = int(region.get("capture_epoch") or 0)
            if capture_epoch == int(self._capture_epochs.get(window_id) or 0):
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
            frames = self._capture_frames(plan)
            self._commit_capture(plan, frames, time.monotonic())
            if window_id not in frames:
                return None
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
        focused = {
            str(lease["focus_window_id"])
            for lease in self._viewer_leases.values()
            if lease["focus_window_id"]
        }
        forced = {str(value) for value in force_window_ids if str(value)}
        plan: Dict[str, Dict[str, Any]] = {}
        for region in regions:
            window_id = str(region["id"])
            if window_id not in demanded and window_id not in forced:
                continue
            capture_lease = float(self._capture_leases.get(window_id) or 0)
            if now < capture_lease and window_id not in forced:
                continue
            geometry = self._geometry_version(region)
            entry = self._entries.get(window_id)
            freshness = (
                TERMINAL_SCREENSHOT_FOCUS_INTERVAL_SECONDS
                if window_id in focused
                else TERMINAL_SCREENSHOT_FRESHNESS_SECONDS
            )
            fresh = (
                entry is not None
                and str(entry.get("geometry") or "") == geometry
                and now - float(entry.get("stored_at") or 0) < freshness
            )
            if fresh and window_id not in forced:
                continue
            self._capture_leases[window_id] = (
                now + TERMINAL_SCREENSHOT_CAPTURE_LEASE_SECONDS
            )
            capture_epoch = int(self._capture_epochs.get(window_id) or 0) + 1
            self._capture_epochs[window_id] = capture_epoch
            plan[window_id] = {
                **region,
                "geometry": geometry,
                "capture_epoch": capture_epoch,
            }
            if len(plan) >= TERMINAL_SCREENSHOT_CAPTURE_BATCH:
                break
        return plan

    @serialized_method
    def _commit_capture(
        self,
        plan: Dict[str, Dict[str, Any]],
        frames: Dict[str, Dict[str, Any]],
        now: float,
    ) -> None:
        for window_id, region in plan.items():
            capture_epoch = int(region.get("capture_epoch") or 0)
            if capture_epoch != int(self._capture_epochs.get(window_id) or 0):
                terminal_activity_log.warning(
                    "screenshot.capture.stale",
                    window_id=window_id,
                    capture_epoch=capture_epoch,
                )
                continue
            self._capture_leases.pop(window_id, None)
            frame = frames.get(window_id)
            if not isinstance(frame, dict):
                terminal_activity_log.warning(
                    "screenshot.capture.missing",
                    window_id=window_id,
                )
                continue
            previous = self._entries.get(window_id)
            capture = frame["capture"]
            if capture is None:
                if previous is not None:
                    previous["geometry"] = str(region["geometry"])
                    previous["stored_at"] = now
                terminal_activity_log.debug(
                    "screenshot.capture.unchanged",
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
            if (
                previous is not None
                and str(previous.get("digest") or "") == digest
            ):
                previous["geometry"] = str(region["geometry"])
                previous["stored_at"] = now
                previous["signature"] = frame["signature"]
                previous["raw_size"] = frame["raw_size"]
                terminal_activity_log.debug(
                    "screenshot.capture.unchanged",
                    window_id=window_id,
                    digest=digest,
                )
                continue
            self._revision += 1
            entry = {
                "window_id": window_id,
                "mime": str(capture["mime"]),
                "body": body,
                "digest": digest,
                "width": int(capture.get("width") or 0),
                "height": int(capture.get("height") or 0),
                "captured_at": int(capture.get("captured_at") or 0),
                "geometry": str(region["geometry"]),
                "stored_at": now,
                "revision": self._revision,
                "signature": frame["signature"],
                "raw_size": frame["raw_size"],
            }
            self._entries[window_id] = entry
            self._resources[self._resource_key(window_id, digest)] = entry
            terminal_activity_log.debug(
                "screenshot.capture.completed",
                window_id=window_id,
                body=body,
                digest=digest,
                revision=self._revision,
            )
        self._prune_resources(now)

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
            self._capture_epochs.pop(window_id, None)
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
        overflow = max(
            0,
            len(self._resources) - TERMINAL_SCREENSHOT_MAX_RESOURCES,
        )
        current_oldest = sorted(
            (
                (float(entry.get("stored_at") or 0), key)
                for key, entry in self._resources.items()
                if key in current_resource_keys
            ),
        )
        for _stored_at, key in current_oldest[:overflow]:
            entry = self._resources.pop(key, None)
            if entry is None:
                continue
            window_id = str(entry.get("window_id") or "")
            current = self._entries.get(window_id)
            if current is entry:
                self._entries.pop(window_id, None)
            terminal_activity_log.warning(
                "screenshot.resource.evicted",
                window_id=window_id,
                digest=entry.get("digest"),
            )

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
            "byte_length": len(entry["body"]),
            "captured_at": int(entry["captured_at"]),
            "revision": int(entry["revision"]),
            "resource": {
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
