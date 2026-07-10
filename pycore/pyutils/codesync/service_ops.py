# -*- coding: utf-8 -*-
"""
Service self-management for the standalone Code Sync daemon (stdlib only).

Linux/systemd only: the standalone panel can reinstall/restart the codesync
systemd service via the SAME idempotent path as `pyservice.sh codesync` ->
codesync_service.sh (install rewrites the unit + restart; restart = systemctl
restart). Because THIS daemon IS that service, the op is spawned detached and
OUTSIDE the unit's cgroup (prefer systemd-run; else setsid) with a 1s delay so
the HTTP reply flushes before systemd kills us - the panel then shows the
log-view commands to inspect the (re)start from the machine if it does not come
back.

Stdlib only; no pycore import. Reuses only `.runtime` (get_core_node_root).
commander.py / explorer_executor.py are REFERENCE-ONLY for the detached
systemd-run pattern - they are NOT imported (would pull pycore).
"""

import os
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

from .runtime import get_core_node_root

SERVICE_NAME = "codesync"


def _service_log_commands() -> List[str]:
    return [
        f"journalctl -u {SERVICE_NAME} -f",
        f"journalctl -u {SERVICE_NAME} -n 200 --no-pager",
        f"systemctl status {SERVICE_NAME} --no-pager",
    ]


def _systemctl_available() -> bool:
    return shutil.which("systemctl") is not None


def _is_root() -> bool:
    geteuid = getattr(os, "geteuid", None)
    return geteuid() == 0 if geteuid else False


def _run_service_op_detached(op: str) -> Tuple[bool, str, str]:
    """Spawn `pyservice.sh codesync <op>` fully detached so it survives THIS
    daemon being restarted by the very operation it triggers. `op` is allow-listed
    (restart|install). Returns (ok, command, error)."""
    if op not in ("restart", "install"):
        return False, "", f"unsupported op: {op}"
    if not _systemctl_available():
        return False, "", "systemctl not found; service ops are Linux/systemd only"
    root = get_core_node_root()
    script = Path(root) / "pyservice.sh"
    if not script.exists():
        return False, "", f"pyservice.sh not found at {script}"
    # 1s delay lets the HTTP response flush before systemd stops this process.
    inner = f"sleep 1; bash {shlex.quote(str(script))} codesync {op}"
    sudo = (not _is_root() and shutil.which("sudo") is not None)
    # If we'll need sudo, verify passwordless sudo NOW so a missing NOPASSWD turns
    # into a real error the panel can show — instead of a detached process that
    # silently dies on a password prompt while we report "triggered".
    if not _is_root() and not sudo:
        return False, inner, ("not root and sudo not found; run the command "
                              "manually on the machine")
    if sudo:
        try:
            chk = subprocess.run(["sudo", "-n", "true"], stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL, timeout=5)
            if chk.returncode != 0:
                return False, inner, ("passwordless sudo required (sudo -n failed); "
                                      "run the command manually on the machine")
        except Exception as exc:
            return False, inner, f"sudo preflight failed: {exc}"
    try:
        sysrun = shutil.which("systemd-run")
        if sysrun:
            # A transient unit runs OUTSIDE this service's cgroup, so the restart
            # completes even after systemd kills us. --collect reaps it after exit.
            # Unique name (pid + monotonic ns) so a rapid double-trigger never hits
            # an "--unit already exists" failure.
            unit = f"codesync-self-{op}-{os.getpid()}-{time.monotonic_ns()}"
            argv = [sysrun, "--quiet", "--collect", f"--unit={unit}",
                    "bash", "-lc", inner]
            if sudo:
                argv = ["sudo", "-n", *argv]
            subprocess.Popen(argv, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
            return True, " ".join(shlex.quote(a) for a in argv), ""
        # Fallback: detached session shell (best-effort if KillMode reaps it).
        shell_cmd = f"sudo -n {inner}" if sudo else inner
        argv = ["setsid", "bash", "-lc", shell_cmd]
        subprocess.Popen(argv, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
        return True, shell_cmd, ""
    except Exception as exc:
        return False, inner, str(exc)


def _service_status() -> Dict[str, Any]:
    out: Dict[str, Any] = {"success": True, "available": _systemctl_available(),
                           "service": SERVICE_NAME,
                           "log_commands": _service_log_commands()}
    if not out["available"]:
        out["success"] = False
        out["error"] = "systemctl not found (Linux/systemd only)"
        return out
    for key, args in (("active", ["systemctl", "is-active", SERVICE_NAME]),
                      ("enabled", ["systemctl", "is-enabled", SERVICE_NAME])):
        try:
            r = subprocess.run(args, capture_output=True, text=True, timeout=5)
            out[key] = (r.stdout or r.stderr or "").strip() or "unknown"
        except Exception as exc:
            out[key] = f"unknown ({exc})"
    return out
