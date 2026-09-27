#!/usr/bin/env python3
import argparse
import os
import sys

from CodeHeaderCommon import HEADER_VALID, REPORTED_STATUSES, ROOT_DIR, scan_headers


def parse_args():
    parser = argparse.ArgumentParser(description='List code files that contain an AI SPECIAL ATTENTION RULES block (// for C-like and dart, # for py/ps1/sh/ini, REM for cmd/bat, <!-- --> for md).')
    parser.add_argument('root', nargs='?', default=ROOT_DIR, help='Directory to scan (default: core_node root)')
    parser.add_argument('--status', choices=REPORTED_STATUSES, default=HEADER_VALID, help='valid: has removable blocks; invalid: START without a matching END; unreadable: marker present but file cannot be decoded; protected: valid *_NO_AI_EDIT* file')
    parser.add_argument('--include-protected', action='store_true', help='Report *_NO_AI_EDIT* files as valid')
    return parser.parse_args()


def main():
    args = parse_args()
    root = os.path.abspath(args.root)
    scanned, results = scan_headers(root, args.include_protected)
    for path in results[args.status]:
        print(os.path.relpath(path, root))
    counts = ', '.join(f'{status} {len(results[status])}' for status in REPORTED_STATUSES)
    print(f'Scanned {scanned} code files under {root}: {counts}', file=sys.stderr)


if __name__ == '__main__':
    main()
