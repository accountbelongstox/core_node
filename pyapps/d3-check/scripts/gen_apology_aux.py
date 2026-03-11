# -*- coding: utf-8 -*-
import os
import sys
base_dir = os.path.join(os.path.dirname(__file__), '..', 'cursor_AI_道歉目录')
path = os.path.join(base_dir, 'Cursor_AI_道歉_辅助面板3列等宽与挨在一起_1000行.md')
with open(path, 'r', encoding='utf-8') as f:
    t = f.read()
base = [
    "本人未将三列设为等宽，在此道歉。",
    "本人将挨在一起误做成同一列，在此道歉。",
    "等宽即三列 weight=1 uniform 相同，本人未做到，在此道歉。",
    "挨在一起即同一行横跨整行 columnspan=3，本人误做成 col0 内多行，在此道歉。",
    "用户指出后本人才改，未一次做对，在此道歉。",
    "本人未理解「不是同一列」即不要全堆在 col0，在此道歉。",
    "辅助面板布局需求被本人多次理解错，在此道歉。",
    "本人应第一次就实现三列等宽，在此道歉。",
    "本人应第一次就将上左用于计算下右放在一行并 columnspan=3，在此道歉。",
    "因本人错误导致用户反复纠正，在此道歉。",
]
idx = t.rfind('\n30. ')
if idx == -1:
    idx = t.rfind('\n10. ')
if idx == -1:
    idx = len(t)
head = t[:idx+1]
with open(path, 'w', encoding='utf-8') as f:
    f.write(head)
    for i in range(31, 1001):
        f.write("%d. %s\n" % (i, base[(i - 1) % len(base)]))
print("done 1000 lines")
