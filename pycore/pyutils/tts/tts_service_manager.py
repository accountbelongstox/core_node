# -*- coding: utf-8 -*-
"""
Managed lifecycle for local TTS services - the TTS-category facade over the
unified `managed_services` manager (pycore/pyutils/common/managed_service.py).
Implements the TTS view of the shared contract in
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md (§3-§5).

Covers TWO kinds of TTS services under category "tts":
  - kind="server" : subprocess HTTP API servers (chattts, cosyvoice, fishspeech,
                    gptsovits, f5tts, qwen3tts, melotts). start = Popen + HTTP
                    health; stop = terminate. Single-active applies ONLY among
                    these servers (class C, spec §1). qwen3tts, melotts and
                    gptsovits are ISOLATED-VENV class-C servers (Bucket B): their
                    api server (qwen3tts_api_server.py / melotts_api_server.py /
                    the cloned GPT-SoVITS api_v2.py) runs under a DEDICATED
                    per-engine venv resolved by isolated_venv - because
                    each pins a transformers that cannot coexist with the main
                    interpreter's shared pin. PYTHONPATH/PYTHONHOME are stripped so
                    the venv's packages are never shadowed. Per-engine venv dirs +
                    ports: qwen3tts py_venv_<ver> :57210, melotts
                    py_venv_melotts_<ver> :57212, gptsovits py_venv_gptsovits_<ver>
                    :9880 (existing GPTSOVITS_URL bind).
  - kind="model"  : in-process model engines (bark, voxcpm2, kokoro, sherpa).
                    load on first synth; parallel OK; each idle-unloads
                    independently (class B, spec §1).

Unified contract (enforced by managed_services):
  - idempotent start and ownership on call (`managed_services.lease`).
  - default no memory: auto-stop after `server_idle_shutdown_s` idle (default 180s).
  - single-active: starting one SERVER stops other TTS servers (not models).
  - busy protection: a service with an in-flight call is never stopped/unloaded.

Settings persist in user_data.json section "tts" (legacy `server_*` keys, kept
for router/UI compatibility): server_auto_manage / server_single_active /
server_idle_shutdown_s / server_enabled (per-service map, servers + models).
"""

import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.python_env.isolated_venv import (
    MAIN_INTERPRETER,
    resolve_python as resolve_isolated_python,
)
from pycore.pyfoundations.third_party.api import get_third_package_psutil, get_third_package_requests
from pycore.pyutils.common.managed_service import ServiceSpec
from pycore.pyutils.common.managed_service_facade import ManagedServiceFacade
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts.tts_engine_probe import engine_installed, staging_dir
from pycore.pyutils.tts.engine_registry import tts_engine_registry
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.qwen.events as qwen_events
import pycore.pyutils.tts.qwen.weights as qwen_weights
from pycore.pyutils.tts.qwen.config import (
    DEFAULT_PORT as QWEN_DEFAULT_PORT,
    ENGINE_NAME as QWEN_ENGINE_NAME,
    api_server_path as qwen_api_server_path,
)


# Parler is disabled because it pins an older transformers release. qwen3tts,
# melotts and gptsovits are class-C API servers running in DEDICATED per-engine
# venvs (Bucket B), never in-process - their pinned transformers conflicts with
# the main interpreter's shared pin.
_MELOTTS_API_SERVER = "melotts_api_server.py"
_TTS_SERVICE_FACADE = ManagedServiceFacade("tts", "server_")


# --------------------------------------------------------------------------- #
# Server specs (subprocess HTTP API servers)                                   #
# --------------------------------------------------------------------------- #
def _parse_port(url: str, default: int) -> int:
    try:
        parsed = urlparse(url)
        if parsed.port:
            return int(parsed.port)
    except Exception:  # noqa: BLE001
        pass
    return default

def _python_exe() -> str:
    return str(MAIN_INTERPRETER)


def _sync_server_script(staging: Path, filename: str) -> None:
    """Keep staging api server aligned with pycore/tts_install_assets template."""
    src = Path(__file__).resolve().parents[2] / "tts_install_assets" / filename
    dst = staging / filename
    if src.is_file():
        try:
            shutil.copy2(src, dst)
        except OSError:
            pass


