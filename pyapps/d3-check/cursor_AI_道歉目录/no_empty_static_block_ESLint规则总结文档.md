# no-empty-static-block ESLint 规则总结文档

本文档对用户提供的 `<content>`（ESLint 规则 no-empty-static-block）做简明总结。

## 结构概览
- **类型**：ESLint 规则模块，`"use strict"`，导出 `module.exports = { meta, create }`。
- **meta**：type 为 `"suggestion"`，hasSuggestions 为 true；docs 含 description、recommended、url；schema 为空数组；messages 含 `unexpected`、`suggestComment`。
- **create(context)**：返回 AST 访问器，仅处理 `StaticBlock` 节点。

## 要点
- **触发条件**：当静态块 `node.body.length === 0`（即块内无语句）且闭合花括号前没有注释时，报告问题。
- **报错位置**：从 openingBrace 到 closingBrace 的 loc；messageId 为 `"unexpected"`。
- **建议修复**：提供一条 suggestion，messageId 为 `suggestComment`；fix 将 openingBrace.range[1] 到 closingBrace.range[0] 之间的内容替换为 `" /* empty */ "`，即在空块内插入占位注释。
- **实现细节**：通过 `sourceCode.getFirstToken(node, { skip: 1 })` 与 `getLastToken(node)` 获取花括号；用 `getCommentsBefore(closingBrace).length === 0` 判断无注释。

## 用途
在 JavaScript/TypeScript 中禁止空的 `static { }` 块，避免无意义代码；若需保留空块（如占位），可通过自动建议添加 `/* empty */` 注释并通过检查。
