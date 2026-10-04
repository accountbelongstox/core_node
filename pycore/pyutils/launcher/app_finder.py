# -*- coding: utf-8 -*-
"""Application finder: resolves launcher app executables on Windows and Linux."""

import shutil
import sys
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.system_paths import get_lang_compiler_dir
from pycore.pyutils.launcher.app_catalog import (
    APP_DEFINITIONS,
    APP_PLATFORMS,
    CODEX_COMMAND,
    WINDOWS_CODEX_RELATIVE_PATHS,
    WINDOWS_NODE_DIR_GLOB,
)
from pycore.pyutils.launcher.app_search import (
    app_path_cache,
    expand_user_path,
    find_linux_app,
    search_recursive,
)
from pycore.pyutils.launcher.chrome_finder import chrome_finder
from pycore.pyutils.launcher.text_editor_finder import text_editor_finder

CHROME_APPS = ('chrome', 'chrome_beta')
AIASSISTANT_DOWNLOADS_DIR = 'C:\\Users\\{username}\\Downloads'
AIASSISTANT_GLOB = 'AIAssistant*.exe'


def app_cache_key(app_name: str) -> str:
    return f"{app_name}_path"


class AppFinder:
    """Find application executables (cached in app_cache.json)."""

    def is_supported_on_platform(self, app_name: str) -> bool:
        """True when *app_name* should be launched on the current OS."""
        platforms = APP_PLATFORMS.get(app_name)
        if not platforms:
            return True
        current = 'windows' if sys.platform == 'win32' else 'linux'
        return current in platforms

    def find_app(self, app_name: str, force_refresh: bool = False) -> Optional[str]:
        """Executable path of *app_name*, or None when not installed."""
        # The live system default wins over the cache (see TextEditorFinder.find).
        if app_name == 'texteditor':
            return text_editor_finder.find()

        cache_key = app_cache_key(app_name)
        if not force_refresh:
            cached = app_path_cache.existing(cache_key)
            if cached:
                return cached

        # Linux/macOS: APP_DEFINITIONS hold Windows paths/exe names that never
        # exist here, so resolve the platform binary via the central-constant
        # chain (gvar store -> compile applications dir -> fixed dirs -> PATH).
        if sys.platform != 'win32' and app_name not in CHROME_APPS:
            resolved = find_linux_app(app_name)
            if resolved:
                app_path_cache.put(cache_key, resolved)
            return resolved

        app_def = APP_DEFINITIONS.get(app_name)
        if not app_def:
            return None

        if app_name == 'chrome':
            result = chrome_finder.find_by_version('stable')
            if result:
                app_path_cache.put(cache_key, result)
            return result
        if app_name == 'chrome_beta':
            return chrome_finder.find_by_version('beta')
        if app_name == 'aiassistant':
            return self.find_aiassistant(force_refresh=force_refresh)
        if app_name == 'codex':
            return self.find_codex(force_refresh=force_refresh)
        # Edge slot launches portable Chrome under <APP_INSTALL_DIR>\Chrome.
        if app_name == 'edge':
            return chrome_finder.find_portable(force_refresh=force_refresh)

        for search_path_str in app_def.get('search_paths', []):
            search_path = Path(expand_user_path(search_path_str))
            if not search_path.exists():
                continue
            for exe_name in app_def.get('names', []):
                found_path = search_recursive(search_path, exe_name)
                if found_path:
                    app_path_cache.put(cache_key, str(found_path))
                    return str(found_path)
        return None

    def find_codex(self, force_refresh: bool = False) -> Optional[str]:
        """Codex CLI on Windows: pnpm global bin under the node dir, else PATH."""
        cache_key = app_cache_key('codex')
        if not force_refresh:
            cached = app_path_cache.existing(cache_key, require_file=True)
            if cached:
                return cached

        node_dirs = sorted(get_lang_compiler_dir().glob(WINDOWS_NODE_DIR_GLOB), reverse=True)
        candidates = [node_dir / relative
                      for node_dir in node_dirs
                      for relative in WINDOWS_CODEX_RELATIVE_PATHS]
        found = next((str(candidate) for candidate in candidates if candidate.is_file()), None)
        found = found or shutil.which(CODEX_COMMAND)
        if found:
            app_path_cache.put(cache_key, found)
        return found

    def find_aiassistant(self, force_refresh: bool = False) -> Optional[str]:
        """Find the newest AIAssistant*.exe in the user's Downloads folder."""
        cache_key = app_cache_key('aiassistant')
        if not force_refresh:
            cached = app_path_cache.existing(cache_key)
            if cached:
                return cached

        if sys.platform != 'win32':
            return None

        downloads = Path(expand_user_path(AIASSISTANT_DOWNLOADS_DIR))
        if not downloads.is_dir():
            return None

        matches = sorted(downloads.glob(AIASSISTANT_GLOB), key=lambda p: p.stat().st_mtime, reverse=True)
        if not matches:
            return None

        found = str(matches[0].resolve())
        app_path_cache.put(cache_key, found)
        return found

    def find_all_apps(self, force_refresh: bool = False) -> Dict[str, Optional[str]]:
        """Resolve every catalog app (app_name -> exe path)."""
        chrome_finder.find_versions(force_refresh)
        return {app_name: self.find_app(app_name, force_refresh) for app_name in APP_DEFINITIONS}


app_finder = AppFinder()
