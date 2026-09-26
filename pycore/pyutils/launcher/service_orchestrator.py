# -*- coding: utf-8 -*-
"""
Idempotent background-service prompts for launcher option [1]: laravel_main,
the mcp-chrome hot-reload watcher and the pycore UI (nexus-dash). A running
service is skipped, an installed but stopped one is started, and a missing one
is installed by its own start script, spawned detached so it outlives the
launcher.
"""

import getpass
import os
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from pycore.pyfoundations.core_node_dirs import read_global_var
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import run_args
from pycore.pyfoundations.pybasecommon.timed_input import ask_yes_no_timed
from pycore.pyfoundations.pygvar import PROJECT_ROOT, TMP_DIR
from pycore.pyfoundations.service_contract import host, port, value
from pycore.pyfoundations.system_service_state import (
    LARAVEL_FRANKENPHP_SERVICE_NAME,
    LARAVEL_LEGACY_SERVICE_NAME,
    LARAVEL_NGINX_SERVICE_NAME,
    NEXUS_DASH_SERVICE_NAME,
    SC_COMMAND,
    SCHTASKS_COMMAND,
    STATE_ABSENT,
    STATE_RUNNING,
    STATE_STOPPED,
    SUDO_COMMAND,
    SUDO_NON_INTERACTIVE_FLAG,
    SYSTEMCTL_COMMAND,
    http_text_contains,
    is_elevated,
    process_cmdline_contains,
    shell_execute_runas,
    sudo_available,
    systemd_available,
    systemd_unit_enabled,
    systemd_unit_state,
    tcp_port_open,
    windows_service_state,
    windows_task_state,
)
from pycore.pyutils.launcher.launcher_text import launcher_text

IS_WINDOWS = os.name == 'nt'
IS_LINUX = sys.platform.startswith('linux')

SERVICES_PROMPT_ENABLED_KEY = 'prompt_enabled'
SERVICES_PROMPT_TIMEOUT_KEY = 'prompt_timeout_sec'

REPO_ROOT = Path(PROJECT_ROOT)
LARAVEL_SCRIPTS_DIR = REPO_ROOT / 'poly_apps' / 'laravel_main' / 'scripts'
NEXUS_DASH_SCRIPTS_DIR = REPO_ROOT / 'poly_apps' / 'pycore_laravel_wordnew_ui' / 'scripts'
MCP_CHROME_SCRIPTS_DIR = REPO_ROOT / 'apps' / 'mcp-chrome' / 'scripts'
LINUX_START_SCRIPT = 'start.sh'
WINDOWS_START_SCRIPT = 'start.ps1'

LOG_DIR_NAME = 'launcher_services'
LOG_SUFFIX = '.log'
LOG_COMMAND_PREFIX = '$ '
SHARED_LOG_DIR_MODE = 0o1777

START_WEB_SERVER_KEY = 'START_WEB_SERVER'
WEB_SERVER_PLANE_KEY = 'WEB_SERVER_PLANE'
NGINX_PLANE = 'nginx'

LOOPBACK_HOST = host('loopback')
LARAVEL_BACKEND_PORT = port('laravel_api_backend')
NEXUS_DASH_HEALTH_URL = f"http://{LOOPBACK_HOST}:{port('nexus_dash_frontend')}/pycore-manager"
NEXUS_DASH_HEALTH_TEXT = 'Nexus Dash'
MCP_CHROME_SERVICE_NAME = value('mcp_chrome.service_name')
MCP_CHROME_TASK_NAME = value('mcp_chrome.windows_task_name')

TCP_PROBE_TIMEOUT_SEC = 0.5
HTTP_PROBE_TIMEOUT_SEC = 2.0
COMMAND_TIMEOUT_SEC = 30

PRIVILEGE_ROOT = 'root'
PRIVILEGE_INVOKER = 'invoker'
WINDOWS_KIND_SERVICE = 'service'
WINDOWS_KIND_TASK = 'task'

