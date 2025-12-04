import re
import sys
from collections import Counter

with open('PackageListPanel.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract template section
template_match = re.search(r'<template>(.*?)</template>', content, re.DOTALL)
if not template_match:
    print('No template section found')
    sys.exit(0)

template = template_match.group(1)

# Find all tags
opening_tags = re.findall(r'<(\w+)(?:\s[^>]*)?>(?!</)', template)
closing_tags = re.findall(r'</(\w+)>', template)
self_closing = re.findall(r'<(\w+)(?:\s[^>]*)?/>', template)

print(f'Opening tags: {len(opening_tags)}')
print(f'Closing tags: {len(closing_tags)}')
print(f'Self-closing tags: {len(self_closing)}')

# Check for balance
opening_count = Counter(opening_tags)
closing_count = Counter(closing_tags)

all_tags = set(opening_count.keys()) | set(closing_count.keys())
mismatched = []

for tag in all_tags:
    if opening_count[tag] != closing_count[tag]:
        mismatched.append((tag, opening_count[tag], closing_count[tag]))

if mismatched:
    print('\nMismatched tags:')
    for tag, open_count, close_count in sorted(mismatched):
        print(f'  {tag}: {open_count} opening, {close_count} closing (diff: {open_count - close_count})')
else:
    print('\nAll tags are balanced!')
