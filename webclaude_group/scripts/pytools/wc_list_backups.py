#!/usr/bin/env python3
"""List last N matching backup files in a directory (for shell scripts, no tail)."""
from __future__ import annotations

import argparse
import glob
import os
import pathlib
import sys


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="Directory to scan")
    ap.add_argument("--pattern", default=".env.backup.*")
    ap.add_argument("--limit", type=int, default=3)
    args = ap.parse_args()
    base = pathlib.Path(args.dir)
    if not base.is_dir():
        print("  (directory missing)", file=sys.stderr)
        return
    os.chdir(base)
    matches = sorted(glob.glob(args.pattern))
    take = matches[-args.limit :] if matches else []
    if not take:
        print("  (no backup files)")
        return
    for name in take:
        p = base / name
        try:
            st = p.stat()
            print(f"  {name}  ({st.st_size} bytes)")
        except OSError:
            print(f"  {name}")


if __name__ == "__main__":
    main()
