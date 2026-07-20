# -*- coding: utf-8 -*-
r"""
Generic per-engine isolated virtualenv for class-C TTS subprocess servers.

Some TTS engines pin dependency versions that cannot coexist with the main
interpreter's shared stack (melotts pins an old transformers ~4.27.x; gpt-sovits
pins an old transformers too). Each such engine therefore runs its api server
inside its OWN dedicated venv; the main-interpreter engine module only talks to it
over HTTP. This module GENERALISES the proven qwen3tts_venv.py pattern to any
engine (qwen3tts keeps its own module unchanged; this covers melotts, gptsovits,
and any future isolated engine).

Venv location (next to the running interpreter):
  get_lang_compiler_dir() / "py_venv_<engine>_<major.minor>"
  e.g. D:\.dev_win10\py_venv_melotts_3.13 , /var/_core_node/.../py_venv_gptsovits_3.11

Each venv is created with --system-site-packages so it REUSES the main
interpreter's heavy packages (CUDA torch, fastapi/uvicorn/soundfile/numpy/pydub);
only the engine's version-pinned packages are installed INTO the venv, shadowing
the system copies without ever touching them.

Split of duties (mirrors qwen3tts):
  - RUNTIME (resolve_python / venv_ready): only RESOLVES a PRE-BUILT venv - never
    builds or pip-installs. tts_service_manager launches the api server under this.
  - INSTALL (ensure_venv): build + repair (create --system-site-packages, install
    pins + packages, verify with a real import-health probe, rebuild on failure).
    Called ONLY by the install scripts (pyservice sweep), never at synth time.

Override per engine via env <ENGINE>_PYTHON (e.g. MELOTTS_PYTHON, GPTSOVITS_PYTHON);
refused if it resolves to the main interpreter (would pollute the shared stack).
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_lang_compiler_dir

_VENV_PREFIX = "py_venv_"
# pip distribution name -> python import name, for names that differ. Used to
# derive a default import-health probe when the caller does not pass one.
_PIP_TO_IMPORT = {
    "melotts": "melo",
    "opencv-python": "cv2",
    "opencv-python-headless": "cv2",
    "pyyaml": "yaml",
    "scikit-learn": "sklearn",
    "pillow": "PIL",
    "faster-whisper": "faster_whisper",
    "gpt-sovits": "GPT_SoVITS",
}
# Server/runtime deps that the api servers need; installed only if absent, since
# --system-site-packages usually already exposes them from the main interpreter.
_BASE_HEALTH = "import uvicorn, fastapi, soundfile, numpy"


def _python_version_tag() -> str:
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def venv_dir(engine: str) -> Path:
    return get_lang_compiler_dir() / f"{_VENV_PREFIX}{engine}_{_python_version_tag()}"


def _venv_python_path(engine: str) -> Path:
    if sys.platform == "win32":
        return venv_dir(engine) / "Scripts" / "python.exe"
    return venv_dir(engine) / "bin" / "python3"


def _override_env(engine: str) -> str:
    return f"{engine.upper()}_PYTHON"


def resolve_python(engine: str) -> Optional[str]:
    """Return the interpreter to launch <engine>'s api server under, or None when
    the dedicated venv has not been provisioned yet (RUNTIME - never builds)."""
    override = (os.environ.get(_override_env(engine)) or "").strip()
    if override and Path(override).is_file():
        return override
    py = _venv_python_path(engine)
    if py.is_file():
        return str(py)
    return None


def venv_ready(engine: str) -> bool:
    return resolve_python(engine) is not None


# --------------------------------------------------------------------------- #
# Install-time provisioning (called by install scripts only)                    #
# --------------------------------------------------------------------------- #
def _same_interpreter(a: str, b: str) -> bool:
    try:
        return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))
    except OSError:
        return False


def _run(argv: Sequence[str]) -> bool:
    try:
        ColorPrint.blue(f"[isolated-venv] {' '.join(str(a) for a in argv)}")
        subprocess.run(list(argv), check=True)
        return True
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[isolated-venv] command failed: {exc}")
        return False


def _pip_to_import(spec: str) -> Optional[str]:
    """Best-effort python import name for a pip requirement spec. Handles version
    pins, extras and VCS/URL installs; returns None when nothing usable can be
    derived (e.g. a raw git+https URL - the caller should pass health_imports)."""
    token = (spec or "").strip()
    if not token or token.startswith("-"):
        return None
    if "://" in token or token.startswith("git+"):
        # git+https://.../MeloTTS.git#egg=melo -> prefer the egg name if present
        match = re.search(r"#egg=([A-Za-z0-9_.\-]+)", token)
        token = match.group(1) if match else token.rsplit("/", 1)[-1]
    name = re.split(r"[<>=!~\[ @;]", token, 1)[0].strip().lower()
    name = re.sub(r"\.git$", "", name)
    if not name:
        return None
    return _PIP_TO_IMPORT.get(name, name.replace("-", "_"))


def _default_health_imports(pip_packages: Iterable[str], pins: Iterable[str]) -> str:
    names: List[str] = []
    for spec in list(pins) + list(pip_packages):
        mod = _pip_to_import(spec)
        if mod and mod not in names:
            names.append(mod)
    if not names:
        return _BASE_HEALTH
    return f"{_BASE_HEALTH}; import " + ", ".join(names)


def _venv_healthy(venv_python: str, health_imports: str) -> bool:
    """True when the health-probe imports actually SUCCEED in the venv - the only
    reliable signal under --system-site-packages, where a stale system copy would
    otherwise look 'present'."""
    try:
        out = subprocess.run(
            [venv_python, "-c", health_imports],
            capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
        )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[isolated-venv] health probe failed: {exc}")
        return False
    if out.returncode == 0:
        return True
    tail = [ln for ln in (out.stderr or "").splitlines() if ln.strip()]
    if tail:
        ColorPrint.yellow(f"[isolated-venv] venv import check failed: {tail[-1]}")
    return False


def _recreate_venv(engine: str) -> bool:
    """Remove any existing venv and create a fresh one with --system-site-packages
    so it REUSES the main interpreter's heavy packages (notably the CUDA torch);
    only the engine's version pins are layered on top inside the venv."""
    target = venv_dir(engine)
    if target.exists():
        ColorPrint.blue(f"[isolated-venv] removing existing venv at {target} ...")
        try:
            shutil.rmtree(target)
        except OSError as exc:
            ColorPrint.yellow(f"[isolated-venv] could not remove {target}: {exc}")
            return False
    target.parent.mkdir(parents=True, exist_ok=True)
    ColorPrint.blue(f"[isolated-venv] creating venv (--system-site-packages) at {target} ...")
    return _run([sys.executable, "-m", "venv", "--system-site-packages", str(target)])


