# -*- coding: utf-8 -*-
import huggingface_hub
import onnxruntime
import cnocr
import shutil
from huggingface_hub import HfApi
"""
Hugging Face Hub helpers + cnocr loader.

Provides get_third_package_huggingface_hub / get_third_package_cnocr plus the
native-API HF download helpers (hf_download_file, snapshot, list, collection).
The OCR model provisioning in _ocr_models reuses these helpers.
"""

import os
import sys
import importlib
import zipfile
from pathlib import Path
from typing import Optional, Union, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector, get_cnocr_pip_package

from ._package_cache import _PACKAGE_CACHE
from ._deps import DEPENDENCY_MAP
from ._pip_runner import build_pip_install_command, run_pip_install_with_realtime_output


def get_third_package_huggingface_hub():
    """
    Get huggingface_hub package (lazy load). For CnOCR/CnSTD model auto-download from Hugging Face.
    Package includes CLI as entry point 'hf'; use get_huggingface_cli_command() or ensure_huggingface_cli_prerequisite().
    Returns None if still unavailable after install attempt.
    """
    if 'huggingface_hub' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['huggingface_hub'] = huggingface_hub
        except (ImportError, ModuleNotFoundError):
            pip_package = DEPENDENCY_MAP.get('huggingface_hub', 'huggingface_hub')
            ColorPrint.yellow(f"[INSTALL] Package 'huggingface_hub' not found. Installing '{pip_package}' (required for CnOCR/CnSTD model download)...")
            pip_cmd = build_pip_install_command(pip_package)
            run_pip_install_with_realtime_output(pip_cmd, pip_package)
            importlib.invalidate_caches()
            try:
                _PACKAGE_CACHE['huggingface_hub'] = huggingface_hub
            except (ImportError, ModuleNotFoundError):
                _PACKAGE_CACHE['huggingface_hub'] = None
    return _PACKAGE_CACHE.get('huggingface_hub')


def _print_cnocr_init_info(cnocr_module):
    """Print GPU support and loaded versions at cnocr init (official: PyPI cnocr, ort-cpu/ort-gpu)."""
    gpu_available = CUDADetector.is_cuda_available()
    cnocr_ver = getattr(cnocr_module, '__version__', 'unknown')
    onnx_ver = 'N/A'
    try:
        onnx_ver = getattr(onnxruntime, '__version__', 'unknown')
    except Exception:
        pass
    ColorPrint.blue(
        f"[CnOCR] GPU: {'yes' if gpu_available else 'no'} | cnocr: {cnocr_ver} | onnxruntime: {onnx_ver}"
    )


def get_third_package_cnocr():
    """
    Get cnocr package (lazy load). Official: https://cnocr.readthedocs.io/zh-cn/stable/install/
    GPU: pip install cnocr[ort-gpu], CPU: pip install cnocr[ort-cpu].
    When installing: uses get_cnocr_pip_package() and preserves installed distributions.
    Returns None if still unavailable after install attempt. On first load prints GPU support and versions.
    """
    if 'cnocr' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['cnocr'] = cnocr
            _print_cnocr_init_info(cnocr)
        except (ImportError, ModuleNotFoundError):
            pip_package = get_cnocr_pip_package()
            if pip_package:
                ColorPrint.yellow(f"[INSTALL] Package 'cnocr' not found. Installing '{pip_package}'...")
                pip_cmd = build_pip_install_command(pip_package)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    _PACKAGE_CACHE['cnocr'] = cnocr
                    _print_cnocr_init_info(cnocr)
                except (ImportError, ModuleNotFoundError):
                    _PACKAGE_CACHE['cnocr'] = None
            else:
                _PACKAGE_CACHE['cnocr'] = None
    return _PACKAGE_CACHE['cnocr']


def get_huggingface_cli_command():
    """
    Return command list to run Hugging Face CLI (for subprocess). Works without PATH.
    Official: pip install huggingface_hub; entry point is 'hf' (since 1.x). Use this instead of 'huggingface-cli'.
    """
    return [sys.executable, "-m", "huggingface_hub.cli.hf"]


def ensure_huggingface_cli_prerequisite() -> bool:
    """
    Prerequisite for CnOCR/CnSTD model download. Ensures huggingface_hub is installed and CLI is usable.
    - Installs huggingface_hub if missing.
    - Prepends Python Scripts to PATH so 'hf' is findable (Windows).
    - CLI is invoked as 'hf' or via python -m huggingface_hub.cli.hf (see get_huggingface_cli_command()).
    Official: https://hf.co/docs/huggingface_hub/installation  Windows standalone: powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"
    Returns True if hub is importable (CLI can always be run via get_huggingface_cli_command()).
    """
    hub = get_third_package_huggingface_hub()
    if hub is None:
        return False
    try:
        exe_dir = os.path.dirname(os.path.abspath(sys.executable))
        scripts = os.path.join(exe_dir, "Scripts")
        if os.path.isdir(scripts):
            path_env = os.environ.get("PATH", "")
            if scripts not in path_env:
                os.environ["PATH"] = scripts + os.pathsep + path_env
                ColorPrint.gray(f"[HF] PATH prepended with {scripts} for 'hf' CLI")
        if shutil.which("hf"):
            ColorPrint.gray("[HF] CLI available as: hf")
            return True
        ColorPrint.gray("[HF] CLI not on PATH. Use: python -m huggingface_hub.cli.hf  or  get_huggingface_cli_command()")
        return True
    except Exception:
        pass
    return True


def _ensure_huggingface_cli_on_path():
    """
    Prepend Scripts to PATH and ensure hub is loaded. Prefer ensure_huggingface_cli_prerequisite() for explicit setup.
    CLI command name is 'hf' (not huggingface-cli); use get_huggingface_cli_command() for subprocess.
    """
    ensure_huggingface_cli_prerequisite()


# Official: if model file missing, manual download from https://huggingface.co/breezedeus/cnstd-cnocr-models or Baidu pan (pwd: nocr), put in ~/.cnocr/2.3 (Win: %APPDATA%\cnocr\2.3)
CNOCR_MODEL_DOWNLOAD_HINT = (
    "CnOCR model missing. Install: pip install huggingface_hub. CLI: python -m huggingface_hub.cli.hf  or  hf (Scripts on PATH). "
    "Or download from https://huggingface.co/breezedeus/cnstd-cnocr-models (or Baidu pan pwd nocr), put zip in ~/.cnocr/2.3 (Win: %APPDATA%\\cnocr\\2.3)."
)


# ---------------------------------------------------------------------------
# Hugging Face Hub base helpers. Native Python API only (no CLI/wget).
# Uses huggingface_hub.hf_hub_download and snapshot_download.
# Ref: https://huggingface.co/docs/huggingface_hub/guides/download
# ---------------------------------------------------------------------------
def ensure_huggingface_hub():
    """Return huggingface_hub module or None (installs via this module's getter)."""
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
    Download a zip from Hub (uses default cache; no re-download if already cached) and extract to extract_to.
    Returns True on success. Ref: https://huggingface.co/docs/huggingface_hub/guides/download
    """
    hub = ensure_huggingface_hub()
    if hub is None:
        return False
    try:
        path = hub.hf_hub_download(
            repo_id=repo_id,
            filename=filename,
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
