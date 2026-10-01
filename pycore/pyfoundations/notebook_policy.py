# -*- coding: utf-8 -*-
"""Local-models-only policy of hosted notebook nodes (Colab, Kaggle).

A notebook VM (pyservice.sh colab|kaggle) is a compute helper of the own
server: it serves its local GPU/CPU models and never spends the stored
third-party keys or calls third-party AI/cloud services (keyed or keyless).
Only the client key that authenticates to the own server stays readable.

NOTEBOOK_PLATFORM is exported by scripts/shells/linux/common/notebook_runtime.sh;
PYCORE_LOCAL_MODELS_ONLY=1 enables the same policy on any other host.

Stdlib-only: imported by secret_manager.
"""

import os

NOTEBOOK_PLATFORM_ENV = "NOTEBOOK_PLATFORM"
LOCAL_MODELS_ONLY_ENV = "PYCORE_LOCAL_MODELS_ONLY"
NOTEBOOK_PLATFORMS = ("colab", "kaggle")
LOCAL_MODELS_ONLY_PLATFORM = "local-models-only"
_TRUE_VALUES = ("1", "true", "yes", "on")


def notebook_platform() -> str:
    """colab | kaggle when this process runs on a notebook node, else ''."""
    value = os.environ.get(NOTEBOOK_PLATFORM_ENV, "").strip().lower()
    return value if value in NOTEBOOK_PLATFORMS else ""


def local_models_only() -> bool:
    """True when third-party AI/cloud services and their keys are off."""
    if notebook_platform():
        return True
    return os.environ.get(LOCAL_MODELS_ONLY_ENV, "").strip().lower() in _TRUE_VALUES


def policy_platform() -> str:
    """Name of the host that enables the policy (for reasons and logs)."""
    return notebook_platform() or LOCAL_MODELS_ONLY_PLATFORM


__all__ = [
    "NOTEBOOK_PLATFORM_ENV", "LOCAL_MODELS_ONLY_ENV", "NOTEBOOK_PLATFORMS",
    "notebook_platform", "local_models_only", "policy_platform",
]
