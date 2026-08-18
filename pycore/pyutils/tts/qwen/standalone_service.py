# -*- coding: utf-8 -*-
"""
Subprocess-backed Qwen3-TTS service runner + HTTP client.

qwen-tts owns transformer dependencies that may conflict with the main interpreter's
pin (parler-tts -> 4.46.x); both cannot coexist in one interpreter. So qwen-tts is
NEVER imported in-process: it runs as pycore/tts_install_assets/qwen3tts_api_server.py
inside the DEDICATED venv and callers talk to it over HTTP.

This module launches that subprocess, streams its stdout/stderr to a callback (so
the model-loading process is visible on the console), waits for /health, and
exposes synth calls that log the FULL HTTP request/response. It is used only by
scripts/pytools/aitools/qwen3tts_tester.py; production lifecycle belongs to
tts_service_manager.

HTTP uses the shared stdlib client so it has zero third-party dependencies.
"""

import json
import os
import socket
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
    start_bus_task,
)
from pycore.pyutils.common.http_client import build_http_base_url
from pycore.pyutils.common.python_env.isolated_venv import resolve_python as resolve_isolated_python
import pycore.pyutils.tts.qwen.weights as qwen_weights
from pycore.pyutils.tts.qwen.client import (
    request as http_request,
)
from pycore.pyutils.tts.qwen.config import (
    DEFAULT_HOST,
    DEFAULT_PORT,
    ENGINE_NAME,
    INSTALL_HINT,
    api_server_path,
)

_HEALTH_TIMEOUT_S = 3.0
_TEXT_PREVIEW_CHARS = 80


def _pick_free_port(host: str, start: int = DEFAULT_PORT, tries: int = 64) -> int:
    for offset in range(tries):
        port = start + offset
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host, port))
            return port
        except OSError:
            continue
        finally:
            probe.close()
    return start


