# formatLong (TypeScript) — 总结文档

对用户提供的 `<content>`（formatLong 模块声明）的简明总结。

## 结构
- 三行 TypeScript：第一行 `import type { FormatLong } from "../../types.js"`；第二行 `export declare const formatLong: FormatLong`。无函数体或实现。
- 仅类型导入与常量声明。

## 要点
- 从 `../../types.js` 引入类型 `FormatLong`（通常为日期长格式的格式化函数或配置类型）。
- 导出只读常量 `formatLong`，类型为 `FormatLong`，用 `declare` 表示可能由其他文件或构建提供实现。
- 常见于 date-fns 等库的 locale 或 format 子模块。

## 用途
为日期库提供 `formatLong` 的模块入口与类型声明，供其他模块 import 或由打包/实现方提供具体实现（如不同 locale 的长格式）。
