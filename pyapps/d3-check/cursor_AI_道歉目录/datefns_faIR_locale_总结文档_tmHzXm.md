# date-fns fa-IR Locale — 总结文档 [tmHzXm]

对用户提供的 `<content>`（date-fns 波斯语/伊朗 locale 打包代码）的简明总结。

## 结构
IIFE 打包；内含 Babel 运行时辅助（_typeof、ownKeys、_objectSpread、_defineProperty、_toPropertyKey、_toPrimitive）及 __defProp/__export；按源路径注释组织：formatDistance.js、buildFormatLongFn.js、formatLong.js、formatRelative.js、buildLocalizeFn.js、localize.js、buildMatchFn.js、buildMatchPatternFn.js、match.js、fa-IR.js、cdn.js；末尾将 faIR 合并进 window.dateFns.locale。

## 要点
- **formatDistance**：相对时间字符串（少于一秒/秒/半分钟/分钟/小时/天/周/月/年等），波斯语文案，支持 one/other 与 {{count}}；可选 addSuffix（در … / … قبل）、comparison。
- **formatLong**：date/time/dateTime 的 full/long/medium/short 格式，由 buildFormatLongFn 生成。
- **formatRelative**：lastWeek、yesterday、today、tomorrow、nextWeek、other 的模板。
- **localize**：era、quarter、month、day、dayPeriod 的 narrow/abbreviated/wide 取值；ordinalNumber 直接转字符串。
- **match**：ordinalNumber/era/quarter/month/day/dayPeriod 的正则 match/parse 与 valueCallback，用于解析波斯语日期输入。
- **options**：weekStartsOn: 6（周六为一周起始）、firstWeekContainsDate: 1。

## 用途
在浏览器 CDN 场景下为 date-fns 提供波斯语（fa-IR）的日期时间格式化与解析能力。
