# throttle 函数总结文档

本文档对用户提供的 `<content>`（throttle 节流函数实现）做简明总结。

## 结构概览
- **依赖**：`debounce.js`、`isObject.js`。
- **常量**：FUNC_ERROR_TEXT（"Expected a function"）。
- **导出**：默认导出 `throttle(func, wait, options)`。

## 要点
- **参数**：func 为待节流函数，wait 为时间间隔（毫秒），options 可选，含 leading（默认 true）、trailing（默认 true）。
- **实现**：内部直接调用 `debounce(func, wait, { leading, maxWait: wait, trailing })`，即通过 debounce 的 maxWait 实现“每 wait 内最多执行一次”的节流；返回的函数继承 debounce 的 cancel、flush 方法。
- **行为**：leading 控制时间窗开始时是否执行，trailing 控制结束时是否执行；若 leading 与 trailing 均为 true，在 wait 内多次调用时仅在 trailing 时执行一次。
- **校验**：func 非函数时抛出 TypeError。

## 用途
在高频事件（如 scroll、resize、click）中限制回调执行频率，减少性能开销；适用于位置更新、续期 token 等场景。
