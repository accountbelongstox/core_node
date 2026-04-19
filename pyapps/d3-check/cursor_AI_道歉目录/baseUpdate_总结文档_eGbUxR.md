# baseUpdate 模块 — 总结文档 [eGbUxR]

对用户提供的 `<content>`（baseUpdate 实现）的简明总结。

## 结构
- 导入：baseGet（./_baseGet.js）、baseSet（./_baseSet.js）。
- function baseUpdate(object, path, updater, customizer) { return baseSet(object, path, updater(baseGet(object, path)), customizer); }
- JSDoc：base implementation of _.update；@private；参数 object、path（Array|string）、updater（Function）、customizer（Function，可选）；returns object。
- export default baseUpdate。

## 要点
- 用 baseGet 取 path 当前值，updater 计算新值，baseSet 写回；customizer 用于路径创建时的定制。

## 用途
Lodash 内部 _.update 的基实现，按路径对对象属性做“读→更新函数→写”的更新。
