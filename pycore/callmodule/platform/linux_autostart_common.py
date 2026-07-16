#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared Linux auto-start helpers (launcher script + cross-mechanism disable).

Extracted from linux_startup_manager / systemd_user_startup_manager so those
managers do not import each other (avoids circular imports at module load).
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

from pycore.pyfoundations.system_paths import get_app_data_dir
from pycore.callmodule.platform.autostart_target import (
    normalize_target,
    read_preference,
)


class LinuxAutostartScript:
    """Fixed-path launcher .sh builder shared by XDG and systemd managers."""

    def __init__(self, app_name: str = "PyCore_RPC_Server", target=None):
        self.app_name = app_name
        self.script_dir = get_app_data_dir() / "autostart"
        self.sh_path = self.script_dir / f"{app_name}.sh"
        self.python_exe = sys.executable
        self.launcher_script = self._get_launcher_path()
        self.pyservice_script = self._get_pyservice_path()
        pref = read_preference()
        self.target = normalize_target(target if target is not None else pref["target"])

    def _get_launcher_path(self) -> Path:
        current_file = Path(__file__)
        pycore_dir = current_file.parent.parent.parent
        for path in (
            pycore_dir / "pycore_module_caller.py",
            pycore_dir.parent / "pycore_module_caller.py",
            Path(sys.executable).parent / "pycore_module_caller.py",
        ):
            if path.exists():
                return path
        return pycore_dir / "pycore_module_caller.py"

    def _get_pyservice_path(self) -> Path:
        return Path(__file__).resolve().parents[3] / "pyservice.sh"

    def _pyservice_run(self) -> Tuple[str, str]:
        if self.pyservice_script.exists():
            script = str(self.pyservice_script).replace('"', '\\"')
            workdir = str(self.pyservice_script.parent).replace('"', '\\"')
            return workdir, f'/usr/bin/env bash "{script}" run --no-install'
        py = str(self.python_exe).replace('"', '\\"')
        launcher = str(self.launcher_script).replace('"', '\\"')
        workdir = str(self.launcher_script.parent).replace('"', '\\"')
        return workdir, f'"{py}" "{launcher}"'

    def _launcher_run(self) -> Tuple[str, str]:
        py = str(self.python_exe).replace('"', '\\"')
        repo_root = str(self.pyservice_script.parent).replace('"', '\\"')
        return repo_root, f'"{py}" -m pycore.pyutils.launcher --mode windows --no-pause'

    def _generate_sh(self) -> str:
        header = (
            "#!/usr/bin/env bash\n"
            "# PyCore RPC Server - auto-start launcher\n"
            "# AUTO-GENERATED: regenerated on every enable() and on every service start\n"
            "# (reflects current config).\n"
        )
        pw, pc = self._pyservice_run()
        lw, lc = self._launcher_run()
        if self.target == "launcher":
            body = f'cd "{lw}" 2>/dev/null\nexec {lc}\n'
        elif self.target == "both":
            body = f'( cd "{pw}" 2>/dev/null; exec {pc} ) &\ncd "{lw}" 2>/dev/null\nexec {lc}\n'
        else:
            body = f'cd "{pw}" 2>/dev/null\nexec {pc}\n'
        return header + body

    def write_sh(self) -> None:
        self.script_dir.mkdir(parents=True, exist_ok=True)
        with open(self.sh_path, "w", encoding="utf-8") as fh:
            fh.write(self._generate_sh())
        os.chmod(self.sh_path, 0o755)


def _xdg_entry_paths(app_name: str) -> List[Path]:
    entry_name = f"{app_name.lower().replace('_', '-')}.desktop"
    system_dir = Path("/etc/xdg/autostart")
    user_dir = Path(os.environ.get(
        "XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "autostart"
    return [system_dir / entry_name, user_dir / entry_name]


def disable_xdg_autostart(app_name: str) -> None:
    """Remove XDG .desktop autostart entries (best-effort, never raises)."""
    for entry in _xdg_entry_paths(app_name):
        try:
            if entry.exists():
                entry.unlink()
        except Exception:
            pass


def _systemd_unit_path(app_name: str) -> Path:
    unit_name = f"{app_name.lower().replace('_', '-')}.service"
    unit_dir = Path(os.environ.get(
        "XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "systemd" / "user"
    return unit_dir / unit_name


def _run_systemctl(args: List[str]):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=30)
    except Exception:
        return None


def disable_systemd_autostart(app_name: str) -> None:
    """Disable and remove a systemd --user auto-start unit (best-effort)."""
    unit_name = f"{app_name.lower().replace('_', '-')}.service"
    unit_path = _systemd_unit_path(app_name)
    _run_systemctl(["systemctl", "--user", "disable", "--now", unit_name])
    try:
        if unit_path.exists():
            unit_path.unlink()
    except Exception:
        pass
    _run_systemctl(["systemctl", "--user", "daemon-reload"])
