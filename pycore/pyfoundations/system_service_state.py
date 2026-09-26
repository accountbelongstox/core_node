# -*- coding: utf-8 -*-
"""
Background-service state probes shared by pylauncher and the window launcher:
systemd units, Windows services and scheduled tasks, loopback TCP/HTTP
endpoints, process command lines, and privilege helpers.
"""

import csv
import ctypes
import http.client
import os
import re
import shutil
import socket
import urllib.request
from typing import Iterable, Optional

from pycore.pyfoundations.pybasecommon.commander import run_args
from pycore.pyfoundations.pygvar import IS_WINDOWS
from pycore.pyfoundations.third_party.api import get_third_package_psutil

STATE_RUNNING = 'running'
STATE_STOPPED = 'stopped'
STATE_ABSENT = 'absent'

# Canonical core_node service names (not part of config/service_contract.json).
LARAVEL_FRANKENPHP_SERVICE_NAME = 'ncore-laravel-frankenphp'
LARAVEL_NGINX_SERVICE_NAME = 'ncore-laravel-nginx'
LARAVEL_LEGACY_SERVICE_NAME = 'ncore-laravel-main'
NEXUS_DASH_SERVICE_NAME = 'ncore-nexus-dash'

SYSTEMCTL_COMMAND = 'systemctl'
SYSTEMD_RUNTIME_DIR = '/run/systemd/system'
SYSTEMD_LOAD_STATE_PROPERTY = 'LoadState'
SYSTEMD_ACTIVE_STATE_PROPERTY = 'ActiveState'
SYSTEMD_ABSENT_LOAD_STATE = 'not-found'
SYSTEMD_ENABLED_STATE = 'enabled'
SYSTEMD_RUNNING_ACTIVE_STATES = frozenset({'active', 'activating', 'reloading'})
SC_COMMAND = 'sc.exe'
SC_RUNNING_PATTERN = re.compile(r'\b(RUNNING|START_PENDING)\b')
SCHTASKS_COMMAND = 'schtasks'
SCHTASKS_RUNNING_STATUS = 'Running'
SUDO_COMMAND = 'sudo'
SUDO_NON_INTERACTIVE_FLAG = '-n'
SUDO_PROBE_COMMAND = 'true'
SUDO_PROBE_TIMEOUT_SEC = 10
# setsid detaches the probe from the launcher's terminal session, as the detached installers are.
SETSID_COMMAND = 'setsid'
SETSID_WAIT_FLAG = '--wait'
QUERY_TIMEOUT_SEC = 15
HTTP_READ_LIMIT_BYTES = 65536
SHELL_EXECUTE_RUNAS_VERB = 'runas'
SHELL_EXECUTE_SW_HIDE = 0
SHELL_EXECUTE_MAX_ERROR_CODE = 32


def systemd_available() -> bool:
    return shutil.which(SYSTEMCTL_COMMAND) is not None and os.path.isdir(SYSTEMD_RUNTIME_DIR)


def systemd_unit_state(unit: str) -> str:
    result = run_args(
        [SYSTEMCTL_COMMAND, 'show', unit,
         f'--property={SYSTEMD_LOAD_STATE_PROPERTY},{SYSTEMD_ACTIVE_STATE_PROPERTY}'],
        timeout=QUERY_TIMEOUT_SEC,
    )
    properties = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if properties.get(SYSTEMD_ACTIVE_STATE_PROPERTY, '') in SYSTEMD_RUNNING_ACTIVE_STATES:
        return STATE_RUNNING
    if not result.success or properties.get(SYSTEMD_LOAD_STATE_PROPERTY, SYSTEMD_ABSENT_LOAD_STATE) == SYSTEMD_ABSENT_LOAD_STATE:
        return STATE_ABSENT
    return STATE_STOPPED


def systemd_unit_enabled(unit: str) -> bool:
    result = run_args([SYSTEMCTL_COMMAND, 'is-enabled', unit], timeout=QUERY_TIMEOUT_SEC)
    return result.success and result.stdout.strip() == SYSTEMD_ENABLED_STATE


