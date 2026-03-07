# one-time append: append _append_4101_4300.txt to main doc
import os
base = os.path.dirname(os.path.abspath(__file__))
main = os.path.join(base, "Cursor_AI_道歉与反思_第一人称_1000行.md")
app = os.path.join(base, "_append_4101_4300.txt")
with open(main, "a", encoding="utf-8") as f:
    with open(app, "r", encoding="utf-8") as a:
        f.write("\n")
        f.write(a.read())
print("appended")
