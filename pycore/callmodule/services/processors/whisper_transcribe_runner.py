#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from faster_whisper import WhisperModel
from faster_whisper.tokenizer import _LANGUAGE_CODES
from faster_whisper.utils import _MODELS
from huggingface_hub import scan_cache_dir
from whisper.tokenizer import LANGUAGES
"""Standalone faster-whisper transcribe runner.

Runs under the caller-selected interpreter. The central CUDA policy selects GPU
only when CTranslate2 matches the canonical CUDA major; otherwise callers use
CPU int8 without provisioning another CUDA stack.

No pycore imports - only stdlib + faster_whisper/ctranslate2/huggingface_hub.

Modes:
  transcribe (default): --model --device --compute --audio --srt --language
                        [--resume-from S] [--start-index N] [--duration F]
                        Emits one JSON line per written segment, then a final
                        {"done": true, "segments": N, "language": ".."} (N==0
                        means no speech) or {"error": ".."}. Writes/appends the
                        SRT file directly (shared filesystem with the caller).
  --probe catalog | languages | installed : emit one JSON document + exit.
"""
import argparse
import json
import os
import sys
from typing import Any, Dict, Optional, Tuple

import importlib.util as _u

try:
except ImportError:
    WhisperModel = None
    _LANGUAGE_CODES = {"en"}
    _MODELS = {}
try:
except ImportError:
    scan_cache_dir = None
try:
except ImportError:
    LANGUAGES = {}


WHISPER_MODEL_CANDIDATES = ("tiny", "base", "small", "medium", "large-v3", "turbo")


def _srt_timestamp(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    ms = int(round(seconds * 1000.0))
    hours, ms = divmod(ms, 3600000)
    minutes, ms = divmod(ms, 60000)
    secs, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (hours, minutes, secs, ms)


def _emit(obj: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _add_nvidia_dll_dirs() -> None:
    """Expose canonical pip-installed NVIDIA DLL directories on Windows."""
    if os.name != "nt":
        return
    try:
        for mod in ("nvidia.cublas", "nvidia.cudnn"):
            spec = _u.find_spec(mod)
            if spec and spec.submodule_search_locations:
                bin_dir = os.path.join(list(spec.submodule_search_locations)[0], "bin")
                if os.path.isdir(bin_dir):
                    os.add_dll_directory(bin_dir)
    except Exception:
        pass


def _load_model(model_name: str, device: str, compute_type: str) -> Tuple[Optional[Any], Optional[str]]:
    _add_nvidia_dll_dirs()
    if WhisperModel is None:
        return None, "faster-whisper is not installed"
    try:
        return WhisperModel(model_name, device=device, compute_type=compute_type), None
    except Exception as exc:
        if device != "cpu":
            try:
                return WhisperModel(model_name, device="cpu", compute_type="int8"), str(exc)
            except Exception as exc2:
                return None, "%s | cpu fallback failed: %s" % (exc, exc2)
        return None, str(exc)


def _transcribe(args) -> int:
    model, load_err = _load_model(args.model, args.device, args.compute)
    if model is None:
        _emit({"error": "model load failed: %s" % (load_err or "unknown")})
        return 1
    language = args.language or None
    resume_from = float(args.resume_from or 0.0)
    try:
        segments, info = model.transcribe(
            args.audio, language=language, vad_filter=True, word_timestamps=False)
        det_lang = getattr(info, "language", language or "?")
        prob = getattr(info, "language_probability", None)
        _emit({"info": True, "language": det_lang, "probability": prob,
               "duration": float(args.duration or 0.0)})
        idx = int(args.start_index or 0)
        wrote = 0
        mode = "a" if resume_from > 0 else "w"
        with open(args.srt, mode, encoding="utf-8") as fh:
            for seg in segments:
                text = (seg.text or "").strip()
                if not text:
                    continue
                idx += 1
                wrote += 1
                a_start = float(seg.start) + resume_from
                a_end = float(seg.end) + resume_from
                fh.write("%d\n%s --> %s\n%s\n\n" % (
                    idx, _srt_timestamp(a_start), _srt_timestamp(a_end), text))
                fh.flush()
                pct = (a_end / args.duration * 100.0) if args.duration else 0.0
                _emit({"seg": True, "pct": pct, "start": a_start,
                       "end": a_end, "text": text, "idx": idx})
        if wrote == 0:
            try:
                if os.path.isfile(args.srt):
                    os.remove(args.srt)
            except OSError:
                pass
        _emit({"done": True, "segments": wrote, "language": det_lang})
        return 0
    except Exception as exc:
        _emit({"error": str(exc)})
        return 1


def _model_repos() -> Dict[str, str]:
    repos: Dict[str, str] = {}
    try:
        for name in WHISPER_MODEL_CANDIDATES:
            if name in _MODELS:
                repos[name] = _MODELS[name]
    except Exception:
        pass
    return repos


def _probe_catalog() -> int:
    _emit({"catalog": _model_repos()})
    return 0


def _probe_languages() -> int:
    codes = []
    try:
        codes = sorted(_LANGUAGE_CODES)
    except Exception:
        codes = ["en"]
    names = {}
    try:
        names = {k: v.title() for k, v in LANGUAGES.items()}
    except Exception:
        names = {}
    langs = [{"code": c, "name": names.get(c, c)} for c in codes]
    langs.sort(key=lambda x: ("" if x["code"] == "en" else x["name"].lower()))
    _emit({"languages": langs})
    return 0


def _probe_installed() -> int:
    repos = _model_repos()
    installed = []
    if repos:
        try:
            cached = {r.repo_id for r in scan_cache_dir().repos} if scan_cache_dir else set()
            installed = [n for n in WHISPER_MODEL_CANDIDATES
                         if repos.get(n) and repos[n] in cached]
        except Exception:
            pass
    _emit({"installed": installed})
    return 0


def main() -> int:
    # Importing faster_whisper pulls in CTranslate2, so expose the current
    # interpreter's canonical NVIDIA DLL directories before every mode.
    _add_nvidia_dll_dirs()
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", choices=["catalog", "languages", "installed"], default=None)
    parser.add_argument("--model", default=None)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute", default="int8")
    parser.add_argument("--audio", default=None)
    parser.add_argument("--srt", default=None)
    parser.add_argument("--language", default=None)
    parser.add_argument("--resume-from", dest="resume_from", type=float, default=0.0)
    parser.add_argument("--start-index", dest="start_index", type=int, default=0)
    parser.add_argument("--duration", type=float, default=0.0)
    args = parser.parse_args()
    if args.probe == "catalog":
        return _probe_catalog()
    if args.probe == "languages":
        return _probe_languages()
    if args.probe == "installed":
        return _probe_installed()
    if not (args.model and args.audio and args.srt):
        sys.stderr.write("transcribe mode requires --model --audio --srt\n")
        return 2
    return _transcribe(args)


if __name__ == "__main__":
    raise SystemExit(main())
