# -*- coding: utf-8 -*-
"""Static launcher application catalog: Windows/Linux definitions, process names, Chrome paths."""

import sys
from pathlib import Path

# Linux app resolution (Debian/Ubuntu/Kali). The APP_DEFINITIONS below are all
# Windows paths/exe names, so on Linux each app resolves through this ordered
# candidate chain (first executable hit wins):
#   1. Shell central constants: the numbered install scripts under
#      scripts/shells/linux persist resolved paths into the shared gvar store
#      (e.g. 41_install_browsers.sh writes CHROME_BIN / CHROME_INSTALL_DIR);
#      gvar_keys are exact binary paths, gvar_dir_keys are install dirs that
#      are probed with the app's binary names.
#   2. Derived central install dir: <compile_dir>/applications/<app_subdir>
#      (map_web_path - the SAME base the sh installers use), probing the
#      binary names at its root, under bin/, plus any explicit subdir_binary.
#   3. Fixed bin dirs (LINUX_FIXED_BIN_DIRS) x binary names.
#   4. PATH via shutil.which.
LINUX_APP_DEFINITIONS = {
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
        # 155_install_ides.sh: AppRun under the extracted AppImage tree.
        'subdir_binary': 'extracted/squashfs-root/AppRun',
        # The PATH wrapper (155_install_ides.sh) adds --no-sandbox, the
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
    # 195_install_remmina.sh (remmina + RDP/secret plugins).
    'remmina': {'binaries': ['remmina']},
    'devin': {'binaries': ['windsurf', 'devin']},
    'notepad++': {'binaries': []},  # no Linux equivalent
    # The desktop's DEFAULT text editor. TextEditorFinder tries the
    # xdg-mime default first; this list is the fallback order.
    'texteditor': {
        'binaries': ['gnome-text-editor', 'gedit', 'kate', 'mousepad',
                     'pluma', 'xed', 'geany'],
        'binary_priority': True,
    },
    # @openai/codex CLI (pnpm-global shim linked into /usr/local/bin).
    'codex': {'binaries': ['codex']},
}

# Platform availability per app (absent = both platforms). notepad++ is
# launched on Windows only, remmina on Linux only (Windows uses mstsc).
APP_PLATFORMS = {
    'remmina': ('linux',),
    'notepad++': ('windows',),
}

# Linux-only launcher apps: absent from the Windows APP_DEFINITIONS, so the
# config defaults and the toggle menu add them on Linux through
# available_app_names().
LINUX_ONLY_APPS = ('remmina',)

# Apps enabled by default on Linux only (Windows keeps its own defaults).
LINUX_DEFAULT_ENABLED_APPS = ('wechat', 'remmina')

# Prerequisite idempotent installer per Linux app: (script, extra args). The
# launcher runs it once, non-interactively (DD_AUTO_CONTINUE=1), when an
# enabled app does not resolve, then resolves it again.
LINUX_INSTALLER_SCRIPTS_RELATIVE_DIR = Path('scripts') / 'shells' / 'linux' / 'debian' / 'install_shells'
LINUX_PREREQUISITE_INSTALLERS = {
    'chrome': ('41_install_browsers.sh', ('--only', 'chrome')),
    'vscode': ('155_install_ides.sh', ('--only', 'vscode')),
    'cursor': ('155_install_ides.sh', ('--only', 'cursor')),
    'codex': ('99_install_ai_tools.sh', ('--only', 'codex')),
    'wechat': ('167_install_wechat.sh', ()),
    'remmina': ('195_install_remmina.sh', ()),
}

# Apps detected by command line instead of process name/exe path (any
# user, both platforms): codex runs as node + codex.js or as the native
# codex binary. Keyword arguments of launch_guard.is_cmdline_process_running.
CMDLINE_PROCESS_MATCHERS = {
    'codex': {
        'arg_markers': ('@openai/codex',),
        'exe_basenames': ('codex', 'codex.exe', 'codex.cmd'),
        'process_names': ('codex', 'codex.exe'),
    },
}

