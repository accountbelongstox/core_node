#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Launcher Linux startup manager using XDG desktop integration.

Mirrors the Windows approach using Linux-native mechanisms:

  1. A **shell launcher script (.sh)** at a FIXED path under the user data dir
     (``~/.core_node/data/autostart/PyCore_RPC_Server.sh``). It execs the repo's
     canonical entry point ``pyservice.sh run --no-install`` so boot starts the
     SAME stack as a manual run: the unified dashboard UI dev server
     (poly_apps/pycore_laravel_wordnew_ui, exported as PYCORE_UI_URL) and then the pycore
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
from pathlib import Path
from typing import List

from pycore.pylauncher.platform.autostart_target import (
    VALID_TARGETS,
    VALID_MECHANISMS,
    normalize_target,
    normalize_mechanism,
    read_preference,
    write_preference,
)
from pycore.pylauncher.platform.linux_autostart_common import (
    LinuxAutostartScript,
    disable_systemd_autostart,
)



class LinuxStartupManager:
    """Auto-start via a regenerated .sh + an XDG .desktop entry."""

    def __init__(self, app_name: str = "PyCore_RPC_Server", target=None, mechanism=None):
        self.app_name = app_name
        self.entry_name = f"{app_name.lower().replace('_', '-')}.desktop"

        self.system_dir = Path("/etc/xdg/autostart")
        self.user_dir = Path(os.environ.get(
            "XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "autostart"

        self.system_entry = self.system_dir / self.entry_name
        self.user_entry = self.user_dir / self.entry_name

        pref = read_preference()
        self.target = normalize_target(target if target is not None else pref["target"])
        self.mechanism = normalize_mechanism(mechanism if mechanism is not None else "xdg")
        self._script = LinuxAutostartScript(app_name, target=self.target)
        self.script_dir = self._script.script_dir
        self.sh_path = self._script.sh_path
        self.python_exe = self._script.python_exe
        self.launcher_script = self._script.launcher_script
        self.pyservice_script = self._script.pyservice_script

    def _entry_paths(self) -> List[Path]:
        return [self.system_entry, self.user_entry]

    def _write_sh(self) -> None:
        """(Re)write the fixed shell launcher with current config and make it executable."""
        self._script.write_sh()

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

        try:
            disable_systemd_autostart(self.app_name)
        except Exception:
            pass

        # Persist target AND mechanism so refresh()/status/get_startup_manager pick
        # the XDG manager later -- not a stale systemd preference from a prior enable.
        write_preference(self.target, mechanism="xdg")

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
            "target": self.target,
            "targets": list(VALID_TARGETS),
            "mechanism": self.mechanism,
            "mechanisms": list(VALID_MECHANISMS),
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
