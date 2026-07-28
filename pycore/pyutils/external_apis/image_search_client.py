# -*- coding: utf-8 -*-
"""
Google Images search via SerpApi (engine=google_images).

Used by the /api/local/image-search UI and as the preferred first source for
book/movie poster lookup (first result image downloaded as local bytes).

pycore rules: networking via get_third_package_requests, secrets via
get_secret_key_indexed, logging via ColorPrint, imports at file top.
NEVER raises — failures return empty results / None.
"""

import base64
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party import get_third_package_requests

_HTTP_TIMEOUT: Tuple[int, int] = (8, 25)
_SERPAPI_URL = "https://serpapi.com/search"
_ENGINE = "google_images"
_KEY_NAME = "SERPAPI_API_KEY"
_DEFAULT_NUM = 12
_MAX_NUM = 30


def serpapi_configured() -> bool:
    """True when a SerpApi key is present."""
    return bool((get_secret_key_indexed(_KEY_NAME) or "").strip())


def _api_key() -> str:
    return (get_secret_key_indexed(_KEY_NAME) or "").strip()


def _normalize_result(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map one SerpApi images_results row to the UI contract."""
    if not isinstance(row, dict):
        return None
    url = (row.get("original") or row.get("thumbnail") or "").strip()
    if not url:
        return None
    return {
        "url": url,
        "thumbnail": row.get("thumbnail") or None,
        "title": row.get("title") or None,
        "source": row.get("source") or None,
        "link": row.get("link") or row.get("source") or None,
    }


def search_images(
    query: str,
    num: int = _DEFAULT_NUM,
    country: Optional[str] = None,
) -> Dict[str, Any]:
    """Run a SerpApi Google-Images search.

    Returns ``{provider, engine, query, count, results[], error?}``. Never raises.
    """
    clean = (query or "").strip()
    if not clean:
        return {
            "provider": "serpapi",
            "engine": _ENGINE,
            "query": "",
            "count": 0,
            "results": [],
            "error": "query is required",
        }

    api_key = _api_key()
    if not api_key:
        return {
            "provider": "serpapi",
            "engine": _ENGINE,
            "query": clean,
            "count": 0,
            "results": [],
            "error": "SERPAPI_API_KEY is not configured",
        }

    num = max(1, min(int(num or _DEFAULT_NUM), _MAX_NUM))
    params: Dict[str, Any] = {
        "engine": _ENGINE,
        "q": clean,
        "api_key": api_key,
        "ijn": "0",
        "num": num,
    }
    if country and str(country).strip():
        params["gl"] = str(country).strip().lower()

    try:
        requests = get_third_package_requests()
        resp = requests.get(_SERPAPI_URL, params=params, timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200:
            detail = (resp.text or "").strip()[:160]
            ColorPrint.yellow(
                f"[ImageSearch] SerpApi HTTP {resp.status_code}"
                + (f" ({detail})" if detail else ""))
            return {
                "provider": "serpapi",
                "engine": _ENGINE,
                "query": clean,
                "count": 0,
                "results": [],
                "error": f"SerpApi HTTP {resp.status_code}",
            }
        data = resp.json() or {}
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[ImageSearch] SerpApi request failed ({exc})")
        return {
            "provider": "serpapi",
            "engine": _ENGINE,
            "query": clean,
            "count": 0,
            "results": [],
            "error": str(exc),
        }

    if data.get("error"):
        err = str(data.get("error"))
        ColorPrint.yellow(f"[ImageSearch] SerpApi error: {err}")
        return {
            "provider": "serpapi",
            "engine": _ENGINE,
            "query": clean,
            "count": 0,
            "results": [],
            "error": err,
        }

    raw_rows = data.get("images_results") or data.get("image_results") or []
    results: List[Dict[str, Any]] = []
    for row in raw_rows:
        norm = _normalize_result(row)
        if norm:
            results.append(norm)
        if len(results) >= num:
            break

    return {
        "provider": "serpapi",
        "engine": _ENGINE,
        "query": clean,
        "count": len(results),
        "results": results,
    }


def download_image_b64(url: str) -> Tuple[str, str]:
    """Download image URL -> (base64, mime). ('', '') on failure."""
    if not url:
        return "", ""
    try:
        requests = get_third_package_requests()
        resp = requests.get(url, timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200 or not resp.content:
            return "", ""
        mime = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
        if not mime.startswith("image/"):
            mime = "image/jpeg"
        return base64.b64encode(resp.content).decode("ascii"), mime
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[ImageSearch] image download failed ({exc})")
        return "", ""


def build_poster_query(title: str, year: Optional[int] = None, kind: str = "book") -> str:
    """Build a Google-Images query for a book/movie poster."""
    clean = (title or "").strip()
    if not clean:
        return ""
    suffix = "book cover" if kind == "book" else "movie poster"
    parts = [clean]
    if year:
        parts.append(str(year))
    parts.append(suffix)
    return " ".join(parts)


def find_first_image_poster(
    query: str,
    *,
    source_id_hint: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Search Google Images and return the first hit as a poster result object.

    Poster contract (MOVIE_POSTER_PIPELINE.md §3):
      {provider, source_id, mime, image_base64, meta}
    """
    search = search_images(query, num=3)
    rows = search.get("results") or []
    if not rows:
        return None

    first = rows[0]
    url = (first.get("url") or "").strip()
    if not url:
        return None

    b64, mime = download_image_b64(url)
    if not b64:
        return None

    source_id = (source_id_hint or url)[:512]
    return {
        "provider": "serpapi",
        "source_id": source_id,
        "mime": mime,
        "image_base64": b64,
        "meta": {
            "title": first.get("title") or query,
            "original_title": first.get("title") or query,
            "poster_url": url,
            "thumbnail": first.get("thumbnail"),
            "link": first.get("link"),
            "source_page": first.get("source"),
            "query": query,
        },
    }
