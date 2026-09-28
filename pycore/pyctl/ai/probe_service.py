# -*- coding: utf-8 -*-
"""
AI provider probe application service.

Endpoints (prefix /api/local/ai):
  GET /probe[?refresh=1]   -> probe_all(): per-provider configured/available/models
  GET /balance[?provider=] -> balance_all()/balance_one(): account credit/balance

Probing makes live network calls (list-models per provider) and can be slow.
The all-provider result is probed ONCE at pycore startup and cached for the
whole process lifetime (re-probed only after a restart); ``?refresh=1`` forces
a fresh probe on demand. Every response carries ``boot_id`` (process start
timestamp) so the UI can detect a pycore restart and drop its own frontend
cache. Unconfigured providers and providers on cooldown / over the local rate
budget are skipped (no network) unless the UI explicitly tests one provider.
The returned JSON matches the exact contract in pycore.pyctl.ai.ai_probe
(UI depends on it).
"""

import time
from datetime import datetime
from typing import Optional

from pycore.pyctl.ai.ai_probe import probe_all, probe_one
from pycore.pyctl.ai.ai_balance import balance_all, balance_one
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_AI_PROBE_KEY,
    status_snapshot_cache,
)

# Process boot marker: the availability cache lives exactly one pycore
# lifetime, so the boot timestamp doubles as the cache generation the UI
# compares against its own frontend cache.
BOOT_ID = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
_PROBE_CACHE_TTL_SECONDS = float("inf")


def warm_startup_probe() -> None:
    """Probe all providers once at startup and fill the process-lifetime cache.

    Runs on a background bus task (network-bound); subsequent /probe reads are
    served from the cache until the process restarts.
    """
    ColorPrint.blue("[AiProbe] startup availability probe started")
    result = probe(refresh=1)
    providers = result.get("providers") or []
    available = sum(1 for item in providers if item.get("available"))
    ColorPrint.green(
        f"[AiProbe] startup availability cached boot_id={BOOT_ID} "
        f"providers={len(providers)} available={available}"
    )


def probe(refresh: int = 0, provider: Optional[str] = None):
    """
    Live availability test for AI providers (rate-aware: a provider over its
    local free-tier budget is skipped, and a successful test is recorded).

    - ``?provider=NAME`` tests ONE provider and returns that single record
      (used by the per-card "Test" button) — never cached.
    - No ``provider`` returns the process-lifetime startup cache (probed once
      at boot); ``?refresh=1`` forces a fresh run. Carries 'cached' + 'age_ms'
      + 'boot_id' flags.
    """
    if provider:
        # Single-provider test: always live, never cached.
        return probe_one(provider)

    loaded_here = False

    def load_probe() -> dict:
        nonlocal loaded_here
        result = probe_all()
        loaded_here = True
        return {"result": result, "completed_at": time.time()}

    if refresh:
        status_snapshot_cache.invalidate(STATUS_SNAPSHOT_AI_PROBE_KEY)
    snapshot = status_snapshot_cache.get(
        STATUS_SNAPSHOT_AI_PROBE_KEY,
        load_probe,
        ttl_seconds=_PROBE_CACHE_TTL_SECONDS,
        stale_while_refresh=False,
    )
    result = snapshot.get("result") or {}
    completed_at = float(snapshot.get("completed_at") or time.time())
    out = dict(result) if isinstance(result, dict) else {}
    out["cached"] = not loaded_here
    out["age_ms"] = round(max(0.0, time.time() - completed_at) * 1000, 1)
    out["boot_id"] = BOOT_ID
    return out


def balance(provider: Optional[str] = None):
    """
    Read AI account balance / remaining credit.

    Only a few providers expose a machine-readable balance endpoint
    (openrouter / deepseek / siliconflow / moonshot); every other provider is
    reported as ``supported:false`` WITHOUT a network call (billing is
    console-only — e.g. Gemini, OpenAI, Anthropic).

    - ``?provider=NAME`` returns the single balance record for that provider.
    - No ``provider`` returns ``{providers, supported, unsupported}`` for the
      whole balance-capable set. Never cached — balances change with usage and
      the call set is tiny.
    """
    if provider:
        return balance_one(provider)
    return balance_all()
