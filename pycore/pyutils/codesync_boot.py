# -*- coding: utf-8 -*-
"""
Standalone bootstrap for the lightweight Code Sync library.

Run AS A FILE (not `python -m ...`):

    python <repo>/pycore/pyutils/codesync_boot.py <args...>

Because it is run as a file, sys.path[0] becomes this file's directory
(<repo>/pycore/pyutils), so `import codesync` resolves the package as a
TOP-LEVEL name — which means pycore/__init__.py and pycore/pyutils/__init__.py
are NEVER executed. The result: no `third_party`, no CUDA/database init, no heavy
pycore import; only the Python standard library is loaded.

This is the entry point used by `pyservice.sh codesync` / `pyservice.ps1 codesync`.
It must stay stdlib-only and must never `import pycore`.
"""

import os
import sys

# Make `codesync` importable as a top-level package (defensive; running this file
# directly already puts this dir on sys.path[0]).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import codesync  # noqa: E402  (top-level name; does NOT trigger pycore/__init__.py)

if __name__ == "__main__":
    raise SystemExit(codesync.cli.main(sys.argv[1:]))
