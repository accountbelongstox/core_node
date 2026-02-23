# bindKey (Lodash) 模块 — 总结文档 [u8DKze]

对用户提供的 `<content>`（_.bindKey 实现）的简明总结。

## 结构
- 导入：baseRest、createWrap、getHolder、replaceHolders。位掩码常量 WRAP_BIND_FLAG=1、WRAP_BIND_KEY_FLAG=2、WRAP_PARTIAL_FLAG=32。
- bindKey = baseRest(function(object, key, partials) { bitmask = BIND | BIND_KEY；若有 partials 则 replaceHolders、bitmask |= PARTIAL；return createWrap(key, bitmask, object, partials, holders); })；bindKey.placeholder = {}；export default bindKey。
- JSDoc：创建调用 object[key] 并预填 partials 的函数；与 _.bind 不同在于按 key 延迟解析（方法可被重定义）；占位符说明与示例。

## 要点
- 调用时再解析 object[key]，支持方法后续被替换；支持部分应用与占位符。

## 用途
Lodash _.bindKey：按对象、方法名、部分参数生成绑定函数，适用于方法可能重定义或尚未存在的场景。
