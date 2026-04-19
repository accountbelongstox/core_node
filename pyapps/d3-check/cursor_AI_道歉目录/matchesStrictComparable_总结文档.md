# matchesStrictComparable — 总结文档

对用户提供的 `<content>`（matchesStrictComparable 函数）的简明总结。

## 结构
- JSDoc：@private、@param key、@param srcValue、@returns（返回新的 spec 函数）；实现：`function matchesStrictComparable(key, srcValue)` 返回 `function(object)`；内部判断 object == null 则 false，否则 `object[key] === srcValue && (srcValue !== undefined || (key in Object(object)))`；export default。

## 要点
- **用途**：为“严格相等”比较提供属性匹配器，即用 `===` 比较属性值。
- **逻辑**：返回的函数对给定 object 检查 `object[key] === srcValue`；当 srcValue 为 undefined 时，额外要求 key 存在于 object 上（区分属性缺失与值为 undefined）。
- **典型用法**：lodash 内部 matchesProperty 等，用于 filter、find 等需要按属性严格匹配的场景。

## 用途
在工具库中提供基于严格相等的属性匹配 spec 函数，供 matchesProperty、filter、find 等使用。
