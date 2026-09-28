# -*- coding: utf-8 -*-
"""
JSON merge helper for Claude Code settings (user settings, project settings, ~/.claude.json).
Uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep-merge override into base (mutates base)."""
    for key, val in override.items():
        if (
            key in base
            and isinstance(base[key], dict)
            and isinstance(val, dict)
        ):
            deep_merge(base[key], val)
        else:
            base[key] = val
    return base


def load_json(path: str) -> Dict[str, Any]:
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data: Dict[str, Any]) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def cmd_merge_user(args: argparse.Namespace) -> int:
    target = os.path.expanduser(args.settings_path)
    data = load_json(target)
    patch = {
        "env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"},
    }
    deep_merge(data, patch)
    save_json(target, data)
    print(f"OK: merged user settings: {target}")
    return 0


def cmd_merge_project(args: argparse.Namespace) -> int:
    proj = os.path.expanduser(args.project_dir)
    claude_dir = os.path.join(proj, ".claude")
    target = os.path.join(claude_dir, "settings.json")
    data = load_json(target)
    patch = {
        "env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"},
    }
    deep_merge(data, patch)
    save_json(target, data)
    print(f"OK: merged project settings: {target}")
    return 0


def cmd_merge_claude_json(args: argparse.Namespace) -> int:
    target = os.path.expanduser(args.path)
    data = load_json(target)
    patch: Dict[str, Any] = {}
    if args.teammate_mode:
        patch["teammateMode"] = args.teammate_mode
    if not patch:
        print("ERROR: no fields to merge (use --teammate-mode)", file=sys.stderr)
        return 1
    deep_merge(data, patch)
    save_json(target, data)
    print(f"OK: merged global Claude config: {target}")
    return 0


def cmd_merge_full(args: argparse.Namespace) -> int:
    user_settings = os.path.expanduser(args.user_settings_path)
    claude_json = os.path.expanduser(args.claude_json_path)
    udata = load_json(user_settings)
    deep_merge(
        udata,
        {"env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"}},
    )
    save_json(user_settings, udata)
    print(f"OK: user settings: {user_settings}")

    cdata = load_json(claude_json)
    mode = args.teammate_mode
    if mode:
        deep_merge(cdata, {"teammateMode": mode})
        save_json(claude_json, cdata)
        print(f"OK: ~/.claude.json teammateMode={mode}: {claude_json}")
    else:
        print(f"SKIP: no teammate mode (--teammate-mode empty)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Merge Claude Code JSON configuration fragments."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_user = sub.add_parser(
        "merge-user", help="Merge env into user .claude/settings.json"
    )
    p_user.add_argument(
        "--settings-path",
        default="~/.claude/settings.json",
        help="Path to user settings.json",
    )
    p_user.set_defaults(func=cmd_merge_user)

    p_proj = sub.add_parser(
        "merge-project", help="Merge env into project .claude/settings.json"
    )
    p_proj.add_argument(
        "--project-dir",
        required=True,
        help="Project root directory",
    )
    p_proj.set_defaults(func=cmd_merge_project)

    p_gc = sub.add_parser(
        "merge-claude-json", help="Merge fields into ~/.claude.json"
    )
    p_gc.add_argument(
        "--path",
        default="~/.claude.json",
        help="Path to claude.json (global config)",
    )
    p_gc.add_argument(
        "--teammate-mode",
        default="",
        help="Value for teammateMode (e.g. auto, in-process, tmux)",
    )
    p_gc.set_defaults(func=cmd_merge_claude_json)

    p_full = sub.add_parser(
        "merge-full",
        help="Apply user settings env + optional teammateMode in one step",
    )
    p_full.add_argument(
        "--user-settings-path",
        default="~/.claude/settings.json",
        help="User settings.json path",
    )
    p_full.add_argument(
        "--claude-json-path",
        default="~/.claude.json",
        help="Global ~/.claude.json path",
    )
    p_full.add_argument(
        "--teammate-mode",
        default="",
        help="teammateMode value (empty to skip claude.json)",
    )
    p_full.set_defaults(func=cmd_merge_full)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
