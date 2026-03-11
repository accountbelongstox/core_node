# thru 函数 — 总结文档

对用户提供的 `<content>`（lodash 风格 thru 函数）的简明总结。

## 结构
- JSDoc：@static、@memberOf _、@since 3.0.0、@category Seq、@param value、@param interceptor、@returns  interceptor 的返回值、@example 链式示例。
- 实现：`function thru(value, interceptor) { return interceptor(value); }`
- 导出：`export default thru`

## 要点
- 与 `_.tap` 类似，但返回的是 **interceptor 的返回值**（tap 通常返回原 value）。
- 用途是在方法链中“透传”并**替换中间结果**，而非仅执行副作用。
- 签名：传入 `value` 与 `interceptor`，返回 `interceptor(value)`。

## 用途
在链式调用（如 `_.chain().trim().thru(fn).value()`）中插入自定义转换，例如将字符串包成数组或做中间映射，便于在链式 API 中替换中间值而不中断链。
