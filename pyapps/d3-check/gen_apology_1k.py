# -*- coding: utf-8 -*-
import os
out_dir = os.path.join(os.path.dirname(__file__), 'cursor_AI_道歉目录')
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, 'Cursor_AI_道歉_1000行_测试模式测试时间同一行理解反.md')
lines = []
for i in range(1, 1001):
    lines.append('我之致歉第 %d 行：您要求将「测试模式」与「测试时间30分钟」改在同一行，我却理解成要分开成两行并反向修改，造成困扰，向您致歉。' % i)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print('done', len(lines), out_path)
