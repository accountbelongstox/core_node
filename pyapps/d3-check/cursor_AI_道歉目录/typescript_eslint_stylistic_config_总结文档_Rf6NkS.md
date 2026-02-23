# typescript-eslint/stylistic 配置 — 总结文档 [Rf6NkS]

对用户提供的 `<content>`（typescript-eslint stylistic 自动生成配置）的简明总结。

## 结构
"use strict"；注释（自动生成、勿手改、文档链接、pnpm run generate-configs）；__importDefault 辅助；exports.__esModule；require ./base、./eslint-recommended；export default (plugin, parser) => [base(plugin,parser), eslint_recommended(plugin,parser), { name: 'typescript-eslint/stylistic', rules: { ... } }]。

## 要点
- 第三项配置 name 为 'typescript-eslint/stylistic'，rules 中多数为 'error'：adjacent-overload-signatures、array-type、ban-tslint-comment、class-literal-property-style、consistent-generic-constructors、consistent-indexed-object-style、consistent-type-assertions、consistent-type-definitions、no-confusing-non-null-assertion、no-empty-function 基规则 'off' 且 @typescript-eslint/no-empty-function 'error'、no-inferrable-types、prefer-for-of、prefer-function-type。
- 注释说明为现代 TypeScript 代码库的最佳实践风格规则，不影响程序逻辑。

## 用途
作为 typescript-eslint 的 stylistic 预设，与 base、eslint-recommended 组合使用，供 ESLint 对 TypeScript 进行风格检查。
