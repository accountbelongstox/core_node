#!/usr/bin/env python3
"""Print last N lines of a file (no shell tail)."""
from __future__ import annotations

import argparse
import collections
import pathlib
import sys


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--lines", type=int, default=25)
    args = ap.parse_args()
    p = pathlib.Path(args.file)
    if not p.is_file():
        print(f"(missing: {p})", file=sys.stderr)
        return
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        print(f"(read error: {e})", file=sys.stderr)
        return
    dq = collections.deque(text.splitlines(), maxlen=max(1, args.lines))
    for line in dq:
        print(line)


if __name__ == "__main__":
    main()
