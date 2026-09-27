#!/usr/bin/env python3
import argparse
import os

from CodeHeaderCommon import BOM, HEADER_INVALID, HEADER_VALID, ROOT_DIR, find_header, read_lines, scan_headers


def parse_args():
    parser = argparse.ArgumentParser(description='Remove the leading // AI SPECIAL ATTENTION RULES block from code files.')
    parser.add_argument('root', nargs='?', default=ROOT_DIR, help='Directory to clean (default: core_node root)')
    parser.add_argument('--dry-run', action='store_true', help='Only list the files that would be cleaned')
    parser.add_argument('--yes', action='store_true', help='Skip the confirmation prompt')
    return parser.parse_args()


def line_ending(line):
    return line[len(line.rstrip('\r\n')):]


def strip_header(lines, start, end):
    head = lines[:start]
    tail_start = end + 1
    blank = None
    while head and not head[-1].strip():
        blank = head.pop()
    while tail_start < len(lines) and not lines[tail_start].strip():
        blank = blank or lines[tail_start]
        tail_start += 1
    tail = lines[tail_start:]
    if head and tail and blank and line_ending(blank):
        head.append(line_ending(blank))
    return head + tail


def clean_file(path):
    has_bom, lines = read_lines(path)
    status, start, end = find_header(lines)
    if status != HEADER_VALID:
        return False
    content = ''.join(strip_header(lines, start, end))
    with open(path, 'w', encoding='utf-8', newline='') as handle:
        handle.write(BOM + content if has_bom else content)
    return True


def confirm(count):
    try:
        answer = input(f'Remove the rules block from {count} files? (y/N): ').strip().lower()
    except EOFError:
        return False
    return answer in ('y', 'yes')


def main():
    args = parse_args()
    root = os.path.abspath(args.root)
    cleaned = 0
    scanned, results = scan_headers(root)
    valid = results[HEADER_VALID]
    invalid = results[HEADER_INVALID]

    for path in invalid:
        print(f'Skipped malformed block: {os.path.relpath(path, root)}')
    print(f'Scanned {scanned} code files under {root}: {len(valid)} valid, {len(invalid)} malformed')

    if args.dry_run:
        for path in valid:
            print(f'Would clean: {os.path.relpath(path, root)}')
        return
    if not valid or not (args.yes or confirm(len(valid))):
        print('Nothing cleaned.')
        return

    for path in valid:
        try:
            if clean_file(path):
                cleaned += 1
                print(f'Cleaned: {os.path.relpath(path, root)}')
        except (OSError, UnicodeDecodeError) as error:
            print(f'Error cleaning {os.path.relpath(path, root)}: {error}')
    print(f'Cleaned {cleaned} of {len(valid)} files.')


if __name__ == '__main__':
    main()
