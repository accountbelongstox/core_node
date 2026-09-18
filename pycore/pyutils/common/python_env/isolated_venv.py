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
)


def _host_cuda_available() -> bool:
    """Probe CUDA usability through the host interpreter's torch (install-time
    only; the host carries torch as a shared prerequisite)."""
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:  # noqa: BLE001
        return False


def _torch_stack_target(engine: str, spec: Optional[dict] = None) -> Tuple[str, str]:
    """Resolve (device_label, torch wheel index) for one self-contained engine.

    Device policy (plan step 08): an explicit <ENGINE>_DEVICE=cpu always wins;
    cuda* selects the configured CUDA wheel tier; auto uses the host CUDA probe
    and falls back to the official CPU index. The CPU index is the official
    pytorch CPU wheel source, not a stripped dependency set. An engine may pin
    its CUDA wheel tag (spec torch_index_tag) when the upstream torch pin has
    no wheels on the newest configured tier (e.g. fishspeech torch==2.8.0).
    """
    spec = spec or engine_spec(engine)
    cuda_tag = str(spec.get("torch_index_tag") or "").strip().lower() or (
        CUDA_TIERS[0]["tag"] if CUDA_TIERS else "cpu"
    )
    want = (os.environ.get(f"{engine.upper()}_DEVICE") or "auto").strip().lower() or "auto"
    if want == "cpu":
        return "cpu", TORCH_CPU_INDEX
    if want.startswith("cuda"):
        if cuda_tag == "cpu":
            return "cpu", TORCH_CPU_INDEX
        return "cuda", f"{TORCH_INDEX_BASE}/{cuda_tag}"
    if _host_cuda_available() and cuda_tag != "cpu":
        return "cuda", f"{TORCH_INDEX_BASE}/{cuda_tag}"
    return "cpu", TORCH_CPU_INDEX


def _install_torch_stack(venv_python: str, engine: str, spec: dict) -> bool:
    """Install the engine venv's own torch stack with a device-aware index.

    Self-contained venvs share no host packages, so torch must be installed
    into the venv itself; installing it before the engine packages lets pip
    treat the pinned engine requirements as already satisfied.
    """
    packages = tuple(spec.get("torch_packages", ()))
    if not packages:
        return True
    if _packages_importable(venv_python, packages):
        ColorPrint.blue(
            f"[isolated-venv] {engine} torch stack already importable: "
            + ", ".join(packages)
        )
        return True
    device_label, index_url = _torch_stack_target(engine, spec)
    ColorPrint.blue(
        f"[isolated-venv] {engine} torch stack (device={device_label}, "
        f"index={index_url}): " + ", ".join(packages)
    )
    return _install_package_steps(
        venv_python,
        ("--index-url", index_url),
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
    command_env = {}
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
            (*pip_args[4:], *spec.get("pip_args", ())),
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
