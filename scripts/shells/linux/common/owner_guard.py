#!/usr/bin/env python3
"""Root-owned handback watcher: entries created by root inside the watched roots
(repo + pycore data dir) are handed back to the real user through the central
policy in fs_perm_helpers.sh (repair_owned_tree_777 +
resolve_active_permission_owner). Hot reload: the policy is re-sourced for every
batch, and a saved, compiling copy of this file re-execs the process.
Stdlib only, Linux inotify."""

import argparse
import ctypes
import ctypes.util
import errno
import os
import py_compile
import select
import struct
import subprocess
import sys
import time

IN_ATTRIB = 0x00000004
IN_CLOSE_WRITE = 0x00000008
IN_MOVED_TO = 0x00000080
IN_CREATE = 0x00000100
IN_Q_OVERFLOW = 0x00004000
IN_IGNORED = 0x00008000
IN_ISDIR = 0x40000000
IN_NONBLOCK = 0o4000
IN_CLOEXEC = 0o2000000
WATCH_MASK = IN_CREATE | IN_MOVED_TO | IN_CLOSE_WRITE | IN_ATTRIB
EVENT_HEADER = struct.Struct("iIII")
READ_SIZE = 65536
DEBOUNCE_SECONDS = 1.0
MAX_BATCH_WAIT_SECONDS = 5.0
FULL_SWEEP_INTERVAL_SECONDS = 1800
IDLE_POLL_SECONDS = 30.0
NICE_LEVEL = 19
IONICE_CLASS_ARGS = ["ionice", "-c3"]
EXCLUDED_DIR_NAMES = frozenset(["node_modules", ".gradle", "dist", "__pycache__", ".venv", "vendor"])
EXCLUDED_CHILD_OF = {"build": "android"}
POLICY_RELATIVE = "fs_perm_helpers.sh"
POLICY_ARRAYS = ("FS_PERM_PRIVATE_TREE_NAMES", "FS_PERM_APP_SECRET_TREE_NAMES")
POLICY_SCALARS = ("FS_PERM_GIT_TREE_NAME",)
REPAIR_SCRIPT = (
    'source "$1" >/dev/null; shift; '
    'resolve_active_permission_owner >/dev/null; '
    'for p; do repair_owned_tree_777 "$p" "$ACTIVE_PERMISSION_USER" "$ACTIVE_PERMISSION_GROUP"; done'
)
LOG_KEEP_MARKERS = ("Repairing", "Refusing", "Unable", "Partially")

libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)
self_file = os.path.realpath(__file__)
policy_file = os.path.join(os.path.dirname(self_file), POLICY_RELATIVE)
protected_names = frozenset()
watches = {}


def log(message):
    print("[owner_guard] " + message, flush=True)


def load_protected_names():
    expr = " ".join('printf "%s\\n" "${%s[@]}";' % (name, name) for name in POLICY_ARRAYS)
    expr += " ".join(' printf "%%s\\n" "$%s";' % name for name in POLICY_SCALARS)
    result = subprocess.run(["bash", "-c", 'source "$1" >/dev/null; ' + expr, "_", policy_file],
                            capture_output=True, text=True, check=True)
    return frozenset(line for line in result.stdout.splitlines() if line)


def is_excluded(directory, name):
    if name in EXCLUDED_DIR_NAMES:
        return True
    return EXCLUDED_CHILD_OF.get(name) == os.path.basename(directory)


def add_watch(fd, path):
    wd = libc.inotify_add_watch(fd, path.encode(), WATCH_MASK)
    if wd < 0:
        err = ctypes.get_errno()
        if err == errno.ENOSPC:
            log("inotify watch limit reached at %s; the periodic sweep still covers it" % path)
        return False
    watches[wd] = path
    return True


def watch_tree(fd, top):
    added = 0
    top_dev = os.lstat(top).st_dev
    for current, dirs, _files in os.walk(top):
        dirs[:] = [d for d in dirs if not is_excluded(current, d)
                   and not os.path.islink(os.path.join(current, d))
                   and os.lstat(os.path.join(current, d)).st_dev == top_dev]
        if add_watch(fd, current):
            added += 1
    return added


def guard_root_of(path):
    parts = path.split(os.sep)
    for index, part in enumerate(parts):
        if part in protected_names:
            return os.sep.join(parts[:index + 1])
    return path


