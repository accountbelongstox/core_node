#!/usr/bin/env python3
import argparse
import os
import sys

from CodeHeaderCommon import HEADER_INVALID, HEADER_VALID, ROOT_DIR, scan_headers


def parse_args():
    parser = argparse.ArgumentParser(description='List code files that start with a // AI SPECIAL ATTENTION RULES block.')
    parser.add_argument('root', nargs='?', default=ROOT_DIR, help='Directory to scan (default: core_node root)')
    parser.add_argument('--invalid', action='store_true', help='List files whose leading rules block is malformed instead')
    return parser.parse_args()


def main():
    args = parse_args()
    root = os.path.abspath(args.root)
    status = HEADER_INVALID if args.invalid else HEADER_VALID
    scanned, results = scan_headers(root)
    for path in results[status]:
        print(os.path.relpath(path, root))
    print(f'{status}: {len(results[status])} of {scanned} code files under {root}', file=sys.stderr)


if __name__ == '__main__':
    main()
