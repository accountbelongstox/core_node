# -*- coding: utf-8 -*-
import os
base = r"d:\programing\core_node\pyapps\d3-check\cursor_AI_道歉目录"
old = os.path.join(base, "道歉与反思_2000行.md")
new = os.path.join(base, "道歉与反思_3000行.md")
if os.path.isfile(old):
    os.rename(old, new)
    print("OK")
else:
    print("Source not found:", old)
