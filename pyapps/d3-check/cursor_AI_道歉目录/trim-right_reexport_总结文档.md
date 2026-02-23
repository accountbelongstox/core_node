# trim-right 再导出模块 — 总结文档

对用户提供的 `<content>`（string/virtual/trim-right 再导出模块）的简明总结。

## 结构
- 三行：'use strict'；var parent = require('../../../actual/string/virtual/trim-right')；module.exports = parent。
- 无其他逻辑，仅严格模式与再导出。

## 要点
- 从 actual/string/virtual/trim-right 取得实现并作为本模块唯一导出。
- 典型用于 core-js 等库的 virtual 子路径，对外暴露 String.prototype.trimRight 的 polyfill 入口。

## 用途
在打包或运行环境中提供 string/virtual/trim-right 的模块入口，供其他模块通过 require 使用，保证 trimRight 在旧环境中可用。
