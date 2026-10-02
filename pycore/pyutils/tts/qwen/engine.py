# -*- coding: utf-8 -*-
"""
Qwen3-TTS engine - HTTP client to the isolated-venv API server (class C).

qwen-tts owns transformer dependencies that may not coexist with the main
interpreter's pin (parler/bark -> 4.46.x). Therefore qwen-tts is NEVER imported
in this (main) interpreter. Instead it runs as
pycore/tts_install_assets/qwen3tts_api_server.py inside a DEDICATED venv; that
server is launched + lifecycle-managed as a class-C
service by tts_service_manager.py / managed_service.py. This module talks to it over
HTTP GET/POST for synthesis, queue control, and status probes.

See docs_fix/DESIGN_TTS_AI_RUNTIME.md §7.

Config:
  QWEN3TTS_HOST / QWEN3TTS_PORT - server bind + client target (default 0.0.0.0:57210)
  QWEN3TTS_MODEL                - HF id or local path (resolved in the server env)
  QWEN3TTS_DEVICE               - cpu | cuda:0 | auto (applied in the server env)
  QWEN3TTS_SPEAKER              - preset speaker override (per-call speaker wins)
  QWEN3TTS_INSTRUCT             - optional style/emotion instruction
  QWEN3TTS_QUEUE_MAX            - maximum active queued/running jobs
  QWEN3TTS_QUEUE_RESULT_TTL_S   - completed audio retention in seconds
"""

import base64
import hashlib
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.network_constants import TTS_HEALTH_TIMEOUT_SECONDS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.python_env.isolated_venv import venv_ready as isolated_venv_ready
from pycore.pyutils.tts.engine_policy import tts_rate_to_speed
import pycore.pyutils.tts.qwen.weights as qwen_weights
from pycore.pyutils.tts.qwen.client import (
    base_url as service_base_url,
    fetch_queue_result,
    inspect_queue_job,
    get_json as http_get_json,
    post_json as http_post_json,
    queue_submit,
    queue_submit_and_wait,
    synthesize_batch as http_synthesize_batch,
)
from pycore.pyutils.tts.qwen.config import (
    DEFAULT_PORT,
    ENGINE_NAME,
    job_text_max_chars,
    request_timeout_seconds,
)
from pycore.pyutils.tts.tts_engine import IsolatedVenvServerEngine, TTSSynthesisRequest
from pycore.pyutils.tts.tts_reason_codes import (
    TTS_REASON_VENV_NOT_BUILT,
    TTS_REASON_WEIGHTS_MISSING,
    tts_reason,
)

_HEALTH_TIMEOUT_S = TTS_HEALTH_TIMEOUT_SECONDS
ProgressCallback = Callable[[Dict[str, Any]], None]


def _fmt_for(path: Path) -> str:
    return "wav" if path.suffix.lower() == ".wav" else "mp3"


