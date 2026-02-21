# -*- coding: utf-8 -*-
"""
Hugging Face Hub base helper. Native Python API only (no CLI/wget).
Uses huggingface_hub.hf_hub_download and snapshot_download.
Ref: https://huggingface.co/docs/huggingface_hub/guides/download
"""
from __future__ import annotations

import os
import shutil
import zipfile
import tempfile
from pathlib import Path
from typing import Optional, List, Union

from pycore.pyfoundations.color_print import ColorPrint


def ensure_huggingface_hub():
    """Return huggingface_hub module or None. Uses third_party for install."""
    from pycore.pyfoundations.third_party import get_third_package_huggingface_hub
    return get_third_package_huggingface_hub()


def hf_download_file(
    repo_id: str,
    filename: str,
    local_dir: Optional[Union[str, Path]] = None,
    revision: Optional[str] = None,
    force_download: bool = False,
) -> Optional[str]:
    """
    Download a single file from Hub. Native API, no CLI.
    Returns local path or None on failure.
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        ColorPrint.yellow("[HF] huggingface_hub not available; pip install huggingface_hub")
        return None
    try:
        path = hub.hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=local_dir,
            revision=revision or "main",
            force_download=force_download,
        )
        return path
    except Exception as e:
        ColorPrint.red(f"[HF] hf_hub_download failed: {e}")
        return None


def hf_snapshot_to_dir(
    repo_id: str,
    local_dir: Union[str, Path],
    allow_patterns: Optional[Union[str, List[str]]] = None,
    ignore_patterns: Optional[Union[str, List[str]]] = None,
    revision: Optional[str] = None,
    force_download: bool = False,
) -> Optional[str]:
    """
    Download a snapshot of the repo (or filtered by patterns) to local_dir.
    Returns local_dir path or None on failure.
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return None
    try:
        path = hub.snapshot_download(
            repo_id=repo_id,
            local_dir=str(local_dir),
            allow_patterns=allow_patterns,
            ignore_patterns=ignore_patterns,
            revision=revision or "main",
            force_download=force_download,
        )
        return path
    except Exception as e:
        ColorPrint.red(f"[HF] snapshot_download failed: {e}")
        return None


def hf_download_zip_and_extract(
    repo_id: str,
    filename: str,
    extract_to: Union[str, Path],
    revision: Optional[str] = None,
) -> bool:
    """
    Download a zip from Hub and extract to extract_to. Returns True on success.
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return False
    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = hub.hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                local_dir=tmp,
                revision=revision or "main",
            )
            if not path or not os.path.isfile(path):
                return False
            extract_to = Path(extract_to)
            extract_to.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(path, "r") as z:
                z.extractall(extract_to)
        return True
    except Exception as e:
        ColorPrint.red(f"[HF] download+extract failed: {e}")
        return False


def hf_list_repo_files(repo_id: str, path_in_repo: str = "", revision: Optional[str] = None) -> List[str]:
    """List files in a repo path. Returns list of relative file paths. Compatible with old HfApi (no path_in_repo)."""
    hub = ensure_huggingface_hub()
    if hub is None:
        return []
    rev = revision or "main"
    path_prefix = (path_in_repo or "").strip().rstrip("/")
    try:
        from huggingface_hub import HfApi
        api = HfApi()
        try:
            items = api.list_repo_files(repo_id=repo_id, path_in_repo=path_in_repo or None, revision=rev)
        except TypeError:
            # Old huggingface_hub: list_repo_files() has no path_in_repo -> list all and filter
            items = api.list_repo_files(repo_id=repo_id, revision=rev)
            if path_prefix and items:
                prefix = path_prefix + "/"
                items = [f for f in items if f == path_prefix or f.startswith(prefix)]
        return list(items) if items else []
    except Exception as e:
        ColorPrint.gray(f"[HF] list_repo_files: {e}")
        return []


def hf_get_collection_models(collection_slug: str) -> List[str]:
    """
    Get model repo_ids from a Hub collection (e.g. breezedeus/cnocr).
    Uses HfApi.get_collection; only items with item_type=='model' are returned.
    Ref: https://huggingface.co/docs/huggingface_hub/en/package_reference/collections
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return []
    try:
        api = hub.HfApi()
        coll = api.get_collection(collection_slug=collection_slug)
        return [it.item_id for it in (coll.items or []) if getattr(it, "item_type", None) == "model"]
    except Exception as e:
        ColorPrint.gray(f"[HF] get_collection {collection_slug}: {e}")
        return []


def hf_download_repo_latest(
    repo_id: str,
    local_dir: Union[str, Path],
    allow_patterns: Optional[Union[str, List[str]]] = None,
    revision: Optional[str] = None,
) -> Optional[str]:
    """
    Download latest revision of a repo (default main) to local_dir.
    Returns local_dir path or None. Use revision='main' or None for latest.
    """
    return hf_snapshot_to_dir(
        repo_id=repo_id,
        local_dir=local_dir,
        allow_patterns=allow_patterns,
        revision=revision or "main",
    )
