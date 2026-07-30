# -*- coding: utf-8 -*-
"""
HTTP layer for ``laravel_media_sync``.

Every Laravel-facing network call + the local-output discovery helpers shared by
``sync_source`` / ``backend_status`` / ``sync_all`` live here:
  * ``_post_ingest`` / ``_post_clip``        - the two ingest endpoints (JSON + multipart).
  * ``_resolve_output_dir``                   - reuses VideoExtractProcessor._resolve_io.
  * ``_discover_mappings`` / ``_list_clip_names`` / ``_mapping_src_abs`` - shared local
    discovery so sync_source and backend_status always see the SAME sources + source_keys.
  * ``_fetch_backend_subtitles``              - paginated probe of Laravel's subtitle list.

Networking goes through the unified ``LaravelClient``
(``pycore.pyutils.laravel.client.laravel_client``) which
times + logs + records every request - same gateway the translation worker uses.
"""

import os
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyutils.laravel.client import laravel_client

# Reuse the processor's output-dir resolution (no duplication). video_extract_processor
# imports nothing from this package, so this stays cycle-free.
from pycore.pyutils.media_processing.video_extract_processor import (
    VideoExtractProcessor,
)

# Shared constants + pure helpers (cycle-free bottom seam).
from pycore.pyctl.laravel.sync._media_sync_helpers import (
    INGEST_PATH,
    INGEST_CLIP_PATH,
    SUBTITLES_PATH,
    _INGEST_TIMEOUT,
    _CLIP_TIMEOUT,
    _STATUS_TIMEOUT,
    _STATUS_PER_PAGE,
    _STATUS_MAX_PAGES,
    _as_int,
)


# --------------------------------------------------------------------------- #
# HTTP submit helpers                                                          #
# --------------------------------------------------------------------------- #
def _post_ingest(base_url: str, payload: Dict[str, Any]) -> Tuple[bool, str]:
    """POST the JSON ingest body. Returns (ok, detail)."""
    try:
        resp = laravel_client.post(INGEST_PATH, base_url=base_url, json=payload, timeout=_INGEST_TIMEOUT)
        if resp.status_code in (200, 201):
            return True, f"HTTP {resp.status_code}"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e).splitlines()[0][:200]


def _post_clip(base_url: str, source_key: str, name: str, file_path: str) -> Tuple[bool, str]:
    """Upload one clip (multipart). Returns (ok, detail)."""
    try:
        with open(file_path, "rb") as fh:
            resp = laravel_client.post(
                INGEST_CLIP_PATH,
                base_url=base_url,
                data={"source_key": source_key, "name": name},
                files={"file": (name, fh)},
                timeout=_CLIP_TIMEOUT,
            )
        if resp.status_code in (200, 201):
            return True, f"HTTP {resp.status_code}"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e).splitlines()[0][:200]


def _resolve_output_dir(source_path: str) -> Optional[str]:
    """Resolve the OUTPUT dir for ``source_path`` by reusing the processor.

    For a FILE, output defaults to its parent dir; for a FOLDER it's
    ``<root>/_compressed_result``. We let VideoExtractProcessor._resolve_io do the
    exact same resolution the run used (so seg dirs line up).
    """
    proc = VideoExtractProcessor()
    cfg = {"path": source_path}
    try:
        _root, output_dir, _videos, _mode = proc._resolve_io(cfg)
        return output_dir
    except ValueError:
        # If resolution fails but the path is a dir, fall back to it directly.
        if source_path and os.path.isdir(source_path):
            return os.path.abspath(source_path)
        return None


def _discover_mappings(output_dir: str) -> List[str]:
    """Every ``mapping.json`` under ``output_dir`` (sorted absolute paths).

    Normally each lives in a ``<stem>_segments`` dir, but a mapping.json found
    elsewhere is tolerated too (defensive). Shared by sync_source and
    backend_status so both always see the SAME set of local sources.
    """
    mapping_files: List[str] = []
    for dirpath, _dirnames, filenames in os.walk(output_dir):
        if "mapping.json" in filenames:
            mapping_files.append(os.path.join(dirpath, "mapping.json"))
    mapping_files.sort()
    return mapping_files


def _list_clip_names(seg_dir: str) -> List[str]:
    """Names of the ``seg_*`` clip files (.mp4/.mp3) in a segments dir (sorted)."""
    names: List[str] = []
    try:
        entries = sorted(os.listdir(seg_dir))
    except OSError:
        return names
    for entry in entries:
        full = os.path.join(seg_dir, entry)
        if not os.path.isfile(full):
            continue
        low = entry.lower()
        if low == "mapping.json":
            continue
        if low.endswith((".mp4", ".mp3")) and entry.startswith("seg_"):
            names.append(entry)
    return names


def _mapping_src_abs(mapping: Dict[str, Any], output_dir: str, seg_dir: str) -> str:
    """Reconstruct the ABSOLUTE source path for a mapping (stable source_key input).

    mapping.video is relative to the scan ROOT; the processor's output dir is
    either the root itself (file mode) or ``<root>/_compressed_result`` (folder
    mode). Shared by sync_source and backend_status so both derive the EXACT
    same source_key (via source_key_for) for a given mapping.json.
    """
    stem = mapping.get("stem") or os.path.basename(seg_dir).replace("_segments", "")
    rel_video = mapping.get("video") or (stem + ".mp4")
    scan_root = (os.path.dirname(output_dir)
                 if os.path.basename(output_dir) == "_compressed_result"
                 else output_dir)
    return os.path.normpath(os.path.join(scan_root, rel_video))


def _fetch_backend_subtitles(base_url: str) -> Tuple[bool, Dict[str, Dict[str, Any]], Optional[int]]:
    """Fetch Laravel's subtitle-source list keyed by source_key.

    Paginates GET {base}/api/app_qy_v1/media/subtitles (per_page=200) until
    last_page, capped at a few pages, with a SHORT timeout. Returns
    ``(reachable, rows_by_source_key, total)``; any failure degrades to
    ``(False, {}, None)`` - never raises.
    """
    rows: Dict[str, Dict[str, Any]] = {}
    total: Optional[int] = None
    try:
        page = 1
        while page <= _STATUS_MAX_PAGES:
            resp = laravel_client.get(
                SUBTITLES_PATH,
                base_url=base_url,
                params={"per_page": _STATUS_PER_PAGE, "page": page},
                timeout=_STATUS_TIMEOUT,
            )
            if resp.status_code != 200:
                return False, {}, None
            body = resp.json() or {}
            if not body.get("success", True):
                return False, {}, None
            data = body.get("data") or {}
            for item in data.get("items") or []:
                key = item.get("source_key")
                if key:
                    rows[key] = item
            if data.get("total") is not None:
                total = _as_int(data.get("total"))
            if page >= _as_int(data.get("last_page") or 1):
                break
            page += 1
        return True, rows, (total if total is not None else len(rows))
    except Exception:
        return False, {}, None
