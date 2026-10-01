# -*- coding: utf-8 -*-
"""One-shot migration of former Code Sync JSON files into user_data.json."""

import json
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import user_data_store


def migrate_legacy_json_section(path: Path, section: str) -> None:
    """Move a former per-machine JSON file into a user_data section, then delete it."""
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        ColorPrint.yellow(f"[CodeSync] legacy file unreadable path={path} section={section}: {exc}")
        return
    if isinstance(data, dict) and data and not user_data_store.get_personalized_section(section):
        user_data_store.set_section(section, data)
        ColorPrint.blue(f"[CodeSync] migrated {path.name} into user data section {section}")
    try:
        path.unlink()
    except OSError as exc:
        ColorPrint.yellow(f"[CodeSync] legacy file delete failed path={path}: {exc}")


__all__ = ["migrate_legacy_json_section"]
