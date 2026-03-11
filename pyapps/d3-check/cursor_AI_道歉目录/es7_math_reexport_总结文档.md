# es7 Math 多模块再导出 — 总结文档

对用户提供的 `<content>`（es7.math 系列 require 后导出 _core.Math）的简明总结。

## 结构
- 12 行 require('../modules/es7.math.*')：clamp、deg-per-rad、degrees、fscale、iaddh、isubh、imulh、rad-per-deg、radians、scale、umulh、signbit；最后 module.exports = require('../modules/_core').Math。

## 要点
- 各 require 加载 ES7 Math 的 polyfill（角度/弧度换算、缩放、整数高位运算、符号位等）。
- 导出为 _core.Math，即带上述扩展的 Math 对象，作为 core-js 等库的 Math 入口。

## 用途
在打包或运行环境中提供带 ES7 Math 扩展的 Math 单入口，供其他模块通过 require 使用。
