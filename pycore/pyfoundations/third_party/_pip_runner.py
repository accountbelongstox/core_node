# -*- coding: utf-8 -*-
"""
Pip / subprocess execution layer over Commander.

All third-party subprocess execution MUST go through run_third_party_command() only.
- Stream mode (capture_output=False): Popen with stdout=None, stderr=None so output and
  progress bar are real-time (docs: "With the default settings of None, no redirection will occur").
- Capture mode (capture_output=True): subprocess.run(capture_output=True) for pip show etc.
Ref: https://docs.python.org/3/library/subprocess.html

Imports _PACKAGE_CACHE from the leaf-only package cache.
"""

import sys
import importlib
import platform
from typing import Optional

from packaging.requirements import InvalidRequirement, Requirement

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import Commander
from pycore.pyfoundations.pybasecommon.safe_subprocess import subprocess
from pycore.pyfoundations.pybasecommon.compute_caps import last_ort_install_ran

from ._package_cache import _PACKAGE_CACHE


def run_third_party_command(
    cmd: list,
    description: str = "",
    capture_output: bool = False,
    timeout: Optional[int] = None,
) -> Optional[subprocess.CompletedProcess]:
    """
    THE SINGLE METHOD FOR ALL THIRD-PARTY SUBPROCESS EXECUTION IN THIS MODULE.
    Delegates to Commander.run_command (base implementation in pyfoundations).
    - capture_output=False (default): run with inherited stdout/stderr (real-time, progress bar).
    - capture_output=True: returns CompletedProcess (e.g. pip show).
    """
    if not capture_output:
        cmd_str = " ".join(str(x) for x in cmd)
        if description:
            print(f"[{description}] Executing: {cmd_str}")
        else:
            print(f"Executing command: {cmd_str}")
        sys.stdout.flush()
    return Commander.run_command(cmd, capture_output=capture_output, timeout=timeout)


def build_pip_install_command(
    package_name: str,
    index_url: Optional[str] = None,
) -> list:
    """
    Build pip install command (list of args) with platform-specific flags.
    Callers must run it only via run_pip_install_with_realtime_output(pip_cmd, package_name).
    Existing distributions are preserved; pip resolves dependencies for missing packages.
    """
    current_platform = platform.system()
    pip_cmd = [sys.executable, "-m", "pip", "install"]

    # Linux may require the explicit system-package override; never ignore installed packages.
    if current_platform != 'Windows':
        pip_cmd.append("--break-system-packages")
    else:
        pip_cmd.append("--no-user")

    if index_url:
        pip_cmd.extend(["--index-url", index_url])
    pip_cmd.append(package_name)
    return pip_cmd


def run_pip_install_with_realtime_output(pip_cmd: list, package_name: str) -> None:
    """
    THE SINGLE PUBLIC METHOD FOR ALL PIP EXECUTION IN THIS MODULE.
    Real-time output only, no ColorPrint; success/failure is entirely determined by pip.
    Every pip install (torch, deps, pip upgrade, optional packages) must call this only.
    """
    run_third_party_command(pip_cmd)


def run_command_with_realtime_output(cmd: list, description: str = "") -> None:
    """
    Run arbitrary command with same real-time behavior (inherited stdout/stderr, no ColorPrint).
    For pip, use run_pip_install_with_realtime_output instead.
    """
    run_third_party_command(cmd, description)


def _is_pip_package_installed(package_name: str) -> bool:
    """Detect distribution metadata through pip output without using its exit status."""
    try:
        distribution_name = Requirement(package_name).name
    except InvalidRequirement:
        distribution_name = package_name.strip()
    if not distribution_name or "://" in distribution_name:
        return False
    proc = run_third_party_command(
        [sys.executable, "-m", "pip", "show", distribution_name],
        capture_output=True,
        timeout=10,
    )
    output = (getattr(proc, "stdout", "") or "") if proc is not None else ""
    return any(line.strip().lower().startswith("name:") for line in output.splitlines())


def _run_pip_uninstall(package_name: str) -> None:
    """
    Run pip uninstall -y <package_name> with real-time output.
    Used before OCR init to clear the other ONNX runtime (onnxruntime vs onnxruntime-gpu mutually exclusive).
    Non-zero exit (e.g. package not installed) is ignored.
    """
    cmd = [sys.executable, "-m", "pip", "uninstall", "-y", package_name]
    run_third_party_command(cmd, "pip uninstall")


def _run_pip_install_for_ocr(package_name: str, index_url: Optional[str] = None) -> None:
    """
    Run pip install <package_name> with real-time output.
    Used to install ONNX Runtime or centralized CUDA-policy dependency specs. index_url optional.
    """
    pip_cmd = build_pip_install_command(package_name, index_url=index_url)
    run_pip_install_with_realtime_output(pip_cmd, package_name)


def _run_pip_install_for_ocr_force(package_name: str) -> None:
    """Preserve installed ORT metadata; only install the package when it is missing."""
    if _is_pip_package_installed(package_name):
        ColorPrint.yellow(f"[ORT] {package_name} is installed but cannot load; preserving it for installer repair.")
    else:
        _run_pip_install_for_ocr(package_name)


def _fix_ort_dependency_conflicts() -> None:
    """
    Run only when ORT GPU was just installed (last_ort_install_ran()). Pip may then report numba/osam conflicts.
    Fix without version pinning: upgrade numba (may accept current numpy); reinstall osam --no-deps so it keeps using onnxruntime-gpu.
    """
    if not last_ort_install_ran():
        return
    ColorPrint.blue("[ORT] Pip owns dependency compatibility; installed distributions are preserved.")


def _verify_onnx_import() -> bool:
    """Return True if 'import onnxruntime as ort; ort.get_available_providers()' succeeds in a subprocess."""
    proc = run_third_party_command(
        [sys.executable, "-c", "import onnxruntime as ort; ort.get_available_providers(); print('__ORT_READY__')"],
        capture_output=True,
        timeout=30,
    )
    output = (getattr(proc, "stdout", "") or "") if proc is not None else ""
    return "__ORT_READY__" in output


def _clear_cnocr_cache() -> None:
    """Remove cnocr from package cache and sys.modules so next get_cnocr re-imports with new ONNX runtime."""
    _PACKAGE_CACHE.pop("cnocr", None)
    for key in list(sys.modules.keys()):
        if key == "cnocr" or key.startswith("cnocr."):
            del sys.modules[key]
    importlib.invalidate_caches()