# start.sh scripts treat INVOCATION_ID as "running as the systemd unit body".
SYSTEMD_UNIT_ENV = 'INVOCATION_ID'
CHILD_ENV_DROPPED = frozenset({SYSTEMD_UNIT_ENV, 'JOURNAL_STREAM'})
ENV_COMMAND = 'env'
BASH_COMMAND = 'bash'
TAIL_FOLLOW_COMMAND = ('tail', '-f')
SYSTEMD_RUN_COMMAND = 'systemd-run'
SYSTEMD_RUN_SCOPE_ARGS = ('--scope', '--quiet')
SYSTEMD_RUN_USER_FLAG = '--user'
POWERSHELL_EXE = 'powershell.exe'
POWERSHELL_FILE_ARGS = ('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File')
CMD_EXE = 'cmd.exe'
CMD_RUN_ARGS = '/d /s /c'
WINDOWS_CREATE_NEW_PROCESS_GROUP = 0x00000200
WINDOWS_CREATE_NO_WINDOW = 0x08000000
WINDOWS_DETACHED_FLAGS = WINDOWS_CREATE_NO_WINDOW | WINDOWS_CREATE_NEW_PROCESS_GROUP


class ServiceI18nKeys:
    HEADER = 'launcher.services.header'
    PROMPTS_DISABLED = 'launcher.services.prompts_disabled'
    UNSUPPORTED_PLATFORM = 'launcher.services.unsupported_platform'
    NAME_LARAVEL_MAIN = 'launcher.services.name_laravel_main'
    NAME_MCP_CHROME = 'launcher.services.name_mcp_chrome'
    NAME_NEXUS_DASH = 'launcher.services.name_nexus_dash'
    ALREADY_RUNNING = 'launcher.services.already_running'
    IN_PROGRESS = 'launcher.services.in_progress'
    PROMPT_START = 'launcher.services.prompt_start'
    PROMPT_INSTALL = 'launcher.services.prompt_install'
    PROMPT_RUN = 'launcher.services.prompt_run'
    SKIPPED = 'launcher.services.skipped'
    START_REQUESTED = 'launcher.services.start_requested'
    START_FAILED = 'launcher.services.start_failed'
    ENABLE_FAILED = 'launcher.services.enable_failed'
    INSTALLING = 'launcher.services.installing'
    LAUNCHING = 'launcher.services.launching'
    LOG_PATH = 'launcher.services.log_path'
    STATUS_COMMAND = 'launcher.services.status_command'
    SCRIPT_MISSING = 'launcher.services.script_missing'
    PRIVILEGE_REQUIRED = 'launcher.services.privilege_required'
    MANUAL_COMMAND = 'launcher.services.manual_command'
    ELEVATION_PROMPT = 'launcher.services.elevation_prompt'
    ELEVATION_FAILED = 'launcher.services.elevation_failed'


@dataclass(frozen=True)
class BackgroundServiceSpec:
    key: str
    name_key: str
    linux_units: Tuple[str, ...]
    linux_script: Path
    linux_install_args: Tuple[str, ...]
    linux_install_env: Tuple[Tuple[str, str], ...]
    linux_unmanaged_args: Tuple[str, ...]
    linux_unmanaged_env: Tuple[Tuple[str, str], ...]
    linux_privilege: str
    windows_kind: str
    windows_name: str
    windows_script: Path
    windows_install_args: Tuple[str, ...]
    windows_install_env: Tuple[Tuple[str, str], ...]
    windows_install_elevated: bool
    tcp_probe_port: int = 0
    http_probe_url: str = ''
    http_probe_text: str = ''
    running_markers: Tuple[str, ...] = ()
    running_excluded_markers: Tuple[str, ...] = ()
    installer_markers: Tuple[str, ...] = ()


def _laravel_linux_units() -> Tuple[str, ...]:
    # Mirrors web_server_plane() in global_var_store.sh: anything but nginx is frankenphp.
    plane = read_global_var(START_WEB_SERVER_KEY) or read_global_var(WEB_SERVER_PLANE_KEY) or ''
    if plane.strip().lower() == NGINX_PLANE:
        return (LARAVEL_NGINX_SERVICE_NAME, LARAVEL_FRANKENPHP_SERVICE_NAME, LARAVEL_LEGACY_SERVICE_NAME)
    return (LARAVEL_FRANKENPHP_SERVICE_NAME, LARAVEL_NGINX_SERVICE_NAME, LARAVEL_LEGACY_SERVICE_NAME)


