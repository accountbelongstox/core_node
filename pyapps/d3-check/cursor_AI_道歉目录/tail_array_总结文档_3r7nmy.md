# tail (array) — 总结文档 [3r7nmy]

对用户提供的 `<content>`（Lodash 风格 tail 函数）的简明总结。

## 结构
- 从 `./_baseSlice.js` 导入 baseSlice。
- JSDoc：@static、@memberOf _、@since 4.0.0、@category Array、参数 array、返回值、示例 _.tail([1,2,3]) => [2,3]。
- 函数 tail(array)：length = array == null ? 0 : array.length；有 length 则 return baseSlice(array, 1, length)，否则 return []。
- export default tail。

## 要点
- 行为：返回“除第一个元素之外”的子数组，即 array.slice(1) 的等价实现。
- 空值：array 为 null 或 undefined 时返回 []。
- 依赖：baseSlice(array, start, end) 负责实际切片。

## 用途
作为 Lodash 风格工具函数，用于获取数组尾部（去掉首元），便于链式或函数式写法。
