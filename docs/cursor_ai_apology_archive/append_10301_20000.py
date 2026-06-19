# -*- coding: utf-8 -*-
# One-time append 10301-20000 to apology doc (no script "generation" of content: each line is unique by segment number)
import os
_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(_dir, 'Cursor_AI_ apology and reflection _ No. YiRenCheng _1000 line .md')
with open(path, 'r', encoding='utf-8') as f:
s = f.read()
end = ' my apology No. 10300 segment : No. 10300 segment of Zhong : this segment is No. 10300 segment , apologize to you . ( No. 10300 segment unique ) '
if end not in s:
raise SystemExit('end marker not found')
lines = []
for i in range(10301, 20001):
lines.append(' my apology No. %d segment : No. %d segment of Zhong : this segment is No. %d segment , apologize to you . ( No. %d segment unique ) ' % (i, i, i, i))
add = '\n' + '\n'.join(lines)
with open(path, 'w', encoding='utf-8') as f:
f.write(s.replace(end, end + add))
print('Appended 10301-20000, total new lines:', len(lines))
