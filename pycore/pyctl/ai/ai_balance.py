#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified AI provider balance / credit reader.

Only a handful of providers expose a machine-readable account-balance endpoint.
This module queries those that do and returns ONE stable contract, mirroring the
shape and conventions of ``ai_probe`` (key via the common secret reader, masked
display key, ``get_third_package_requests`` for the HTTP call).

Providers WITH a balance API (all Bearer-authenticated GETs):
  - openrouter : GET https://openrouter.ai/api/v1/credits
                 -> {data:{total_credits, total_usage}}  (remaining = credits - usage, USD)
                 (also /api/v1/key for is_free_tier + limit_remaining)
  - deepseek   : GET https://api.deepseek.com/user/balance
                 -> {is_available, balance_infos:[{currency, total_balance,
                     granted_balance, topped_up_balance}]}
  - siliconflow: GET {base}/user/info
                 -> {data:{balance, chargeBalance, totalBalance}}  (CNY)
  - moonshot   : GET {base}/users/me/balance
                 -> {data:{available_balance, voucher_balance, cash_balance}}  (CNY)

Every OTHER registered provider (gemini/openai/anthropic/groq/mistral/cohere/
nvidia/huggingface/zhipuai/...) has NO public balance API — billing is console-
only — so they are reported with ``supported: false`` and never hit the network.

Contract (UI depends on this EXACT shape):
    {
      "name": str,
      "supported": bool,            # provider exposes a balance API at all
      "configured": bool,           # key present
      "ok": bool,                   # live fetch succeeded
      "currency": str | None,       # "USD" / "CNY" / ...
      "balance": float | None,      # remaining / available balance
      "granted": float | None,      # free / granted portion (deepseek)
      "topped_up": float | None,    # paid / topped-up portion (deepseek)
      "total": float | None,        # total credits granted (openrouter)
      "used": float | None,         # total usage to date (openrouter)
      "is_free_tier": bool | None,  # openrouter key tier
      "key_masked": str | None,     # first4 + "…" + last4 (never the full key)
      "detail": str,                # human one-liner, e.g. "4.20 USD remaining"
      "error": str | None,
      "latency_ms": float | None
    }
"""

import time
from typing import Dict, Any, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_requests

from pycore.pyctl.ai.ai_keys import (
    PROVIDER_ORDER,
    base_url,
    first_secret as _provider_secret,
)
from pycore.pyctl.ai.ai_probe import mask_key

# Per-request network timeout (seconds). Balance endpoints are tiny + fast.
_TIMEOUT = 10.0


def _num(value: Any) -> Optional[float]:
    """Coerce an API field (often a STRING like "4.20") to float, or None."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _base_record(name: str, supported: bool) -> Dict[str, Any]:
    """A fully-populated record with neutral defaults (UI never sees missing keys)."""
    key = _provider_secret(name) if supported else ""
    return {
        "name": name,
        "supported": supported,
        "configured": bool(key),
        "ok": False,
        "currency": None,
        "balance": None,
        "granted": None,
        "topped_up": None,
        "total": None,
        "used": None,
        "is_free_tier": None,
        "key_masked": mask_key(key) if key else None,
        "detail": "" if supported else "No balance API (billing is console-only)",
        "error": None,
        "latency_ms": None,
    }


def _get_json(url: str, key: str) -> Dict[str, Any]:
    """Bearer GET returning parsed JSON. Raises on transport / HTTP / parse error."""
    requests = get_third_package_requests()
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


# -------------------- per-provider balance fetchers --------------------
# Each fetcher receives the pre-built record (already carries key_masked /
# configured) and the active key, mutates the record in place, and returns it.

def _balance_openrouter(rec: Dict[str, Any], key: str) -> Dict[str, Any]:
    data = _get_json("https://openrouter.ai/api/v1/credits", key).get("data") or {}
    total = _num(data.get("total_credits"))
    used = _num(data.get("total_usage"))
    rec["currency"] = "USD"
    rec["total"] = total
    rec["used"] = used
    if total is not None and used is not None:
        rec["balance"] = round(total - used, 6)
    # Best-effort key metadata (free-tier flag); never fail the whole call on it.
    try:
        kd = _get_json("https://openrouter.ai/api/v1/key", key).get("data") or {}
        if kd.get("is_free_tier") is not None:
            rec["is_free_tier"] = bool(kd.get("is_free_tier"))
        limit_remaining = _num(kd.get("limit_remaining"))
        if rec["balance"] is None and limit_remaining is not None:
            rec["balance"] = limit_remaining
    except Exception:
        pass
    return rec


