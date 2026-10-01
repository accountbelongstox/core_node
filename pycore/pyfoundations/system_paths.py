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
        cache/              # Application cache files
        config/             # Configuration files
        data/               # Persistent data
        logs/               # Log files
        ui_state/           # UI state cache (window positions, etc.)
"""

import os
import platform
import sys
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.system_info import (
    is_wsl,
    get_linux_distro_info,
)
from pycore.pyfoundations.pygvar import CACHE_DIR, PROJECT_ROOT, TMP_DIR
from pycore.pyfoundations.core_node_dirs import (
    get_core_node_data_dir as _get_core_node_data_dir,
    www_data_root_mounted,
)
from pycore.pyfoundations.disk_mounts import (
    WWW_PATH_KEY,
    get_base_data_directory,
    get_dev_compile_base,
    linux_cross_os_cache_dir,
    read_persisted_var,
)
from pycore.pyfoundations.data_owner import ensure_owned_dir
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


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
    it) reads/writes the SAME runtime state; owned by the real login user
    with mode 777 (pycore.pyfoundations.data_owner). Falls back per
    core_node_dirs (legacy /var/_core_node, then per-user ~/core_node) only
    when the shared dir is not writable.
    """
    return _get_core_node_data_dir()


def get_ui_state_cache_dir() -> Path:
    r"""
    Get UI state cache directory

    Used for storing window positions, sizes, and other UI state.

    Returns:
        Path: UI state cache directory (core_node/ui_state/)
    """
    return ensure_owned_dir(get_system_cache_dir() / 'ui_state')


def get_app_cache_dir() -> Path:
    r"""
    Get application cache directory

    Returns:
        Path: Application cache directory (core_node/cache/)
    """
    return ensure_owned_dir(CACHE_DIR)


def get_build_tool_cache_dir(tool_name: str) -> Path:
    """Get a namespaced cache directory for repository build helper tools."""
    normalized_name = ''.join(
        character for character in tool_name.strip().lower()
        if character.isalnum() or character in ('-', '_')
    )
    if not normalized_name:
        raise ValueError('Tool name must not be empty')
    return ensure_owned_dir(get_app_cache_dir() / 'build_tools' / normalized_name)


def get_app_config_dir() -> Path:
    r"""
    Get application configuration directory

    Returns:
        Path: Application config directory (core_node/config/)
    """
    return ensure_owned_dir(get_system_cache_dir() / 'config')


def get_app_data_dir() -> Path:
    r"""
    Get application persistent data directory

    Returns:
        Path: Application data directory (core_node/data/)
    """
    return ensure_owned_dir(get_system_cache_dir() / 'data')


def get_app_logs_dir() -> Path:
    r"""
    Get application logs directory

    Returns:
        Path: Application logs directory (core_node/logs/)
    """
    return ensure_owned_dir(get_system_cache_dir() / 'logs')


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
        return ensure_owned_dir(Path(env_val))
    if sys.platform == 'win32':
        return ensure_owned_dir(map_web_path('cache'))
    cross_os = linux_cross_os_cache_dir()
    if cross_os is not None:
        return cross_os
    shared = Path('/var/_core_node/cache')
    try:
        ensure_owned_dir(shared)
    except OSError as exc:
        ColorPrint.gray(f"[SystemPaths] shared cache {shared} unavailable: {exc}")
    if shared.is_dir() and os.access(shared, os.W_OK):
        return shared
    return ensure_owned_dir(Path.home() / 'core_node' / 'cache')


def get_edge_tts_voice_cache_dir(lang: str = "en") -> Path:
    r"""Edge-tts explicit-test scratch/cache dir:
    ``<shared_cache>/voice_static/voice_words_static/edge-tts/<lang>``.

    Used only by compatibility and explicit TTS test surfaces. Queue Center
    word audio uses Kokoro batches. Scratch files land on the shared
    ``D:\www\cache`` volume, NEVER the C:
    ``%TEMP%`` dir. ``lang`` is lower-cased and defaults to ``en``."""
    lang_code = (lang or "en").strip().lower() or "en"
    return ensure_owned_dir(
        get_shared_download_cache_dir() / 'voice_static' / 'voice_words_static' / 'edge-tts' / lang_code
    )


def get_xdg_cache_home() -> Path:
    r"""User-level XDG cache root (~/.cache on Linux, D:\www\cache on Windows).

    Subpaths are preserved when migrating from the per-user home cache, e.g.
    ``~/.cache/huggingface`` -> ``D:\www\cache\huggingface`` on Windows.
    """
    env_val = os.environ.get('XDG_CACHE_HOME')
    if env_val:
        return ensure_owned_dir(Path(env_val))
    if sys.platform == 'win32':
        return get_shared_download_cache_dir()
    core_cache = os.environ.get('CORE_NODE_CACHE_DIR')
    if core_cache:
        return ensure_owned_dir(Path(core_cache) / 'xdg')
    return ensure_owned_dir(Path.home() / '.cache')


def get_hf_home_dir() -> Path:
    """HuggingFace home (HF_HOME): shared cache / huggingface."""
    env_val = os.environ.get('HF_HOME')
    if env_val:
        return ensure_owned_dir(Path(env_val))
    return ensure_owned_dir(get_shared_download_cache_dir() / 'huggingface')


