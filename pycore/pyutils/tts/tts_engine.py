# -*- coding: utf-8 -*-
"""TTS engine class hierarchy.

``TTSEngine`` derives install, boot and availability views from the manifest
``ModelEntry`` readiness fields. ``HttpServerEngine`` is the base of every
managed local HTTP server (one base URL convention, one TTL health cache, one
POST path, one audio writer); ``IsolatedVenvServerEngine`` is a server whose
readiness is its per-engine venv. ``SerializedModelEngine`` owns an
in-process model on a serialized worker thread. Engines are subclasses that
declare only their differences.
"""

import os
import time
from contextvars import copy_context
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.network_constants import (
    HTTP_LOOPBACK_HOST,
    TTS_AVAILABILITY_TTL_SECONDS,
    TTS_HEALTH_TIMEOUT_SECONDS,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_manager import get_secret_key_indexed
from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyfoundations.system_paths import get_local_data_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.engine_registry import EngineAdapter
from pycore.pyutils.common.managed_service_process import release_gpu_memory
from pycore.pyutils.common.model_checks import module_present, packages_check
from pycore.pyutils.common.model_manifest import (
    BOOT_READY,
    CATEGORY_TTS,
    RUNTIME_SERVER,
    BootVerdict,
    blocked,
    deferred,
    ready,
)
import pycore.pyutils.common.python_env.isolated_venv as isolated_venv
from pycore.pyutils.common.python_env.runtime_policy import base_interpreter_compatibility
from pycore.pyutils.tts.audio_utils import wav_to_mp3
from pycore.pyutils.tts.memory_gate import memory_gate_allows
# Registers every TTS ModelEntry before any engine instance resolves its entry.
import pycore.pyutils.tts.tts_manifest  # noqa: F401
from pycore.pyutils.tts.tts_http import (
    TTS_UNREACHABLE,
    TtsHttpReply,
    tts_get,
    tts_post,
)
from pycore.pyutils.tts.tts_reason_codes import (
    TTS_INSTALL_HINT_GENERIC,
    TTS_REASON_BASE_PYTHON_UNAVAILABLE,
    TTS_REASON_MEMORY_GATE,
    TTS_REASON_MODEL_NOT_FOUND,
    TTS_REASON_NOT_INSTALLED,
    TTS_REASON_PACKAGE_MISSING,
    TTS_REASON_SECRET_REQUIRED,
    TTS_REASON_SERVER_NOT_RUNNING,
    TTS_REASON_SETTING_REQUIRED,
    TTS_REASON_VENV_NOT_BUILT,
    TTS_REASON_VENV_NOT_BUILT_BASE_READY,
    tts_reason,
)

DEFAULT_MODEL_OPERATION_TIMEOUT = 900.0
# Managed-service health probe (connect, read) and availability probe timeouts.
_MANAGED_HEALTH_TIMEOUT_S = (1.0, 2.0)
_AVAILABILITY_TIMEOUT_S = 2.0
AUDIO_CTYPE = "ctype"
AUDIO_CTYPE_OR_MP3_TARGET = "ctype_or_mp3_target"
AUDIO_RAW = "raw"
AUDIO_WAV_TARGET = "wav_target"
_MARKER_PACKAGES = "packages"
_MARKER_VENV = "venv"
_MARKER_DEPS = "deps"
_TOKEN_MARKERS = frozenset({_MARKER_PACKAGES, _MARKER_VENV, _MARKER_DEPS})


@dataclass(frozen=True)
class TTSSynthesisRequest:
    text: str
    language: str
    output_path: Path
    speed: float = 1.0
    locale: str = ""
    rate: Optional[str] = None
    accent: Optional[str] = None
    gender: Optional[str] = None
    speaker: Optional[str] = None
    instruct: Optional[str] = None
    client_job_id: Optional[str] = None
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    volume: Optional[str] = None
    pitch: Optional[str] = None


def text_request(text: str, language: str, output_path: Path, speed: float = 1.0) -> TTSSynthesisRequest:
    return TTSSynthesisRequest(text=text, language=language or "en", output_path=Path(output_path), speed=speed)


def existing_path_setting(name: str) -> Optional[Path]:
    value = (os.environ.get(name) or "").strip()
    if not value:
        return None
    path = Path(value)
    return path if path.exists() else None


class TTSEngine(EngineAdapter):
    """One TTS engine; readiness requirements come from its manifest entry."""

    # True when the engine declares a configuration gate a managed lease can
    # never fix by starting the server (a skipped engine, not a start failure).
    config_gate = False
    # True when the engine's server runs under its dedicated per-engine venv.
    venv_runtime = False
    # True when service_report() is the canonical lifecycle probe (health plus
    # code identity) of the managed server.
    service_status_capable = False
    # True when the engine can synthesize without its managed process
    # (ready_without_process(), e.g. a cloud SDK path).
    process_free = False
    # Boot: a missing secret is reported before a missing package.
    boot_secrets_first = False
    # Boot: missing packages block (no on-demand install) and a staging
    # install counts as installed.
    boot_strict_install = False
    # A healthy server answering on the engine port counts as installed and
    # configured (its weights live server-side).
    external_server_ok = False

    def __init__(self, name: str) -> None:
        super().__init__(name, CATEGORY_TTS)
        self.tiered = self.entry.tiered
        self.health_paths = self.entry.health_paths
        self._last_synth_error = SerializedValue(None, f"{self.name.title()}TtsErrorState")

    # -- readiness (manifest driven) -------------------------------------- #
    def staging_dir(self) -> Path:
        env_key = self.entry.staging_env
        override = (os.environ.get(env_key) or "").strip() if env_key else ""
        return Path(override) if override else get_local_data_dir() / self.name

    def staging_deps_done(self) -> bool:
        return (self.staging_dir() / ".deps_done").is_file()

    def packages_present(self) -> bool:
        return all(module_present(module) for module, _dist in self.entry.packages)

    def _clone_present(self) -> bool:
        paths = [marker for marker in self.entry.install_markers if marker not in _TOKEN_MARKERS]
        root = self.staging_dir()
        if not paths or not root.is_dir():
            return False
        return any((root / rel).exists() for rel in paths) or (root / ".git").is_dir()

    def uses_isolated_venv(self) -> bool:
        return _MARKER_VENV in self.entry.install_markers

    def installed(self) -> bool:
        markers = self.entry.install_markers
        return bool(
            (_MARKER_PACKAGES in markers and self.entry.packages and self.packages_present())
            or (_MARKER_VENV in markers and isolated_venv.venv_ready(self.name))
            or (_MARKER_DEPS in markers and self.staging_deps_done())
            or self._clone_present()
        )

    def secrets_ready(self) -> bool:
        return all(get_secret_key_indexed(name) for name in self.entry.secrets)

    def model_ready(self) -> bool:
        return True

    def installer_hint(self) -> str:
        return self.entry.installer or TTS_INSTALL_HINT_GENERIC

    def _package_names(self) -> str:
        return ", ".join(dist for _module, dist in self.entry.packages)

    def boot_verdict(self) -> BootVerdict:
        """Cheap boot verification. A server is never blocked (its venv or clone
        is fixed by the managed lifecycle); a missing package, secret or model
        of a cloud or in-process engine is a hard precondition."""
        if self.entry.runtime == RUNTIME_SERVER:
            if self.installed():
                return ready()
            return deferred(tts_reason(TTS_REASON_NOT_INSTALLED, installer=self.installer_hint()))
        secret_missing = None if self.secrets_ready() else blocked(
            tts_reason(TTS_REASON_SECRET_REQUIRED, secrets=", ".join(self.entry.secrets))
        )
        if secret_missing is not None and self.boot_secrets_first:
            return secret_missing
        package_reason = tts_reason(TTS_REASON_PACKAGE_MISSING, package=self._package_names())
        if self.boot_strict_install:
            if not self.installed():
                return blocked(package_reason)
        elif self.entry.packages:
            verdict = packages_check(tuple(module for module, _dist in self.entry.packages), package_reason)
            if verdict.state != BOOT_READY:
                return verdict
        if secret_missing is not None:
            return secret_missing
        if not self.model_ready():
            return blocked(tts_reason(
                TTS_REASON_MODEL_NOT_FOUND, engine=self.name, installer=self.installer_hint(),
            ))
        return ready()

    def self_contained_reason(self) -> Optional[Any]:
        """Isolated venv breakdown: base interpreter missing vs venv not built."""
        if isolated_venv.venv_ready(self.name):
            return None
        base = base_interpreter_compatibility(self.name)
        if not base.get("base_found"):
            return tts_reason(
                TTS_REASON_BASE_PYTHON_UNAVAILABLE, engine=self.name,
                detail=str(base.get("reason") or "python310_not_registered"),
            )
        if not base.get("compatible"):
            return tts_reason(
                TTS_REASON_BASE_PYTHON_UNAVAILABLE, engine=self.name,
                detail=str(base.get("reason") or "base interpreter incompatible"),
            )
        return tts_reason(
            TTS_REASON_VENV_NOT_BUILT_BASE_READY, engine=self.name,
            python_version=str(base.get("python_version") or ""),
            installer=self.installer_hint(),
        )

    def install_reason(self) -> Any:
        """One coded reason for every not-installed engine; a venv-run server
        reports its base-interpreter breakdown unless the base is ready."""
        if self.venv_runtime:
            reason = self.self_contained_reason()
            if reason is not None and reason.code != TTS_REASON_VENV_NOT_BUILT_BASE_READY:
                return reason
        return tts_reason(TTS_REASON_NOT_INSTALLED, installer=self.installer_hint())

    def disabled_reason(self) -> Optional[Any]:
        """The engine's own configuration reason (setting, secret, cooldown);
        a coded reason (tts_reason_codes) reaches the status UI as is."""
        if not self.secrets_ready():
            return tts_reason(TTS_REASON_SECRET_REQUIRED, secrets=", ".join(self.entry.secrets))
        return None

    def load_gate(self) -> Tuple[bool, str]:
        """RAM/VRAM gateway for this engine: the headroom is needed only to
        LOAD the model, so a resident model (loaded in-process or in its
        server) is reused and never masked by the memory it already holds."""
        allowed, gate_reason = memory_gate_allows(self.name)
        if allowed or self.resident():
            return True, ""
        return False, gate_reason

    def _resident_signal(self) -> str:
        return f"pyutils.tts.engine.{self.name}.resident"

    def resident(self) -> bool:
        """is_model_loaded() cached for TTS_AVAILABILITY_TTL_SECONDS (for a
        server it is a /health round trip); start/stop/unload clear it."""
        now = time.time()
        cache = THREAD_BUS.get_signal(self._resident_signal(), {}) or {}
        if now - float(cache.get("ts", 0.0)) < TTS_AVAILABILITY_TTL_SECONDS:
            return bool(cache.get("ok"))
        ok = bool(self.is_model_loaded())
        THREAD_BUS.signal(self._resident_signal(), {"ts": now, "ok": ok})
        return ok

    def runtime_reason(self) -> Optional[Any]:
        allowed, gate_reason = self.load_gate()
        if not allowed:
            return tts_reason(TTS_REASON_MEMORY_GATE, engine=self.name, detail=gate_reason)
        return None

    def unavailable_reason(self) -> Optional[Any]:
        """Why the engine cannot synthesize now; None when no hint applies."""
        if not self.installed():
            return self.install_reason()
        reason = self.disabled_reason()
        if reason:
            return reason
        if not self.model_ready():
            return tts_reason(TTS_REASON_MODEL_NOT_FOUND, engine=self.name, installer=self.installer_hint())
        return self.runtime_reason()

    def config_ready(self) -> bool:
        return not self.boot_blocked() and self.disabled_reason() is None

    def probe(self) -> bool:
        return self.installed() and self.model_ready() and self.disabled_reason() is None

    # -- runtime ---------------------------------------------------------- #
    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        raise NotImplementedError

    def last_synth_error(self) -> Optional[str]:
        error = self._last_synth_error.get()
        return str(error) if error else None

    def clear_error(self) -> None:
        self._last_synth_error.set(None)

    def fail(self, error: str) -> bool:
        self._last_synth_error.set(error)
        ColorPrint.red(f"[{self.name}] synth failed: {error}")
        return False

    def write_audio_stream(self, status: int, content_type: Optional[str], content: bytes, output: Path) -> bool:
        """Store an online mp3 stream reply; an error body (html/json) fails."""
        if status != 200 or not content:
            return self.fail(f"HTTP {status}; no audio")
        ctype = (content_type or "").lower()
        if "audio" not in ctype and "octet-stream" not in ctype:
            return self.fail(f"unexpected content-type '{ctype}'")
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(content)
        except OSError as exc:
            return self.fail(f"write {output} failed: {exc}")
        return output.stat().st_size > 0

    def healthy(self) -> bool:
        return False

    def service_report(self) -> Optional[Dict[str, Any]]:
        return None

    def model_path(self) -> Optional[Path]:
        return None

    def ready_without_process(self) -> bool:
        return False

    def is_model_loaded(self) -> bool:
        return False

    def parallel_capacity(self) -> int:
        """Requests the engine runs at once (a server's native batch size);
        0 when it does not report one."""
        return 0

    def unload_model(self) -> None:
        return None

    def invalidate_availability(self) -> None:
        THREAD_BUS.clear_signal(self._resident_signal())


class HttpServerEngine(TTSEngine):
    """A managed local HTTP API server. Base URL convention: ``{PREFIX}_URL``,
    else ``http://{PREFIX}_HOST:{PREFIX}_PORT`` (loopback and the engine's
    default port when unset)."""

    default_port = 0
    # Availability probe paths (default: the manifest health paths).
    availability_paths: Tuple[str, ...] = ()
    # Availability checks the configuration before the cached health probe.
    probe_requires_config = True
    # How a synthesis reply is stored: AUDIO_CTYPE (mpeg content type written
    # as is, else wav converted), AUDIO_CTYPE_OR_MP3_TARGET (also written as is
    # for an .mp3 target), AUDIO_RAW (always as is), AUDIO_WAV_TARGET (as is
    # for a .wav target, else wav converted with tempo).
    audio_reply = "ctype"
    # A JSON content type on a 200 reply is an error body, not audio.
    reject_json_reply = False

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.env_prefix = self.name.upper()
        self._availability_signal = f"pyutils.tts.{self.name}.available"

    def setting(self, suffix: str) -> str:
        return (os.environ.get(f"{self.env_prefix}_{suffix}") or "").strip()

    def base_url(self) -> str:
        explicit = self.setting("URL")
        if explicit:
            return explicit.rstrip("/")
        host = self.setting("HOST") or HTTP_LOOPBACK_HOST
        port = self.setting("PORT")
        return f"http://{host}:{int(port) if port.isdigit() else self.default_port}"

    def ref_audio(self) -> Optional[Path]:
        return existing_path_setting(f"{self.env_prefix}_REF_AUDIO")

    # -- health ----------------------------------------------------------- #
    def _probe_paths(
        self, paths: Tuple[str, ...], timeout: Any, accept: Any, stop_unreachable: bool = True,
    ) -> Tuple[bool, Dict[str, Any]]:
        """(reachable, JSON body) of the first path whose status ``accept``s;
        an unreachable peer skips the remaining paths when ``stop_unreachable``,
        any other transport failure tries the next one."""
        base = self.base_url()
        for path in paths:
            reply = tts_get(f"{base}{path}", timeout=timeout)
            if reply == TTS_UNREACHABLE and stop_unreachable:
                return False, {}
            if isinstance(reply, TtsHttpReply) and accept(reply.status):
                return True, reply.json_body()
        return False, {}

    def health_state(self) -> Tuple[bool, Dict[str, Any]]:
        """Managed-service health: manifest health paths, status below 500."""
        return self._probe_paths(self.health_paths, _MANAGED_HEALTH_TIMEOUT_S, lambda status: status < 500)

    def health_ready(self, body: Dict[str, Any]) -> bool:
        """Managed-service health of a reachable server."""
        return True

    def healthy(self) -> bool:
        reachable, body = self.health_state()
        return reachable and self.health_ready(body)

    def availability_state(self) -> Tuple[bool, Dict[str, Any]]:
        """Synthesis availability probe (status below 500, 2 s per path)."""
        return self._probe_paths(
            self.availability_paths or self.health_paths, _AVAILABILITY_TIMEOUT_S,
            lambda status: status < 500, stop_unreachable=False,
        )

    def available_body(self, body: Dict[str, Any]) -> bool:
        return True

    def synth_ready(self) -> bool:
        """Uncached: the server answers and reports it can synthesize."""
        reachable, body = self.availability_state()
        return reachable and self.available_body(body)

    def probe(self) -> bool:
        """Configuration first (never cached, when ``probe_requires_config``),
        then synth_ready() cached for TTS_AVAILABILITY_TTL_SECONDS on THREAD_BUS."""
        if self.probe_requires_config and not self.config_ready():
            return False
        now = time.time()
        cache = THREAD_BUS.get_signal(self._availability_signal, {}) or {}
        if now - float(cache.get("ts", 0.0)) < TTS_AVAILABILITY_TTL_SECONDS:
            return bool(cache.get("ok"))
        ok = self.synth_ready()
        THREAD_BUS.signal(self._availability_signal, {"ts": now, "ok": ok})
        return ok

    def invalidate_availability(self) -> None:
        super().invalidate_availability()
        THREAD_BUS.clear_signal(self._availability_signal)

    def runtime_reason(self) -> Optional[Any]:
        if self.venv_runtime and not self.setting("URL"):
            reason = self.self_contained_reason()
            if reason is not None:
                return reason
        return tts_reason(TTS_REASON_SERVER_NOT_RUNNING, engine=self.name, url=self.base_url())

    def setting_reason(self, setting: str) -> Any:
        return tts_reason(TTS_REASON_SETTING_REQUIRED, setting=setting)

    # -- transport -------------------------------------------------------- #
    def post(
        self,
        path: str,
        *,
        json_body: Any = None,
        form: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Tuple[str, bytes, str]]] = None,
    ) -> TtsHttpReply:
        return tts_post(
            f"{self.base_url()}{path}",
            json_body=json_body, form=form, files=files,
        )

    def write_audio(self, reply: TtsHttpReply, output: Path, tempo: float = 1.0) -> bool:
        """Store a server audio reply: encoded audio or a .wav target is written
        as is; wav bytes (RIFF) for a compressed target are converted with the
        tempo applied."""
        output = Path(output)
        if self.reject_json_reply and "json" in reply.content_type:
            return self.fail(reply.error or reply.json_body().get("error") or "server returned JSON instead of audio")
        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            mpeg = "mpeg" in reply.content_type or "mp3" in reply.content_type
            as_is = {
                AUDIO_CTYPE: mpeg,
                AUDIO_CTYPE_OR_MP3_TARGET: mpeg or output.suffix.lower() == ".mp3",
                AUDIO_RAW: True,
                AUDIO_WAV_TARGET: output.suffix.lower() == ".wav",
            }[self.audio_reply]
            if as_is:
                output.write_bytes(reply.content)
                return output.stat().st_size > 0 or self.fail("server returned empty audio")
            tmp_wav = output.with_suffix(f".{self.name}.wav")
            tmp_wav.write_bytes(reply.content)
            try:
                return wav_to_mp3(tmp_wav, output, tempo=tempo) or self.fail("wav->mp3 conversion failed")
            finally:
                tmp_wav.unlink(missing_ok=True)
        except OSError as exc:
            return self.fail(f"write {output} failed: {exc}")

    def post_audio(self, path: str, output: Path, tempo: float = 1.0, **body: Any) -> bool:
        reply = self.post(path, **body)
        if not reply.ok:
            return self.fail(reply.error or f"{self.name} {path} failed")
        return self.write_audio(reply, output, tempo)


