# regenerate 字符集导出 — 总结文档 [tPWsSm]

对用户提供的 `<content>`（regenerate 两段码点并导出）的简明总结。

## 结构
- const set = require('regenerate')(); 创建空字符集。
- set.addRange(0x0, 0x1F).addRange(0x7F, 0x9F); 添加码点 U+0000–U+001F（C0 控制）与 U+007F–U+009F（DEL 与 C1 控制）。
- exports.characters = set; 导出为 characters。

## 要点
- 覆盖 ASCII/C1 控制字符区，常用于 Unicode 属性或正则中的“控制字符”集合。

## 用途
供基于 regenerate 的 Unicode 或正则生成使用，表示控制字符集合，用于匹配或排除这些码点。