def _start_command(engine: str) -> Optional[Tuple]:
    """Return (cwd, argv) for same-interpreter servers, or (cwd, argv, env) for
    servers that need a custom environment (qwen3tts runs under its isolated venv)."""
    staging = staging_dir(engine)
    py = _python_exe()
    if engine == "chattts":
        _sync_server_script(staging, "chattts_api_server.py")
        script = staging / "chattts_api_server.py"
        if not script.is_file():
            return None
        adapter = tts_engine_registry.get(engine)
        model_path = adapter.model_path() if adapter is not None else None
        if model_path is None:
            return None
        env = dict(os.environ)
        env["CHATTTS_MODEL_DIR"] = str(model_path)
        env["HF_HUB_OFFLINE"] = "1"
        env["TRANSFORMERS_OFFLINE"] = "1"
        return staging, [py, str(script)], env
    if engine == "cosyvoice":
        script = staging / "runtime" / "python" / "fastapi" / "server.py"
        if not script.is_file():
            return None
        adapter = tts_engine_registry.get(engine)
        port = _parse_port(adapter.base_url() if adapter else "", 50000)
        model = runtime_engine_model("cosyvoice") or "iic/CosyVoice2-0.5B"
        return staging, [py, str(script), "--port", str(port), "--model_dir", model]
    if engine == "fishspeech":
        _sync_server_script(staging, "fishspeech_api_server.py")
        script = staging / "fishspeech_api_server.py"
        if not script.is_file():
            script = staging / "tools" / "api_server.py"
        if not script.is_file():
            return None
        adapter = tts_engine_registry.get(engine)
        port = _parse_port(adapter.base_url() if adapter else "", 8080)
        if script.name == "fishspeech_api_server.py":
            return staging, [py, str(script)]
        return staging, [py, str(script), "--listen", f"0.0.0.0:{port}"]
    if engine == "gptsovits":
        return _gptsovits_start_command(staging)
    if engine == "f5tts":
        _sync_server_script(staging, "f5tts_api_server.py")
        script = staging / "f5tts_api_server.py"
        if not script.is_file():
            return None
        return staging, [py, str(script)]
    if engine == "qwen3tts":
        return _qwen3tts_start_command(staging)
    if engine == "melotts":
        return _melotts_start_command(staging)
    return None


def _isolated_env(extra: Dict[str, str]) -> Dict[str, str]:
    """Base environment for a class-C server run under an ISOLATED per-engine venv:
    inherit os.environ, strip PYTHONPATH/PYTHONHOME (so the main interpreter's
    site-packages cannot shadow the venv's pinned packages), force unbuffered
    stdout, then apply the engine-specific overrides."""
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)
    env.pop("PYTHONHOME", None)
    env["PYTHONUNBUFFERED"] = "1"
    env.update(extra)
    return env


