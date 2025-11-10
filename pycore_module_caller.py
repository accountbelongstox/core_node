#!/usr/bin/env python3
"""PyCore Module Caller

Ensures project-root imports (pycore package) work from any current directory.

Usage examples:
    python pycore_module_caller.py --module pyfoundations.secret_manager --call get_secret_key KEY_NAME
    python pycore_module_caller.py --module some.module --call main arg1 key=value
    python pycore_module_caller.py --module some.module --run
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import runpy
import sys
from pathlib import Path
from typing import Any, Dict, List


PROJECT_ROOT = Path(__file__).resolve().parent
PYCORE_PATH = PROJECT_ROOT / 'pycore'

# Skip heavy dependency checks unless explicitly requested
os.environ.setdefault('PYCORE_SKIP_DEP_CHECK', '1')

# Ensure project root + pycore are on sys.path
for path in (PROJECT_ROOT, PYCORE_PATH):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


def parse_kwargs(values: List[str]) -> Dict[str, Any]:
    kwargs: Dict[str, Any] = {}
    for item in values:
        if '=' not in item:
            continue
        key, value = item.split('=', 1)
        kwargs[key] = value
    return kwargs


def main() -> int:
    parser = argparse.ArgumentParser(description='PyCore module caller')
    parser.add_argument('--module', required=True, help='Module to import/run')
    parser.add_argument('--call', help='Callable attribute within the module to invoke')
    parser.add_argument('--json', action='store_true', help='Serialize callable result as JSON')
    parser.add_argument('--run-main', action='store_true', help='Run the module (runpy) instead of calling attr')
    parser.add_argument('params', nargs='*', help='Positional args for callable (key=value for kwargs)')

    args = parser.parse_args()

    if args.run_main and args.call:
        parser.error('Use either --call or --run-main, not both')

    if args.run_main:
        runpy.run_module(args.module, run_name='__main__')
        return 0

    module = importlib.import_module(args.module)

    if not args.call:
        if hasattr(module, 'main') and callable(module.main):
            result = module.main(*args.params)
        else:
            parser.error('Specify --call for callable invocation or use --run-main')
    else:
        func = getattr(module, args.call)
        if not callable(func):
            parser.error(f"Attribute '{args.call}' is not callable")

        positional = [p for p in args.params if '=' not in p]
        kwargs = parse_kwargs(args.params)
        result = func(*positional, **kwargs)

    if result is not None:
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(result)

    return 0


if __name__ == '__main__':
    sys.exit(main())
