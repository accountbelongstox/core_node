# -*- coding: utf-8 -*-
"""
Subprocess-backed Qwen3-TTS service runner + HTTP client.

qwen-tts pins transformers==4.57.3, which conflicts with the main interpreter's
pin (parler-tts -> 4.46.x); both cannot coexist in one interpreter. So qwen-tts is
NEVER imported in-process: it runs as pycore/tts_install_assets/qwen3tts_api_server.py
inside the DEDICATED venv (see qwen3tts_venv.py) and callers talk to it over HTTP.

This module launches that subprocess, streams its stdout/stderr to a callback (so
the model-loading process is visible on the console), waits for /health, and
exposes synth calls that log the FULL HTTP request/response. Reused by the tester
(scripts/pytools/aitools/qwen3tts_tester.py) and any pycore caller that wants
isolated Qwen3-TTS synthesis.

HTTP uses the stdlib (urllib) so it has zero third-party deps and behaves the same
whether imported from the tester or from pycore.
"""

import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.isolated_venv import resolve_python as resolve_isolated_python
from pycore.pyfoundations.isolated_venv import venv_ready as isolated_venv_ready
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts import qwen3tts_weights
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
    start_bus_task,
)

_API_SERVER_ASSET = "qwen3tts_api_server.py"
_HEALTH_TIMEOUT_S = 3.0
_TEXT_PREVIEW_CHARS = 80


def _pick_free_port(host: str, start: int = 57210, tries: int = 64) -> int:
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


class Qwen3TtsService:
    """Manages the isolated Qwen3-TTS api server subprocess and talks to it over HTTP."""

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: Optional[int] = None,
        model_id: Optional[str] = None,
        device: Optional[str] = None,
        request_timeout: float = 900.0,
        on_output: Optional[Callable[[str], None]] = None,
        log: Optional[Callable[[str], None]] = None,
    ) -> None:
        self.host = host or "127.0.0.1"
        self.port = port
        self.model_id = (model_id or "").strip() or None
        self.device = (device or "").strip() or None
        self.request_timeout = request_timeout
        self._on_output = on_output or (lambda line: ColorPrint.blue(f"[qwen3tts-server] {line}"))
        self._log_cb = log or (lambda msg: ColorPrint.blue(msg))
        self._proc: Optional[subprocess.Popen] = None
        self._external = False  # connected to an already-running server, do not manage it
        self._state_queue = f'pyutils.tts.qwen3tts.service.{id(self)}'
        self._state_worker = SerializedWorkerThread(
            self._state_queue,
            f'Qwen3TtsServiceThread-{id(self)}',
        )
        self._state_worker.start()

    # ---- paths / urls ---------------------------------------------------- #
    def api_server_path(self) -> Path:
        return Path(__file__).resolve().parents[2] / "tts_install_assets" / _API_SERVER_ASSET

    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

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
        return self._proc is not None and self._proc.poll() is None

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
            venv_python = resolve_isolated_python("qwen3tts")
            if not venv_python:
                self._log(
                    "[service] isolated venv is not provisioned. Run "
                    "Step61_InstallQwen3Tts.ps1 / 140_install_qwen3tts.sh first."
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
            # cannot shadow the venv's transformers==4.57.3 with the system's 4.46.x.
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)
        env["QWEN3TTS_HOST"] = self.host
        env["QWEN3TTS_PORT"] = str(self.port)
        if self.model_id:
            env["QWEN3TTS_MODEL"] = self.model_id
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
        url = self.base_url() + path
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                raw = resp.read()
            return json.loads(raw.decode("utf-8"))
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
        req = urllib.request.Request(
            url, data=body, method="POST",
            headers={"Content-Type": "application/json", "Accept": "*/*"},
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=self.request_timeout) as resp:
                data = resp.read()
                elapsed = round((time.time() - t0) * 1000)
                ctype = resp.headers.get("Content-Type", "")
                self._log(
                    f"[http] < {resp.status} {ctype or '?'} {len(data)} bytes in {elapsed} ms"
                )
                return True, resp.status, ctype, data, elapsed
        except urllib.error.HTTPError as exc:
            data = exc.read()
            elapsed = round((time.time() - t0) * 1000)
            text = data.decode("utf-8", "replace")
            self._log(f"[http] < {exc.code} ERROR {len(data)} bytes in {elapsed} ms: {text}")
            return False, exc.code, "", data, elapsed
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

    def load_model(self, timeout: float = 1200.0) -> Dict[str, Any]:
        """Trigger model load (GET /load) so the loading process streams to console."""
        self._log("[service] warming model via /load (first load can take minutes) ...")
        info = self._get_json("/load", timeout)
        if info is None:
            return {"ok": False, "error": "load request failed or timed out"}
        self._log(f"[service] /load result: {info}")
        return info

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


def resolved_model_id() -> str:
    return qwen3tts_weights.resolve_model_id()


def venv_ready() -> bool:
    return isolated_venv_ready("qwen3tts")


__all__ = ["Qwen3TtsService", "resolved_model_id", "venv_ready"]
