# -*- coding: utf-8 -*-
"""The one AI state directory shared by every AI history/log store (and the
Laravel runtime): ``<local data>/.ai_state``. Files left in the previous shared
location (``<core_node>/.ai_state``) are moved in once; an unwritable data root
falls back to the app-data directory. The pre-shared per-OS rate-usage file is
copied in once (it stays the fallback store when the shared dir is unwritable)."""

import os
import shutil
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import (
    AI_LEGACY_DIR,
    AI_OLD_SHARED_DIR,
    AI_SHARED_STATE_DIR,
    APP_DATA_DIR,
)

LEGACY_RATE_USAGE_FILE = APP_DATA_DIR / "ai_rate_usage.json"
_LEGACY_FILES = (LEGACY_RATE_USAGE_FILE,)


def _move_missing(item: Path) -> None:
    target = AI_SHARED_STATE_DIR / item.name
    if target.exists():
        return
    try:
        os.replace(str(item), str(target))
    except OSError as exc:
        ColorPrint.yellow(f"[ai_state] migrate {item} -> {target} failed: {exc}")


def _migrate_old_state() -> None:
    """Move items of the previous shared dir that the current dir lacks, then
    copy the per-OS legacy files that are still missing (prior-dir data wins)."""
    if AI_OLD_SHARED_DIR.is_dir() and AI_OLD_SHARED_DIR.resolve() != AI_SHARED_STATE_DIR.resolve():
        for item in AI_OLD_SHARED_DIR.iterdir():
            _move_missing(item)
    for item in _LEGACY_FILES:
        target = AI_SHARED_STATE_DIR / item.name
        if item.is_file() and not target.exists():
            try:
                shutil.copyfile(str(item), str(target))
            except OSError as exc:
                ColorPrint.yellow(f"[ai_state] copy {item} -> {target} failed: {exc}")


def ai_state_dir() -> Path:
    try:
        AI_SHARED_STATE_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        ColorPrint.yellow(f"[ai_state] {AI_SHARED_STATE_DIR} unwritable ({exc}); using {AI_LEGACY_DIR}")
        AI_LEGACY_DIR.mkdir(parents=True, exist_ok=True)
        return AI_LEGACY_DIR
    _migrate_old_state()
    return AI_SHARED_STATE_DIR


__all__ = ["LEGACY_RATE_USAGE_FILE", "ai_state_dir"]
