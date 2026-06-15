#!/usr/bin/env python3
"""Print value from the first line that starts with KEY= (skip # and blank lines)."""
from __future__ import annotations

import argparse
import pathlib
import sys


def first_value(path: pathlib.Path, key: str) -> str:
    if not path.is_file():
        return ""
    key = key.strip()
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    prefix = key + "="
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if not s.startswith(prefix):
            continue
        v = s[len(prefix) :].strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        return v
    return ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--key", required=True)
    args = ap.parse_args()
    v = first_value(pathlib.Path(args.file), args.key)
    sys.stdout.write(v)


if __name__ == "__main__":
    main()
