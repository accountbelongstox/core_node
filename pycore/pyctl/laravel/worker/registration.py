# -*- coding: utf-8 -*-
"""Worker identity and its server-side registration (register = heartbeat)."""

import re
import socket
import time
from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_LIMITS, queue_center_endpoint
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.model_tiers import gpu_present
from pycore.pyutils.common.service_config import PYCORE_WORKER_INSTANCE
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyctl.laravel.worker.host import LaravelWorkerHost

# The register route marks the worker row online; refreshing at a third of
# the contract heartbeat TTL keeps it from ageing offline. A forced
# re-register (accept-404 self-heal) is rate-limited so a draining mirror
# cannot flood it.
WORKER_REGISTER_REFRESH_SECONDS = float(GLOBAL_TASK_LIMITS["worker_heartbeat_ttl_seconds"]) / 3.0
WORKER_REGISTER_RETRY_SECONDS = 10.0
COMPUTE_CLASS_GPU = "gpu"
COMPUTE_CLASS_CPU_ONLY = "cpu_only"


def _slug(value: str) -> str:
    return "".join(c if (c.isalnum() or c in "-_") else "-" for c in value).lower()


def build_worker_id(prefix: str) -> str:
    """Stable hostname-based worker id. Two pycore processes on one host set
    PYCORE_WORKER_INSTANCE to a stable per-instance tag, appended here."""
    base = f"{str(prefix or 'pycore-worker').strip().rstrip('-')}-{_slug(socket.gethostname() or 'host')}"
    instance = PYCORE_WORKER_INSTANCE.strip()
    return f"{base}-{_slug(instance)}" if instance else base


def detect_compute_identity() -> Dict[str, Any]:
    """Compute class Laravel schedules by (detection only; never changes a
    runtime GPU/CPU decision). The class comes from ``model_tiers.gpu_present``,
    the same check the TTS runtime profile uses; CUDADetector only supplies
    the GPU name and VRAM details."""
    if not gpu_present():
        return {"compute_class": COMPUTE_CLASS_CPU_ONLY, "gpu_name": None, "gpu_vram_mb": None}
    gpus = CUDADetector.get_cuda_info().get("gpus") or []
    first = gpus[0] if gpus else {}
    vram = re.match(r"\s*(\d+)", str(first.get("memory_total") or ""))
    return {
        "compute_class": COMPUTE_CLASS_GPU,
        "gpu_name": str(first.get("name") or "") or None,
        "gpu_vram_mb": int(vram.group(1)) if vram else None,
    }


class WorkerRegistration:
    """Establish and refresh the worker row of the active Laravel route."""

    def __init__(self, host: LaravelWorkerHost) -> None:
        self._host = host
        self.registered = False
        self._registered_at = 0.0
        self._base_url = ""

    def reset(self) -> None:
        self.registered = False
        self._registered_at = 0.0

    def ensure(self, base_url: str, force: bool = False) -> bool:
        """Full-sync lanes never run the claim-pull whose inline register is
        the only other identity refresh, so diff/accept/result all depend on
        this call; ``force`` is the accept-404 self-heal."""
        if base_url != self._base_url:
            self._base_url = base_url
            self.reset()
        elapsed = time.monotonic() - self._registered_at
        if not force and self.registered and elapsed < WORKER_REGISTER_REFRESH_SECONDS:
            return True
        if force and elapsed < WORKER_REGISTER_RETRY_SECONDS:
            return self.registered
        try:
            response = laravel_client.post(
                queue_center_endpoint("worker_register"),
                base_url=base_url,
                json=self._host.identity_params(),
            )
        except OSError as exc:
            ColorPrint.gray(f"{self._host.log_prefix} Worker register unreachable at {base_url}: {redacted_http_error(exc)}")
            return self.registered
        self._registered_at = time.monotonic()
        if response.status_code in (200, 201):
            if not self.registered:
                ColorPrint.green(
                    f"{self._host.log_prefix} Worker identity registered with Laravel ({self._host.worker_id})"
                )
            self.registered = True
            return True
        self.registered = False
        ColorPrint.yellow(f"{self._host.log_prefix} Worker register failed: HTTP {response.status_code}")
        return False
