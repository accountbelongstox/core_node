#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Linux Startup Manager - Auto-start via XDG .desktop + a fixed launcher script

Mirrors the Windows approach using Linux-native mechanisms:

  1. A **shell launcher script (.sh)** at a FIXED path under the user data dir
     (``~/.core_node/data/autostart/PyCore_RPC_Server.sh``). It execs the repo's
     canonical entry point ``pyservice.sh run --no-install`` so boot starts the
     SAME stack as a manual run: the unified dashboard UI dev server
     (poly_apps/laravel_dashboard, exported as PYCORE_UI_URL) and then the pycore
     worker. Exec'ing the bare worker is kept only as a fallback when pyservice.sh
     cannot be found (it would skip the UI server, leaving the PySide6 webview
     with nothing to load). Its CONTENT is regenerated on every ``enable()`` AND
     on every service start (``refresh()``) so config changes are picked up
     without touching the entry.

  2. A freedesktop **autostart entry (.desktop)** whose ``Exec`` runs that fixed
     .sh. Compliant desktops (GNOME/KDE/XFCE/...) run it on login.
        System-wide (all users): /etc/xdg/autostart/<app>.desktop   (needs root)
        Per-user:                ~/.config/autostart/<app>.desktop

"Enabled?" is answered by whether the .desktop entry exists. The system-wide
location is preferred (mirrors the Windows "all users" intent); without root it
falls back to the per-user location.
"""

import os
import sys
from pathlib import Path
from typing import List

from pycore.pyfoundations.system_paths import get_app_data_dir


class LinuxStartupManager:
    """Auto-start via a regenerated .sh + an XDG .desktop entry."""

    def __init__(self, app_name: str = "PyCore_RPC_Server"):
        self.app_name = app_name
        self.entry_name = f"{app_name.lower().replace('_', '-')}.desktop"

        self.system_dir = Path("/etc/xdg/autostart")
        self.user_dir = Path(os.environ.get(
            "XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "autostart"

        self.system_entry = self.system_dir / self.entry_name
        self.user_entry = self.user_dir / self.entry_name

        # Fixed-location shell launcher (content regenerated each enable).
        self.script_dir = get_app_data_dir() / "autostart"
        self.sh_path = self.script_dir / f"{app_name}.sh"

        self.python_exe = sys.executable
        self.launcher_script = self._get_launcher_path()
        self.pyservice_script = self._get_pyservice_path()

    # ----- path resolution ------------------------------------------------- #
    def _get_launcher_path(self) -> Path:
        """Locate pycore_module_caller.py (source tree or installed)."""
        current_file = Path(__file__)
        # .../pycore/callmodule/platform/linux_startup_manager.py -> pycore/ is 3 up.
        pycore_dir = current_file.parent.parent.parent
        for path in (
            pycore_dir / "pycore_module_caller.py",         # pycore/ (canonical)
            pycore_dir.parent / "pycore_module_caller.py",  # repo root (fallback)
            Path(sys.executable).parent / "pycore_module_caller.py",
        ):
            if path.exists():
                return path
        return pycore_dir / "pycore_module_caller.py"

    def _get_pyservice_path(self) -> Path:
        """Locate pyservice.sh, the canonical full-stack entry point (repo root)."""
        # .../pycore/callmodule/platform/linux_startup_manager.py -> repo root is 4 up.
        return Path(__file__).resolve().parents[3] / "pyservice.sh"

    def _entry_paths(self) -> List[Path]:
        return [self.system_entry, self.user_entry]

    # ----- launcher script + desktop entry -------------------------------- #
    def _generate_sh(self) -> str:
        """Build the shell launcher content (absolute paths, current config)."""
        header = (
            "#!/usr/bin/env bash\n"
            "# PyCore RPC Server - auto-start launcher\n"
            "# AUTO-GENERATED: regenerated on every enable() and on every service start\n"
            "# (reflects current config).\n"
        )
        if self.pyservice_script.exists():
            # Boot runs the SAME entry point as a manual run: pyservice.sh starts
            # the unified dashboard UI dev server (laravel_dashboard, exported as
            # PYCORE_UI_URL) and then the worker. --no-install skips the heavy
            # prerequisite step at boot.
            script = str(self.pyservice_script).replace('"', '\\"')
            workdir = str(self.pyservice_script.parent).replace('"', '\\"')
            return (
                header
                + f'cd "{workdir}" 2>/dev/null\n'
                + f'exec /usr/bin/env bash "{script}" run --no-install\n'
            )
        # Fallback (pyservice.sh not found): bare worker only — the PySide6
        # webview then uses the legacy /web/subtitle page.
        py = str(self.python_exe).replace('"', '\\"')
        launcher = str(self.launcher_script).replace('"', '\\"')
        workdir = str(self.launcher_script.parent).replace('"', '\\"')
        return (
            header
            + f'cd "{workdir}" 2>/dev/null\n'
            + f'exec "{py}" "{launcher}"\n'
        )

    def _write_sh(self) -> None:
        """(Re)write the fixed shell launcher with current config and make it executable."""
        self.script_dir.mkdir(parents=True, exist_ok=True)
        with open(self.sh_path, "w", encoding="utf-8") as fh:
            fh.write(self._generate_sh())
        os.chmod(self.sh_path, 0o755)

    def _desktop_entry(self) -> str:
        return (
            "[Desktop Entry]\n"
            "Type=Application\n"
            f"Name={self.app_name}\n"
            "Comment=PyCore RPC Server - auto-start on login\n"
            f'Exec=/bin/bash "{self.sh_path}"\n'
            "Terminal=false\n"
            "X-GNOME-Autostart-enabled=true\n"
            "Hidden=false\n"
        )

    def _write_entry(self, path: Path) -> bool:
        """Write the .desktop entry; return True on success."""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(self._desktop_entry())
            os.chmod(path, 0o644)
            return path.exists()
        except Exception:
            return False

    # ----- public API ------------------------------------------------------ #
    def is_enabled(self) -> bool:
        return any(p.exists() for p in self._entry_paths())

    def enable(self) -> dict:
        # Always refresh the fixed launcher script so config changes are reflected.
        try:
            self._write_sh()
        except Exception as e:
            return {"success": False, "enabled": self.is_enabled(),
                    "message": f"Failed to write launcher script: {e}", "error": str(e)}

        for entry, scope in ((self.system_entry, "all-users"),
                             (self.user_entry, "current-user")):
            if self._write_entry(entry):
                return {"success": True, "enabled": True, "scope": scope,
                        "message": f"Auto-start enabled ({scope}): {entry}",
                        "shortcut_path": str(entry), "script_path": str(self.sh_path)}
        return {"success": False, "enabled": self.is_enabled(),
                "message": "Failed to create autostart entry "
                           "(/etc/xdg/autostart needs root).",
                "error": "autostart entry creation failed"}

    def disable(self) -> dict:
        removed, errors = [], []
        for entry in self._entry_paths():
            try:
                if entry.exists():
                    entry.unlink()
                    removed.append(str(entry))
            except Exception as e:
                errors.append(f"{entry}: {e}")
        if errors and self.is_enabled():
            return {"success": False, "enabled": True,
                    "message": "Failed to remove autostart entry: " + "; ".join(errors),
                    "error": "; ".join(errors)}
        return {"success": True, "enabled": False,
                "message": ("Auto-start disabled (entry removed)" if removed
                            else "Auto-start already disabled"),
                "removed": removed}

    def toggle(self) -> dict:
        return self.disable() if self.is_enabled() else self.enable()

    def refresh(self) -> bool:
        """If enabled, rewrite the fixed launcher .sh in place (self-heal).

        Called on every service start so launchers written by an OLDER version
        (bare worker, no UI server) are upgraded to the current entry point
        without toggling auto-start. The .desktop entry points at the fixed .sh
        path, so only the file content needs refreshing.
        """
        if not self.is_enabled():
            return False
        try:
            self._write_sh()
            return True
        except Exception:
            return False

    def get_status(self) -> dict:
        return {
            "enabled": self.is_enabled(),
            "platform": "linux",
            "supported": True,
            "scope": "all-users" if self.system_entry.exists() else (
                "current-user" if self.user_entry.exists() else "all-users"),
            "location": str(self.system_entry if self.system_entry.exists()
                            else self.user_entry),
            "system_entry": str(self.system_entry),
            "user_entry": str(self.user_entry),
            "script_path": str(self.sh_path),
            "script_exists": self.sh_path.exists(),
            "entry_point": str(self.pyservice_script),
            "entry_exists": self.pyservice_script.exists(),
            "launcher_script": str(self.launcher_script),
            "launcher_exists": self.launcher_script.exists(),
        }
