# -*- coding: utf-8 -*-
"""
check_and_install_dependencies: platform merge, headless-GUI drop,
pip-upgrade-first, verify via _module_install_ok, ENCYCLOPEDIA once-guard.

The import-time auto-run of this function lives in __init__.py (NOT here), so it
fires exactly once after all sub-modules are imported.
"""

import sys
import platform
import importlib

from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from ._deps import (
    DEPENDENCY_MAP,
    WINDOWS_ONLY_PACKAGES,
    GUI_ONLY_IMPORTS,
    _module_install_ok,
    _is_headless_linux,
)
from ._torch_cuda import _ensure_torch_cuda_build_first
from ._pip_runner import build_pip_install_command, run_pip_install_with_realtime_output


def check_and_install_dependencies():
    """
    Checks if all required packages are installed and installs them if not.
    Also performs GPU detection and setup. torch is a required package; ensure CUDA build first.
    """
    # Required package: ensure torch is CUDA build before any package list (not lazy)
    _ensure_torch_cuda_build_first()

    ColorPrint.blue("[INFO] Checking for required Python packages...")
    if ENCYCLOPEDIA.get("pycore_dependencies_checked", False):
        return

    if ENCYCLOPEDIA.get("pycore_dependencies_checking", False):
        return

    ENCYCLOPEDIA.add("pycore_dependencies_checking", True)

    # NOTE: System packages are now installed by shell scripts
    # See: scripts/shells/linux/debian/install_shells/13_ensure_python.sh

    installed_packages = set()
    missing_packages = set()
    installed_packages_list = []

    # Merge dependency maps based on platform
    # IMPORTANT: DO NOT MODIFY - Windows packages are automatically skipped on Linux/Mac
    current_platform = platform.system()

    # Required packages only (no optional packages during check)
    all_dependencies = dict(DEPENDENCY_MAP)
    if current_platform == 'Windows':
        all_dependencies.update(WINDOWS_ONLY_PACKAGES)
    else:
        ColorPrint.blue(f"[INFO] Skipping Windows-only packages on {current_platform}")

    # Headless Linux (no DISPLAY/Wayland): drop GUI-only Qt packages - there is no
    # display to use them and they are heavy (PySide6 ~629M, PyQt5 ~202M). They still
    # lazy-install on demand via their getters if a desktop feature actually runs.
    if _is_headless_linux():
        dropped = sorted({p for i, p in all_dependencies.items() if i in GUI_ONLY_IMPORTS})
        all_dependencies = {i: p for i, p in all_dependencies.items() if i not in GUI_ONLY_IMPORTS}
        if dropped:
            ColorPrint.blue(f"[INFO] Headless Linux (no display): skipping GUI-only packages: {', '.join(dropped)}")

    # Optional packages are not checked/installed automatically
    ColorPrint.blue("[INFO] Optional packages are not auto-installed")

    # Use a set to avoid checking/installing the same package multiple times (e.g., pywin32)
    packages_to_check = set(all_dependencies.values())

    # Check if any packages need installation/upgrade, and upgrade pip first if needed
    needs_installation = False
    for package_name in packages_to_check:
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break
        if import_name_to_check and not _module_install_ok(import_name_to_check):
            needs_installation = True
            break

    # Upgrade pip first if any packages need installation
    if needs_installation:
        ColorPrint.blue("[INFO] Upgrading pip to latest version...")
        pip_upgrade_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", "pip"]
        if current_platform != 'Windows':
            pip_upgrade_cmd.extend(["--break-system-packages", "--ignore-installed"])
        else:
            pip_upgrade_cmd.append("--no-user")
        run_pip_install_with_realtime_output(pip_upgrade_cmd, "pip")

    failed_packages = []

    for package_name in packages_to_check:
        # We check for the installation status of the package itself, not the import name.
        # A bit of a simplification, we assume the main importable module has a similar name
        # or that checking one is enough. For pywin32, checking 'win32gui' is a good proxy.

        # Find the import name associated with the package to check its spec
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break

        # Probe importability; for split packages (PySide6) this checks a real submodule
        # so an incomplete top-level stub is not mistaken for a working install.
        is_installed = _module_install_ok(import_name_to_check)

        if not is_installed:
            missing_packages.add(package_name)
            ColorPrint.yellow(f"[INSTALL] Package for '{import_name_to_check}' ('{package_name}') not found. Installing...")

            # Build pip install command using reusable helper
            pip_cmd = build_pip_install_command(package_name)

            # Run installation with real-time output
            run_pip_install_with_realtime_output(pip_cmd, package_name)

            # Verify installation by checking if module can be imported (not by return code)
            importlib.invalidate_caches()
            try:
                if not _module_install_ok(import_name_to_check):
                    ColorPrint.yellow(f"[WARNING] Package {package_name} installed but import '{import_name_to_check}' still not available")
                    ColorPrint.yellow("[WARNING] This may require a Python restart or the package may need different import name")
                    failed_packages.append((package_name, import_name_to_check))
                else:
                    ColorPrint.green(f"[SUCCESS] Successfully installed {package_name}.")
                    installed_packages.add(package_name)
                    installed_packages_list.append(package_name)
            except Exception as e:
                ColorPrint.yellow(f"[WARNING] Error verifying '{import_name_to_check}' after installation: {e}")
                failed_packages.append((package_name, import_name_to_check))
        else:
            installed_packages.add(package_name)
            installed_packages_list.append(package_name)

    # Report failed packages if any
    if failed_packages:
        ColorPrint.yellow(f"[WARNING] {len(failed_packages)} package(s) failed to install or verify:")
        for pkg_name, import_name in failed_packages:
            ColorPrint.yellow(f"  - {import_name} ({pkg_name})")

    if installed_packages:
        ColorPrint.blue(f"[INFO] Found installed packages: {', '.join(sorted(installed_packages))}")
    ColorPrint.green("[INFO] All required packages are available.")


    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))
    # Remove checking flag
    ENCYCLOPEDIA.add("pycore_dependencies_checking", False)