def _queue_runtime_fields(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    counts = snapshot.get("counts") if isinstance(snapshot.get("counts"), dict) else {}
    gpu = snapshot.get("gpu") if isinstance(snapshot.get("gpu"), dict) else {}
    synthesis = (
        snapshot.get("synthesis_runtime")
        if isinstance(snapshot.get("synthesis_runtime"), dict)
        else {}
    )
    capacity = (
        snapshot.get("capacity_plan")
        if isinstance(snapshot.get("capacity_plan"), dict)
        else {}
    )
    return {
        "queue_pending": int(
            counts.get("pending")
            if counts.get("pending") is not None
            else snapshot.get("queue_pending") or 0
        ),
        "queue_running": int(
            counts.get("running")
            if counts.get("running") is not None
            else snapshot.get("queue_running") or 0
        ),
        "average_elapsed_ms": int(snapshot.get("average_elapsed_ms") or 0),
        "progress_age_ms": int(snapshot.get("progress_age_ms") or 0),
        "progress_revision": int(snapshot.get("progress_revision") or 0),
        "max_parallel": int(
            snapshot.get("max_parallel") or capacity.get("batch_size") or 1
        ),
        "attention_implementation": str(
            snapshot.get("attention_implementation") or ""
        ),
        "gpu_physical_index": int(
            gpu.get("physical_index")
            if gpu.get("physical_index") is not None
            else gpu.get("index") or 0
        ),
        "gpu_name": str(gpu.get("name") or capacity.get("gpu_name") or ""),
        "gpu_compute_capability": str(
            gpu.get("compute_capability")
            or capacity.get("compute_capability")
            or ""
        ),
        "gpu_available": bool(gpu.get("available")),
        "gpu_util_percent": float(gpu.get("util_percent") or 0.0),
        "gpu_mem_used_mb": int(gpu.get("mem_used_mb") or 0),
        "gpu_mem_total_mb": int(gpu.get("mem_total_mb") or 0),
        "synthesis_phase": str(synthesis.get("phase") or "idle"),
        "synthesis_work_kind": str(synthesis.get("work_kind") or ""),
        "active_native_batch": int(
            synthesis.get("active_native_batch") or 0
        ),
        "synthesis_chunks_total": int(synthesis.get("chunks_total") or 0),
        "synthesis_chunks_completed": int(
            synthesis.get("chunks_completed") or 0
        ),
        "synthesis_running_elapsed_ms": int(
            synthesis.get("running_elapsed_ms") or 0
        ),
    }



class Qwen3TTSEngine(IsolatedVenvServerEngine):
    default_port = DEFAULT_PORT
    service_status_capable = True

    @property
    def request_timeout(self) -> float:
        return request_timeout_seconds()

    def base_url(self) -> str:
        return service_base_url()

    def disabled_reason(self) -> Optional[Any]:
        """A missing venv or missing/incomplete local weights disables the
        engine (the start command runs offline only), so no lease waits out a
        recovery budget for a server that can never start."""
        if not isolated_venv_ready(self.name):
            return tts_reason(TTS_REASON_VENV_NOT_BUILT, engine=self.name, installer=self.installer_hint())
        if not qwen_weights.local_model_ready():
            return tts_reason(TTS_REASON_WEIGHTS_MISSING, engine=self.name, installer=self.installer_hint())
        return None

    def unavailable_reason(self) -> Optional[Any]:
        return self.disabled_reason()

    def healthy(self) -> bool:
        """HTTP service reachability (GET /health ok), not queue readiness."""
        info = self.service_report()
        return bool(info and info.get("ok"))

    def _get(self, path: str, timeout: float = _HEALTH_TIMEOUT_S) -> Optional[Dict[str, Any]]:
        ok, info, _error = http_get_json(path, timeout=timeout)
        return info if ok and isinstance(info, dict) else None

    def service_report(self) -> Optional[Dict[str, Any]]:
        """Canonical lightweight lifecycle report (GET /health)."""
        return self._get("/health")

    def load_model(self, timeout: float = 1200.0) -> Optional[Dict[str, Any]]:
        return self._get("/load", timeout)

    def capabilities(self) -> Optional[Dict[str, Any]]:
        """GET /capabilities -> {languages, speakers, default_speakers}"""
        info = self._get("/capabilities")
        return info if info and info.get("ok") else None

    def status_snapshot(self) -> Optional[Dict[str, Any]]:
        """GET /status without starting or loading the managed service."""
        info = self._get("/status")
        return info if info and info.get("ok") else None

    def parallel_capacity(self) -> int:
        """The server queue's native batch size (GET /status max_parallel)."""
        snapshot = self.status_snapshot()
        return int(_queue_runtime_fields(snapshot)["max_parallel"]) if snapshot else 0

    def request_capacity_replan(self) -> None:
        """Ask a running server to re-plan its native batch (after another GPU
        engine released VRAM); a busy server re-plans when its queue drains."""
        if not self.healthy():
            return
        ok, _reply, error = http_post_json("/capacity/replan", {}, timeout=_HEALTH_TIMEOUT_S)
        if not ok:
            ColorPrint.gray(f"[qwen3tts] capacity re-plan request failed: {error}")

    def queue_healthy(self) -> bool:
        snapshot = self.status_snapshot()
        return bool(snapshot and snapshot.get("consumer_running") is True and not snapshot.get("stalled"))

    def active_model_id(self) -> str:
        """Canonical id of the model the managed server actually loaded.

        Prefers the live server's /status report (that process synthesizes the
        audio, so it is the strict backend truth); falls back to the same
        resolver the managed launcher used, with the local staging weights path
        normalized back to its verified HF repository id."""
        resolved = str((self.status_snapshot() or {}).get("model_id") or "").strip()
        if not resolved:
            resolved = qwen_weights.resolve_model_id(allow_remote=False)
        if not resolved:
            resolved = runtime_engine_model(self.name)
        repo_id = qwen_weights.sentinel_model_id()
        if repo_id and resolved == str(qwen_weights.staging_dir() / "weights"):
            return repo_id
        return resolved

    @staticmethod
    def effective_speed(rate: Optional[str]) -> Optional[float]:
        """Resolve a caller rate hint into an explicit speed factor. None (no
        rate given) stays None on the wire: the server applies its own default
        (QWEN3TTS_SPEED, single-sourced through pyfoundations.network_constants)."""
        raw = (rate or "").strip()
        return tts_rate_to_speed(raw) if raw else None

    @staticmethod
    def queued_synthesis_request(
        text: str,
        lang: str,
        output_path: Path,
        speed: Optional[float] = None,
        speaker: Optional[str] = None,
        instruct: Optional[str] = None,
        client_job_id: Optional[str] = None,
    ) -> tuple:
        """The canonical idempotent queue payload and client identity."""
        cleaned = (text or "").strip()
        output = Path(output_path)
        normalized_speaker = str(speaker or "").strip()
        normalized_instruct = str(instruct or "").strip()
        speed_key = f"{float(speed):g}" if speed is not None else "default"
        identity = "\x1f".join((
            cleaned, lang or "en", _fmt_for(output), normalized_speaker, normalized_instruct, speed_key,
        ))
        stable_id = str(client_job_id or "").strip() or (
            f"qwen3tts-{hashlib.sha256(identity.encode('utf-8')).hexdigest()}"
        )
        payload: Dict[str, Any] = {
            "text": cleaned,
            "language": lang or "en",
            "format": _fmt_for(output),
            "speed": speed,
        }
        if normalized_speaker:
            payload["speaker"] = normalized_speaker
        if normalized_instruct:
            payload["instruct"] = normalized_instruct
        return payload, stable_id

    def submit_queued_synthesis(
        self,
        text: str,
        lang: str,
        output_path: Path,
        speed: Optional[float] = None,
        speaker: Optional[str] = None,
        instruct: Optional[str] = None,
        client_job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit one idempotent job and return immediately with queue state."""
        payload, stable_id = self.queued_synthesis_request(
            text, lang, output_path, speed, speaker, instruct, client_job_id,
        )
        if not payload["text"]:
            return {"ok": False, "error": "empty text", "client_job_id": stable_id}
        max_chars = job_text_max_chars()
        if len(payload["text"]) > max_chars:
            return {
                "ok": False,
                "error": f"qwen3tts job text is {len(payload['text'])} chars (limit {max_chars})",
                "client_job_id": stable_id,
            }
        payload["client_job_id"] = stable_id
        ok, job, error = queue_submit(payload, timeout=30.0)
        if not ok or not isinstance(job, dict):
            return {"ok": False, "error": error or "queue submit failed", "client_job_id": stable_id}
        return {"ok": True, "client_job_id": stable_id, **job, **_queue_runtime_fields(job)}

    @staticmethod
    def poll_queued_synthesis(job_id: str, client_job_id: str) -> Dict[str, Any]:
        """Read one queue job without waiting for it to finish."""
        job, snapshot = inspect_queue_job(job_id, client_job_id, timeout=_HEALTH_TIMEOUT_S)
        if job is None:
            return {
                "ok": False,
                "missing": True,
                "job_id": job_id,
                "client_job_id": client_job_id,
                "error": "queued synthesis job not found",
            }
        return {"ok": True, "client_job_id": client_job_id, **job, **_queue_runtime_fields(snapshot)}

    @staticmethod
    def fetch_queued_synthesis(job_id: str) -> tuple:
        """Fetch retained bytes after the job was observed in the done state."""
        return fetch_queue_result(job_id)

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        """Queue one Pycore synthesis and write its retained audio result.

        Speed policy lives with the engine: an explicit rate hint resolves to a
        speed factor; no hint forwards None so the server applies its own
        default. The standalone Qwen console keeps ``POST /synthesize`` as its
        interactive fast path; Pycore work uses the queue so GPU concurrency,
        cancellation, status and HTTP event reporting share one lifecycle."""
        return self.synthesize_queued(
            request.text,
            request.language,
            Path(request.output_path),
            client_job_id=request.client_job_id,
            speaker=request.speaker,
            instruct=(request.instruct or os.environ.get("QWEN3TTS_INSTRUCT") or ""),
            speed=self.effective_speed(request.rate),
            progress_callback=request.progress_callback,
        )

    def synthesize_queued(
        self,
        text: str,
        lang: str,
        output_path: Path,
        client_job_id: Optional[str] = None,
        speaker: Optional[str] = None,
        instruct: Optional[str] = None,
        speed: Optional[float] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> bool:
        """Submit through the FIFO service queue, long poll, and write audio."""
        self.clear_error()
        cleaned = (text or "").strip()
        if not cleaned:
            return self.fail("empty text")
        max_chars = job_text_max_chars()
        if len(cleaned) > max_chars:
            return self.fail(f"qwen3tts job text is {len(cleaned)} chars (limit {max_chars})")
        output = Path(output_path)
        payload, stable_id = self.queued_synthesis_request(
            cleaned, lang, output, speed, speaker, instruct, client_job_id,
        )
        ok, audio, error = queue_submit_and_wait(payload, stable_id, progress_callback=progress_callback)
        if not ok or not audio:
            return self.fail(error or "qwen3tts queued synthesis failed")
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(audio)
        except OSError as exc:
            return self.fail(f"write {output} failed: {exc}")
        return True

    def synthesize_variants(
        self,
        text: str,
        lang: str,
        variants: List[Dict[str, Any]],
        out_paths: List[Path],
    ) -> List[bool]:
        """POST /synthesize_batch (one server call generating N voice variants
        at the GPU's max parallel speed), decode each result and write the
        files in order. One bool per variant (index-aligned)."""
        self.clear_error()
        cleaned = (text or "").strip()
        n = min(len(variants), len(out_paths))
        results = [False] * max(n, 0)
        if not cleaned or n == 0:
            self.fail("empty text" if not cleaned else "no variants")
            return results
        wire_variants = [
            {
                "key": str((variants[i] or {}).get("key") or f"v{i}"),
                "accent": (variants[i] or {}).get("accent"),
                "gender": (variants[i] or {}).get("gender") or "female",
            }
            for i in range(n)
        ]
        # The server applies ONE format to the whole batch; take it from the first path.
        payload = {
            "text": cleaned, "language": lang or "en", "variants": wire_variants,
            "format": _fmt_for(Path(out_paths[0])),
        }
        ok, body, err = http_synthesize_batch(payload, timeout=self.request_timeout)
        if not ok or not isinstance(body, dict):
            self.fail(err or "qwen3tts batch failed")
            return results
        rows = body.get("results")
        if not isinstance(rows, list):
            self.fail("malformed batch response")
            return results
        for i in range(n):
            row = rows[i] if i < len(rows) else None
            if not isinstance(row, dict) or not row.get("ok") or not row.get("audio_base64"):
                continue
            try:
                audio = base64.b64decode(row["audio_base64"])
                path = Path(out_paths[i])
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(audio)
            except (ValueError, OSError) as exc:
                ColorPrint.yellow(f"[qwen3tts] variant {i} write to {out_paths[i]} failed: {exc}")
                continue
            results[i] = bool(audio)
        if not all(results):
            self._last_synth_error.set("one or more Qwen3-TTS variants failed")
        return results


qwen_engine = Qwen3TTSEngine(ENGINE_NAME)


__all__ = ["Qwen3TTSEngine", "qwen_engine"]
