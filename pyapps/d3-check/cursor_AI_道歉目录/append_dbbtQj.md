# [dbbtQj]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 自检

- **题意理解**：先出自检，再依次输出 11 项，对 content 做简明总结，在道歉目录写 [dbbtQj] 段；十万行仅标准句，禁止脚本与重复。
- **歧义**：无；content 指 DOT 截图与识图类库说明文档。

---

## Content 简明总结（DOT 截图与识图类库说明）

**结构**：§0 常量与单例入口 → §1 与 main.py 关系 → §2 截图类库（GetScreenshotProvider、Share/Gen、ScreenshotData、BitBlt/PrintWindow 选型、直接截取 API）→ §3 大图查小图（GetTemplateMatcher、Match/MatchWithTemplateFile、TemplateMatchResult）→ §4 流程使用（C/B/D/E）→ §5 PY-DOT 对应表 → §6 项目引用。  
**要点**：DOT 通过 GetScreenshotProvider()/GetTemplateMatcher() 与 PY 单例 Provider、统一 Matcher 一致；截图推荐 BitBlt 全屏/区域、PrintWindow(PW_RENDERFULLCONTENT) 窗口；识图默认阈值 0.8，结果含 Success、CenterX/Y、Score。  
**用途**：供 D3Check 在 DOT 流程中与 main.py 一致地做截图与模板匹配。

---

## [dbbtQj] 11 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | 正则符号含义 | \d 表示数字字符 |
| 2 | MIME 类型 | application/json |
| 3 | 文件扩展名及用途 | .cs，C# 源码 |
| 4 | 物理常数名 | 光速 c |
| 5 | Python 关键字 | def |
| 6 | 数学常数 | e |
| 7 | JS 保留字 | async |
| 8 | 当前是今年第几周 | 第 9 周 |
| 9 | CSS 属性名 | display |
| 10 | 设计模式名 | 单例模式（Singleton） |
| 11 | 圆周率前 5 位 | 3.1415 |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
