# [Uiy01z]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 简明总结（Trusted Types / cleanUpInnerHTML）

**结构**：模块顶层 `policy` 变量；`createPolicy()` 在 try/catch 中调用 `window.trustedTypes.createPolicy("iconify", { createHTML: (s) => s })`，失败则 policy 为 null；`cleanUpInnerHTML(html)` 若 policy 未定义则先调用 createPolicy()，再返回 `policy ? policy.createHTML(html) : html`；最后 export cleanUpInnerHTML。  
**要点**：用于在支持 Trusted Types 的浏览器中，将 Iconify 图标 HTML 通过命名策略 "iconify" 包装为 TrustedHTML 再赋给 innerHTML；注释标明“不实际做清理”，依赖上游数据已校验。  
**用途**：满足 CSP Trusted Types 要求的同时，安全地注入已校验的图标 HTML，避免直接 innerHTML 被禁用。

---

## [Uiy01z] 8 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | 本机时区 | UTC+8 |
| 2 | 当前UTC时间 | 约 2025-02-23T00:00:00Z（示例） |
| 3 | 文件扩展名及用途 | .json，用于数据交换与配置 |
| 4 | 十六进制随机数 | 0x1A2F |
| 5 | Python关键字 | def |
| 6 | MIME类型 | text/html |
| 7 | 当前秒数 | 37 |
| 8 | 2的10次方 | 1024 |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
