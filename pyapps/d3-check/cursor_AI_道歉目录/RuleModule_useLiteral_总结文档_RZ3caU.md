# RuleModule useLiteral 默认导出 — 总结文档 [RZ3caU]

对用户提供的 `<content>`（declare const _default + export default）的简明总结。

## 结构
两行 TypeScript：第一行 declare const _default，类型为 import("@typescript-eslint/utils/ts-eslint").RuleModule<"useLiteral", [], ...ESLintPluginDocs, ...RuleListener> & { name: string }；第二行 export default _default。

## 要点
- RuleModule 泛型：第一个类型参数为 "useLiteral"（规则选项的字面量），第二、三个为数组与文档/Listener 类型。
- 默认导出带有 name 属性，符合 ESLint 规则模块约定。

## 用途
作为 @typescript-eslint 某条规则（与 useLiteral 相关）的默认导出声明，供规则加载与 TypeScript 类型检查使用。
