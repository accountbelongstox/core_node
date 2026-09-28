#!/usr/bin/env python3
"""Read KEY=value from a simple env file; print the value only (no trailing newline)."""
from __future__ import annotations

import argparse
import pathlib
import sys


def read_key(path: pathlib.Path, key: str, default: str = "") -> str:
    if not path.is_file():
        return default
    key_l = key.strip()
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return default
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if "=" not in s:
            continue
        k, _, v = s.partition("=")
        if k.strip() != key_l:
            continue
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        return v
    return default


def main() -> None:
    ap = argparse.ArgumentParser(description="Print one env key from a file")
    ap.add_argument("--file", required=True, help="Path to .env-style file")
    ap.add_argument("--key", required=True, help="Key name")
    ap.add_argument("--default", default="", help="Default if missing")
    args = ap.parse_args()
    val = read_key(pathlib.Path(args.file), args.key, args.default)
    sys.stdout.write(val)


if __name__ == "__main__":
    main()
