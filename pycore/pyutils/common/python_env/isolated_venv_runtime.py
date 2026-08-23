# -*- coding: utf-8 -*-
"""Runtime resolution and health checks for isolated engine environments."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.system_paths import get_lang_compiler_dir
from pycore.pyutils.common.python_env.runtime_policy import (
    engine_compatibility,
    engine_fingerprint,
    engine_spec,
)

MAIN_INTERPRETER = Path(
    getattr(sys, "_base_executable", None) or sys.executable
).resolve()
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
    "flash-attn": "flash_attn",
}


def _base_interpreter_identity() -> str:
    base_executable = getattr(sys, "_base_executable", None) or sys.executable
    try:
        executable = str(Path(base_executable).resolve())
    except OSError:
        executable = os.path.abspath(base_executable)
    return "|".join(
        (
            executable,
            sys.implementation.name,
            sys.implementation.cache_tag or "",
            str(sys.maxsize),
        )
    )


def _python_version_tag() -> str:
    return f"{sys.version_info.major}.{sys.version_info.minor}"


def venv_dir(engine: str) -> Path:
    return get_lang_compiler_dir() / (
        f"{_VENV_PREFIX}{engine}_{_python_version_tag()}"
    )


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


def _subprocess_env(executable: str) -> dict:
    env = os.environ.copy()
    executable_dir = str(Path(executable).resolve().parent)
    current_path = env.get("PATH", "")
    env["PATH"] = os.pathsep.join(
        part for part in (executable_dir, current_path) if part
    )
    return env


def _run(
    argv: Sequence[str],
    extra_env: Optional[dict] = None,
) -> bool:
    try:
        command_env = _subprocess_env(str(argv[0]))
        if extra_env:
            command_env.update(extra_env)
        ColorPrint.blue(f"[isolated-venv] {' '.join(str(item) for item in argv)}")
        subprocess.run(
            list(argv),
            check=True,
            env=command_env,
        )
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
    """Keep the import probe separate from the optional CUDA policy check."""
    return probe


def _health_probe_steps(engine: str, health_imports: str) -> List[tuple[str, str]]:
    """Return independently executable checks for engines with known imports."""
    if engine == "qwen3tts":
        return [
            ("torch", "import torch; print(torch.__file__ or '')"),
            ("torchaudio", "import torchaudio; print(torchaudio.__file__ or '')"),
            ("transformers", "import transformers; print(transformers.__file__ or '')"),
            (
                "transformers.AutoConfig",
                "from transformers.models.auto.configuration_auto import AutoConfig; "
                "print(AutoConfig.__module__)",
            ),
            (
                "transformers.AutoModel",
                "from transformers.models.auto.modeling_auto import AutoModel; "
                "print(AutoModel.__module__)",
            ),
            (
                "transformers.AutoProcessor",
                "from transformers import AutoProcessor; "
                "print(AutoProcessor.__module__)",
            ),
            (
                "transformers.GGUF_CONFIG_MAPPING",
                "from transformers.integrations.ggml import GGUF_CONFIG_MAPPING; "
                "print(len(GGUF_CONFIG_MAPPING))",
            ),
            ("accelerate", "import accelerate; print(accelerate.__file__ or '')"),
            ("librosa", "import librosa; print(librosa.__file__ or '')"),
            ("soundfile", "import soundfile; print(soundfile.__file__ or '')"),
            ("sox", "import sox; print(sox.__file__ or '')"),
            ("onnxruntime", "import onnxruntime; print(onnxruntime.__file__ or '')"),
            ("einops", "import einops; print(einops.__file__ or '')"),
            ("uvicorn", "import uvicorn; print(uvicorn.__file__ or '')"),
            ("fastapi", "import fastapi; print(fastapi.__file__ or '')"),
            ("pydub", "import pydub; print(pydub.__file__ or '')"),
            ("qwen_tts.Qwen3TTSModel", "import qwen_tts; from qwen_tts import Qwen3TTSModel; print(qwen_tts.__file__ or '')"),
        ]
    return [("health_imports", health_imports)]


def _run_health_step(venv_python: str, label: str, code: str) -> bool:
    try:
        result = subprocess.run(
            [venv_python, "-c", code],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            env=_subprocess_env(venv_python),
        )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[isolated-venv] FAIL: {label} ({exc})")
        return False
    if result.returncode == 0:
        location = (result.stdout or "").strip()
        suffix = f" [{location}]" if location else ""
        ColorPrint.blue(f"[isolated-venv] PASS: {label}{suffix}")
        return True
    ColorPrint.yellow(f"[isolated-venv] FAIL: {label}")
    _print_probe_failure(venv_python, code, result.stderr)
    return False


def _print_probe_failure(venv_python: str, probe: str, stderr: str) -> None:
    lines = [line for line in (stderr or "").splitlines() if line.strip()]
    ColorPrint.yellow(f"[isolated-venv] probe python: {venv_python}")
    ColorPrint.yellow(f"[isolated-venv] probe: {probe}")
    if lines:
        if len(lines) <= 32:
            visible_lines = lines
            heading = "[isolated-venv] stderr:"
        else:
            visible_lines = lines[:12] + ["... (middle omitted) ..."] + lines[-20:]
            heading = "[isolated-venv] stderr (first 12 + last 20 lines):"
        ColorPrint.yellow(heading)
        for line in visible_lines:
            ColorPrint.yellow(f"  {line}")


def _cuda_probe_required(engine: str) -> bool:
    if not engine_spec(engine).get("require_cuda_when_present"):
        return False
    try:
        return bool(CUDADetector.is_cuda_available())
    except Exception:  # noqa: BLE001
        return False


def _run_cuda_probe(venv_python: str) -> bool:
    return _run_health_step(
        venv_python,
        "torch.cuda.is_available",
        "import torch; assert torch.cuda.is_available(), "
        "'CUDA GPU detected but venv torch is CPU-only'",
    )


def _venv_healthy(engine: str, venv_python: str, health_imports: str) -> bool:
    return all(
        _run_health_step(venv_python, label, code)
        for label, code in _health_probe_steps(engine, health_imports)
    ) and (
        not _cuda_probe_required(engine) or _run_cuda_probe(venv_python)
    )


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
    return _venv_healthy(engine, python_path, probe)


def _broken_distribution_specs(
    venv_python: str,
    package_names: Sequence[str],
    verify_payload: bool = True,
) -> List[str]:
    """Find candidate distributions with incomplete metadata or empty payloads."""
    if not package_names:
        return []
    code = (
        "from pathlib import Path\n"
        "import sys\n"
        f"names = {list(package_names)!r}\n"
        f"verify_payload = {verify_payload!r}\n"
        "wanted = {name.lower().replace('_', '-') for name in names}\n"
        "for root in sys.path:\n"
        "    root_path = Path(root)\n"
        "    if not root_path.is_dir():\n"
        "        continue\n"
        "    for path in root_path.glob('*.dist-info'):\n"
        "        stem = path.name[:-10]\n"
        "        normalized_stem = stem.lower().replace('_', '-')\n"
        "        spec = None\n"
        "        for name in wanted:\n"
        "            prefix = name + '-'\n"
        "            if normalized_stem.startswith(prefix):\n"
        "                spec = name + '==' + stem[len(prefix):]\n"
        "                break\n"
        "        if spec is None:\n"
        "            continue\n"
        "        if not (path / 'METADATA').is_file() or not (path / 'RECORD').is_file():\n"
        "            print(spec)\n"
        "            continue\n"
        "        if not verify_payload:\n"
        "            continue\n"
        "        record_missing = False\n"
        "        for record_line in (path / 'RECORD').read_text(errors='replace').splitlines():\n"
        "            relative = record_line.split(',', 1)[0].strip()\n"
        "            if relative and not (root_path / relative).is_file():\n"
        "                record_missing = True\n"
        "                break\n"
        "        if record_missing:\n"
        "            print(spec)\n"
        "            continue\n"
        "        top_level = path / 'top_level.txt'\n"
        "        if not top_level.is_file():\n"
        "            continue\n"
        "        entries = [line.strip() for line in top_level.read_text(errors='replace').splitlines() if line.strip()]\n"
        "        if any(not (root_path / entry).exists() or not any(item.is_file() for item in (root_path / entry).rglob('*')) for entry in entries):\n"
        "            print(spec)\n"
    )
    try:
        result = subprocess.run(
            [venv_python, "-c", code],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError:
        return []
    if result.returncode != 0:
        return []
    return sorted(set(line.strip() for line in result.stdout.splitlines() if line.strip()))


def _repair_candidates(
    engine: str,
    package_names: Sequence[str],
) -> List[str]:
    candidates = list(package_names)
    if engine == "qwen3tts":
        candidates.extend(
            ("accelerate", "transformers", "qwen-tts", "tokenizers", "pip")
        )
    return candidates


def _missing_module_specs(
    venv_python: str,
    module_names: Sequence[str],
) -> List[str]:
    if not module_names:
        return []
    code = (
        "import importlib.util, json\n"
        f"names = {list(module_names)!r}\n"
        "missing = [name for name in names if importlib.util.find_spec(name) is None]\n"
        f"print({_MODULE_STATE_MARKER!r} + json.dumps(missing))\n"
    )
    try:
        result = subprocess.run(
            [venv_python, "-c", code],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            env=_subprocess_env(venv_python),
        )
    except OSError:
        return list(module_names)
    marker_line = next(
        (
            line
            for line in result.stdout.splitlines()
            if line.startswith(_MODULE_STATE_MARKER)
        ),
        "",
    )
    if not marker_line:
        return list(module_names)
    missing = json.loads(marker_line[len(_MODULE_STATE_MARKER):])
    return [str(name) for name in missing]


def _core_environment_ready(
    engine: str,
    venv_python: str,
    package_names: Sequence[str],
    health_imports: str,
    spec: dict,
) -> bool:
    provision_modules = tuple(spec.get("provision_modules", ()))
    if not provision_modules:
        return _venv_healthy(engine, venv_python, health_imports)
    missing_modules = _missing_module_specs(venv_python, provision_modules)
    broken_distributions = _broken_distribution_specs(
        venv_python,
        _repair_candidates(engine, package_names),
        verify_payload=False,
    )
    cuda_ready = (
        not _cuda_probe_required(engine)
        or _run_cuda_probe(venv_python)
    )
    if missing_modules:
        ColorPrint.yellow(
            "[isolated-venv] missing module specs: "
            + ", ".join(missing_modules)
        )
    if broken_distributions:
        ColorPrint.yellow(
            "[isolated-venv] incomplete package metadata: "
            + ", ".join(broken_distributions)
        )
    return not missing_modules and not broken_distributions and cuda_ready


def venv_provisioned(engine: str) -> bool:
    """Return whether each persisted core dependency state has converged."""
    python_path = resolve_python(engine)
    if not python_path:
        return False
    spec = engine_spec(engine)
    packages = tuple(spec.get("packages", ()))
    pins = tuple(spec.get("pins", ()))
    probe = spec.get("health_imports") or _default_health_imports(packages, pins)
    override = (os.environ.get(_override_env(engine)) or "").strip()
    using_override = bool(override and _same_interpreter(override, python_path))
    policy_ready = using_override or _stamp_matches(engine)
    core_ready = _core_environment_ready(
        engine,
        python_path,
        packages,
        probe,
        spec,
    )
    return policy_ready and core_ready


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


def _health_failure_path(engine: str) -> Path:
    return venv_dir(engine) / _HEALTH_FAILURE_NAME


def _record_health_failure(engine: str) -> None:
    # AI remediation plan (documented, not executed here): when an isolated
    # Qwen3TTS venv reaches the repeated-failure threshold, rebuild that venv
    # with `base_python -m venv --clear --system-site-packages <venv_dir>`.
    # Never copy the main interpreter's site-packages into the venv. Preserve
    # model weights and sentinels, then reinstall the Qwen requirements with
    # pip and rerun the health probes. If the rebuilt venv still fails, print
    # this plan and the failing probe so an AI operator can apply it safely.
    path = _health_failure_path(engine)
    try:
        count = int(path.read_text(encoding="utf-8-sig").strip() or "0") + 1
    except (OSError, ValueError):
        count = 1
    try:
        path.write_text(str(count), encoding="utf-8")
    except OSError:
        count = 3
    if count >= 3:
        ColorPrint.yellow(
            f"[isolated-venv] {engine} failed the same health path repeatedly; "
            "rerun the installer with -Force to rebuild the dependency overlay."
        )


def _clear_health_failure(engine: str) -> None:
    try:
        _health_failure_path(engine).unlink(missing_ok=True)
    except OSError:
        pass


def _base_identity_stamp_path(engine: str) -> Path:
    return venv_dir(engine) / _BASE_IDENTITY_STAMP_NAME


def _venv_interpreter_identity(engine: str) -> str:
    code = (
        "import pathlib, sys\n"
        "base = getattr(sys, '_base_executable', None) or sys.executable\n"
        "print('|'.join((str(pathlib.Path(base).resolve()), "
        "sys.implementation.name, sys.implementation.cache_tag or '', str(sys.maxsize))))\n"
    )
    python_path = _venv_python_path(engine)
    result: subprocess.CompletedProcess[str]

    if not python_path.is_file():
        return ""
    try:
        result = subprocess.run(
            [str(python_path), "-c", code],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def _base_identity_matches(engine: str) -> bool:
    current_identity = _base_interpreter_identity()
    stored_identity = ""

    try:
        stored_identity = _base_identity_stamp_path(engine).read_text(
            encoding="utf-8-sig"
        ).strip()
    except OSError:
        pass
    if stored_identity == current_identity:
        return True

    # Adopt pre-stamp environments only after the venv confirms its real base
    # interpreter. A missing migration stamp is not evidence of a stale venv.
    if _venv_interpreter_identity(engine) != current_identity:
        return False
    _write_base_identity(engine)
    ColorPrint.blue(f"[isolated-venv] adopted existing {engine} venv identity in place")
    return True


def _write_base_identity(engine: str) -> None:
    try:
        _base_identity_stamp_path(engine).write_text(
            _base_interpreter_identity(),
            encoding="utf-8",
        )
    except OSError as exc:
        ColorPrint.yellow(
            "[isolated-venv] could not write base interpreter identity: "
            f"{exc}"
        )


def _venv_fingerprint(engine: str) -> str:
    payload = "|".join(
        (
            engine_fingerprint(engine),
            _base_interpreter_identity(),
        )
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _stamp_matches(engine: str) -> bool:
    try:
        stored = _stamp_path(engine).read_text(
            encoding="utf-8-sig"
        ).strip()
        return stored == _venv_fingerprint(engine)
    except OSError:
        return False


def _write_stamp(engine: str) -> None:
    try:
        _stamp_path(engine).write_text(
            _venv_fingerprint(engine),
            encoding="utf-8",
        )
    except OSError as exc:
        ColorPrint.yellow(f"[isolated-venv] could not write policy stamp: {exc}")


def _create_venv(engine: str) -> bool:
    target = venv_dir(engine)
    target.parent.mkdir(parents=True, exist_ok=True)
    ColorPrint.blue(
        "[isolated-venv] creating shared-runtime overlay "
        f"(--system-site-packages) at {target} ..."
    )
    return _run([sys.executable, "-m", "venv", "--system-site-packages", str(target)])




__all__ = [
    "MAIN_INTERPRETER",
    "_base_identity_matches",
    "_broken_distribution_specs",
    "_clear_health_failure",
    "_compatible",
    "_core_environment_ready",
    "_create_venv",
    "_cuda_probe_required",
    "_default_health_imports",
    "_gpu_required_probe",
    "_interpreter_version",
    "_override_env",
    "_pip_to_import",
    "_record_health_failure",
    "_repair_candidates",
    "_run",
    "_run_cuda_probe",
    "_run_health_step",
    "_same_interpreter",
    "_stamp_matches",
    "_subprocess_env",
    "_venv_healthy",
    "_venv_python_path",
    "_write_base_identity",
    "_write_stamp",
    "resolve_python",
    "venv_dir",
    "venv_healthy",
    "venv_provisioned",
    "venv_ready",
]
