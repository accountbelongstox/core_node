#!/usr/bin/env python3
"""Delete a file or directory tree entry by entry, keeping whatever is locked.

Links (junctions, symlinks) are removed as links and never followed. Each file
that cannot be deleted (in use, access denied) is skipped and reported; every
other file and every directory that ends up empty is removed. With
--on-reboot (Windows, administrator), every entry that had to stay is also
registered for deletion at the next restart (MoveFileEx
MOVEFILE_DELAY_UNTIL_REBOOT), files before the directories holding them.
Paths listed in --keep-file (one per line) are never deleted nor registered,
and neither are the directories holding them.
Prints one summary line: REMAINING=<count of entries left> SCHEDULED=<count
registered for the next restart>.
Standalone (no project imports) so any Python interpreter can run it.
"""

import argparse
import os
import stat
import sys

REMAINING_PREFIX = 'REMAINING='
SCHEDULED_PREFIX = 'SCHEDULED='
SKIP_PREFIX = '[remove-tree] kept (in use or denied): '
REBOOT_PREFIX = '[remove-tree] deleted at the next restart: '
KEEP_PREFIX = '[remove-tree] kept (listed): '
MOVEFILE_DELAY_UNTIL_REBOOT = 0x4
KEEP_FILE_ENCODING = 'utf-8-sig'


def is_link(path):
    if os.path.islink(path):
        return True
    try:
        return bool(os.lstat(path).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except (AttributeError, OSError):
        return False


def remove_link(path):
    if os.path.isdir(path):
        os.rmdir(path)
    else:
        os.unlink(path)


def remove_file(path):
    try:
        os.unlink(path)
    except PermissionError:
        os.chmod(path, stat.S_IWRITE)
        os.unlink(path)


def schedule_on_reboot(path):
    """Register path for deletion at the next restart; True when accepted."""
    if sys.platform != 'win32':
        return False
    import ctypes
    from ctypes import wintypes

    move_file_ex = ctypes.windll.kernel32.MoveFileExW
    move_file_ex.argtypes = (wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD)
    move_file_ex.restype = wintypes.BOOL
    if move_file_ex(path, None, MOVEFILE_DELAY_UNTIL_REBOOT):
        print(f'{REBOOT_PREFIX}{path}')
        return True
    return False


def path_key(path):
    return os.path.normcase(os.path.abspath(path))


def read_keep_paths(keep_file):
    """Listed paths, and every directory holding one of them."""
    keep = set()
    holders = set()
    if not keep_file:
        return keep, holders
    with open(keep_file, encoding=KEEP_FILE_ENCODING) as handle:
        for line in handle:
            if not line.strip():
                continue
            key = path_key(line.strip())
            keep.add(key)
            parent = os.path.dirname(key)
            while parent and parent not in holders and parent != os.path.dirname(parent):
                holders.add(parent)
                parent = os.path.dirname(parent)
    return keep, holders


def remove_entry(path, stayed, keep=frozenset()):
    """Remove one path; return the number of entries that had to stay.
    Entries that stay are appended to stayed, children before parents."""
    remaining = 0
    if keep and path_key(path) in keep:
        print(f'{KEEP_PREFIX}{path}')
        return 1
    try:
        if is_link(path):
            remove_link(path)
            return 0
        if not os.path.isdir(path):
            remove_file(path)
            return 0
        with os.scandir(path) as entries:
            children = [entry.path for entry in entries]
        for child in children:
            remaining += remove_entry(child, stayed, keep)
        if remaining == 0:
            os.rmdir(path)
        else:
            stayed.append(path)
    except FileNotFoundError:
        return remaining
    except OSError:
        print(f'{SKIP_PREFIX}{path}')
        stayed.append(path)
        remaining += 1
    return remaining


def main():
    parser = argparse.ArgumentParser(description='Delete a tree entry by entry, keeping locked files.')
    parser.add_argument('path')
    parser.add_argument('--on-reboot', action='store_true',
                        help='register every entry that had to stay for deletion at the next restart (Windows)')
    parser.add_argument('--keep-file', default='',
                        help='file listing paths (one per line) that are never deleted')
    args = parser.parse_args()
    stayed = []
    keep, holders = read_keep_paths(args.keep_file)
    remaining = remove_entry(os.path.abspath(args.path), stayed, keep)
    scheduled = 0
    if args.on_reboot:
        scheduled = sum(1 for path in stayed if path_key(path) not in holders and schedule_on_reboot(path))
    print(f'{REMAINING_PREFIX}{remaining} {SCHEDULED_PREFIX}{scheduled}')


if __name__ == '__main__':
    main()
