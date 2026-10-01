#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Agent-history scan paths: launcher slot profiles, users roots, official homes."""

import sys
from pathlib import Path
from typing import List

from pycore.pyfoundations.system_info import is_wsl
from pycore.pyfoundations.core_node_dirs import (
    LEGACY_LINUX_USERS_DIR as _LEGACY_LINUX_USERS_DIR,
    LEGACY_WINDOWS_PROGRAMING_DIR_NAME as _PROGRAMING_DIR_NAME,
    LEGACY_WINDOWS_PROGRAMING_USERS_DIR as _WINDOWS_PROGRAMING_USERS_DIR,
    LEGACY_WINDOWS_USERS_DIR_NAME as _USERS_DIR_NAME,
    WINDOWS_TMP_DIR_NAME as _WINDOWS_TMP_DIR_NAME,
    WINDOWS_TMP_USERS_DIR as _WINDOWS_TMP_USERS_DIR,
)
from pycore.pyfoundations.disk_mounts import iter_ntfs_mount_points
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


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
AGENT_SLOT_DATA_ROOT_TOKEN = '<data>'
AGENT_SLOT_HOME_ROOT_TOKEN = '~'
AGENT_SLOT_ROOT_TEMPLATES = {
    AGENT_SLOT_ROOT_PROGRAMING: {
        'win32': _WINDOWS_PROGRAMING_USERS_DIR,
        'linux': AGENT_SLOT_DATA_ROOT_TOKEN + '/' + _USERS_DIR_NAME,
    },
    AGENT_SLOT_ROOT_TMP: {
        'win32': _WINDOWS_TMP_USERS_DIR,
        'linux': _LEGACY_LINUX_USERS_DIR,
    },
    AGENT_SLOT_ROOT_KIMI_FALLBACK: {
        'linux': AGENT_SLOT_HOME_ROOT_TOKEN + '/.kimi_slots',
    },
    AGENT_SLOT_ROOT_OPENAI_TMP: {
        'linux': '/tmp/Users',
    },
}
# OS-level user roots (real accounts), scanned on every host.
AGENT_HISTORY_ROOT_USER_HOME = '/root'
AGENT_HISTORY_USERS_ROOTS_WINDOWS = ('C:/Users',)
AGENT_HISTORY_USERS_ROOTS_LINUX = ('/home', AGENT_HISTORY_ROOT_USER_HOME)

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

# Root read helper (Linux): when pyservice drops the worker to the desktop
# user, a root-side spool process parses only the agent sources that user
# cannot read (root-owned 0600 transcripts of agents run as root) and writes
# the parsed sessions here (root-owned, group-readable by the worker only).
AGENT_HISTORY_ROOT_SPOOL_DIR = '/var/cache/core_node/agent_history_root_spool'
AGENT_HISTORY_ROOT_SPOOL_INTERVAL_S = 5
AGENT_HISTORY_ROOT_SPOOL_STALE_S = 60

# Launcher -> isolated profile. (script stem, tool, {platform: root key}, slot)
# slot ending in '*' is a numbered family (MyBest1..N, auto-created by the
# script). Verified against scripts/winenvs/*.ps1 + scripts/linuxenvs/*.sh and
# GlobalVars.ps1 / gvar_system_common.sh on 2026-09-27. Scripts that keep the
# real home (claude1-5, claudeteam, claude<vendor>, codexyolo, kimiyolo,
# agyyolo, ssh*) are covered by the OS-level user roots.
_P = AGENT_SLOT_ROOT_PROGRAMING
_T = AGENT_SLOT_ROOT_TMP
AGENT_LAUNCHER_SLOT_PROFILES = (
    ('kimi1', 'kimi', {'win32': _T, 'linux': _T}, 'Kimi1'),
    ('kimi2', 'kimi', {'win32': _T, 'linux': _T}, 'Kimi2'),
    ('codex1', 'codex', {'win32': _P, 'linux': _T}, 'Codex1'),
    ('codex2', 'codex', {'win32': _P, 'linux': _T}, 'Codex2'),
    ('ark1-7', 'claude', {'win32': _P}, 'ark*'),
    ('ark1-2', 'claude', {'linux': _T}, 'ark*'),
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
# Scanned users-roots: the distinct {root key: {platform: (template,)}} the
# profiles above use, in AGENT_SLOT_ROOT_TEMPLATES order.
AGENT_SLOT_USERS_ROOTS = {
    root_key: {
        platform_key: (template,)
        for platform_key, template in templates.items()
        if any(profile[2].get(platform_key) == root_key for profile in AGENT_LAUNCHER_SLOT_PROFILES)
    }
    for root_key, templates in AGENT_SLOT_ROOT_TEMPLATES.items()
}

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
    'vscode': {'env': '', 'dirs': ('.vscode', '.vscode-server'),
               'platforms': AGENT_HISTORY_PLATFORMS,
               'verified': 'VS Code chatSessions json/jsonl + state.vscdb (no official spec)'},
    'windsurf': {'env': '', 'dirs': ('.windsurf', '.codeium'),
                 'platforms': AGENT_HISTORY_PLATFORMS,
                 'verified': 'VS Code-family chatSessions + state.vscdb (best effort)'},
    'trae': {'env': '', 'dirs': ('.trae',),
             'platforms': AGENT_HISTORY_PLATFORMS,
             'verified': 'VS Code-family chatSessions + state.vscdb (best effort)'},
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
            mount_points = [str(p) for p in Path('/mnt').iterdir() if p.is_dir()]
        except OSError as exc:
            ColorPrint.yellow(f"[AgentPaths] list /mnt failed: {exc}")
            mount_points = []
        for mp in mount_points:
            base = Path(mp)
            candidates.extend((
                base / _PROGRAMING_DIR_NAME / _USERS_DIR_NAME,
                base / _WINDOWS_TMP_DIR_NAME / _USERS_DIR_NAME,
                base / _USERS_DIR_NAME,
            ))
        return [p for p in candidates if p.is_dir()]
    for mp in iter_ntfs_mount_points():
        base = Path(mp)
        candidates.extend((
            base / _PROGRAMING_DIR_NAME / _USERS_DIR_NAME,
            base / _WINDOWS_TMP_DIR_NAME / _USERS_DIR_NAME,
        ))
    out: List[Path] = []
    seen: set = set()
    for p in candidates:
        try:
            if not p.is_dir():
                continue
            real = str(p.resolve())
        except OSError as exc:
            ColorPrint.yellow(f"[AgentPaths] resolve users root {p} failed: {exc}")
            continue
        if real in seen:
            continue
        seen.add(real)
        out.append(p)
    return out
