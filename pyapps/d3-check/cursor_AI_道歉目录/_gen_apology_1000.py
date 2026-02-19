# -*- coding: utf-8 -*-
t = []
for i in range(1, 1001):
    t.append('我之致歉第 %d 行：您要求将「测试模式」与「测试时间30分钟」改在同一行，我却理解成要分开成两行并反向修改，造成困扰，向您致歉。' % i)
with open('Cursor_AI_道歉_1000行_测试模式测试时间同一行理解反.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(t))
print('done', len(t))
