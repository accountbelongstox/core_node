# -*- coding: utf-8 -*-
"""Neutral Python, package, and accelerator ABI policy primitives."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Tuple


_POLICY_PATH = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "shells"
    / "ai_runtime_policy.env"
)


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
        normalized = value.strip()
        if (
            len(normalized) >= 2
            and normalized[0] == normalized[-1] == "'"
        ):
            normalized = normalized[1:-1]
        data[name.strip()] = normalized
    return data


_POLICY = _read_env_policy()


def policy_value(name: str, default: str = "") -> str:
    """Return one immutable runtime policy value."""
    return _POLICY.get(name, default)


def policy_csv(name: str) -> Tuple[str, ...]:
    """Return one comma-separated runtime policy value as a tuple."""
    return tuple(
        item.strip()
        for item in policy_value(name).split(",")
        if item.strip()
    )


POLICY_VERSION = policy_value("AI_POLICY_VERSION", "0")
PYTHON_VERSION = policy_value("AI_PYTHON_VERSION", "3.13")
SHARED_TRANSFORMERS_SPEC = policy_value(
    "AI_SHARED_TRANSFORMERS_SPEC",
    "transformers",
)
TORCH_INDEX_BASE = policy_value(
    "AI_TORCH_INDEX_BASE",
    "https://download.pytorch.org/whl",
)
TORCH_CPU_INDEX = policy_value(
    "AI_TORCH_CPU_INDEX",
    f"{TORCH_INDEX_BASE}/cpu",
)
PADDLE_INDEX_BASE = policy_value(
    "AI_PADDLE_INDEX_BASE",
    "https://www.paddlepaddle.org.cn/packages/stable",
)
PADDLE_CPU_INDEX = policy_value(
    "AI_PADDLE_CPU_INDEX",
    f"{PADDLE_INDEX_BASE}/cpu/",
)
PADDLE_CPU_PACKAGE = policy_value(
    "AI_PADDLE_CPU_PACKAGE",
    "paddlepaddle",
)
PADDLE_GPU_PACKAGE = policy_value(
    "AI_PADDLE_GPU_PACKAGE",
    "paddlepaddle-gpu",
)
CTRANSLATE2_CUDA_MAJOR = int(
    policy_value("AI_CTRANSLATE2_CUDA_MAJOR", "12")
)
ONNXRUNTIME_CUDA_MAJOR = int(
    policy_value("AI_ONNXRUNTIME_CUDA_MAJOR", "12")
)
CTRANSLATE2_GPU_PACKAGES = policy_csv("AI_CTRANSLATE2_GPU_PACKAGES")
TORCH_PACKAGES = policy_csv("AI_TORCH_PACKAGES")
OCR_PACKAGES = policy_csv("AI_OCR_PACKAGES")
BACKEND_COMMON_PACKAGES = policy_csv("AI_BACKEND_COMMON_PACKAGES")
BACKEND_WINDOWS_PACKAGES = policy_csv("AI_BACKEND_WINDOWS_PACKAGES")
BACKEND_PACKAGES = BACKEND_COMMON_PACKAGES + BACKEND_WINDOWS_PACKAGES
ISOLATED_SHARED_PACKAGES = policy_csv("AI_ISOLATED_SHARED_PACKAGES")


def _load_cuda_tiers() -> Tuple[Dict[str, Any], ...]:
    tiers = []
    for row in policy_csv("AI_CUDA_TIERS"):
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
    return tuple(
        sorted(
            tiers,
            key=lambda item: item["minimum_driver_cv"],
            reverse=True,
        )
    )


CUDA_TIERS = _load_cuda_tiers()


def cuda_tier_for_driver(
    driver_cv: Optional[int],
) -> Optional[Dict[str, Any]]:
    """Return the newest CUDA ABI tier supported by a driver."""
    if driver_cv is None:
        return None
    for tier in CUDA_TIERS:
        if driver_cv >= tier["minimum_driver_cv"]:
            return dict(tier)
    return None


def cuda_tier_by_tag(tag: str) -> Optional[Dict[str, Any]]:
    """Return one configured CUDA ABI tier by wheel tag."""
    normalized = str(tag or "").strip().lower()
    for tier in CUDA_TIERS:
        if tier["tag"] == normalized:
            return dict(tier)
    return None


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
    "policy_csv",
    "policy_value",
]