def get_hf_hub_cache_dir() -> Path:
    """HuggingFace Hub blob cache (HF_HUB_CACHE / HUGGINGFACE_HUB_CACHE)."""
    for key in ('HF_HUB_CACHE', 'HUGGINGFACE_HUB_CACHE'):
        env_val = os.environ.get(key)
        if env_val:
            return ensure_owned_dir(Path(env_val))
    return ensure_owned_dir(get_hf_home_dir() / 'hub')


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
    cross_os_shared = sys.platform == 'win32' or linux_cross_os_cache_dir() is not None
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
            duplicates_hub = Path(legacy).resolve() == hf_hub.resolve()
        except OSError as exc:
            ColorPrint.yellow(f"[SystemPaths] resolve TRANSFORMERS_CACHE={legacy} failed: {exc}")
            duplicates_hub = False
        if duplicates_hub:
            os.environ.pop('TRANSFORMERS_CACHE', None)


def get_local_data_dir() -> Path:
    r"""
    Get the local data directory for pycore (models/staging/state).

    Lives under the shared download cache (Windows: D:\www\cache\pycore,
    Linux: /var/_core_node/cache/pycore) - NOT the repo's .data folder.
    Callers that historically appended a "pycore" segment must drop it.

    Returns:
        Path: Local data directory (<cache>/pycore/)
    """
    return ensure_owned_dir(get_shared_download_cache_dir() / 'pycore')


def get_app_temp_dir() -> Path:
    r"""
    Get application temporary data directory

    Canonical scratch space for transient processor output (extracted audio,
    rendered video, captured screenshots, parsed files, etc.).

    Returns:
        Path: Application temp directory (<TMP_DIR>/pycore/)
    """
    return ensure_owned_dir(TMP_DIR / 'pycore')


def get_core_node_root() -> Path:
    """
    Get core_node root directory by locating from this file's position

    pygvar.PROJECT_ROOT with symlinks resolved.

    Returns:
        Path: core_node root directory
    """
    return Path(PROJECT_ROOT).resolve()


def get_lang_compiler_dir() -> Path:
    r"""Language/runtime install base (where pythonNNN, node-vX, etc. live).

    Mirrors GlobalVars.ps1 ``$Global:LANG_COMPILER_DIR = "D:\.dev_<sys>"`` (e.g.
    ``D:\.dev_win10``). Derived from the RUNNING interpreter (``sys.executable`` is
    authoritative), so it stays correct across win10/win11 and any relocation
    without hardcoding the suffix:
        ``D:\.dev_win10\python313\python.exe`` -> ``D:\.dev_win10``
    """
    return Path(sys.executable).resolve().parent.parent


def map_web_path(path_key: str, sub_path: Optional[str] = None) -> Path:
    """
    Map web path based on environment

    SYNC WARNING: This function MUST be kept in sync with:
    - Shell version: scripts/shells/linux/common/gvar_common.sh::map_web_path()
    - PHP version: poly_apps/laravel_main/app/Providers/PathMapper.php::mapWebPath()
    - All mappings must produce identical results across Python, Shell and PHP.
    - The detected data disk is honored as-is (no POSIX coercion); PostgreSQL
      stays on native ext4 via pg_mount.

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
        base_path = get_base_data_directory()

        # Distro suffix for the SEPARATE compile/dev base (unchanged).
        distro_name, distro_version = get_linux_distro_info()
        distro_suffix = f'{distro_name}_{distro_version}' if distro_version else distro_name
        dev_base = get_dev_compile_base(base_path, distro_suffix)

        # Cross-platform WWW alignment (mirrors gvar_common.sh::map_web_path):
        # Windows uses D:\www, so the SAME logical tree on Linux is /www/www
        # when /www is the mounted NTFS dual-boot disk root -- 3_setting_base.sh
        # bind-mounts that disk root onto /www, so /www/www IS the disk's www
        # dir == D:\www (e.g. cache is D:\www\cache on Windows, /www/www/cache
        # on Linux; ONE EXTRA LEVEL because /www == D:\ root). The extra level
        # exists ONLY for the NTFS share: www_data_root_mounted() requires an
        # NTFS-family fstype, so a Linux-only machine -- /www a plain native
        # dir OR a native ext4/xfs data-disk mount -- uses /www directly.
        # Priority: the persisted WWW_PATH central variable (single source of
        # truth) -> live NTFS-root-mount detection -> legacy base_path rule.
        # PostgreSQL is unaffected (pg_mount stays on native ext4).
        if is_wsl():
            www_base = base_path / 'www'
        else:
            www_path_var = read_persisted_var(WWW_PATH_KEY)
            if www_path_var and Path(www_path_var).is_dir():
                www_base = Path(www_path_var)
            elif www_data_root_mounted():
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
APP_CONFIG_DIR = get_app_config_dir()
APP_DATA_DIR = get_app_data_dir()
APP_LOGS_DIR = get_app_logs_dir()
LOCAL_DATA_DIR = get_local_data_dir()
APP_TEMP_DIR = get_app_temp_dir()
AI_SHARED_STATE_DIR = LOCAL_DATA_DIR / ".ai_state"
AI_OLD_SHARED_DIR = get_core_node_root() / ".ai_state"
AI_LEGACY_DIR = APP_DATA_DIR / "ai_state"


__all__ = [
    'apply_shared_cache_env',
    'get_xdg_cache_home',
    'get_shared_download_cache_dir',
    'get_system_cache_dir',
    'get_ui_state_cache_dir',
    'get_app_cache_dir',
    'get_app_config_dir',
    'get_app_data_dir',
    'get_app_logs_dir',
    'get_local_data_dir',
    'get_app_temp_dir',
    'get_core_node_root',
    'get_lang_compiler_dir',
    'map_web_path',
    'SYSTEM_CACHE_DIR',
    'UI_STATE_CACHE_DIR',
    'APP_CONFIG_DIR',
    'APP_DATA_DIR',
    'APP_LOGS_DIR',
    'LOCAL_DATA_DIR',
    'APP_TEMP_DIR',
    'AI_SHARED_STATE_DIR',
    'AI_OLD_SHARED_DIR',
    'AI_LEGACY_DIR',
]
