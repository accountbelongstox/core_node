# -*- coding: utf-8 -*-
"""Chrome resolution: stable/beta/canary versions and the portable copy used by the edge slot."""

import shutil
import sys
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.app_catalog import (
    CHROME_BETA_KEYWORDS,
    CHROME_CANARY_KEYWORDS,
    CHROME_EXE_NAMES,
    CHROME_PORTABLE_APPLICATION_DIR,
    CHROME_PORTABLE_EXE,
    CHROME_SEARCH_PATHS,
    CHROME_STANDARD_PATHS,
)
from pycore.pyutils.launcher.app_search import (
    app_path_cache,
    expand_user_path,
    find_linux_app,
    search_recursive,
)

CHROME_VERSIONS = ('canary', 'beta', 'stable')
LINUX_CHROME_APPS = (('stable', 'chrome'), ('beta', 'chrome_beta'))
EDGE_CACHE_KEY = 'edge_path'


def chrome_cache_key(version: str) -> str:
    return f'chrome_{version}'


class ChromeFinder:
    """Find Chrome executables per release channel and keep app_cache.json current."""

    def preferred_stable_path(self) -> Optional[str]:
        """Preferred stable Chrome on Windows: <APP_INSTALL_DIR>\\Chrome\\Chrome copy."""
        if sys.platform == 'win32' and CHROME_PORTABLE_EXE.is_file():
            return str(CHROME_PORTABLE_EXE.resolve())
        return None

    def find_versions(self, force_refresh: bool = False) -> Dict[str, str]:
        """Find all Chrome versions (version -> path) and cache them."""
        # Linux/macOS: resolve Chrome/Chromium through the same central-constant
        # chain as the other apps (the Windows scan paths below never exist here).
        if sys.platform != 'win32':
            found = {}
            for version, app_key in LINUX_CHROME_APPS:
                resolved = find_linux_app(app_key)
                if resolved:
                    found[version] = resolved
            if found:
                app_path_cache.update({chrome_cache_key(v): p for v, p in found.items()})
            return found

        if not force_refresh:
            cached_versions = {}
            for version in CHROME_VERSIONS:
                cached = app_path_cache.existing(chrome_cache_key(version))
                if cached:
                    cached_versions[version] = cached
            preferred_stable = self.preferred_stable_path()
            if preferred_stable:
                cached_versions['stable'] = preferred_stable
            if cached_versions:
                return cached_versions

        all_versions = self._scan_windows_versions()
        app_path_cache.update({chrome_cache_key(v): p for v, p in all_versions.items()})
        return all_versions

    def _scan_windows_versions(self) -> Dict[str, str]:
        all_versions: Dict[str, str] = {}
        preferred_stable = self.preferred_stable_path()
        if preferred_stable:
            all_versions['stable'] = preferred_stable

        for search_path_str in CHROME_SEARCH_PATHS:
            search_path = Path(expand_user_path(search_path_str))
            if not search_path.exists():
                continue
            try:
                found_items = list(search_path.rglob(CHROME_EXE_NAMES[0]))
            except OSError as exc:
                ColorPrint.yellow(f"[ChromeFinder] scan {search_path} failed: {exc}")
                continue
            for item in found_items:
                if str(item) in all_versions.values():
                    continue
                folder_path_str = str(item.parent)
                folder_lower = folder_path_str.lower()
                # Check version keywords - beta/canary BEFORE stable.
                has_canary = any(kw.lower() in folder_lower for kw in CHROME_CANARY_KEYWORDS)
                has_beta = any(kw.lower() in folder_lower for kw in CHROME_BETA_KEYWORDS)
                if has_canary and 'canary' not in all_versions:
                    all_versions['canary'] = str(item)
                elif has_beta and 'beta' not in all_versions:
                    all_versions['beta'] = str(item)
                elif 'chrome' in folder_lower and 'stable' not in all_versions \
                        and not has_beta and not has_canary:
                    all_versions['stable'] = str(item)

        # Fallback: native install when portable copy is missing.
        if 'stable' not in all_versions:
            for std_path in CHROME_STANDARD_PATHS:
                if Path(std_path).exists():
                    all_versions['stable'] = std_path
                    break
        return all_versions

    def find_by_version(self, version: str) -> Optional[str]:
        """Chrome executable for *version* (canary, stable, beta), else None."""
        if version == 'stable':
            preferred = self.preferred_stable_path()
            if preferred:
                app_path_cache.put(chrome_cache_key('stable'), preferred)
                return preferred

        cached = app_path_cache.existing(chrome_cache_key(version))
        if cached:
            return cached
        return self.find_versions(force_refresh=True).get(version)

    def _find_native_application_dir(self) -> Optional[Path]:
        """Return the native Chrome ``Application`` directory, if installed."""
        for std_path in CHROME_STANDARD_PATHS:
            exe_path = Path(std_path)
            if exe_path.is_file():
                return exe_path.parent

        for search_path_str in CHROME_SEARCH_PATHS:
            search_path = Path(expand_user_path(search_path_str))
            if not search_path.is_dir():
                continue
            for exe_name in CHROME_EXE_NAMES:
                found_path = search_recursive(search_path, exe_name)
                if found_path is not None:
                    return found_path.parent
        return None

    def _copy_native_to_portable(self) -> Optional[str]:
        """Copy native Chrome ``Application`` folder to the portable location."""
        if sys.platform != 'win32':
            return None

        source_dir = self._find_native_application_dir()
        if source_dir is None:
            ColorPrint.yellow('[ChromeFinder] native Chrome installation not found; cannot copy to portable path.')
            return None

        dest_dir = CHROME_PORTABLE_APPLICATION_DIR
        ColorPrint.plain(f'[ChromeFinder] Copying Chrome from {source_dir} to {dest_dir} ...')
        try:
            dest_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True)
        except OSError as exc:
            ColorPrint.red(f'[ChromeFinder] copy {source_dir} -> {dest_dir} failed: {exc}')
            return None

        if not CHROME_PORTABLE_EXE.is_file():
            ColorPrint.yellow(f'[ChromeFinder] portable Chrome copy finished but {CHROME_PORTABLE_EXE} is missing.')
            return None

        ColorPrint.plain(f'[ChromeFinder] Portable Chrome ready: {CHROME_PORTABLE_EXE}')
        return str(CHROME_PORTABLE_EXE.resolve())

    def find_portable(self, force_refresh: bool = False) -> Optional[str]:
        """Resolve Chrome for the edge slot: portable path first, copy native if missing."""
        if not force_refresh:
            cached = app_path_cache.existing(EDGE_CACHE_KEY, require_file=True)
            if cached:
                return cached

        if CHROME_PORTABLE_EXE.is_file():
            found = str(CHROME_PORTABLE_EXE.resolve())
        else:
            found = self._copy_native_to_portable()

        if found:
            app_path_cache.put(EDGE_CACHE_KEY, found)
        return found


chrome_finder = ChromeFinder()
