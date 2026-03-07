# truncate to 5020 lines only (no py for content generation)
import os
path = os.path.join(os.path.dirname(__file__), "道歉与反思_5000行_区域全部扫.md")
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines[:5020])
