# -*- coding: utf-8 -*-
"""
AI provider probe router.

Endpoints (prefix /api/local/ai):
  GET /probe[?refresh=1]   -> probe_all(): per-provider configured/available/models
  GET /balance[?provider=] -> balance_all()/balance_one(): account credit/balance

Probing makes live network calls (list-models per provider) and can be slow.
The result is cached for ~30s; ``?refresh=1`` forces a fresh probe. Unconfigured
providers and providers on cooldown / over the local rate budget are skipped
(no network) unless the UI explicitly tests one provider. The returned JSON
matches the exact contract in pycore.pyctl.ai.ai_probe (UI depends on it).
"""

import time
from typing import Optional

import fastapi

from pycore.pyctl.ai import probe_all, probe_one, catalog, balance_all, balance_one
from pycore.pyfoundations.thread_bus import THREAD_BUS

router = fastapi.APIRouter(prefix="/api/local/ai", tags=["Local Processing - AI"])

# Last-probe cache so repeated UI loads are cheap. ~30s TTL; refresh=1 bypasses.
_CACHE_TTL_SECONDS = 30.0
_CACHE_SIGNAL = 'callmodule.ai_probe.cache'


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
    if provider:
        # Single-provider test: always live, never cached.
        return probe_one(provider)

    now = time.time()
    cache = THREAD_BUS.get_signal(_CACHE_SIGNAL, {}) or {}
    cache_result = cache.get('result')
    cache_ts = float(cache.get('timestamp') or 0.0)
    fresh_enough = (
        cache_result is not None
        and not refresh
        and (now - cache_ts) < _CACHE_TTL_SECONDS
    )
    if fresh_enough:
        out = dict(cache_result)
        out["cached"] = True
        out["age_ms"] = round((now - cache_ts) * 1000, 1)
        return out

    result = probe_all()
    THREAD_BUS.signal(_CACHE_SIGNAL, {
        'result': result,
        'timestamp': time.time(),
    })

    out = dict(result)
    out["cached"] = False
    out["age_ms"] = 0.0
    return out


@router.get("/balance")
async def balance(provider: Optional[str] = None):
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
