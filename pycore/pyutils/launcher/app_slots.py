# -*- coding: utf-8 -*-
"""
Application slots for the window launcher.

Each slot starts at most ONE application: the browser, the code editor
(cursor, then codex) and the system default text editor. A slot walks its
members in priority order and is skipped at the first one that already runs
(any user); otherwise that member is launched when it is enabled in config and
resolves, so a lower-priority member (running or not) only matters when every
higher one is disabled or unavailable. The extras (wechat, qq, aiassistant)
stay config-driven. Every child is detached so it outlives the launcher; on a
root Linux launcher the desktop GUI apps run as the pkexec/sudo caller.
"""

import os
from pathlib import Path
from typing import Dict, Optional, Set, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.process_manager import ProcessManager
from pycore.pyfoundations.pygvar import IS_WINDOWS, PROJECT_ROOT
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
from pycore.pyutils.launcher.launch_guard import is_app_running, resolve_launch_path
from pycore.pyutils.launcher.launcher_text import launcher_text
from pycore.pyutils.launcher.linux_desktop_user import desktop_user
from pycore.pyutils.launcher.script_generator import ScriptGenerator


class AppsI18nKeys:
    SLOT_BROWSER = 'launcher.apps.slot_browser'
    SLOT_CODE_EDITOR = 'launcher.apps.slot_code_editor'
    SLOT_TEXT_EDITOR = 'launcher.apps.slot_text_editor'
    SLOT_RUNNING = 'launcher.apps.slot_running'
    SLOT_DISABLED = 'launcher.apps.slot_disabled'
    SLOT_NOT_FOUND = 'launcher.apps.slot_not_found'
    SKIP_ALTERNATIVE = 'launcher.apps.skip_alternative'
    SKIP_DISABLED = 'launcher.apps.skip_disabled'
    SKIP_PLATFORM = 'launcher.apps.skip_platform'
    SKIP_RUNNING = 'launcher.apps.skip_running'
    SKIP_SAME_EXECUTABLE = 'launcher.apps.skip_same_executable'
    SKIP_NOT_FOUND = 'launcher.apps.skip_not_found'
    SKIP_AIASSISTANT_MISSING = 'launcher.apps.skip_aiassistant_missing'
    LAUNCHING = 'launcher.apps.launching'
    LAUNCHING_ADMIN = 'launcher.apps.launching_admin'
    LAUNCHING_TERMINAL = 'launcher.apps.launching_terminal'
    AS_DESKTOP_USER = 'launcher.apps.as_desktop_user'
    LAUNCHED = 'launcher.apps.launched'
    PATH_MISSING = 'launcher.apps.path_missing'
    NO_TERMINAL = 'launcher.apps.no_terminal'
    FAILED = 'launcher.apps.failed'


BROWSER_SLOT = ('chrome',)
CODE_EDITOR_SLOT = ('cursor', 'codex')
TEXT_EDITOR_SLOT = ('texteditor',)
APP_SLOTS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    (AppsI18nKeys.SLOT_BROWSER, BROWSER_SLOT),
    (AppsI18nKeys.SLOT_CODE_EDITOR, CODE_EDITOR_SLOT),
    (AppsI18nKeys.SLOT_TEXT_EDITOR, TEXT_EDITOR_SLOT),
)
# A second browser / code editor / text editor would break "one per slot".
SLOT_ALTERNATIVE_APPS = ('chrome_beta', 'edge', 'vscode', 'antigravity', 'devin', 'notepad++')
EXTRA_APPS = ('wechat', 'qq', 'aiassistant')
ADMIN_APPS = frozenset({'aiassistant'})
TERMINAL_APPS = frozenset({'codex'})
# GUI apps that belong in the desktop user's session (Chrome refuses root).
# cursor stays root on purpose: its PATH wrapper is root-only by design.
DESKTOP_USER_APPS = frozenset({'chrome', 'texteditor', 'wechat', 'qq'})
TERMINAL_WORKING_DIR = Path(PROJECT_ROOT)
LEGACY_BAT_NAME = 'launch_{app}.bat'
LEGACY_BAT_CONTENT = '@echo off\nstart "" "{path}"\n'
LEGACY_BAT_NEWLINE = '\r\n'
LAUNCH_ERRORS = (OSError, RuntimeError, ValueError)


def launch_configured_apps(config_manager, app_finder: AppFinder) -> None:
    """Launch the browser, code editor and text editor slots, then the extras."""
    AppSlotLauncher(config_manager, app_finder).run()


