# Array.indexOf 再导出模块 — 总结文档

对用户提供的 `<content>`（CommonJS 再导出模块）的简明总结。

## 结构
- 三行：第一行 `require('../../modules/es6.array.index-of')`；第二行 `module.exports = require('../../modules/_core').Array.indexOf`。
- 无其他逻辑，仅依赖加载与导出。

## 要点
- 先加载 `es6.array.index-of` 补丁（确保 Array.prototype.indexOf 存在或被打补丁）。
- 再从 `_core` 取得 `Array.indexOf` 并作为本模块的导出。
- 典型用于 core-js 或类似 polyfill 库的模块化入口。

## 用途
在打包或运行环境中提供 `Array.indexOf` 的单一模块入口，供其他模块通过 require 使用，并保证 ES6 Array indexOf 行为在旧环境中可用。
