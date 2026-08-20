# -*- coding: utf-8 -*-
"""Install-time provisioning and runtime resolution for package-only engine venvs.

Managed model weights never live below these venv directories. Rebuilding a
venv may replace Python packages only; model staging, model sentinels, and
artifacts are owned by their feature-specific persistent data directories.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from pycore.pyutils.common.python_env.runtime_policy import (
    engine_compatibility,
    engine_fingerprint,
    engine_spec,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.system_paths import get_lang_compiler_dir


_VENV_PREFIX = "py_venv_"
_STAMP_NAME = ".ai_policy_fingerprint"
_BASE_IDENTITY_STAMP_NAME = ".base_interpreter_identity"
_HEALTH_FAILURE_NAME = ".ai_health_failures"
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


def _local_shared_overrides(venv_python: str, package_names: Sequence[str]) -> List[str]:
    if not package_names:
        return []
    code = (
        "import importlib.metadata as m, pathlib, sys\n"
        f"names = {list(package_names)!r}\n"
        "prefix = pathlib.Path(sys.prefix).resolve()\n"
        "for name in names:\n"
        "    try:\n"
        "        location = pathlib.Path(m.distribution(name).locate_file('')).resolve()\n"
        "        location.relative_to(prefix)\n"
        "    except (m.PackageNotFoundError, OSError, ValueError):\n"
        "        continue\n"
        "    print(name)\n"
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
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _remove_local_shared_overrides(venv_python: str, package_names: Sequence[str]) -> bool:
    overrides = _local_shared_overrides(venv_python, package_names)
    if not overrides:
        return True
    ColorPrint.yellow(
        "[isolated-venv] removing local shared-runtime overrides: " + ", ".join(overrides)
    )
    return _run([venv_python, "-m", "pip", "uninstall", "-y", *overrides])


def _ensure_local_packages(
    venv_python: str,
    package_names: Sequence[str],
) -> bool:
    """Install overlay-owned packages locally when the base already provides them."""
    local_packages = set(_local_shared_overrides(venv_python, package_names))
    missing = [name for name in package_names if name not in local_packages]
    if not missing:
        return True
    ColorPrint.blue(
        "[isolated-venv] installing overlay-owned packages: "
        + ", ".join(missing)
    )
    return _run(
        [
            venv_python,
            "-m",
            "pip",
            "install",
            "--ignore-installed",
            "--no-deps",
            *missing,
        ]
    )


def _shared_constraints(venv_python: str, package_names: Sequence[str]) -> List[str]:
    if not package_names:
        return []
    code = (
        "import importlib.metadata as m\n"
        f"names = {list(package_names)!r}\n"
        "for name in names:\n"
        "    try:\n"
        "        print(f'{name}=={m.version(name)}')\n"
        "    except m.PackageNotFoundError:\n"
        "        pass\n"
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
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _broken_distribution_specs(
    venv_python: str,
    package_names: Sequence[str],
) -> List[str]:
    """Find candidate distributions with incomplete metadata or empty payloads."""
    if not package_names:
        return []
    code = (
        "from pathlib import Path\n"
        "import sys\n"
        f"names = {list(package_names)!r}\n"
        "wanted = {name.lower().replace('_', '-') for name in names}\n"
        "for root in sys.path:\n"
        "    root_path = Path(root)\n"
        "    if not root_path.is_dir():\n"
        "        continue\n"
        "    for path in root_path.glob('*.dist-info'):\n"
        "        stem = path.name[:-10]\n"
        "        spec = None\n"
        "        for name in wanted:\n"
        "            prefix = name + '-'\n"
        "            if stem.lower().startswith(prefix):\n"
        "                spec = name + '==' + stem[len(prefix):]\n"
        "                break\n"
        "        if spec is None:\n"
        "            continue\n"
        "        if not (path / 'METADATA').is_file() or not (path / 'RECORD').is_file():\n"
        "            print(spec)\n"
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


def _repair_broken_distributions(
    venv_python: str,
    package_names: Sequence[str],
) -> bool:
    specs = _broken_distribution_specs(venv_python, package_names)
    if not specs:
        return True
    ColorPrint.yellow(
        "[isolated-venv] repairing incomplete package metadata: "
        + ", ".join(specs)
    )
    return _run(
        [
            venv_python,
            "-m",
            "pip",
            "install",
            "--ignore-installed",
            "--no-deps",
            *specs,
        ]
    )


def _packages_importable(
    venv_python: str,
    package_names: Sequence[str],
) -> bool:
    modules = [
        module
        for module in (_pip_to_import(package) for package in package_names)
        if module
    ]
    if not modules:
        return True
    result = subprocess.run(
        [venv_python, "-c", "import " + ", ".join(modules)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return result.returncode == 0


def _torch_cuda_profile(venv_python: str) -> tuple[Optional[int], Optional[int]]:
    code = (
        "import torch\n"
        "cuda = torch.version.cuda or ''\n"
        "capability = torch.cuda.get_device_capability()[0] "
        "if torch.cuda.is_available() else ''\n"
        "print(f'{cuda}|{capability}')\n"
    )
    result = subprocess.run(
        [venv_python, "-c", code],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        return None, None
    cuda_text, _, capability_text = result.stdout.strip().partition("|")
    cuda_major = int(cuda_text.split(".", 1)[0]) if cuda_text else None
    compute_major = int(capability_text) if capability_text else None
    return cuda_major, compute_major


def _nvcc_cuda_major() -> Optional[int]:
    cuda_root = (os.environ.get("CUDA_HOME") or os.environ.get("CUDA_PATH") or "").strip()
    nvcc_name = "nvcc.exe" if sys.platform == "win32" else "nvcc"
    nvcc_path = Path(cuda_root) / "bin" / nvcc_name if cuda_root else None
    if nvcc_path is None or not nvcc_path.is_file():
        resolved = shutil.which("nvcc")
        nvcc_path = Path(resolved) if resolved else None
    if nvcc_path is None:
        return None
    result = subprocess.run(
        [str(nvcc_path), "--version"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    match = re.search(r"release\s+(\d+)", result.stdout or result.stderr)
    return int(match.group(1)) if match else None


def _accelerator_supported(venv_python: str, spec: dict) -> bool:
    platforms = tuple(spec.get("accelerator_platforms", ()))
    if platforms and sys.platform not in platforms:
        ColorPrint.blue(
            f"[isolated-venv] optional accelerator is not provisioned on {sys.platform}; "
            "using the supported PyTorch attention path"
        )
        return False
    torch_cuda_major, compute_major = _torch_cuda_profile(venv_python)
    cuda_min_major = int(spec.get("accelerator_cuda_min_major", 0))
    compute_min_major = int(spec.get("accelerator_compute_min_major", 0))
    if torch_cuda_major is None or compute_major is None:
        ColorPrint.blue(
            "[isolated-venv] optional accelerator is not applicable without "
            "a compatible CUDA torch build and GPU"
        )
        return False
    if torch_cuda_major < cuda_min_major or compute_major < compute_min_major:
        ColorPrint.blue(
            "[isolated-venv] optional accelerator is not supported by the "
            "active CUDA ABI or GPU architecture"
        )
        return False
    return True


def _accelerator_toolkit_ready(venv_python: str) -> bool:
    torch_cuda_major, _ = _torch_cuda_profile(venv_python)
    nvcc_cuda_major = _nvcc_cuda_major()
    if nvcc_cuda_major is None:
        ColorPrint.yellow(
            "[isolated-venv] optional accelerator pending: CUDA Toolkit nvcc "
            "is not installed or not discoverable"
        )
        return False
    if torch_cuda_major != nvcc_cuda_major:
        ColorPrint.yellow(
            "[isolated-venv] optional accelerator pending: nvcc CUDA major "
            f"{nvcc_cuda_major} does not match torch CUDA major {torch_cuda_major}"
        )
        return False
    return True


def _accelerator_build_tools_ready(venv_python: str) -> bool:
    return _run_health_step(
        venv_python,
        "ninja executable",
        "from torch.utils.cpp_extension import verify_ninja_availability; "
        "verify_ninja_availability()",
    )


def _install_package_steps(
    venv_python: str,
    pip_args: Sequence[str],
    packages: Sequence[str],
    label: str,
    skip_importable: bool = False,
    command_env: Optional[dict] = None,
) -> bool:
    for package in packages:
        if skip_importable and _packages_importable(venv_python, (package,)):
            ColorPrint.blue(
                f"[isolated-venv] {label} already importable: {package}"
            )
            continue
        ColorPrint.blue(f"[isolated-venv] {label}: {package}")
        if not _run(
            [venv_python, "-m", "pip", "install", *pip_args, package],
            extra_env=command_env,
        ):
            return False
    return True


def _install_accelerators(
    venv_python: str,
    spec: dict,
) -> bool:
    packages = tuple(spec.get("accelerator_packages", ()))
    if not packages:
        return True
    if _packages_importable(venv_python, packages):
        ColorPrint.blue(
            "[isolated-venv] accelerator packages already importable: "
            + ", ".join(packages)
        )
        return True
    if not _accelerator_supported(venv_python, spec):
        return True
    build_packages = tuple(spec.get("accelerator_build_packages", ()))
    if not _install_package_steps(
        venv_python,
        (),
        build_packages,
        "ensuring accelerator build package",
        skip_importable=True,
    ):
        ColorPrint.yellow(
            "[isolated-venv] optional accelerator build tools are unavailable"
        )
        return False
    if not _accelerator_build_tools_ready(venv_python):
        ColorPrint.yellow(
            "[isolated-venv] repairing unusable accelerator build package: ninja"
        )
        if not _install_package_steps(
            venv_python,
            ("--ignore-installed",),
            ("ninja",),
            "repairing accelerator build package",
        ) or not _accelerator_build_tools_ready(venv_python):
            ColorPrint.yellow(
                "[isolated-venv] optional accelerator pending: ninja executable "
                "is not usable from the isolated environment"
            )
            return False
    if not _accelerator_toolkit_ready(venv_python):
        return False
    pip_args = tuple(spec.get("accelerator_pip_args", ()))
    build_env = {"MAX_JOBS": os.environ.get("MAX_JOBS", "4")}
    if not _install_package_steps(
        venv_python,
        pip_args,
        packages,
        "installing optional accelerator",
        skip_importable=True,
        command_env=build_env,
    ) or not _packages_importable(venv_python, packages):
        ColorPrint.yellow(
            "[isolated-venv] optional accelerator unavailable; using PyTorch attention"
        )
        return False
    ColorPrint.green(
        "[isolated-venv] optional accelerator ready: " + ", ".join(packages)
    )
    return True


def _install_into(
    engine: str,
    venv_python: str,
    pip_packages: Sequence[str],
    pins: Sequence[str],
    health_imports: str,
    install_required: bool,
    shared_packages: Sequence[str],
    managed_venv: bool,
) -> bool:
    constraint_path: Optional[Path] = None
    if not install_required and _venv_healthy(engine, venv_python, health_imports):
        return True
    repair_candidates = list(pip_packages)
    if engine == "qwen3tts":
        repair_candidates.extend(
            ("accelerate", "transformers", "qwen-tts", "tokenizers", "pip")
        )
    if not _repair_broken_distributions(venv_python, repair_candidates):
        return False
    if managed_venv and engine == "qwen3tts":
        if not _ensure_local_packages(venv_python, ("qwen-tts",)):
            return False
    if managed_venv and not _remove_local_shared_overrides(venv_python, shared_packages):
        return False
    install_list = [*pins, *pip_packages]
    constraints = _shared_constraints(venv_python, shared_packages)
    try:
        pip_args = [venv_python, "-m", "pip", "install"]
        if constraints:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                prefix="pycore-shared-runtime-",
                suffix=".txt",
                delete=False,
                dir=str(TMP_DIR),
            ) as handle:
                handle.write("\n".join(constraints) + "\n")
                constraint_path = Path(handle.name)
            pip_args.extend(["--constraint", str(constraint_path)])
            ColorPrint.blue(
                "[isolated-venv] preserving shared runtime: " + ", ".join(constraints)
            )
        if install_list and not _install_package_steps(
            venv_python,
            tuple(pip_args[4:]),
            install_list,
            "ensuring engine package",
        ):
            return False
    finally:
        if constraint_path is not None:
            try:
                constraint_path.unlink(missing_ok=True)
            except OSError:
                pass
    if not _venv_healthy(engine, venv_python, health_imports):
        ColorPrint.yellow("[isolated-venv] import-health probe still fails after install")
        _run_pip_check(venv_python)
        _record_health_failure(engine)
        return False
    _clear_health_failure(engine)
    return True


def _run_pip_check(venv_python: str) -> None:
    """Print dependency conflicts after a failed repair attempt."""
    try:
        result = subprocess.run(
            [venv_python, "-m", "pip", "check"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[isolated-venv] pip check could not run: {exc}")
        return
    output = (result.stdout or result.stderr or "").strip()
    ColorPrint.yellow(
        "[isolated-venv] pip check: " + (output if output else "no output")
    )


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
    shared_packages = tuple(spec.get("shared_packages", ()))
    probe = health_imports or spec.get("health_imports") or _default_health_imports(packages, resolved_pins)
    probe = _gpu_required_probe(engine, probe)
    override = (os.environ.get(_override_env(engine)) or "").strip()

    if override and Path(override).is_file() and not _same_interpreter(override, sys.executable):
        if not _compatible(engine, override):
            return None
        if not _install_into(
            engine,
            override,
            packages,
            resolved_pins,
            probe,
            install_required=force,
            shared_packages=shared_packages,
            managed_venv=False,
        ):
            return None
        accelerator_ready = _install_accelerators(override, spec)
        if not accelerator_ready:
            ColorPrint.yellow(
                f"[isolated-venv] core environment ready ({engine}); "
                "optional accelerator remains pending"
            )
        return override

    if not _compatible(engine, sys.executable):
        return None

    python_path = _venv_python_path(engine)
    created = False
    if not python_path.is_file():
        if not _create_venv(engine) or not python_path.is_file():
            return None
        created = True
        _write_base_identity(engine)
    elif not _base_identity_matches(engine):
        ColorPrint.yellow(
            f"[isolated-venv] {engine} venv uses a different base interpreter; "
            "automatic removal is disabled"
        )
        return None
    elif not _interpreter_version(str(python_path)):
        ColorPrint.yellow(
            f"[isolated-venv] {engine} venv interpreter is unavailable; "
            "automatic removal is disabled"
        )
        return None

    policy_changed = not _stamp_matches(engine)
    needs_repair = force or created or policy_changed or not _venv_healthy(engine, str(python_path), probe)
    if needs_repair:
        if not _install_into(
            engine,
            str(python_path),
            packages,
            resolved_pins,
            probe,
            install_required=force or created or policy_changed,
            shared_packages=shared_packages,
            managed_venv=True,
        ):
            return None
        _write_base_identity(engine)
        _write_stamp(engine)

    accelerator_ready = _install_accelerators(str(python_path), spec)
    if not accelerator_ready:
        ColorPrint.yellow(
            f"[isolated-venv] core environment ready ({engine}); "
            "optional accelerator remains pending"
        )

    result = str(python_path)
    ColorPrint.green(f"[isolated-venv] ready ({engine}): {result}")
    return result


__all__ = [
    "MAIN_INTERPRETER",
    "ensure_venv",
    "resolve_python",
    "venv_dir",
    "venv_healthy",
    "venv_ready",
]
