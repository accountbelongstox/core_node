# -*- coding: utf-8 -*-
"""
OCR model init: download CnSTD/CnOCR models from Hugging Face using native Python API (no CLI).
Download list is driven by ocr_prewarm_spec (zh/en/cht latest per language).
- Repo bundle: https://huggingface.co/breezedeus/cnstd-cnocr-models (v2/v3 zip)
- Single-model repos: https://huggingface.co/breezedeus/cnstd-ppocr-ch_PP-OCRv5_det etc.
CnSTD root: ~/.cnstd, expects 1.2/ppocr/<model>/<model>_infer.onnx
CnOCR root: ~/.cnocr, expects 2.3/ppocr/<model>/<model>_rec_infer.onnx
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.huggingface_hub_helper import (
    hf_download_file,
    hf_download_zip_and_extract,
    hf_get_collection_models,
    hf_list_repo_files,
)
from pycore.pyfoundations.ocr_prewarm_spec import (
    all_cnstd_repos,
    all_cnocr_repos,
    all_cnstd_zips,
    all_cnocr_zips,
    PREWARM_SPEC,
)

HF_OCR_REPO = "breezedeus/cnstd-cnocr-models"
CNSTD_SUBDIR = "models/cnstd/1.2"
CNOCR_SUBDIR = "models/cnocr/2.3"
CNSTD_COLLECTION_SLUG = "breezedeus/cnstd"
CNOCR_COLLECTION_SLUG = "breezedeus/cnocr"


def _appdata_root() -> Path:
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", os.path.expanduser("~")))
    return Path.home()


def cnstd_root() -> Path:
    """CnSTD model root. Win: %%APPDATA%%\\cnstd, else ~/.cnstd."""
    if os.name == "nt":
        return _appdata_root() / "cnstd"
    return Path.home() / ".cnstd"


def cnocr_root() -> Path:
    """CnOCR model root. Win: %%APPDATA%%\\cnocr, else ~/.cnocr."""
    if os.name == "nt":
        return _appdata_root() / "cnocr"
    return Path.home() / ".cnocr"


def _model_name_from_ppocr_repo(repo_id: str) -> str:
    """breezedeus/cnstd-ppocr-ch_PP-OCRv5_det -> ch_PP-OCRv5_det; cnocr-ppocr-ch_PP-OCRv5 -> ch_PP-OCRv5."""
    name = repo_id.split("/", 1)[-1]
    for prefix in ("cnstd-ppocr-", "cnocr-ppocr-"):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def _repos_from_collection(collection_slug: str, name_prefix: str) -> List[str]:
    """
    Get model repo_ids from Hub collection (HfApi.get_collection).
    Only returns repos whose name (after owner/) starts with name_prefix (e.g. cnstd-ppocr- or cnocr-ppocr-).
    Ref: https://huggingface.co/docs/huggingface_hub/en/package_reference/collections
    """
    repo_ids = hf_get_collection_models(collection_slug)
    return [r for r in repo_ids if r.split("/", 1)[-1].startswith(name_prefix)]


def _needed_det_model_names(use_gpu: bool) -> set:
    """Model names needed for CnSTD det by GPU/CPU: zh optimal (server vs non-server), en, cht from zip."""
    needed = set()
    zh = PREWARM_SPEC["zh"]
    if use_gpu and zh.get("prewarm_det_server"):
        needed.add(zh["prewarm_det_server"])
    else:
        needed.add(zh["prewarm_det"])
    for lang in ("en",):
        for r in PREWARM_SPEC[lang]["det_repos"]:
            needed.add(_model_name_from_ppocr_repo(r))
    return needed


def _needed_rec_model_names(use_gpu: bool) -> set:
    """Model names needed for CnOCR rec by GPU/CPU: zh optimal, en, cht from zip."""
    needed = set()
    zh = PREWARM_SPEC["zh"]
    if use_gpu and zh.get("prewarm_rec_server"):
        needed.add(zh["prewarm_rec_server"])
    else:
        needed.add(zh["prewarm_rec"])
    for lang in ("en",):
        for r in PREWARM_SPEC[lang]["rec_repos"]:
            needed.add(_model_name_from_ppocr_repo(r))
    for lang in ("zh", "en"):
        for rec in PREWARM_SPEC[lang].get("prewarm_rec_fallbacks") or ():
            needed.add(rec)
    return needed


def _repos_to_download_cnstd(use_gpu: bool) -> Tuple[str, ...]:
    """Optimal CnSTD repo list from static spec (zh V5 + en + cht). GPU: prefer _server for zh. Never rely on Hub collection alone (it may omit zh V5)."""
    needed = _needed_det_model_names(use_gpu)
    return tuple(sorted(r for r in all_cnstd_repos() if _model_name_from_ppocr_repo(r) in needed))


def _repos_to_download_cnocr(use_gpu: bool) -> Tuple[str, ...]:
    """Optimal CnOCR repo list from static spec (zh V5 + en + cht). GPU: prefer _server for zh. Never rely on Hub collection alone."""
    needed = _needed_rec_model_names(use_gpu)
    return tuple(sorted(r for r in all_cnocr_repos() if _model_name_from_ppocr_repo(r) in needed))


def _download_ppocr_single_model_repos(
    repos: Tuple[str, ...],
    version_subdir: str,
    root: Path,
    revision: Optional[str] = None,
) -> bool:
    """
    Download from single-model repos (e.g. breezedeus/cnstd-ppocr-ch_PP-OCRv5_det).
    Repo root contains .onnx and config.yaml; save to root/<version_subdir>/ppocr/<model_name>/.
    """
    if not repos:
        return True
    ColorPrint.blue("[HF] Single-model repos (V5/V4 etc.):")
    for repo_id in repos:
        print(f"  [HF]   - {repo_id}", flush=True)
    sys.stdout.flush()
    rev = revision or "main"
    ok = True
    for repo_id in repos:
        model_name = _model_name_from_ppocr_repo(repo_id)
        dest_dir = root / version_subdir / "ppocr" / model_name
        if dest_dir.is_dir() and any(dest_dir.glob("*.onnx")):
            continue
        files = hf_list_repo_files(repo_id, path_in_repo="", revision=rev)
        to_download = [f for f in files if f.endswith(".onnx") or f.endswith(".yaml")]
        if not to_download:
            ColorPrint.yellow(f"[HF] No .onnx in {repo_id}")
            continue
        dest_dir.mkdir(parents=True, exist_ok=True)
        got = False
        for filename in to_download:
            path = hf_download_file(repo_id, filename, local_dir=dest_dir, revision=rev)
            if path:
                got = True
            else:
                ok = False
        if got:
            ColorPrint.blue(f"[HF] Downloaded {repo_id} -> {dest_dir}")
    return ok


def _zip_basename_to_ppocr_model(basename: str, kind: str) -> Optional[str]:
    """
    Map zip basename to expected ppocr subdir (model name) for skip-if-present check.
    kind 'cnstd': *_det_infer-onnx.zip -> *_det; kind 'cnocr': *_rec_infer-onnx.zip -> model name before _rec.
    """
    if not basename.endswith(".zip"):
        return None
    name = basename[:-4]
    if kind == "cnstd" and name.endswith("_det_infer-onnx"):
        return name[: -len("_infer-onnx")]  # ch_PP-OCRv3_det_infer-onnx -> ch_PP-OCRv3_det
    if kind == "cnocr" and "_rec_infer-onnx" in name:
        return name.replace("_rec_infer-onnx", "")  # chinese_cht_PP-OCRv3_rec_infer-onnx -> chinese_cht_PP-OCRv3
    return None


def _dir_has_onnx(p: Path) -> bool:
    """True if path is a dir and contains at least one .onnx file (direct or nested)."""
    if not p.is_dir():
        return False
    return any(p.rglob("*.onnx"))


def _zip_already_extracted(
    target_root: Path,
    zip_basename: str,
    zip_to_ppocr_model: Optional[Callable[[str], Optional[str]]],
) -> bool:
    """
    Return True iff the model from this zip is already present at the path the library uses.
    CnSTD/CnOCR load only from target_root/ppocr/<model_name>/ (see docstring at top). We scan that path only.
    """
    root = Path(target_root).resolve()
    if zip_to_ppocr_model is None:
        return False
    model_name = zip_to_ppocr_model(zip_basename)
    if not model_name:
        return False
    expect_dir = root / "ppocr" / model_name
    has_onnx = _dir_has_onnx(expect_dir)
    return has_onnx


def _normalize_extract_to_ppocr(
    target_root: Path,
    zip_basename: str,
    zip_to_ppocr_model: Optional[Callable[[str], Optional[str]]],
) -> None:
    """
    After extracting a bundle zip, ensure the library path exists: target_root/ppocr/<model_name>/ with .onnx.
    If the zip did not create that layout, copy from wherever it extracted (e.g. target_root/<stem>/ or flat).
    """
    if zip_to_ppocr_model is None:
        return
    model_name = zip_to_ppocr_model(zip_basename)
    if not model_name:
        return
    root = Path(target_root).resolve()
    expect_dir = root / "ppocr" / model_name
    if _dir_has_onnx(expect_dir):
        return
    stem = zip_basename[:-4] if zip_basename.endswith(".zip") else zip_basename
    candidates: List[Path] = [
        root / stem,
        root / Path(CNSTD_SUBDIR) / stem,
        root / Path(CNOCR_SUBDIR) / stem,
    ]
    source_dir: Optional[Path] = None
    for c in candidates:
        if c.is_dir() and _dir_has_onnx(c):
            source_dir = c
            break
    if source_dir is None and root.is_dir():
        onnx_at_root = list(root.glob("*.onnx"))
        if onnx_at_root:
            expect_dir.mkdir(parents=True, exist_ok=True)
            for f in onnx_at_root:
                shutil.copy2(f, expect_dir / f.name)
            return
    if source_dir is None:
        for d in root.iterdir():
            if d.is_dir() and d.name != "ppocr" and _dir_has_onnx(d):
                source_dir = d
                break
    if source_dir is not None:
        expect_dir.mkdir(parents=True, exist_ok=True)
        for f in source_dir.rglob("*"):
            if f.is_file():
                rel = f.relative_to(source_dir)
                dest = expect_dir / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)


def _download_and_extract_zips_to(
    repo_id: str,
    path_in_repo: str,
    target_root: Path,
    revision: Optional[str] = None,
    allowlist: Optional[Tuple[str, ...]] = None,
    zip_to_ppocr_model: Optional[Callable[[str], Optional[str]]] = None,
) -> bool:
    """
    List zip files under path_in_repo, optionally filter by allowlist (basename in allowlist),
    download each that is not already present, extract into target_root.
    When zip_to_ppocr_model(basename) returns ppocr model dir, skip download if target_root/ppocr/<dir> exists with .onnx.
    """
    files = hf_list_repo_files(repo_id, path_in_repo=path_in_repo or "", revision=revision)
    all_zips = [f for f in files if f.endswith(".zip")]
    if all_zips:
        ColorPrint.blue("[HF] Available zips (%s):" % path_in_repo)
        for z in all_zips:
            print(f"  [HF]   - {os.path.basename(z)}", flush=True)
        sys.stdout.flush()
    else:
        ColorPrint.yellow(f"[HF] No zip files under {path_in_repo}")
    zips = all_zips
    if allowlist:
        zips = [f for f in zips if os.path.basename(f) in allowlist]
        if zips:
            to_skip = [
                rel for rel in zips
                if _zip_already_extracted(Path(target_root), os.path.basename(rel), zip_to_ppocr_model)
            ]
            to_download = [rel for rel in zips if rel not in to_skip]
            for rel in to_skip:
                ColorPrint.blue("[HF] Skip (already present): %s" % os.path.basename(rel))
            if to_download:
                ColorPrint.blue("[HF] Will download (allowlist):")
                for z in to_download:
                    print(f"  [HF]   - {os.path.basename(z)}", flush=True)
                sys.stdout.flush()
            zips = to_download
        if not zips:
            return True
    if not zips:
        ColorPrint.yellow(f"[HF] No zip files to download under {path_in_repo}" + (" (allowlist)" if allowlist else ""))
        return False
    target_root = Path(target_root)
    target_root.mkdir(parents=True, exist_ok=True)
    prefix = (path_in_repo or "").rstrip("/")
    ok = False
    for rel in zips:
        filename = f"{prefix}/{rel}" if prefix and "/" not in rel else rel
        basename = os.path.basename(rel)
        ColorPrint.blue(f"[HF] Downloading {filename} -> {target_root}")
        if hf_download_zip_and_extract(repo_id, filename, target_root, revision=revision):
            _normalize_extract_to_ppocr(Path(target_root), basename, zip_to_ppocr_model)
            ok = True
        else:
            ColorPrint.red(f"[HF] Failed {filename}")
    return ok


def ensure_cnstd_models(
    use_gpu: bool = False,
    det_model_name: Optional[str] = None,
) -> bool:
    """
    Ensure CnSTD 1.2 models under cnstd_root()/1.2.
    Uses HfApi.get_collection(breezedeus/cnstd) for repo list; only downloads optimal set for use_gpu.
    Zip from bundle only for cht (no single-model repo); skip if already present.
    """
    root = cnstd_root()
    dest = root / "1.2"
    dest.mkdir(parents=True, exist_ok=True)
    if det_model_name:
        expect_dir = dest / "ppocr" / det_model_name
        if expect_dir.is_dir() and any(expect_dir.iterdir()):
            return True
    repos = _repos_to_download_cnstd(use_gpu)
    ok = _download_ppocr_single_model_repos(repos, "1.2", root)
    zips_allow = all_cnstd_zips()
    if zips_allow:
        ok = _download_and_extract_zips_to(
            HF_OCR_REPO,
            CNSTD_SUBDIR,
            dest,
            allowlist=zips_allow,
            zip_to_ppocr_model=lambda b: _zip_basename_to_ppocr_model(b, "cnstd"),
        ) or ok
    return ok


def ensure_cnocr_models(
    use_gpu: bool = False,
    rec_model_name: Optional[str] = None,
) -> bool:
    """
    Ensure CnOCR 2.3 models under cnocr_root()/2.3.
    Uses HfApi.get_collection(breezedeus/cnocr) for repo list; only downloads optimal set for use_gpu.
    Zip from bundle only for cht; skip if already present.
    """
    root = cnocr_root()
    dest = root / "2.3"
    dest.mkdir(parents=True, exist_ok=True)
    if rec_model_name:
        expect_dir = dest / "ppocr" / rec_model_name
        if expect_dir.is_dir() and any(expect_dir.iterdir()):
            return True
    repos = _repos_to_download_cnocr(use_gpu)
    ok = _download_ppocr_single_model_repos(repos, "2.3", root)
    zips_allow = all_cnocr_zips()
    if zips_allow:
        ok = _download_and_extract_zips_to(
            HF_OCR_REPO,
            CNOCR_SUBDIR,
            dest,
            allowlist=zips_allow,
            zip_to_ppocr_model=lambda b: _zip_basename_to_ppocr_model(b, "cnocr"),
        ) or ok
    return ok


def init_ocr_models_from_hf(
    cnstd: bool = True,
    cnocr: bool = True,
    use_gpu: bool = False,
    det_model_name: Optional[str] = None,
    rec_model_name: Optional[str] = None,
) -> bool:
    """
    Initialize OCR models from Hugging Face (native download, no CLI).
    Uses get_collection(breezedeus/cnstd|cnocr) for repo list; only downloads optimal set for use_gpu.
    Zip from bundle only for cht (skip if already present).
    """
    ok = True
    if cnstd:
        ColorPrint.blue("[HF] Ensuring CnSTD models at " + str(cnstd_root()))
        if not ensure_cnstd_models(use_gpu=use_gpu, det_model_name=det_model_name):
            ColorPrint.yellow("[HF] CnSTD models incomplete; check " + str(cnstd_root() / "1.2"))
            ok = False
    if cnocr:
        ColorPrint.blue("[HF] Ensuring CnOCR models at " + str(cnocr_root()))
        if not ensure_cnocr_models(use_gpu=use_gpu, rec_model_name=rec_model_name):
            ColorPrint.yellow("[HF] CnOCR models incomplete; check " + str(cnocr_root() / "2.3"))
            ok = False
    return ok
