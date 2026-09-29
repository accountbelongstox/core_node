#!/usr/bin/env python3
"""Idempotent preset of the Claude Code user settings the core_node team needs.

The preset is config/claude_team_roles.json user_settings_preset. Scalars are
enforced, objects are merged recursively, lists get the preset items. Items
this tool applied earlier and later removed from the preset are withdrawn
(tracked in <settings dir>/core_node_settings_preset.json); items the user
added are kept. "$defaults" is added only to a list this tool creates. An
unreadable settings file is never touched; every write keeps one .bak copy
and rewrites the same file in place (owner, mode and every other key kept).
With CLAUDE_CONFIG_DIR set, missing first-run setup and project trust in
<dir>/.claude.json are filled from ~/.claude.json of the same home.

Usage: claude_team_settings.py [--settings <path>] [--catalog <path>] [--check]
"""

import argparse
import json
import os
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_CATALOG_PATH = os.path.join(ROOT_DIR, "config", "claude_team_roles.json")
PRESET_KEY = "user_settings_preset"
STATE_FILE_NAME = "core_node_settings_preset.json"
BACKUP_SUFFIX = ".bak"
DEFAULTS_ITEM = "$defaults"
SHORT_LIMIT = 80
DEFAULT_INDENT = 2
GLOBAL_CONFIG_NAME = ".claude.json"
GLOBAL_BACKFILL_KEYS = ("hasCompletedOnboarding", "lastOnboardingVersion")
PROJECTS_KEY = "projects"
PROJECT_TRUST_KEYS = ("hasTrustDialogAccepted", "hasCompletedProjectOnboarding")
BACKFILL_FLAGS = ("hasCompletedOnboarding", "hasTrustDialogAccepted", "hasCompletedProjectOnboarding")


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


def detect_indent(path):
    try:
        with open(path, encoding="utf-8-sig") as handle:
            for line in handle:
                stripped = line.lstrip(" ")
                if stripped.startswith('"') and len(stripped) < len(line):
                    return len(line) - len(stripped)
    except OSError:
        pass
    return DEFAULT_INDENT


# In-place update: the same file (inode, owner, mode) is rewritten, never
# deleted and recreated; every key already present is kept, and a .bak copy
# of the previous content is taken first.
def write_json_in_place(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    text = json.dumps(data, indent=detect_indent(path), ensure_ascii=False) + "\n"
    json.loads(text)
    if os.path.exists(path):
        shutil.copy2(path, path + BACKUP_SUFFIX)
    with open(path, "r+" if os.path.exists(path) else "w", encoding="utf-8") as handle:
        handle.seek(0)
        handle.write(text)
        handle.truncate()


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


def backfill_missing(target, source, keys, path, changes):
    for key in keys:
        if key not in source:
            continue
        if key not in target or (key in BACKFILL_FLAGS and not target[key] and source[key]):
            target[key] = source[key]
            changes.append("%s%s" % (path, key))


# With CLAUDE_CONFIG_DIR set, Claude Code reads <dir>/.claude.json instead of
# ~/.claude.json; a fresh copy there lacks first-run setup and project trust.
# Only the missing parts are filled from ~/.claude.json of the same home.
def backfill_global_config(check_only):
    config_dir = os.environ.get("CLAUDE_CONFIG_DIR")
    if not config_dir:
        return
    target_path = os.path.join(os.path.abspath(config_dir), GLOBAL_CONFIG_NAME)
    source_path = os.path.join(os.path.dirname(os.path.abspath(config_dir)), GLOBAL_CONFIG_NAME)
    if target_path == source_path or not os.path.isfile(target_path):
        return
    try:
        source = read_json(source_path, {})
        target = read_json(target_path, None)
    except (OSError, ValueError):
        print("[WARN] %s or %s unreadable; first-run setup and project trust not checked" % (source_path, target_path))
        return
    if not isinstance(source, dict) or not isinstance(target, dict):
        return
    changes = []
    backfill_missing(target, source, GLOBAL_BACKFILL_KEYS, "", changes)
    source_projects = source.get(PROJECTS_KEY)
    if isinstance(source_projects, dict):
        target_projects = target.get(PROJECTS_KEY)
        if not isinstance(target_projects, dict):
            target_projects = target[PROJECTS_KEY] = {}
        for project, entry in source_projects.items():
            if project not in target_projects:
                target_projects[project] = entry
                changes.append("%s.%s" % (PROJECTS_KEY, project))
            elif isinstance(entry, dict) and isinstance(target_projects[project], dict):
                backfill_missing(target_projects[project], entry, PROJECT_TRUST_KEYS, "%s.%s." % (PROJECTS_KEY, project), changes)
    if not changes:
        print("[SKIP] Claude first-run setup and project trust present: %s" % target_path)
        return
    if check_only:
        print("[MISSING] %s in %s (from %s)" % (", ".join(changes), target_path, source_path))
        return
    write_json_in_place(target_path, target)
    print("[OK] %s filled into %s from %s" % (", ".join(changes), target_path, source_path))


def main():
    parser = argparse.ArgumentParser(description="Apply the core_node Claude Code user settings preset.")
    parser.add_argument("--settings", default=default_settings_path())
    parser.add_argument("--catalog", default=DEFAULT_CATALOG_PATH)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    backfill_global_config(args.check)
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
        write_json_in_place(settings_path, settings)
        for change in applier.changes:
            print("[OK] Claude setting %s (%s)" % (change, settings_path))
    if not args.check and state.get("list_items") != applier.applied_items:
        write_json_in_place(state_path, {"list_items": applier.applied_items})


if __name__ == "__main__":
    main()
