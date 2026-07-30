# -*- coding: utf-8 -*-
"""
Generic HF local-weights resolver for engines whose model weights are
pre-downloaded idempotently by an install Step script (sentinel + curl resume +
HF-size verify; see scripts/shells/win/win_common/TtsInstallAssetsCommon.ps1
Install-HfRepoFlat and scripts/shells/linux/common/tts_install_assets_common.sh
install_hf_repo_flat).

Single source of truth for the staging-dir + sentinel + verify pattern shared by
all neural engines. The pycore.pyutils.tts.qwen.weights adapter binds this
parameterized implementation to Qwen-specific defaults and hints.
core and adds its engine-specific static sizes / hints.

Layout (created by Install-HfRepoFlat):
  <staging>/                <- staging_dir(env_var, subdir); env override > get_local_data_dir()/subdir
    .model_installed        <- sentinel; content = repo id that was downloaded
    weights/                <- flat-with-subdirs HF snapshot (config.json + .bin/.pt/.safetensors)
      config.json
      <weight files, possibly under subfolders e.g. suno/bark text_24khz/>

Engine contract: call resolve_model_id(env_var, subdir, default_repo) where
default_repo is the GPU/CPU tier (e.g. runtime_engine_model("bark")). Returns the
local weights/ dir when the sentinel + size verify pass, else default_repo (graceful
fallback to lazy HF-cache download). The caller still honors an explicit
<ENV>_MODEL override BEFORE calling this.
"""

import importlib.util
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.system_paths import get_local_data_dir

WEIGHT_SUFFIXES = (".safetensors", ".bin", ".pt")
_HF_CATALOG_CACHE: Dict[str, Dict[str, int]] = {}


def staging_dir(env_var: str, subdir: str) -> Path:
    """Staging root: <env_var> override > get_local_data_dir()/subdir."""
    explicit = (os.environ.get(env_var) or "").strip()
    if explicit:
        return Path(explicit)
    return get_local_data_dir() / subdir


def weights_dir(staging: Path) -> Path:
    return staging / "weights"


def sentinel_model_id(staging: Optional[Path] = None) -> Optional[str]:
    """Read .model_installed sentinel; returns the repo id that was staged, or None."""
    root = staging if staging is not None else Path()
    sentinel = root / ".model_installed"
    if not sentinel.is_file():
        return None
    value = sentinel.read_text(encoding="utf-8-sig").strip()
    return value or None


def _hf_mirror_bases() -> list:
    bases: list = []
    endpoint = (os.environ.get("HF_ENDPOINT") or os.environ.get("GPTSOVITS_MIRROR") or "").strip()
    if endpoint:
        bases.append(endpoint.rstrip("/"))
    bases.append("https://huggingface.co")
    if "hf-mirror.com" not in "".join(bases):
        bases.append("https://hf-mirror.com")
    return bases


def _entry_size(entry: dict) -> int:
    size = entry.get("size")
    if size is not None and int(size) > 0:
        return int(size)
    lfs = entry.get("lfs") or {}
    lfs_size = lfs.get("size")
    if lfs_size is not None and int(lfs_size) > 0:
        return int(lfs_size)
    return 0


def _fetch_hf_tree(base: str, repo_id: str, subpath: str = "") -> list:
    path_part = f"/{subpath}" if subpath else ""
    url = f"{base.rstrip('/')}/api/models/{repo_id}/tree/main{path_part}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.load(resp)


def hf_repo_catalog(repo_id: str, use_cache: bool = True, static_sizes: Optional[Dict[str, int]] = None) -> Dict[str, int]:
    """Repo file -> bytes map (recursive HF tree). Falls back to static_sizes when the
    HF API is unreachable (offline). Generic over any repo id."""
    repo = (repo_id or "").strip()
    if not repo:
        return {}
    if use_cache and repo in _HF_CATALOG_CACHE:
        return dict(_HF_CATALOG_CACHE[repo])

    catalog: Dict[str, int] = {}
    for base in _hf_mirror_bases():
        pending = [""]
        try:
            while pending:
                sub = pending.pop()
                entries = _fetch_hf_tree(base, repo, sub)
                for entry in entries:
                    name = str(entry.get("path") or "").strip()
                    if not name:
                        continue
                    full = name if not sub else f"{sub}/{name}"
                    if str(entry.get("type") or "") == "directory":
                        pending.append(full)
                        continue
                    size = _entry_size(entry)
                    if size > 0:
                        catalog[full] = size
            if catalog:
                _HF_CATALOG_CACHE[repo] = dict(catalog)
                return catalog
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
            catalog = {}
            pending = [""]
            continue

    fallback = static_sizes or {}
    if fallback:
        _HF_CATALOG_CACHE[repo] = dict(fallback)
        return dict(fallback)
    return {}


def catalog_bytes(repo_id: str, rel_path: str, static_sizes: Optional[Dict[str, int]] = None) -> int:
    repo = (repo_id or "").strip()
    rel = rel_path.replace("\\", "/")
    if not repo:
        return 0
    live = hf_repo_catalog(repo).get(rel, 0)
    if live > 0:
        return int(live)
    if static_sizes:
        return int(static_sizes.get(rel, 0))
    return 0


def safetensors_readable(path: Path) -> bool:
    if not path.is_file():
        return False
    if importlib.util.find_spec("safetensors") is None:
        return True
    from safetensors import safe_open

    try:
        with safe_open(str(path), framework="pt") as handle:
            _ = handle.keys()
        return True
    except Exception:
        return False


def local_weights_ready(weights: Path, repo_id: str = "", static_sizes: Optional[Dict[str, int]] = None) -> bool:
    """True when weights/ has config.json + weight files (.bin/.pt/.safetensors) whose
    sizes meet the HF catalog (or static fallback) and safetensors deserialize cleanly.
    Recursive over subfolders (e.g. suno/bark text_24khz/)."""
    if not weights.is_dir():
        return False
    if not any(weights.rglob("config.json")):
        return False

    weight_files = [
        p
        for p in weights.rglob("*")
        if p.is_file() and p.suffix.lower() in WEIGHT_SUFFIXES
    ]
    if not weight_files:
        return False

    for path in weight_files:
        rel = path.relative_to(weights).as_posix()
        size = path.stat().st_size
        expected = catalog_bytes(repo_id, rel, static_sizes)
        if expected > 0:
            if size < expected:
                return False
        elif size <= 0:
            return False
        if path.suffix.lower() == ".safetensors" and not safetensors_readable(path):
            return False
    return True


def local_weights_dir(staging: Path, repo_id: str = "", static_sizes: Optional[Dict[str, int]] = None) -> Optional[Path]:
    """weights/ dir when ready, else None."""
    weights = weights_dir(staging)
    if local_weights_ready(weights, repo_id, static_sizes):
        return weights
    return None


def resolve_model_id(env_var: str, subdir: str, default_repo: str, static_sizes: Optional[Dict[str, int]] = None) -> str:
    """Local weights/ path when the sentinel + verify pass, else the staged repo id
    (sentinel value) or default_repo. The caller honors an explicit <ENV>_MODEL
    override before calling this."""
    staging = staging_dir(env_var, subdir)
    repo = sentinel_model_id(staging) or default_repo
    weights = weights_dir(staging)
    if local_weights_ready(weights, repo, static_sizes):
        return str(weights)
    return repo


__all__ = [
    "WEIGHT_SUFFIXES",
    "catalog_bytes",
    "staging_dir",
    "weights_dir",
    "sentinel_model_id",
    "hf_repo_catalog",
    "local_weights_ready",
    "local_weights_dir",
    "resolve_model_id",
    "safetensors_readable",
]
