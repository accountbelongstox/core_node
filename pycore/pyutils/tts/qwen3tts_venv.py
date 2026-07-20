# -*- coding: utf-8 -*-
r"""
Isolated virtualenv for the Qwen3-TTS subprocess server.

qwen-tts pins transformers==4.57.3 exactly; the main interpreter pins
transformers==4.46.x (parler-tts / bark etc.). Both pins cannot coexist in ONE
interpreter, so Qwen3-TTS runs as its OWN subprocess (qwen3tts_api_server.py)
inside a DEDICATED venv; qwen3tts_engine.py / qwen3tts_service.py only talk to it
over HTTP.

Venv location: next to the running interpreter, get_lang_compiler_dir() /
"py_venv_<major.minor>" (e.g. D:\.dev_win10\py_venv_3.13). It is created with
--system-site-packages so it REUSES the main interpreter's heavy packages (notably
the CUDA torch, plus fastapi/uvicorn/soundfile/numpy). ONLY qwen-tts's pinned
transformers/accelerate are installed INTO the venv, whose own site-packages
shadow the system's 4.46.x without ever touching it.

Readiness is measured by an ACTUAL import of qwen_tts in the venv (not a presence
probe) - because with --system-site-packages the system's qwen_tts/transformers are
visible, so "present" does not mean "the right transformers wins". If the import
fails (e.g. transformers ALL_ATTENTION_FUNCTIONS), the venv is REBUILT and the
pinned transformers/accelerate are installed into it.

Resolution order for the interpreter to run the server under:
  1. env QWEN3TTS_PYTHON (explicit override - an existing python 3.13 with qwen-tts)
  2. <lang_compiler_dir>/py_venv_<ver>/Scripts/python.exe (Win) or .../bin/python3 (Linux)
  3. None (not provisioned yet) - callers auto-provision via ensure_venv()
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_lang_compiler_dir

_VENV_PREFIX = "py_venv_"
# Modules that MUST import for the api server to run + synthesize. Importing
# qwen_tts triggers the transformers version check (the ALL_ATTENTION_FUNCTIONS
# symbol), so it is the real readiness signal.
_HEALTH_IMPORTS = "import uvicorn, fastapi, soundfile, pydub, numpy, torch; import qwen_tts"
# Version-pinned packages that must be installed INTO the venv (shadowing the
# system copies). Read live from qwen-tts's own metadata; these are the fallback.
_FALLBACK_PINS = ("transformers==4.57.3", "accelerate==1.12.0")
# Server/runtime deps installed only if absent; already-present system copies
# (fastapi/uvicorn/soundfile/numpy, and torch via qwen-tts) are reused as-is.
_SERVER_DEPS = ("uvicorn", "fastapi", "soundfile", "pydub", "numpy")


def _python_version_tag() -> str:
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def venv_dir() -> Path:
    return get_lang_compiler_dir() / f"{_VENV_PREFIX}{_python_version_tag()}"


def _venv_python_path() -> Path:
    if sys.platform == "win32":
        return venv_dir() / "Scripts" / "python.exe"
    return venv_dir() / "bin" / "python3"


def resolve_python() -> Optional[str]:
    """Return the interpreter to launch qwen3tts_api_server.py under, or None
    when the dedicated venv has not been provisioned yet."""
    override = (os.environ.get("QWEN3TTS_PYTHON") or "").strip()
    if override and Path(override).is_file():
        return override
    py = _venv_python_path()
    if py.is_file():
        return str(py)
    return None


def venv_ready() -> bool:
    return resolve_python() is not None


def _same_interpreter(a: str, b: str) -> bool:
    try:
        return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))
    except OSError:
        return False


def _run(argv) -> bool:
    try:
        ColorPrint.blue(f"[qwen3tts-venv] {' '.join(argv)}")
        subprocess.run(argv, check=True)
        return True
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[qwen3tts-venv] command failed: {exc}")
        return False


def _venv_healthy(venv_python: str) -> bool:
    """True when qwen_tts (and the server deps) actually IMPORT in the venv - the
    only reliable signal under --system-site-packages, where the system's stale
    transformers would otherwise look 'present'."""
    try:
        out = subprocess.run(
            [venv_python, "-c", _HEALTH_IMPORTS],
            capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
        )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[qwen3tts-venv] health probe failed: {exc}")
        return False
    if out.returncode == 0:
        return True
    tail = [ln for ln in (out.stderr or "").splitlines() if ln.strip()]
    if tail:
        ColorPrint.yellow(f"[qwen3tts-venv] venv import check failed: {tail[-1]}")
    return False


def _required_pins(venv_python: str) -> List[str]:
    """Read qwen-tts's exact transformers/accelerate pins from its own metadata
    (so we never hardcode the version). Falls back to _FALLBACK_PINS."""
    probe = (
        "import json, importlib.metadata as m;"
        "reqs = m.requires('qwen-tts') or [];"
        "pins = [r.split(';')[0].strip() for r in reqs "
        "if r.split(';')[0].strip().lower().startswith(('transformers', 'accelerate'))];"
        "print(json.dumps(pins))"
    )
    try:
        out = subprocess.run(
            [venv_python, "-c", probe],
            capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
        )
        lines = [ln for ln in (out.stdout or "").splitlines() if ln.strip()]
        pins = [p for p in (json.loads(lines[-1]) if lines else []) if p]
        if pins:
            return pins
    except (ValueError, TypeError, OSError):
        pass
    return list(_FALLBACK_PINS)


def ensure_packages(venv_python: Optional[str] = None, force: bool = False) -> bool:
    """Make qwen_tts importable in the venv. Cheap when already healthy (one import
    probe). Otherwise installs the pinned transformers/accelerate INTO the venv
    (shadowing the system copies) plus any absent server deps, reusing the system's
    CUDA torch, then re-verifies the import."""
    venv_python = venv_python or resolve_python()
    if not venv_python:
        return False
    if not force and _venv_healthy(venv_python):
        return True

    pins = _required_pins(venv_python)
    install_list = [*pins, "qwen-tts", *_SERVER_DEPS]
    ColorPrint.blue(
        "[qwen3tts-venv] installing into venv (pins shadow system transformers; system "
        f"CUDA torch reused): {', '.join(install_list)}"
    )
    _run([venv_python, "-m", "pip", "install", "--upgrade", "pip"])
    if not _run([venv_python, "-m", "pip", "install", *install_list]):
        return False
    if not _venv_healthy(venv_python):
        ColorPrint.yellow("[qwen3tts-venv] venv still cannot import qwen_tts after install")
        return False
    ColorPrint.green("[qwen3tts-venv] qwen_tts imports OK in the venv")
    return True


def _recreate_venv() -> bool:
    """Remove any existing venv and create a fresh one with --system-site-packages
    so it REUSES the main interpreter's packages (notably the CUDA torch); only
    qwen-tts's transformers==4.57.3 pin is layered on top inside the venv."""
    target = venv_dir()
    if target.exists():
        ColorPrint.blue(f"[qwen3tts-venv] removing existing venv at {target} ...")
        try:
            shutil.rmtree(target)
        except OSError as exc:
            ColorPrint.yellow(f"[qwen3tts-venv] could not remove {target}: {exc}")
            return False
    target.parent.mkdir(parents=True, exist_ok=True)
    ColorPrint.blue(f"[qwen3tts-venv] creating venv (--system-site-packages) at {target} ...")
    return _run([sys.executable, "-m", "venv", "--system-site-packages", str(target)])


