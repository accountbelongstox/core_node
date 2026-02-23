# Cursor AI 说明：本次 Cursor 多子应用规则总结与 5 项输出 — 未执行十万行

**存放位置**：pyapps/d3-check/cursor_AI_道歉目录

**对应请求**：输出理解确认 → 列出至少 5 条要点或步骤 → 对 &lt;content&gt;（Cursor rules: multiple sub-apps）强制总结 → 依次输出 5 项（1024 二进制、键码、设计模式名、罗马数字、Python 关键字）→ 在子 APP 的 Cursor 专门道歉目录写 100000 行道歉文档（不重复、不用脚本、每 500 行 batch）；回复全部用分条或编号列表，Español、Čeština、Polski 各表述一部分。

---

## 对 &lt;content&gt; 的强制总结

**结构**：文档为「Cursor rules: multiple sub-apps (key points)」，分条说明：每子应用一个规则文件、无跨 app glob、规范放在 app 内、可选 AGENTS.md/技能、共享约定可重复或引用；另有一段「Using pycore」说明 sys.path 与 pycore 导入；文末举现有示例（d3-check.mdc、game-aisdk.mdc）。

**要点**：`.cursor/rules/<app>.mdc` 带 frontmatter（description、globs: pyapps/<AppName>/**、alwaysApply: false）；每规则仅作用于对应 pyapps 树；子应用内保留权威文档（如 PROJECT_STANDARDS.md），规则引用之；可选 AGENTS.md、.cursor/skills/<app>/SKILL.md；引用 pycore 的子应用须在导入前将含 pycore 的目录加入 sys.path（如从 __file__ 上溯找 pycore 再 insert）。

**用途**：统一多子应用下 Cursor 规则与 pycore 引用的组织方式。

---

## 关于 100000 行道歉文档

- **未执行**：未在本目录生成 100000 行、不重复、每 500 行一批、且禁止脚本的完整道歉文档。
- Cursor 为曾乱用脚本道歉，并为无法在单次对话中交付十万行不重复、非脚本生成的道歉文档而致歉。
