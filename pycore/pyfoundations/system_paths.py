#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
System Paths Module

Defines system-wide cache and data directories for core_node applications.
These paths are used for storing persistent data, cache, and configuration files.

Platform-specific runtime data root (no dot-prefixed names; single source
of truth: pycore.pyfoundations.core_node_dirs):
    Windows: D:\www\core_node
    Linux:   /www/www/core_node  (NTFS dual-boot) or /www/core_node (native)

Directory Structure:
    core_node/
        ├── cache/              # Application cache files
        ├── config/             # Configuration files
        ├── data/               # Persistent data
        ├── logs/               # Log files
        └── ui_state/           # UI state cache (window positions, etc.)
"""

import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple, List, Any, Dict

# Platform / disk / WSL detection helpers live in system_info now (consolidated
# from here to dedupe get_real_user / get_linux_disk_info). The distro-info and
# largest-drive helpers are imported under their former private names so
# internal call sites (_get_dev_compile_base, _get_base_data_directory,
# map_web_path) are unchanged.
from pycore.pyfoundations.system_info import (
    is_wsl,
    get_linux_distro_info as _get_linux_distro_info,
    get_largest_mnt_drive as _get_largest_mounted_drive,
)
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.core_node_dirs import (
    NTFS_FSTYPES as _NTFS_FSTYPES,
    get_core_node_data_dir as _get_core_node_data_dir,
    read_global_var as _read_global_var_center,
    www_data_root_mounted as _www_data_root_mounted,
)
from pycore.pyfoundations.app_config_path import get_app_config_dir as _get_foundation_app_config_dir

# --------------------------------------------------------------------------- #
# Agent-history scan constants (directory scan center, see
# pycore/pyfoundations/agent_home_scanner.py). Single source of truth for every
# path the launcher scripts isolate agent profiles into; the scanner derives its
# users-roots from AGENT_LAUNCHER_SLOT_PROFILES, never from a second list.
# Override/extend via PYCORE_AGENT_HISTORY_USERS_ROOTS (os.pathsep-separated).
# --------------------------------------------------------------------------- #
AGENT_HISTORY_USERS_ROOTS_ENV = 'PYCORE_AGENT_HISTORY_USERS_ROOTS'

# Users-root keys. '<data>' expands to core_node_dirs.get_core_node_data_dir()
# (shells: CORE_NODE_DATA_DIR / GlobalVars.ps1 PROGRAMING_USERS_DIR); '~' is
# the scanning process home.
AGENT_SLOT_ROOT_PROGRAMING = 'programing'
AGENT_SLOT_ROOT_TMP = 'tmp'
AGENT_SLOT_ROOT_KIMI_FALLBACK = 'kimi_fallback'
AGENT_SLOT_ROOT_OPENAI_TMP = 'openai_tmp'
AGENT_SLOT_USERS_ROOTS = {
    AGENT_SLOT_ROOT_PROGRAMING: {
        'win32': ('D:/programing/Users',),
        'linux': ('<data>/Users',),
    },
    AGENT_SLOT_ROOT_TMP: {
        'win32': ('D:/.tmp/Users',),
        'linux': ('/var/_core_node/Users',),
    },
    AGENT_SLOT_ROOT_KIMI_FALLBACK: {
        'win32': (),
        'linux': ('~/.kimi_slots',),
    },
    AGENT_SLOT_ROOT_OPENAI_TMP: {
        'win32': (),
        'linux': ('/tmp/Users',),
    },
}
# OS-level user roots (real accounts), scanned on every host.
AGENT_HISTORY_USERS_ROOTS_WINDOWS = ('C:/Users',)
AGENT_HISTORY_USERS_ROOTS_LINUX = ('/home', '/root')

# Non-human accounts are never scanned as agent users. Linux: an account is
# human when uid == 0 or (uid >= AGENT_HISTORY_HUMAN_UID_MIN, login.defs
# UID_MIN) with a login shell; the name list also covers service accounts
# that own a /home dir (git, gitlab-runner, ...). Windows: built-in profile
# dirs and machine accounts (name ending in '$', e.g. DESKTOP-XXXX$).
AGENT_HISTORY_HUMAN_UID_MIN = 1000
AGENT_HISTORY_NOLOGIN_SHELLS = (
    '/usr/sbin/nologin', '/sbin/nologin', '/bin/false', '/usr/bin/false',
)
AGENT_HISTORY_NON_HUMAN_USERS = (
    'git', 'gitlab-runner', 'gitea', 'nobody', 'www-data', 'postgres',
    'mysql', 'redis', 'frankenphp', 'Debian-gdm', 'gdm', 'sshd', 'syslog',
    'messagebus', 'dnsmasq', 'docker', 'ollama', 'lost+found',
    'Public', 'Default', 'Default User', 'All Users', 'DefaultAppPool',
    'WDAGUtilityAccount', 'defaultuser0',
)
AGENT_HISTORY_NON_HUMAN_SUFFIXES = ('$',)

# Launcher -> isolated profile. (script stem, tool, {platform: root key}, slot)
# slot ending in '*' is a numbered family (MyBest1..N, auto-created by the
# script). Verified against scripts/winenvs/*.ps1 + scripts/linuxenvs/*.sh and
# GlobalVars.ps1 / gvar_system_common.sh on 2026-09-26. Scripts that keep the
# real home (claude1-5, claudeteam, claude<vendor>, codexyolo, kimiyolo,
# agyyolo, ssh*) are covered by the OS-level user roots.
_P = AGENT_SLOT_ROOT_PROGRAMING
_T = AGENT_SLOT_ROOT_TMP
AGENT_LAUNCHER_SLOT_PROFILES = (
    ('kimi1', 'kimi', {'win32': _T, 'linux': _T}, 'Kimi1'),
    ('kimi2', 'kimi', {'win32': _T, 'linux': _T}, 'Kimi2'),
    ('codex1', 'codex', {'win32': _P, 'linux': _T}, 'Codex1'),
    ('codex2', 'codex', {'win32': _T, 'linux': _T}, 'MyBest*'),
    ('claude6', 'claude', {'win32': _T, 'linux': _T}, 'MyBest*'),
    ('claude9', 'claude', {'win32': _T, 'linux': _T}, 'MyBest*'),
    ('ark1-7', 'claude', {'win32': _P, 'linux': _T}, 'ark*'),
    ('openai1', 'codex', {'linux': AGENT_SLOT_ROOT_OPENAI_TMP}, '<timestamp>'),
    ('piyolo/piark*', 'pi', {'win32': _P, 'linux': _P}, 'PiYolo'),
    ('pikimiyolo', 'pi', {'win32': _P, 'linux': _P}, 'PiKimi'),
    ('piclaodecode', 'pi', {'win32': _P, 'linux': _P}, 'PiClaudeCode'),
    ('picodex', 'pi', {'win32': _P, 'linux': _P}, 'PiCodex'),
    ('pivolcagent', 'pi', {'win32': _P, 'linux': _P}, 'PiVolcAgent'),
    ('pivolccoding', 'pi', {'win32': _P, 'linux': _P}, 'PiVolcCoding'),
    ('kimi1/kimi2 fallback', 'kimi', {'linux': AGENT_SLOT_ROOT_KIMI_FALLBACK}, 'Kimi*'),
)
del _P, _T

# Per-tool official home spec + support matrix (one table, no second list).
# Key order is the UI display order (pipeline SUPPORTED_TOOLS derives from it).
# env: official override var; dirs: default dirs relative to home;
# platforms: fully supported hosts; verified: on-disk format version the
# extractor was validated against (2026-09-26); anything newer is parsed
# best-effort with the same layout.
AGENT_HISTORY_PLATFORMS = ('win32', 'linux')
AGENT_HISTORY_OFFICIAL_HOME_MARKERS = {
    'agent': {'env': '', 'dirs': ('.agent',),
              'platforms': AGENT_HISTORY_PLATFORMS,
              'verified': 'generic .agent history'},
    'pi': {'env': '', 'dirs': ('.pi',),
           'platforms': AGENT_HISTORY_PLATFORMS,
           'verified': 'Pi session format version 3'},
    'claude': {'env': 'CLAUDE_CONFIG_DIR', 'dirs': ('.claude',),
               'platforms': AGENT_HISTORY_PLATFORMS,
               'verified': 'Claude Code 2.1.283 projects/*.jsonl + history.jsonl'},
    'codex': {'env': 'CODEX_HOME', 'dirs': ('.codex',),
              'platforms': AGENT_HISTORY_PLATFORMS,
              'verified': 'Codex CLI 0.155.0 rollout-*.jsonl'},
    'cursor': {'env': '', 'dirs': ('.cursor',),
               'platforms': AGENT_HISTORY_PLATFORMS,
               'verified': 'agent-transcripts jsonl + state.vscdb (no official spec)'},
    'gemini': {'env': 'GEMINI_CLI_HOME', 'dirs': ('.gemini',),
               'platforms': AGENT_HISTORY_PLATFORMS,
               'verified': 'Gemini CLI tmp/<hash>/chats + logs.json'},
    'kimi': {'env': 'KIMI_CODE_HOME', 'dirs': ('.kimi-code', '.kimi'),
             'platforms': AGENT_HISTORY_PLATFORMS,
             'verified': 'Kimi Code wire protocol 1.5 (turn.prompt origin.kind)'},
    'antigravity': {'env': '', 'dirs': ('.gemini',),
                    'platforms': AGENT_HISTORY_PLATFORMS,
                    'verified': '.gemini/antigravity/brain artifacts'},
    'cline': {'env': '', 'dirs': ('.vscode',),
              'platforms': AGENT_HISTORY_PLATFORMS,
              'verified': 'VS Code globalStorage tasks/*/api_conversation_history.json'},
}

# Harness-injected text recorded under the user role (not typed by a human).
# Shared by every extractor so AI/system text never becomes a "prompt".
AGENT_HISTORY_INJECTED_PROMPT_PREFIXES = (
    '<system-reminder>',
    '<notification',
    '<task-notification>',
    '<local-command-',
    '<command-name>',
    '<command-message>',
    '<bash-input>',
    '<bash-stdout>',
    '<environment_context>',
    '<user_instructions>',
    '<turn_aborted>',
    '<subagent_notification>',
    '<git-context>',
    '# AGENTS.md instructions for ',
    'Caveat: The messages below were generated by the user while running local commands',
)


def _get_dev_compile_base(secondary_base: 'Path', suffix: str) -> 'Path':
    """Development-tooling base directory (where <base>/_<name>_<ver> with node/py
    etc. is installed). Mirrors gvar_common.sh get_dev_compile_base() and PHP
    App\\Providers\\PathMapper::getDevCompileParts() so all three resolve identically.

    Selection (non-WSL):
      1. STICKY /opt: if /opt/_<suffix> already exists, keep using /opt regardless of
         current root free space (once /opt is chosen, never switch away).
      2. Else prefer /opt when root (/) has MORE THAN DEV_ROOT_MIN_FREE_GB free
         (default 50 GB).
      3. Else the largest secondary disk (secondary_base).
    WSL keeps its secondary-disk design.
    """
    if is_wsl():
        return secondary_base
    if (Path('/opt') / f'_{suffix}').is_dir():
        return Path('/opt')
    try:
        min_gb = int(os.environ.get('DEV_ROOT_MIN_FREE_GB', '50'))
    except (TypeError, ValueError):
        min_gb = 50
    try:
        st = os.statvfs('/')
        if st.f_bavail * st.f_frsize > min_gb * (1024 ** 3):
            return Path('/opt')
    except OSError:
        pass
    return secondary_base


def _fs_is_posix_capable(path: Path) -> bool:
    """True when the filesystem backing *path* supports POSIX ownership/permissions,
    which the web DATA root REQUIRES: PostgreSQL needs a postgres-owned 0700 data dir
    and Laravel must chown/chmod its storage tree. NTFS/exFAT/FUSE/drvfs cannot, so
    they must never host web data -- otherwise Python diverges from gvar_common.sh
    (which forces /www) and the app reads where data was never written.

    Mirrors gvar_common.sh _fs_is_posix_capable(): walk up to the nearest existing
    ancestor, then resolve its fstype via the longest matching mountpoint in
    /proc/mounts (no third-party deps).
    """
    posix_fs = {'ext2', 'ext3', 'ext4', 'xfs', 'btrfs', 'zfs',
                'reiserfs', 'jfs', 'f2fs', 'overlay'}
    p = Path(path)
    while str(p) != p.anchor and not p.exists():
        p = p.parent
    try:
        target = os.path.realpath(str(p))
    except OSError:
        return False
    best_mp = ''
    best_fstype = ''
    try:
        with open('/proc/mounts', 'r', encoding='utf-8', errors='replace') as handle:
            for line in handle:
                parts = line.split()
                if len(parts) < 3:
                    continue
                mount_point, fstype = parts[1], parts[2]
                if (target == mount_point or target.startswith(mount_point.rstrip('/') + '/')) \
                        and len(mount_point) >= len(best_mp):
                    best_mp = mount_point
                    best_fstype = fstype
    except OSError:
        return False
    return best_fstype in posix_fs


def _ensure_dir(path: Path) -> Path:
    r"""Create ``path``; on Linux make it ALL-USERS-WRITABLE (mode 1777, sticky)
    so the shared runtime tree is usable by ANY user.

    The sticky bit (like ``/tmp``) lets every user create files there while
    protecting others' files from deletion. ``chmod`` is a no-op on Windows.
    Best-effort: a failed chmod (e.g. the dir is owned by another user and
    we're not root) is ignored — it was already created 1777 by whoever made
    it first.
    """
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    if sys.platform != 'win32':
        try:
            os.chmod(path, 0o1777)
        except OSError:
            pass
    return path


def get_system_cache_dir() -> Path:
    r"""
    Get the unified runtime data root (delegates to
    pycore.pyfoundations.core_node_dirs.get_core_node_data_dir).

    Returns:
        Path: Runtime data root
            - Windows: D:\www\core_node
            - Linux:   /www/www/core_node  (NTFS dual-boot) or
                       /www/core_node      (native)

    A SINGLE shared directory so every user (and the service, whoever runs
    it) reads/writes the SAME runtime state; created 1777 (sticky +
    world-writable). Falls back per core_node_dirs (legacy /var/_core_node,
    then per-user ~/core_node) only when the shared dir is not writable.
    """
    return _get_core_node_data_dir()


def get_ui_state_cache_dir() -> Path:
    r"""
    Get UI state cache directory

    Used for storing window positions, sizes, and other UI state.

    Returns:
        Path: UI state cache directory (core_node/ui_state/)
    """
    return _ensure_dir(get_system_cache_dir() / 'ui_state')


def get_app_cache_dir() -> Path:
    r"""
    Get application cache directory

    Returns:
        Path: Application cache directory (core_node/cache/)
    """
    return _ensure_dir(get_system_cache_dir() / 'cache')


def get_build_tool_cache_dir(tool_name: str) -> Path:
    """Get a namespaced cache directory for repository build helper tools."""
    normalized_name = ''.join(
        character for character in tool_name.strip().lower()
        if character.isalnum() or character in ('-', '_')
    )
    if not normalized_name:
        raise ValueError('Tool name must not be empty')
    return _ensure_dir(get_app_cache_dir() / 'build_tools' / normalized_name)


def get_app_config_dir() -> Path:
    r"""
    Get application configuration directory

    Returns:
        Path: Application config directory (core_node/config/)
    """
    return _get_foundation_app_config_dir()


def get_app_data_dir() -> Path:
    r"""
    Get application persistent data directory

    Returns:
        Path: Application data directory (core_node/data/)
    """
    return _ensure_dir(get_system_cache_dir() / 'data')


def get_app_logs_dir() -> Path:
    r"""
    Get application logs directory

    Returns:
        Path: Application logs directory (core_node/logs/)
    """
    return _ensure_dir(get_system_cache_dir() / 'logs')


def get_shared_download_cache_dir() -> Path:
    r"""Shared download cache root (HF / pip / whisper / torch / TTS models).

    Windows: D:\www\cache  (replaces %USERPROFILE%\.cache)
    Linux dual-boot (/www = NTFS disk root): /www/www/cache -- the SAME tree
        (D:\www\cache, ONE EXTRA LEVEL), so both OSes share one copy of every
        model; weights are device-agnostic and serve GPU and CPU runs alike.
    Linux-only: /var/_core_node/cache  (CORE_NODE_CACHE_DIR)

    Respects CORE_NODE_CACHE_DIR when already exported.
    """
    env_val = os.environ.get('CORE_NODE_CACHE_DIR')
    if env_val:
        return _ensure_dir(Path(env_val))
    if sys.platform == 'win32':
        return _ensure_dir(map_web_path('cache'))
    cross_os = _linux_cross_os_cache_dir()
    if cross_os is not None:
        return cross_os
    shared = Path('/var/_core_node/cache')
    try:
        _ensure_dir(shared)
    except OSError:
        pass
    if shared.is_dir() and os.access(shared, os.W_OK):
        return shared
    return _ensure_dir(Path.home() / 'core_node' / 'cache')


def get_edge_tts_voice_cache_dir(lang: str = "en") -> Path:
    r"""Edge-tts explicit-test scratch/cache dir:
    ``<shared_cache>/voice_static/voice_words_static/edge-tts/<lang>``.

    Used only by compatibility and explicit TTS test surfaces. Queue Center
    word audio uses Kokoro batches. Scratch files land on the shared
    ``D:\www\cache`` volume, NEVER the C:
    ``%TEMP%`` dir. ``lang`` is lower-cased and defaults to ``en``."""
    lang_code = (lang or "en").strip().lower() or "en"
    return _ensure_dir(
        get_shared_download_cache_dir() / 'voice_static' / 'voice_words_static' / 'edge-tts' / lang_code
    )


def get_xdg_cache_home() -> Path:
    r"""User-level XDG cache root (~/.cache on Linux, D:\www\cache on Windows).

    Subpaths are preserved when migrating from the per-user home cache, e.g.
    ``~/.cache/huggingface`` -> ``D:\www\cache\huggingface`` on Windows.
    """
    env_val = os.environ.get('XDG_CACHE_HOME')
    if env_val:
        return _ensure_dir(Path(env_val))
    if sys.platform == 'win32':
        return get_shared_download_cache_dir()
    core_cache = os.environ.get('CORE_NODE_CACHE_DIR')
    if core_cache:
        return _ensure_dir(Path(core_cache) / 'xdg')
    return _ensure_dir(Path.home() / '.cache')


def get_hf_home_dir() -> Path:
    """HuggingFace home (HF_HOME): shared cache / huggingface."""
    env_val = os.environ.get('HF_HOME')
    if env_val:
        return _ensure_dir(Path(env_val))
    return _ensure_dir(get_shared_download_cache_dir() / 'huggingface')


def get_hf_hub_cache_dir() -> Path:
    """HuggingFace Hub blob cache (HF_HUB_CACHE / HUGGINGFACE_HUB_CACHE)."""
    for key in ('HF_HUB_CACHE', 'HUGGINGFACE_HUB_CACHE'):
        env_val = os.environ.get(key)
        if env_val:
            return _ensure_dir(Path(env_val))
    return _ensure_dir(get_hf_home_dir() / 'hub')


def apply_shared_cache_env() -> None:
    r"""Wire shared download-cache env vars idempotently.

    Mirrors scripts/shells/*/common/shared_cache_env.*: respects caller overrides,
    maps paths via :func:`get_shared_download_cache_dir` / :func:`get_xdg_cache_home`,
    and does NOT set deprecated ``TRANSFORMERS_CACHE``. When that legacy var duplicates
    the canonical hub path, it is removed so transformers uses ``HF_HOME`` instead.
    """
    shared = get_shared_download_cache_dir()
    hf_home = shared / 'huggingface'
    hf_hub = hf_home / 'hub'
    # Cross-OS shared tree (Windows, or a Linux dual-boot whose /www is the NTFS
    # disk root): XDG_CACHE_HOME is the cache ROOT itself (mirrors
    # SharedCacheEnv.ps1 / shared_cache_env.sh) so whisper finds the SAME
    # <cache>/whisper/*.pt files; and per official HF guidance a hub cache
    # shared across operating systems stores plain files instead of snapshot
    # symlinks (HF_HUB_DISABLE_SYMLINKS=1 -- symlinks created on one OS are not
    # always traversable on the other).
    cross_os_shared = sys.platform == 'win32' or _linux_cross_os_cache_dir() is not None
    xdg_home = get_xdg_cache_home() if os.environ.get('XDG_CACHE_HOME') else (
        shared if cross_os_shared else shared / 'xdg'
    )

    defaults = (
        ('CORE_NODE_CACHE_DIR', str(shared)),
        ('HF_HOME', str(hf_home)),
        ('HF_HUB_CACHE', str(hf_hub)),
        ('HUGGINGFACE_HUB_CACHE', str(hf_hub)),
        ('TORCH_HOME', str(shared / 'torch')),
        ('PIP_CACHE_DIR', str(shared / 'pip')),
        ('WHISPER_CACHE_DIR', str(shared / 'whisper')),
        ('XDG_CACHE_HOME', str(xdg_home)),
    )
    if cross_os_shared:
        defaults += (('HF_HUB_DISABLE_SYMLINKS', '1'),)
    for key, value in defaults:
        if not os.environ.get(key):
            os.environ[key] = value

    legacy = os.environ.get('TRANSFORMERS_CACHE')
    if legacy:
        try:
            if Path(legacy).resolve() == hf_hub.resolve():
                os.environ.pop('TRANSFORMERS_CACHE', None)
        except OSError:
            pass


def get_local_data_dir() -> Path:
    r"""
    Get the local data directory for pycore (models/staging/state).

    Lives under the shared download cache (Windows: D:\www\cache\pycore,
    Linux: /var/_core_node/cache/pycore) - NOT the repo's .data folder.
    Callers that historically appended a "pycore" segment must drop it.

    Returns:
        Path: Local data directory (<cache>/pycore/)
    """
    return _ensure_dir(get_shared_download_cache_dir() / 'pycore')


def get_app_temp_dir() -> Path:
    r"""
    Get application temporary data directory

    Canonical scratch space for transient processor output (extracted audio,
    rendered video, captured screenshots, parsed files, etc.).

    Returns:
        Path: Application temp directory (<TMP_DIR>/pycore/)
    """
    return _ensure_dir(TMP_DIR / 'pycore')


def get_core_node_root() -> Path:
    """
    Get core_node root directory by locating from this file's position

    This file is at: pycore/pyfoundations/system_paths.py
    core_node root is 3 levels up

    Returns:
        Path: core_node root directory
    """
    return Path(__file__).resolve().parent.parent.parent


# Alias of get_core_node_root. The modularization smoke test imports
# `get_repo_root`; kept as a thin alias so the ~20 existing get_core_node_root
# callers are untouched while both names resolve to the same root.
get_repo_root = get_core_node_root


def get_lang_compiler_dir() -> Path:
    r"""Language/runtime install base (where pythonNNN, node-vX, etc. live).

    Mirrors GlobalVars.ps1 ``$Global:LANG_COMPILER_DIR = "D:\.dev_<sys>"`` (e.g.
    ``D:\.dev_win10``). Derived from the RUNNING interpreter (``sys.executable`` is
    authoritative), so it stays correct across win10/win11 and any relocation
    without hardcoding the suffix:
        ``D:\.dev_win10\python313\python.exe`` -> ``D:\.dev_win10``
    """
    return Path(sys.executable).resolve().parent.parent


# --------------------------------------------------------------------------- #
# Base-data-directory resolution, aligned with gvar_common.sh::get_base_data_directory
# and PHP PathMapper::getBaseDataDirectory. Primary source of truth: the base that
# the shell installer DETECTED and PERSISTED to /var/_core_node/global_var/BASE_DATA_DIR.
# If the shell has not provided a (valid) path, fall back to a full blkid/blockdev/
# findmnt disk detection re-implemented here so all three languages still converge.
# --------------------------------------------------------------------------- #
# Var-center keys persisted by 3_setting_base.sh (cross-language source of
# truth for the detected data base and the D:\www-equivalent web base). Reads
# go through core_node_dirs.read_global_var, which searches the canonical
# var center (<core_node_data_dir>/global_var) first and the legacy
# /var/_core_node/global_var second, so pre-migration installs keep working.
_BASE_DATA_DIR_KEY = 'BASE_DATA_DIR'
_WWW_PATH_KEY = 'WWW_PATH'


def _read_persisted_var(key: str) -> str:
    """First line of a var-center key ('' when absent/unreadable)."""
    return _read_global_var_center(key) or ''


def _www_ntfs_root_mounted() -> bool:
    r"""True when /www is the ROOT of a mounted NTFS dual-boot disk (the
    Windows D:\ root on a dual-boot machine, bound there by 3_setting_base.sh).
    Then the SAME logical tree gains ONE EXTRA LEVEL on Linux:
        Windows D:\www  ==  Linux /www/www      (NOT /www)
        Windows D:\www\cache  ==  Linux /www/www/cache
    On a Linux-only machine /www is a plain native dir (same device as /) or a
    native ext4/xfs data-disk mount and there is NO extra level -- the extra
    level exists ONLY for the NTFS share, so the detection requires an
    NTFS-family fstype at /www (a distinct non-NTFS /www device never counts).
    The detection itself lives ONCE in core_node_dirs.www_data_root_mounted
    (single pycore definition; mirrors runtime_environment.sh
    CORE_NODE_WWW_BASE and PathMapper.php::wwwNtfsRootMounted).
    """
    return _www_data_root_mounted()


def _linux_cross_os_cache_dir() -> Optional[Path]:
    r"""Cross-OS shared model cache when /www is the mounted NTFS/data disk
    root: Windows D:\www\cache == Linux /www/www/cache. Windows downloads every
    model into D:\www\cache (SharedCacheEnv.ps1), so reusing the same tree
    means each model downloads ONCE for both OSes. Model weights are
    device-agnostic -- the same tree serves GPU (CUDA) and CPU runs on
    unchanged hardware; framework wheels differ but live in venvs, never here.
    Returns None on Linux-only machines (caller uses the native cache)."""
    www_path_var = _read_persisted_var(_WWW_PATH_KEY)
    candidate: Optional[Path] = None
    if www_path_var and www_path_var != '/www' and Path(www_path_var).is_dir():
        candidate = Path(www_path_var) / 'cache'
    elif _www_ntfs_root_mounted():
        candidate = Path('/www/www/cache')
    if candidate is None:
        return None
    try:
        _ensure_dir(candidate)
    except OSError:
        pass
    if candidate.is_dir() and os.access(candidate, os.W_OK):
        return candidate
    return None


def _run_cmd(args: List[str]) -> str:
    """Run a command; return stripped stdout, or '' on any failure (never raises)."""
    try:
        res = subprocess.run(args, capture_output=True, text=True, timeout=8)
        return (res.stdout or '').strip()
    except Exception:
        return ''


def _iter_ntfs_mount_points() -> List[str]:
    """Mount points of every mounted NTFS volume (fstypes in
    core_node_dirs.NTFS_FSTYPES: ntfs3 kernel driver or ntfs-3g FUSE, which
    reports fuseblk). Bind-mounts of an NTFS root (e.g. 3_setting_base.sh
    binding the Windows D:\\ root at /www) appear here with the source
    filesystem type, so they are covered too."""
    points: List[str] = []
    try:
        with open('/proc/mounts', 'r', encoding='utf-8', errors='replace') as handle:
            for line in handle:
                parts = line.split()
                if len(parts) >= 3 and parts[2] in _NTFS_FSTYPES:
                    points.append(parts[1].replace('\\040', ' '))
    except OSError:
        pass
    return points


def get_shared_windows_users_roots() -> List[Path]:
    r"""Windows user-profile roots reachable from Linux (user-data sharing).

    When the current system has an NTFS mount (dual-boot data disk, or the
    3_setting_base.sh bind-mount of the Windows D:\ root at /www), the Windows
    per-slot agent profile roots become readable on Linux:
        D:\programing\Users  ->  <mount>/programing/Users
        D:\.tmp\Users        ->  <mount>/.tmp/Users
    Under WSL the same roots live behind /mnt/<drive> (drvfs), plus the real
    Windows users dir <drive>:\\Users. Returns only roots that exist; empty on
    Linux-only machines and on Windows itself (native roots apply there).
    """
    if sys.platform == 'win32':
        return []
    candidates: List[Path] = []
    if is_wsl():
        try:
            mnt = Path('/mnt')
            mount_points = [str(p) for p in mnt.iterdir() if p.is_dir()]
        except OSError:
            mount_points = []
        for mp in mount_points:
            base = Path(mp)
            candidates.extend((
                base / 'programing' / 'Users',
                base / '.tmp' / 'Users',
                base / 'Users',
            ))
        return [p for p in candidates if p.is_dir()]
    for mp in _iter_ntfs_mount_points():
        base = Path(mp)
        candidates.extend((base / 'programing' / 'Users', base / '.tmp' / 'Users'))
    out: List[Path] = []
    seen: set = set()
    for p in candidates:
        try:
            if not p.is_dir():
                continue
            real = str(p.resolve())
        except OSError:
            continue
        if real in seen:
            continue
        seen.add(real)
        out.append(p)
    return out


def _is_real_distinct_mount(p: Path) -> bool:
    """True when p is a real mountpoint on a device different from root's device."""
    try:
        if not p.is_dir():
            return False
    except Exception:
        return False
    src = _run_cmd(['findmnt', '-n', '-o', 'SOURCE', '--target', str(p)])
    root_src = _run_cmd(['findmnt', '-n', '-o', 'SOURCE', '--target', '/'])
    return bool(src) and src != root_src


def _path_hosts_project(base: Path) -> bool:
    """True when base/programing/core_node is a real checkout (.git or package.json)."""
    proj = base / 'programing' / 'core_node'
    try:
        return proj.is_dir() and ((proj / '.git').exists() or (proj / 'package.json').is_file())
    except Exception:
        return False


def _read_persisted_base() -> Optional[Path]:
    """The base the shell installer detected + persisted (cross-language source of truth)."""
    val = _read_persisted_var(_BASE_DATA_DIR_KEY)
    if not val:
        return None
    p = Path(val)
    # Mirrors gvar_storage_common.sh Priority 2: re-validate the persisted base
    # against the CURRENT free-space policy on every run, so a stale cache left by
    # an older script version cannot override it. Real work (a hosted project) and
    # the sanctioned logical roots are kept; a real disk mount is kept only while
    # its free space STRICTLY beats the root filesystem, else the root fs wins.
    if _path_hosts_project(p):
        return p
    if val in ('/www', '/mnt/d'):
        return p
    if _is_real_distinct_mount(p):
        if _avail_bytes(str(p)) > _avail_bytes('/'):
            return p
        return Path('/www')
    return None


def _resolve_device_mount_path(device: str) -> str:
    """Live mount TARGET of a device; '' when not mounted or not writable (non-root)."""
    lines = _run_cmd(['findmnt', '-n', '-o', 'TARGET', '--source', device]).splitlines()
    tgt = lines[0] if lines else ''
    if tgt and (os.access(tgt, os.W_OK) or (hasattr(os, 'geteuid') and os.geteuid() == 0)):
        return tgt
    return ''


def _largest_device_of_type(want_ntfs: bool) -> Tuple[int, str]:
    """Mirror sh get_largest_{ntfs,data}_with_size: rank blkid devices by raw bytes."""
    best_size, best_dev = 0, ''
    blk = _run_cmd(['blkid'])
    if not blk:
        return best_size, best_dev
    data_types = ('ext2', 'ext3', 'ext4', 'xfs', 'btrfs')
    for line in blk.splitlines():
        dev = line.split(':', 1)[0]
        low = line.lower()
        if want_ntfs:
            if 'type="ntfs"' not in low:
                continue
        else:
            if not any(f'type="{t}"' in low for t in data_types):
                continue
            tgt = _run_cmd(['findmnt', '-n', '-o', 'TARGET', '--source', dev])
            if tgt in ('/', '/boot', '/boot/efi'):
                continue
        try:
            size_i = int(_run_cmd(['blockdev', '--getsize64', dev]) or '0')
        except Exception:
            size_i = 0
        if size_i > best_size:
            best_size, best_dev = size_i, dev
    return best_size, best_dev


def _avail_bytes(path: str) -> int:
    """Free bytes available at *path*; 0 when it cannot be measured."""
    try:
        st = os.statvfs(path)
        return st.f_bavail * st.f_frsize
    except OSError:
        return 0


def _detect_largest_disk_base() -> Optional[Path]:
    """Free-space-aware disk detection (used only when sh provided no base).

    Mirrors gvar_common.sh Priority 3: candidates are the largest NTFS and largest
    POSIX data devices, each resolved to its current mount; the root filesystem
    wins (as /www) when '/' has at least as much AVAILABLE space as the best
    candidate -- ties included. Only a disk with strictly more free space is used.
    Unmeasurable paths count as 0.
    """
    _n_size, n_dev = _largest_device_of_type(True)
    _d_size, d_dev = _largest_device_of_type(False)
    best_path = ''
    best_free = 0
    for dev in (n_dev, d_dev):
        if not dev:
            continue
        path = _resolve_device_mount_path(dev)
        if not path:
            continue
        free = _avail_bytes(path)
        if free > best_free:
            best_free, best_path = free, path
    if not best_path:
        return None
    if _avail_bytes('/') >= best_free:
        return Path('/www')
    return Path(best_path)


def _get_base_data_directory() -> Path:
    """CODE/data base, mirroring gvar_common.sh::get_base_data_directory.

    Priority: WSL -> run-anchor adopt (disk the checkout lives on) -> persisted base
    (the shell source of truth) -> full disk detection here -> largest mounted drive -> '/'.
    """
    if is_wsl():
        return Path('/mnt/d')
    # The disk where THIS checkout physically lives wins (matches sh P1.5).
    run_base = get_core_node_root().parent.parent  # <base>/programing/core_node -> <base>
    if _path_hosts_project(run_base):
        return run_base
    persisted = _read_persisted_base()
    if persisted is not None:
        return persisted
    detected = _detect_largest_disk_base()
    if detected is not None:
        return detected
    largest = _get_largest_mounted_drive()
    if largest is not None:
        return largest
    return Path('/')


def map_web_path(path_key: str, sub_path: Optional[str] = None) -> Path:
    """
    Map web path based on environment

    SYNC WARNING: This function MUST be kept in sync with:
    - Shell version: scripts/shells/linux/common/gvar_common.sh::map_web_path()
    - PHP version: poly_apps/laravel_main/app/Providers/PathMapper.php::mapWebPath()
    - All mappings must produce identical results across Python, Shell and PHP.
    - The web DATA base is coerced to /www on a non-POSIX fs (_fs_is_posix_capable);
      the CODE base (core_node) may stay on an NTFS/large data disk.

    Windows mappings:
    - applications -> d:\\applications
    - programing -> d:\\programing
    - www -> d:\\www
    - wwwroot -> d:\\www\\wwwroot
    - pycore_db -> d:\\www\\wwwroot\\pycore_db
    - laravel_db -> d:\\www\\wwwroot\\laravel_db
    - compile_dir -> d:\\_win11 or d:\\_win10

    Linux mappings (context-aware):
    - WSL: Uses /mnt/d (or largest mounted drive)
    - Desktop: Uses largest /mnt/* drive if available, else /www
    - Server: Uses /www
    - pycore_db -> /www/wwwroot/pycore_db
    - laravel_db -> /www/wwwroot/laravel_db
    - compile_dir -> /mnt/d/_ubuntu24 (or _{distro}{version})

    Args:
        path_key: Path key (e.g., 'wwwroot', 'pycore_db', 'laravel_db')
        sub_path: Optional sub-path to append

    Returns:
        Path: Mapped path
    """
    is_windows = platform.system() == 'Windows'

    if is_windows:
        # Windows mappings
        base_d = Path('D:/')

        # Detect Windows version
        win_version = platform.release()
        if '10' in win_version:
            win_suffix = 'win10'
        elif '11' in win_version:
            win_suffix = 'win11'
        else:
            win_suffix = f'win{win_version}'

        mappings = {
            'applications': base_d / 'applications',
            'programing': base_d / 'programing',
            'core_node': get_core_node_root(),
            'www': base_d / 'www',
            'wwwroot': base_d / 'www' / 'wwwroot',
            'pycore_db': base_d / 'www' / 'wwwroot' / 'pycore_db',
            'laravel_db': base_d / 'www' / 'wwwroot' / 'laravel_db',
            # PostgreSQL data root on the shared D: data disk (native Windows PG).
            # Mirrors gvar_common.sh + PathMapper.php "postgresql".
            'postgresql': base_d / 'www' / 'wwwroot' / 'postgresql',
            'compile_dir': base_d / f'_{win_suffix}',
            # Native ext4 loop-mount target for the PostgreSQL D-drive image (a
            # WSL-only concept; kept here for parity. Not used on Windows).
            'pg_mount': Path('/var/lib/postgresql/d'),
            # Unified App Manager log namespace (a Linux-server concept; fixed
            # paths kept here for parity, mirroring gvar_common.sh).
            'app_manager_logs': Path('/opt/_core_node/logs'),
            'app_manager_logs_old': Path('/opt/core_node_unified_manager/logs'),
            # Shared download cache (HF / pip / whisper / torch). Mirrors gvar_common.sh "cache".
            'cache': base_d / 'www' / 'cache',
        }
    else:
        # Linux mappings (context-aware). The web/data base is the base the shell
        # installer detected + persisted (source of truth), else a full disk detection
        # re-implemented here. The chosen disk is honored AS-IS -- NO POSIX coercion:
        # a Windows NTFS DATA disk is shared with Windows (/mnt/<ntfs>/www == D:\\www),
        # mounted uid=/gid= so the login user owns it. PostgreSQL stays on native ext4
        # (pg_mount -> /var/lib/postgresql/d), not under www, so it is unaffected.
        base_path = _get_base_data_directory()

        # Distro suffix for the SEPARATE compile/dev base (unchanged).
        distro_name, distro_version = _get_linux_distro_info()
        distro_suffix = f'{distro_name}_{distro_version}' if distro_version else distro_name
        dev_base = _get_dev_compile_base(base_path, distro_suffix)

        # Cross-platform WWW alignment (mirrors gvar_common.sh::map_web_path):
        # Windows uses D:\www, so the SAME logical tree on Linux is /www/www
        # when /www is the mounted NTFS dual-boot disk root -- 3_setting_base.sh
        # bind-mounts that disk root onto /www, so /www/www IS the disk's www
        # dir == D:\www (e.g. cache is D:\www\cache on Windows, /www/www/cache
        # on Linux; ONE EXTRA LEVEL because /www == D:\ root). The extra level
        # exists ONLY for the NTFS share: _www_ntfs_root_mounted() requires an
        # NTFS-family fstype, so a Linux-only machine -- /www a plain native
        # dir OR a native ext4/xfs data-disk mount -- uses /www directly.
        # Priority: the persisted WWW_PATH central variable (single source of
        # truth) -> live NTFS-root-mount detection -> legacy base_path rule.
        # PostgreSQL is unaffected (pg_mount stays on native ext4).
        if is_wsl():
            www_base = base_path / 'www'
        else:
            www_path_var = _read_persisted_var(_WWW_PATH_KEY)
            if www_path_var and Path(www_path_var).is_dir():
                www_base = Path(www_path_var)
            elif _www_ntfs_root_mounted():
                www_base = Path('/www/www')
            elif str(base_path) in ('/', '/www'):
                www_base = Path('/www')
            else:
                www_base = base_path / 'www'

        mappings = {
            'applications': www_base / 'applications',
            'programing': www_base / 'programing',
            'core_node': get_core_node_root(),
            'www': www_base,
            'wwwroot': www_base / 'wwwroot',
            'pycore_db': www_base / 'wwwroot' / 'pycore_db',
            'laravel_db': www_base / 'wwwroot' / 'laravel_db',
            # PostgreSQL data root on the shared web/data disk (native Linux
            # server). On WSL the cluster uses the ext4 image at pg_mount instead.
            'postgresql': www_base / 'wwwroot' / 'postgresql',
            'compile_dir': dev_base / f'_{distro_suffix}',
            # Native ext4 loop-mount target for the PostgreSQL D-drive image (WSL
            # persistence). MUST stay on the native Linux fs (NOT drvfs): pg needs a
            # postgres-owned, mode-0700 data dir that drvfs cannot provide. The
            # data/image itself lives under 'laravel_db'.
            'pg_mount': Path('/var/lib/postgresql/d'),
            # Unified App Manager log namespace ROOT (scripts/app_manager/linux_sh).
            # Kept on the native Linux fs like pg_mount. Retired predecessor:
            # 'app_manager_logs_old'. MUST stay in sync with gvar_common.sh.
            'app_manager_logs': Path('/opt/_core_node/logs'),
            'app_manager_logs_old': Path('/opt/core_node_unified_manager/logs'),
            'cache': www_base / 'cache',
        }

    # Get mapped path
    mapped_path = mappings.get(path_key, Path(path_key))

    # Append sub_path if provided
    if sub_path:
        sub_path = sub_path.lstrip('/').lstrip('\\')
        mapped_path = mapped_path / sub_path

    # Create directory if it doesn't exist (only for web-related paths)
    if path_key in ['wwwroot', 'www', 'applications', 'pycore_db', 'laravel_db']:
        mapped_path.mkdir(parents=True, exist_ok=True)

    return mapped_path


# Constants - Auto-initialized paths
# NOTE: must be initialized AFTER map_web_path() is defined below -- on Windows
# get_local_data_dir() -> get_shared_download_cache_dir() -> map_web_path('cache'),
# so an earlier placement raises NameError at import time.
SYSTEM_CACHE_DIR = get_system_cache_dir()
UI_STATE_CACHE_DIR = get_ui_state_cache_dir()
APP_CACHE_DIR = get_app_cache_dir()
APP_CONFIG_DIR = get_app_config_dir()
APP_DATA_DIR = get_app_data_dir()
APP_LOGS_DIR = get_app_logs_dir()
CORE_NODE_ROOT = get_core_node_root()
LOCAL_DATA_DIR = get_local_data_dir()
APP_TEMP_DIR = get_app_temp_dir()
AI_SHARED_STATE_DIR = LOCAL_DATA_DIR / ".ai_state"
AI_OLD_SHARED_DIR = CORE_NODE_ROOT / ".ai_state"
AI_LEGACY_DIR = APP_DATA_DIR / "ai_state"


__all__ = [
    'get_xdg_cache_home',
    'get_shared_download_cache_dir',
    'get_shared_windows_users_roots',
    'get_system_cache_dir',
    'get_ui_state_cache_dir',
    'get_app_cache_dir',
    'get_app_config_dir',
    'get_app_data_dir',
    'get_app_logs_dir',
    'get_local_data_dir',
    'get_app_temp_dir',
    'get_core_node_root',
    'get_repo_root',
    'get_lang_compiler_dir',
    'map_web_path',
    'SYSTEM_CACHE_DIR',
    'UI_STATE_CACHE_DIR',
    'APP_CACHE_DIR',
    'APP_CONFIG_DIR',
    'APP_DATA_DIR',
    'APP_LOGS_DIR',
    'CORE_NODE_ROOT',
    'LOCAL_DATA_DIR',
    'APP_TEMP_DIR',
    'AI_SHARED_STATE_DIR',
    'AI_OLD_SHARED_DIR',
    'AI_LEGACY_DIR',
    'AGENT_HISTORY_USERS_ROOTS_ENV',
    'AGENT_HISTORY_USERS_ROOTS_WINDOWS',
    'AGENT_HISTORY_USERS_ROOTS_LINUX',
    'AGENT_HISTORY_OFFICIAL_HOME_MARKERS',
    'AGENT_HISTORY_PLATFORMS',
    'AGENT_HISTORY_INJECTED_PROMPT_PREFIXES',
    'AGENT_HISTORY_HUMAN_UID_MIN',
    'AGENT_HISTORY_NOLOGIN_SHELLS',
    'AGENT_HISTORY_NON_HUMAN_USERS',
    'AGENT_HISTORY_NON_HUMAN_SUFFIXES',
    'AGENT_SLOT_USERS_ROOTS',
    'AGENT_LAUNCHER_SLOT_PROFILES',
]
