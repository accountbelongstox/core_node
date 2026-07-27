# -*- coding: utf-8 -*-
"""AI engine compatibility policy for managed Python environments."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Tuple


_REPO_ROOT = Path(__file__).resolve().parents[3]
_REPO_ROOT_TEXT = str(_REPO_ROOT)
if _REPO_ROOT_TEXT not in sys.path:
    sys.path.insert(0, _REPO_ROOT_TEXT)

from pycore.pyfoundations.runtime_abi import (
    BACKEND_COMMON_PACKAGES,
    BACKEND_PACKAGES,
    BACKEND_WINDOWS_PACKAGES,
    CUDA_TIERS,
    CTRANSLATE2_CUDA_MAJOR,
    CTRANSLATE2_GPU_PACKAGES,
    ISOLATED_SHARED_PACKAGES,
    OCR_PACKAGES,
    ONNXRUNTIME_CUDA_MAJOR,
    PADDLE_CPU_INDEX,
    PADDLE_CPU_PACKAGE,
    PADDLE_GPU_PACKAGE,
    PADDLE_INDEX_BASE,
    POLICY_VERSION,
    PYTHON_VERSION,
    SHARED_TRANSFORMERS_SPEC,
    TORCH_CPU_INDEX,
    TORCH_INDEX_BASE,
    TORCH_PACKAGES,
    cuda_tier_by_tag,
    cuda_tier_for_driver,
    policy_csv,
    policy_value,
)


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
        "packages": (
            "requirements.txt",
            "fastapi",
            "uvicorn",
            "modelscope",
            "huggingface_hub",
        ),
        "health_imports": (
            "import torch, fastapi, uvicorn, modelscope, onnxruntime"
        ),
    },
    "f5tts": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "packages": (
            "F5-TTS",
            "fastapi",
            "uvicorn",
            "python-multipart",
        ),
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
        "health_imports": (
            "import torch, transformers; from melo.api import TTS"
        ),
    },
    "fishspeech": {
        "python_min": "3.10",
        "python_max": "3.12",
        "isolated": False,
        "packages": (
            "fish-audio-sdk",
            "fastapi",
            "uvicorn",
            "requests",
        ),
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
        "packages": (
            SHARED_TRANSFORMERS_SPEC,
            "scipy",
            "accelerate",
        ),
        "health_imports": (
            "import transformers, scipy, accelerate, torch"
        ),
    },
    "parler": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "packages": (
            "git+https://github.com/huggingface/parler-tts.git",
            "soundfile",
        ),
        "health_imports": (
            "import parler_tts, soundfile, torch, transformers"
        ),
    },
    "qwen3tts": {
        "python_min": "3.9",
        "python_max": "3.13",
        "python_recommended": "3.12",
        "isolated": True,
        "packages": policy_csv("AI_QWEN_TTS_PACKAGES"),
        "pins": policy_csv("AI_QWEN_TTS_PINS"),
        "health_imports": policy_value(
            "AI_QWEN_TTS_HEALTH_IMPORTS",
            "import torch, torchaudio; "
            "from qwen_tts import Qwen3TTSModel",
        ),
        "shared_packages": ISOLATED_SHARED_PACKAGES,
        "require_cuda_when_present": True,
    },
}


def _version_tuple(value: str) -> Tuple[int, int]:
    parts = str(value).strip().split(".")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def engine_spec(engine: str) -> Dict[str, Any]:
    """Return a detached engine policy record."""
    key = str(engine or "").strip().lower().replace("-", "")
    spec = _ENGINE_SPECS.get(key)
    if spec is None:
        return {}
    result = dict(spec)
    result["engine"] = key
    result["policy_version"] = POLICY_VERSION
    result["packages"] = list(result.get("packages", ()))
    result["pins"] = list(result.get("pins", ()))
    result["shared_packages"] = list(
        result.get(
            "shared_packages",
            ISOLATED_SHARED_PACKAGES
            if result.get("isolated")
            else (),
        )
    )
    return result


def engine_compatibility(
    engine: str,
    python_version: str,
) -> Dict[str, Any]:
    """Return compatibility for one engine and Python version."""
    spec = engine_spec(engine)
    if not spec:
        return {
            "compatible": True,
            "engine": engine,
            "reason": "no compatibility restriction",
        }
    current = _version_tuple(python_version)
    minimum = _version_tuple(spec["python_min"])
    maximum = _version_tuple(spec["python_max"])
    compatible = minimum <= current <= maximum
    reason = (
        f"Python {python_version} is supported"
        if compatible
        else (
            f"Python {python_version} is outside "
            f"{spec['python_min']}-{spec['python_max']}"
        )
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
    """Return a stable fingerprint for one engine policy."""
    spec = engine_spec(engine)
    spec.pop("policy_version", None)
    if spec.get("isolated"):
        shared_packages = tuple(spec.get("shared_packages", ()))
        if "transformers" not in shared_packages:
            shared_packages += ("transformers",)
        spec["shared_runtime_versions"] = {
            package: _shared_runtime_version(package)
            for package in shared_packages
        }
    payload = json.dumps(
        spec,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _shared_runtime_version(package: str) -> str:
    """Return the main interpreter version reused by an isolated overlay."""
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return "<missing>"
    except Exception:
        return "<unknown>"


def _main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
    )
    spec_parser = subparsers.add_parser("engine-spec")
    spec_parser.add_argument("engine")
    compatibility_parser = subparsers.add_parser("compatibility")
    compatibility_parser.add_argument("engine")
    compatibility_parser.add_argument(
        "--python-version",
        required=True,
    )
    fingerprint_parser = subparsers.add_parser("fingerprint")
    fingerprint_parser.add_argument("engine")
    health_parser = subparsers.add_parser("health-probe")
    health_parser.add_argument("engine")
    cuda_parser = subparsers.add_parser("cuda-tier")
    cuda_parser.add_argument("--driver-cv", type=int, required=True)
    args = parser.parse_args(argv)

    if args.command == "engine-spec":
        print(json.dumps(engine_spec(args.engine), sort_keys=True))
        return 0
    if args.command == "compatibility":
        print(
            json.dumps(
                engine_compatibility(
                    args.engine,
                    args.python_version,
                ),
                sort_keys=True,
            )
        )
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
        print(
            json.dumps(
                cuda_tier_for_driver(args.driver_cv),
                sort_keys=True,
            )
        )
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(_main())


__all__ = [
    "BACKEND_COMMON_PACKAGES",
    "BACKEND_PACKAGES",
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
