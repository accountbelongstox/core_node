# formatRFC7231 — 总结文档 [fOxYIK]

对用户提供的 `<content>`（date-fns formatRFC7231 函数声明与 JSDoc）的简明总结。

## 结构
JSDoc：@name formatRFC7231、@category Common Helpers、@summary（RFC 7231）、@description（UTC 结果）、@typeParam DateType、@param date、@returns、@throws（Invalid Date）、@example。声明：export declare function formatRFC7231&lt;DateType extends Date&gt;(date: DateType | number | string): string。

## 要点
- 按 RFC 7231（HTTP date，如 Last-Modified）格式化日期；结果始终为 UTC，示例 "Wed, 18 Sep 2019 19:00:52 GMT"。
- 参数 date 可为 Date 实例、number（时间戳）或 string；若为 Invalid Date 则抛出。
- DateType 泛型支持 UTCDate 等扩展类型。

## 用途
在 date-fns 中提供符合 RFC 7231 的日期字符串，供 HTTP 响应头或其它需要标准日期格式的场景使用。
