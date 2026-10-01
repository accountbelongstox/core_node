# -*- coding: utf-8 -*-
"""Shell installer steps that own runtime prerequisites, and the missing-prerequisite report.

Python never installs these; it resolves them and names the step to run.
A step value of None means no shell step exists yet (reported as missing).
"""

import sys
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

PREREQ_FFMPEG = "ffmpeg"
PREREQ_ADB = "adb"
PREREQ_SCRCPY = "scrcpy"
PREREQ_FRONTEND_PACKAGES = "frontend_packages"

PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"

# prerequisite -> {platform: installer step (None = no shell step yet)}
PREREQUISITE_STEPS: Dict[str, Dict[str, Optional[str]]] = {
    PREREQ_FFMPEG: {
        PLATFORM_LINUX: "scripts/shells/linux/debian/install_shells/115_install_ffmpeg.sh",
        PLATFORM_WINDOWS: "scripts/shells/win/install_powershells/Step67_InstallFfmpeg.ps1",
    },
    PREREQ_ADB: {
        PLATFORM_LINUX: "scripts/shells/linux/debian/install_shells/149_install_device_tools.sh",
        PLATFORM_WINDOWS: "scripts/shells/win/install_powershells/Step27_InstallAndroidPlatformTools.ps1",
    },
    PREREQ_SCRCPY: {
        PLATFORM_LINUX: "scripts/shells/linux/debian/install_shells/149_install_device_tools.sh",
        PLATFORM_WINDOWS: "scripts/shells/win/install_powershells/Step68_InstallScrcpy.ps1",
    },
    PREREQ_FRONTEND_PACKAGES: {
        PLATFORM_LINUX: "scripts/shells/linux/debian/install_shells/193_install_frontend_packages.sh",
        PLATFORM_WINDOWS: "scripts/shells/win/install_powershells/Step48_InstallDesktopManager.ps1",
    },
}


def current_platform() -> str:
    return PLATFORM_WINDOWS if sys.platform == "win32" else PLATFORM_LINUX


def installer_step(prerequisite: str) -> Optional[str]:
    return PREREQUISITE_STEPS.get(prerequisite, {}).get(current_platform())


def report_missing(prerequisite: str, detail: str) -> None:
    """Report a missing prerequisite with its shell installer step (or that none exists)."""
    step = installer_step(prerequisite)
    if step:
        ColorPrint.yellow(f"[Prerequisite] {prerequisite} missing ({detail}); install it with {step}")
        return
    ColorPrint.yellow(
        f"[Prerequisite] {prerequisite} missing ({detail}); no {current_platform()} shell installer step exists yet"
    )