def build_service_specs() -> Tuple[BackgroundServiceSpec, ...]:
    return (
        BackgroundServiceSpec(
            key='laravel_main',
            name_key=ServiceI18nKeys.NAME_LARAVEL_MAIN,
            linux_units=_laravel_linux_units() if IS_LINUX else (),
            linux_script=LARAVEL_SCRIPTS_DIR / LINUX_START_SCRIPT,
            linux_install_args=('--service', '--no-ui', '--skip-ssh'),
            linux_install_env=(('DD_AUTO_CONTINUE', '1'), ('CODEMART_INIT', 'no'), ('AS_SERVICE', 'yes')),
            linux_unmanaged_args=('--no-service', '--no-ui', '--skip-ssh'),
            linux_unmanaged_env=(('DD_AUTO_CONTINUE', '1'), ('CODEMART_INIT', 'no'), ('AS_SERVICE', 'no')),
            linux_privilege=PRIVILEGE_ROOT,
            # The legacy NSSM ncore-laravel-main runs a broken body; only WinSW counts.
            windows_kind=WINDOWS_KIND_SERVICE,
            windows_name=LARAVEL_FRANKENPHP_SERVICE_NAME,
            windows_script=LARAVEL_SCRIPTS_DIR / WINDOWS_START_SCRIPT,
            windows_install_args=('--service',),
            windows_install_env=(('CODEMART_INIT', 'no'), ('DD_AUTO_CONTINUE', '1')),
            windows_install_elevated=True,
            tcp_probe_port=LARAVEL_BACKEND_PORT,
            installer_markers=(
                'laravel_main/scripts/start.sh --service',
                'laravel_main/scripts/start.sh --no-service',
                '175_laravel_main_start.sh --service',
                '175_laravel_main_start.sh --no-service',
                'laravel_main/scripts/start.ps1 --service',
                'Step175_LaravelMainStart.ps1',
            ),
        ),
        BackgroundServiceSpec(
            key='mcp_chrome',
            name_key=ServiceI18nKeys.NAME_MCP_CHROME,
            linux_units=(MCP_CHROME_SERVICE_NAME,),
            linux_script=MCP_CHROME_SCRIPTS_DIR / LINUX_START_SCRIPT,
            linux_install_args=('--service',),
            linux_install_env=(('MCP_CHROME_AS_SERVICE', 'yes'), ('DD_AUTO_CONTINUE', '1')),
            linux_unmanaged_args=('--no-service',),
            linux_unmanaged_env=(('MCP_CHROME_AS_SERVICE', 'no'), ('MCP_CHROME_WATCH_MODE', 'dev')),
            # Builds and the native-host manifest belong to the desktop user;
            # start.sh elevates only the unit write itself.
            linux_privilege=PRIVILEGE_INVOKER,
            windows_kind=WINDOWS_KIND_TASK,
            windows_name=MCP_CHROME_TASK_NAME,
            windows_script=MCP_CHROME_SCRIPTS_DIR / WINDOWS_START_SCRIPT,
            windows_install_args=('-Service',),
            windows_install_env=(('DD_AUTO_CONTINUE', '1'),),
            windows_install_elevated=False,
            running_markers=(
                'service_supervisor.py --project-root',
                'scripts/dev-watch.mjs',
                'mcp-chrome/scripts/start.ps1',
            ),
            running_excluded_markers=('--wake',),
            installer_markers=(
                'mcp-chrome/scripts/start.sh --service',
                'mcp-chrome/scripts/start.sh --no-service',
            ),
        ),
        BackgroundServiceSpec(
            key='nexus_dash',
            name_key=ServiceI18nKeys.NAME_NEXUS_DASH,
            linux_units=(NEXUS_DASH_SERVICE_NAME,),
            linux_script=NEXUS_DASH_SCRIPTS_DIR / LINUX_START_SCRIPT,
            linux_install_args=('--service', '--no-backend', '--dev', '--non-interactive'),
            linux_install_env=(('DD_AUTO_CONTINUE', '1'),),
            linux_unmanaged_args=('--no-service', '--no-backend', '--dev', '--non-interactive'),
            linux_unmanaged_env=(('DD_AUTO_CONTINUE', '1'),),
            linux_privilege=PRIVILEGE_ROOT,
            windows_kind=WINDOWS_KIND_SERVICE,
            windows_name=NEXUS_DASH_SERVICE_NAME,
            windows_script=NEXUS_DASH_SCRIPTS_DIR / WINDOWS_START_SCRIPT,
            windows_install_args=('-Service', '-NoBackend'),
            windows_install_env=(('DD_AUTO_CONTINUE', '1'),),
            windows_install_elevated=True,
            http_probe_url=NEXUS_DASH_HEALTH_URL,
            http_probe_text=NEXUS_DASH_HEALTH_TEXT,
            installer_markers=(
                'pycore_laravel_wordnew_ui/scripts/start.sh --service',
                'pycore_laravel_wordnew_ui/scripts/start.sh --no-service',
                'pycore_laravel_wordnew_ui/scripts/start.ps1 -Service',
            ),
        ),
    )


