#!/usr/bin/env python3
"""Drop old package-manager caches after installs and upgrades
(config/service_contract.json paths.drive_layout.cache_prune).

Deletion goes through remove_tree_best_effort (links removed as links, locked
files kept). Prints one summary line per action and a final JSON summary.
Standalone (no project imports) so any Python interpreter can run it.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from prune_work_dir import SECONDS_PER_DAY, SECONDS_PER_MINUTE, acquire_lock, write_stamp
from remove_tree_best_effort import remove_entry

CONTRACT_PATH = Path(__file__).resolve().parents[3] / 'config' / 'service_contract.json'
LOG_PREFIX = '[prune-tool-caches] '
STORE_VERSION_PATTERN = re.compile(r'^v(\d+)$')
VERSION_PART_PATTERN = re.compile(r'\d+')
PIP_LEGACY_HTTP_DIR = 'http'
PIP_CURRENT_HTTP_DIR = 'http-v2'
COREPACK_VERSIONS_DIR = 'v1'
TOOLS = ('pnpm', 'npm', 'uv', 'composer')
PRUNE_COMMANDS = {
    'pnpm': ['store', 'prune'],
    'npm': ['cache', 'verify'],
    'uv': ['cache', 'prune'],
    'composer': ['clear-cache', '--gc'],
}
GLOBAL_ROOT_COMMANDS = {
    'pnpm': ['root', '-g'],
    'npm': ['root', '-g'],
}


def load_settings():
    with open(CONTRACT_PATH, 'r', encoding='utf-8') as handle:
        return json.load(handle)['paths']['drive_layout']['cache_prune']


def run_tool(executable, args, timeout):
    """stdout of the tool, or None when it fails."""
    try:
        completed = subprocess.run([executable] + args, stdin=subprocess.DEVNULL, capture_output=True,
                                   text=True, encoding='utf-8', errors='replace', timeout=timeout)
    except (OSError, subprocess.SubprocessError):
        return None
    return completed.stdout.strip() if completed.returncode == 0 else None


def mtime_of(path):
    try:
        return os.stat(path).st_mtime_ns
    except (OSError, TypeError, ValueError):
        return 0


def delete(path, actions):
    stayed = []
    remove_entry(path, stayed)
    actions.append(f'deleted {path}' + (' (partly locked)' if stayed else ''))


def prune_old_pnpm_stores(store_path, actions):
    current = STORE_VERSION_PATTERN.match(os.path.basename(store_path or ''))
    parent = os.path.dirname(store_path or '')
    if not current or not os.path.isdir(parent):
        return
    for entry in os.scandir(parent):
        match = STORE_VERSION_PATTERN.match(entry.name)
        if match and int(match.group(1)) < int(current.group(1)):
            delete(entry.path, actions)


def version_key(name):
    return [int(part) for part in VERSION_PART_PATTERN.findall(name)]


def prune_old_corepack_versions(corepack_home, actions):
    versions_root = os.path.join(corepack_home or '', COREPACK_VERSIONS_DIR)
    if not corepack_home or not os.path.isdir(versions_root):
        return
    for manager in os.scandir(versions_root):
        if not manager.is_dir(follow_symlinks=False):
            continue
        versions = sorted((entry for entry in os.scandir(manager.path) if version_key(entry.name)),
                          key=lambda entry: version_key(entry.name))
        for entry in versions[:-1]:
            delete(entry.path, actions)


def prune_legacy_pip_http(pip_cache_dir, actions):
    if pip_cache_dir and os.path.isdir(os.path.join(pip_cache_dir, PIP_CURRENT_HTTP_DIR)) \
            and os.path.isdir(os.path.join(pip_cache_dir, PIP_LEGACY_HTTP_DIR)):
        delete(os.path.join(pip_cache_dir, PIP_LEGACY_HTTP_DIR), actions)


def read_stamp(stamp_path):
    try:
        with open(stamp_path, 'r', encoding='utf-8') as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return {}


def main():
    parser = argparse.ArgumentParser(description='Drop old package-manager caches after installs and upgrades.')
    parser.add_argument('cache_root')
    parser.add_argument('--force', action='store_true', help='run every tool prune now')
    args = parser.parse_args()
    settings = load_settings()
    cache_root = os.path.abspath(args.cache_root)
    timeout = settings['command_timeout_seconds']
    if not os.path.isdir(cache_root):
        print(f'{LOG_PREFIX}skipped {cache_root}: not a directory')
        return
    stamp_path = os.path.join(cache_root, settings['stamp_name'])
    lock_path = os.path.join(cache_root, settings['lock_name'])
    if not acquire_lock(lock_path, settings['lock_stale_minutes'] * SECONDS_PER_MINUTE):
        print(f'{LOG_PREFIX}skipped {cache_root}: another prune is running')
        return
    try:
        stamp = read_stamp(stamp_path)
        old_fingerprints = stamp.get('fingerprints', {})
        global_roots = stamp.get('global_roots', {})
        interval_due = args.force or time.time() - stamp.get('last_full', 0) >= settings['interval_days'] * SECONDS_PER_DAY
        fingerprints = {}
        actions = []
        for tool in TOOLS:
            executable = shutil.which(tool)
            if not executable:
                continue
            if tool in GLOBAL_ROOT_COMMANDS and (old_fingerprints.get(tool, [None])[0] != executable
                                                 or not os.path.isdir(global_roots.get(tool) or '')):
                global_roots[tool] = run_tool(executable, GLOBAL_ROOT_COMMANDS[tool], timeout) or ''
            fingerprints[tool] = [executable, mtime_of(executable), mtime_of(global_roots.get(tool))]
            if interval_due or fingerprints[tool] != old_fingerprints.get(tool):
                result = run_tool(executable, PRUNE_COMMANDS[tool], timeout)
                actions.append(f'{tool} {" ".join(PRUNE_COMMANDS[tool])}: ' + ('ok' if result is not None else 'failed'))
            if tool == 'pnpm':
                prune_old_pnpm_stores(run_tool(executable, ['store', 'path'], timeout), actions)
        prune_old_corepack_versions(os.environ.get('COREPACK_HOME'), actions)
        prune_legacy_pip_http(os.environ.get('PIP_CACHE_DIR'), actions)
        for action in actions:
            print(f'{LOG_PREFIX}{action}')
        write_stamp(stamp_path, {
            'last_full': int(time.time()) if interval_due else stamp.get('last_full', 0),
            'fingerprints': fingerprints,
            'global_roots': global_roots,
        })
    finally:
        os.unlink(lock_path)
    print(f'{LOG_PREFIX}{json.dumps({"actions": len(actions), "interval_due": interval_due})}')


if __name__ == '__main__':
    sys.exit(main())
