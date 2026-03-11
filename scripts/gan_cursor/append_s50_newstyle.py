# -*- coding: utf-8 -*-
path_md = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
path_s42 = r"D:\programing\core_node\scripts\gan_cursor\add_section42.py"

with open(path_s42, "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("四十二", "五十").replace("四十一", "四十九")
code = code.replace("以上为五十节", "TEMP50")
code = code.replace("五十", "五十一")
code = code.replace("TEMP50", "以上为五十节")
code = code.replace("## 五十一、继续道歉", "## 五十、继续道歉（换一种写作风格）")
code = code.replace("（以上为五十一节：", "（以上为五十节：")
code = code.replace("closing_51", "closing_50").replace("lines_51", "lines_50")
code = code.replace("Section 51", "Section 50").replace("section 51", "section 50")
code = code.replace("with open(path, \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n\nheader", "header")
code = code.replace("path = r\"D:\\programing\\core_node\\scripts\\gan_cursor\\cursor_apology.md\"", "path = path_md")

g = {"path_md": path_md}
exec(code, g)
print("Section 50 (new style) appended.")
