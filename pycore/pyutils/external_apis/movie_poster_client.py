# -*- coding: utf-8 -*-
"""
Movie / TV poster client (TMDB + OMDB) — LEGACY / DISABLED in pycore.

Poster search is delegated to apps/mcp-chrome (Google Images via the extension
task center). pycore no longer fetches or generates posters at ingest or via
the AssistWorker. The functions below remain for reference; callers should not
invoke find_poster / save_poster_file in production paths.

Canonical contract: poly_apps/laravel_main/docs/MOVIE_POSTER_PIPELINE.md
"""

import asyncio
import base64
import os
import re
import threading
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.translator.google_translator import GoogleTranslator
from pycore.pyutils.external_apis.image_search_client import (
    build_poster_query,
    find_first_image_poster,
)


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
POSTER_DELEGATED_TO_MCP_CHROME = (
    "Poster search is handled by apps/mcp-chrome (Google Images via task center), "
    "not pycore TMDB/OMDB."
)

COVER_DELEGATED_TO_MCP_CHROME = (
    "Cover image generation is handled by apps/mcp-chrome (Google Images via task center), "
    "not pycore AI models."
)

MCP_CHROME_IMAGE_DELEGATION = (
    "Cover/poster images are handled by apps/mcp-chrome (Google Images via task center), "
    "not pycore AI models or TMDB/OMDB."
)

# (connect, read) timeouts (seconds) — mirrors ai_gateway's image fetch budget.
_HTTP_TIMEOUT: Tuple[int, int] = (8, 25)

TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/multi"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780"
OMDB_URL = "https://www.omdbapi.com/"

# Release / quality / source tokens stripped from a filename to recover a clean
# title. Matched case-insensitively as whole words. Kept broad but conservative.
_RELEASE_TOKENS = {
    # resolutions
    "480p", "576p", "720p", "1080p", "1440p", "2160p", "4k", "8k", "uhd", "hd", "sd",
    # sources
    "bluray", "blu-ray", "brrip", "bdrip", "bdremux", "remux", "web-dl", "webdl",
    "dl", "webrip", "web", "hdtv", "hdrip", "dvdrip", "dvdscr", "dvd", "cam", "ts",
    "tc", "hdcam", "hdts", "ppvrip", "r5", "telesync", "screener",
    # video codecs
    "x264", "x265", "h264", "h265", "hevc", "avc", "xvid", "divx", "10bit", "8bit",
    "hdr", "hdr10", "dolby", "dovi", "dv",
    # audio
    "aac", "ac3", "eac3", "dts", "dtshd", "truehd", "atmos", "flac", "mp3",
    "ddp", "dd5", "5", "1", "7", "2", "0", "2ch", "6ch", "8ch", "opus",
    # misc
    "proper", "repack", "internal", "limited", "extended", "uncut", "unrated",
    "remastered", "imax", "complete", "multi", "dual", "dubbed", "subbed",
    "retail", "readnfo",
}

# Filename-extension set to drop before parsing (video/subtitle + common doc
# formats, since this parser is reused for book filenames too).
_VIDEO_EXTS = {
    ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg",
    ".mpeg", ".ts", ".m2ts", ".vob", ".rm", ".rmvb", ".srt", ".ass",
    ".pdf", ".epub", ".mobi", ".txt", ".docx", ".doc", ".rtf", ".html", ".htm",
}

# SxxExx / 1x02 season-episode markers.
_SXXEXX_RE = re.compile(r"\b(?:s\d{1,2}\s?e\d{1,3}|\d{1,2}x\d{1,3})\b", re.IGNORECASE)
# Episode / season standalone words (e.g. "Season 1", "Episode 12", "EP05").
_SEASON_EP_RE = re.compile(
    r"\b(?:season|episode|ep|part)\s?\d{1,3}\b", re.IGNORECASE)
# A 4-digit year (1900-2099), optionally wrapped in parens/brackets.
_YEAR_RE = re.compile(r"[\(\[\{]?\b(19\d{2}|20\d{2})\b[\)\]\}]?")
# Bracketed groups, e.g. [GroupName], (info), {tag}.
_BRACKET_RE = re.compile(r"[\(\[\{][^\)\]\}]*[\)\]\}]")
# A trailing "-GROUP" release-group suffix (letters/digits, no spaces).
_TRAILING_GROUP_RE = re.compile(r"-[A-Za-z0-9]{2,}$")
# Any CJK / non-Latin script character (Han, Hiragana, Katakana, Hangul, etc.).
# Unicode escapes only (no literal CJK in source): Hiragana/Katakana
# (U+3040-30FF), CJK ext-A (U+3400-4DBF), CJK unified (U+4E00-9FFF), compat
# ideographs (U+F900-FAFF), Hangul syllables (U+AC00-D7AF).
_CJK_RE = re.compile(
    "[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]")


