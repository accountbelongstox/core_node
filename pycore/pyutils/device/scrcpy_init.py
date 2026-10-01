# Archived: obsolete, not maintained or refactored.
"""
Scrcpy/adb presence: resolve the shell-installed scrcpy bundle (adb, scrcpy,
scrcpy-server). Both shells export SCRCPY_HOME; when it is unset the Linux
location comes from config/service_contract.json (cache_root.linux /
scrcpy_bundle_dir.dir_name). adb is also taken from PATH. Missing tools are
reported with their installer step; nothing is downloaded.
"""

import os
import platform
import shutil
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.service_contract import value as contract_value
from pycore.pyutils.common.prerequisite_steps import PREREQ_ADB, PREREQ_SCRCPY, report_missing

SCRCPY_HOME_ENV = "SCRCPY_HOME"
SCRCPY_VERSION = str(contract_value("versions.scrcpy"))
SCRCPY_SERVER_FILE = "scrcpy-server"


def resolve_scrcpy_home() -> Path:
    """SCRCPY_HOME, else <paths.drive_layout.cache_root.linux>/<scrcpy_bundle_dir.dir_name>."""
    env_home = os.environ.get(SCRCPY_HOME_ENV, "").strip()
    if env_home:
        return Path(env_home)
    return Path(contract_value("paths.drive_layout.cache_root.linux")) / contract_value(
        "paths.drive_layout.scrcpy_bundle_dir.dir_name"
    )


class ScrcpyInitializer:
    """Locate scrcpy and adb installed by the device-tools shell step."""

    def __init__(self):
        self.system = platform.system().lower()
        self._scrcpy_dir: Optional[Path] = None

    @property
    def scrcpy_dir(self) -> Path:
        if self._scrcpy_dir is None:
            self._scrcpy_dir = resolve_scrcpy_home()
        return self._scrcpy_dir

    def _executable(self, name: str) -> str:
        return f"{name}.exe" if self.system == "windows" else name

    def _bundle_file(self, name: str) -> Optional[Path]:
        path = self.scrcpy_dir / name
        return path if path.is_file() and path.stat().st_size > 0 else None

    def is_initialized(self) -> bool:
        """True when scrcpy, adb and scrcpy-server are all present and non-empty."""
        return (
            self.get_adb_path() is not None
            and self.get_scrcpy_path() is not None
            and self.get_server_path() is not None
        )

    def get_adb_path(self) -> Optional[Path]:
        """Bundle adb, else adb on PATH; None (reported) when missing."""
        bundled = self._bundle_file(self._executable("adb"))
        if bundled is not None:
            return bundled
        on_path = shutil.which("adb")
        if on_path:
            return Path(on_path)
        report_missing(PREREQ_ADB, f"adb not in {self.scrcpy_dir} or on PATH")
        return None

    def get_scrcpy_path(self) -> Optional[Path]:
        bundled = self._bundle_file(self._executable("scrcpy"))
        if bundled is not None:
            return bundled
        report_missing(PREREQ_SCRCPY, f"scrcpy bundle not found in {self.scrcpy_dir}")
        return None

    def get_server_path(self) -> Optional[Path]:
        bundled = self._bundle_file(SCRCPY_SERVER_FILE)
        if bundled is None:
            report_missing(PREREQ_SCRCPY, f"scrcpy-server not found in {self.scrcpy_dir}")
        return bundled

    def get_paths(self) -> Dict[str, Optional[Path]]:
        scrcpy_path = self.get_scrcpy_path()
        return {
            "adb": self.get_adb_path(),
            "scrcpy": scrcpy_path,
            "scrcpy_dir": self.scrcpy_dir if scrcpy_path is not None else None,
        }

    def initialize(self) -> bool:
        """Presence check only; True when adb and scrcpy are installed."""
        ready = self.is_initialized()
        if ready:
            ColorPrint.plain(f"[ScrcpyInit] scrcpy bundle ready at: {self.scrcpy_dir}")
        return ready


scrcpy_initializer = ScrcpyInitializer()