def _gptsovits_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for gptsovits: launch its api_v2.py under the ISOLATED
    per-engine venv (never the main interpreter, whose transformers pin conflicts
    with GPT-SoVITS's). RUNTIME only RESOLVES the pre-built venv - a missing venv
    -> no start (the installer provisions it via isolated_venv.ensure_venv)."""
    script = staging / "api_v2.py"
    if not script.is_file():
        return None
    venv_python = resolve_isolated_python("gptsovits")
    if not venv_python:
        return None
    return staging, [venv_python, str(script)], _isolated_env({})


def _melotts_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for melotts: launch the api server under the ISOLATED
    per-engine venv (never the main interpreter, which lacks - and must not gain -
    MeloTTS's old transformers pin). Mirrors _qwen3tts_start_command; PYTHONPATH/
    PYTHONHOME are stripped so the venv's packages are not shadowed.

    RUNTIME only RESOLVES the pre-built venv (resolve_python) - it never builds/pips
    at start time; a missing venv -> no start (the installer provisions it)."""
    venv_python = resolve_isolated_python("melotts")
    if not venv_python:
        return None
    api_server = Path(__file__).resolve().parents[2] / "tts_install_assets" / _MELOTTS_API_SERVER
    if not api_server.is_file():
        return None
    adapter = tts_engine_registry.get("melotts")
    parsed = urlparse(adapter.base_url() if adapter else "")
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 57212
    extra: Dict[str, str] = {"MELOTTS_HOST": host, "MELOTTS_PORT": str(port)}
    model = (os.environ.get("MELOTTS_MODEL") or "").strip()
    if model:
        extra["MELOTTS_MODEL"] = model
    device = (os.environ.get("MELOTTS_DEVICE") or "").strip()
    if device:
        extra["MELOTTS_DEVICE"] = device
    return staging, [venv_python, str(api_server)], _isolated_env(extra)


def _qwen3tts_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for qwen3tts: launch the api server under the ISOLATED
    venv (never the main interpreter, which lacks the required transformers pin).
    PYTHONPATH/PYTHONHOME are stripped so the
    venv's pinned transformers is not shadowed by the main interpreter.

    qwen.weights.resolve_model_id() converts a matching verified HF repo id
    to staging/weights. The venv is package-only and must never own or download
    another managed model copy.

    RUNTIME only RESOLVES the pre-built venv (resolve_python) - it never builds/pips
    at start time. Provisioning is done idempotently by the install scripts
    (Step61_InstallQwen3Tts.ps1 / 140_install_qwen3tts.sh) that pyservice runs; a
    missing venv -> no start + disabled_reason points at the installer."""
    venv_python = resolve_isolated_python(QWEN_ENGINE_NAME)
    model_id = qwen_weights.resolve_model_id(allow_remote=False)
    if not venv_python or not model_id:
        return None
    api_server = qwen_api_server_path()
    if not api_server.is_file():
        return None
    base = qwen_engine.base_url()
    parsed = urlparse(base)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or QWEN_DEFAULT_PORT
    extra: Dict[str, str] = {
        "QWEN3TTS_HOST": host,
        "QWEN3TTS_PORT": str(port),
        "QWEN3TTS_MODEL": model_id,
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
    }
    device = (os.environ.get("QWEN3TTS_DEVICE") or "").strip()
    if device:
        extra["QWEN3TTS_DEVICE"] = device
    return staging, [venv_python, str(api_server)], _isolated_env(extra)


def _http_healthy(engine: str) -> bool:
    adapter = tts_engine_registry.get(engine)
    if adapter is None or not adapter.health_paths:
        return False
    if adapter.health_probe is not None:
        return adapter.healthy()
    requests = get_third_package_requests()
    if requests is None:
        return False
    base = adapter.base_url()
    for path in adapter.health_paths:
        try:
            resp = requests.get(f"{base}{path}", timeout=(1.0, 2.0))
            if resp.status_code < 500:
                return True
        except requests.exceptions.ConnectionError:
            # Port not answering (refused / connect timeout) - other paths on the
            # same port will fail identically, skip them.
            return False
        except Exception:  # noqa: BLE001
            continue
    return False


def invalidate_server_engine_cache(engine: str) -> None:
    """Reset the server engine module's 30s availability cache (after start/stop)."""
    adapter = tts_engine_registry.get(engine)
    if adapter is not None:
        adapter.invalidate_availability()


def _on_server_started(engine: str) -> None:
    invalidate_server_engine_cache(engine)
    if engine == "qwen3tts":
        qwen_events.start_qwen3tts_http_events()


def _on_server_stopped(engine: str) -> None:
    invalidate_server_engine_cache(engine)
    if engine == "qwen3tts":
        qwen_events.stop_qwen3tts_http_events()


# --------------------------------------------------------------------------- #
# Registration into the unified manager                                        #
# --------------------------------------------------------------------------- #
def _listener_pids(psutil: Any, port: int) -> List[int]:
    """Return process IDs currently listening on one TCP port."""
    pids = set()
    for conn in psutil.net_connections(kind="tcp"):
        local_address = getattr(conn, "laddr", None)
        if not local_address or getattr(local_address, "port", None) != port:
            continue
        if conn.status == psutil.CONN_LISTEN and conn.pid:
            pids.add(int(conn.pid))
    return sorted(pids)


def _stop_foreign_server(engine: str) -> Optional[bool]:
    """Terminate a process we did NOT launch that is LISTENING on this engine's
    port — typically a stale orphan from a previous pycore run (its stdout pipe
    is dead, so every synth request 500s instantly while /health keeps passing).
    Returns True when reclaimed, False when a listener remains, and None when
    no listener can be identified."""
    adapter = tts_engine_registry.get(engine)
    if adapter is None:
        return False
    port = _parse_port(adapter.base_url(), 0)
    if not port:
        return False
    try:
        psutil = get_third_package_psutil()
    except Exception:  # noqa: BLE001
        return None
    try:
        listener_pids = _listener_pids(psutil, port)
        if not listener_pids:
            return None
        if os.getpid() in listener_pids:
            ColorPrint.yellow(
                f"[tts] refusing to reclaim {engine} port {port} from this process"
            )
            return False
        for pid in listener_pids:
            try:
                proc = psutil.Process(pid)
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except psutil.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=8)
            except psutil.NoSuchProcess:
                pass
            except Exception as exc:  # noqa: BLE001
                ColorPrint.yellow(
                    f"[tts] failed to stop foreign {engine} server "
                    f"(pid={pid}, port={port}): {exc}"
                )
        remaining = _listener_pids(psutil, port)
        if remaining:
            ColorPrint.yellow(
                f"[tts] foreign {engine} listener still owns port {port}: {remaining}"
            )
            return False
        for pid in listener_pids:
            ColorPrint.yellow(
                f"[tts] stopped foreign {engine} server "
                f"(pid={pid}) on port {port}"
            )
    except Exception:  # noqa: BLE001
        return None
    return True


