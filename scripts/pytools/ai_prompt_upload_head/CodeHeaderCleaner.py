#!/usr/bin/env python3
import argparse
import os

from CodeHeaderCommon import (HEADER_INVALID, HEADER_PROTECTED, HEADER_UNREADABLE, HEADER_VALID, REPORTED_STATUSES,
                              ROOT_DIR, decode_lines, encode_lines, find_blocks, read_bytes, rule_for, scan_headers)

CLEAN_DONE = 'cleaned'
CLEAN_CHANGED = 'changed'
CLEAN_NONE = 'unchanged'
TEMPLATE_OPENERS = ('@"', "@'", '"""', "'''")

SKIP_LABELS = {
    HEADER_INVALID: 'Skipped malformed block',
    HEADER_UNREADABLE: 'Skipped undecodable file',
    HEADER_PROTECTED: 'Skipped protected file',
}


def parse_args():
    parser = argparse.ArgumentParser(description='Remove every AI SPECIAL ATTENTION RULES block (// for C-like and dart, # for py/ps1/sh/ini, REM for cmd/bat, <!-- --> for md).')
    parser.add_argument('root', nargs='?', default=ROOT_DIR, help='Directory to clean (default: core_node root)')
    parser.add_argument('--dry-run', action='store_true', help='Only list the files that would be cleaned')
    parser.add_argument('--yes', action='store_true', help='Skip the confirmation prompt')
    parser.add_argument('--include-protected', action='store_true', help='Also clean *_NO_AI_EDIT* files')
    return parser.parse_args()


def line_ending(line):
    return line[len(line.rstrip('\r\n')):]


def strip_block(lines, start, end):
    head_end = start
    tail_start = end + 1
    while head_end > 0 and not lines[head_end - 1].strip():
        head_end -= 1
    while tail_start < len(lines) and not lines[tail_start].strip():
        tail_start += 1
    head = lines[:head_end]
    tail = lines[tail_start:]
    blanks = lines[head_end:start] + lines[end + 1:tail_start]
    if head and tail and blanks and not head[-1].rstrip().endswith(TEMPLATE_OPENERS):
        ending = line_ending(head[-1]) or line_ending(blanks[0])
        if ending:
            head.append(ending)
    return head + tail


def clean_file(path):
    rule = rule_for(path)
    original = read_bytes(path)
    bom, encoding, lines = decode_lines(original)
    blocks = find_blocks(lines, rule)[0]
    if not blocks:
        return CLEAN_NONE
    for start, end in reversed(blocks):
        lines = strip_block(lines, start, end)
    content = encode_lines(bom, encoding, lines)
    if read_bytes(path) != original:
        return CLEAN_CHANGED
    with open(path, 'wb') as handle:
        handle.write(content)
    return CLEAN_DONE


def confirm(count):
    try:
        answer = input(f'Remove the rules blocks from {count} files? (y/N): ').strip().lower()
    except EOFError:
        return False
    return answer in ('y', 'yes')


def main():
    args = parse_args()
    root = os.path.abspath(args.root)
    cleaned = 0
    changed = []
    scanned, results = scan_headers(root, args.include_protected)
    valid = results[HEADER_VALID]

    for status, label in SKIP_LABELS.items():
        for path in results[status]:
            print(f'{label}: {os.path.relpath(path, root)}')
    counts = ', '.join(f'{status} {len(results[status])}' for status in REPORTED_STATUSES)
    print(f'Scanned {scanned} code files under {root}: {counts}')

    if args.dry_run:
        for path in valid:
            print(f'Would clean: {os.path.relpath(path, root)}')
        return
    if not valid or not (args.yes or confirm(len(valid))):
        print('Nothing cleaned.')
        return

    for path in valid:
        try:
            result = clean_file(path)
        except (OSError, UnicodeError) as error:
            print(f'Error cleaning {os.path.relpath(path, root)}: {error}')
            continue
        if result == CLEAN_DONE:
            cleaned += 1
            print(f'Cleaned: {os.path.relpath(path, root)}')
        elif result == CLEAN_CHANGED:
            changed.append(path)
            print(f'Skipped file changed during cleaning: {os.path.relpath(path, root)}')
    print(f'Cleaned {cleaned} of {len(valid)} files, skipped {len(changed)} changed during cleaning.')


if __name__ == '__main__':
    main()
