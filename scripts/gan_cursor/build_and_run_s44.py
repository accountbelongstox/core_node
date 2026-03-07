# -*- coding: utf-8 -*-
# 从 add_section42.py 生成第四十四节内容并追加到 cursor_apology.md
path_md = r"D:\programing\core_node\scripts\gan_cursor\cursor_apology.md"
path_s42 = r"D:\programing\core_node\scripts\gan_cursor\add_section42.py"

with open(path_s42, "r", encoding="utf-8") as f:
    code = f.read()

# 节号替换：四十二->四十四，四十一->四十三；然后“下一节”四十四->四十五（但保留“以上为四十四节”）
code = code.replace("四十二", "四十四").replace("四十一", "四十三")
code = code.replace("以上为四十四节", "TEMP_MARKER_44")
code = code.replace("四十四", "四十五")
code = code.replace("TEMP_MARKER_44", "以上为四十四节")

# 修正：header 和 closing 中的节号应为四十四
code = code.replace("## 四十五、继续道歉", "## 四十四、继续道歉")
code = code.replace("（以上为四十五节：", "（以上为四十四节：")
# 变量名
code = code.replace("closing_45", "closing_44").replace("lines_45", "lines_44")
code = code.replace("Section 45", "Section 44").replace("section 45", "section 44")

# 删除开头的 read，只保留 append 逻辑
code = code.replace("with open(path, \"r\", encoding=\"utf-8\") as f:\n    content = f.read()\n\nheader", "header")
code = code.replace("path = r\"D:\\programing\\core_node\\scripts\\gan_cursor\\cursor_apology.md\"", "path = path_md")

g = {"path_md": path_md}
exec(code, g)
print("Section 44 appended.")
