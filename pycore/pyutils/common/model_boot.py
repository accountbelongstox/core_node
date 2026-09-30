# -*- coding: utf-8 -*-
"""Boot verification and masking of every manifest entry.

At pyservice start the boot service runs each entry's registered check once
(lazy-load probe: package import, secret presence, weights, binary). A
``blocked`` verdict masks the entry for the rest of the process: availability
checks, priority chains, managed starts and gateway dispatch consult
``model_boot.is_blocked(name, category)`` and skip it. ``verify`` re-checks on
demand and is the only way a blocked entry comes back without a restart.

Checks are declared apart from the entries (``register_checks``) so a leaf
manifest stays free of engine imports. Verdicts are immutable snapshots stored
as THREAD_BUS signals (one per entry key), so readers never enter a lock.
"""

import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.coded_message import message_fields
from pycore.pyutils.common.model_manifest import (
    BOOT_BLOCKED,
    BOOT_PENDING,
    BOOT_READY,
    BootVerdict,
    ModelEntry,
    model_key,
    model_manifest,
)
from pycore.pyutils.common.model_reasons import (
    MODEL_REASON_LOAD_FAILED,
    model_reason,
)

_SIGNAL_PREFIX = "model.boot.verdict."
_CHANGED_SIGNAL = "model.boot.changed"


class ModelBootRegistry:
    """Verifies manifest entries and answers masking queries."""

    def __init__(self) -> None:
        self._checks: Dict[str, Callable[[], BootVerdict]] = {}

    def register_checks(
        self,
        category: str,
        checks: Iterable[Tuple[str, Callable[[], BootVerdict]]],
    ) -> None:
        for name, check in checks:
            entry = model_manifest.get(name, category)
            if entry is None:
                raise ValueError(f"boot check for unknown model: {category}:{name}")
            if entry.key in self._checks:
                raise ValueError(f"duplicate boot check: {entry.key}")
            self._checks[entry.key] = check

    @staticmethod
    def _signal(key: str) -> str:
        return f"{_SIGNAL_PREFIX}{key}"

    def _record(self, entry: ModelEntry, verdict: BootVerdict) -> Dict[str, Any]:
        record: Dict[str, Any] = {
            "id": entry.id,
            "key": entry.key,
            "category": entry.category,
            "state": verdict.state,
            "checked_at": time.time(),
        }
        record.update(message_fields(verdict.reason, "reason"))
        THREAD_BUS.signal(self._signal(entry.key), record)
        THREAD_BUS.signal(_CHANGED_SIGNAL, {"key": entry.key, "state": verdict.state})
        return record

    def verify(self, name: str, category: Optional[str] = None) -> Dict[str, Any]:
        """Run one entry's check and publish the verdict."""
        entry = model_manifest.get(name, category)
        if entry is None:
            return {"id": str(name), "state": BOOT_PENDING, "unknown": True}
        check = self._checks.get(entry.key)
        if check is None:
            return self._record(entry, BootVerdict(BOOT_READY))
        verdict = check()
        if not isinstance(verdict, BootVerdict):
            raise TypeError(f"{entry.key} boot check must return BootVerdict")
        if verdict.blocked:
            ColorPrint.yellow(
                f"[ModelBoot] {entry.category}/{entry.id} blocked: {verdict.reason}"
            )
        return self._record(entry, verdict)

    def verify_failed(
        self,
        name: str,
        error: BaseException,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record a check that raised: a load error blocks the entry."""
        entry = model_manifest.get(name, category)
        if entry is None:
            return {"id": str(name), "state": BOOT_PENDING, "unknown": True}
        reason = model_reason(
            MODEL_REASON_LOAD_FAILED,
            model=entry.id,
            detail=f"{type(error).__name__}: {error}",
        )
        ColorPrint.red(f"[ModelBoot] {entry.category}/{entry.id} check raised: {reason}")
        return self._record(entry, BootVerdict(BOOT_BLOCKED, reason))

    def record(self, name: str, category: Optional[str] = None) -> Dict[str, Any]:
        """Latest verdict snapshot of one entry (pending before boot ran)."""
        entry = model_manifest.get(name, category)
        if entry is None:
            return {
                "id": str(name),
                "key": model_key(category or "", name),
                "category": category or "",
                "state": BOOT_PENDING,
                "checked_at": 0.0,
            }
        stored = THREAD_BUS.get_signal(self._signal(entry.key))
        if isinstance(stored, dict):
            return dict(stored)
        return {
            "id": entry.id,
            "key": entry.key,
            "category": entry.category,
            "state": BOOT_PENDING,
            "checked_at": 0.0,
        }

    def is_blocked(self, name: str, category: Optional[str] = None) -> bool:
        return self.record(name, category).get("state") == BOOT_BLOCKED

    def reason(self, name: str, category: Optional[str] = None) -> Optional[str]:
        record = self.record(name, category)
        if record.get("state") != BOOT_BLOCKED:
            return None
        return str(record.get("reason") or "")

    def blocked_ids(self, category: Optional[str] = None) -> List[str]:
        return [
            entry.id
            for entry in model_manifest.entries(category)
            if self.is_blocked(entry.id, entry.category)
        ]

    def records(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        return [
            self.record(entry.id, entry.category)
            for entry in model_manifest.entries(category)
        ]


model_boot = ModelBootRegistry()


__all__ = ["ModelBootRegistry", "model_boot"]
