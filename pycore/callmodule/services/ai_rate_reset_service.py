#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI rate-budget auto-reset service (pyheartbeat-injected).

A LIGHT, exception-safe tick callback that the heartbeat fires on an interval.
On each tick it asks the AI layer to:
  - prune expired rate-counter entries (ai_rate_limits.prune_expired) so the
    per-minute / per-day / per-month budgets free up by the AI's own rate
    windows, and
  - clear elapsed 429/quota cooldowns (ai_gateway.clear_expired_cooldowns).

Together this is the "auto-reset the quota by the AI rate" behavior, surfaced
on the UI (which reads the rate snapshot) and at the system level (dispatch sees
the recovered providers).

Decoupling: pyheartbeat stays generic — it knows nothing about AI. This service
is INJECTED via heartbeat.register_callback() from callmodule wiring, exactly
like the translation / TTS / queue-monitor workers. The heartbeat is just the
trigger; any task can be injected the same way.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.ai import prune_expired, clear_expired_cooldowns


class AiRateResetService:
    """Singleton: one rate-budget reset pass per heartbeat tick (exception-safe)."""

    def __init__(self) -> None:
        self._tick_count = 0
        self._last_summary: Dict[str, Any] = {}

    def tick(self) -> None:
        """
        Heartbeat callback. NEVER raises (the heartbeat loop must not break).
        Prunes expired rate counters and clears elapsed cooldowns; only logs
        when something actually reset, to keep the tick quiet.
        """
        # Rule §4: single-writer field — tick() only ever runs on the ONE
        # heartbeat thread, so the increment needs no lock.
        self._tick_count += 1
        try:
            pruned = prune_expired()
            cooled = clear_expired_cooldowns()
            self._last_summary = {
                "tick": self._tick_count,
                "pruned": pruned,
                "cooldowns_cleared": cooled.get("cleared", []),
            }
            if pruned.get("changed"):
                freed = pruned.get("freed") or {}
                if freed:
                    ColorPrint.gray(
                        "[AiRateReset] freed budget: "
                        + ", ".join(f"{p}({','.join(k for k in w)})" for p, w in freed.items())
                    )
        except Exception as e:  # noqa: BLE001 — keep the heartbeat alive
            ColorPrint.yellow(f"[AiRateReset] tick error: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Last reset summary (for status endpoints / debugging)."""
        return {"tick_count": self._tick_count, "last": self._last_summary}


_service: Optional[AiRateResetService] = None


def get_ai_rate_reset_service() -> AiRateResetService:
    """Return the process-wide AiRateResetService singleton."""
    global _service
    # Rule §4: NO locks — module-global assignment is GIL-atomic (same idiom as
    # pyheartbeat); the worst-case race is one duplicate instance built and
    # discarded, harmless for this stateless-per-tick service.
    if _service is None:
        _service = AiRateResetService()
    return _service
