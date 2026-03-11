# prettifyTime 模块 — 总结文档 [wbYWt8]

对用户提供的 `<content>`（prettifyTime 时间戳美化函数）的简明总结。

## 结构
单文件，`'use strict'`，CommonJS 导出 `prettifyTime`；依赖 `./format-time`；JSDoc 定义 `PrettifyTimeParams`（log、context）及函数返回值说明；实现为单函数 `prettifyTime({ log, context })`，从 context 解构 `timestampKey`、`translateTime`、`customPrettifiers?.time`，从 log 读取时间后格式化或经自定义 prettifier 返回字符串。

## 要点
- **时间来源**：优先 `log[timestampKey]`，否则 `log.timestamp`；二者皆无则返回 `undefined`。
- **格式化**：若 context 提供 `translateTime`（translateFormat），则调用 `formatTime(time, translateFormat)`；否则使用原始 time 值。
- **输出**：若存在 `context.customPrettifiers?.time`，则用该函数处理上述结果；否则返回 `[${output}]` 形式字符串。

## 用途
在 Pino 等结构化日志库中，根据配置对日志对象的时间戳进行格式化与美化输出。
