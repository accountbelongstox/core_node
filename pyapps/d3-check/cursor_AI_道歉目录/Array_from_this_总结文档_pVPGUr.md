# export default function Array.from(this) — 总结文档 [pVPGUr]

对用户提供的 `<content>` 的简明总结。

## 结构
export default function() { return Array.from(this); } — 默认导出一个无参数函数，函数体仅一行 return Array.from(this)。

## 要点
- 函数依赖调用时的 this：this 须为类数组或可迭代对象，Array.from 将其转为新数组并返回。
- 常见用法：作为对象方法或通过 call/apply 传入类数组（如 arguments、NodeList）以得到真实数组。

## 用途
将类数组或可迭代对象快速转为 Array 实例，便于使用数组方法（如 map、filter）；常见于兼容或工具函数。
