# AST 遍历/替换库（estraverse 风格）— 总结文档 [6ejoHo]

对用户提供的 `<content>`（IIFE 形式的 AST 遍历与替换实现）的简明总结。

## 结构
- 头部：BSD 版权（Yusuke Suzuki, Ariya Hidayat）；jslint/jshint 注释；IIFE (function clone(exports){ ... }(exports))。
- 工具：deepCopy；upperBound(array, func)（二分上界，基于 LLVM libc++）；Syntax（节点类型名）；VisitorKeys（类型→子属性数组）；BREAK/SKIP/REMOVE、VisitorOption；Reference(parent, key) 含 replace/remove；Element(node, path, wrap, ref）。
- Controller：path()、type()、parents()、current()、__execute、notify/skip/break/remove、__initialize、traverse(root, visitor)、replace(root, visitor)；内部用 worklist/leavelist、Element、VisitorKeys/__fallback、isNode/isProperty/candidateExistsInLeaveList 实现 enter/leave 遍历与替换。
- 顶层函数：traverse、replace；extendCommentRange(comment, tokens)；attachComments(tree, providedComments, tokens)（根据 range 挂载 leadingComments/trailingComments）。
- 导出：Syntax、traverse、replace、attachComments、VisitorKeys、VisitorOption、Controller、cloneEnvironment。

## 要点
- ESTree 风格 AST 的 enter/leave 遍历与原地替换；支持 SKIP、BREAK、REMOVE；VisitorKeys 驱动子节点访问；attachComments 依赖 range 信息。

## 用途
作为 estraverse 类库的核心，供 JS 解析/转换工具对 AST 进行遍历、替换与注释挂载。
