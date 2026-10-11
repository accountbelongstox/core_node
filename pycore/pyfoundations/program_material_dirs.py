# -*- coding: utf-8 -*-
r"""OS-local directories for program material: installer/package/binary
downloads and unpack/extract/build scratch.

Program material never lands on the shared data tree (Windows D:, Linux
/www or /www/www on a dual-boot NTFS share):
    Windows: the program-drive dirs Step 1 recorded
             (core_node_dirs.get_windows_program_dir 'downloads_root' /
             'work_root', e.g. E:\_win10_dev\Downloads and E:\_win10_dev\work).
    Linux:   the native pycore temp root (pygvar.TMP_DIR, /var/_core_node/_tmp
             on the root ext4 filesystem).
"""

import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.core_node_dirs import get_windows_program_dir
from pycore.pyfoundations.data_owner import ensure_owned_dir
from pycore.pyfoundations.pybasecommon.commander import run_background
from pycore.pyfoundations.pygvar import PROJECT_ROOT, TMP_DIR
from pycore.pyfoundations.service_contract import value as contract_value

WINDOWS_DOWNLOADS_KIND = 'downloads_root'
WINDOWS_WORK_KIND = 'work_root'
LINUX_DOWNLOADS_DIR_NAME = 'downloads'
LINUX_WORK_DIR_NAME = 'work'
TEMP_ENV_KEYS = ('TEMP', 'TMP', 'TMPDIR')
WORK_PRUNE_CONTRACT_KEY = 'paths.drive_layout.work_root.prune'
LEGACY_WORK_ROOT_CONTRACT_KEY = 'paths.drive_layout.legacy_program_dirs.work_root'
SECONDS_PER_MINUTE = 60
_work_prune_started = False


def _program_dir(windows_kind: str, linux_dir_name: str, sub: Optional[str]) -> Path:
    base = get_windows_program_dir(windows_kind) if sys.platform == 'win32' else TMP_DIR / linux_dir_name
    return ensure_owned_dir(base / sub if sub else base)


def _start_work_dir_prune(work_root: Path) -> None:
    """Once per process, start the contract work-dir pruner in the background
    when its interval has passed; never on the shared legacy work_root."""
    global _work_prune_started
    if _work_prune_started:
        return
    _work_prune_started = True
    settings = contract_value(WORK_PRUNE_CONTRACT_KEY)
    legacy_root = str(contract_value(LEGACY_WORK_ROOT_CONTRACT_KEY))
    if sys.platform == 'win32' and os.path.normcase(str(work_root)) == os.path.normcase(legacy_root):
        return
    stamp = work_root / settings['stamp_name']
    try:
        if time.time() - stamp.stat().st_mtime < settings['interval_minutes'] * SECONDS_PER_MINUTE:
            return
    except OSError:
        pass
    run_background([sys.executable, str(Path(PROJECT_ROOT) / settings['script']), str(work_root)])


def get_program_download_dir(sub: Optional[str] = None) -> Path:
    """OS-local dir for installer/package/binary downloads (optional sub dir)."""
    return _program_dir(WINDOWS_DOWNLOADS_KIND, LINUX_DOWNLOADS_DIR_NAME, sub)


def get_program_work_dir(sub: Optional[str] = None) -> Path:
    """OS-local scratch dir for unpacking/extracting/building program files."""
    work_root = _program_dir(WINDOWS_WORK_KIND, LINUX_WORK_DIR_NAME, None)
    _start_work_dir_prune(work_root)
    return _program_dir(WINDOWS_WORK_KIND, LINUX_WORK_DIR_NAME, sub) if sub else work_root


def make_program_work_dir(prefix: str) -> Path:
    """A fresh unique scratch dir under get_program_work_dir() (caller removes it)."""
    return Path(tempfile.mkdtemp(prefix=prefix, dir=str(get_program_work_dir())))


def program_work_env(sub: Optional[str] = None, base: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """A child-process environment (copy of ``base`` or os.environ) whose temp
    vars point at get_program_work_dir(sub), so installers (pip build/unpack,
    venv creation) never scratch on the shared data drive."""
    env = dict(os.environ if base is None else base)
    work_dir = str(get_program_work_dir(sub))
    for key in TEMP_ENV_KEYS:
        env[key] = work_dir
    return env


__all__ = [
    'TEMP_ENV_KEYS',
    'get_program_download_dir',
    'get_program_work_dir',
    'make_program_work_dir',
    'program_work_env',
]