def run_launcher_service_prompts(config_manager, interactive: bool) -> None:
    """Offer laravel_main, mcp-chrome and nexus-dash in order; each prompt defaults to Yes."""
    services_config = config_manager.get_services_config()
    ColorPrint.plain('')
    ColorPrint.cyan(launcher_text.get(ServiceI18nKeys.HEADER))
    if not services_config[SERVICES_PROMPT_ENABLED_KEY]:
        ColorPrint.gray(launcher_text.get(ServiceI18nKeys.PROMPTS_DISABLED))
        return
    if not IS_WINDOWS and not IS_LINUX:
        ColorPrint.yellow(launcher_text.get(ServiceI18nKeys.UNSUPPORTED_PLATFORM))
        return
    timeout_sec = services_config[SERVICES_PROMPT_TIMEOUT_KEY]
    systemd = IS_LINUX and systemd_available()
    for spec in build_service_specs():
        _handle_service(spec, systemd, timeout_sec, interactive)


def _handle_service(spec: BackgroundServiceSpec, systemd: bool, timeout_sec: float, interactive: bool) -> None:
    name = launcher_text.get(spec.name_key)
    state, target = _detect_state(spec, systemd)
    if state == STATE_RUNNING:
        ColorPrint.green(launcher_text.get(ServiceI18nKeys.ALREADY_RUNNING, name=name))
        return
    if process_cmdline_contains(spec.installer_markers):
        ColorPrint.yellow(launcher_text.get(ServiceI18nKeys.IN_PROGRESS, name=name))
        return
    prompt = launcher_text.get(_prompt_key(state, systemd), name=name, seconds=timeout_sec)
    if not ask_yes_no_timed(prompt, timeout_sec, default_yes=True, interactive=interactive):
        ColorPrint.gray(launcher_text.get(ServiceI18nKeys.SKIPPED, name=name))
        return
    if state == STATE_STOPPED:
        _start_installed(spec, name, target)
        return
    if IS_WINDOWS:
        _install_windows(spec, name)
        return
    _install_linux(spec, name, target, systemd)


def _prompt_key(state: str, systemd: bool) -> str:
    if state == STATE_STOPPED:
        return ServiceI18nKeys.PROMPT_START
    if IS_WINDOWS or systemd:
        return ServiceI18nKeys.PROMPT_INSTALL
    return ServiceI18nKeys.PROMPT_RUN


def _detect_state(spec: BackgroundServiceSpec, systemd: bool) -> Tuple[str, str]:
    """Return (state, service name to start or report)."""
    state, target = _manager_state(spec, systemd)
    if state != STATE_RUNNING and _probe_running(spec, systemd):
        return STATE_RUNNING, target
    return state, target


def _manager_state(spec: BackgroundServiceSpec, systemd: bool) -> Tuple[str, str]:
    if IS_WINDOWS:
        if spec.windows_kind == WINDOWS_KIND_TASK:
            return windows_task_state(spec.windows_name), spec.windows_name
        return windows_service_state(spec.windows_name), spec.windows_name
    if not systemd:
        return STATE_ABSENT, ''
    stopped_unit = ''
    for unit in spec.linux_units:
        unit_state = systemd_unit_state(unit)
        if unit_state == STATE_RUNNING:
            return STATE_RUNNING, unit
        if unit_state == STATE_STOPPED and not stopped_unit:
            stopped_unit = unit
    if stopped_unit:
        return STATE_STOPPED, stopped_unit
    return STATE_ABSENT, spec.linux_units[0]


def _probe_running(spec: BackgroundServiceSpec, systemd: bool) -> bool:
    if spec.http_probe_url and http_text_contains(spec.http_probe_url, spec.http_probe_text, HTTP_PROBE_TIMEOUT_SEC):
        return True
    # With systemd the unit is authoritative: another program (e.g. a container) may hold the port.
    if spec.tcp_probe_port and not systemd and tcp_port_open(LOOPBACK_HOST, spec.tcp_probe_port, TCP_PROBE_TIMEOUT_SEC):
        return True
    return process_cmdline_contains(spec.running_markers, spec.running_excluded_markers)