class QwenStandaloneService:
    """Manages the isolated Qwen3-TTS api server subprocess and talks to it over HTTP."""

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: Optional[int] = None,
        model_id: Optional[str] = None,
        device: Optional[str] = None,
        request_timeout: float = 900.0,
        on_output: Optional[Callable[[str], None]] = None,
        log: Optional[Callable[[str], None]] = None,
    ) -> None:
        resolved_model_id = (
            (model_id or "").strip()
            or qwen_weights.resolve_model_id(allow_remote=False)
        )
        self.host = host or DEFAULT_HOST
        self.port = port
        # Always pass the canonical local weights path when the installer has
        # verified it. Falling back to the server's HF default would download
        # a second model copy into the isolated environment's HF cache.
        self.model_id = resolved_model_id or None
        self.device = (device or "").strip() or None
        self.request_timeout = request_timeout
        self._on_output = on_output or (lambda line: ColorPrint.blue(f"[qwen3tts-server] {line}"))
        self._log_cb = log or (lambda msg: ColorPrint.blue(msg))
        self._proc: Optional[subprocess.Popen] = None
        self._external = False  # connected to an already-running server, do not manage it
        self._state_queue = f'pyutils.tts.qwen3tts.service.{id(self)}'
        self._state_worker = SerializedWorkerThread(
            self._state_queue,
            f'QwenStandaloneServiceThread-{id(self)}',
        )
        self._state_worker.start()

    # ---- paths / urls ---------------------------------------------------- #
    def api_server_path(self) -> Path:
        return api_server_path()

    def base_url(self) -> str:
        return build_http_base_url(self.host, int(self.port or DEFAULT_PORT))

    def _log(self, msg: str) -> None:
        self._log_cb(msg)

    # ---- lifecycle ------------------------------------------------------- #
    def is_running(self) -> bool:
        """Read lifecycle state through the service-owner thread."""
        return call_serialized(self._state_queue, self._is_running)

    def _is_running(self) -> bool:
        """Read lifecycle state on the service-owner thread."""
        if self._external:
            return self.health() is not None
        if self._proc is not None and self._proc.poll() is None:
            return True
        if self.port is not None and self.health() is not None:
            self._external = True
            return True
        return False

    def start(self, wait_healthy: bool = True, timeout: float = 180.0) -> bool:
        """Launch the api server in the isolated venv (idempotent). If host:port is
        already answering /health, attach to it instead of spawning a duplicate."""
        return call_serialized(
            self._state_queue,
            self._start,
            wait_healthy,
            timeout,
            timeout=max(300.0, timeout + 120.0),
        )

    def _start(self, wait_healthy: bool, health_timeout: float) -> bool:
        """Start the subprocess on the service-owner thread."""
        if self._is_running():
            return True

        if self.port is not None and self.health() is not None:
            self._external = True
            self._log(f"[service] attaching to existing api server at {self.base_url()}")
            return True

        self._log("[service] resolving the pre-built isolated venv...")
        venv_python = resolve_isolated_python(ENGINE_NAME)
        if not venv_python:
            self._log(
                "[service] isolated venv is not provisioned. Run "
                f"{INSTALL_HINT} first."
            )
            return False

        script = self.api_server_path()
        if not script.is_file():
            self._log(f"[service] api server asset missing: {script}")
            return False

        if self.port is None:
            self.port = _pick_free_port(self.host)

        env = dict(os.environ)
        # The api server is standalone (no pycore imports). Drop any inherited
        # PYTHONPATH/PYTHONHOME so a leaked main-interpreter site-packages entry
        # cannot shadow the venv's transformer dependencies with the system stack.
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)
        env["QWEN3TTS_HOST"] = self.host
        env["QWEN3TTS_PORT"] = str(self.port)
        if self.model_id:
            env["QWEN3TTS_MODEL"] = self.model_id
            if Path(self.model_id).is_dir():
                # Step61 owns downloads. Runtime consumes the verified local
                # store and must not create a second Hugging Face cache.
                env["HF_HUB_OFFLINE"] = "1"
                env["TRANSFORMERS_OFFLINE"] = "1"
        if self.device:
            env["QWEN3TTS_DEVICE"] = self.device
        env["PYTHONUNBUFFERED"] = "1"

        self._log(f"[service] launching isolated api server: {venv_python} {script}")
        self._log(
            f"[service] bind={self.host}:{self.port} "
            f"model={self.model_id or 'default'} device={self.device or 'auto'}"
        )
        self._proc = subprocess.Popen(
            [venv_python, str(script)],
            cwd=str(script.parent),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        start_bus_task(
            self._pump_output,
            self._proc,
            thread_name="Qwen3TtsOutputThread",
        )

        if wait_healthy:
            return self._wait_healthy(health_timeout)
        return True

    def _pump_output(self, proc: subprocess.Popen) -> None:
        if proc is None or proc.stdout is None:
            return
        for line in proc.stdout:
            self._on_output(line.rstrip("\r\n"))
        self._log(f"[service] api server output stream closed (exit={proc.poll()})")

    def wait_healthy(self, timeout: float = 180.0) -> bool:
        """Wait for health through the service-owner thread."""
        return call_serialized(
            self._state_queue,
            self._wait_healthy,
            timeout,
            timeout=max(30.0, timeout + 10.0),
        )

    def _wait_healthy(self, timeout: float = 180.0) -> bool:
        """Wait for health on the service-owner thread."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not self._external and self._proc is not None and self._proc.poll() is not None:
                self._log(f"[service] api server exited early (code {self._proc.returncode})")
                return False
            info = self.health()
            if info is not None:
                self._log(f"[service] health OK: {info}")
                return True
            time.sleep(0.5)
        self._log(f"[service] health timed out after {timeout:.0f}s")
        return False

    def stop(self) -> None:
        """Stop the subprocess through the service-owner thread."""
        call_serialized(self._state_queue, self._stop, timeout=30.0)

    def _stop(self) -> None:
        """Stop the subprocess on the service-owner thread."""
        proc = self._proc
        self._proc = None
        if self._external or proc is None:
            return
        try:
            proc.terminate()
            try:
                proc.wait(timeout=8.0)
            except subprocess.TimeoutExpired:
                proc.kill()
            self._log("[service] api server stopped")
        except Exception as exc:  # noqa: BLE001
            self._log(f"[service] stop failed: {exc}")

    # ---- HTTP ------------------------------------------------------------ #
    def _preview(self, payload: Dict[str, Any]) -> str:
        shown = dict(payload)
        text = str(shown.get("text") or "")
        if len(text) > _TEXT_PREVIEW_CHARS:
            shown["text"] = text[:_TEXT_PREVIEW_CHARS] + f"... ({len(text)} chars)"
        return json.dumps(shown, ensure_ascii=False)

    def _get_json(self, path: str, timeout: float) -> Optional[Dict[str, Any]]:
        try:
            status, _headers, data, error = http_request(
                "GET",
                path,
                timeout=timeout,
                service_base_url=self.base_url(),
            )
            payload = json.loads(data.decode("utf-8")) if data else {}
            return (
                payload
                if error is None and 200 <= status < 300 and isinstance(payload, dict)
                else None
            )
        except Exception:  # noqa: BLE001
            return None

    def _post(
        self, path: str, payload: Dict[str, Any]
    ) -> Tuple[bool, int, str, bytes, int]:
        """POST JSON; return (ok, status, content_type, body_bytes, elapsed_ms). Logs
        the full request line, body preview, and response summary."""
        url = self.base_url() + path
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._log(f"[http] > POST {url}  ({len(body)} bytes)")
        self._log(f"[http] > json: {self._preview(payload)}")
        t0 = time.time()
        try:
            status, headers, data, error = http_request(
                "POST",
                path,
                json_body=payload,
                timeout=self.request_timeout,
                service_base_url=self.base_url(),
            )
            elapsed = round((time.time() - t0) * 1000)
            ctype = headers.get("Content-Type", "")
            if error is None and 200 <= status < 300:
                self._log(
                    f"[http] < {status} {ctype or '?'} "
                    f"{len(data)} bytes in {elapsed} ms"
                )
                return True, status, ctype, data, elapsed
            detail = error or data.decode("utf-8", "replace")
            self._log(
                f"[http] < {status} ERROR {len(data)} bytes "
                f"in {elapsed} ms: {detail}"
            )
            return False, status, ctype, data, elapsed
        except Exception as exc:  # noqa: BLE001
            elapsed = round((time.time() - t0) * 1000)
            self._log(f"[http] < request failed in {elapsed} ms: {exc}")
            return False, 0, "", b"", elapsed

    @staticmethod
    def _json_error(data: bytes) -> str:
        try:
            parsed = json.loads(data.decode("utf-8"))
            if isinstance(parsed, dict) and parsed.get("error"):
                return str(parsed["error"])
        except Exception:  # noqa: BLE001
            pass
        return data.decode("utf-8", "replace") if data else "request failed"

    # ---- API ------------------------------------------------------------- #
    def health(self) -> Optional[Dict[str, Any]]:
        return self._get_json("/health", _HEALTH_TIMEOUT_S)

    def get_capabilities(self) -> Optional[Dict[str, Any]]:
        return self._get_json("/capabilities", _HEALTH_TIMEOUT_S)

    def load_model(self, force_reload: bool = False, timeout: float = 1200.0) -> Dict[str, Any]:
        """Trigger model load (GET /load) so the loading process streams to console."""
        if force_reload:
            self.stop()
            self._external = False
            if not self.start(wait_healthy=False):
                return {"ok": False, "error": "failed to restart api server for reload"}
        self._log("[service] warming model via /load (first load can take minutes) ...")
        info = self._get_json("/load", timeout)
        if info is None:
            return {"ok": False, "error": "load request failed or timed out"}
        self._log(f"[service] /load result: {info}")
        return info

    def model_status(self) -> Dict[str, Any]:
        """Return process health and capability summary without side effects."""
        health = self.health() or {}
        capabilities = self.get_capabilities() or {}
        return {
            "running": self.is_running(),
            "base_url": self.base_url() if self.port is not None else None,
            "health": health,
            "capabilities": capabilities,
        }

    def synthesize(
        self,
        text: str,
        language: str = "en",
        speaker: Optional[str] = None,
        instruct: Optional[str] = None,
        fmt: str = "wav",
    ) -> Tuple[bool, bytes, Dict[str, Any]]:
        payload: Dict[str, Any] = {"text": text, "language": language, "format": fmt}
        if (speaker or "").strip():
            payload["speaker"] = speaker
        if (instruct or "").strip():
            payload["instruct"] = instruct
        ok, status, ctype, data, elapsed = self._post("/synthesize", payload)
        meta: Dict[str, Any] = {
            "status": status, "content_type": ctype, "bytes": len(data),
            "elapsed_ms": elapsed, "format": fmt,
        }
        if ok and data:
            return True, data, meta
        meta["error"] = self._json_error(data)
        return False, b"", meta

    def synthesize_batch(
        self,
        text: str,
        language: str,
        variants: List[Dict[str, Any]],
        fmt: str = "wav",
    ) -> Tuple[bool, List[Dict[str, Any]], Dict[str, Any]]:
        payload = {"text": text, "language": language, "variants": variants, "format": fmt}
        ok, status, ctype, data, elapsed = self._post("/synthesize_batch", payload)
        meta = {"status": status, "elapsed_ms": elapsed, "format": fmt}
        if not ok:
            meta["error"] = self._json_error(data)
            return False, [], meta
        try:
            parsed = json.loads(data.decode("utf-8"))
            results = parsed.get("results") if isinstance(parsed, dict) else None
            if not isinstance(results, list):
                meta["error"] = "malformed batch response"
                return False, [], meta
            return True, results, meta
        except Exception as exc:  # noqa: BLE001
            meta["error"] = str(exc)
            return False, [], meta


__all__ = [
    "QwenStandaloneService",
]
