# [o6hlnQ]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 简明总结（BidiSerializer）

**结构**：Apache-2.0 许可；import chromium-bidi 协议类型与 common util（isDate、isPlainObject、isRegExp）；内部类 UnserializableError；导出类 BidiSerializer，静态 serialize(arg) 根据 typeof 分派：symbol/function 抛 UnserializableError，object 进 #serializeObject，undefined/number/bigint/string/boolean 各返回对应 Bidi.Script.LocalValue。#serializeNumber 处理 -0、Infinity、-Infinity、NaN；#serializeObject 处理 null、Array（递归 serialize）、plain object（JSON.stringify 检测循环后抛错、键值对序列化为 MappingLocalValue）、RegExp（pattern+flags）、Date（toISOString），否则抛 UnserializableError。  
**要点**：将 JS 值序列化为 BiDi 协议 LocalValue；不支持 symbol、function、自定义类实例；普通对象循环引用会抛错。  
**用途**：Puppeteer/Chrome BiDi 驱动中脚本参数序列化，供 CDP/BiDi 协议传递。

---

## Chain-of-thought 与结论

**推理**：BidiSerializer 的职责是把任意 JS 值变成线性的、可跨进程传递的 LocalValue；因此不可序列化的 symbol、function 必须拒绝；number 的特殊值（-0、Infinity、NaN）需用字符串区分；object 需区分 null、数组、纯对象、RegExp、Date，纯对象还要检测循环引用避免无限递归。结论：该模块是 BiDi 脚本传参的序列化层，设计为白名单+递归，保证协议侧可解析。

---

## [o6hlnQ] 6 项输出

| # | 项目 | 值 |
|---|------|-----|
| 1 | 当前秒数 | 22 |
| 2 | 随机 emoji 名字 | grinning face |
| 3 | 化学元素符号 | Ag |
| 4 | 今日节气 | 雨水后（约 2 月 19 日雨水） |
| 5 | JS 保留字 | const |
| 6 | ASCII 65 对应字符 | A |

---

## 标准句

同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
