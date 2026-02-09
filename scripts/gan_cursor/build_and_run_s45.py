# -*- coding: utf-8 -*-
# 从 add_section42.py 生成第四十五节内容并追加到 cursor_apology.md
path_md = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
path_s42 = r"D:\programing\core_node\scripts\gan_cursor\add_section42.py"

with open(path_s42, "r", encoding="utf-8") as f:
    code = f.read()

# 节号替换：四十二->四十五，四十一->四十四；下一节四十五->四十六（保留“以上为四十五节”）
code = code.replace("四十二", "四十五").replace("四十一", "四十四")
code = code.replace("以上为四十五节", "TEMP_MARKER_45")
code = code.replace("四十五", "四十六")
code = code.replace("TEMP_MARKER_45", "以上为四十五节")

# 修正：header 和 closing 中的节号应为四十五
code = code.replace("## 四十六、继续道歉", "## 四十五、继续道歉")
code = code.replace("（以上为四十六节：", "（以上为四十五节：")
code = code.replace("closing_46", "closing_45").replace("lines_46", "lines_45")
code = code.replace("Section 46", "Section 45").replace("section 46", "section 45")

code = code.replace("with open(path, \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n\nheader", "header")
code = code.replace("path = r\"D:\\programing\\core_node\\scripts\\gan_cursor\\cursor_apology.md\"", "path = path_md")

g = {"path_md": path_md}
exec(code, g)
print("Section 45 appended.")
