# -*- coding: utf-8 -*-
"""Prerequisite install step for launcher apps: run the app's idempotent installer on Linux."""

import shlex
import subprocess
from pathlib import Path

from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import IS_LINUX, PROJECT_ROOT
from pycore.pyfoundations.system_service_state import SUDO_COMMAND
from pycore.pyutils.launcher.app_catalog import (
    LINUX_INSTALLER_SCRIPTS_RELATIVE_DIR,
    LINUX_PREREQUISITE_INSTALLERS,
)
from pycore.pyutils.launcher.launcher_text import launcher_text
from pycore.pyutils.launcher.script_spawn import (
    BASH_COMMAND,
    ENV_COMMAND,
    child_env,
    root_privilege_prefix,
    run_logged,
    service_log_path,
)

INSTALLER_SCRIPTS_DIR = Path(PROJECT_ROOT) / LINUX_INSTALLER_SCRIPTS_RELATIVE_DIR
INSTALL_ENV = (('DD_AUTO_CONTINUE', '1'),)
INSTALL_TIMEOUT_SEC = 3600
INSTALL_LOG_KEY = 'install_{app}'
INSTALL_ERRORS = (OSError, subprocess.SubprocessError)


class PrerequisiteI18nKeys:
    RUNNING = 'launcher.apps.install_running'
    DONE = 'launcher.apps.install_done'
    FAILED = 'launcher.apps.install_failed'
    ERROR = 'launcher.apps.install_error'
    SCRIPT_MISSING = 'launcher.apps.install_script_missing'
    NO_DISPLAY = 'launcher.apps.install_no_display'
    PRIVILEGE = 'launcher.apps.install_privilege'
    MANUAL_COMMAND = 'launcher.apps.install_manual_command'


def has_prerequisite_installer(app_name: str) -> bool:
    return IS_LINUX and app_name in LINUX_PREREQUISITE_INSTALLERS


def ensure_installed(app_name: str) -> bool:
    """Run the installer of *app_name* once, synchronously; True when it exited 0."""
    if not has_prerequisite_installer(app_name):
        return False
    if not has_graphical_display():
        ColorPrint.plain(launcher_text.get(PrerequisiteI18nKeys.NO_DISPLAY, app=app_name))
        return False
    script_name, script_args = LINUX_PREREQUISITE_INSTALLERS[app_name]
    script = INSTALLER_SCRIPTS_DIR / script_name
    if not script.is_file():
        ColorPrint.plain(launcher_text.get(PrerequisiteI18nKeys.SCRIPT_MISSING, path=script))
        return False
    env_prefix = [ENV_COMMAND, *(f'{name}={value}' for name, value in INSTALL_ENV)]
    script_command = [BASH_COMMAND, str(script), *script_args]
    privilege = root_privilege_prefix()
    if privilege is None:
        ColorPrint.yellow(launcher_text.get(PrerequisiteI18nKeys.PRIVILEGE, app=app_name))
        manual = shlex.join([SUDO_COMMAND, *env_prefix, *script_command])
        ColorPrint.plain(launcher_text.get(PrerequisiteI18nKeys.MANUAL_COMMAND, command=manual))
        return False
    log_path = service_log_path(INSTALL_LOG_KEY.format(app=app_name))
    ColorPrint.cyan('\n' + launcher_text.get(PrerequisiteI18nKeys.RUNNING, app=app_name, script=script_name, path=log_path))
    try:
        code = run_logged([*privilege, *env_prefix, *script_command], script.parent, child_env(()), log_path,
                          INSTALL_TIMEOUT_SEC)
    except INSTALL_ERRORS as error:
        ColorPrint.red(launcher_text.get(PrerequisiteI18nKeys.ERROR, app=app_name, error=error))
        return False
    if code != 0:
        ColorPrint.red(launcher_text.get(PrerequisiteI18nKeys.FAILED, app=app_name, code=code, path=log_path))
        return False
    ColorPrint.green(launcher_text.get(PrerequisiteI18nKeys.DONE, app=app_name))
    return True
