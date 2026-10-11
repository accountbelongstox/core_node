#!/usr/bin/env python3
"""Re-root the interpreter path embedded in Windows script launchers (.exe).

After a program tree moved (e.g. D:\\.dev_win10 -> E:\\_win10_dev), the console
launchers that pip/distlib and uv generate (pythonNNN\\Scripts\\pip.exe, venv
entry points, ...) still carry the old absolute python.exe path. Two formats:

* pip / distlib: launcher stub + "#!<python>" shebang line + appended zip. The
  zip offsets are relative to the zip start, which the launcher finds from the
  end-of-central-directory record, so the shebang may change length.
* uv trampoline: launcher + zip + <python path> + u32 path length + magic
  (UVSC / UVPY) at the very end; the length field is rewritten too.

Links are not followed; other files are never touched. Idempotent. Prints one
summary line: RELOCATED=<count>.
Standalone (no project imports) so any Python interpreter can run it.
"""

import argparse
import os
import re
import stat
import struct
import time

RELOCATED_PREFIX = 'RELOCATED='
PROGRESS_INTERVAL_SECONDS = 5
LOG_PREFIX = '[relocate-launchers] '
EOCD_SIGNATURE = b'PK\x05\x06'
EOCD_MIN_SIZE = 22
SHEBANG = b'#!'
UV_MAGICS = (b'UVSC', b'UVPY')
UV_TAIL_SIZE = 8
MAX_LAUNCHER_BYTES = 16 * 1024 * 1024


def is_link(path):
    if os.path.islink(path):
        return True
    try:
        return bool(os.lstat(path).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except (AttributeError, OSError):
        return False


def reroot(value, old_pattern, new_root):
    return old_pattern.sub(lambda _match: new_root, value)


def relocate_uv(data, old_pattern, new_root):
    if len(data) < UV_TAIL_SIZE or data[-4:] not in UV_MAGICS:
        return None
    path_length = struct.unpack('<I', data[-8:-4])[0]
    path_start = len(data) - UV_TAIL_SIZE - path_length
    if path_length == 0 or path_start < 0:
        return None
    path = data[path_start:-UV_TAIL_SIZE]
    new_path = reroot(path, old_pattern, new_root)
    if new_path == path:
        return None
    return data[:path_start] + new_path + struct.pack('<I', len(new_path)) + data[-4:]


def relocate_distlib(data, old_pattern, new_root):
    eocd = data.rfind(EOCD_SIGNATURE)
    if eocd < 0 or len(data) - eocd < EOCD_MIN_SIZE:
        return None
    cdir_size, cdir_offset = struct.unpack('<II', data[eocd + 12:eocd + 20])
    zip_start = eocd - cdir_size - cdir_offset
    if zip_start <= 0:
        return None
    shebang_start = data.rfind(SHEBANG, 0, zip_start)
    if shebang_start < 0 or b'\n' not in data[shebang_start:zip_start]:
        return None
    shebang = data[shebang_start:zip_start]
    new_shebang = reroot(shebang, old_pattern, new_root)
    if new_shebang == shebang:
        return None
    return data[:shebang_start] + new_shebang + data[zip_start:]


def relocate_file(path, old_pattern, new_root):
    with open(path, 'rb') as handle:
        data = handle.read()
    if not old_pattern.search(data):
        return False
    updated = relocate_uv(data, old_pattern, new_root)
    if updated is None:
        updated = relocate_distlib(data, old_pattern, new_root)
    if updated is None:
        return False
    with open(path, 'wb') as handle:
        handle.write(updated)
    return True


def relocate_tree(root, old_pattern, new_root):
    relocated = 0
    scanned = 0
    launchers = 0
    started = time.monotonic()
    last_report = started
    pending = [root]
    print(f'{LOG_PREFIX}scanning {root}', flush=True)
    while pending:
        current = pending.pop()
        try:
            with os.scandir(current) as entries:
                children = list(entries)
        except OSError:
            continue
        scanned += len(children)
        if time.monotonic() - last_report >= PROGRESS_INTERVAL_SECONDS:
            last_report = time.monotonic()
            print(f'{LOG_PREFIX}{scanned:,} entries, {launchers:,} .exe checked, {relocated:,} relocated, '
                  f'{int(last_report - started)}s, at {current}', flush=True)
        for entry in children:
            if is_link(entry.path):
                continue
            if entry.is_dir(follow_symlinks=False):
                pending.append(entry.path)
                continue
            if not entry.name.lower().endswith('.exe'):
                continue
            launchers += 1
            try:
                if entry.stat(follow_symlinks=False).st_size > MAX_LAUNCHER_BYTES:
                    continue
                if relocate_file(entry.path, old_pattern, new_root):
                    relocated += 1
            except OSError as exc:
                print(f'{LOG_PREFIX}skipped {entry.path}: {exc}')
    return relocated


def main():
    parser = argparse.ArgumentParser(description='Re-root the python path embedded in pip/uv launcher .exe files.')
    parser.add_argument('root', help='tree to scan (the new location)')
    parser.add_argument('old_root', help='old absolute root, e.g. D:\\.dev_win10')
    parser.add_argument('new_root', help='new absolute root, e.g. E:\\_win10_dev')
    parser.add_argument('--extra-old-root', action='append', default=[], help='further old root re-rooted in the same pass (repeatable)')
    args = parser.parse_args()
    old_roots = [root.rstrip('\\/') for root in [args.old_root] + args.extra_old_root if root.rstrip('\\/')]
    new_root = args.new_root.rstrip('\\/').encode('utf-8')
    alternatives = b'|'.join(re.escape(root.encode('utf-8')) for root in sorted(set(old_roots), key=len, reverse=True))
    old_pattern = re.compile(b'(?:' + alternatives + rb')(?=[\\/"\s]|$)', re.IGNORECASE)
    print(f'{RELOCATED_PREFIX}{relocate_tree(os.path.abspath(args.root), old_pattern, new_root)}')


if __name__ == '__main__':
    main()
