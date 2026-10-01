#!/usr/bin/env python3
"""OCR model prefetch for the shell installers (never run by the service).

  ocr_models_prefetch.py cn [--gpu]    CnSTD/CnOCR weights under CNSTD_HOME / CNOCR_HOME
  ocr_models_prefetch.py easyocr       EasyOCR weights under EASYOCR_MODULE_PATH/model (default <shared cache>/ocr/easyocr, never ~/.EasyOCR)

Layouts follow the libraries (cnocr 2.3.3 / cnstd 1.2.8 ``ppocr`` recognizers and
detectors) and pycore.pyfoundations.third_party._ocr_models presence checks:
  repo models  <root>/<ver>/ppocr/<model>/<model>[_rec]_infer.onnx   (RapidRecognizer/Detector)
  zip models   <root>/<ver>/ppocr/<model>[_rec]_infer.onnx           (PPRecognizer/Detector; also kept
               under ppocr/<model>/ so the presence check holds)
  native zips  <root>/<ver>/<model>/*.onnx                           (densenet_lite_136-gru ...)
Present files are skipped, so a rerun downloads nothing.
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Callable, List

CORE_NODE_ROOT = Path(__file__).resolve().parents[2]
BUNDLE_REPO = "breezedeus/cnstd-cnocr-models"
CNSTD_VERSION = "1.2"
CNOCR_VERSION = "2.3"
PPOCR = "ppocr"
# Models whose library loader reads the flat ppocr/<file>.onnx (consts entry has a
# "url" zip and no RapidRecognizer/RapidDetector).
FLAT_LAYOUT_DET = ("ch_PP-OCRv3_det", "en_PP-OCRv3_det")
FLAT_LAYOUT_REC = ("chinese_cht_PP-OCRv3",)
# CnOCREngine.model_configs recognizers (densenet family), distributed as bundle zips.
NATIVE_REC_ZIPS = (
    "densenet_lite_136-gru-onnx.zip",
    "scene-densenet_lite_136-gru-onnx.zip",
    "doc-densenet_lite_136-gru-onnx.zip",
)
EASYOCR_LANG_SETS = (("ch_sim", "en"), ("en",), ("ja", "en"), ("ko", "en"))


def _hub():
    import huggingface_hub

    return huggingface_hub


def _repo_model(repo_id: str, dest: Path, onnx_name: str) -> None:
    if (dest / onnx_name).is_file():
        print(f"[ocr-prefetch] cached {dest / onnx_name}", flush=True)
        return
    dest.mkdir(parents=True, exist_ok=True)
    print(f"[ocr-prefetch] downloading {repo_id} -> {dest}", flush=True)
    for name in (onnx_name, "config.yaml"):
        _hub().hf_hub_download(repo_id, name, local_dir=str(dest))
    if not (dest / onnx_name).is_file():
        raise RuntimeError(f"{repo_id}: {onnx_name} missing after download")


def _bundle_zip(subfolder: str, zip_name: str, extract_root: Path, ready: Callable[[], bool]) -> None:
    if ready():
        print(f"[ocr-prefetch] cached {zip_name}", flush=True)
        return
    print(f"[ocr-prefetch] downloading {BUNDLE_REPO}/{subfolder}/{zip_name} -> {extract_root}", flush=True)
    archive = _hub().hf_hub_download(BUNDLE_REPO, f"{subfolder}/{zip_name}")
    extract_root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(extract_root)
    if not ready():
        raise RuntimeError(f"{zip_name}: expected files missing after extract under {extract_root}")


def _mirror_into_model_dir(flat_file: Path, model: str) -> None:
    target = flat_file.parent / model / flat_file.name
    if target.is_file():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(flat_file, target)


def prefetch_cn(use_gpu: bool) -> None:
    sys.path.insert(0, str(CORE_NODE_ROOT))
    os.environ.setdefault("PYCORE_SKIP_DEP_CHECK", "1")
    from pycore.pyfoundations.third_party import _ocr_models as spec

    cnstd_dir = spec.cnstd_root() / CNSTD_VERSION
    cnocr_dir = spec.cnocr_root() / CNOCR_VERSION
    dets: List[str] = []
    recs: List[str] = []
    for lang in spec.PREWARM_LANGUAGES:
        det, rec_order = spec.prewarm_det_rec_for_lang(lang, use_gpu)
        dets.append(det)
        recs.append(rec_order[0])
    dets.extend(FLAT_LAYOUT_DET)
    for det in dict.fromkeys(dets):
        flat = cnstd_dir / PPOCR / f"{det}_infer.onnx"
        if det in FLAT_LAYOUT_DET:
            _bundle_zip(f"models/cnstd/{CNSTD_VERSION}", f"{det}_infer-onnx.zip", cnstd_dir, flat.is_file)
            _mirror_into_model_dir(flat, det)
        else:
            _repo_model(f"breezedeus/cnstd-ppocr-{det}", cnstd_dir / PPOCR / det, f"{det}_infer.onnx")
    for rec in dict.fromkeys(recs):
        flat = cnocr_dir / PPOCR / f"{rec}_rec_infer.onnx"
        if rec in FLAT_LAYOUT_REC:
            _bundle_zip(f"models/cnocr/{CNOCR_VERSION}", f"{rec}_rec_infer-onnx.zip", cnocr_dir, flat.is_file)
            _mirror_into_model_dir(flat, rec)
        else:
            _repo_model(f"breezedeus/cnocr-ppocr-{rec}", cnocr_dir / PPOCR / rec, f"{rec}_rec_infer.onnx")
    for zip_name in NATIVE_REC_ZIPS:
        model_dir = cnocr_dir / zip_name[: -len("-onnx.zip")]
        _bundle_zip(
            f"models/cnocr/{CNOCR_VERSION}", zip_name, cnocr_dir,
            lambda model_dir=model_dir: model_dir.is_dir() and any(model_dir.glob("*.onnx")),
        )


def prefetch_easyocr() -> None:
    import easyocr
    from easyocr import config

    base = os.environ.get("EASYOCR_MODULE_PATH")
    if not base:
        sys.path.insert(0, str(CORE_NODE_ROOT))
        from pycore.pyfoundations.system_paths import get_shared_download_cache_dir

        base = str(get_shared_download_cache_dir() / "ocr" / "easyocr")
        os.environ["EASYOCR_MODULE_PATH"] = base
    model_dir = Path(base) / "model"
    recognizers = config.recognition_models["gen2"]
    detector = config.detection_models["craft"]["filename"]
    needed = {
        ("ch_sim", "en"): "zh_sim_g2",
        ("en",): "english_g2",
        ("ja", "en"): "japanese_g2",
        ("ko", "en"): "korean_g2",
    }
    for langs in EASYOCR_LANG_SETS:
        wanted = [detector, recognizers[needed[langs]]["filename"]]
        if all((model_dir / name).is_file() for name in wanted):
            print(f"[ocr-prefetch] cached easyocr {'+'.join(langs)}", flush=True)
            continue
        print(f"[ocr-prefetch] downloading easyocr {'+'.join(langs)} -> {model_dir}", flush=True)
        easyocr.Reader(list(langs), gpu=False, model_storage_directory=str(model_dir), download_enabled=True)
        for name in wanted:
            if not (model_dir / name).is_file():
                raise RuntimeError(f"easyocr: {name} missing after download in {model_dir}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    cn = sub.add_parser("cn")
    cn.add_argument("--gpu", action="store_true")
    sub.add_parser("easyocr")
    args = parser.parse_args()
    if args.command == "cn":
        prefetch_cn(args.gpu)
    else:
        prefetch_easyocr()
    return 0


if __name__ == "__main__":
    sys.exit(main())
