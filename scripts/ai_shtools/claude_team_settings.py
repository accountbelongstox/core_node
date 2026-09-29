#!/usr/bin/env python3
"""Idempotent preset of the Claude Code user settings the core_node team needs.

The preset is config/claude_team_roles.json user_settings_preset. Scalars are
enforced, objects are merged recursively, lists get the preset items. Items
this tool applied earlier and later removed from the preset are withdrawn
(tracked in <settings dir>/core_node_settings_preset.json); items the user
added are kept. "$defaults" is added only to a list this tool creates. An
unreadable settings file is never touched; every write keeps one .bak copy
and replaces the file atomically with its original owner and mode.

Usage: claude_team_settings.py [--settings <path>] [--catalog <path>] [--check]
"""

import argparse
import json
import os
import shutil
import tempfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_CATALOG_PATH = os.path.join(ROOT_DIR, "config", "claude_team_roles.json")
PRESET_KEY = "user_settings_preset"
STATE_FILE_NAME = "core_node_settings_preset.json"
BACKUP_SUFFIX = ".bak"
DEFAULTS_ITEM = "$defaults"
SHORT_LIMIT = 80


def default_settings_path():
    config_dir = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
    return os.path.join(config_dir, "settings.json")


def short(value):
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= SHORT_LIMIT else text[:SHORT_LIMIT - 3] + "..."


def read_json(path, missing):
    try:
        with open(path, encoding="utf-8-sig") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return missing


def write_json_atomic(path, data):
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    original = os.stat(path) if os.path.exists(path) else None
    if original is not None:
        shutil.copy2(path, path + BACKUP_SUFFIX)
    handle, temp_path = tempfile.mkstemp(prefix=".settings-", dir=directory)
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        json.dump(data, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    if original is not None:
        os.chmod(temp_path, original.st_mode & 0o777)
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            os.chown(temp_path, original.st_uid, original.st_gid)
    os.replace(temp_path, path)


class PresetApplier:
    def __init__(self, previous_items):
        self.previous_items = previous_items
        self.applied_items = {}
        self.changes = []
        self.notes = []

    def apply(self, target, preset, path=""):
        for key, wanted in preset.items():
            key_path = "%s.%s" % (path, key) if path else key
            if isinstance(wanted, dict):
                if key in target and not isinstance(target[key], dict):
                    self.notes.append("[WARN] Claude setting %s is not an object; kept" % key_path)
                    continue
                self.apply(target.setdefault(key, {}), wanted, key_path)
            elif isinstance(wanted, list):
                self.apply_list(target, key, wanted, key_path)
            elif key not in target or target[key] != wanted:
                self.changes.append("%s = %s" % (key_path, short(wanted)))
                target[key] = wanted

    def apply_list(self, target, key, wanted, key_path):
        created = key not in target
        if not created and not isinstance(target[key], list):
            self.notes.append("[WARN] Claude setting %s is not a list; kept" % key_path)
            return
        current = target.setdefault(key, [])
        previous = self.previous_items.get(key_path, [])
        applied = []
        for item in previous:
            if item not in wanted and item in current:
                current.remove(item)
                self.changes.append("%s -= %s" % (key_path, short(item)))
        for item in wanted:
            if item == DEFAULTS_ITEM and not created and item not in previous and item not in current:
                continue
            applied.append(item)
            if item not in current:
                if item == DEFAULTS_ITEM:
                    current.insert(0, item)
                else:
                    current.append(item)
                self.changes.append("%s += %s" % (key_path, short(item)))
        self.applied_items[key_path] = applied


def main():
    parser = argparse.ArgumentParser(description="Apply the core_node Claude Code user settings preset.")
    parser.add_argument("--settings", default=default_settings_path())
    parser.add_argument("--catalog", default=DEFAULT_CATALOG_PATH)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    settings_path = os.path.abspath(args.settings)
    state_path = os.path.join(os.path.dirname(settings_path), STATE_FILE_NAME)

    try:
        preset = (read_json(args.catalog, {}) or {}).get(PRESET_KEY) or {}
    except (OSError, ValueError):
        print("[WARN] %s unreadable; Claude settings preset skipped" % args.catalog)
        return
    if not preset:
        print("[SKIP] no %s in %s" % (PRESET_KEY, args.catalog))
        return
    try:
        settings = read_json(settings_path, {})
    except (OSError, ValueError):
        settings = None
    if not isinstance(settings, dict):
        print("[WARN] %s is not a valid JSON object; left untouched (fix it, then rerun)" % settings_path)
        return
    try:
        state = read_json(state_path, {})
    except (OSError, ValueError):
        state = {}
    if not isinstance(state, dict):
        state = {}

    applier = PresetApplier(state.get("list_items") or {})
    applier.apply(settings, preset)
    for note in applier.notes:
        print(note)
    if not applier.changes:
        print("[SKIP] Claude settings preset up to date: %s" % settings_path)
    elif args.check:
        for change in applier.changes:
            print("[MISSING] Claude setting %s (%s)" % (change, settings_path))
        return
    else:
        write_json_atomic(settings_path, settings)
        for change in applier.changes:
            print("[OK] Claude setting %s (%s)" % (change, settings_path))
    if not args.check and state.get("list_items") != applier.applied_items:
        write_json_atomic(state_path, {"list_items": applier.applied_items})


if __name__ == "__main__":
    main()
