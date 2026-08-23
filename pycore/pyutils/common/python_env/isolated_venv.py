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
from typing import List, Optional, Sequence

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.common.python_env.isolated_venv_runtime import (
    MAIN_INTERPRETER,
    _base_identity_matches,
    _broken_distribution_specs,
    _clear_health_failure,
    _compatible,
    _core_environment_ready,
    _create_venv,
    _cuda_probe_required,
    _default_health_imports,
    _gpu_required_probe,
    _interpreter_version,
    _override_env,
    _pip_to_import,
    _record_health_failure,
    _repair_candidates,
    _run,
    _run_cuda_probe,
    _run_health_step,
    _same_interpreter,
    _stamp_matches,
    _subprocess_env,
    _venv_healthy,
    _venv_python_path,
    _write_base_identity,
    _write_stamp,
    resolve_python,
    venv_dir,
    venv_healthy,
    venv_provisioned,
    venv_ready,
)
from pycore.pyutils.common.python_env.runtime_policy import engine_spec


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
    shared_packages: Sequence[str],
    managed_venv: bool,
) -> bool:
    constraint_path: Optional[Path] = None
    repair_candidates = _repair_candidates(engine, pip_packages)
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
