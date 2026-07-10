# -*- coding: utf-8 -*-
"""
Pip / subprocess execution layer over Commander.

All third-party subprocess execution MUST go through run_third_party_command() only.
- Stream mode (capture_output=False): Popen with stdout=None, stderr=None so output and
  progress bar are real-time (docs: "With the default settings of None, no redirection will occur").
- Capture mode (capture_output=True): subprocess.run(capture_output=True) for pip show etc.
Ref: https://docs.python.org/3/library/subprocess.html

Imports _PACKAGE_CACHE from _cache (for _clear_cnocr_cache).
"""

import sys
import importlib
import platform
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import Commander
from pycore.pyfoundations.pybasecommon.safe_subprocess import subprocess
from pycore.pyfoundations.pybasecommon.compute_caps import last_ort_install_ran

from ._cache import _PACKAGE_CACHE


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
    upgrade: bool = False,
    index_url: Optional[str] = None,
) -> list:
    """
    Build pip install command (list of args) with platform-specific flags.
    Callers must run it only via run_pip_install_with_realtime_output(pip_cmd, package_name).
    If upgrade is True, adds --upgrade. If index_url is set (e.g. ORT CUDA 11 feed), adds --index-url.
    """
    current_platform = platform.system()
    pip_cmd = [sys.executable, "-m", "pip", "install"]

    # On Linux/Mac, use --break-system-packages --ignore-installed for reliable installation
    # On Windows, use normal pip install
    if current_platform != 'Windows':
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")

    if upgrade:
        pip_cmd.append("--upgrade")
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
    """Return True if the package is installed (pip show succeeds). Used to skip uninstall/install when no switch needed."""
    proc = run_third_party_command(
        [sys.executable, "-m", "pip", "show", package_name],
        capture_output=True,
        timeout=10,
    )
    return proc.returncode == 0 if proc is not None else False


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
    Used to install onnxruntime-gpu[cuda,cudnn], onnxruntime, or nvidia-cublas-cu12. index_url optional.
    """
    pip_cmd = build_pip_install_command(package_name, index_url=index_url)
    run_pip_install_with_realtime_output(pip_cmd, package_name)


def _run_pip_install_for_ocr_force(package_name: str) -> None:
    """Run pip install <package_name> --force-reinstall. Used when ORT GPU is listed but import fails."""
    pip_cmd = build_pip_install_command(package_name) + ["--force-reinstall"]
    run_pip_install_with_realtime_output(pip_cmd, package_name)


def _fix_ort_dependency_conflicts() -> None:
    """
    Run only when ORT GPU was just installed (last_ort_install_ran()). Pip may then report numba/osam conflicts.
    Fix without version pinning: upgrade numba (may accept current numpy); reinstall osam --no-deps so it keeps using onnxruntime-gpu.
    """
    if not last_ort_install_ran():
        return
    if _is_pip_package_installed("numba"):
        ColorPrint.blue("[HF] Reinstalling numba (no version pin) after ORT install...")
        pip_cmd = build_pip_install_command("numba", upgrade=True)
        run_pip_install_with_realtime_output(pip_cmd, "numba")
    if _is_pip_package_installed("osam"):
        ColorPrint.blue("[HF] Reinstalling osam with --no-deps (onnxruntime-gpu satisfies runtime)...")
        pip_cmd = build_pip_install_command("osam", upgrade=True) + ["--no-deps"]
        run_pip_install_with_realtime_output(pip_cmd, "osam")


def _verify_onnx_import() -> bool:
    """Return True if 'import onnxruntime as ort; ort.get_available_providers()' succeeds in a subprocess."""
    proc = run_third_party_command(
        [sys.executable, "-c", "import onnxruntime as ort; ort.get_available_providers()"],
        capture_output=True,
        timeout=30,
    )
    return proc is not None and proc.returncode == 0


def _clear_cnocr_cache() -> None:
    """Remove cnocr from package cache and sys.modules so next get_cnocr re-imports with new ONNX runtime."""
    _PACKAGE_CACHE.pop("cnocr", None)
    for key in list(sys.modules.keys()):
        if key == "cnocr" or key.startswith("cnocr."):
            del sys.modules[key]
    importlib.invalidate_caches()