def _install_into(
    venv_python: str,
    pip_packages: Sequence[str],
    pins: Sequence[str],
    health_imports: str,
    force: bool,
) -> bool:
    """Install the version pins (shadowing the system copies) plus any requested
    packages INTO the venv, reusing the system CUDA torch, then re-verify the
    import-health probe. Cheap when already healthy (one probe) unless force."""
    if not force and _venv_healthy(venv_python, health_imports):
        return True
    install_list = [*pins, *pip_packages]
    if install_list:
        ColorPrint.blue(
            "[isolated-venv] installing into venv (pins shadow system packages; system "
            f"CUDA torch reused): {', '.join(install_list)}"
        )
        _run([venv_python, "-m", "pip", "install", "--upgrade", "pip"])
        if not _run([venv_python, "-m", "pip", "install", *install_list]):
            return False
    if not _venv_healthy(venv_python, health_imports):
        ColorPrint.yellow("[isolated-venv] venv still fails the import-health probe after install")
        return False
    ColorPrint.green("[isolated-venv] import-health probe OK in the venv")
    return True


def ensure_venv(
    engine: str,
    pip_packages: Sequence[str] = (),
    pins: Sequence[str] = (),
    health_imports: Optional[str] = None,
    force: bool = False,
) -> Optional[str]:
    r"""INSTALL-TIME provisioning: return an interpreter under which <engine>'s
    api server runs cleanly, building/repairing the dedicated venv as needed.

    - ``pins``: version-pinned specs installed INTO the venv, shadowing the system
      copies (e.g. ["transformers==4.27.4"]).
    - ``pip_packages``: the engine package(s) and extra deps (may include a git URL).
    - ``health_imports``: a python one-liner whose success means the venv can run
      the server; defaults to importing the base server deps + names derived from
      ``pins``/``pip_packages`` (pass it explicitly for git/URL installs).

    The <ENGINE>_PYTHON override (an existing interpreter that already satisfies
    the pins) is used as-is unless it IS the main interpreter (refused). Otherwise
    the venv lives at get_lang_compiler_dir()/py_venv_<engine>_<ver>, created with
    --system-site-packages and REBUILT whenever the health probe fails (or force).
    """
    probe = health_imports or _default_health_imports(pip_packages, pins)

    override = (os.environ.get(_override_env(engine)) or "").strip()
    if override and Path(override).is_file():
        if _same_interpreter(override, sys.executable):
            ColorPrint.yellow(
                f"[isolated-venv] {_override_env(engine)} points at the main interpreter; "
                f"refusing to install {engine}'s pins there (would break the shared env). "
                "Falling back to the isolated venv."
            )
        else:
            ColorPrint.blue(f"[isolated-venv] using {_override_env(engine)} override: {override}")
            if not _install_into(override, pip_packages, pins, probe, force):
                return None
            ColorPrint.green(f"[isolated-venv] ready ({engine}): {override}")
            return override

    py_path = _venv_python_path(engine)
    need_rebuild = force or not py_path.is_file() or not _venv_healthy(str(py_path), probe)

    if need_rebuild:
        if not _recreate_venv(engine):
            return None
        if not py_path.is_file():
            ColorPrint.yellow(
                f"[isolated-venv] venv creation reported success but {py_path} is missing"
            )
            return None
        if not _install_into(str(py_path), pip_packages, pins, probe, force=True):
            return None

    venv_python = str(py_path)
    ColorPrint.green(f"[isolated-venv] ready ({engine}): {venv_python}")
    return venv_python


__all__ = ["venv_dir", "resolve_python", "venv_ready", "ensure_venv"]
