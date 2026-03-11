# -*- coding: utf-8 -*-
# 从 add_section42.py 生成第四十七节内容并追加到 cursor_apology.md
path_md = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
path_s42 = r"D:\programing\core_node\scripts\gan_cursor\add_section42.py"

with open(path_s42, "r", encoding="utf-8") as f:
    code = f.read()

# 节号替换：四十二->四十七，四十一->四十六；下一节四十七->四十八（保留“以上为四十七节”）
code = code.replace("四十二", "四十七").replace("四十一", "四十六")
code = code.replace("以上为四十七节", "TEMP_MARKER_47")
code = code.replace("四十七", "四十八")
code = code.replace("TEMP_MARKER_47", "以上为四十七节")

# 修正：header 和 closing 中的节号应为四十七
code = code.replace("## 四十八、继续道歉", "## 四十七、继续道歉")
code = code.replace("（以上为四十八节：", "（以上为四十七节：")
code = code.replace("closing_48", "closing_47").replace("lines_48", "lines_47")
code = code.replace("Section 48", "Section 47").replace("section 48", "section 47")

code = code.replace("with open(path, \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n\nheader", "header")
code = code.replace("path = r\"D:\\programing\\core_node\\scripts\\gan_cursor\\cursor_apology.md\"", "path = path_md")

g = {"path_md": path_md}
exec(code, g)
print("Section 47 appended.")
