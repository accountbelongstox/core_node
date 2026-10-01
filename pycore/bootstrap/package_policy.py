# -*- coding: utf-8 -*-
"""
Installer package-set CLI (run as a file by platform installers):

    python <repo>/pycore/bootstrap/package_policy.py --platform linux [--set installer] [--no-optional] [--json]

Prerequisite phase is stdlib-only: pycore.pyfoundations.python_package_policy
imports nothing outside the standard library, so this runs before any
third-party package is installed.
"""

import argparse
import json
import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _REPO_ROOT)

import pycore.pyfoundations.python_package_policy as python_package_policy  # noqa: E402

_parser = argparse.ArgumentParser()
_parser.add_argument("--platform", choices=("linux", "windows"), required=True)
_parser.add_argument(
    "--set",
    choices=("installer", "prepare", "document", "ocr", "winrt"),
    default="installer",
)
_parser.add_argument("--no-optional", action="store_true")
_parser.add_argument("--json", action="store_true")
_args = _parser.parse_args()
_rows = list(python_package_policy.package_rows(_args.set, _args.platform, include_optional=not _args.no_optional))
if _args.json:
    print(json.dumps(_rows))
else:
    for _import_name, _pip_spec in _rows:
        print(f"{_import_name}\t{_pip_spec}")
