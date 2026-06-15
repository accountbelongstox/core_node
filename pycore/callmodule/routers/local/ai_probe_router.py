# -*- coding: utf-8 -*-
"""
AI provider probe router.

Endpoints (prefix /api/local/ai):
  GET /probe[?refresh=1]   -> probe_all(): per-provider configured/available/models

Probing makes live network calls (list-models per provider) and can be slow, so
the result is cached for ~30s; ``?refresh=1`` forces a fresh probe. The returned
JSON matches the exact contract in pycore.pyctl.ai.ai_probe (UI depends on it).
"""

import time
import threading
from typing import Optional

import fastapi

from pycore.pyctl.ai import probe_all, probe_one, catalog

router = fastapi.APIRouter(prefix="/api/local/ai", tags=["Local Processing - AI"])

# Last-probe cache so repeated UI loads are cheap. ~30s TTL; refresh=1 bypasses.
_CACHE_TTL_SECONDS = 30.0
_cache_lock = threading.Lock()
_cache_result = None
_cache_ts = 0.0


@router.get("/catalog")
async def ai_catalog():
    """
    List every AI provider WITHOUT a live network test (no token/quota spend).

    Returns the unified contract (configured / tier / limits / vision /
    key_masked / catalog models + current rate snapshot, all `tested:false`).
    The UI renders its grid from this and only tests on demand, so simply
    opening the page never probes a provider.
    """
    return catalog()


@router.get("/probe")
async def probe(refresh: int = 0, provider: Optional[str] = None):
    """
    Live availability test for AI providers (rate-aware: a provider over its
    local free-tier budget is skipped, and a successful test is recorded).

    - ``?provider=NAME`` tests ONE provider and returns that single record
      (used by the per-card "Test" button) — never cached.
    - No ``provider`` tests them all (the "Test all" button); cached ~30s,
      ``?refresh=1`` forces a fresh run. Carries 'cached' + 'age_ms' flags.
    """
    global _cache_result, _cache_ts

    if provider:
        # Single-provider test: always live, never cached.
        return probe_one(provider)

    now = time.time()
    with _cache_lock:
        fresh_enough = (
            _cache_result is not None
            and not refresh
            and (now - _cache_ts) < _CACHE_TTL_SECONDS
        )
        if fresh_enough:
            out = dict(_cache_result)
            out["cached"] = True
            out["age_ms"] = round((now - _cache_ts) * 1000, 1)
            return out

    # Run the (potentially slow) probe outside the lock so concurrent callers
    # are not blocked behind it; last writer wins for the cache.
    result = probe_all()

    with _cache_lock:
        _cache_result = result
        _cache_ts = time.time()

    out = dict(result)
    out["cached"] = False
    out["age_ms"] = 0.0
    return out
