#!/usr/bin/env python3
"""Keep the program work dir within its contract budget
(config/service_contract.json paths.drive_layout.work_root.prune).

Idle units (see the contract purpose) are deleted oldest first through
remove_tree_best_effort, so links are removed as links and locked files stay.
Prints one summary line, also stored as JSON in the stamp file.
Standalone (no project imports) so any Python interpreter can run it.
"""

import argparse
import fnmatch
import json
import os
import stat
import sys
import time
from pathlib import Path

from remove_tree_best_effort import is_link, remove_entry

CONTRACT_PATH = Path(__file__).resolve().parents[3] / 'config' / 'service_contract.json'
SUMMARY_PREFIX = '[prune-work-dir] '
BYTES_PER_MB = 1024 * 1024
SECONDS_PER_HOUR = 3600
SECONDS_PER_DAY = 86400
SECONDS_PER_MINUTE = 60


def load_settings():
    with open(CONTRACT_PATH, 'r', encoding='utf-8') as handle:
        drive_layout = json.load(handle)['paths']['drive_layout']
    return drive_layout['work_root']['prune'], drive_layout['legacy_program_dirs']['work_root']


def refuse_reason(root, legacy_work_root):
    if not os.path.isdir(root) or is_link(root):
        return 'not a directory'
    if os.path.dirname(root) == root:
        return 'filesystem root'
    if os.path.normcase(root) == os.path.normcase(os.path.abspath(legacy_work_root)):
        return 'shared legacy work_root'
    return ''


def matches(rel_path, patterns):
    """Segment-wise glob match ('*' never crosses '/')."""
    segments = rel_path.split('/')
    for pattern in patterns:
        pattern_segments = pattern.split('/')
        if len(pattern_segments) == len(segments) and all(
                fnmatch.fnmatch(segment, glob) for segment, glob in zip(segments, pattern_segments)):
            return True
    return False


def measure(path):
    """Total file bytes and newest mtime/ctime below path, links not followed."""
    size = 0
    newest = 0.0
    pending = [path]
    while pending:
        current = pending.pop()
        try:
            info = os.lstat(current)
        except OSError:
            continue
        newest = max(newest, info.st_mtime, info.st_ctime)
        if is_link(current):
            continue
        if stat.S_ISDIR(info.st_mode):
            try:
                with os.scandir(current) as entries:
                    pending.extend(entry.path for entry in entries)
            except OSError:
                continue
        else:
            size += info.st_size
    return size, newest


def collect(root, settings):
    """(units, kept_bytes): units are [path, size, newest] lists."""
    units = []
    kept_bytes = 0
    own_names = {settings['stamp_name'], settings['lock_name']}
    pending = [(root, '')]
    while pending:
        directory, prefix = pending.pop()
        try:
            with os.scandir(directory) as entries:
                children = list(entries)
        except OSError:
            continue
        for child in children:
            rel_path = prefix + child.name
            if not prefix and child.name in own_names:
                continue
            if matches(rel_path, settings['keep_entries']):
                kept_bytes += measure(child.path)[0]
                continue
            if not is_link(child.path) and child.is_dir(follow_symlinks=False) \
                    and matches(rel_path, settings['unit_containers']):
                pending.append((child.path, rel_path + '/'))
                continue
            size, newest = measure(child.path)
            units.append([child.path, size, newest])
    return units, kept_bytes


def acquire_lock(lock_path, stale_seconds):
    for _attempt in range(2):
        try:
            os.close(os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            return True
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(lock_path) < stale_seconds:
                    return False
                os.unlink(lock_path)
            except OSError:
                return False
    return False


def write_stamp(stamp_path, summary):
    with open(stamp_path, 'w', encoding='utf-8') as handle:
        json.dump(summary, handle)


def prune(root, settings, dry_run):
    now = time.time()
    hard_cutoff = now - settings['max_idle_days'] * SECONDS_PER_DAY
    soft_cutoff = now - settings['min_idle_hours'] * SECONDS_PER_HOUR
    max_bytes = settings['max_mb'] * BYTES_PER_MB
    units, kept_bytes = collect(root, settings)
    total = kept_bytes + sum(unit[1] for unit in units)
    before = total
    deleted = 0
    locked = 0
    for unit in sorted(units, key=lambda item: item[2]):
        path, size, newest = unit
        if newest >= soft_cutoff or (newest >= hard_cutoff and total <= max_bytes):
            continue
        if dry_run:
            print(f'{SUMMARY_PREFIX}would delete {size // BYTES_PER_MB} MB {path}')
            total -= size
            deleted += 1
            continue
        stayed = []
        remove_entry(path, stayed)
        remaining_size = measure(path)[0] if os.path.lexists(path) else 0
        total -= size - remaining_size
        deleted += 1
        locked += 1 if stayed else 0
    return {
        'finished': int(time.time()),
        'dry_run': dry_run,
        'before_mb': before // BYTES_PER_MB,
        'after_mb': total // BYTES_PER_MB,
        'kept_cache_mb': kept_bytes // BYTES_PER_MB,
        'deleted_units': deleted,
        'partly_locked_units': locked,
    }


def main():
    parser = argparse.ArgumentParser(description='Delete idle entries of the program work dir down to its size budget.')
    parser.add_argument('path')
    parser.add_argument('--force', action='store_true', help='ignore interval_minutes')
    parser.add_argument('--dry-run', action='store_true', help='list what would be deleted')
    args = parser.parse_args()
    settings, legacy_work_root = load_settings()
    root = os.path.abspath(args.path)
    reason = refuse_reason(root, legacy_work_root)
    if reason:
        print(f'{SUMMARY_PREFIX}skipped {root}: {reason}')
        return
    stamp_path = os.path.join(root, settings['stamp_name'])
    lock_path = os.path.join(root, settings['lock_name'])
    if not args.force and os.path.exists(stamp_path) \
            and time.time() - os.path.getmtime(stamp_path) < settings['interval_minutes'] * SECONDS_PER_MINUTE:
        print(f'{SUMMARY_PREFIX}skipped {root}: within interval')
        return
    if not acquire_lock(lock_path, settings['lock_stale_minutes'] * SECONDS_PER_MINUTE):
        print(f'{SUMMARY_PREFIX}skipped {root}: another prune is running')
        return
    try:
        if not args.dry_run:
            write_stamp(stamp_path, {'started': int(time.time())})
        summary = prune(root, settings, args.dry_run)
        if not args.dry_run:
            write_stamp(stamp_path, summary)
    finally:
        os.unlink(lock_path)
    print(f'{SUMMARY_PREFIX}{json.dumps(summary)}')


if __name__ == '__main__':
    sys.exit(main())
