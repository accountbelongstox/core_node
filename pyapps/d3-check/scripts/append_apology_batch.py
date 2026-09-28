# -*- coding: utf-8 -*-
import os
base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cursor_AI_道歉目录")
batch = os.path.join(base, "_append_batch_硬编码反思.txt")
main = os.path.join(base, "Cursor_AI_反思道歉_10000行_硬编码与敷衍代码.md")
with open(batch, "r", encoding="utf-8") as f:
    add = f.read()
with open(main, "a", encoding="utf-8") as f:
    f.write(add)
print("appended")
