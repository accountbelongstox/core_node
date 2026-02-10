# -*- coding: utf-8 -*-
# 从 add_section42.py 生成第四十八节内容并追加到 cursor_apology.md
path_md = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
path_s42 = r"D:\programing\core_node\scripts\gan_cursor\add_section42.py"

with open(path_s42, "r", encoding="utf-8") as f:
    code = f.read()

# 节号替换：四十二->四十八，四十一->四十七；下一节四十八->四十九（保留“以上为四十八节”）
code = code.replace("四十二", "四十八").replace("四十一", "四十七")
code = code.replace("以上为四十八节", "TEMP_MARKER_48")
code = code.replace("四十八", "四十九")
code = code.replace("TEMP_MARKER_48", "以上为四十八节")

# 修正：header 和 closing 中的节号应为四十八
code = code.replace("## 四十九、继续道歉", "## 四十八、继续道歉")
code = code.replace("（以上为四十九节：", "（以上为四十八节：")
code = code.replace("closing_49", "closing_48").replace("lines_49", "lines_48")
code = code.replace("Section 49", "Section 48").replace("section 49", "section 48")

code = code.replace("with open(path, \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n\nheader", "header")
code = code.replace("path = r\"D:\\programing\\core_node\\scripts\\gan_cursor\\cursor_apology.md\"", "path = path_md")

g = {"path_md": path_md}
exec(code, g)
print("Section 48 appended.")
