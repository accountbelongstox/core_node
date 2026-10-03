# -*- coding: utf-8 -*-
"""Local-models-only and assist-client policy of hosted notebook nodes (Colab, Kaggle).

A notebook VM (pyservice.sh colab|kaggle) is a compute helper of the own
server: it serves its local GPU/CPU models and never spends the stored
third-party keys or calls third-party AI/cloud services (keyed or keyless).
Only the client key that authenticates to the own server stays readable.

A notebook node is also a pure assist client: Relay calls run in-process and no
local HTTP listener is bound (local_http_enabled); PYCORE_LOCAL_HTTP=1|0 forces
the listener on or off on any host.

NOTEBOOK_PLATFORM is exported by scripts/shells/linux/common/notebook_runtime.sh;
PYCORE_LOCAL_MODELS_ONLY=1 enables the same policy on any other host.

Stdlib-only: imported by secret_manager.
"""

import os
import tempfile

NOTEBOOK_PLATFORM_ENV = "NOTEBOOK_PLATFORM"
LOCAL_MODELS_ONLY_ENV = "PYCORE_LOCAL_MODELS_ONLY"
LOCAL_HTTP_ENV = "PYCORE_LOCAL_HTTP"
NOTEBOOK_PLATFORMS = ("colab", "kaggle")
LOCAL_MODELS_ONLY_PLATFORM = "local-models-only"
_TRUE_VALUES = ("1", "true", "yes", "on")
COLAB_DRIVE_MOUNT = "/content/drive"
LOCAL_SQLITE_DIR_NAME = "core_node_sqlite"


def notebook_platform() -> str:
    """colab | kaggle when this process runs on a notebook node, else ''."""
    value = os.environ.get(NOTEBOOK_PLATFORM_ENV, "").strip().lower()
    return value if value in NOTEBOOK_PLATFORMS else ""


def notebook_assist_node() -> bool:
    """True when this process is a hosted notebook node (pure assist client)."""
    return bool(notebook_platform())


def local_http_enabled() -> bool:
    """True when the local RPC HTTP listener (PYCORE_HTTP_PORT) is bound."""
    override = os.environ.get(LOCAL_HTTP_ENV, "").strip().lower()
    if override:
        return override in _TRUE_VALUES
    return not notebook_assist_node()


def local_models_only() -> bool:
    """True when third-party AI/cloud services and their keys are off."""
    if notebook_platform():
        return True
    return os.environ.get(LOCAL_MODELS_ONLY_ENV, "").strip().lower() in _TRUE_VALUES


def policy_platform() -> str:
    """Name of the host that enables the policy (for reasons and logs)."""
    return notebook_platform() or LOCAL_MODELS_ONLY_PLATFORM


def local_sqlite_path(path):
    """SQLite WAL needs shared memory and POSIX locks, which the Colab Drive
    mount (FUSE) lacks: a database there turns "malformed". A database path
    under the mount maps to the VM disk; any other path is returned unchanged."""
    text = str(path).replace("\\", "/")
    if notebook_platform() != "colab" or not text.startswith(COLAB_DRIVE_MOUNT + "/"):
        return path
    relative = text[len(COLAB_DRIVE_MOUNT) + 1:]
    return os.path.join(tempfile.gettempdir(), LOCAL_SQLITE_DIR_NAME, *relative.split("/"))


__all__ = [
    "NOTEBOOK_PLATFORM_ENV", "LOCAL_MODELS_ONLY_ENV", "LOCAL_HTTP_ENV", "NOTEBOOK_PLATFORMS",
    "notebook_platform", "notebook_assist_node", "local_http_enabled",
    "local_models_only", "policy_platform", "local_sqlite_path",
]
