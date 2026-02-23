# en-CA Locale — 总结文档 [MiXrHp]

对用户提供的 `<content>`（date-fns 加拿大英语 locale 声明）的简明总结。

## 结构
import type { Locale } from "./types.js"；JSDoc：@category Locales、@summary English locale (Canada)、@language English、@iso-639-2 eng、@author（两位）；export declare const enCA: Locale。

## 要点
- 导出常量 enCA，类型为 Locale（从 ./types.js 导入）。
- 用于加拿大英语（en-CA）的日期/时间格式与解析。
- 仅类型声明，无实现代码（实现通常在同包其它文件中）。

## 用途
在 date-fns 中提供加拿大英语 locale，供需要 en-CA 区域设置的格式化与解析使用。
