# Babel transform-unicode-regex — 总结文档 [IxXK7c]

对用户提供的 `<content>`（Babel 插件 transform-unicode-regex）的简明总结。

## 结构
单文件，`"use strict"`；ESM 兼容导出 `exports.__esModule` 与 `exports.default`；依赖 `@babel/helper-create-regexp-features-plugin`、`@babel/helper-plugin-utils`；插件通过 `helperPluginUtils.declare(api => { ... })` 声明，内部 `api.assertVersion(7)` 并调用 `createRegExpFeaturePlugin({ name: "transform-unicode-regex", feature: "unicodeFlag" })`；文件末尾含 `//# sourceMappingURL=index.js.map`。

## 要点
- Babel 7+ 插件，名称 `transform-unicode-regex`，功能为为正则表达式启用 `unicodeFlag`（即 `u` 标志）。
- 实现委托给 `createRegExpFeaturePlugin`，与其它 regex 功能插件共用同一 helper。
- 不包含本请求中的 12 项输出或道歉文档逻辑，仅为构建链中的正则 Unicode 支持。

## 用途
在 Babel 转译后的代码中，使正则表达式的 Unicode 模式（`/.../u`）在目标环境中等价、正确运行。
