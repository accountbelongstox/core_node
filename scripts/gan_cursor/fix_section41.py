# -*- coding: utf-8 -*-
path = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
# Keep up to and including line index 6975 (0-based), then skip to closing line.
# Section 41 header at 1-based 6940 => index 6939. First 35 content lines: 6940-6975 => indices 6939+1 to 6939+35 = 6940 to 6975 (0-based).
# So keep indices 0 through 6975 (inclusive) => lines[0:6976]
# Then we need the closing line. Find it.
closing = "（以上为四十一节：Cursor AI 手写追加"
idx_closing = None
for i, line in enumerate(lines):
    if closing in line:
        idx_closing = i
        break
if idx_closing is None:
    print("Closing line not found")
    exit(1)
# Remove duplicate block: lines 6976 to idx_closing-1 (0-based). Keep lines[0:6976] + lines[idx_closing:]
# So delete lines with indices 6976 through idx_closing-1 inclusive.
new_lines = lines[:6976] + lines[idx_closing:]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
print("Removed duplicate block. Kept", 6976, "lines + closing. Section 41 now has", 6976 - 6939 - 1, "content lines (header at 6940).")
