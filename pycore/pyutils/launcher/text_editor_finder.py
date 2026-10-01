# -*- coding: utf-8 -*-
"""System default text editor: Windows .txt association, Linux xdg-mime default."""

import ctypes
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.app_catalog import APP_DEFINITIONS, LINUX_APP_DEFINITIONS, TEXT_EDITOR_APPS
from pycore.pyutils.launcher.app_search import app_path_cache, find_linux_app, linux_binary_usable
from pycore.pyutils.launcher.linux_desktop_user import desktop_user, desktop_user_argv, desktop_user_env

# Windows default text editor: the .txt "open" association, else Notepad.
WINDOWS_TEXT_EXTENSION = '.txt'
WINDOWS_ASSOC_VERB = 'open'
ASSOCF_NONE = 0
ASSOCSTR_EXECUTABLE = 2
ASSOC_S_OK = 0
ASSOC_BUFFER_CHARS = 1024
WINDOWS_NOTEPAD_EXE = 'notepad.exe'
WINDOWS_SYSTEM_ROOT_ENV = 'SystemRoot'
WINDOWS_DEFAULT_SYSTEM_ROOT = 'C:\\Windows'
WINDOWS_SYSTEM_DIR = 'System32'
# Packaged-app executables under WindowsApps are not directly launchable;
# System32\notepad.exe forwards to the Store Notepad instead.
WINDOWS_APPS_MARKER = 'windowsapps'

# Linux default text editor (freedesktop xdg-mime + desktop entries).
LINUX_TEXT_MIME = 'text/plain'
XDG_MIME_QUERY = ('xdg-mime', 'query', 'default')
XDG_MIME_TIMEOUT_SEC = 3
DESKTOP_ENTRY_SUFFIX = '.desktop'
DESKTOP_ENTRY_GROUP = '[Desktop Entry]'
DESKTOP_EXEC_PREFIX = 'Exec='
DESKTOP_TERMINAL_TRUE = 'terminal=true'
DESKTOP_CATEGORIES_PREFIX = 'Categories='
DESKTOP_TEXT_EDITOR_CATEGORY = 'TextEditor'
DESKTOP_EXEC_WRAPPER = 'env'
SYSTEM_APPLICATION_DIRS = ('/usr/local/share/applications', '/usr/share/applications')
USER_APPLICATION_SUBDIR = ('.local', 'share', 'applications')

TEXT_EDITOR_APP = 'texteditor'
TEXT_EDITOR_CACHE_KEY = 'texteditor_path'


