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
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.core_node_dirs import get_windows_program_dir
from pycore.pyfoundations.data_owner import ensure_owned_dir
from pycore.pyfoundations.pygvar import TMP_DIR

WINDOWS_DOWNLOADS_KIND = 'downloads_root'
WINDOWS_WORK_KIND = 'work_root'
LINUX_DOWNLOADS_DIR_NAME = 'downloads'
LINUX_WORK_DIR_NAME = 'work'
TEMP_ENV_KEYS = ('TEMP', 'TMP', 'TMPDIR')


def _program_dir(windows_kind: str, linux_dir_name: str, sub: Optional[str]) -> Path:
    base = get_windows_program_dir(windows_kind) if sys.platform == 'win32' else TMP_DIR / linux_dir_name
    return ensure_owned_dir(base / sub if sub else base)


def get_program_download_dir(sub: Optional[str] = None) -> Path:
    """OS-local dir for installer/package/binary downloads (optional sub dir)."""
    return _program_dir(WINDOWS_DOWNLOADS_KIND, LINUX_DOWNLOADS_DIR_NAME, sub)


def get_program_work_dir(sub: Optional[str] = None) -> Path:
    """OS-local scratch dir for unpacking/extracting/building program files."""
    return _program_dir(WINDOWS_WORK_KIND, LINUX_WORK_DIR_NAME, sub)


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
