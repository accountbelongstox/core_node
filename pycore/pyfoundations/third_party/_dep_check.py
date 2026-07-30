# -*- coding: utf-8 -*-
"""Read-only dependency metadata checks for the third-party facade."""

import platform
from importlib import metadata

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party._deps import (
    DEPENDENCY_MAP,
    WINDOWS_ONLY_PACKAGES,
    GUI_ONLY_IMPORTS,
    _is_headless_linux,
)
def check_and_install_dependencies():
    """Inspect pip metadata without mutating the interpreter environment."""
    ColorPrint.blue("[INFO] Checking for required Python packages...")
    if ENCYCLOPEDIA.get("pycore_dependencies_checked", False):
        return

    if ENCYCLOPEDIA.get("pycore_dependencies_checking", False):
        return

    ENCYCLOPEDIA.add("pycore_dependencies_checking", True)

    # NOTE: System packages are now installed by shell scripts
    # See: scripts/shells/linux/debian/install_shells/13_ensure_python.sh

    installed_packages = set()

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
    installed_distribution_names = {
        canonicalize_name(distribution.metadata["Name"])
        for distribution in metadata.distributions()
        if distribution.metadata.get("Name")
    }

    missing_packages = []

    for package_name in packages_to_check:
        # Find the import name for diagnostics; pip metadata owns installation detection.
        import_name_to_check = None
        for imp, pkg in all_dependencies.items():
            if pkg == package_name:
                import_name_to_check = imp
                break

        distribution_name = Requirement(package_name).name
        is_installed = canonicalize_name(distribution_name) in installed_distribution_names

        if not is_installed:
            missing_packages.append((package_name, import_name_to_check))
        else:
            installed_packages.add(package_name)

    if missing_packages:
        ColorPrint.yellow(
            f"[WARNING] {len(missing_packages)} package(s) are absent; rerun the pycore prerequisite installer:"
        )
        for pkg_name, import_name in missing_packages:
            ColorPrint.yellow(f"  - {import_name} ({pkg_name})")

    if installed_packages:
        ColorPrint.blue(f"[INFO] Found installed packages: {', '.join(sorted(installed_packages))}")
    else:
        ColorPrint.green("[INFO] All required packages are available.")


    # Mark as checked in ENCYCLOPEDIA (persists for entire Python process)
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
    ENCYCLOPEDIA.add("pycore_installed_packages", sorted(installed_packages))
    # Remove checking flag
    ENCYCLOPEDIA.add("pycore_dependencies_checking", False)
