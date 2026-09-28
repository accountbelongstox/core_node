# -*- coding: utf-8 -*-
"""Install and repair isolated Python engine environments."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.common.python_env.isolated_venv_runtime import (
    MAIN_INTERPRETER,
    _base_identity_matches,
    _broken_distribution_specs,
    _clear_health_failure,
    _compatible,
    _core_environment_ready,
    _create_venv,
    _default_health_imports,
    _gpu_required_probe,
    _interpreter_version,
    _override_env,
    _pip_to_import,
    _record_health_failure,
    _repair_candidates,
    _run,
    _run_health_step,
    _same_interpreter,
    _stamp_matches,
    _venv_healthy,
    _venv_python_path,
    _engine_venv_dir,
    _base_interpreter_identity_for,
    _self_contained,
    _write_base_identity,
    _write_stamp,
    resolve_python,
    venv_dir,
    venv_healthy,
    venv_provisioned,
    venv_ready,
)
from pycore.pyutils.common.python_env.runtime_policy import (
    resolve_engine_base_python,
)
from pycore.pyutils.common.python_env.runtime_policy import engine_spec
from pycore.pyfoundations.runtime_abi import (
    CUDA_TIERS,
    TORCH_CPU_INDEX,
    TORCH_INDEX_BASE,
    cuda_tier_for_driver,
)


def _driver_cuda_cv() -> Optional[int]:
    """Driver-reported CUDA version as a comparable int (12.4 -> 1204).

    None when no driver report exists (driver absent or not yet loaded
    pre-reboot). Mirrors cuda_driver_cv() in base_libs/cuda_index.sh so the
    shell and Python wheel selection resolve the SAME tier from the SAME
    source (nvidia-smi), never from the host interpreter's torch health.
    """
    version = str(CUDADetector.get_cuda_info().get("cuda_version") or "").strip()
    match = re.match(r"^(\d+)(?:\.(\d+))?", version)
    if not match:
        return None
    return int(match.group(1)) * 100 + int(match.group(2) or 0)


def _wheel_tag_minimum_cv(tag: str) -> Optional[int]:
    """Minimum driver CUDA cv for one wheel tag (cu128 -> 12.8 -> 1208)."""
    match = re.fullmatch(r"cu(\d{3})", str(tag or "").strip().lower())
    if not match:
        return None
    digits = int(match.group(1))
    return (digits // 10) * 100 + (digits % 10)


def _torch_stack_target(engine: str, spec: Optional[dict] = None) -> Tuple[str, str]:
    """Resolve (device_label, torch wheel index) for one self-contained engine.

    Device policy (plan step 08): an explicit <ENGINE>_DEVICE=cpu always wins;
    cuda* selects the engine-pinned wheel tag or the newest configured tier.
    auto mirrors the shell cuda_policy_tag() driver-tier resolution (single
    source of truth: scripts/shells/ai_runtime_policy.env):
      - the driver reports a CUDA version -> the engine-pinned tag when the
        driver satisfies it, else the newest configured tier the driver
        supports, else the official CPU index;
      - no driver report but GPU hardware present (pre-driver / pre-reboot)
        -> the engine-pinned tag or newest configured tier, so the CUDA build
        is already in place when the driver loads;
      - no GPU -> the official CPU index.
    An engine may pin its CUDA wheel tag (spec torch_index_tag) when the
    upstream torch pin has no wheels on the newest configured tier (e.g.
    fishspeech torch==2.8.0).
    """
    spec = spec or engine_spec(engine)
    engine_tag = str(spec.get("torch_index_tag") or "").strip().lower()
    newest_tag = CUDA_TIERS[0]["tag"] if CUDA_TIERS else ""
    want = (os.environ.get(f"{engine.upper()}_DEVICE") or "auto").strip().lower() or "auto"
    if want == "cpu":
        return "cpu", TORCH_CPU_INDEX
    if want.startswith("cuda"):
        tag = engine_tag or newest_tag
        if not tag:
            return "cpu", TORCH_CPU_INDEX
        return "cuda", f"{TORCH_INDEX_BASE}/{tag}"
    tag = ""
    driver_cv = _driver_cuda_cv()
    if driver_cv is not None:
        engine_tag_cv = _wheel_tag_minimum_cv(engine_tag)
        if engine_tag_cv is not None and driver_cv >= engine_tag_cv:
            tag = engine_tag
        else:
            tier = cuda_tier_for_driver(driver_cv)
            tag = str(tier["tag"]) if tier else ""
    elif CUDADetector.is_gpu_hardware_present():
        tag = engine_tag or newest_tag
    if not tag:
        return "cpu", TORCH_CPU_INDEX
    return "cuda", f"{TORCH_INDEX_BASE}/{tag}"


def _torch_flavor_mismatch(
    venv_python: str,
    packages: Sequence[str],
    device_label: str,
) -> bool:
    """True when an installed torch-family wheel's build flavor contradicts the
    resolved device. PyPI's default torch/torchaudio wheels are CUDA-linked but
    carry no local version tag, while the official device-index builds are
    tagged (+cpu / +cuXXX); a CUDA-linked wheel on a CPU-only host fails at
    import time with missing libcudart."""
    names = [package.split("==", 1)[0].strip() for package in packages]
    if not names:
        return False
    want_cpu = device_label == "cpu"
    code = (
        "import importlib.metadata as m\n"
        f"names = {names!r}\n"
        "bad = []\n"
        "for name in names:\n"
        "    try:\n"
        "        version = m.version(name)\n"
        "    except m.PackageNotFoundError:\n"
        "        continue\n"
        "    local = version.partition('+')[2]\n"
        f"    if ({want_cpu!r} and local != 'cpu') or (not {want_cpu!r} and local == 'cpu'):\n"
        "        bad.append(name)\n"
        "print(' '.join(bad))\n"
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
        return False
    return bool(result.stdout.strip())


def _install_torch_stack(venv_python: str, engine: str, spec: dict) -> bool:
    """Install the engine venv's own torch stack with a device-aware index.

    Self-contained venvs share no host packages, so torch must be installed
    into the venv itself; installing it before the engine packages lets pip
    treat the pinned engine requirements as already satisfied.
    """
    packages = tuple(spec.get("torch_packages", ()))
    if not packages:
        return True
    device_label, index_url = _torch_stack_target(engine, spec)
    if _packages_importable(venv_python, packages) and not _torch_flavor_mismatch(
        venv_python, packages, device_label
    ):
        ColorPrint.blue(
            f"[isolated-venv] {engine} torch stack already importable: "
            + ", ".join(packages)
        )
        return True
    # --upgrade lets pip replace a wrong-flavor wheel (e.g. a CUDA-linked
    # torchaudio pulled from PyPI) with the device-index build: the +cpu/+cuXXX
    # local tag always sorts above its untagged twin, so the upgrade converges.
    # PyPI is offered as an extra index because the torch index carries a
    # typing-extensions wheel with broken metadata; without a fallback index
    # pip falls back to the sdist and fails on the missing flit_core backend.
    ColorPrint.blue(
        f"[isolated-venv] {engine} torch stack (device={device_label}, "
        f"index={index_url}): " + ", ".join(packages)
    )
    return _install_package_steps(
        venv_python,
        (
            "--index-url",
            index_url,
            "--extra-index-url",
            "https://pypi.org/simple/",
            "--upgrade",
        ),
        packages,
        f"installing {engine} torch stack",
    )


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
    # Group requirement-file options with their path so "-r <file>" is a single
    # pip invocation, not two broken ones.
    steps: List[Tuple[str, ...]] = []
    items = list(packages)
    index = 0
    while index < len(items):
        item = items[index]
        if item in ("-r", "--requirement") and index + 1 < len(items):
            steps.append((item, items[index + 1]))
            index += 2
        else:
            steps.append((item,))
            index += 1
    for step in steps:
        if skip_importable and len(step) == 1 and _packages_importable(venv_python, step):
            ColorPrint.blue(
                f"[isolated-venv] {label} already importable: {step[0]}"
            )
            continue
        ColorPrint.blue(f"[isolated-venv] {label}: {' '.join(step)}")
        if not _run(
            [venv_python, "-m", "pip", "install", *pip_args, *step],
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
    shared_packages: Sequence[str],
    managed_venv: bool,
    self_contained: bool = False,
) -> bool:
    constraint_path: Optional[Path] = None
    spec = engine_spec(engine)
    build_packages = tuple(spec.get("build_packages", ()))
    build_constraints = tuple(spec.get("build_constraints", ()))
    command_env = dict(spec.get("pip_env") or {})
    repair_candidates = _repair_candidates(engine, pip_packages)
    if not _repair_broken_distributions(venv_python, repair_candidates):
        return False
    if managed_venv and engine == "qwen3tts":
        if not _ensure_local_packages(venv_python, ("qwen-tts",)):
            return False
    # Self-contained venvs share no host packages: host shared-runtime
    # override removal and shared constraints do not apply (07.7).
    if managed_venv and not self_contained and not _remove_local_shared_overrides(venv_python, shared_packages):
        return False
    install_list = [*pins, *pip_packages]
    constraints = (
        () if self_contained else _shared_constraints(venv_python, shared_packages)
    )
    constraints = (*constraints, *build_constraints)
    # Self-contained venvs preinstall their torch stack from the device-aware
    # torch index, but engine packages resolved from PyPI alone can still pull
    # CUDA-linked torch/torchaudio wheels (e.g. voxcpm -> torchaudio, whose
    # default PyPI build needs libcudart). Offering the same torch index as an
    # extra index lets pip prefer the matching +cpu/+cuXXX local builds.
    engine_extra_index: Tuple[str, ...] = ()
    if self_contained and spec.get("torch_packages"):
        _, torch_index_url = _torch_stack_target(engine, spec)
        if torch_index_url:
            engine_extra_index = ("--extra-index-url", torch_index_url)
    try:
        pip_args = [venv_python, "-m", "pip", "install"]
        if constraints:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                prefix="pycore-engine-constraints-",
                suffix=".txt",
                delete=False,
                dir=str(TMP_DIR),
            ) as handle:
                handle.write("\n".join(constraints) + "\n")
                constraint_path = Path(handle.name)
            pip_args.extend(["--constraint", str(constraint_path)])
            if build_constraints:
                command_env["PIP_CONSTRAINT"] = " ".join(
                    item for item in (os.environ.get("PIP_CONSTRAINT", ""), constraint_path.resolve().as_uri()) if item
                )
                if "--no-build-isolation" not in spec.get("pip_args", ()):
                    command_env["PIP_BUILD_CONSTRAINT"] = " ".join(
                        item for item in (os.environ.get("PIP_BUILD_CONSTRAINT", ""), constraint_path.resolve().as_uri()) if item
                    )
                else:
                    command_env["PIP_BUILD_CONSTRAINT"] = ""
            ColorPrint.blue(
                "[isolated-venv] dependency constraints: " + ", ".join(constraints)
            )
        if build_packages and not _install_package_steps(
            venv_python,
            tuple(pip_args[4:]),
            build_packages,
            "ensuring engine build package",
            command_env=command_env,
        ):
            return False
        if install_list and not _install_package_steps(
            venv_python,
            (*pip_args[4:], *engine_extra_index, *spec.get("pip_args", ())),
            install_list,
            "ensuring engine package",
            command_env=command_env,
        ):
            return False
    finally:
        if constraint_path is not None:
            try:
                constraint_path.unlink(missing_ok=True)
            except OSError:
                pass
    # Engine-specific post-install steps that pip cannot express (e.g. MeloTTS
    # needs the unidic dictionary downloaded before `from melo.api import TTS`
    # can initialize MeCab at import time).
    for command in tuple(spec.get("post_install_commands", ())):
        command = tuple(command)
        ColorPrint.blue("[isolated-venv] post-install: " + " ".join(command))
        if not _run([venv_python, *command]):
            ColorPrint.yellow("[isolated-venv] post-install step failed: " + " ".join(command))
            return False
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


def _ensure_embedded_development_files(base_python: str, venv_python: str) -> bool:
    base_dir = Path(base_python).parent
    base_tag = ""
    binary_dir = Path(venv_python).parent
    target_roots = (binary_dir.parent, binary_dir)
    source_dir = None
    source_file = None
    target_root = None
    target_file = None
    directory = ""

    if sys.platform != "win32":
        return True
    base_tag = _interpreter_version(base_python).replace(".", "")
    if not (base_dir / f"python{base_tag}._pth").is_file():
        return True
    if not (base_dir / "include" / "Python.h").is_file() or not (
        base_dir / "libs" / f"python{base_tag}.lib"
    ).is_file():
        ColorPrint.yellow(
            f"[isolated-venv] Python development files missing in {base_dir}; "
            "run Step13_InstallPython310_312.ps1 before provisioning"
        )
        return False
    for directory in ("include", "libs"):
        source_dir = base_dir / directory
        for source_file in source_dir.rglob("*"):
            if not source_file.is_file():
                continue
            for target_root in target_roots:
                target_file = target_root / directory / source_file.relative_to(source_dir)
                if target_file.is_file():
                    continue
                target_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_file, target_file)
    return True


def _ensure_venv_self_contained(
    engine: str,
    packages: Sequence[str],
    resolved_pins: Sequence[str],
    probe: str,
    shared_packages: Sequence[str],
    force: bool,
    base_python: Optional[str],
) -> Optional[str]:
    """Build or repair a self-contained engine venv (plan step 07).

    The resolved base interpreter (dedicated Python 3.10 by default) creates
    the venv without host package sharing; the host 3.13 interpreter is never
    a silent fallback; the runtime always launches the venv's own absolute
    interpreter. A resolved-base change blocks reuse and is reported.
    """
    if base_python:
        resolved = {"found": True, "path": base_python, "source": "explicit_parameter"}
    else:
        resolved = resolve_engine_base_python(engine)
    base = str(resolved.get("path") or "")
    if not resolved.get("found") or not Path(base).is_file():
        ColorPrint.yellow(
            f"[isolated-venv] {engine}: "
            f"{resolved.get('reason', 'base interpreter missing')}"
        )
        return None
    if not _compatible(engine, base):
        return None
    base_tag = _interpreter_version(base)
    base_identity = _base_interpreter_identity_for(base)
    if not base_identity:
        ColorPrint.yellow(
            f"[isolated-venv] {engine}: could not probe base interpreter {base}"
        )
        return None
    target_dir = venv_dir(engine, base_tag)
    binary = target_dir / (
        Path("Scripts") / "python.exe" if sys.platform == "win32" else Path("bin") / "python3"
    )
    python_path = Path(resolve_python(engine) or str(binary))
    created = False
    if not python_path.is_file():
        if not _create_venv(engine, base_python=base, target=target_dir) or not binary.is_file():
            return None
        python_path = binary
        created = True
        _write_base_identity(engine, identity=base_identity)
    elif not _base_identity_matches(engine, expected_identity=base_identity):
        ColorPrint.yellow(
            f"[isolated-venv] {engine} venv base interpreter no longer matches "
            f"the resolved base ({base}); automatic removal is disabled"
        )
        return None
    elif not _interpreter_version(str(python_path)):
        ColorPrint.yellow(
            f"[isolated-venv] {engine} venv interpreter is unavailable; "
            "automatic removal is disabled"
        )
        return None

    if not _ensure_embedded_development_files(base, str(python_path)):
        return None

    policy_ready = _stamp_matches(engine, identity=base_identity)
    core_ready = _core_environment_ready(
        engine,
        str(python_path),
        packages,
        probe,
        engine_spec(engine),
    )
    needs_repair = force or created or not policy_ready or not core_ready
    if needs_repair:
        if not _install_torch_stack(str(python_path), engine, engine_spec(engine)):
            ColorPrint.yellow(
                f"[isolated-venv] {engine} torch stack install failed; "
                "the engine packages are not attempted this run"
            )
            return None
        if not _install_into(
            engine,
            str(python_path),
            packages,
            resolved_pins,
            probe,
            shared_packages=shared_packages,
            managed_venv=True,
            self_contained=True,
        ):
            return None
        _write_base_identity(engine, identity=base_identity)
        _write_stamp(engine, identity=base_identity)

    accelerator_ready = _install_accelerators(str(python_path), engine_spec(engine))
    if not accelerator_ready:
        ColorPrint.yellow(
            f"[isolated-venv] core environment ready ({engine}); "
            "optional accelerator remains pending"
        )

    result = str(python_path)
    ColorPrint.green(f"[isolated-venv] ready ({engine}): {result}")
    return result


def ensure_venv(
    engine: str,
    pip_packages: Optional[Sequence[str]] = None,
    pins: Optional[Sequence[str]] = None,
    health_imports: Optional[str] = None,
    force: bool = False,
    base_python: Optional[str] = None,
) -> Optional[str]:
    """Build or repair one engine venv. This function is install-time only."""
    spec = engine_spec(engine)
    packages = tuple(spec.get("packages", ())) if pip_packages is None else tuple(pip_packages)
    resolved_pins = tuple(spec.get("pins", ())) if pins is None else tuple(pins)
    shared_packages = tuple(spec.get("shared_packages", ()))
    probe = health_imports or spec.get("health_imports") or _default_health_imports(packages, resolved_pins)
    probe = _gpu_required_probe(engine, probe)
    if _self_contained(engine):
        return _ensure_venv_self_contained(
            engine,
            packages,
            resolved_pins,
            probe,
            shared_packages,
            force,
            base_python,
        )
    override = (os.environ.get(_override_env(engine)) or "").strip()

    if override and Path(override).is_file() and not _same_interpreter(override, sys.executable):
        if not _compatible(engine, override):
            return None
        core_ready = _core_environment_ready(
            engine,
            override,
            packages,
            probe,
            spec,
        )
        if force or not core_ready:
            if not _install_into(
                engine,
                override,
                packages,
                resolved_pins,
                probe,
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

    policy_ready = _stamp_matches(engine)
    core_ready = _core_environment_ready(
        engine,
        str(python_path),
        packages,
        probe,
        spec,
    )
    needs_repair = force or created or not policy_ready or not core_ready
    if needs_repair:
        if not _install_into(
            engine,
            str(python_path),
            packages,
            resolved_pins,
            probe,
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
    "venv_provisioned",
    "venv_ready",
]
