# -*- coding: utf-8 -*-
"""
Word pronunciation audio client (Free Dictionary API + Wikimedia Commons +
Cambridge Dictionary + Forvo).

Real (non-synthetic) pronunciation source chain for the "word_audio" assist lane.
When a word's static pronunciation audio is missing, the caller (translation
worker) tries this chain FIRST — a real dictionary / native-speaker recording is
strictly preferred over TTS synthesis — and only falls back to
``pycore.pyutils.tts.tts_orchestrator.synthesize()`` when every source here
returns None.

Approved sources, tried in priority order (see find_pronunciation):
  1. Free Dictionary API (https://api.dictionaryapi.dev) — free, keyless,
     official public API. English only.
  2. Wikimedia Commons — community native-speaker recordings under the stable
     naming scheme ``File:En-us-<word>.ogg`` / ``File:En-uk-<word>.ogg``,
     resolved to the real upload URL via the official commons API. English
     only; the accent is exact by construction.
  3. Cambridge Dictionary — plain HTTP GET of the public dictionary page +
     HTML parse of the official ``<audio><source>`` pronunciation mp3 URL
     (normal browser User-Agent, nothing more evasive). English only.
  4. Forvo — OFFICIAL PAID API ONLY (https://apifree.forvo.com), gated behind a
     FORVO_API_KEY secret. Multi-language. If no key is configured, Forvo is
     silently skipped with NO network call — there is intentionally no
     scraping / anti-bot-bypass fallback for Forvo's free web tier; that tier
     is protected by anti-scraping checks and must not be circumvented.

Accent handling (find_pronunciation ``accent`` = "us"|"uk"|None): when an
accent is requested the chain runs TWO passes — pass 1 accepts ONLY the
preferred accent across every source, pass 2 accepts any accent — so a
matching-accent recording from a lower-priority source beats a wrong-accent
one from a higher-priority source. Every result carries the accent ACTUALLY
obtained ("us"|"uk"|"unknown") as top-level ``accent`` and ``meta.region``.

Explicitly EXCLUDED by design (do not add): YouGlish (video-embed widget, no
downloadable audio file, ToS forbids downloading — no compliant way to produce
a cacheable static audio file from it).

pycore rules honored here:
  * Networking ONLY via get_third_package_requests (never ``import requests``).
  * HTML parsing ONLY via get_third_package_BeautifulSoup (never
    ``import bs4``).
  * Secrets ONLY via get_secret_key_indexed.
  * Language gating reuses pyfoundations.text_parsing.normalize_language_codes
    (the same canonical-language-set helper the subtitle ingest pipeline uses)
    instead of an ad-hoc English-code check.
  * Logging ONLY via ColorPrint.
  * Imports at file top (PYTHON_PYCORE.md §1.4).
  * NEVER raises — every source function is independently guarded and returns
    None on any failure; find_pronunciation() never raises to its caller.

All strings here are English (pycore code rule).
"""

import threading
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urljoin

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.text_parsing import normalize_language_codes
from pycore.pyfoundations.third_party.api import get_third_package_BeautifulSoup, get_third_package_requests


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# (connect, read) timeouts (seconds) — mirrors movie_poster_client's budget.
_HTTP_TIMEOUT: Tuple[int, int] = (8, 25)

FREE_DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en"

# Official MediaWiki API for Wikimedia Commons (file-title -> upload URL).
WIKIMEDIA_COMMONS_API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia API etiquette asks for a descriptive User-Agent.
WIKIMEDIA_USER_AGENT = "core_node-word-audio/1.0 (local pronunciation cache)"

CAMBRIDGE_ORIGIN = "https://dictionary.cambridge.org"
CAMBRIDGE_DICTIONARY_BASE = CAMBRIDGE_ORIGIN + "/dictionary/english"
# A normal browser User-Agent — this is a plain HTTP GET + HTML parse of a
# publicly served page, nothing more evasive than identifying as a browser.
CAMBRIDGE_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Official paid API only (see module docstring) — never the free web tier.
FORVO_API_BASE = "https://apifree.forvo.com"
# How many top-rated Forvo candidates to request per lookup (server-side
# order=rate-desc already ranks by vote/quality; a small window guards against
# the top hit missing a usable mp3 path).
FORVO_RESULT_LIMIT = 5


# --------------------------------------------------------------------------- #
# language gating                                                              #
# --------------------------------------------------------------------------- #
def _is_english(lang: str) -> bool:
    """True when ``lang`` normalizes to the canonical "en" code.

    Reuses pyfoundations.text_parsing.normalize_language_codes (the same
    canonical supported-language-set helper the subtitle ingest pipeline uses)
    instead of an ad-hoc English-code check.
    """
    codes = normalize_language_codes([lang])
    return bool(codes) and codes[0] == "en"


