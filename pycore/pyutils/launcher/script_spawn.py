# -*- coding: utf-8 -*-
"""Shared script spawning for the launcher: privilege prefix, detached or synchronous logged runs."""

import getpass
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pygvar import IS_WINDOWS, TMP_DIR
from pycore.pyfoundations.system_service_state import (
    SUDO_COMMAND,
    SUDO_NON_INTERACTIVE_FLAG,
    is_elevated,
    sudo_available,
)
from pycore.pyutils.launcher.explorer_executor import spawn_detached_posix
from pycore.pyutils.launcher.linux_desktop_user import SYSTEMD_INVOCATION_ENV, drop_service_markers

LOG_DIR_NAME = 'launcher_services'
LOG_SUFFIX = '.log'
LOG_COMMAND_PREFIX = '$ '
SHARED_LOG_DIR_MODE = 0o1777

ENV_COMMAND = 'env'
BASH_COMMAND = 'bash'
SYSTEMD_RUN_COMMAND = 'systemd-run'
SYSTEMD_RUN_SCOPE_ARGS = ('--scope', '--quiet')
SYSTEMD_RUN_USER_FLAG = '--user'
WINDOWS_CREATE_NEW_PROCESS_GROUP = 0x00000200
WINDOWS_CREATE_NO_WINDOW = 0x08000000
WINDOWS_DETACHED_FLAGS = WINDOWS_CREATE_NO_WINDOW | WINDOWS_CREATE_NEW_PROCESS_GROUP


def root_privilege_prefix() -> Optional[List[str]]:
    if is_elevated():
        return []
    if sudo_available():
        return [SUDO_COMMAND, SUDO_NON_INTERACTIVE_FLAG]
    return None


def cgroup_escape_prefix(user_scope: bool) -> List[str]:
    # Under a systemd unit (e.g. the login auto-start), the unit's cgroup is
    # killed when the launcher exits; a transient scope keeps the child alive.
    if SYSTEMD_INVOCATION_ENV not in os.environ or shutil.which(SYSTEMD_RUN_COMMAND) is None:
        return []
    prefix = [SYSTEMD_RUN_COMMAND, *SYSTEMD_RUN_SCOPE_ARGS]
    if user_scope:
        prefix.append(SYSTEMD_RUN_USER_FLAG)
    return prefix


def child_env(extra) -> dict:
    # start.sh scripts treat INVOCATION_ID as "running as the systemd unit body".
    env = dict(os.environ)
    drop_service_markers(env)
    env.update(extra)
    return env


def service_log_path(key: str) -> Path:
    log_dir = TMP_DIR / LOG_DIR_NAME
    if not log_dir.exists():
        log_dir.mkdir(parents=True, exist_ok=True)
        if not IS_WINDOWS:
            os.chmod(log_dir, SHARED_LOG_DIR_MODE)
    log_path = log_dir / f'{key}{LOG_SUFFIX}'
    if os.access(log_dir, os.W_OK) and (not log_path.exists() or os.access(log_path, os.W_OK)):
        return log_path
    user_log_dir = TMP_DIR / f'{LOG_DIR_NAME}_{getpass.getuser()}'
    user_log_dir.mkdir(parents=True, exist_ok=True)
    return user_log_dir / f'{key}{LOG_SUFFIX}'


def format_command(argv: List[str]) -> str:
    if IS_WINDOWS:
        return subprocess.list2cmdline(argv)
    return shlex.join(argv)


def spawn_detached(argv: List[str], cwd: Path, env: dict, log_path: Path) -> None:
    with open(log_path, 'w', encoding='utf-8') as log_handle:
        log_handle.write(f'{LOG_COMMAND_PREFIX}{format_command(argv)}\n')
        log_handle.flush()
        if IS_WINDOWS:
            subprocess.Popen(
                argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=log_handle,
                stderr=subprocess.STDOUT, creationflags=WINDOWS_DETACHED_FLAGS, close_fds=True,
            )
            return
        spawn_detached_posix(argv, cwd=cwd, env=env,
                             stdout=log_handle, stderr=subprocess.STDOUT)


def run_logged(argv: List[str], cwd: Path, env: dict, log_path: Path, timeout: float) -> int:
    """Run *argv* to completion with its output in *log_path*; the exit code."""
    with open(log_path, 'w', encoding='utf-8') as log_handle:
        log_handle.write(f'{LOG_COMMAND_PREFIX}{format_command(argv)}\n')
        log_handle.flush()
        return subprocess.run(
            argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=log_handle,
            stderr=subprocess.STDOUT, timeout=timeout, close_fds=True,
        ).returncode
