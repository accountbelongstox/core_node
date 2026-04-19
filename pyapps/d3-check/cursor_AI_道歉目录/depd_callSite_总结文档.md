# depd (callSite) 总结文档

本文档对用户提供的 `<content>`（depd 模块中的 CallSite 格式化逻辑）做简明总结。

## 结构概览
- **模块**：Node.js 模块 `depd`，MIT 许可，单文件，严格模式；对外仅导出 `callSiteToString`。
- **函数**：`callSiteFileLocation(callSite)`、`callSiteToString(callSite)`、`getConstructorName(obj)`（内部辅助）。

## 要点
- **callSiteFileLocation**：根据 CallSite 类型生成“文件位置”字符串。若 `isNative()` 返回 `"native"`；若 `isEval()` 用 `getScriptNameOrSourceURL()` 或 `getEvalOrigin()`；否则用 `getFileName()`。若有文件名，则追加 `:行号`，若有列号再追加 `:列号`；无则返回 `"unknown source"`。
- **callSiteToString**：生成单行可读堆栈。先取 fileLocation；再根据是否为方法调用、构造函数、顶层或仅有函数名，拼出类型名、方法名、`[as methodName]`、`new FunctionName` 等；最后在需要时追加 ` (fileLocation)`。若既无方法名也无函数名，则只输出 fileLocation 且不加后缀。
- **getConstructorName**：从 `obj.receiver.constructor.name` 取构造函数名，供方法调用时显示类型名。

## 用途
将 V8 CallSite 对象格式化为人类可读的堆栈行（文件名、行号、列号、函数/方法名、构造函数名），常用于 depd 的弃用警告或其它堆栈输出场景。
