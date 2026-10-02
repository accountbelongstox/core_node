# -*- coding: utf-8 -*-
"""Command-line reader of the pycore console journal (pycore_console.jsonl), for people and AI agents.

Reads the journal files written by console_log_journal.py without a running service:

    python -m pycore.pyfoundations.console_log_reader [--minutes 15] [--grep REGEX] [--level WARNING]
                                                      [--instance current|all] [--limit 200] [--summary]

--summary prints counts per log tag and level plus the newest line of every tag, which shows at a
glance whether the assist workers claim, generate and deliver.
"""

import argparse
import collections
import json
import re
import sys
import time
from pathlib import Path
from typing import Dict, Iterator, List

from pycore.pyfoundations.console_log_journal import CONSOLE_LOG_FILE_BACKUP_SUFFIX, CONSOLE_LOG_FILE_NAME
from pycore.pyfoundations.system_paths import get_app_logs_dir

LEVEL_ORDER = ("DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL")
TAG_PATTERN = re.compile(r"^\[([A-Za-z][\w.-]*)")
TIME_FORMAT = "%m-%d %H:%M:%S"
SUMMARY_MESSAGE_CHARS = 240
DEFAULT_LIMIT = 200


def _journal_files() -> List[Path]:
    current = Path(get_app_logs_dir()) / CONSOLE_LOG_FILE_NAME
    backup = current.with_name(CONSOLE_LOG_FILE_NAME + CONSOLE_LOG_FILE_BACKUP_SUFFIX)
    return [path for path in (backup, current) if path.is_file()]


def _entries() -> Iterator[Dict]:
    for path in _journal_files():
        with path.open(encoding="utf-8", errors="replace") as handle:
            for line in handle:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


def _level_rank(level: str) -> int:
    return LEVEL_ORDER.index(level) if level in LEVEL_ORDER else 0


def _format(entry: Dict) -> str:
    stamp = time.strftime(TIME_FORMAT, time.localtime(entry.get("ts", 0) / 1000))
    return f"{stamp} {entry.get('level', ''):<7} {entry.get('message', '')}"


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Read the pycore console journal.")
    parser.add_argument("--minutes", type=float, default=0, help="only entries of the last N minutes")
    parser.add_argument("--grep", default="", help="regular expression the message must match")
    parser.add_argument("--level", default="", help="minimum level (DEBUG, INFO, SUCCESS, WARNING, ERROR)")
    parser.add_argument("--instance", choices=("current", "all"), default="current",
                        help="current = the newest pycore process only")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="newest N matching lines")
    parser.add_argument("--summary", action="store_true", help="counts per tag/level and the newest line per tag")
    args = parser.parse_args(argv)

    files = _journal_files()
    if not files:
        print(f"No journal at {Path(get_app_logs_dir()) / CONSOLE_LOG_FILE_NAME}")
        return 1
    entries = list(_entries())
    if args.instance == "current" and entries:
        newest = entries[-1].get("instance_id")
        entries = [entry for entry in entries if entry.get("instance_id") == newest]
    if args.minutes > 0:
        since = (time.time() - args.minutes * 60) * 1000
        entries = [entry for entry in entries if entry.get("ts", 0) >= since]
    if args.level:
        minimum = _level_rank(args.level.upper())
        entries = [entry for entry in entries if _level_rank(entry.get("level", "")) >= minimum]
    if args.grep:
        pattern = re.compile(args.grep)
        entries = [entry for entry in entries if pattern.search(entry.get("message", ""))]

    print(f"# {', '.join(str(path) for path in files)}: {len(entries)} matching entries")
    if args.summary:
        tags: Dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
        newest_line: Dict[str, Dict] = {}
        for entry in entries:
            match = TAG_PATTERN.match(entry.get("message", ""))
            tag = match.group(1) if match else "-"
            tags[tag][entry.get("level", "")] += 1
            newest_line[tag] = entry
        for tag, levels in sorted(tags.items(), key=lambda item: -sum(item[1].values())):
            counts = " ".join(f"{level}={count}" for level, count in sorted(levels.items(), key=lambda item: _level_rank(item[0])))
            print(f"[{tag}] {counts}")
            print(f"    last: {_format(newest_line[tag])[:SUMMARY_MESSAGE_CHARS]}")
        return 0
    for entry in entries[-max(args.limit, 1):]:
        print(_format(entry))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