def _balance_deepseek(rec: Dict[str, Any], key: str) -> Dict[str, Any]:
    data = _get_json("https://api.deepseek.com/user/balance", key)
    infos = data.get("balance_infos") or []
    info = infos[0] if infos else {}
    rec["currency"] = info.get("currency")
    rec["balance"] = _num(info.get("total_balance"))
    rec["granted"] = _num(info.get("granted_balance"))
    rec["topped_up"] = _num(info.get("topped_up_balance"))
    return rec


def _balance_siliconflow(rec: Dict[str, Any], key: str) -> Dict[str, Any]:
    base = base_url("siliconflow") or "https://api.siliconflow.cn/v1"
    data = _get_json(f"{base}/user/info", key).get("data") or {}
    rec["currency"] = "CNY"
    rec["balance"] = _num(data.get("totalBalance"))
    rec["granted"] = _num(data.get("balance"))          # gift / granted portion
    rec["topped_up"] = _num(data.get("chargeBalance"))  # recharged portion
    return rec


def _balance_moonshot(rec: Dict[str, Any], key: str) -> Dict[str, Any]:
    base = base_url("moonshot") or "https://api.moonshot.cn/v1"
    data = _get_json(f"{base}/users/me/balance", key).get("data") or {}
    rec["currency"] = "CNY"
    rec["balance"] = _num(data.get("available_balance"))
    rec["granted"] = _num(data.get("voucher_balance"))
    rec["topped_up"] = _num(data.get("cash_balance"))
    return rec


# Registry: provider name -> fetcher. Membership here == "supports balance".
_BALANCE_BY_NAME = {
    "openrouter": _balance_openrouter,
    "deepseek": _balance_deepseek,
    "siliconflow": _balance_siliconflow,
    "moonshot": _balance_moonshot,
}

# Stable order for UI rendering (intersect with the global provider order).
BALANCE_PROVIDERS: List[str] = [n for n in PROVIDER_ORDER if n in _BALANCE_BY_NAME]
# Any balance-capable provider not in PROVIDER_ORDER still gets appended.
BALANCE_PROVIDERS += [n for n in _BALANCE_BY_NAME if n not in BALANCE_PROVIDERS]


def _summarize(rec: Dict[str, Any]) -> None:
    """Fill ``detail`` with a short human one-liner from the numeric fields."""
    bal, cur = rec.get("balance"), rec.get("currency") or ""
    if bal is not None:
        rec["detail"] = f"{bal:g} {cur}".strip() + " remaining"
        if rec.get("is_free_tier"):
            rec["detail"] += " (free tier)"


def balance_one(name: str) -> Dict[str, Any]:
    """
    Fetch the account balance for ONE provider.

    Returns the stable record. Providers without a balance API return
    ``supported: false`` WITHOUT any network call. Supported-but-unconfigured
    providers return ``configured: false`` (no call). Network/HTTP errors are
    captured in ``error`` (the record is still well-formed).
    """
    fetcher = _BALANCE_BY_NAME.get(name)
    rec = _base_record(name, supported=fetcher is not None)
    if fetcher is None:
        return rec
    key = _provider_secret(name)
    if not key:
        rec["detail"] = "No API key configured"
        return rec

    t0 = time.time()
    try:
        fetcher(rec, key)
        rec["ok"] = True
        _summarize(rec)
    except Exception as exc:  # noqa: BLE001 — surface any failure as a field
        rec["error"] = f"{type(exc).__name__}: {exc}"
        rec["detail"] = "Balance check failed"
        ColorPrint.print_warning(f"[ai_balance] {name} balance failed: {rec['error']}")
    finally:
        rec["latency_ms"] = round((time.time() - t0) * 1000, 1)
    return rec


def balance_all() -> Dict[str, Any]:
    """
    Fetch balances for every balance-capable provider (live, sequential — the
    set is tiny). Providers without a balance API are listed separately so the
    UI can render "no balance endpoint" rows without a network hit.

    Contract:
        {
          "providers": [ <record per balance-capable provider> ],
          "supported": [names...],     # providers that expose a balance API
          "unsupported": [names...]    # every other registered provider
        }
    """
    providers = [balance_one(name) for name in BALANCE_PROVIDERS]
    unsupported = [n for n in PROVIDER_ORDER if n not in _BALANCE_BY_NAME]
    return {
        "providers": providers,
        "supported": list(BALANCE_PROVIDERS),
        "unsupported": unsupported,
    }
