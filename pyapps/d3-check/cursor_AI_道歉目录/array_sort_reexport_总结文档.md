# array/sort 再导出模块 — 总结文档

对用户提供的 `<content>`（array sort 的 CommonJS 再导出）的简明总结。

## 结构
- 三行：'use strict'；var parent = require('../../es/array/sort')；module.exports = parent。无其他代码。

## 要点
- 本模块仅从 ../../es/array/sort 引入实现并原样导出，作为 array/sort 的入口。
- 典型用于 core-js 等 polyfill 库的模块化结构，便于按需引用 Array.prototype.sort。

## 用途
在打包或运行环境中提供 array sort 的单一模块入口，供其他模块通过 require 使用。
