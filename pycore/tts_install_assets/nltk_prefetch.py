#!/usr/bin/env python3
"""Install NLTK data resources into one data dir (shell installers only).

Each spec is ``<package id>=<nltk.data.find path>``. A resource that is still
not found after its download (nltk.download returns False instead of raising)
fails the run with a non-zero exit.
"""
from __future__ import annotations

import argparse
import os
import sys

import nltk


def _found(path: str) -> bool:
    try:
        nltk.data.find(path)
    except LookupError:
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True)
    parser.add_argument("specs", nargs="+")
    args = parser.parse_args()

    os.makedirs(args.dir, exist_ok=True)
    nltk.data.path.insert(0, args.dir)
    failed = []
    for spec in args.specs:
        package, _, path = spec.partition("=")
        if not package or not path:
            parser.error(f"bad spec {spec!r}; expected <package>=<find path>")
        if _found(path):
            print(f"[nltk-prefetch] cached {package}", flush=True)
            continue
        print(f"[nltk-prefetch] downloading {package} -> {args.dir}", flush=True)
        if not nltk.download(package, download_dir=args.dir) or not _found(path):
            failed.append(package)
    for package in failed:
        print(f"[nltk-prefetch] FAILED {package}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