class TextEditorFinder:
    """Resolve the desktop's default GUI text editor, always live."""

    def find(self) -> Optional[str]:
        """System default text editor: Windows .txt association, Linux xdg-mime.

        Always resolved live (app_cache.json is only written, for the menu) so
        a changed default or a stale cached fallback never pins an old editor.
        """
        if sys.platform == 'win32':
            return self._find_windows()
        resolved = self._find_linux_default() or find_linux_app(TEXT_EDITOR_APP)
        if resolved:
            app_path_cache.put(TEXT_EDITOR_CACHE_KEY, resolved)
        return resolved

    def windows_process_names(self) -> List[str]:
        """Process names meaning "a text editor is open" on Windows."""
        names = [WINDOWS_NOTEPAD_EXE]
        resolved = self.find()
        if resolved:
            editor_name = Path(resolved).name.lower()
            if editor_name not in names:
                names.insert(0, editor_name)
        return names

    def _find_linux_default(self) -> Optional[str]:
        """Resolve the desktop's DEFAULT text editor via xdg-mime (freedesktop).

        ``xdg-mime query default text/plain`` returns the .desktop id the desktop
        associates with plain text; the Exec line of that desktop file yields
        the binary. A root launcher asks as the pkexec/sudo caller, whose
        mimeapps.list is the one that matters. Returns None when undeterminable.
        """
        query = list(XDG_MIME_QUERY) + [LINUX_TEXT_MIME]
        if not shutil.which(query[0]):
            return None
        home = Path.home()
        env = None
        user = desktop_user()
        if user is not None:
            user_query = desktop_user_argv(user, query)
            if user_query:
                query, home, env = user_query, Path(user.home), desktop_user_env(user)
        try:
            result = subprocess.run(query, capture_output=True, text=True, env=env,
                                    stdin=subprocess.DEVNULL, timeout=XDG_MIME_TIMEOUT_SEC)
        except (subprocess.TimeoutExpired, OSError) as exc:
            ColorPrint.yellow(f"[TextEditorFinder] {' '.join(query)} failed: {exc}")
            return None
        desktop_id = (result.stdout or '').strip()
        if not desktop_id.endswith(DESKTOP_ENTRY_SUFFIX):
            return None

        data_dirs = [home.joinpath(*USER_APPLICATION_SUBDIR)]
        data_dirs.extend(Path(data_dir) for data_dir in SYSTEM_APPLICATION_DIRS)
        for data_dir in data_dirs:
            desktop_file = data_dir / desktop_id
            if desktop_file.is_file():
                return self._desktop_entry_binary(desktop_file)
        return None

    def _desktop_entry_binary(self, desktop_file: Path) -> Optional[str]:
        """Launchable GUI text-editor binary of a desktop entry, else None.

        Declined (so the GUI fallback list is used instead): terminal editors
        (vim.desktop), entries without the TextEditor category (office suites)
        and the launcher's other apps. Without XDG_CURRENT_DESKTOP (pkexec drops
        it) xdg-mime falls back to mimeinfo.cache, whose first text/plain entry
        can be cursor.desktop or google-chrome.desktop.
        """
        exec_tokens: List[str] = []
        categories: List[str] = []
        terminal_entry = False
        in_entry_group = False
        for line in desktop_file.read_text(encoding='utf-8', errors='ignore').splitlines():
            stripped = line.strip()
            if stripped.startswith('['):
                in_entry_group = stripped == DESKTOP_ENTRY_GROUP
                continue
            if not in_entry_group:
                continue
            if stripped.startswith(DESKTOP_EXEC_PREFIX):
                exec_tokens = stripped[len(DESKTOP_EXEC_PREFIX):].split()
            elif stripped.startswith(DESKTOP_CATEGORIES_PREFIX):
                categories = stripped[len(DESKTOP_CATEGORIES_PREFIX):].split(';')
            elif stripped.lower() == DESKTOP_TERMINAL_TRUE:
                terminal_entry = True
        while exec_tokens and (exec_tokens[0] == DESKTOP_EXEC_WRAPPER or '=' in exec_tokens[0]):
            exec_tokens.pop(0)
        if terminal_entry or not exec_tokens or DESKTOP_TEXT_EDITOR_CATEGORY not in categories:
            return None
        binary_name = os.path.basename(exec_tokens[0])
        if binary_name in self._linux_non_text_editor_binaries():
            return None
        resolved = shutil.which(binary_name)
        if resolved and linux_binary_usable(Path(resolved)):
            return resolved
        return None

    @staticmethod
    def _linux_non_text_editor_binaries() -> frozenset:
        """Binaries of every other launcher app (browsers, IDEs, messengers)."""
        return frozenset(
            binary
            for app_name, spec in LINUX_APP_DEFINITIONS.items()
            if app_name not in TEXT_EDITOR_APPS
            for binary in spec.get('binaries', []))

    @staticmethod
    def _windows_non_text_editor_names() -> frozenset:
        """Lower-case exe names of every other launcher app (browsers, IDEs, messengers)."""
        return frozenset(
            name.lower()
            for app_name, spec in APP_DEFINITIONS.items()
            if app_name not in TEXT_EDITOR_APPS
            for name in spec.get('names', []))

    def _find_windows(self) -> Optional[str]:
        """Executable of the .txt open verb, else %SystemRoot%\\System32\\notepad.exe.

        Like the Linux desktop-entry filter, an association that points at
        another launcher app (Code.exe, Cursor.exe, chrome.exe) is declined.
        """
        associated = self._windows_association_executable(WINDOWS_TEXT_EXTENSION)
        if associated and WINDOWS_APPS_MARKER not in associated.lower() \
                and os.path.isfile(associated) \
                and Path(associated).name.lower() not in self._windows_non_text_editor_names():
            return associated
        system_root = os.environ.get(WINDOWS_SYSTEM_ROOT_ENV) or WINDOWS_DEFAULT_SYSTEM_ROOT
        notepad = Path(system_root) / WINDOWS_SYSTEM_DIR / WINDOWS_NOTEPAD_EXE
        return str(notepad) if notepad.is_file() else None

    @staticmethod
    def _windows_association_executable(extension: str) -> Optional[str]:
        """shlwapi AssocQueryStringW(ASSOCF_NONE, ASSOCSTR_EXECUTABLE, ext, 'open')."""
        size = ctypes.c_ulong(ASSOC_BUFFER_CHARS)
        buffer = ctypes.create_unicode_buffer(ASSOC_BUFFER_CHARS)
        result = ctypes.windll.shlwapi.AssocQueryStringW(
            ASSOCF_NONE, ASSOCSTR_EXECUTABLE, extension,
            WINDOWS_ASSOC_VERB, buffer, ctypes.byref(size))
        if result != ASSOC_S_OK or not buffer.value:
            return None
        return buffer.value


text_editor_finder = TextEditorFinder()
