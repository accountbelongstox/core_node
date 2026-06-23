#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Systemd (user) Startup Manager - Auto-start via a systemd --user unit.

An alternative Linux mechanism to the XDG .desktop entry. It REUSES the
:class:`LinuxStartupManager` to build/write the SAME fixed launcher .sh (so the
"target" — pyservice / launcher / both — behaves identically), then registers a
``systemd --user`` service that execs that .sh:

    ~/.config/systemd/user/<app-name-dashed>.service

Compared to the XDG entry this starts at login of the user's systemd instance
(``WantedBy=default.target``) with ``Restart=on-failure``, and (best-effort)
``loginctl enable-linger`` so it can start at boot before an interactive login.

All subprocess calls are guarded; this manager never raises.
"""

import os
import shutil
import subprocess
from pathlib import Path

from pycore.callmodule.platform.autostart_target import (
    VALID_TARGETS,
    VALID_MECHANISMS,
    write_preference,
)
from pycore.callmodule.platform.linux_startup_manager import LinuxStartupManager


class SystemdUserStartupManager:
    """Auto-start via the fixed .sh (built by LinuxStartupManager) + a systemd --user unit."""

    def __init__(self, app_name: str = "PyCore_RPC_Server", target=None):
        self.app_name = app_name
        # Reuse the XDG manager purely to build/write the fixed .sh + resolve target.
        self._linux = LinuxStartupManager(app_name, target=target, mechanism="systemd")
        self.sh_path = self._linux.sh_path

        self.unit_name = f"{app_name.lower().replace('_', '-')}.service"
        self.unit_dir = Path(os.environ.get(
            "XDG_CONFIG_HOME", str(Path.home() / ".config"))) / "systemd" / "user"
        self.unit_path = self.unit_dir / self.unit_name

    # ----- helpers --------------------------------------------------------- #
    def _run(self, args):
        """Run a command, capturing output; never raises. Returns CompletedProcess or None."""
        try:
            return subprocess.run(
                args, capture_output=True, text=True, timeout=30)
        except Exception:
            return None

    def _unit_text(self) -> str:
        sh = str(self.sh_path)
        return (
            "[Unit]\n"
            "Description=PyCore RPC Server auto-start\n"
            "\n"
            "[Service]\n"
            "Type=simple\n"
            f'ExecStart=/bin/bash "{sh}"\n'
            "Restart=on-failure\n"
            "\n"
            "[Install]\n"
            "WantedBy=default.target\n"
        )

    def _write_unit(self) -> bool:
        try:
            self.unit_dir.mkdir(parents=True, exist_ok=True)
            self.unit_path.write_text(self._unit_text(), encoding="utf-8")
            return self.unit_path.exists()
        except Exception:
            return False

    # ----- public API ------------------------------------------------------ #
    def is_supported(self) -> bool:
        """systemd available (best-effort: systemctl on PATH)."""
        return shutil.which("systemctl") is not None

    def is_enabled(self) -> bool:
        """Enabled iff the unit file exists OR `systemctl --user is-enabled` says so."""
        if self.unit_path.exists():
            return True
        res = self._run(["systemctl", "--user", "is-enabled", self.unit_name])
        if res is not None and res.returncode == 0:
            return (res.stdout or "").strip() == "enabled"
        return False

    def enable(self) -> dict:
        # Switching mechanism: remove any XDG .desktop entry so boot doesn't fire
        # BOTH the systemd unit and the autostart entry (the shared .sh is kept;
        # LinuxStartupManager.disable() only removes the .desktop entries).
        try:
            self._linux.disable()
        except Exception:
            pass
        # Build/write the SAME fixed .sh as the XDG manager (reflects current config).
        try:
            self._linux._write_sh()
        except Exception as e:
            return {"success": False, "enabled": self.is_enabled(),
                    "message": f"Failed to write launcher script: {e}", "error": str(e),
                    "target": self._linux.target, "mechanism": "systemd",
                    "targets": list(VALID_TARGETS), "mechanisms": list(VALID_MECHANISMS)}

        if not self._write_unit():
            return {"success": False, "enabled": self.is_enabled(),
                    "message": f"Failed to write systemd unit: {self.unit_path}",
                    "error": "unit write failed",
                    "target": self._linux.target, "mechanism": "systemd",
                    "targets": list(VALID_TARGETS), "mechanisms": list(VALID_MECHANISMS)}

        self._run(["systemctl", "--user", "daemon-reload"])
        res = self._run(["systemctl", "--user", "enable", "--now", self.unit_name])
        # Best-effort: let the user's service start at boot before interactive login.
        self._run(["loginctl", "enable-linger", os.environ.get("USER", "")])

        write_preference(self._linux.target, mechanism="systemd")

        ok = (res is not None and res.returncode == 0) or self.unit_path.exists()
        message = (f"Auto-start enabled (current-user, systemd): {self.unit_path}"
                   if ok else
                   "systemd unit written but `systemctl --user enable --now` "
                   "did not confirm; it will still start at next login.")
        return {
            "success": bool(ok), "enabled": True, "scope": "current-user",
            "message": message,
            "script_path": str(self.sh_path), "unit_path": str(self.unit_path),
            "target": self._linux.target, "mechanism": "systemd",
            "targets": list(VALID_TARGETS), "mechanisms": list(VALID_MECHANISMS),
        }

    def disable(self) -> dict:
        self._run(["systemctl", "--user", "disable", "--now", self.unit_name])
        removed = False
        try:
            if self.unit_path.exists():
                self.unit_path.unlink()
                removed = True
        except Exception as e:
            return {"success": False, "enabled": self.is_enabled(),
                    "message": f"Failed to remove systemd unit: {e}", "error": str(e),
                    "target": self._linux.target, "mechanism": "systemd",
                    "targets": list(VALID_TARGETS), "mechanisms": list(VALID_MECHANISMS)}
        self._run(["systemctl", "--user", "daemon-reload"])
        return {
            "success": True, "enabled": False, "scope": "current-user",
            "message": ("Auto-start disabled (systemd unit removed)" if removed
                        else "Auto-start already disabled"),
            "unit_path": str(self.unit_path), "script_path": str(self.sh_path),
            "target": self._linux.target, "mechanism": "systemd",
            "targets": list(VALID_TARGETS), "mechanisms": list(VALID_MECHANISMS),
        }

    def toggle(self) -> dict:
        return self.disable() if self.is_enabled() else self.enable()

    def refresh(self) -> bool:
        """If enabled, rewrite the fixed launcher .sh in place (self-heal)."""
        if not self.is_enabled():
            return False
        try:
            self._linux._write_sh()
            return True
        except Exception:
            return False

    def get_status(self) -> dict:
        return {
            "enabled": self.is_enabled(),
            "platform": "linux",
            "supported": self.is_supported(),
            "mechanism": "systemd",
            "mechanisms": list(VALID_MECHANISMS),
            "target": self._linux.target,
            "targets": list(VALID_TARGETS),
            "scope": "current-user",
            "unit_path": str(self.unit_path),
            "script_path": str(self.sh_path),
            "script_exists": self.sh_path.exists(),
        }
