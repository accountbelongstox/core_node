# -*- coding: utf-8 -*-
"""
Movie / TV poster router — status + config + test for the poster pipeline.

Endpoints (prefix /api/local/poster):
  GET  /status   -> provider key configuration (masked) + the enabled flag
                    (user-data media_sync.fetch_poster, default True).
  POST /config    -> persist the enabled flag into user-data, return new status.
  POST /test      -> run find_poster(title, year) and return the poster result
                    (base64 included so the UI can preview it). Never raises.

Backed by pyutils/external_apis/movie_poster_client.py (TMDB + OMDB) and the
shared secret store (TMDB_API_KEY, TMDB_API_READ_ACCESS_TOKEN, OMDB_API_KEY).
The enabled flag is the SAME user-data key the ingest pipeline reads
(media_sync.fetch_poster) — see callmodule/services/sync/laravel_media_sync.py.

pycore rules honored: imports at file top (PYTHON_PYCORE.md §1.4), secrets only
via get_secret_key_indexed, logging only via ColorPrint, English-only strings.
"""

from typing import Any, Dict, Optional

import fastapi
from pydantic import BaseModel

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyutils.external_apis.movie_poster_client import (
    MCP_CHROME_IMAGE_DELEGATION,
    POSTER_DELEGATED_TO_MCP_CHROME,
    find_poster,
)
from pycore.pyutils.external_apis.image_search_client import serpapi_configured

router = fastapi.APIRouter(prefix="/api/local/poster", tags=["Local Processing - Poster"])

# Same user-data location the ingest pipeline reads (laravel_media_sync.py).
_POSTER_USER_DATA_SECTION = "media_sync"
_POSTER_SETTING_KEY = "fetch_poster"


# --------------------------------------------------------------------------- #
# helpers                                                                      #
# --------------------------------------------------------------------------- #
def _mask(value: Optional[str]) -> str:
    """Mask a secret as first6…last4 (full key never leaves the backend).

    Short keys are fully masked; empty returns "" so the UI shows "not set".
    """
    text = (value or "").strip()
    if not text:
        return ""
    if len(text) <= 10:
        return "*" * len(text)
    return f"{text[:6]}…{text[-4:]}"


def _enabled() -> bool:
    """True when poster fetch is enabled (default ON; user-data may disable)."""
    try:
        section = get_user_data_store().get_section(_POSTER_USER_DATA_SECTION) or {}
        if _POSTER_SETTING_KEY in section:
            return bool(section.get(_POSTER_SETTING_KEY))
    except Exception as exc:  # noqa: BLE001 - best-effort, default ON
        ColorPrint.yellow(f"[Poster] enabled-flag read failed ({exc}); defaulting ON")
    return True


def _build_status() -> Dict[str, Any]:
    """Assemble the /status payload: enabled flag + masked provider keys."""
    tmdb_key = (get_secret_key_indexed("TMDB_API_KEY") or "").strip()
    tmdb_token = (get_secret_key_indexed("TMDB_API_READ_ACCESS_TOKEN") or "").strip()
    omdb_key = (get_secret_key_indexed("OMDB_API_KEY") or "").strip()

    return {
        "enabled": _enabled(),
        "pycore_fetch_disabled": True,
        "delegated_to": "apps/mcp-chrome",
        "delegation_note": MCP_CHROME_IMAGE_DELEGATION,
        "providers": [
            {
                "name": "serpapi",
                "configured": serpapi_configured(),
                "engine": "google_images",
            },
            {
                "name": "tmdb",
                # Configured when EITHER a v3 key or a v4 read token is present.
                "configured": bool(tmdb_key or tmdb_token),
                "has_v4_token": bool(tmdb_token),
            },
            {
                "name": "omdb",
                "configured": bool(omdb_key),
            },
        ],
        "keys": {
            "SERPAPI_API_KEY": _mask((get_secret_key_indexed("SERPAPI_API_KEY") or "").strip()),
            "TMDB_API_KEY": _mask(tmdb_key),
            "TMDB_API_READ_ACCESS_TOKEN": _mask(tmdb_token),
            "OMDB_API_KEY": _mask(omdb_key),
        },
    }


# --------------------------------------------------------------------------- #
# request models                                                              #
# --------------------------------------------------------------------------- #
class PosterConfigRequest(BaseModel):
    # Enable/disable poster fetch at ingest time (media_sync.fetch_poster).
    enabled: bool


class PosterTestRequest(BaseModel):
    # Movie / TV title to look up (required, non-empty).
    title: str
    # Optional release year to disambiguate.
    year: Optional[int] = None


# --------------------------------------------------------------------------- #
# endpoints                                                                    #
# --------------------------------------------------------------------------- #
@router.get("/status")
def status():
    """Provider key configuration (masked) + the enabled flag."""
    return _build_status()


@router.post("/config")
def config(req: PosterConfigRequest):
    """Persist the enabled flag into user-data and return the new status."""
    try:
        get_user_data_store().update_section(
            _POSTER_USER_DATA_SECTION, {_POSTER_SETTING_KEY: bool(req.enabled)})
        ColorPrint.green(f"[Poster] fetch_poster set to {bool(req.enabled)}")
    except Exception as exc:  # noqa: BLE001 - report but still return status
        ColorPrint.yellow(f"[Poster] config persist failed ({exc})")
    return _build_status()


@router.post("/test")
def test(req: PosterTestRequest):
    """Poster lookup disabled in pycore — delegated to apps/mcp-chrome."""
    return {"found": False, "error": POSTER_DELEGATED_TO_MCP_CHROME}

    # --- Legacy TMDB/OMDB test (disabled) ---
    # title = (req.title or "").strip()
    # if not title:
    #     return {"found": False, "error": "title is required"}
    # try:
    #     result = find_poster(title, req.year)
    # ...
