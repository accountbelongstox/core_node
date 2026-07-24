#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_deps.py

Helper used by extract_audio.ps1 to detect which pip packages are required for
the requested features and which of them are missing. The launcher consumes the
default (missing-only) output and pip-installs whatever is reported.

This file is the single source of truth for the package list (no requirements.txt
is used for installation).

Usage:
    # print missing pip package names, one per line (for the launcher to install):
    python check_deps.py --feature naming --feature subtitle [--gpu-package <spec>]

    # human-readable status of every required package:
    python check_deps.py --feature naming --feature subtitle [--gpu-package <spec>] --report

Detection is by installed DISTRIBUTION name (importlib.metadata), which is
reliable even for packages whose import name differs from the pip name and for
GPU runtime libs that have no simple import.
"""

import argparse
import sys

try:
    from importlib.metadata import version, PackageNotFoundError
except ImportError:                       # pragma: no cover (Python < 3.8)
    from importlib_metadata import version, PackageNotFoundError  # type: ignore
try:
    from packaging.requirements import Requirement
except ImportError:                       # pip always vendors packaging
    from pip._vendor.packaging.requirements import Requirement


# Feature -> required pip package names. The canonical install list lives here.
FEATURES = {
    "naming":    ["Unidecode"],            # transliteration (zh/ja/... -> ASCII)
    "translate": ["deep-translator"],      # optional online translation of names
    "subtitle":  ["faster-whisper"],       # speech-to-text -> .srt
}

def is_installed(spec):
    """Return whether an installed distribution satisfies a requirement spec."""
    requirement = Requirement(spec)
    try:
        installed = version(requirement.name)
        return not requirement.specifier or requirement.specifier.contains(
            installed, prereleases=True
        )
    except PackageNotFoundError:
        return False
    except Exception:
        return False


def required_packages(features, gpu_packages, extras):
    """Build the de-duplicated, order-preserving list of required pip names."""
    names = []
    for feat in features:
        names.extend(FEATURES.get(feat, []))
    names.extend(gpu_packages)
    names.extend(extras)

    seen, ordered = set(), []
    for name in names:
        key = name.lower()
        if key not in seen:
            seen.add(key)
            ordered.append(name)
    return ordered


def main():
    parser = argparse.ArgumentParser(
        description="Detect required pip packages for the video tool features.")
    parser.add_argument("--feature", action="append", default=[],
                        choices=sorted(FEATURES.keys()),
                        help="Feature group(s) whose packages are required.")
    parser.add_argument("--gpu-package", action="append", default=[],
                        help="Canonical GPU requirement supplied by the launcher.")
    parser.add_argument("--extra", action="append", default=[],
                        help="Extra pip package name(s) to check.")
    parser.add_argument("--report", action="store_true",
                        help="Print human-readable status of every required package.")
    args = parser.parse_args()

    req = required_packages(args.feature, args.gpu_package, args.extra)

    if args.report:
        for pkg in req:
            print("  %-22s %s" % (pkg, "OK" if is_installed(pkg) else "MISSING"))
        return 0

    # Default mode: print only the missing names (one per line) for the launcher.
    for pkg in req:
        if not is_installed(pkg):
            print(pkg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