def windows_service_state(name: str) -> str:
    # sc.exe fails (1060) for a missing service; state tokens are not localized.
    result = run_args([SC_COMMAND, 'query', name], timeout=QUERY_TIMEOUT_SEC)
    if not result.success:
        return STATE_ABSENT
    if SC_RUNNING_PATTERN.search(result.stdout):
        return STATE_RUNNING
    return STATE_STOPPED


def windows_task_state(name: str) -> str:
    # The CSV status column is localized; callers pair this with a process probe.
    result = run_args([SCHTASKS_COMMAND, '/Query', '/TN', name, '/FO', 'CSV', '/NH'], timeout=QUERY_TIMEOUT_SEC)
    if not result.success:
        return STATE_ABSENT
    for row in csv.reader(line for line in result.stdout.splitlines() if line.strip()):
        if row and row[-1].strip() == SCHTASKS_RUNNING_STATUS:
            return STATE_RUNNING
    return STATE_STOPPED


def tcp_port_open(host: str, port: int, timeout: float) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(timeout)
        return probe.connect_ex((host, port)) == 0


def http_text_contains(url: str, needle: str, timeout: float) -> bool:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    # A refused, reset, timed-out or non-2xx request is the negative probe result.
    try:
        with opener.open(url, timeout=timeout) as response:
            body = response.read(HTTP_READ_LIMIT_BYTES)
    except (OSError, http.client.HTTPException):
        return False
    return needle in body.decode('utf-8', errors='replace')


def _normalize_command_text(text: str) -> str:
    return text.replace('\\', '/').lower()


def process_matches(
    markers: Iterable[str] = (),
    excluded_markers: Iterable[str] = (),
    exe_basenames: Iterable[str] = (),
    process_names: Iterable[str] = (),
    owner_names: Iterable[str] = (),
) -> bool:
    """True when any process (any user) matches by name, argv[0] basename or command-line marker.

    Case-insensitive with '/' separators; markers may span arguments. excluded_markers
    veto a command line, owner_names limit command-line checks to those process names,
    and an unreadable command line (other users on Windows, zombies) matches by name only.
    """
    wanted = [_normalize_command_text(marker) for marker in markers]
    excluded = [_normalize_command_text(marker) for marker in excluded_markers]
    basenames = {name.lower() for name in exe_basenames}
    names = {name.lower() for name in process_names}
    owners = {name.lower() for name in owner_names}
    if not wanted and not basenames and not names:
        return False
    psutil = get_third_package_psutil()
    for process in psutil.process_iter(['name', 'cmdline']):
        name = (process.info.get('name') or '').lower()
        if name in names:
            return True
        if owners and name not in owners:
            continue
        cmdline = [_normalize_command_text(part) for part in (process.info.get('cmdline') or [])]
        if not cmdline:
            continue
        command_text = ' '.join(cmdline)
        if any(marker in command_text for marker in excluded):
            continue
        if cmdline[0].rsplit('/', 1)[-1] in basenames or any(marker in command_text for marker in wanted):
            return True
    return False


def is_elevated() -> bool:
    if IS_WINDOWS:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    return os.geteuid() == 0


def sudo_available() -> bool:
    """True when sudo runs without a password from a detached (tty-less) session."""
    return run_args(
        [SETSID_COMMAND, SETSID_WAIT_FLAG, SUDO_COMMAND, SUDO_NON_INTERACTIVE_FLAG, SUDO_PROBE_COMMAND],
        input_text='',
        timeout=SUDO_PROBE_TIMEOUT_SEC,
        detach_output=True,
    ).success


def shell_execute_runas(executable: str, parameters: str, directory: Optional[str]) -> bool:
    """Start executable elevated through UAC (hidden window); False when declined or failed."""
    instance = ctypes.windll.shell32.ShellExecuteW(
        None, SHELL_EXECUTE_RUNAS_VERB, executable, parameters, directory, SHELL_EXECUTE_SW_HIDE,
    )
    return instance > SHELL_EXECUTE_MAX_ERROR_CODE
