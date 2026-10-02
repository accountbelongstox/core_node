# -*- coding: utf-8 -*-
"""Worker identity and its server-side registration (register = heartbeat)."""

import re
import socket
import time
from typing import Any, Dict, Optional, Set

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.diff_task_segments import diff_task_segment_store
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_LIMITS, queue_center_endpoint
from pycore.pyutils.common.http_client import RESPONSE_CONTROL, redacted_http_error
from pycore.pyutils.common.model_tiers import gpu_present
from pycore.pyutils.common.relay_identity import relay_device_identity
from pycore.pyutils.common.service_config import PYCORE_WORKER_INSTANCE
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.worker_results import worker_result_channel
from pycore.pyctl.laravel.worker.host import LaravelWorkerHost

# The register route marks the worker row online; refreshing at a third of
# the contract heartbeat TTL keeps it from ageing offline. A forced
# re-register (accept-404 self-heal) is rate-limited so a draining mirror
# cannot flood it.
WORKER_REGISTER_REFRESH_SECONDS = float(GLOBAL_TASK_LIMITS["worker_heartbeat_ttl_seconds"]) / 3.0
WORKER_REGISTER_RETRY_SECONDS = 10.0
NODE_ID_CHARS = 12
COMPUTE_CLASS_GPU = "gpu"
COMPUTE_CLASS_CPU_ONLY = "cpu_only"
COMPUTE_RECHECK_SECONDS = 60.0


def _slug(value: str) -> str:
    return "".join(c if (c.isalnum() or c in "-_") else "-" for c in value).lower()


def _with_instance(base: str) -> str:
    """Two pycore processes on one node set PYCORE_WORKER_INSTANCE to a
    stable per-instance tag, appended here."""
    instance = PYCORE_WORKER_INSTANCE.strip()
    return f"{base}-{_slug(instance)}" if instance else base


def _prefix(prefix: str) -> str:
    return str(prefix or "pycore-worker").strip().rstrip("-")


def build_worker_id(prefix: str) -> str:
    """Worker id stable per node: derived from the node's persisted relay
    device id (``CORE_NODE_DATA_DIR/config``), which survives notebook VM
    restarts where the hostname changes; one identity per node."""
    node = relay_device_identity.device_id().replace("-", "")[:NODE_ID_CHARS]
    return _with_instance(f"{_prefix(prefix)}-{node}")


def legacy_worker_id(prefix: str) -> str:
    """The former hostname-based id, unregistered once per process."""
    return _with_instance(f"{_prefix(prefix)}-{_slug(socket.gethostname() or 'host')}")


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


class ComputeIdentityProbe:
    """Compute identity of the node. A GPU verdict is kept; a cpu_only verdict
    is re-detected (detector cache reset) at most every COMPUTE_RECHECK_SECONDS,
    so a node whose CUDA torch or driver became ready after startup (a notebook
    runtime) reports gpu from its next claim on."""

    def __init__(self) -> None:
        self._identity = detect_compute_identity()
        self._checked_at = time.monotonic()

    def current(self) -> Dict[str, Any]:
        if self._identity["compute_class"] != COMPUTE_CLASS_GPU and time.monotonic() - self._checked_at >= COMPUTE_RECHECK_SECONDS:
            CUDADetector.reset_cache()
            self._identity = detect_compute_identity()
            self._checked_at = time.monotonic()
        return self._identity


