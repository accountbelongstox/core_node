# Iterator Safe Close 模块 — 总结文档 [BlxrsT]

对用户提供的 `<content>`（迭代器步进中安全关闭的 JS 模块）的简明总结。

## 结构
CommonJS 单文件：依赖 `./_an-object`；导出单函数，参数为 `(iterator, fn, value, entries)`；函数体内 try/catch，catch 中调用 `iterator['return']` 后重新 throw。

## 要点
- **行为**：在迭代器某一步上执行 `fn`；若 `entries` 为真则 `fn(anObject(value)[0], value[1])`，否则 `fn(value)`。
- **错误处理**：对应 ES 7.4.6 IteratorClose：发生异常时若存在 `iterator.return` 则调用并传入 `anObject(ret.call(iterator))`，然后重新抛出原异常，保证迭代器被关闭。
- **用途**：在 for-of、展开等消费迭代器时，出错也能正确执行 `return` 清理，避免资源泄漏。