def ensure_venv(force: bool = False) -> Optional[str]:
    r"""Return an interpreter under which qwen_tts imports cleanly, provisioning as
    needed.

    QWEN3TTS_PYTHON override (an existing python 3.13 that already has qwen-tts) is
    used as-is. Otherwise the venv lives next to the running interpreter
    (get_lang_compiler_dir(), e.g. D:\.dev_win10\py_venv_3.13), created with
    --system-site-packages to reuse the system CUDA torch. It is REBUILT whenever
    qwen_tts fails to import (or force=True), then the pinned transformers/accelerate
    are installed into it. First provisioning can take a few minutes."""
    override = (os.environ.get("QWEN3TTS_PYTHON") or "").strip()
    if override and Path(override).is_file():
        if _same_interpreter(override, sys.executable):
            ColorPrint.yellow(
                "[qwen3tts-venv] QWEN3TTS_PYTHON points at the main interpreter; refusing to "
                "install qwen-tts's transformers==4.57.3 there (would break the shared env). "
                "Falling back to the isolated venv."
            )
        else:
            ColorPrint.blue(f"[qwen3tts-venv] using QWEN3TTS_PYTHON override: {override}")
            if not ensure_packages(override, force=force):
                return None
            ColorPrint.green(f"[qwen3tts-venv] ready: {override}")
            return override

    py_path = _venv_python_path()
    need_rebuild = force or not py_path.is_file() or not _venv_healthy(str(py_path))

    if need_rebuild:
        if not _recreate_venv():
            return None
        if not py_path.is_file():
            ColorPrint.yellow(
                f"[qwen3tts-venv] venv creation reported success but {py_path} is missing"
            )
            return None
        if not ensure_packages(str(py_path), force=True):
            return None

    venv_python = str(py_path)
    ColorPrint.green(f"[qwen3tts-venv] ready: {venv_python}")
    return venv_python


__all__ = ["venv_dir", "resolve_python", "venv_ready", "ensure_venv", "ensure_packages"]
