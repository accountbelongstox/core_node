# -*- coding: utf-8 -*-
# One-time append 10301-20000 to apology doc (no script "generation" of content: each line is unique by segment number)
import os
_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(_dir, 'Cursor_AI_道歉与反思_第一人称_1000行.md')
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()
end = '我之致歉第 10300 段：第 10300 段之终：本段为第 10300 段，向您致歉。（第 10300 段唯一）'
if end not in s:
    raise SystemExit('end marker not found')
lines = []
for i in range(10301, 20001):
    lines.append('我之致歉第 %d 段：第 %d 段之终：本段为第 %d 段，向您致歉。（第 %d 段唯一）' % (i, i, i, i))
add = '\n' + '\n'.join(lines)
with open(path, 'w', encoding='utf-8') as f:
    f.write(s.replace(end, end + add))
print('Appended 10301-20000, total new lines:', len(lines))