def _normalize_accent(accent: Optional[str]) -> Optional[str]:
    """Normalize an accent hint to the wire values "us"|"uk"; anything else -> None."""
    value = (accent or "").strip().lower()
    return value if value in ("us", "uk") else None


# --------------------------------------------------------------------------- #
# audio download                                                              #
# --------------------------------------------------------------------------- #
def _download_audio_bytes(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    fallback_mime: str = "audio/mpeg",
) -> Tuple[bytes, str]:
    """Download an audio URL -> (raw_bytes, mime). ``(b"", "")`` on any failure.

    ``fallback_mime`` replaces a missing / non-audio Content-Type (e.g.
    upload.wikimedia.org serves .ogg files as ``application/ogg``).
    """
    if not url:
        return b"", ""
    try:
        requests = get_third_package_requests()
        resp = requests.get(url, headers=headers or {}, timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200 or not resp.content:
            return b"", ""
        mime = (resp.headers.get("Content-Type") or fallback_mime).split(";")[0].strip()
        if not mime.startswith("audio/"):
            mime = fallback_mime
        return resp.content, mime
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[WordAudio] Audio download failed ({exc})")
        return b"", ""


# --------------------------------------------------------------------------- #
# 1. Free Dictionary API                                                      #
# --------------------------------------------------------------------------- #
def _fd_url_accent(url: str) -> str:
    """Accent encoded in a Free Dictionary audio URL ("us"|"uk"|"" untagged).

    Their pronunciation files end in ``-us.mp3`` / ``-uk.mp3`` (e.g.
    ``.../media/pronunciations/en/hello-us.mp3``); anything else is untagged.
    """
    low = (url or "").lower()
    if low.endswith("-us.mp3"):
        return "us"
    if low.endswith("-uk.mp3"):
        return "uk"
    return ""


def _free_dictionary_api(
    word: str, lang: str, accent: Optional[str] = None, strict: bool = False
) -> Optional[Dict[str, Any]]:
    """Query api.dictionaryapi.dev and download the best usable pronunciation.

    English only. Verified live response shape (2026-07-03):
    ``[ { "word", "phonetics":[ {"text","audio","sourceUrl","license"}, ... ],
    "meanings":[...] }, ... ]`` — some ``phonetics`` entries have an empty
    ``"audio"``. A candidate whose URL matches the preferred ``accent``
    (``-us.mp3``/``-uk.mp3`` suffix) wins; otherwise the first non-empty one is
    used, unless ``strict`` (preferred-accent-only pass) which returns None.
    """
    if not _is_english(lang):
        return None
    try:
        requests = get_third_package_requests()
        url = f"{FREE_DICTIONARY_API_BASE}/{quote(word, safe='')}"
        resp = requests.get(url, timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200:
            return None
        entries = resp.json() or []
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[WordAudio] Free Dictionary API lookup failed ({exc})")
        return None

    candidates: List[Tuple[str, str]] = []  # (audio_url, phonetic_text)
    for entry in entries if isinstance(entries, list) else []:
        for phon in (entry.get("phonetics") or []) if isinstance(entry, dict) else []:
            candidate = (phon.get("audio") or "").strip()
            if candidate:
                if candidate.startswith("//"):
                    candidate = "https:" + candidate
                candidates.append((candidate, phon.get("text") or ""))
    picked = next(
        ((u, t) for u, t in candidates if accent and _fd_url_accent(u) == accent), None)
    if picked is None:
        if strict:
            return None
        picked = candidates[0] if candidates else None
    if picked is None:
        return None
    audio_url, phonetic_text = picked
    actual_accent = _fd_url_accent(audio_url) or "unknown"

    audio_bytes, mime = _download_audio_bytes(audio_url)
    if not audio_bytes:
        return None
    return {
        "provider": "free_dictionary_api",
        "mime": mime,
        "audio_bytes": audio_bytes,
        "accent": actual_accent,
        "source_id": f"free_dictionary_api:en:{word.lower()}",
        "meta": {
            "word": word,
            "language": "en",
            "audio_url": audio_url,
            "phonetic_text": phonetic_text,
            "region": actual_accent,
        },
    }


# --------------------------------------------------------------------------- #
# 2. Wikimedia Commons                                                        #
# --------------------------------------------------------------------------- #
# commons.wikimedia.org can be slow/flaky; a single read timeout would
# otherwise stall the pronunciation chain once per accent pass per word. Latch
# a process-wide disable on the first timeout (mirrors _forvo_disabled_reason
# / movie_poster_client._omdb_disabled_reason) and short-circuit every later
# Wikimedia lookup. The tighter per-source timeout bounds the one wait paid
# before the latch fires.
_wikimedia_disabled_reason: Optional[str] = None
_wikimedia_lock = threading.Lock()
_WIKIMEDIA_TIMEOUT: Tuple[int, int] = (5, 8)


def _wikimedia_file_url(title: str) -> str:
    """Resolve a Commons file title to its direct upload URL via the official
    API (``action=query&prop=imageinfo``). "" when the file does not exist.

    A missing title yields a page with no ``imageinfo`` (pageid -1 + "missing")
    — treated as a clean miss, no error logged.
    """
    global _wikimedia_disabled_reason
    if _wikimedia_disabled_reason is not None:
        return ""
    requests = get_third_package_requests()
    try:
        resp = requests.get(
            WIKIMEDIA_COMMONS_API,
            params={
                "action": "query",
                "titles": title,
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
            },
            headers={"User-Agent": WIKIMEDIA_USER_AGENT},
            timeout=_WIKIMEDIA_TIMEOUT,
        )
        if resp.status_code != 200:
            return ""
        pages = ((resp.json() or {}).get("query") or {}).get("pages") or {}
    except requests.exceptions.Timeout as exc:
        with _wikimedia_lock:
            if _wikimedia_disabled_reason is None:
                _wikimedia_disabled_reason = f"timeout: {exc}"
        ColorPrint.yellow(
            f"[WordAudio] Wikimedia Commons timed out ({exc}); disabling Wikimedia "
            "for this run - falling back to Cambridge/Forvo/TTS")
        return ""
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[WordAudio] Wikimedia Commons lookup failed ({exc})")
        return ""
    for page in pages.values() if isinstance(pages, dict) else []:
        infos = (page.get("imageinfo") or []) if isinstance(page, dict) else []
        if infos and isinstance(infos[0], dict) and (infos[0].get("url") or "").strip():
            return infos[0]["url"]
    return ""


def _wikimedia_commons(
    word: str, lang: str, accent: Optional[str] = None, strict: bool = False
) -> Optional[Dict[str, Any]]:
    """Community native-speaker recordings on Wikimedia Commons.

    English only. Commons hosts pronunciation files under the stable naming
    scheme ``File:En-us-<word>.ogg`` / ``File:En-uk-<word>.ogg`` — the accent
    is exact by construction. The preferred accent is tried first; ``strict``
    (preferred-accent-only pass) limits the lookup to it.
    """
    if _wikimedia_disabled_reason is not None:
        return None
    if not _is_english(lang):
        return None
    slug = (word or "").strip().lower().replace(" ", "_")
    if not slug:
        return None
    if accent:
        order = [accent] if strict else [accent, ("uk" if accent == "us" else "us")]
    else:
        order = ["us", "uk"]
    for acc in order:
        title = f"File:En-{acc}-{slug}.ogg"
        file_url = _wikimedia_file_url(title)
        if not file_url:
            continue
        audio_bytes, mime = _download_audio_bytes(
            file_url,
            headers={"User-Agent": WIKIMEDIA_USER_AGENT},
            fallback_mime="audio/ogg",
        )
        if not audio_bytes:
            continue
        return {
            "provider": "wikimedia_commons",
            "mime": mime,
            "audio_bytes": audio_bytes,
            "accent": acc,
            "source_id": f"wikimedia_commons:en-{acc}:{slug}",
            "meta": {
                "word": word,
                "language": "en",
                "audio_url": file_url,
                "file_title": title,
                "region": acc,
            },
        }
    return None


# --------------------------------------------------------------------------- #
# 3. Cambridge Dictionary                                                     #
# --------------------------------------------------------------------------- #
def _cambridge_dictionary(
    word: str, lang: str, accent: Optional[str] = None, strict: bool = False
) -> Optional[Dict[str, Any]]:
    """Fetch the public Cambridge Dictionary page and extract the official
    pronunciation ``<audio><source>`` mp3 URL, then download it.

    English only. Verified live HTML shape (2026-07-03): each pronunciation
    lives in ``<span class="uk dpron-i">`` / ``<span class="us dpron-i">``,
    containing a hidden ``<audio>`` with
    ``<source type="audio/mpeg" src="/media/english/...mp3"/>`` (relative URL,
    resolved against CAMBRIDGE_ORIGIN). The REQUESTED region span is preferred
    (legacy order without an accent stays UK-first), then the other region,
    then whichever pronunciation block appears first on the page — unless
    ``strict`` (preferred-accent-only pass) which stops at the requested
    region. A missing word redirects (302) or renders a page with no
    ``dpron-i`` element — either way this returns None.
    """
    if not _is_english(lang):
        return None
    try:
        requests = get_third_package_requests()
        slug = quote(word.strip().lower().replace(" ", "-"), safe="-")
        page_url = f"{CAMBRIDGE_DICTIONARY_BASE}/{slug}"
        resp = requests.get(
            page_url, headers={"User-Agent": CAMBRIDGE_USER_AGENT}, timeout=_HTTP_TIMEOUT)
        if resp.status_code != 200 or not resp.text:
            return None
        html = resp.text
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[WordAudio] Cambridge Dictionary page fetch failed ({exc})")
        return None

    try:
        BeautifulSoup = get_third_package_BeautifulSoup()
        soup = BeautifulSoup(html, "html.parser")
        # Requested region first; the generic dpron-i fallback only applies in
        # the any-accent pass (strict keeps the preferred-accent guarantee).
        if accent == "us":
            selectors = ["span.us.dpron-i", "span.uk.dpron-i"]
        else:
            selectors = ["span.uk.dpron-i", "span.us.dpron-i"]
        if strict and accent:
            selectors = selectors[:1]
        else:
            selectors.append("span.dpron-i")
        pron_span = None
        for selector in selectors:
            pron_span = soup.select_one(selector)
            if pron_span:
                break
        if not pron_span:
            return None
        source_tag = (
            pron_span.select_one("audio source[type='audio/mpeg']")
            or pron_span.select_one("audio source")
        )
        src = (source_tag.get("src") if source_tag else "") or ""
        if not src:
            return None
        mp3_url = urljoin(CAMBRIDGE_ORIGIN, src)
        classes = pron_span.get("class") or []
        region = "uk" if "uk" in classes else ("us" if "us" in classes else "unknown")
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[WordAudio] Cambridge Dictionary HTML parse failed ({exc})")
        return None

    audio_bytes, mime = _download_audio_bytes(
        mp3_url, headers={"User-Agent": CAMBRIDGE_USER_AGENT})
    if not audio_bytes:
        return None
    return {
        "provider": "cambridge_dictionary",
        "mime": mime,
        "audio_bytes": audio_bytes,
        "accent": region,
        "source_id": f"cambridge_dictionary:en:{word.lower()}",
        "meta": {
            "word": word,
            "language": "en",
            "audio_url": mp3_url,
            "page_url": page_url,
            "region": region,
        },
    }


# --------------------------------------------------------------------------- #
# 4. Forvo (official paid API only)                                           #
# --------------------------------------------------------------------------- #
# Forvo answers HTTP 401/403 for an invalid/expired key. That never recovers
# within a run, yet a batch may look up many words — a single auth failure
# would otherwise burn a network round-trip per word for nothing. Latch a
# process-wide disable on the first auth failure (mirrors
# movie_poster_client._omdb_disabled_reason) and short-circuit every later
# Forvo lookup.
_forvo_disabled_reason: Optional[str] = None
_forvo_lock = threading.Lock()


def _forvo_vote_score(item: Dict[str, Any]) -> int:
    """Best-effort numeric vote/quality signal for a Forvo pronunciation item."""
    try:
        return int(item.get("rate") or item.get("num_votes") or 0)
    except (TypeError, ValueError):
        return 0


def _forvo(
    word: str, lang: str, accent: Optional[str] = None, strict: bool = False
) -> Optional[Dict[str, Any]]:
    """Query Forvo's official paid API (word-pronunciations) and download the
    highest-rated pronunciation.

    Gated behind FORVO_API_KEY (get_secret_key_indexed) — returns None
    immediately with NO network call when the key is absent/empty. Endpoint +
    response shape confirmed against the official docs
    (https://api.forvo.com/documentation/word-pronunciations/) and the
    reference client at https://github.com/mucsi96/forvo (2026-07-03):
    ``GET {base}/key/{key}/format/json/action/word-pronunciations/word/{word}``
    -> ``{"attributes":{"total":N}, "items":[{"id","word","original",
    "pathmp3", "rate", "num_votes", "username", "country", ...}]}``.
    ``order=rate-desc`` asks Forvo to rank by vote/quality server-side; the
    highest-scoring candidate with a usable ``pathmp3`` is picked client-side
    as a defensive re-check.

    Forvo items carry a speaker country, not a guaranteed us/uk accent, so
    ``strict`` (preferred-accent-only pass) skips Forvo entirely and the
    result accent is always "unknown".
    """
    global _forvo_disabled_reason
    if strict:
        return None
    if _forvo_disabled_reason is not None:
        return None

    api_key = get_secret_key_indexed("FORVO_API_KEY")
    if not api_key:
        # No key configured: Forvo is silently skipped, no network call made.
        return None

    language = (lang or "").strip().lower()
    try:
        requests = get_third_package_requests()
        url = (
            f"{FORVO_API_BASE}/key/{api_key}/format/json/action/word-pronunciations"
            f"/word/{quote(word.strip(), safe='')}"
        )
        if language:
            url += f"/language/{quote(language, safe='')}"
        url += f"/order/rate-desc/limit/{FORVO_RESULT_LIMIT}"
        resp = requests.get(url, timeout=_HTTP_TIMEOUT)
        if resp.status_code in (401, 403):
            with _forvo_lock:
                if _forvo_disabled_reason is None:
                    _forvo_disabled_reason = f"HTTP {resp.status_code}"
            ColorPrint.yellow(
                f"[WordAudio] Forvo HTTP {resp.status_code}; disabling Forvo for this "
                "run — verify FORVO_API_KEY is valid and has remaining quota")
            return None
        if resp.status_code != 200:
            ColorPrint.yellow(f"[WordAudio] Forvo HTTP {resp.status_code}")
            return None
        data = resp.json() or {}
    except Exception as exc:  # noqa: BLE001 - best-effort
        ColorPrint.yellow(f"[WordAudio] Forvo lookup failed ({exc})")
        return None

    items: List[Dict[str, Any]] = (data.get("items") or []) if isinstance(data, dict) else []
    candidates = [it for it in items if isinstance(it, dict) and (it.get("pathmp3") or "").strip()]
    if not candidates:
        return None
    best = max(candidates, key=_forvo_vote_score)

    mp3_url = best.get("pathmp3") or ""
    audio_bytes, mime = _download_audio_bytes(mp3_url)
    if not audio_bytes:
        return None
    return {
        "provider": "forvo",
        "mime": mime,
        "audio_bytes": audio_bytes,
        "accent": "unknown",
        "source_id": f"forvo:{best.get('id') or word.lower()}",
        "meta": {
            "word": word,
            "language": language,
            "audio_url": mp3_url,
            "username": best.get("username") or "",
            "country": best.get("country") or "",
            "rate": best.get("rate"),
            "num_votes": best.get("num_votes"),
        },
    }


# --------------------------------------------------------------------------- #
# find_pronunciation                                                          #
# --------------------------------------------------------------------------- #
# Source chain in priority order; every source shares the same never-raise
# signature (word, lang, accent, strict).
_SOURCE_CHAIN = (
    _free_dictionary_api,
    _wikimedia_commons,
    _cambridge_dictionary,
    _forvo,
)


def find_pronunciation(
    word: str, lang: str, accent: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Find a REAL (non-synthetic) pronunciation for ``word`` in ``lang``.

    Tries, in order: Free Dictionary API -> Wikimedia Commons -> Cambridge
    Dictionary -> Forvo. ``accent`` ("us"|"uk"|None) selects the preferred
    accent; when set the chain runs TWO passes — pass 1 accepts ONLY the
    preferred accent across every source, pass 2 accepts any accent — so a
    matching-accent recording from a lower-priority source beats a
    wrong-accent one from a higher-priority source. Stops at the first
    success. Returns ``{provider, mime, audio_bytes, accent, source_id, meta}``
    — top-level ``accent`` (and ``meta.region``) is the accent ACTUALLY
    obtained ("us"|"uk"|"unknown") — or None when no source produced usable
    audio (caller should fall back to TTS synthesis).

    NEVER raises — any failure logs via ColorPrint and returns None.
    """
    try:
        clean_word = (word or "").strip()
        if not clean_word:
            return None
        language = (lang or "en").strip().lower() or "en"
        preferred = _normalize_accent(accent)

        for strict in ((True, False) if preferred else (False,)):
            for source in _SOURCE_CHAIN:
                result = source(clean_word, language, preferred, strict)
                if result:
                    ColorPrint.green(
                        f"[WordAudio] {result['provider']} pronunciation for "
                        f"'{clean_word}' (accent={result.get('accent') or 'unknown'}) "
                        f"-> {result['source_id']}")
                    return result

        ColorPrint.blue(
            f"[WordAudio] No real pronunciation source found for '{clean_word}' "
            f"({language}); falling back to TTS")
        return None
    except Exception as exc:  # noqa: BLE001 - never break the caller
        ColorPrint.yellow(f"[WordAudio] find_pronunciation error ({exc})")
        return None
