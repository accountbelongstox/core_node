# -*- coding: utf-8 -*-
"""Shell installer steps that own runtime prerequisites, and the missing-prerequisite report.

Python never installs these; it resolves them and names the step to run. The
step table is config/service_contract.json ``prerequisites`` (shared with the
Linux and Windows prerequisite runners); an empty script list means no shell
step exists on that platform yet.
"""

import sys
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.service_contract import value as service_contract_value

PREREQ_FFMPEG = "ffmpeg"
PREREQ_ADB = "adb"
PREREQ_SCRCPY = "scrcpy"
PREREQ_FRONTEND_PACKAGES = "frontend_packages"

PLATFORM_WINDOWS = "windows"
PLATFORM_LINUX = "linux"

PREREQUISITE_MANIFEST: Dict[str, Any] = service_contract_value("prerequisites")


def current_platform() -> str:
    return PLATFORM_WINDOWS if sys.platform == "win32" else PLATFORM_LINUX


def installer_step(prerequisite: str) -> Optional[str]:
    """Script path(s) of the step that provides ``prerequisite`` on this platform, or None."""
    platform_name = current_platform()
    script_dir = PREREQUISITE_MANIFEST[f"{platform_name}_script_dir"]
    for step in PREREQUISITE_MANIFEST["steps"]:
        if prerequisite in step.get("provides", [step["id"]]):
            scripts = step.get(platform_name) or []
            return " + ".join(f"{script_dir}/{script}" for script in scripts) or None
    return None


def report_missing(prerequisite: str, detail: str) -> None:
    """Report a missing prerequisite with its shell installer step (or that none exists)."""
    step = installer_step(prerequisite)
    if step:
        ColorPrint.yellow(f"[Prerequisite] {prerequisite} missing ({detail}); install it with {step}")
        return
    ColorPrint.yellow(
        f"[Prerequisite] {prerequisite} missing ({detail}); no {current_platform()} shell installer step exists yet"
    )
