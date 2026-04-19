# removePropertiesDeep 模块 — 总结文档 [XZykVm]

对用户提供的 `<content>`（removePropertiesDeep 实现）的简明总结。

## 结构
- "use strict"；Object.defineProperty(exports, "__esModule", { value: true })；exports.default = removePropertiesDeep。
- 导入：_traverseFast（../traverse/traverseFast.js）、_removeProperties（./removeProperties.js）。
- function removePropertiesDeep(tree, opts) { (0, _traverseFast.default)(tree, _removeProperties.default, opts); return tree; }
- 末尾 //# sourceMappingURL=removePropertiesDeep.js.map

## 要点
- 对 AST tree 做 traverseFast，在每个节点上应用 removeProperties(opts)，原地修改后返回 tree。

## 用途
Babel 等工具中深度移除 AST 上指定属性（如 location、comments），用于简化或规范化树。