def _register_services() -> None:
    for adapter in tts_engine_registry.values("server"):
        engine = adapter.name
        _TTS_SERVICE_FACADE.register(ServiceSpec(
            name=engine, category="tts", kind="server",
            installed=lambda engine=engine, adapter=adapter: (
                engine_installed(engine)
                or (engine == "chattts" and adapter.healthy())
            ),
            config_ready=lambda engine=engine, adapter=adapter: (
                adapter.config_ready()
                or (engine == "chattts" and adapter.healthy())
            ),
            start_command=lambda engine=engine: _start_command(engine),
            health=lambda engine=engine: _http_healthy(engine),
            on_started=lambda engine=engine: _on_server_started(engine),
            on_stopped=lambda engine=engine: _on_server_stopped(engine),
            on_acquired=adapter.invalidate_availability,
            adopt_foreign=(
                adapter.healthy
                if engine == "qwen3tts"
                else None
            ),
            stop_foreign=lambda engine=engine: _stop_foreign_server(engine),
            ready_without_process=adapter.ready_without_process,
        ))
    for adapter in tts_engine_registry.values("model"):
        _TTS_SERVICE_FACADE.register(ServiceSpec(
            name=adapter.name,
            category="tts",
            kind="model",
            installed=adapter.available,
            unload=adapter.unload_model,
            is_loaded=adapter.is_model_loaded,
        ))


_register_services()


# --------------------------------------------------------------------------- #
# Public facade (delegates to managed_services; keeps the legacy API shape)    #
# --------------------------------------------------------------------------- #
def is_server_engine(name: str) -> bool:
    """True for any managed TTS service (server OR model). The orchestrator uses
    this to give model engines the same lifecycle lease as server engines."""
    return _TTS_SERVICE_FACADE.contains(name)


def is_server_running(engine: str) -> bool:
    """Reachability: server HTTP health (cached) or model loaded."""
    return _TTS_SERVICE_FACADE.is_running(engine)


def start_server(engine: str) -> Dict[str, Any]:
    """Manual start (UI button). Force-starts bypassing auto_manage/enabled,
    still honouring single-active. Models load on use, so this is a no-op marker."""
    return _TTS_SERVICE_FACADE.start(engine)


def stop_server(engine: str) -> Dict[str, Any]:
    result = _TTS_SERVICE_FACADE.stop(engine)
    invalidate_server_engine_cache(engine)
    return result


def set_engine_enabled(engine: str, enabled: bool, *, start_now: bool = False) -> Dict[str, Any]:
    return _TTS_SERVICE_FACADE.set_enabled(
        engine,
        enabled,
        start_now=start_now,
    )


def get_server_settings() -> Dict[str, Any]:
    return _TTS_SERVICE_FACADE.settings(refresh=False)


def apply_server_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    return _TTS_SERVICE_FACADE.apply_settings(patch)


def server_runtime_status(engine: str, refresh: bool = True) -> Dict[str, Any]:
    """Per-engine runtime state for the status payload. Server engines keep the
    legacy `server_*` fields (UI controls); model engines report `model_loaded`
    + `model_idle_remaining_s` with `server_engine=False` (no controls)."""
    status = _TTS_SERVICE_FACADE.runtime_status(engine, refresh=refresh)
    if engine == "qwen3tts" and status.get("server_running") and refresh:
        status["server_url"] = status.get("server_url") or qwen_engine.base_url()
        queue = qwen_engine.get_queue_status()
        if queue is not None:
            status["queue"] = queue
    return status


def all_server_runtime_status() -> Dict[str, Dict[str, Any]]:
    names = (
        tts_engine_registry.names("server")
        + tts_engine_registry.names("model")
    )
    return {name: server_runtime_status(name) for name in names}


__all__ = [
    "is_server_engine",
    "is_server_running",
    "get_server_settings",
    "apply_server_settings",
    "start_server",
    "stop_server",
    "set_engine_enabled",
    "invalidate_server_engine_cache",
    "server_runtime_status",
    "all_server_runtime_status",
]