class IsolatedVenvServerEngine(HttpServerEngine):
    """A server run under its dedicated per-engine venv: usable when the venv
    is provisioned (the managed service starts it on demand)."""

    venv_runtime = True

    def disabled_reason(self) -> Optional[Any]:
        if isolated_venv.venv_ready(self.name):
            return None
        return tts_reason(TTS_REASON_VENV_NOT_BUILT, engine=self.name, installer=self.installer_hint())

    def probe(self) -> bool:
        return isolated_venv.venv_ready(self.name)

    def is_model_loaded(self) -> bool:
        """Best effort: GET /health -> model_loaded (False when down)."""
        reply = tts_get(f"{self.base_url()}/health", timeout=TTS_HEALTH_TIMEOUT_SECONDS)
        return isinstance(reply, TtsHttpReply) and 200 <= reply.status < 300 and bool(
            reply.json_body().get("model_loaded")
        )

    def unavailable_reason(self) -> Optional[Any]:
        """The base-interpreter / venv breakdown, else the engine's own reason
        (no server-not-running hint: the managed service starts it on use)."""
        return self.self_contained_reason() or self.disabled_reason()


class SerializedModelEngine(TTSEngine):
    """An in-process model owned by one serialized worker thread. Subclasses
    implement load_resource() and render_wav() (or render_output())."""

    timeout = DEFAULT_MODEL_OPERATION_TIMEOUT
    # Unloading also collects garbage and empties the CUDA cache.
    release_gpu_on_unload = True
    unload_timeout: Optional[float] = DEFAULT_MODEL_OPERATION_TIMEOUT

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.queue_name = f"pyutils.tts.{self.name}.model"
        self._wav_suffix = f".{self.name}.wav"
        self._resource: Any = None
        # Readable without entering the model queue: a status probe never
        # waits behind an in-flight synthesis.
        self._loaded = SerializedValue(False, f"{self.name.title()}ModelLoadedState")
        self._worker = SerializedWorkerThread(self.queue_name, f"{self.name.title()}ModelThread")
        self._worker.start()

    def load_resource(self) -> Any:
        raise NotImplementedError

    def render_wav(self, resource: Any, text: str, lang: str, output_wav: Path, speed: float) -> bool:
        raise NotImplementedError

    def render_output(self, resource: Any, text: str, lang: str, output: Path, speed: float) -> bool:
        output_wav = output.with_suffix(self._wav_suffix)
        output_wav.parent.mkdir(parents=True, exist_ok=True)
        try:
            if not self.render_wav(resource, text, lang, output_wav, speed):
                return False
            return wav_to_mp3(output_wav, output)
        finally:
            output_wav.unlink(missing_ok=True)

    def resource(self) -> Any:
        """The loaded model; call on the owner thread only (call_on_owner)."""
        if self._resource is None:
            self._resource = self.load_resource()
            self._loaded.set(self._resource is not None)
        return self._resource

    def call_on_owner(self, fn: Callable[..., Any], *args: Any) -> Any:
        # The owner runs the call in the caller's context, so request-scoped
        # engine settings (engine_policy.engine_setting) reach the model thread.
        return call_serialized(self.queue_name, copy_context().run, fn, *args, timeout=self.timeout)

    def queue_size(self) -> int:
        return THREAD_BUS.queue_size(self.queue_name)

    def _synthesize_on_owner(self, text: str, lang: str, output: Path, speed: float) -> bool:
        resource = self.resource()
        if resource is None:
            return False
        return bool(self.render_output(resource, text, lang, output, speed))

    def synthesize(self, request: TTSSynthesisRequest) -> bool:
        cleaned = (request.text or "").strip()
        if not cleaned or not self.available():
            return False
        return bool(self.call_on_owner(
            self._synthesize_on_owner, cleaned, request.language, Path(request.output_path), request.speed,
        ))

    def is_model_loaded(self) -> bool:
        return bool(self._loaded.get())

    def _unload_on_owner(self) -> None:
        self._resource = None
        self._loaded.set(False)
        if self.release_gpu_on_unload:
            release_gpu_memory()

    def unload_model(self) -> None:
        call_serialized(self.queue_name, self._unload_on_owner, timeout=self.unload_timeout)
        self.invalidate_availability()


__all__ = [
    "DEFAULT_MODEL_OPERATION_TIMEOUT",
    "HttpServerEngine",
    "IsolatedVenvServerEngine",
    "SerializedModelEngine",
    "TTSEngine",
    "TTSSynthesisRequest",
    "existing_path_setting",
    "text_request",
]
