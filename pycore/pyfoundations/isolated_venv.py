# -*- coding: utf-8 -*-
"""Install-time provisioning and runtime resolution for isolated engine venvs."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from pycore.pyfoundations.ai_runtime_policy import (
    engine_compatibility,
    engine_fingerprint,
    engine_spec,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.system_paths import get_lang_compiler_dir


_VENV_PREFIX = "py_venv_"
_STAMP_NAME = ".ai_policy_fingerprint"
_BASE_HEALTH = "import uvicorn, fastapi, soundfile, numpy"
_PIP_TO_IMPORT = {
    "melotts": "melo",
    "opencv-python": "cv2",
    "opencv-python-headless": "cv2",
    "pyyaml": "yaml",
    "scikit-learn": "sklearn",
    "pillow": "PIL",
    "faster-whisper": "faster_whisper",
    "gpt-sovits": "GPT_SoVITS",
    "qwen-tts": "qwen_tts",
}


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


def _same_interpreter(first: str, second: str) -> bool:
    try:
        return os.path.normcase(os.path.realpath(first)) == os.path.normcase(os.path.realpath(second))
    except OSError:
        return False


def resolve_python(engine: str) -> Optional[str]:
    """Resolve a pre-built isolated interpreter without installing anything."""
    override = (os.environ.get(_override_env(engine)) or "").strip()
    if override and Path(override).is_file() and not _same_interpreter(override, sys.executable):
        return override
    python_path = _venv_python_path(engine)
    if python_path.is_file():
        return str(python_path)
    return None


def venv_ready(engine: str) -> bool:
    return resolve_python(engine) is not None


def _run(argv: Sequence[str]) -> bool:
    try:
        ColorPrint.blue(f"[isolated-venv] {' '.join(str(item) for item in argv)}")
        subprocess.run(list(argv), check=True)
        return True
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[isolated-venv] command failed: {exc}")
        return False


def _pip_to_import(spec: str) -> Optional[str]:
    token = (spec or "").strip()
    if not token or token.startswith("-"):
        return None
    if "://" in token or token.startswith("git+"):
        match = re.search(r"#egg=([A-Za-z0-9_.\-]+)", token)
        token = match.group(1) if match else token.rsplit("/", 1)[-1]
    name = re.split(r"[<>=!~\[ @;]", token, 1)[0].strip().lower()
    name = re.sub(r"\.git$", "", name)
    if not name:
        return None
    return _PIP_TO_IMPORT.get(name, name.replace("-", "_"))


def _default_health_imports(pip_packages: Iterable[str], pins: Iterable[str]) -> str:
    names: List[str] = []
    for requirement in list(pins) + list(pip_packages):
        module = _pip_to_import(requirement)
        if module and module not in names:
            names.append(module)
    if not names:
        return _BASE_HEALTH
    return f"{_BASE_HEALTH}; import " + ", ".join(names)


def _gpu_required_probe(engine: str, probe: str) -> str:
    spec = engine_spec(engine)
    if not spec.get("require_cuda_when_present"):
        return probe
    try:
        gpu_present = bool(CUDADetector.is_cuda_available())
    except Exception:  # noqa: BLE001
        gpu_present = False
    if not gpu_present:
        return probe
    return probe + "; assert torch.cuda.is_available(), 'CUDA GPU detected but venv torch is CPU-only'"


def _venv_healthy(venv_python: str, health_imports: str) -> bool:
    try:
        result = subprocess.run(
            [venv_python, "-c", health_imports],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[isolated-venv] health probe failed: {exc}")
        return False
    if result.returncode == 0:
        return True
    tail = [line for line in (result.stderr or "").splitlines() if line.strip()]
    if tail:
        ColorPrint.yellow(f"[isolated-venv] venv import check failed: {tail[-1]}")
    return False


def venv_healthy(engine: str) -> bool:
    """Return whether an existing isolated interpreter matches policy and imports."""
    python_path = resolve_python(engine)
    if not python_path:
        return False
    spec = engine_spec(engine)
    packages = tuple(spec.get("packages", ()))
    pins = tuple(spec.get("pins", ()))
    probe = spec.get("health_imports") or _default_health_imports(packages, pins)
    probe = _gpu_required_probe(engine, probe)
    override = (os.environ.get(_override_env(engine)) or "").strip()
    using_override = bool(override and _same_interpreter(override, python_path))
    if not using_override and not _stamp_matches(engine):
        return False
    return _venv_healthy(python_path, probe)


def _interpreter_version(python_exe: str) -> str:
    try:
        result = subprocess.run(
            [python_exe, "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        return (result.stdout or "").strip()
    except OSError:
        return ""


def _compatible(engine: str, python_exe: str) -> bool:
    version = _interpreter_version(python_exe)
    if not version:
        return False
    result = engine_compatibility(engine, version)
    if result.get("compatible"):
        return True
    ColorPrint.yellow(f"[isolated-venv] {engine} skipped: {result.get('reason', 'incompatible Python')}")
    return False


def _stamp_path(engine: str) -> Path:
    return venv_dir(engine) / _STAMP_NAME


def _stamp_matches(engine: str) -> bool:
    try:
        return _stamp_path(engine).read_text(encoding="utf-8-sig").strip() == engine_fingerprint(engine)
    except OSError:
        return False


def _write_stamp(engine: str) -> None:
    try:
        _stamp_path(engine).write_text(engine_fingerprint(engine), encoding="utf-8")
    except OSError as exc:
        ColorPrint.yellow(f"[isolated-venv] could not write policy stamp: {exc}")


def _recreate_venv(engine: str) -> bool:
    target = venv_dir(engine)
    if target.exists():
        ColorPrint.blue(f"[isolated-venv] removing stale venv at {target} ...")
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
    if not force and _venv_healthy(venv_python, health_imports):
        return True
    install_list = [*pins, *pip_packages]
    if install_list:
        ColorPrint.blue(f"[isolated-venv] installing: {', '.join(install_list)}")
        if not _run([venv_python, "-m", "pip", "install", *install_list]):
            return False
    if not _venv_healthy(venv_python, health_imports):
        ColorPrint.yellow("[isolated-venv] import-health probe still fails after install")
        return False
    return True


def ensure_venv(
    engine: str,
    pip_packages: Optional[Sequence[str]] = None,
    pins: Optional[Sequence[str]] = None,
    health_imports: Optional[str] = None,
    force: bool = False,
) -> Optional[str]:
    """Build or repair one engine venv. This function is install-time only."""
    spec = engine_spec(engine)
    packages = tuple(spec.get("packages", ())) if pip_packages is None else tuple(pip_packages)
    resolved_pins = tuple(spec.get("pins", ())) if pins is None else tuple(pins)
    probe = health_imports or spec.get("health_imports") or _default_health_imports(packages, resolved_pins)
    probe = _gpu_required_probe(engine, probe)
    override = (os.environ.get(_override_env(engine)) or "").strip()

    if override and Path(override).is_file() and not _same_interpreter(override, sys.executable):
        if not _compatible(engine, override):
            return None
        if not _install_into(override, packages, resolved_pins, probe, force):
            return None
        return override

    if not _compatible(engine, sys.executable):
        return None

    python_path = _venv_python_path(engine)
    needs_rebuild = (
        force
        or not python_path.is_file()
        or not _stamp_matches(engine)
        or not _venv_healthy(str(python_path), probe)
    )
    if needs_rebuild:
        if not _recreate_venv(engine) or not python_path.is_file():
            return None
        if not _install_into(str(python_path), packages, resolved_pins, probe, force=True):
            return None
        _write_stamp(engine)

    result = str(python_path)
    ColorPrint.green(f"[isolated-venv] ready ({engine}): {result}")
    return result


__all__ = ["ensure_venv", "resolve_python", "venv_dir", "venv_healthy", "venv_ready"]