def _start_installed(spec: BackgroundServiceSpec, name: str, target: str) -> None:
    if IS_WINDOWS:
        _start_windows(spec, name, target)
        return
    privilege = _root_privilege_prefix()
    if privilege is None:
        _print_privilege_hint(name, [SUDO_COMMAND, SYSTEMCTL_COMMAND, 'start', target])
        return
    if not systemd_unit_enabled(target):
        enable_result = run_args([*privilege, SYSTEMCTL_COMMAND, 'enable', target], timeout=COMMAND_TIMEOUT_SEC)
        if not enable_result.success:
            ColorPrint.yellow(launcher_text.get(
                ServiceI18nKeys.ENABLE_FAILED, name=name, service=target, detail=enable_result.combined.strip(),
            ))
    start_result = run_args([*privilege, SYSTEMCTL_COMMAND, 'start', '--no-block', target], timeout=COMMAND_TIMEOUT_SEC)
    _report_start(name, target, start_result.success, start_result.combined.strip(),
                  shlex.join([SYSTEMCTL_COMMAND, 'status', target]))


def _start_windows(spec: BackgroundServiceSpec, name: str, target: str) -> None:
    status_command = _windows_status_command(spec)
    if spec.windows_kind == WINDOWS_KIND_TASK:
        result = run_args([SCHTASKS_COMMAND, '/Run', '/TN', target], timeout=COMMAND_TIMEOUT_SEC)
        _report_start(name, target, result.success, result.combined.strip(), status_command)
        return
    if is_elevated():
        result = run_args([SC_COMMAND, 'start', target], timeout=COMMAND_TIMEOUT_SEC)
        _report_start(name, target, result.success, result.combined.strip(), status_command)
        return
    ColorPrint.yellow(launcher_text.get(ServiceI18nKeys.ELEVATION_PROMPT, name=name))
    if not shell_execute_runas(SC_COMMAND, subprocess.list2cmdline(['start', target]), None):
        ColorPrint.red(launcher_text.get(ServiceI18nKeys.ELEVATION_FAILED, name=name))
        return
    _report_start(name, target, True, '', status_command)


def _report_start(name: str, target: str, success: bool, detail: str, status_command: str) -> None:
    if not success:
        ColorPrint.red(launcher_text.get(ServiceI18nKeys.START_FAILED, name=name, service=target, detail=detail))
        return
    ColorPrint.green(launcher_text.get(ServiceI18nKeys.START_REQUESTED, name=name, service=target))
    ColorPrint.plain(launcher_text.get(ServiceI18nKeys.STATUS_COMMAND, command=status_command))


def _install_linux(spec: BackgroundServiceSpec, name: str, unit: str, systemd: bool) -> None:
    script = spec.linux_script
    if not script.is_file():
        ColorPrint.red(launcher_text.get(ServiceI18nKeys.SCRIPT_MISSING, name=name, path=script))
        return
    install_args = spec.linux_install_args if systemd else spec.linux_unmanaged_args
    install_env = spec.linux_install_env if systemd else spec.linux_unmanaged_env
    env_prefix = [ENV_COMMAND, *(f'{env_name}={env_value}' for env_name, env_value in install_env)]
    script_command = [BASH_COMMAND, str(script), *install_args]
    privilege = _install_privilege_prefix(spec, systemd)
    if privilege is None:
        manual_prefix = [SUDO_COMMAND] if spec.linux_privilege == PRIVILEGE_ROOT else []
        _print_privilege_hint(name, [*manual_prefix, *env_prefix, *script_command])
        return
    runs_as_invoker = not privilege and not is_elevated()
    argv = [*privilege, *env_prefix, *_cgroup_escape_prefix(runs_as_invoker), *script_command]
    log_path = _service_log_path(spec.key)
    _spawn_detached(argv, script.parent, _child_env(()), log_path)
    ColorPrint.cyan(launcher_text.get(ServiceI18nKeys.INSTALLING if systemd else ServiceI18nKeys.LAUNCHING, name=name))
    ColorPrint.plain(launcher_text.get(ServiceI18nKeys.LOG_PATH, path=log_path))
    if systemd:
        status_command = shlex.join([SYSTEMCTL_COMMAND, 'status', unit])
    else:
        status_command = shlex.join([*TAIL_FOLLOW_COMMAND, str(log_path)])
    ColorPrint.plain(launcher_text.get(ServiceI18nKeys.STATUS_COMMAND, command=status_command))


