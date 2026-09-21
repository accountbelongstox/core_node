# -*- coding: utf-8 -*-
"""Shared compatibility policy for managed Python environments."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Tuple



_REPO_ROOT = Path(__file__).resolve().parents[3]
_REPO_ROOT_TEXT = str(_REPO_ROOT)
if _REPO_ROOT_TEXT not in sys.path:
    sys.path.insert(0, _REPO_ROOT_TEXT)

from pycore.pyfoundations.pygvar import GLOBAL_VAR_DIR
from pycore.pyfoundations.system_paths import get_lang_compiler_dir
from pycore.pyfoundations.runtime_abi import (
    BACKEND_COMMON_PACKAGES,
    BACKEND_PACKAGES,
    BACKEND_WINDOWS_PACKAGES,
    CUDA_TIERS,
    CTRANSLATE2_CUDA_MAJOR,
    CTRANSLATE2_GPU_PACKAGES,
    ISOLATED_SHARED_PACKAGES,
    ISOLATION_MODE_OVERLAY,
    ISOLATION_MODE_SELF_CONTAINED,
    OCR_PACKAGES,
    ONNXRUNTIME_CUDA_MAJOR,
    PADDLE_CPU_INDEX,
    PADDLE_CPU_PACKAGE,
    PADDLE_GPU_PACKAGE,
    PADDLE_INDEX_BASE,
    POLICY_VERSION,
    PYTHON_VERSION,
    PYTHON310_VERSION,
    PYTHON312_VERSION,
    SHARED_TRANSFORMERS_SPEC,
    TORCH_CPU_INDEX,
    TORCH_INDEX_BASE,
    TORCH_PACKAGES,
    cuda_tier_by_tag,
    cuda_tier_for_driver,
    policy_csv,
    policy_value,
)


_GPTSOVITS_BUILD_CONSTRAINTS = tuple(
    (Path(__file__).resolve().parents[3] / "tts_install_assets" / "gptsovits_build_constraints.txt")
    .read_text(encoding="ascii").splitlines()
)
_LEGACY_BUILD_CONSTRAINTS = ("setuptools<81",)
_LEGACY_BUILD_PACKAGES = (*_LEGACY_BUILD_CONSTRAINTS, "wheel")

_ENGINE_SPECS: Dict[str, Dict[str, Any]] = {
    "chattts": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "cpu_supported": True,
        # audioop-lts: pydub's audioop shim on Python 3.13+ (stdlib removed it).
        "packages": ("ChatTTS", "fastapi", "uvicorn", "pydub", "audioop-lts"),
        "health_imports": "import ChatTTS, fastapi, uvicorn, pydub, torch",
    },
    "cosyvoice": {
        "python_min": "3.10",
        "python_max": "3.12",
        "python_recommended": PYTHON310_VERSION,
        "isolated": True,
        "isolation_mode": ISOLATION_MODE_SELF_CONTAINED,
        "device_policy": "auto",
        "cpu_supported": True,
        "linux_native_build": True,
        "build_packages": _LEGACY_BUILD_PACKAGES,
        "build_constraints": _LEGACY_BUILD_CONSTRAINTS,
        "torch_packages": ("torch", "torchaudio"),
        "packages": (
            "requirements.txt",
            "fastapi",
            "uvicorn",
            "modelscope",
            "huggingface_hub",
        ),
        "health_imports": (
            "import numpy, torch, fastapi, uvicorn, modelscope, onnxruntime"
        ),
        "upstream": {
            "repo": "https://github.com/FunAudioLLM/CosyVoice",
            "evidence_date": "2026-09-17",
            "revision": None,
        },
        "limits": (
            {
                "source": "cosyvoice/cli/frontend.py (upstream main)",
                "parameter": "token_max_n",
                "value": 80,
                "unit": "token",
                "hard_limit": False,
                "note": "Frontend text-split parameter, not a model character cap; keep the official frontend and add project-level protection for long unpunctuated spans.",
            },
            {
                "source": "cosyvoice/cli/frontend.py (upstream main)",
                "parameter": "token_min_n / merge_len",
                "value": "60 / 20",
                "unit": "token",
                "hard_limit": False,
                "note": "Frontend merge parameters; no unified full-text hard limit published.",
            },
        ),
    },
    "f5tts": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "cpu_supported": True,
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
        "python_recommended": PYTHON310_VERSION,
        "isolated": True,
        "isolation_mode": ISOLATION_MODE_SELF_CONTAINED,
        "device_policy": "auto",
        "cpu_supported": True,
        "torch_packages": ("torch", "torchaudio"),
        "packages": ("requirements.txt",),
        "windows_native_build": True,
        "linux_native_build": True,
        "build_packages": (*_LEGACY_BUILD_PACKAGES, "Cython", *_GPTSOVITS_BUILD_CONSTRAINTS),
        "build_constraints": (*_LEGACY_BUILD_CONSTRAINTS, *_GPTSOVITS_BUILD_CONSTRAINTS),
        "pip_args": ("--no-build-isolation",),
        "health_imports": "import numpy, torch, transformers, pyopenjtalk, jieba_fast, opencc",
        "upstream": {
            "repo": "https://github.com/RVC-Boss/GPT-SoVITS",
            "evidence_date": "2026-09-17",
            "revision": None,
        },
        "limits": (
            {
                "source": "api_v2.py + GPT_SoVITS/TTS_infer_pack/text_segmentation_method.py (upstream main)",
                "parameter": "text segmentation entry",
                "value": None,
                "unit": "unknown",
                "hard_limit": False,
                "note": "Official cut methods exist; no unified hard cap published. Reference-audio duration and target-audio max duration are recorded separately; arbitrary-length single-shot generation is not promised.",
            },
        ),
    },
    "melotts": {
        "python_min": "3.8",
        "python_max": "3.13",
        "python_recommended": PYTHON310_VERSION,
        "isolated": True,
        "isolation_mode": ISOLATION_MODE_SELF_CONTAINED,
        "device_policy": "auto",
        "cpu_supported": True,
        "linux_native_build": True,
        "torch_packages": ("torch", "torchaudio"),
        # The melotts PyPI sdist (0.1.1) is broken - its setup.py reads a
        # requirements.txt that is not shipped; upstream's documented install
        # is the git repo.
        "packages": ("git+https://github.com/myshell-ai/MeloTTS.git", "unidic-lite"),
        # melo.text.japanese initializes MeCab at import time and needs the
        # full unidic dictionary (upstream README: python -m unidic download).
        "post_install_commands": (("-m", "unidic", "download"),),
        "pins": (),
        "health_imports": (
            "import numpy, torch, transformers; from melo.api import TTS"
        ),
        "upstream": {
            "repo": "https://github.com/myshell-ai/MeloTTS",
            "evidence_date": "2026-09-17",
            "revision": None,
        },
        "limits": (
            {
                "source": "docs/install.md + melo/api.py (upstream main)",
                "parameter": "native sentence splitting",
                "value": None,
                "unit": "unknown",
                "hard_limit": False,
                "note": "Official tested env is Ubuntu 20.04/Python 3.9; Windows docker is officially recommended. Native sentence splitting is kept; project protection added for unpunctuated overlong input. No unified full-text hard limit published.",
            },
        ),
    },
    "fishspeech": {
        "python_min": "3.10",
        "python_max": "3.12",
        "python_recommended": PYTHON312_VERSION,
        "isolated": True,
        "isolation_mode": ISOLATION_MODE_SELF_CONTAINED,
        "device_policy": "auto",
        # Bridge/SDK scope lives in this venv; local inference (fish_speech from
        # the cloned repo + matching checkpoints) pins torch/torchaudio 2.8.0
        # per the upstream pyproject (see limits) - cu130 has no 2.8.0 wheels,
        # so the CUDA wheel tier for this engine is pinned to cu128.
        "torch_packages": ("torch==2.8.0", "torchaudio==2.8.0"),
        "torch_index_tag": "cu128",
        "cpu_supported": True,
        "packages": (
            "fish-audio-sdk",
            "fastapi",
            "uvicorn",
            "requests",
        ),
        "health_imports": "import fishaudio, fastapi, uvicorn, requests, torch",
        "upstream": {
            "repo": "https://github.com/fishaudio/fish-speech",
            "evidence_date": "2026-09-17",
            "revision": None,
        },
        "limits": (
            {
                "source": "pyproject.toml + fish_speech/utils/schema.py (upstream main)",
                "parameter": "chunk_length",
                "value": 200,
                "unit": "token",
                "hard_limit": False,
                "note": "Request chunking parameter (range 100-1000), not a full-text character cap. pyproject declares Python >=3.10 and torch/torchaudio 2.8.0 with a CPU extra.",
            },
            {
                "source": "fish_speech/utils/schema.py (upstream main)",
                "parameter": "max_new_tokens",
                "value": 1024,
                "unit": "token",
                "hard_limit": False,
                "note": "Generation token budget; model context must also subtract reference audio/text and history. Do not substitute cloud SDK ranges for the local API.",
            },
        ),
    },
    "kokoro": {
        "python_min": "3.8",
        "python_max": "3.13",
        "isolated": False,
        "cpu_supported": True,
        "packages": ("sherpa-onnx", "soundfile"),
        "health_imports": "import sherpa_onnx, soundfile",
    },
    "voxcpm2": {
        "python_min": "3.10",
        "python_max": "3.12",
        "python_recommended": PYTHON312_VERSION,
        "isolated": True,
        "isolation_mode": ISOLATION_MODE_SELF_CONTAINED,
        "device_policy": "auto",
        "cpu_supported": True,
        "torch_packages": ("torch", "torchaudio"),
        "packages": ("voxcpm", "soundfile"),
        "health_imports": "import voxcpm, soundfile, torch",
        "upstream": {
            "repo": "https://github.com/OpenBMB/VoxCPM",
            "evidence_date": "2026-09-17",
            "revision": None,
        },
        "limits": (
            {
                "source": "src/voxcpm/core.py (upstream main)",
                "parameter": "max_len",
                "value": 4096,
                "unit": "token",
                "hard_limit": False,
                "note": "Generation token length, NOT 4096 characters or seconds. Service adds outer text segmentation, a total task deadline, and a budget merged with the native badcase retry (up to 3). core.py accepts an explicit device.",
            },
        ),
    },
    "bark": {
        "python_min": "3.10",
        "python_max": "3.13",
        "isolated": False,
        "cpu_supported": True,
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
        "cpu_supported": True,
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
        "isolation_mode": ISOLATION_MODE_OVERLAY,
        "cpu_supported": True,
        "packages": policy_csv("AI_QWEN_TTS_PACKAGES"),
        "pins": policy_csv("AI_QWEN_TTS_PINS"),
        "health_imports": policy_value(
            "AI_QWEN_TTS_HEALTH_IMPORTS",
            "import torch, torchaudio; "
            "from qwen_tts import Qwen3TTSModel",
        ),
        "provision_modules": policy_csv(
            "AI_QWEN_TTS_PROVISION_MODULES"
        ),
        "accelerator_packages": policy_csv(
            "AI_QWEN_TTS_ACCELERATOR_PACKAGES"
        ),
        "accelerator_build_packages": policy_csv(
            "AI_QWEN_TTS_ACCELERATOR_BUILD_PACKAGES"
        ),
        "accelerator_pip_args": policy_csv(
            "AI_QWEN_TTS_ACCELERATOR_PIP_ARGS"
        ),
        "accelerator_platforms": policy_csv(
            "AI_QWEN_TTS_ACCELERATOR_PLATFORMS"
        ),
        "accelerator_cuda_min_major": int(
            policy_value("AI_QWEN_TTS_ACCELERATOR_CUDA_MIN_MAJOR", "12")
        ),
        "accelerator_compute_min_major": int(
            policy_value("AI_QWEN_TTS_ACCELERATOR_COMPUTE_MIN_MAJOR", "8")
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
    for sequence_key in (
        "provision_modules",
        "accelerator_packages",
        "accelerator_build_packages",
        "accelerator_pip_args",
        "accelerator_platforms",
        "torch_packages",
    ):
        if sequence_key in result:
            result[sequence_key] = list(result[sequence_key])
    if "post_install_commands" in result:
        result["post_install_commands"] = [
            list(command) for command in result["post_install_commands"]
        ]
    result["shared_packages"] = list(
        result.get(
            "shared_packages",
            ISOLATED_SHARED_PACKAGES
            if result.get("isolated")
            else (),
        )
    )
    if "upstream" in result:
        result["upstream"] = dict(result["upstream"])
    result["limits"] = [dict(item) for item in result.get("limits", ())]
    return result


def engine_isolation_mode(engine: str) -> str:
    """Return the isolation mode for one engine (default: legacy overlay)."""
    spec = engine_spec(engine)
    mode = str(spec.get("isolation_mode") or "").strip()
    if mode in (ISOLATION_MODE_OVERLAY, ISOLATION_MODE_SELF_CONTAINED):
        return mode
    return ISOLATION_MODE_OVERLAY


def engine_cpu_supported(engine: str) -> bool:
    """Return whether the engine officially supports CPU-only inference.

    Unknown engines default to False (conservative: they keep skipping on
    headless GPU-less hosts).
    """
    return bool(engine_spec(engine).get("cpu_supported", False))


def _python_binary_path(candidate: str) -> str:
    path = Path(candidate.strip().lstrip("\ufeff")).expanduser()
    if not path.is_file() or (sys.platform == "win32" and path.suffix.lower() != ".exe"):
        return ""
    return str(path.resolve())


def _registered_python_path(version: str) -> str:
    """Read the registered Python 3.10 interpreter path.

    Resolution order (never the host 3.13 interpreter):
      1. PYTHON310_EXE_PATH environment variable (launcher-provided)
      2. pygvar file store key PYTHON310_EXE_PATH (written by the platform
         installers: Step13_InstallPython310_312.ps1 / 14_install_python310.sh)
    """
    runtime_name = f"python{version.replace('.', '')}"
    runtime_key = f"{runtime_name.upper()}_EXE_PATH"
    candidate = _python_binary_path(os.environ.get(runtime_key) or "")
    if candidate:
        return candidate
    stored_path = Path(GLOBAL_VAR_DIR) / runtime_key
    if stored_path.is_file():
        candidate = _python_binary_path(stored_path.read_text(encoding="utf-8-sig"))
        if candidate:
            return candidate
    runtime_dir = get_lang_compiler_dir() / runtime_name
    candidate = _python_binary_path(str(runtime_dir / ("python.exe" if sys.platform == "win32" else f"bin/python{version}")))
    if candidate or sys.platform == "win32":
        return candidate
    return _python_binary_path(shutil.which(runtime_name) or "")


def resolve_engine_base_python(engine: str) -> Dict[str, Any]:
    """Resolve the base interpreter used to create one engine's venv.

    Contract (plan step 02): engine explicit override (<ENGINE>_PYTHON) ->
    registered Python 3.10 -> report missing. The host 3.13 interpreter is
    NEVER returned as a silent fallback for self-contained engines. The
    override means "base interpreter for venv creation"; the runtime always
    launches the venv's own absolute interpreter.
    """
    key = str(engine or "").strip().lower().replace("-", "")
    override = (os.environ.get(f"{key.upper()}_PYTHON") or "").strip()
    if override:
        override_binary = _python_binary_path(override)
        if override_binary:
            return {
                "found": True,
                "engine": key,
                "path": override_binary,
                "source": "engine_override",
                "env_name": f"{key.upper()}_PYTHON",
            }
        return {
            "found": False,
            "engine": key,
            "path": "",
            "source": "engine_override",
            "reason": f"override {key.upper()}_PYTHON points to a missing file: {override}",
        }
    version = str(engine_spec(key).get("python_recommended") or PYTHON310_VERSION)
    registered = _registered_python_path(version)
    if registered:
        return {
            "found": True,
            "engine": key,
            "path": registered,
            "source": f"registered_python{version.replace('.', '')}",
        }
    return {
        "found": False,
        "engine": key,
        "path": "",
        "source": "none",
        "reason": (
            f"python{version.replace('.', '')}_not_registered: install the dedicated Python "
            f"{version} first or set "
            f"{key.upper()}_PYTHON to a compatible base interpreter"
        ),
    }


def _probe_python_version(python_exe: str) -> str:
    """Return the "major.minor" version of an arbitrary interpreter."""
    try:
        result = subprocess.run(
            [
                python_exe,
                "-c",
                "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        return ""
    if result.returncode != 0:
        return ""
    return (result.stdout or "").strip()


def base_interpreter_compatibility(engine: str) -> Dict[str, Any]:
    """Compatibility of the engine's resolved BASE interpreter.

    Self-contained engines are gated by their venv base interpreter (dedicated
    Python 3.10), never by the host interpreter version. Resolution order is
    resolve_engine_base_python(): engine override -> registered Python 3.10 ->
    report missing. Installers use this so a 3.13 host no longer skips engines
    whose window excludes 3.13.
    """
    key = str(engine or "").strip().lower().replace("-", "")
    resolved = resolve_engine_base_python(key)
    if not resolved.get("found"):
        return {
            "compatible": False,
            "engine": key,
            "base_found": False,
            "base_python": "",
            "base_source": resolved.get("source", "none"),
            "reason": resolved.get("reason", "base interpreter missing"),
        }
    base = str(resolved["path"])
    version = _probe_python_version(base)
    if not version:
        return {
            "compatible": False,
            "engine": key,
            "base_found": True,
            "base_python": base,
            "base_source": resolved.get("source", ""),
            "reason": f"could not probe base interpreter version: {base}",
        }
    result = engine_compatibility(key, version)
    result["base_found"] = True
    result["base_python"] = base
    result["base_source"] = resolved.get("source", "")
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
    """Return a stable fingerprint for core engine dependencies."""
    spec = engine_spec(engine)
    spec.pop("policy_version", None)
    for key in tuple(spec):
        if key.startswith("accelerator_"):
            spec.pop(key)
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
    base_compat_parser = subparsers.add_parser("base-compatibility")
    base_compat_parser.add_argument("engine")
    fingerprint_parser = subparsers.add_parser("fingerprint")
    fingerprint_parser.add_argument("engine")
    health_parser = subparsers.add_parser("health-probe")
    health_parser.add_argument("engine")
    cuda_parser = subparsers.add_parser("cuda-tier")
    cuda_parser.add_argument("--driver-cv", type=int, required=True)
    cpu_parser = subparsers.add_parser("cpu-supported")
    cpu_parser.add_argument("engine")
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
    if args.command == "base-compatibility":
        print(
            json.dumps(
                base_interpreter_compatibility(args.engine),
                sort_keys=True,
            )
        )
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
    if args.command == "cpu-supported":
        print("true" if engine_cpu_supported(args.engine) else "false")
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
    "PYTHON310_VERSION",
    "ISOLATION_MODE_OVERLAY",
    "ISOLATION_MODE_SELF_CONTAINED",
    "SHARED_TRANSFORMERS_SPEC",
    "TORCH_CPU_INDEX",
    "TORCH_INDEX_BASE",
    "TORCH_PACKAGES",
    "cuda_tier_by_tag",
    "cuda_tier_for_driver",
    "base_interpreter_compatibility",
    "engine_compatibility",
    "engine_cpu_supported",
    "engine_fingerprint",
    "engine_isolation_mode",
    "engine_spec",
    "resolve_engine_base_python",
]
