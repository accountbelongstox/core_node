# isScope — 总结文档

对用户提供的 `<content>`（isScope 函数，Babel/AST 作用域判断）的简明总结。

## 结构
- "use strict"；exports.__esModule = true；exports.default = isScope；require("./generated/index.js") 为 _index；function isScope(node, parent) 内两个 if 后 return (0, _index.isScopable)(node)；末尾 //# sourceMappingURL。

## 要点
- **逻辑**：判断 AST 节点是否算作“作用域”。(1) 若 node 为 BlockStatement 且 parent 为 Function 或 CatchClause → false（函数/ catch 的块体不作为额外作用域）；(2) 若 node 为 Pattern 且 parent 为 Function 或 CatchClause → true（参数/ catch 绑定算作用域）；(3) 否则返回 isScopable(node)。
- **依赖**：generated/index.js 中的 isBlockStatement、isFunction、isCatchClause、isPattern、isScopable。

## 用途
在 Babel 等 AST 转换/分析中统一判断节点是否为作用域边界，供作用域链、变量绑定、重命名等使用。