def _install_windows(spec: BackgroundServiceSpec, name: str) -> None:
    script = spec.windows_script
    if not script.is_file():
        ColorPrint.red(launcher_text.get(ServiceI18nKeys.SCRIPT_MISSING, name=name, path=script))
        return
    argv = [POWERSHELL_EXE, *POWERSHELL_FILE_ARGS, str(script), *spec.windows_install_args]
    log_path = _service_log_path(spec.key)
    if spec.windows_install_elevated and not is_elevated():
        ColorPrint.yellow(launcher_text.get(ServiceI18nKeys.ELEVATION_PROMPT, name=name))
        parameters = _cmd_wrapper_parameters(argv, spec.windows_install_env, script.parent, log_path)
        if not shell_execute_runas(CMD_EXE, parameters, str(script.parent)):
            ColorPrint.red(launcher_text.get(ServiceI18nKeys.ELEVATION_FAILED, name=name))
            return
    else:
        _spawn_detached(argv, script.parent, _child_env(spec.windows_install_env), log_path)
    ColorPrint.cyan(launcher_text.get(ServiceI18nKeys.INSTALLING, name=name))
    ColorPrint.plain(launcher_text.get(ServiceI18nKeys.LOG_PATH, path=log_path))
    ColorPrint.plain(launcher_text.get(ServiceI18nKeys.STATUS_COMMAND, command=_windows_status_command(spec)))


def _windows_status_command(spec: BackgroundServiceSpec) -> str:
    if spec.windows_kind == WINDOWS_KIND_TASK:
        return subprocess.list2cmdline([SCHTASKS_COMMAND, '/Query', '/TN', spec.windows_name])
    return subprocess.list2cmdline([SC_COMMAND, 'query', spec.windows_name])


def _cmd_wrapper_parameters(argv: List[str], env_pairs: Iterable[Tuple[str, str]], cwd: Path, log_path: Path) -> str:
    # UAC does not carry the caller's environment, and cmd-level redirection keeps
    # native-command stderr out of PowerShell error records.
    steps = [f'set "{env_name}={env_value}"' for env_name, env_value in env_pairs]
    steps.append(f'cd /d "{cwd}"')
    steps.append(f'{subprocess.list2cmdline(argv)} > "{log_path}" 2>&1')
    command_line = ' && '.join(steps)
    return f'{CMD_RUN_ARGS} "{command_line}"'


def _root_privilege_prefix() -> Optional[List[str]]:
    if is_elevated():
        return []
    if sudo_available():
        return [SUDO_COMMAND, SUDO_NON_INTERACTIVE_FLAG]
    return None


def _install_privilege_prefix(spec: BackgroundServiceSpec, systemd: bool) -> Optional[List[str]]:
    if spec.linux_privilege == PRIVILEGE_INVOKER and not is_elevated():
        if not systemd or sudo_available():
            return []
        return None
    return _root_privilege_prefix()


def _cgroup_escape_prefix(user_scope: bool) -> List[str]:
    # Under a systemd unit (e.g. the login auto-start), the unit's cgroup is
    # killed when the launcher exits; a transient scope keeps the child alive.
    if SYSTEMD_UNIT_ENV not in os.environ or shutil.which(SYSTEMD_RUN_COMMAND) is None:
        return []
    prefix = [SYSTEMD_RUN_COMMAND, *SYSTEMD_RUN_SCOPE_ARGS]
    if user_scope:
        prefix.append(SYSTEMD_RUN_USER_FLAG)
    return prefix


def _print_privilege_hint(name: str, command: List[str]) -> None:
    ColorPrint.yellow(launcher_text.get(ServiceI18nKeys.PRIVILEGE_REQUIRED, name=name))
    ColorPrint.plain(launcher_text.get(ServiceI18nKeys.MANUAL_COMMAND, command=shlex.join(command)))


def _child_env(extra: Iterable[Tuple[str, str]]) -> dict:
    env = {env_name: env_value for env_name, env_value in os.environ.items() if env_name not in CHILD_ENV_DROPPED}
    env.update(extra)
    return env


def _service_log_path(key: str) -> Path:
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


def _format_command(argv: List[str]) -> str:
    if IS_WINDOWS:
        return subprocess.list2cmdline(argv)
    return shlex.join(argv)


def _spawn_detached(argv: List[str], cwd: Path, env: dict, log_path: Path) -> None:
    with open(log_path, 'w', encoding='utf-8') as log_handle:
        log_handle.write(f'{LOG_COMMAND_PREFIX}{_format_command(argv)}\n')
        log_handle.flush()
        if IS_WINDOWS:
            subprocess.Popen(
                argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=log_handle,
                stderr=subprocess.STDOUT, creationflags=WINDOWS_DETACHED_FLAGS, close_fds=True,
            )
            return
        subprocess.Popen(
            argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, stdout=log_handle,
            stderr=subprocess.STDOUT, start_new_session=True, close_fds=True,
        )