def is_root_owned(path):
    try:
        return os.lstat(path).st_uid == 0
    except OSError:
        return False


def collapse(paths):
    kept = []
    for path in sorted(paths):
        if kept and (path == kept[-1] or path.startswith(kept[-1] + os.sep)):
            continue
        kept.append(path)
    return kept


def run_policy(paths):
    command = IONICE_CLASS_ARGS + ["bash", "-c", REPAIR_SCRIPT, "_", policy_file] + paths
    result = subprocess.run(command, capture_output=True, text=True)
    for line in result.stdout.splitlines():
        if any(marker in line for marker in LOG_KEEP_MARKERS):
            log(line)
    for line in result.stderr.splitlines():
        log("stderr: " + line)


def full_sweep(roots, reason):
    log("full sweep (%s): %s" % (reason, " ".join(roots)))
    run_policy(roots)


def reload_self():
    try:
        py_compile.compile(self_file, doraise=True)
    except py_compile.PyCompileError as error:
        log("hot reload skipped, source does not compile: %s" % error.msg.strip().splitlines()[-1])
        return
    log("hot reload: %s changed, re-executing" % self_file)
    os.execv(sys.executable, [sys.executable, self_file] + sys.argv[1:])


def handle_events(fd, pending):
    overflow = False
    try:
        data = os.read(fd, READ_SIZE)
    except BlockingIOError:
        return overflow
    offset = 0
    while offset < len(data):
        wd, mask, _cookie, length = EVENT_HEADER.unpack_from(data, offset)
        name = data[offset + EVENT_HEADER.size:offset + EVENT_HEADER.size + length].split(b"\0", 1)[0].decode(errors="surrogateescape")
        offset += EVENT_HEADER.size + length
        if mask & IN_Q_OVERFLOW:
            overflow = True
            continue
        if mask & IN_IGNORED:
            watches.pop(wd, None)
            continue
        directory = watches.get(wd)
        if directory is None or not name:
            continue
        path = os.path.join(directory, name)
        if path == self_file and mask & (IN_CLOSE_WRITE | IN_MOVED_TO):
            reload_self()
        if mask & IN_ISDIR and mask & (IN_CREATE | IN_MOVED_TO):
            if is_excluded(directory, name):
                continue
            watch_tree(fd, path)
        elif is_excluded(directory, name):
            continue
        if is_root_owned(path):
            pending.add(guard_root_of(path))
    return overflow


def main():
    global protected_names
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, nargs="+")
    args = parser.parse_args()
    roots = collapse(os.path.realpath(root) for root in args.root if os.path.isdir(root))
    try:
        os.nice(NICE_LEVEL)
    except OSError:
        pass
    protected_names = load_protected_names()
    fd = libc.inotify_init1(IN_NONBLOCK | IN_CLOEXEC)
    if fd < 0:
        log("inotify_init1 failed: " + os.strerror(ctypes.get_errno()))
        return 1
    for root in roots:
        log("watching %d directories under %s" % (watch_tree(fd, root), root))
    if os.path.dirname(self_file) not in watches.values():
        add_watch(fd, os.path.dirname(self_file))
    full_sweep(roots, "start")
    last_sweep = time.monotonic()
    pending = set()
    first_event = 0.0
    last_event = 0.0
    while True:
        timeout = DEBOUNCE_SECONDS if pending else IDLE_POLL_SECONDS
        ready, _, _ = select.select([fd], [], [], timeout)
        now = time.monotonic()
        if ready:
            overflow = handle_events(fd, pending)
            if pending and not first_event:
                first_event = now
            last_event = now
            if overflow:
                pending.clear()
                first_event = 0.0
                full_sweep(roots, "event queue overflow")
                last_sweep = time.monotonic()
                continue
            if pending and now - first_event < MAX_BATCH_WAIT_SECONDS:
                continue
        if pending and (now - last_event >= DEBOUNCE_SECONDS or now - first_event >= MAX_BATCH_WAIT_SECONDS):
            batch = collapse([p for p in pending if is_root_owned(p)])
            pending.clear()
            first_event = 0.0
            if batch:
                log("handing back %d root-owned path(s)" % len(batch))
                run_policy(batch)
        if time.monotonic() - last_sweep >= FULL_SWEEP_INTERVAL_SECONDS:
            full_sweep(roots, "periodic")
            last_sweep = time.monotonic()


if __name__ == "__main__":
    sys.exit(main())
