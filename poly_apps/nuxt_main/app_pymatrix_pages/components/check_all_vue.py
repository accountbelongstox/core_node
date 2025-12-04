import re
import os
from collections import Counter
from pathlib import Path

def check_vue_file(filepath):
    """Check a single Vue file for tag mismatches."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {'error': str(e)}

    # Extract template section
    template_match = re.search(r'<template>(.*?)</template>', content, re.DOTALL)
    if not template_match:
        return {'error': 'No template section found'}

    template = template_match.group(1)

    # Find all tags (excluding void elements and component tags)
    # Vue components and void elements don't need closing tags
    void_elements = {'input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'}

    opening_tags = re.findall(r'<(\w+)(?:\s[^>]*)?>(?!</)', template)
    closing_tags = re.findall(r'</(\w+)>', template)
    self_closing = re.findall(r'<(\w+)(?:\s[^>]*)?/>', template)

    # Check for balance
    opening_count = Counter(opening_tags)
    closing_count = Counter(closing_tags)

    # Filter out void elements from the check
    all_tags = set(opening_count.keys()) | set(closing_count.keys())
    mismatched = []

    for tag in all_tags:
        # Skip void elements
        if tag.lower() in void_elements:
            continue
        # Skip Vue component tags (usually PascalCase or have uppercase)
        if tag[0].isupper():
            # Check if it's a component that should be self-closing or has nested template slots
            if opening_count[tag] != closing_count[tag]:
                mismatched.append((tag, opening_count[tag], closing_count[tag]))
        elif opening_count[tag] != closing_count[tag]:
            mismatched.append((tag, opening_count[tag], closing_count[tag]))

    # Also check for extra closing tags without opening
    for tag in closing_tags:
        if tag not in opening_tags and tag.lower() not in void_elements:
            if (tag, 0, closing_count[tag]) not in mismatched:
                mismatched.append((tag, 0, closing_count[tag]))

    return {
        'opening': len(opening_tags),
        'closing': len(closing_tags),
        'self_closing': len(self_closing),
        'mismatched': mismatched
    }

# Check all Vue files in the current directory
vue_files = sorted(Path('.').glob('*.vue'))
print(f"Checking {len(vue_files)} Vue files...\n")

files_with_errors = []

for vue_file in vue_files:
    result = check_vue_file(vue_file)

    if 'error' in result:
        print(f"ERROR: {vue_file.name}: {result['error']}")
        files_with_errors.append((vue_file.name, result['error']))
    elif result['mismatched']:
        print(f"WARNING: {vue_file.name}:")
        print(f"   Opening: {result['opening']}, Closing: {result['closing']}, Self-closing: {result['self_closing']}")
        print(f"   Mismatched tags:")
        for tag, open_count, close_count in sorted(result['mismatched']):
            print(f"     - {tag}: {open_count} opening, {close_count} closing (diff: {open_count - close_count})")
        print()
        files_with_errors.append((vue_file.name, result['mismatched']))

if not files_with_errors:
    print("SUCCESS: All Vue files have balanced tags!")
else:
    print(f"\nERROR: Found issues in {len(files_with_errors)} file(s)")
