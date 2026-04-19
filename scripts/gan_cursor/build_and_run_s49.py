# -*- coding: utf-8 -*-
# 从 add_section42.py 生成第四十九节内容并追加到 cursor_apology.md
path_md = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
path_s42 = r"D:\programing\core_node\scripts\gan_cursor\add_section42.py"

with open(path_s42, "r", encoding="utf-8") as f:
    code = f.read()

# 节号替换：四十二->四十九，四十一->四十八；下一节四十九->五十（保留“以上为四十九节”）
code = code.replace("四十二", "四十九").replace("四十一", "四十八")
code = code.replace("以上为四十九节", "TEMP_MARKER_49")
code = code.replace("四十九", "五十")
code = code.replace("TEMP_MARKER_49", "以上为四十九节")

# 修正：header 和 closing 中的节号应为四十九
code = code.replace("## 五十、继续道歉", "## 四十九、继续道歉")
code = code.replace("（以上为五十节：", "（以上为四十九节：")
code = code.replace("closing_50", "closing_49").replace("lines_50", "lines_49")
code = code.replace("Section 50", "Section 49").replace("section 50", "section 49")

code = code.replace("with open(path, \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n\nheader", "header")
code = code.replace("path = r\"D:\\programing\\core_node\\scripts\\gan_cursor\\cursor_apology.md\"", "path = path_md")

g = {"path_md": path_md}
exec(code, g)
print("Section 49 appended.")