class AppSlotLauncher:
    """One launcher run over the configured application slots."""

    def __init__(self, config_manager, app_finder: AppFinder):
        self._apps_config = config_manager.get_applications_config()
        self._app_finder = app_finder
        self._executor = ExplorerExecutor()
        self._process_manager = ProcessManager()
        self._script_generator = ScriptGenerator()
        self._desktop_user = desktop_user()
        self._launched_paths: Set[Path] = set()
        self._resolved_paths: Dict[str, Optional[str]] = {}

    def run(self) -> None:
        for slot_key, members in APP_SLOTS:
            self._launch_slot(launcher_text.get(slot_key), members)
        for app_name in SLOT_ALTERNATIVE_APPS:
            if self._enabled(app_name):
                self._say(AppsI18nKeys.SKIP_ALTERNATIVE, app=app_name)
        for app_name in EXTRA_APPS:
            self._launch_extra(app_name)

    def _launch_slot(self, slot_label: str, members: Tuple[str, ...]) -> None:
        enabled = []
        for app_name in members:
            if not self._app_finder.is_supported_on_platform(app_name):
                continue
            if self._is_running(app_name):
                self._say(AppsI18nKeys.SLOT_RUNNING, slot=slot_label, app=app_name)
                return
            if not self._enabled(app_name):
                continue
            enabled.append(app_name)
            app_path = self._resolve(app_name)
            if app_path and self._launch(app_name, app_path):
                return
        if not enabled:
            self._say(AppsI18nKeys.SLOT_DISABLED, slot=slot_label)
            return
        self._say(AppsI18nKeys.SLOT_NOT_FOUND, slot=slot_label, apps=', '.join(enabled))

    def _launch_extra(self, app_name: str) -> None:
        if not self._enabled(app_name):
            self._say(AppsI18nKeys.SKIP_DISABLED, app=app_name)
            return
        if not self._app_finder.is_supported_on_platform(app_name):
            self._say(AppsI18nKeys.SKIP_PLATFORM, app=app_name)
            return
        if self._is_running(app_name):
            self._say(AppsI18nKeys.SKIP_RUNNING, app=app_name)
            return
        app_path = self._resolve(app_name)
        if app_path:
            self._launch(app_name, app_path)
        elif app_name in ADMIN_APPS:
            self._say(AppsI18nKeys.SKIP_AIASSISTANT_MISSING, app=app_name)
        else:
            self._say(AppsI18nKeys.SKIP_NOT_FOUND, app=app_name)

    def _enabled(self, app_name: str) -> bool:
        return bool(self._apps_config.get(app_name, {}).get('enabled', False))

    def _resolve(self, app_name: str) -> Optional[str]:
        if app_name not in self._resolved_paths:
            app_config = self._apps_config.get(app_name, {})
            self._resolved_paths[app_name] = resolve_launch_path(app_name, app_config, self._app_finder)
        return self._resolved_paths[app_name]

    def _is_running(self, app_name: str) -> bool:
        # Disabled members are matched by name only: resolving them could scan
        # disks for apps the user switched off.
        exe_path = self._resolve(app_name) if self._enabled(app_name) else None
        return is_app_running(app_name, self._process_manager, self._app_finder, exe_path=exe_path)

    def _launch(self, app_name: str, app_path: str) -> bool:
        """Start *app_name*; True when the slot is served (started or already started)."""
        resolved_path = _real_path(app_path)
        if resolved_path in self._launched_paths:
            self._say(AppsI18nKeys.SKIP_SAME_EXECUTABLE, app=app_name)
            return True
        if not Path(app_path).exists():
            ColorPrint.plain(launcher_text.get(AppsI18nKeys.PATH_MISSING, path=app_path))
            return False
        # One failing app must not abort the remaining slots and the service
        # prompts that follow; Popen/ShellExecute report failures by raising.
        try:
            started = self._start(app_name, app_path)
        except LAUNCH_ERRORS as error:
            ColorPrint.plain(launcher_text.get(AppsI18nKeys.FAILED, app=app_name, error=error))
            return False
        if started:
            self._launched_paths.add(resolved_path)
            ColorPrint.plain(launcher_text.get(AppsI18nKeys.LAUNCHED, path=app_path))
        return started

    def _start(self, app_name: str, app_path: str) -> bool:
        if app_name in TERMINAL_APPS:
            self._say(AppsI18nKeys.LAUNCHING_TERMINAL, app=app_name, cwd=TERMINAL_WORKING_DIR)
            process = self._executor.execute_in_terminal(app_path, TERMINAL_WORKING_DIR, app_name)
            if process is None:
                ColorPrint.plain(launcher_text.get(AppsI18nKeys.NO_TERMINAL, app=app_name))
                return False
            return True
        if app_name in ADMIN_APPS:
            self._say(AppsI18nKeys.LAUNCHING_ADMIN, app=app_name)
            self._executor.execute_as_admin(app_path)
            return True
        self._say(AppsI18nKeys.LAUNCHING, app=app_name)
        as_desktop_user = app_name in DESKTOP_USER_APPS
        if as_desktop_user and self._desktop_user is not None:
            ColorPrint.plain(launcher_text.get(AppsI18nKeys.AS_DESKTOP_USER, user=self._desktop_user.name))
        if IS_WINDOWS:
            self._write_legacy_bat(app_name, app_path)
        self._executor.execute_file(app_path, independent=True, as_desktop_user=as_desktop_user)
        return True

    def _write_legacy_bat(self, app_name: str, app_path: str) -> None:
        """Legacy/diagnostic launch_<app>.bat next to the grid scripts (Windows)."""
        bat_path = self._script_generator.get_temp_dir() / LEGACY_BAT_NAME.format(app=app_name)
        with open(bat_path, 'w', encoding='utf-8', newline=LEGACY_BAT_NEWLINE) as handle:
            handle.write(LEGACY_BAT_CONTENT.format(path=app_path))

    @staticmethod
    def _say(key: str, **values) -> None:
        ColorPrint.plain('\n' + launcher_text.get(key, **values))


def _real_path(app_path: str) -> Path:
    return Path(os.path.realpath(app_path))