# Windows apps detected by process NAME: the Win11 Store Notepad runs from
# WindowsApps, never from the resolved System32 path.
WINDOWS_NAME_MATCHED_APPS = frozenset({'texteditor'})

# Launcher apps the default-text-editor filters (both platforms) keep.
TEXT_EDITOR_APPS = frozenset({'texteditor', 'notepad++'})

# Windows codex (ApplicationsList.ps1 OpenAICodex, pnpm global install):
# <LANG_COMPILER_DIR>\node-v<ver>\pnpm-global\.bin\codex.cmd, then NODE_DIR.
WINDOWS_NODE_DIR_GLOB = 'node-v*'
WINDOWS_CODEX_RELATIVE_PATHS = (
    Path('pnpm-global') / '.bin' / 'codex.cmd',
    Path('codex.cmd'),
    Path('codex.exe'),
)
CODEX_COMMAND = 'codex'

# Fixed search dirs tried after the central constants (chain step 3).
LINUX_FIXED_BIN_DIRS = ('/usr/local/bin', '/usr/bin', '/bin', '/snap/bin')

# Wrapper scripts containing any of these tokens self-elevate; launched as a
# non-root desktop user they pop a polkit password dialog (pkexec /
# systemd-run --system -> org.freedesktop.policykit.exec / systemd1.manage-units,
# both auth_admin by default) that stalls the whole launcher flow, so they are
# skipped in favour of the underlying non-elevating binary.
LINUX_ELEVATION_TOKENS = ('pkexec', 'systemd-run --system', 'exec sudo')

# App -> Linux binary names (launch_guard.resolve_process_names).
LINUX_BINARIES = {name: spec['binaries'] for name, spec in LINUX_APP_DEFINITIONS.items()}

# Running-process names (psutil comm, exact match) per app. The launch path
# resolves to wrapper/symlink names (google-chrome, code) that never match the
# real process name (chrome, code's own comm), so already-running detection
# must match on these instead of the resolved exe path.
LINUX_PROCESS_NAMES = {
    'chrome': ['chrome'],
    'chrome_beta': ['chrome'],
    'edge': ['msedge', 'chrome'],
    'vscode': ['code'],
    'antigravity': ['antigravity'],
    'cursor': ['cursor'],
    'wechat': ['wechat', 'weixin'],
    'qq': ['qq'],
    'remmina': ['remmina'],
    'devin': ['windsurf'],
    'notepad++': [],
    # Linux process comm is truncated to 15 chars: gnome-text-editor shows
    # up as 'gnome-text-edit' in psutil/ps.
    'texteditor': ['gnome-text-edit', 'gnome-text-editor', 'gedit', 'kate',
                   'mousepad', 'pluma', 'xed', 'geany'],
    'codex': ['codex'],
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
    # LINUX_APP_DEFINITIONS['cursor']).
    'cursor': {
        'names': ['Cursor.exe', 'cursor.exe'],
        'search_paths': [
            'D:\\applications\\Cursor',
            'C:\\Users\\{username}\\AppData\\Local\\Programs\\cursor',
            'C:\\Program Files\\Cursor'
        ]
    },
    # System default text editor on both platforms; resolved by
    # TextEditorFinder (Windows .txt association / Linux xdg-mime default).
    'texteditor': {
        'names': [],
        'search_paths': []
    },
    # OpenAI Codex CLI; resolved by find_codex on Windows (pnpm global bin)
    # and through LINUX_APP_DEFINITIONS on Linux. Launched in a terminal.
    'codex': {
        'names': ['codex.cmd', 'codex.exe'],
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


def available_app_names():
    """Catalog apps of this platform: APP_DEFINITIONS plus the Linux-only apps on Linux."""
    if sys.platform == 'win32':
        return list(APP_DEFINITIONS)
    return [*APP_DEFINITIONS, *(name for name in LINUX_ONLY_APPS if name not in APP_DEFINITIONS)]
