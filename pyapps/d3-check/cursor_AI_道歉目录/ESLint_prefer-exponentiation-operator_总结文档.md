# ESLint prefer-exponentiation-operator 规则 — 总结文档

对用户提供的 `<content>`（ESLint 规则：禁用 Math.pow、建议 **）的简明总结。

## 结构
- @fileoverview + "use strict"；Requirements：astUtils、CALL/ReferenceTracker；Helpers：PRECEDENCE_OF_EXPONENTIATION_EXPR、doesBaseNeedParens、doesExponentNeedParens、doesExponentiationExpressionNeedParens、parenthesizeIfShould；Rule Definition：meta（type、docs、schema、fixable、messages）、create(context) 内 report（含 fix）、Program 中 ReferenceTracker 追踪 Math.pow 并 report。

## 要点
- **目的**：禁用 Math.pow，建议使用 ** 运算符；fixable，可自动替换。
- **括号逻辑**：base 为 AwaitExpression/UnaryExpression 或优先级 ≤ ** 时需括号；exponent 优先级 < ** 时需括号；整体在父为 ClassDeclaration 或某些 Expression 且优先级条件满足时需括号；避免与 ChainExpression、CallExpression 参数、MemberExpression 的 computed 等冲突。
- **fix**：取 base/exponent 文本，按需加括号，拼成 base**exponent，必要时加 prefix/suffix 空格以保持 token 可相邻；replaceText 替换节点。

## 用途
在 ESLint 中统一使用 ** 替代 Math.pow，并自动修复且保证运算符优先级与括号正确。