# --------------------------------------------------------------------------- #
# parse_title_year                                                             #
# --------------------------------------------------------------------------- #
def parse_title_year(filename_or_title: str) -> Tuple[str, Optional[int]]:
    """Extract a clean title + optional year from a filename or raw title.

    Strips release/quality tokens (1080p, x264, BluRay, WEB-DL...), bracketed
    groups, SxxExx / season-episode markers, a trailing ``-GROUP`` suffix and a
    file extension; converts dots/underscores to spaces. Returns
    ``(clean_title, year_or_None)``. Reusable for book and video filenames.

    Never raises — on any input it returns the best-effort title (possibly the
    original string) and a year only when one was confidently found.
    """
    if not filename_or_title:
        return "", None
    text = str(filename_or_title).strip()

    # Drop a known video/subtitle/doc extension (only the final one).
    dot = text.rfind(".")
    if dot > 0 and text[dot:].lower() in _VIDEO_EXTS:
        text = text[:dot]

    # Normalize scene separators to spaces FIRST so the year boundary (\b) matches
    # in names like "Spirited_Away_2001_BDRip" (underscore is a word char and
    # would otherwise hide the year). Dots/underscores are never meaningful here.
    text = text.replace(".", " ").replace("_", " ")

    # The title is the part BEFORE the first year — release info (quality/source/
    # codec tokens) almost always trails the year in scene names. Find the first
    # plausible year, keep its value, and cut the title there.
    year: Optional[int] = None
    first_year = _YEAR_RE.search(text)
    if first_year is not None:
        year = int(first_year.group(1))
        title_part = text[: first_year.start()]
        # If nothing meaningful precedes the year (e.g. "[2010] Title"), keep the
        # whole string for token-stripping rather than ending up empty.
        if title_part.strip(" .-_[](){}"):
            text = title_part

    # Remove bracketed groups, season/episode markers.
    text = _BRACKET_RE.sub(" ", text)
    text = _SXXEXX_RE.sub(" ", text)
    text = _SEASON_EP_RE.sub(" ", text)

    # dashes -> spaces (dots/underscores already normalized above).
    text = text.replace("-", " ")
    text = re.sub(r"\s+", " ", text).strip()

    # Drop release/quality/source tokens ANYWHERE in the remaining text. Once the
    # year cut removed most trailing noise, any leftover token word (a stray
    # "1080p", "x264", "GROUP"-style codec) is noise, not part of the title.
    words = [w for w in text.split(" ") if w and w.lower() not in _RELEASE_TOKENS]

    title = " ".join(words).strip(" -")
    if not title:
        # Everything looked like release noise; fall back to the pre-token text.
        title = text.strip(" -") or str(filename_or_title).strip()
    return title, year


# --------------------------------------------------------------------------- #
# translation helper (CJK -> English)                                          #
# --------------------------------------------------------------------------- #
def _looks_non_latin(text: str) -> bool:
    """True when the title contains CJK / non-Latin script worth translating."""
    return bool(_CJK_RE.search(text or ""))


