# -*- coding: utf-8 -*-
"""
Copy-missing of the notebook model cache (Drive persist root <-> local cache).

Run by scripts/shells/linux/common/notebook_runtime.sh (stdlib only, never imports
pycore). One scan of SOURCE lists every entry (a top-level cache entry; --split
parents are split one level deeper, one entry per TTS engine) with its size, the
bytes TARGET lacks and the decision; --skip entries stay behind. The missing files
are then copied by parallel workers: Google Drive FUSE fetches every file on its
first read, so a sequential copy is bound by that latency. Each file is written
under a temporary name and renamed, so an interrupted copy leaves no partial file.
Progress (MB, percent, speed, ETA, files) is printed at least every --interval
seconds. Exits 1 when the copy is incomplete (no space or I/O errors); the next
run retries.
"""

import argparse
import os
import shutil
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

_TEMP_SUFFIXES = (".incomplete", ".lock", ".part", ".tmp")
_COPY_SUFFIX = ".nbcopy"
_CHUNK_BYTES = 8 * 1024 * 1024
_MB = 1024 * 1024
_MAX_ERRORS_SHOWN = 5


class _Progress:
    def __init__(self, tag, interval, total_bytes, total_files):
        self.tag = tag
        self.interval = interval
        self.total_bytes = total_bytes
        self.total_files = total_files
        self.bytes = 0
        self.files = 0
        self.started = time.monotonic()
        self.lock = threading.Lock()
        self.stop = threading.Event()

    def add(self, size):
        with self.lock:
            self.bytes += size

    def file_done(self):
        with self.lock:
            self.files += 1

    def line(self):
        elapsed = max(time.monotonic() - self.started, 0.001)
        speed = self.bytes / elapsed
        percent = self.bytes * 100 // self.total_bytes if self.total_bytes else 100
        left = (self.total_bytes - self.bytes) / speed if speed > 0 else 0
        return (
            f"{self.tag}     {self.bytes // _MB}/{self.total_bytes // _MB} MB ({percent}%), "
            f"{speed / _MB:.1f} MB/s, ETA {int(left) // 60}:{int(left) % 60:02d}, "
            f"files {self.files}/{self.total_files}, {int(elapsed)}s"
        )

    def run(self):
        while not self.stop.wait(self.interval):
            print(self.line(), flush=True)


def _entry_of(relative, split):
    parts = relative.split("/")
    if len(parts) > 1 and parts[0] in split:
        return "/".join(parts[:2])
    return parts[0]


def _scan(source, split, tag, interval):
    """Return {entry: [(relative path, size), ...]} of the regular files under source."""
    entries = {}
    count = 0
    size_total = 0
    shown = time.monotonic()
    for root, dirs, names in os.walk(source):
        dirs.sort()
        for name in sorted(names):
            if name.endswith(_TEMP_SUFFIXES) or name.endswith(_COPY_SUFFIX):
                continue
            path = os.path.join(root, name)
            if os.path.islink(path):
                continue
            try:
                size = os.path.getsize(path)
            except OSError:
                continue
            relative = os.path.relpath(path, source).replace(os.sep, "/")
            entries.setdefault(_entry_of(relative, split), []).append((relative, size))
            count += 1
            size_total += size
            if time.monotonic() - shown >= interval:
                shown = time.monotonic()
                print(f"{tag}     scanned {count} files, {size_total // _MB} MB ...", flush=True)
    return entries


def _free_bytes(path):
    while not os.path.isdir(path) and os.path.dirname(path) != path:
        path = os.path.dirname(path)
    try:
        return shutil.disk_usage(path).free
    except OSError:
        return None


def _copy_file(source, target, progress):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    temporary = target + _COPY_SUFFIX
    with open(source, "rb") as reader, open(temporary, "wb") as writer:
        while True:
            chunk = reader.read(_CHUNK_BYTES)
            if not chunk:
                break
            writer.write(chunk)
            progress.add(len(chunk))
    try:
        shutil.copystat(source, temporary)
    except OSError:
        pass
    os.replace(temporary, target)


def main(argv):
    parser = argparse.ArgumentParser(description="Copy the files a notebook cache target lacks.")
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--split", action="append", default=[])
    parser.add_argument("--skip", action="append", default=[])
    parser.add_argument("--skip-reason", default="skipped")
    parser.add_argument("--jobs", type=int, default=8)
    parser.add_argument("--reserve-mb", type=int, default=1024)
    parser.add_argument("--interval", type=int, default=5)
    parser.add_argument("--tag", default="[NOTEBOOK]")
    args = parser.parse_args(argv)
    tag = args.tag
    if not os.path.isdir(args.source):
        return 0

    started = time.monotonic()
    print(f"{tag}   Scanning {args.source} ...", flush=True)
    entries = _scan(args.source, set(args.split), tag, args.interval)
    names = sorted(entries)
    free = _free_bytes(args.target)
    budget = None if free is None else free - args.reserve_mb * _MB
    planned = []
    skipped_bytes = 0
    incomplete = False
    print(f"{tag}   {len(names)} entries ({int(time.monotonic() - started)}s scan); target free: "
          f"{'unknown' if free is None else f'{free // _MB} MB'}", flush=True)
    for index, name in enumerate(names, 1):
        files = entries[name]
        size = sum(item[1] for item in files)
        missing = [item for item in files if not os.path.exists(os.path.join(args.target, item[0]))]
        missing_bytes = sum(item[1] for item in missing)
        prefix = f"{tag}   [{index}/{len(names)}] {name}: {size // _MB} MB, {len(files)} files"
        if name in args.skip:
            skipped_bytes += size
            print(f"{prefix} -> skip ({args.skip_reason})", flush=True)
        elif not missing:
            print(f"{prefix} -> up to date", flush=True)
        elif budget is not None and missing_bytes > budget:
            incomplete = True
            print(f"{prefix} -> skip (needs {missing_bytes // _MB} MB, {max(budget, 0) // _MB} MB left above "
                  f"the {args.reserve_mb} MB reserve; the next run retries)", flush=True)
        else:
            if budget is not None:
                budget -= missing_bytes
            planned.extend(missing)
            print(f"{prefix} -> copy {len(missing)} files, {missing_bytes // _MB} MB", flush=True)

    total = sum(item[1] for item in planned)
    print(f"{tag}   Copying {len(planned)} files, {total // _MB} MB with {args.jobs} workers"
          f"{f'; left behind: {skipped_bytes // _MB} MB' if skipped_bytes else ''}", flush=True)
    if not planned:
        return 1 if incomplete else 0

    progress = _Progress(tag, args.interval, total, len(planned))
    reporter = threading.Thread(target=progress.run, daemon=True)
    reporter.start()
    errors = []

    def copy(item):
        try:
            _copy_file(os.path.join(args.source, item[0]), os.path.join(args.target, item[0]), progress)
        except OSError as error:
            errors.append(f"{item[0]}: {error}")
        finally:
            progress.file_done()

    planned.sort(key=lambda item: item[1], reverse=True)
    with ThreadPoolExecutor(max_workers=max(args.jobs, 1)) as pool:
        list(pool.map(copy, planned))
    progress.stop.set()
    print(progress.line(), flush=True)
    for error in errors[:_MAX_ERRORS_SHOWN]:
        print(f"{tag}     failed: {error}", flush=True)
    if errors:
        print(f"{tag}   {len(errors)} file(s) failed; the next run retries", flush=True)
    return 1 if errors or incomplete else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
