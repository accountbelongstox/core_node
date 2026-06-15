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
    python check_deps.py --feature naming --feature subtitle [--gpu]

    # human-readable status of every required package:
    python check_deps.py --feature naming --feature subtitle [--gpu] --report

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


# Feature -> required pip package names. The canonical install list lives here.
FEATURES = {
    "naming":    ["Unidecode"],            # transliteration (zh/ja/... -> ASCII)
    "translate": ["deep-translator"],      # optional online translation of names
    "subtitle":  ["faster-whisper"],       # speech-to-text -> .srt
}

# NVIDIA runtime libs needed for GPU (CUDA 12 / cuDNN 9) whisper inference.
GPU_LIBS = ["nvidia-cublas-cu12", "nvidia-cudnn-cu12"]


def is_installed(pkg):
    """True if a distribution named `pkg` is installed (name-normalized)."""
    try:
        version(pkg)
        return True
    except PackageNotFoundError:
        return False
    except Exception:
        return False


def required_packages(features, gpu, extras):
    """Build the de-duplicated, order-preserving list of required pip names."""
    names = []
    for feat in features:
        names.extend(FEATURES.get(feat, []))
    if gpu:
        names.extend(GPU_LIBS)
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
    parser.add_argument("--gpu", action="store_true",
                        help="Also require NVIDIA GPU runtime libs.")
    parser.add_argument("--extra", action="append", default=[],
                        help="Extra pip package name(s) to check.")
    parser.add_argument("--report", action="store_true",
                        help="Print human-readable status of every required package.")
    args = parser.parse_args()

    req = required_packages(args.feature, args.gpu, args.extra)

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
