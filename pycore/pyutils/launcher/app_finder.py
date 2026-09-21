# -*- coding: utf-8 -*-
"""
Application Finder
Finds application executables in common installation directories
"""

import os
import sys
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_system_cache_dir, map_web_path


class AppFinder:
    """Find application executables"""

    # Linux app resolution (Debian/Ubuntu/Kali). The APP_DEFINITIONS below are all
    # Windows paths/exe names, so on Linux each app resolves through this ordered
    # candidate chain (first executable hit wins):
    #   1. Shell central constants: the numbered install scripts under
    #      scripts/shells/linux persist resolved paths into the shared gvar store
    #      (e.g. 51_install_chrome.sh writes CHROME_BIN / CHROME_INSTALL_DIR);
    #      gvar_keys are exact binary paths, gvar_dir_keys are install dirs that
    #      are probed with the app's binary names.
    #   2. Derived central install dir: <compile_dir>/applications/<app_subdir>
    #      (map_web_path - the SAME base the sh installers use), probing the
    #      binary names at its root, under bin/, plus any explicit subdir_binary.
    #   3. Fixed bin dirs (_LINUX_FIXED_BIN_DIRS) x binary names.
    #   4. PATH via shutil.which.
    _LINUX_APP_DEFINITIONS = {
        'chrome': {
            'binaries': ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
            'gvar_keys': ['CHROME_BIN'],
            'gvar_dir_keys': ['CHROME_INSTALL_DIR'],
            'app_subdir': 'chrome',
        },
        'chrome_beta': {
            'binaries': ['google-chrome-beta', 'google-chrome-unstable'],
        },
        # Edge slot: the real Edge when its central constant/binary exists, else
        # the Chrome-family fallback (the Windows edge slot launches portable Chrome).
        'edge': {
            'binaries': ['microsoft-edge', 'microsoft-edge-stable', 'microsoft-edge-beta',
                         'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
            'gvar_keys': ['EDGE_BIN'],
        },
        'vscode': {
            'binaries': ['code', 'code-insiders', 'codium'],
            'app_subdir': 'vscode',
        },
        'antigravity': {
            'binaries': ['antigravity'],
            'app_subdir': 'antigravity',
        },
        'cursor': {
            'binaries': ['cursor'],
            'app_subdir': 'cursor',
            # 155_install_cursor.sh: AppRun under the extracted AppImage tree.
            'subdir_binary': 'extracted/squashfs-root/AppRun',
            # The PATH wrapper (155_install_cursor.sh) adds --no-sandbox, the
            # browser bridge and IME env, all REQUIRED for Electron-as-root;
            # the raw AppRun aborts as root. Non-root callers keep the AppRun
            # path (the wrapper self-elevates via pkexec and is filtered out by
            # _linux_binary_usable).
            'root_prefer_wrapper': True,
        },
        'wechat': {
            'binaries': ['wechat', 'weixin'],
            'app_subdir': 'wechat',
        },
        'qq': {'binaries': ['qq', 'linuxqq']},
        'devin': {'binaries': ['windsurf', 'devin']},
        'notepad++': {'binaries': []},  # no Linux equivalent
        # Linux slot for the desktop's DEFAULT text editor (the Windows flow
        # launches notepad++ instead). The xdg-mime default is tried first in
        # _find_linux_app; this list is the fallback order.
        'texteditor': {
            'binaries': ['gnome-text-editor', 'gedit', 'kate', 'mousepad',
                         'pluma', 'xed', 'geany'],
        },
    }

    # Platform availability per app (absent = both platforms). wechat/notepad++
    # are launched on Windows only; texteditor is the Linux-only default-editor
    # slot that replaces notepad++ there.
    _APP_PLATFORMS = {
        'wechat': ('windows',),
        'notepad++': ('windows',),
        'texteditor': ('linux',),
    }

    # Fixed search dirs tried after the central constants (chain step 3).
    _LINUX_FIXED_BIN_DIRS = ('/usr/local/bin', '/usr/bin', '/bin', '/snap/bin')

    # Wrapper scripts containing any of these tokens self-elevate; launched as a
    # non-root desktop user they pop a polkit password dialog (pkexec /
    # systemd-run --system -> org.freedesktop.policykit.exec / systemd1.manage-units,
    # both auth_admin by default) that stalls the whole launcher flow, so they are
    # skipped in favour of the underlying non-elevating binary.
    _LINUX_ELEVATION_TOKENS = ('pkexec', 'systemd-run --system', 'exec sudo')

    # Back-compat view for launch_guard.resolve_process_names: app -> binary names.
    _LINUX_BINARIES = {name: spec['binaries'] for name, spec in _LINUX_APP_DEFINITIONS.items()}

    # Running-process names (psutil comm, exact match) per app. The launch path
    # resolves to wrapper/symlink names (google-chrome, code) that never match the
    # real process name (chrome, code's own comm), so already-running detection
    # must match on these instead of the resolved exe path.
    _LINUX_PROCESS_NAMES = {
        'chrome': ['chrome'],
        'chrome_beta': ['chrome'],
        'edge': ['msedge', 'chrome'],
        'vscode': ['code'],
        'antigravity': ['antigravity'],
        'cursor': ['cursor'],
        'wechat': ['wechat', 'weixin'],
        'qq': ['qq'],
        'devin': ['windsurf'],
        'notepad++': [],
        # Linux process comm is truncated to 15 chars: gnome-text-editor shows
        # up as 'gnome-text-edit' in psutil/ps.
        'texteditor': ['gnome-text-edit', 'gnome-text-editor', 'gedit', 'kate',
                       'mousepad', 'pluma', 'xed', 'geany'],
    }
    
    # Chrome-related constants (shared between chrome and chrome_beta)
    CHROME_EXE_NAMES = ['chrome.exe', 'GoogleChrome.exe']
    CHROME_SEARCH_PATHS = [
        'D:\\applications',
        'C:\\Users\\{username}\\AppData\\Local\\Programs',
        'C:\\Program Files\\Google\\Chrome',
        'C:\\Program Files (x86)\\Google\\Chrome'
    ]
    CHROME_STANDARD_PATHS = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ]
    CHROME_PORTABLE_APPLICATION_DIR = Path(
        r'D:\applications\Chrome\Chrome\Application')
    CHROME_PORTABLE_EXE = CHROME_PORTABLE_APPLICATION_DIR / 'chrome.exe'
    CHROME_BETA_KEYWORDS = ['Beta', 'beta', 'BETA']
    CHROME_CANARY_KEYWORDS = ['Canary', 'canary', 'CANARY']
    CHROME_STABLE_KEYWORDS = ['Stable', 'stable', 'STABLE']
    CHROME_VERSION_KEYWORDS = {
        'canary': CHROME_CANARY_KEYWORDS,
        'stable': CHROME_STABLE_KEYWORDS,
        'beta': CHROME_BETA_KEYWORDS
    }
    
    # Application definitions
    APP_DEFINITIONS = {
        'chrome': {
            'names': CHROME_EXE_NAMES,
            'search_paths': CHROME_SEARCH_PATHS,
            'beta_keywords': CHROME_BETA_KEYWORDS,
            'version_keywords': CHROME_VERSION_KEYWORDS
        },
        'chrome_beta': {
            'names': CHROME_EXE_NAMES,
            'search_paths': CHROME_SEARCH_PATHS,
            'beta_keywords': CHROME_BETA_KEYWORDS,
            'version_keywords': {
                'beta': CHROME_BETA_KEYWORDS
            },
            'version': 'beta'  # Always beta for chrome_beta
        },
        # Antigravity (Google agentic IDE) replaces the former cursor slot.
        # Primary: D:\applications\Antigravity; fallback: recursive search of the
        # C-drive default install directories (per-user Programs then Program Files).
        'antigravity': {
            'names': ['Antigravity.exe', 'antigravity.exe'],
            'search_paths': [
                'D:\\applications\\Antigravity',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\Antigravity',
                'C:\\Program Files\\Antigravity',
                'C:\\Program Files (x86)\\Antigravity'
            ]
        },
        # Devin Desktop is Windsurf rebranded (Cognition); app binary stays Windsurf.exe.
        # Cover both naming/install dirs and keep paths username-parameterized for new systems.
        'devin': {
            'names': ['Windsurf.exe', 'windsurf.exe', 'Devin.exe', 'devin.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\Windsurf',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\Devin'
            ]
        },
        'edge': {
            'names': CHROME_EXE_NAMES,
            'search_paths': [
                r'D:\applications\Chrome\Chrome\Application'
            ]
        },
        'wechat': {
            'names': ['Weixin.exe', 'WeChat.exe', 'wechat.exe'],
            'search_paths': [
                'C:\\Program Files\\Tencent\\Weixin',
                'D:\\applications',
                'C:\\Program Files\\Tencent\\WeChat',
                'C:\\Users\\{username}\\AppData\\Roaming\\Tencent\\WeChat'
            ]
        },
        'qq': {
            'names': ['QQ.exe', 'qq.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Program Files\\Tencent\\QQ',
                'C:\\Users\\{username}\\AppData\\Roaming\\Tencent\\QQ'
            ]
        },
        'notepad++': {
            'names': ['notepad++.exe', 'Notepad++.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Program Files\\Notepad++',
                'C:\\Program Files (x86)\\Notepad++'
            ]
        },
        'vscode': {
            'names': ['code.exe', 'Code.exe'],
            'search_paths': [
                'D:\\applications',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\Microsoft VS Code',
                'C:\\Program Files\\Microsoft VS Code'
            ]
        },
        # Cursor IDE (Windows side; the Linux side resolves via
        # _LINUX_APP_DEFINITIONS['cursor']).
        'cursor': {
            'names': ['Cursor.exe', 'cursor.exe'],
            'search_paths': [
                'D:\\applications\\Cursor',
                'C:\\Users\\{username}\\AppData\\Local\\Programs\\cursor',
                'C:\\Program Files\\Cursor'
            ]
        },
        # Linux-only slot (default text editor); no Windows exe names on purpose.
        'texteditor': {
            'names': [],
            'search_paths': []
        },
        'aiassistant': {
            'names': [],
            'search_paths': [
                'C:\\Users\\{username}\\Downloads'
            ],
            'downloads_glob': 'AIAssistant*.exe'
        }
    }
    
    def __init__(self, cache_path=None):
        """
        Initialize app finder
        
        Args:
            cache_path: Path to cache file
        """
        if cache_path is None:
            # Centralized per-user state dir (D:\programing\Users\<user>\.core_node
            # on Windows, /var/_core_node on Linux) - see system_paths.
            cache_dir = get_system_cache_dir() / 'launch_multiple'
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path = cache_dir / 'app_cache.json'
        
        self.cache_path = Path(cache_path)
        self.cache = self.load_cache()
        self.username = os.getenv('USERNAME') or os.getenv('USER')
    
    def load_cache(self):
        """Load application cache"""
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_cache(self):
        """Save application cache"""
        try:
            with open(self.cache_path, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            ColorPrint.plain(f"Error: Failed to save cache: {e}")
            return False
    
    def expand_path(self, path):
        """Expand path with username"""
        return path.format(username=self.username)

    def _linux_shell_gvar_dir(self) -> Path:
        """Shared shell gvar store (GLOBAL_VAR_DIR in gvar_system_common.sh)."""
        base = os.environ.get('CORE_NODE_DATA_DIR') or '/var/_core_node'
        return Path(base) / 'global_var'

    def _read_shell_gvar(self, key: str) -> Optional[str]:
        """Read one value from the shell gvar store (plain-text file per key)."""
        try:
            value_file = self._linux_shell_gvar_dir() / key
            if value_file.is_file():
                value = value_file.read_text(encoding='utf-8', errors='ignore').strip()
                return value or None
        except OSError:
            pass
        return None

    def _linux_binary_usable(self, path: Path) -> bool:
        """False for self-elevating wrapper scripts when running non-root."""
        if os.geteuid() == 0:
            return True
        try:
            with open(path, 'rb') as fh:
                head = fh.read(8192)
        except OSError:
            return False
        if not head.startswith(b'#!'):
            return True
        text = head.decode('utf-8', errors='ignore')
        return not any(token in text for token in self._LINUX_ELEVATION_TOKENS)

    def _linux_candidates(self, app_name: str) -> List[Path]:
        """Ordered candidate paths for *app_name* (central constants first)."""
        spec = self._LINUX_APP_DEFINITIONS.get(app_name) or {}
        binaries = spec.get('binaries', [])
        candidates = []

        for key in spec.get('gvar_keys', []):
            value = self._read_shell_gvar(key)
            if value:
                candidates.append(Path(value))

        for dir_key in spec.get('gvar_dir_keys', []):
            dir_value = self._read_shell_gvar(dir_key)
            if dir_value:
                for binary in binaries:
                    candidates.append(Path(dir_value) / binary)

        app_subdir = spec.get('app_subdir')
        subdir_candidates = []
        if app_subdir:
            try:
                apps_dir = map_web_path('compile_dir') / 'applications' / app_subdir
            except Exception:
                apps_dir = None
            if apps_dir is not None:
                subdir_binary = spec.get('subdir_binary')
                if subdir_binary:
                    subdir_candidates.append(apps_dir / subdir_binary)
                for binary in binaries:
                    subdir_candidates.append(apps_dir / binary)
                    subdir_candidates.append(apps_dir / 'bin' / binary)

        fixed_candidates = []
        for fixed_dir in self._LINUX_FIXED_BIN_DIRS:
            for binary in binaries:
                fixed_candidates.append(Path(fixed_dir) / binary)

        local_bin = Path.home() / '.local' / 'bin'
        local_candidates = [local_bin / binary for binary in binaries]

        # Apps whose PATH wrapper handles root-specific concerns (Electron
        # --no-sandbox, IME env) must resolve that wrapper first when running
        # as root; the raw install-tree binary would abort as root.
        if spec.get('root_prefer_wrapper') and os.geteuid() == 0:
            candidates.extend(fixed_candidates)
            candidates.extend(local_candidates)
            candidates.extend(subdir_candidates)
        else:
            candidates.extend(subdir_candidates)
            candidates.extend(fixed_candidates)
            candidates.extend(local_candidates)

        return candidates

    def is_supported_on_platform(self, app_name: str) -> bool:
        """True when *app_name* should be launched on the current OS."""
        platforms = self._APP_PLATFORMS.get(app_name)
        if not platforms:
            return True
        current = 'windows' if sys.platform == 'win32' else 'linux'
        return current in platforms

    def _find_linux_default_text_editor(self) -> Optional[str]:
        """Resolve the desktop's DEFAULT text editor via xdg-mime (freedesktop).

        ``xdg-mime query default text/plain`` returns the .desktop id the desktop
        associates with plain text; the Exec line of that desktop file yields
        the binary. Never raises; returns None when undeterminable.
        """
        import subprocess

        try:
            result = subprocess.run(
                ['xdg-mime', 'query', 'default', 'text/plain'],
                capture_output=True, text=True, timeout=3)
            desktop_id = (result.stdout or '').strip()
        except Exception:
            return None
        if not desktop_id.endswith('.desktop'):
            return None

        data_dirs = [
            Path.home() / '.local' / 'share' / 'applications',
            Path('/usr/local/share/applications'),
            Path('/usr/share/applications'),
        ]
        for data_dir in data_dirs:
            desktop_file = data_dir / desktop_id
            try:
                if not desktop_file.is_file():
                    continue
                exec_binary = None
                terminal_entry = False
                for line in desktop_file.read_text(
                        encoding='utf-8', errors='ignore').splitlines():
                    if line.startswith('Exec='):
                        exec_binary = line[len('Exec='):].strip().split()[0]
                    elif line.strip().lower() == 'terminal=true':
                        terminal_entry = True
                # Terminal editors (vim.desktop etc.) are not launchable as a
                # detached GUI window -- decline them so the GUI fallback list
                # is used instead.
                if terminal_entry or not exec_binary:
                    return None
                resolved = shutil.which(os.path.basename(exec_binary))
                if resolved:
                    return resolved
            except (OSError, IndexError):
                continue
        return None

    def _find_linux_app(self, app_name: str) -> Optional[str]:
        """Resolve an app's Linux binary: central constants, fixed dirs, PATH."""
        spec = self._LINUX_APP_DEFINITIONS.get(app_name)
        if not spec:
            return None

        # The texteditor slot prefers the desktop's default editor (xdg-mime).
        if app_name == 'texteditor':
            default_editor = self._find_linux_default_text_editor()
            if default_editor:
                return default_editor

        for candidate in self._linux_candidates(app_name):
            try:
                if candidate.is_file() and os.access(candidate, os.X_OK) \
                        and self._linux_binary_usable(candidate):
                    return str(candidate)
            except OSError:
                continue

        for binary in spec.get('binaries', []):
            resolved = shutil.which(binary)
            if resolved and self._linux_binary_usable(Path(resolved)):
                return resolved

        return None
    
    def find_app(self, app_name: str, force_refresh: bool = False) -> Optional[str]:
        """
        Find application executable
        
        Args:
            app_name: Application name
            force_refresh: Force refresh cache
        
        Returns:
            Path to executable or None
        """
        # Check cache first
        cache_key = f"{app_name}_path"
        if not force_refresh and cache_key in self.cache:
            cached_path = Path(self.cache[cache_key])
            if cached_path.exists():
                return str(cached_path)

        # Linux/macOS: APP_DEFINITIONS hold Windows paths/exe names that never
        # exist here, so resolve the platform binary via the central-constant
        # chain (gvar store -> compile applications dir -> fixed dirs -> PATH).
        # Chrome falls through to find_chrome_by_version() below (also Linux-guarded).
        if sys.platform != 'win32' and app_name not in ('chrome', 'chrome_beta'):
            resolved = self._find_linux_app(app_name)
            if resolved:
                self.cache[cache_key] = resolved
                self.save_cache()
            return resolved

        # Get app definition
        app_def = self.APP_DEFINITIONS.get(app_name)
        if not app_def:
            return None
        
        # Special handling for Chrome (multiple versions)
        if app_name == 'chrome':
            result = self.find_chrome_by_version('stable')
            if result:
                # Cache also under chrome_path for backward compatibility
                self.cache['chrome_path'] = result
                self.save_cache()
            return result
        
        # Special handling for Chrome Beta
        if app_name == 'chrome_beta':
            return self.find_chrome_by_version('beta')

        # AIAssistant: newest AIAssistant*.exe in the user's Downloads folder.
        if app_name == 'aiassistant':
            return self.find_aiassistant(force_refresh=force_refresh)

        # Edge slot launches portable Chrome under D:\applications\Chrome.
        if app_name == 'edge':
            return self.find_portable_chrome(force_refresh=force_refresh)
        
        # Search for application
        search_paths = [self.expand_path(p) for p in app_def.get('search_paths', [])]
        exe_names = app_def.get('names', [])
        
        for search_path_str in search_paths:
            search_path = Path(search_path_str)
            if not search_path.exists():
                continue
            
            # Search recursively
            for exe_name in exe_names:
                found_path = self._search_recursive(search_path, exe_name)
                if found_path:
                    self.cache[cache_key] = str(found_path)
                    self.save_cache()
                    return str(found_path)
        
        return None

    def _is_portable_chrome_exe(self, exe_path: Path) -> bool:
        """True when *exe_path* is the portable copy used by the edge slot."""
        try:
            return exe_path.resolve() == self.CHROME_PORTABLE_EXE.resolve()
        except OSError:
            return str(exe_path).lower() == str(self.CHROME_PORTABLE_EXE).lower()

    def _preferred_chrome_stable_path(self) -> Optional[str]:
        """Preferred stable Chrome on Windows: D:\\applications\\Chrome\\Chrome copy."""
        if sys.platform == 'win32' and self.CHROME_PORTABLE_EXE.is_file():
            return str(self.CHROME_PORTABLE_EXE.resolve())
        return None
    
    def find_chrome_versions(self, force_refresh: bool = False) -> Dict[str, str]:
        """
        Find all Chrome versions and cache them
        
        Args:
            force_refresh: Force refresh cache
            
        Returns:
            Dictionary of version -> path mappings
        """
        all_versions = {}

        # Linux/macOS: resolve Chrome/Chromium through the same central-constant
        # chain as the other apps (the Windows scan paths below never exist here).
        # Cache per version so find_chrome_by_version() reuses it.
        if sys.platform != 'win32':
            found = {}
            for ver, app_key in (('stable', 'chrome'), ('beta', 'chrome_beta')):
                resolved = self._find_linux_app(app_key)
                if resolved:
                    found[ver] = resolved
                    self.cache[f'chrome_{ver}'] = resolved
            if found:
                self.save_cache()
            return found

        # Check cache for version-specific paths
        if not force_refresh:
            cached_versions = {}
            if 'chrome_canary' in self.cache:
                canary_path = Path(self.cache['chrome_canary'])
                if canary_path.exists():
                    cached_versions['canary'] = str(canary_path)
            if 'chrome_beta' in self.cache:
                beta_path = Path(self.cache['chrome_beta'])
                if beta_path.exists():
                    cached_versions['beta'] = str(beta_path)
            if 'chrome_stable' in self.cache:
                stable_path = Path(self.cache['chrome_stable'])
                if stable_path.exists():
                    cached_versions['stable'] = str(stable_path)
            preferred_stable = self._preferred_chrome_stable_path()
            if preferred_stable:
                cached_versions['stable'] = preferred_stable
            
            # If all versions are cached and valid, return them
            if len(cached_versions) >= 1:
                return cached_versions

        preferred_stable = self._preferred_chrome_stable_path()
        if preferred_stable:
            all_versions['stable'] = preferred_stable
            self.cache['chrome_stable'] = preferred_stable
        
        # Search for all Chrome versions
        search_paths = [self.expand_path(p) for p in self.CHROME_SEARCH_PATHS]
        
        found_paths = {}  # Track all found paths to avoid duplicates
        
        for search_path_str in search_paths:
            search_path = Path(search_path_str)
            if not search_path.exists():
                continue
            
            # Search for Chrome executable
            try:
                for item in search_path.rglob(self.CHROME_EXE_NAMES[0]):
                    if str(item) in found_paths.values():
                        continue  # Skip duplicates
                    
                    folder = item.parent
                    folder_path_str = str(folder)
                    folder_lower = folder_path_str.lower()
                    
                    # Check version keywords - must check beta/canary BEFORE stable
                    has_canary = any(kw.lower() in folder_lower or kw in folder_path_str 
                                    for kw in self.CHROME_CANARY_KEYWORDS)
                    has_beta = any(kw.lower() in folder_lower or kw in folder_path_str 
                                  for kw in self.CHROME_BETA_KEYWORDS)
                    
                    if has_canary and 'canary' not in all_versions:
                        all_versions['canary'] = str(item)
                        self.cache['chrome_canary'] = str(item)
                        found_paths['canary'] = str(item)
                    elif has_beta and 'beta' not in all_versions:
                        all_versions['beta'] = str(item)
                        self.cache['chrome_beta'] = str(item)
                        found_paths['beta'] = str(item)
                    elif 'chrome' in folder_lower and 'stable' not in all_versions:
                        # Only mark as stable if it's clearly a Chrome path and not beta/canary
                        if not has_beta and not has_canary:
                            all_versions['stable'] = str(item)
                            self.cache['chrome_stable'] = str(item)
                            found_paths['stable'] = str(item)
            except (PermissionError, OSError):
                continue

        # Fallback: native install when portable copy is missing.
        if 'stable' not in all_versions:
            for std_path in self.CHROME_STANDARD_PATHS:
                if Path(std_path).exists():
                    all_versions['stable'] = std_path
                    self.cache['chrome_stable'] = std_path
                    break
        
        self.save_cache()
        
        return all_versions
    
    def find_chrome_by_version(self, version: str) -> Optional[str]:
        """
        Find Chrome by specific version
        
        Args:
            version: Version string (canary, stable, beta)
        
        Returns:
            Path to Chrome executable or None
        """
        cache_key = f'chrome_{version}'

        if version == 'stable':
            preferred = self._preferred_chrome_stable_path()
            if preferred:
                self.cache['chrome_stable'] = preferred
                self.save_cache()
                return preferred
        
        # Check cache first
        if cache_key in self.cache:
            cached_path = Path(self.cache[cache_key])
            if cached_path.exists():
                return str(cached_path)
        
        # Find all versions and cache them
        all_versions = self.find_chrome_versions(force_refresh=True)
        
        # Return the requested version
        return all_versions.get(version)

    def _find_native_chrome_application_dir(self) -> Optional[Path]:
        """Return the native Chrome ``Application`` directory, if installed."""
        for std_path in self.CHROME_STANDARD_PATHS:
            exe_path = Path(std_path)
            if exe_path.is_file():
                return exe_path.parent

        search_paths = [self.expand_path(p) for p in self.CHROME_SEARCH_PATHS]
        for search_path_str in search_paths:
            search_path = Path(search_path_str)
            if not search_path.is_dir():
                continue
            for exe_name in self.CHROME_EXE_NAMES:
                found_path = self._search_recursive(search_path, exe_name)
                if found_path is not None:
                    return found_path.parent

        return None

    def _copy_native_chrome_to_portable(self) -> Optional[str]:
        """Copy native Chrome ``Application`` folder to the portable location."""
        if sys.platform != 'win32':
            return None

        source_dir = self._find_native_chrome_application_dir()
        if source_dir is None:
            ColorPrint.plain('Warning: native Chrome installation not found; cannot copy to portable path.')
            return None

        dest_dir = self.CHROME_PORTABLE_APPLICATION_DIR
        dest_dir.parent.mkdir(parents=True, exist_ok=True)
        ColorPrint.plain(f'Copying Chrome from {source_dir} to {dest_dir} ...')
        shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True)

        portable_exe = self.CHROME_PORTABLE_EXE
        if not portable_exe.is_file():
            ColorPrint.plain(f'Warning: portable Chrome copy finished but {portable_exe} is missing.')
            return None

        ColorPrint.plain(f'Portable Chrome ready: {portable_exe}')
        return str(portable_exe.resolve())

    def find_portable_chrome(self, force_refresh: bool = False) -> Optional[str]:
        """Resolve Chrome for the edge slot: portable path first, copy native if missing."""
        cache_key = 'edge_path'
        portable_exe = self.CHROME_PORTABLE_EXE

        if not force_refresh and cache_key in self.cache:
            cached_path = Path(self.cache[cache_key])
            if cached_path.is_file():
                return str(cached_path)

        if portable_exe.is_file():
            found = str(portable_exe.resolve())
        else:
            found = self._copy_native_chrome_to_portable()

        if found:
            self.cache[cache_key] = found
            self.save_cache()
        return found

    def find_aiassistant(self, force_refresh: bool = False) -> Optional[str]:
        """Find the newest AIAssistant*.exe in the user's Downloads folder."""
        cache_key = 'aiassistant_path'
        if not force_refresh and cache_key in self.cache:
            cached_path = Path(self.cache[cache_key])
            if cached_path.exists():
                return str(cached_path)

        if sys.platform != 'win32':
            return None

        downloads = Path(self.expand_path('C:\\Users\\{username}\\Downloads'))
        if not downloads.is_dir():
            return None

        matches = sorted(
            downloads.glob('AIAssistant*.exe'),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not matches:
            return None

        found = str(matches[0].resolve())
        self.cache[cache_key] = found
        self.save_cache()
        return found
    
    def _search_recursive(self, search_path: Path, exe_name: str, max_depth: int = 5) -> Optional[Path]:
        """
        Recursively search for executable
        
        Args:
            search_path: Directory to search
            exe_name: Executable name to find
            max_depth: Maximum search depth
        
        Returns:
            Path to executable or None
        """
        if max_depth <= 0:
            return None
        
        try:
            # Check current directory
            exe_path = search_path / exe_name
            if exe_path.exists():
                return exe_path
            
            # Search subdirectories
            for item in search_path.iterdir():
                if item.is_dir():
                    result = self._search_recursive(item, exe_name, max_depth - 1)
                    if result:
                        return result
        except (PermissionError, OSError):
            pass
        
        return None
    
    def find_all_apps(self, force_refresh: bool = False) -> Dict[str, Optional[str]]:
        """
        Find all applications
        
        Args:
            force_refresh: Force refresh cache
        
        Returns:
            Dictionary of app_name -> exe_path
        """
        # First, find all Chrome versions to populate cache
        chrome_versions = self.find_chrome_versions(force_refresh)
        
        results = {}
        for app_name in self.APP_DEFINITIONS.keys():
            results[app_name] = self.find_app(app_name, force_refresh)
        
        return results