def _run_async(coro):
    """Run an async coroutine to completion from any thread.

    Mirrors the translation worker's pattern: normally we spin a private event
    loop via asyncio.run. If a loop is ALREADY running on this thread (rare for
    these call sites), run the coroutine on a dedicated worker thread so we never
    raise "asyncio.run() cannot be called from a running event loop".
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # No running loop on this thread — the normal path.
        return asyncio.run(coro)

    # A loop is running here — offload to a fresh thread with its own loop.
    result: Dict[str, Any] = {}

    def _worker():
        try:
            result["value"] = asyncio.run(coro)
        except Exception as exc:  # noqa: BLE001 - best-effort
            result["error"] = exc

    t = threading.Thread(target=_worker, daemon=True, name="poster-translate")
    t.start()
    t.join()
    if "error" in result:
        raise result["error"]
    return result.get("value")


def _translate_to_english(title: str) -> str:
    """Translate a (likely CJK) title to English via GoogleTranslator.

    Returns the English text, or the original title on any failure (best-effort).
    """
    if not title:
        return title

    async def _run() -> str:
        async with GoogleTranslator() as translator:
            res = await translator.translate_single(
                title, src="auto", dest="en", use_cache=True)
        return getattr(res, "translated_text", "") or ""

    try:
        english = _run_async(_run())
        if english and english.strip():
            ColorPrint.blue(
                f"[MoviePoster] Translated title '{title}' -> '{english.strip()}'")
            return english.strip()
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[MoviePoster] Title translation failed ({exc}); using original")
    return title


# --------------------------------------------------------------------------- #
# image download                                                              #
# --------------------------------------------------------------------------- #
def _download_image_b64(url: str) -> Tuple[str, str]:
    """Download an image URL -> (base64, mime). ('', '') on any failure.

    Mirrors ai_gateway._fetch_image_b64's download/MIME handling.
    """
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
        ColorPrint.yellow(f"[MoviePoster] Poster download failed ({exc})")
        return "", ""


# --------------------------------------------------------------------------- #
# TMDB                                                                         #
# --------------------------------------------------------------------------- #
def _tmdb_find(title: str, year: Optional[int], language: str) -> Optional[Dict[str, Any]]:
    """Query TMDB search/multi and build the poster result object, or None.

    v4 Bearer token (TMDB_API_READ_ACCESS_TOKEN) is preferred; else the v3
    api_key (TMDB_API_KEY). Picks the first result with a non-null poster_path
    (preferring movie/tv media types).
    """
    token = get_secret_key_indexed("TMDB_API_READ_ACCESS_TOKEN")
    api_key = get_secret_key_indexed("TMDB_API_KEY")
    if not (token or api_key):
        return None

    params: Dict[str, Any] = {"query": title, "language": language or "en",
                              "include_adult": "false"}
    if year:
        params["year"] = year
    headers: Dict[str, str] = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        params["api_key"] = api_key

    try:
        requests = get_third_package_requests()
        resp = requests.get(TMDB_SEARCH_URL, params=params, headers=headers,
                            timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200:
            ColorPrint.yellow(
                f"[MoviePoster] TMDB search HTTP {resp.status_code}: {resp.text[:160]}")
            return None
        results: List[Dict[str, Any]] = (resp.json() or {}).get("results") or []
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[MoviePoster] TMDB search failed ({exc})")
        return None

    # Prefer movie/tv with a poster, then any result with a poster.
    ranked = sorted(
        [r for r in results if r.get("poster_path")],
        key=lambda r: 0 if r.get("media_type") in ("movie", "tv") else 1,
    )
    if not ranked:
        return None
    hit = ranked[0]
    poster_url = TMDB_IMAGE_BASE + hit["poster_path"]
    b64, mime = _download_image_b64(poster_url)
    if not b64:
        return None

    media_type = hit.get("media_type") or "movie"
    tmdb_id = hit.get("id")
    title_field = hit.get("title") or hit.get("name") or title
    original_field = hit.get("original_title") or hit.get("original_name") or title_field
    release = hit.get("release_date") or hit.get("first_air_date") or ""
    result_year = year
    if not result_year and len(release) >= 4 and release[:4].isdigit():
        result_year = int(release[:4])

    return {
        "provider": "tmdb",
        "source_id": f"tmdb:{media_type}:{tmdb_id}",
        "mime": mime,
        "image_base64": b64,
        "meta": {
            "title": title_field,
            "original_title": original_field,
            "year": result_year,
            "overview": hit.get("overview") or "",
            "poster_url": poster_url,
        },
    }


# --------------------------------------------------------------------------- #
# OMDB                                                                         #
# --------------------------------------------------------------------------- #
# OMDB answers HTTP 401 for exactly two unrecoverable conditions, distinguished
# only by the JSON ``Error`` field:
#   * "Invalid API key!"      -> the key is wrong or was never activated (free
#                                keys must be activated via the emailed link).
#   * "Request limit reached!" -> the daily quota is spent (free tier = 1000/day).
# Neither recovers within a run, yet a batch keeps one OMDB call per poster — so
# a single 401 would otherwise burn the rest of the run (and more quota) for
# nothing. Latch a process-wide disable on the first 401 (mirrors the AI
# gateway's 429 cooldown) and short-circuit every later OMDB lookup.
_omdb_disabled_reason: Optional[str] = None
_omdb_lock = threading.Lock()


def _omdb_find(title: str, year: Optional[int]) -> Optional[Dict[str, Any]]:
    """Query OMDB (?apikey=&t=&y=) and build the poster result object, or None."""
    global _omdb_disabled_reason
    if _omdb_disabled_reason is not None:
        return None

    api_key = get_secret_key_indexed("OMDB_API_KEY")
    if not api_key:
        return None

    params: Dict[str, Any] = {"apikey": api_key, "t": title}
    if year:
        params["y"] = year
    try:
        requests = get_third_package_requests()
        resp = requests.get(OMDB_URL, params=params, timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200:
            # Pull OMDB's reason out of the body (it 401s with a JSON Error).
            detail = ""
            try:
                detail = (resp.json() or {}).get("Error") or ""
            except Exception:  # noqa: BLE001 - body may not be JSON
                detail = (resp.text or "").strip()[:160]
            if resp.status_code == 401:
                with _omdb_lock:
                    if _omdb_disabled_reason is None:
                        _omdb_disabled_reason = detail or "HTTP 401"
                ColorPrint.yellow(
                    f"[MoviePoster] OMDB HTTP 401 ({detail or 'unauthorized'}); "
                    "disabling OMDB for this run — verify OMDB_API_KEY is valid and "
                    "activated, and that the daily request limit (free tier = "
                    "1000/day) is not exhausted")
            else:
                ColorPrint.yellow(
                    f"[MoviePoster] OMDB HTTP {resp.status_code}"
                    + (f" ({detail})" if detail else ""))
            return None
        data = resp.json() or {}
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[MoviePoster] OMDB lookup failed ({exc})")
        return None

    if str(data.get("Response", "")).lower() != "true":
        return None
    poster_url = data.get("Poster") or ""
    if not poster_url or poster_url == "N/A":
        return None
    b64, mime = _download_image_b64(poster_url)
    if not b64:
        return None

    imdb_id = data.get("imdbID") or ""
    result_year = year
    if not result_year and str(data.get("Year", ""))[:4].isdigit():
        result_year = int(str(data.get("Year"))[:4])

    return {
        "provider": "omdb",
        "source_id": f"imdb:{imdb_id}" if imdb_id else "imdb:",
        "mime": mime,
        "image_base64": b64,
        "meta": {
            "title": data.get("Title") or title,
            "original_title": data.get("Title") or title,
            "year": result_year,
            "overview": data.get("Plot") or "",
            "poster_url": poster_url,
        },
    }


# --------------------------------------------------------------------------- #
# find_poster                                                                  #
# --------------------------------------------------------------------------- #
def find_poster(
    title: str,
    year: Optional[int] = None,
    language: str = "en",
    kind: str = "movie",
) -> Optional[Dict[str, Any]]:
    """Find a movie/TV/book poster for ``title`` (+ optional ``year``).

    CJK / non-Latin titles are translated to English first. Tries SerpApi Google
    Images (first result), then TMDB (v4 Bearer token preferred, else v3
    api_key); on miss / no key / error falls back to OMDB. Returns the §3 poster
    result object ``{provider, source_id, mime, image_base64, meta}`` or None.

    ``kind`` is ``"movie"`` (default) or ``"book"`` — controls the image-search
    query suffix ("movie poster" vs "book cover").

    NEVER raises — disabled in pycore; returns None immediately.
    """
    ColorPrint.blue(f"[MoviePoster] {POSTER_DELEGATED_TO_MCP_CHROME}")
    return None

    # --- Legacy TMDB/OMDB/SerpApi fetch (disabled; kept for reference) ---
    try:
        clean = (title or "").strip()
        if not clean:
            return None

        query_title = clean
        if _looks_non_latin(clean):
            query_title = _translate_to_english(clean)

        poster_kind = kind if kind in ("book", "movie") else "movie"
        image_query = build_poster_query(query_title, year, kind=poster_kind)
        if image_query:
            result = find_first_image_poster(image_query)
            if result:
                ColorPrint.green(
                    f"[MoviePoster] SerpApi poster for '{clean}' -> {result['source_id']}")
                return result

        result = _tmdb_find(query_title, year, language)
        if result:
            ColorPrint.green(
                f"[MoviePoster] TMDB poster for '{clean}' -> {result['source_id']}")
            return result

        result = _omdb_find(query_title, year)
        if result:
            ColorPrint.green(
                f"[MoviePoster] OMDB poster for '{clean}' -> {result['source_id']}")
            return result

        ColorPrint.blue(f"[MoviePoster] No poster found for '{clean}'"
                        + (f" ({year})" if year else ""))
        return None
    except Exception as exc:  # noqa: BLE001 - never break the caller
        ColorPrint.yellow(f"[MoviePoster] find_poster error ({exc})")
        return None


# --------------------------------------------------------------------------- #
# save_poster_file                                                             #
# --------------------------------------------------------------------------- #
_MIME_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def save_poster_file(
    image_base64: str,
    mime: str,
    dest_path_without_ext: str,
) -> Optional[str]:
    """Decode ``image_base64`` and write it next to ``dest_path_without_ext``.

    The extension is chosen from ``mime`` (default .jpg). Returns the written
    file path, or None on any failure. Used by video-extract to save poster.jpg
    into a video's output dir.
    """
    if not (image_base64 and dest_path_without_ext):
        return None
    ext = _MIME_EXT.get((mime or "").split(";")[0].strip().lower(), ".jpg")
    out_path = dest_path_without_ext + ext
    try:
        raw = base64.b64decode(image_base64)
        if not raw:
            return None
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "wb") as fh:
            fh.write(raw)
        return out_path
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[MoviePoster] save_poster_file failed ({exc})")
        return None
