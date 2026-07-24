# -*- coding: utf-8 -*-
"""Central AI runtime, CUDA, Python, and TTS compatibility policy."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Tuple


_POLICY_PATH = Path(__file__).resolve().parents[2] / "scripts" / "shells" / "ai_runtime_policy.env"


def _read_env_policy() -> Dict[str, str]:
    data: Dict[str, str] = {}
    try:
        lines = _POLICY_PATH.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return data
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1]
        data[name.strip()] = value
    return data


_POLICY = _read_env_policy()
POLICY_VERSION = _POLICY.get("AI_POLICY_VERSION", "0")
PYTHON_VERSION = _POLICY.get("AI_PYTHON_VERSION", "3.13")
SHARED_TRANSFORMERS_SPEC = _POLICY.get(
    "AI_SHARED_TRANSFORMERS_SPEC", "transformers"
)
TORCH_INDEX_BASE = _POLICY.get("AI_TORCH_INDEX_BASE", "https://download.pytorch.org/whl")
TORCH_CPU_INDEX = _POLICY.get("AI_TORCH_CPU_INDEX", f"{TORCH_INDEX_BASE}/cpu")
PADDLE_INDEX_BASE = _POLICY.get(
    "AI_PADDLE_INDEX_BASE", "https://www.paddlepaddle.org.cn/packages/stable"
)
PADDLE_CPU_INDEX = _POLICY.get("AI_PADDLE_CPU_INDEX", f"{PADDLE_INDEX_BASE}/cpu/")
PADDLE_CPU_PACKAGE = _POLICY.get("AI_PADDLE_CPU_PACKAGE", "paddlepaddle")
PADDLE_GPU_PACKAGE = _POLICY.get("AI_PADDLE_GPU_PACKAGE", "paddlepaddle-gpu")
CTRANSLATE2_CUDA_MAJOR = int(_POLICY.get("AI_CTRANSLATE2_CUDA_MAJOR", "12"))
ONNXRUNTIME_CUDA_MAJOR = int(_POLICY.get("AI_ONNXRUNTIME_CUDA_MAJOR", "12"))


def _csv(name: str) -> Tuple[str, ...]:
    return tuple(item.strip() for item in _POLICY.get(name, "").split(",") if item.strip())


CTRANSLATE2_GPU_PACKAGES = _csv("AI_CTRANSLATE2_GPU_PACKAGES")


def _cuda_tiers() -> Tuple[Dict[str, Any], ...]:
    tiers = []
    for row in _csv("AI_CUDA_TIERS"):
        parts = row.split(":")
        if len(parts) != 5:
            continue
        tiers.append(
            {
                "tag": parts[0],
                "minimum_driver_cv": int(parts[1]),
                "major": int(parts[2]),
                "toolkit_version": parts[3],
                "toolkit_driver": parts[4],
            }
        )
    return tuple(sorted(tiers, key=lambda item: item["minimum_driver_cv"], reverse=True))


CUDA_TIERS = _cuda_tiers()
TORCH_PACKAGES = _csv("AI_TORCH_PACKAGES")
OCR_PACKAGES = _csv("AI_OCR_PACKAGES")
BACKEND_COMMON_PACKAGES = _csv("AI_BACKEND_COMMON_PACKAGES")
BACKEND_WINDOWS_PACKAGES = _csv("AI_BACKEND_WINDOWS_PACKAGES")
BACKEND_PACKAGES = BACKEND_COMMON_PACKAGES + BACKEND_WINDOWS_PACKAGES
ISOLATED_SHARED_PACKAGES = _csv("AI_ISOLATED_SHARED_PACKAGES")


def _shared_transformers_health(imports: str) -> str:
    return imports


_ENGINE_SPECS: Dict[str, Dict[str, Any]] = {
    "chattts": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "packages": ("ChatTTS", "fastapi", "uvicorn", "pydub"),
        "health_imports": "import ChatTTS, fastapi, uvicorn, pydub, torch",
    },
    "cosyvoice": {
        "python_min": "3.10",
        "python_max": "3.12",
        "isolated": False,
        "packages": ("requirements.txt", "fastapi", "uvicorn", "modelscope", "huggingface_hub"),
        "health_imports": "import torch, fastapi, uvicorn, modelscope, onnxruntime",
    },
    "f5tts": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "packages": ("F5-TTS", "fastapi", "uvicorn", "python-multipart"),
        "health_imports": "import f5_tts, fastapi, uvicorn",
    },
    "gptsovits": {
        "python_min": "3.9",
        "python_max": "3.11",
        "isolated": True,
        "packages": ("requirements.txt",),
        "health_imports": "import torch, transformers",
    },
    "melotts": {
        "python_min": "3.8",
        "python_max": "3.13",
        "isolated": True,
        "packages": ("melotts", "unidic-lite"),
        "pins": (),
        "health_imports": "import torch, transformers; from melo.api import TTS",
    },
    "fishspeech": {
        "python_min": "3.10",
        "python_max": "3.12",
        "isolated": False,
        "packages": ("fish-audio-sdk", "fastapi", "uvicorn", "requests"),
        "health_imports": "import fishaudio, fastapi, uvicorn, torch",
    },
    "kokoro": {
        "python_min": "3.8",
        "python_max": "3.13",
        "isolated": False,
        "packages": ("sherpa-onnx", "soundfile"),
        "health_imports": "import sherpa_onnx, soundfile",
    },
    "voxcpm2": {
        "python_min": "3.10",
        "python_max": "3.12",
        "isolated": False,
        "packages": ("voxcpm", "soundfile"),
        "health_imports": "import voxcpm, soundfile, torch",
    },
    "bark": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "packages": (SHARED_TRANSFORMERS_SPEC, "scipy", "accelerate"),
        "health_imports": _shared_transformers_health(
            "import transformers, scipy, accelerate, torch"
        ),
    },
    "parler": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "packages": ("git+https://github.com/huggingface/parler-tts.git", "soundfile"),
        "health_imports": _shared_transformers_health(
            "import parler_tts, soundfile, torch, transformers"
        ),
    },
    "qwen3tts": {
        "python_min": "3.9",
        "python_max": "3.13",
        "python_recommended": "3.12",
        "isolated": True,
        "packages": _csv("AI_QWEN_TTS_PACKAGES"),
        "pins": _csv("AI_QWEN_TTS_PINS"),
        "health_imports": _POLICY.get(
            "AI_QWEN_TTS_HEALTH_IMPORTS",
            "import torch, torchaudio; from qwen_tts import Qwen3TTSModel",
        ),
        "shared_packages": ISOLATED_SHARED_PACKAGES,
        "require_cuda_when_present": True,
    },
}


def _version_tuple(value: str) -> Tuple[int, int]:
    parts = str(value).strip().split(".")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def cuda_tier_for_driver(driver_cv: Optional[int]) -> Optional[Dict[str, Any]]:
    if driver_cv is None:
        return None
    for tier in CUDA_TIERS:
        if driver_cv >= tier["minimum_driver_cv"]:
            return dict(tier)
    return None


def cuda_tier_by_tag(tag: str) -> Optional[Dict[str, Any]]:
    normalized = str(tag or "").strip().lower()
    for tier in CUDA_TIERS:
        if tier["tag"] == normalized:
            return dict(tier)
    return None


def engine_spec(engine: str) -> Dict[str, Any]:
    key = str(engine or "").strip().lower().replace("-", "")
    spec = _ENGINE_SPECS.get(key)
    if spec is None:
        return {}
    out = dict(spec)
    out["engine"] = key
    out["policy_version"] = POLICY_VERSION
    out["packages"] = list(out.get("packages", ()))
    out["pins"] = list(out.get("pins", ()))
    out["shared_packages"] = list(
        out.get("shared_packages", ISOLATED_SHARED_PACKAGES if out.get("isolated") else ())
    )
    return out


def engine_compatibility(engine: str, python_version: str) -> Dict[str, Any]:
    spec = engine_spec(engine)
    if not spec:
        return {"compatible": True, "engine": engine, "reason": "no compatibility restriction"}
    current = _version_tuple(python_version)
    minimum = _version_tuple(spec["python_min"])
    maximum = _version_tuple(spec["python_max"])
    compatible = minimum <= current <= maximum
    reason = (
        f"Python {python_version} is supported"
        if compatible
        else f"Python {python_version} is outside {spec['python_min']}-{spec['python_max']}"
    )
    return {
        "compatible": compatible,
        "engine": spec["engine"],
        "python_version": python_version,
        "python_min": spec["python_min"],
        "python_max": spec["python_max"],
        "isolated": bool(spec.get("isolated")),
        "reason": reason,
    }


def engine_fingerprint(engine: str) -> str:
    spec = engine_spec(engine)
    spec.pop("policy_version", None)
    payload = json.dumps(spec, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    spec_parser = sub.add_parser("engine-spec")
    spec_parser.add_argument("engine")
    compat_parser = sub.add_parser("compatibility")
    compat_parser.add_argument("engine")
    compat_parser.add_argument("--python-version", required=True)
    fingerprint_parser = sub.add_parser("fingerprint")
    fingerprint_parser.add_argument("engine")
    health_parser = sub.add_parser("health-probe")
    health_parser.add_argument("engine")
    cuda_parser = sub.add_parser("cuda-tier")
    cuda_parser.add_argument("--driver-cv", type=int, required=True)
    args = parser.parse_args(argv)
    if args.command == "engine-spec":
        print(json.dumps(engine_spec(args.engine), sort_keys=True))
        return 0
    if args.command == "compatibility":
        print(json.dumps(engine_compatibility(args.engine, args.python_version), sort_keys=True))
        return 0
    if args.command == "fingerprint":
        print(engine_fingerprint(args.engine))
        return 0
    if args.command == "health-probe":
        probe = engine_spec(args.engine).get("health_imports", "")
        if not probe:
            print("__HEALTH_MISSING__")
            return 0
        try:
            exec(probe, {})
            print("__HEALTH_READY__")
        except Exception:
            print("__HEALTH_FAILED__")
        return 0
    if args.command == "cuda-tier":
        print(json.dumps(cuda_tier_for_driver(args.driver_cv), sort_keys=True))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(_main())


__all__ = [
    "BACKEND_PACKAGES",
    "BACKEND_COMMON_PACKAGES",
    "BACKEND_WINDOWS_PACKAGES",
    "CUDA_TIERS",
    "CTRANSLATE2_CUDA_MAJOR",
    "CTRANSLATE2_GPU_PACKAGES",
    "ISOLATED_SHARED_PACKAGES",
    "OCR_PACKAGES",
    "ONNXRUNTIME_CUDA_MAJOR",
    "PADDLE_CPU_INDEX",
    "PADDLE_CPU_PACKAGE",
    "PADDLE_GPU_PACKAGE",
    "PADDLE_INDEX_BASE",
    "POLICY_VERSION",
    "PYTHON_VERSION",
    "SHARED_TRANSFORMERS_SPEC",
    "TORCH_CPU_INDEX",
    "TORCH_INDEX_BASE",
    "TORCH_PACKAGES",
    "cuda_tier_by_tag",
    "cuda_tier_for_driver",
    "engine_compatibility",
    "engine_fingerprint",
    "engine_spec",
]
