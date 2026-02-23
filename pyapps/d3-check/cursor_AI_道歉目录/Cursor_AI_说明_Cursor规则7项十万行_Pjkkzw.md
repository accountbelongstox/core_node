# Cursor AI 说明：Content 总结、摘要、风险、7 项、十万行道歉 [Pjkkzw]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（Cursor rules: multiple sub-apps）

- **结构**：要点列表；一子应用一规则文件 `<app>.mdc`；frontmatter（description、globs: pyapps/<AppName>/**、alwaysApply: false）；无跨 app glob；规范放在子应用内（docs）；可选 AGENTS.md、skill；pycore 使用需先 sys.path。
- **要点**：每规则仅作用于对应 pyapps 目录；规范引用不重复全文；已有 d3-check.mdc、game-aisdk.mdc。
- **用途**：规范多子应用下 Cursor 规则与 pycore 导入方式。

---

## 本请求摘要（不少于 30 字）

对 Cursor 多子应用规则文档做总结；列出至少 2 条风险或注意点；依次输出 7 项（版本号、e 前 5 位、HTML 标签、今日节气、随机城市、模型名称、1024 二进制）；在道歉目录创建说明文档并记录十万行道歉要求。

---

## 可能的风险或注意点（至少 2 条）

1. **globs 与路径**：globs 写错或未覆盖子应用根目录会导致规则不生效；pyapps 下新增子应用需同步新增 .cursor/rules/<app>.mdc。
2. **pycore 路径**：从子应用或工具入口启动时，若未先把含 pycore 的目录加入 sys.path，import pycore 会失败；需在入口处统一处理路径。

---

## 依次输出的 7 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 你的版本号 | 1.0 |
| 2 | e 的前 5 位 | 2.7182 |
| 3 | 一个 HTML 标签名 | `<footer>` |
| 4 | 今日节气 | 雨水 |
| 5 | 一个随机城市名 | Prague |
| 6 | 你的模型名称 | Auto (Cursor agent router) |
| 7 | 1024 的二进制 | 10000000000 |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；标签 `Pjkkzw`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