class RegistrationState:
    """Registration bookkeeping on a THREAD_BUS owner: pull, drain (accept
    self-heal) and endpoint-change threads all reach it."""

    def __init__(self, name: str) -> None:
        self._registered = False
        self._registered_at = 0.0
        self._base_url = ""
        self._legacy_retired: Set[str] = set()
        self._legacy_scopes_forgotten = False
        self._legacy_wait_logged = False
        init_serialized_owner(self, f"laravel.worker.registration.{name}", f"{name}RegistrationThread")

    @serialized_method
    def reset(self) -> None:
        self._registered = False
        self._registered_at = 0.0

    @serialized_method
    def registered(self) -> bool:
        return self._registered

    @serialized_method
    def due(self, base_url: str, force: bool) -> Optional[bool]:
        """None when a register POST is due now, else the current answer."""
        if base_url != self._base_url:
            self._base_url = base_url
            self._registered = False
            self._registered_at = 0.0
        elapsed = time.monotonic() - self._registered_at
        if not force and self._registered and elapsed < WORKER_REGISTER_REFRESH_SECONDS:
            return True
        if force and elapsed < WORKER_REGISTER_RETRY_SECONDS:
            return self._registered
        return None

    @serialized_method
    def heartbeat(self, base_url: str) -> None:
        """A claim or renew already refreshed the worker row server-side:
        the next register POST is not due until a full refresh period passes."""
        if self._registered and base_url == self._base_url:
            self._registered_at = time.monotonic()

    @serialized_method
    def record(self, ok: Optional[bool]) -> bool:
        """Store one register outcome (None = unreachable, keeps the state);
        True on the unregistered -> registered transition."""
        if ok is None:
            return False
        self._registered_at = time.monotonic()
        renewed = ok and not self._registered
        self._registered = bool(ok)
        return renewed

    @serialized_method
    def legacy_pending(self, base_url: str) -> bool:
        return base_url not in self._legacy_retired

    @serialized_method
    def legacy_wait_first(self) -> bool:
        first = not self._legacy_wait_logged
        self._legacy_wait_logged = True
        return first

    @serialized_method
    def legacy_retired(self, base_url: str) -> bool:
        """Mark one server done; True the first time any server finished
        (the retired id's diff scopes are dropped once)."""
        self._legacy_retired.add(base_url)
        first = not self._legacy_scopes_forgotten
        self._legacy_scopes_forgotten = True
        return first


class WorkerRegistration:
    """Establish and refresh the worker row of the active Laravel route."""

    def __init__(self, host: LaravelWorkerHost, name: str) -> None:
        self._host = host
        self._state = RegistrationState(name)

    def reset(self) -> None:
        self._state.reset()

    @property
    def registered(self) -> bool:
        return self._state.registered()

    def heartbeat(self, base_url: str) -> None:
        self._state.heartbeat(base_url)

    def ensure(self, base_url: str, force: bool = False) -> bool:
        """Full-sync lanes never run the claim-pull whose inline register is
        the only other identity refresh, so diff/accept/result all depend on
        this call; ``force`` is the accept-404 self-heal."""
        answer = self._state.due(base_url, force)
        if answer is not None:
            return answer
        try:
            response = laravel_client.post(
                queue_center_endpoint("worker_register"),
                base_url=base_url,
                json=self._host.identity_params(), response=RESPONSE_CONTROL,
            )
        except OSError as exc:
            ColorPrint.gray(f"{self._host.log_prefix} Worker register unreachable at {base_url}: {redacted_http_error(exc)}")
            return self._state.registered()
        ok = response.status_code in (200, 201)
        if self._state.record(ok):
            ColorPrint.green(f"{self._host.log_prefix} Worker identity registered with Laravel ({self._host.worker_id})")
            self._host.registration_renewed()
        if not ok:
            ColorPrint.yellow(f"{self._host.log_prefix} Worker register failed: HTTP {response.status_code}")
            return False
        self._retire_legacy_id(base_url)
        return True

    def _retire_legacy_id(self, base_url: str) -> None:
        """Migration from the former hostname-based id. Results of the old id
        still waiting in the outbox deliver first under the worker id and
        claim they carry; only then is the old row unregistered (once per
        server and process; a 404 means it is already gone) and its staged
        diff scopes dropped. Re-checked on every registration refresh."""
        legacy = legacy_worker_id(self._host.WORKER_ID_PREFIX)
        if legacy == self._host.worker_id or not self._state.legacy_pending(base_url):
            return
        if worker_result_channel.has_pending_results(legacy):
            if self._state.legacy_wait_first():
                ColorPrint.gray(f"{self._host.log_prefix} legacy worker id {legacy} kept until its pending results deliver")
            return
        try:
            response = laravel_client.post(
                queue_center_endpoint("worker_unregister"), base_url=base_url, json={"worker_id": legacy}, response=RESPONSE_CONTROL,
            )
        except OSError as exc:
            ColorPrint.gray(f"{self._host.log_prefix} legacy worker id {legacy} not retired: {redacted_http_error(exc)}")
            return
        if response.status_code not in (200, 404):
            return
        if response.status_code == 200:
            ColorPrint.blue(f"{self._host.log_prefix} retired legacy worker id {legacy} -> {self._host.worker_id}")
        if self._state.legacy_retired(base_url) and diff_task_segment_store.forget_worker_scopes(legacy):
            ColorPrint.blue(f"{self._host.log_prefix} dropped diff scopes of retired worker id {legacy}")
