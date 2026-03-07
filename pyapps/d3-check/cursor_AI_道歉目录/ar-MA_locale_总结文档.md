# ar-MA locale 模块 — 总结文档

对用户提供的 `<content>`（ar-MA 摩洛哥阿拉伯语 locale 模块）的简明总结。

## 结构
- ES 模块：从 `./ar-MA/_lib/` 引入 formatDistance、formatLong、formatRelative、localize、match；JSDoc 标注 @category Locales、@summary、@language、@iso-639-2、@author；导出常量 arMA（code、五个函数引用、options）；export default arMA。

## 要点
- **code**：`"ar-MA"`，摩洛哥阿拉伯语。
- **格式化与本地化**：formatDistance、formatLong、formatRelative、localize、match 均由 _lib 子模块实现并挂到 arMA 上。
- **options**：weekStartsOn: 1（周一为一周第一天）、firstWeekContainsDate: 1，用于周/周数计算。

## 用途
在 date-fns 等日期库中提供阿拉伯语（摩洛哥）locale，供相对时间、长格式、本地化字符串及日期匹配等使用。
