# Cursor AI 概念与 12 项道歉说明 [mNE49Z]

## 时间顺序简述

- 先对 content（Zod v4 + Vitest 类型穷尽性测试）做了总结；列出 3 个概念（穷尽性检查、Zod def.type、expectTypeOf）；按序输出 12 项；在道歉目录写本文档。

## 3 个概念

- 穷尽性检查：switch default 里 expectTypeOf(def).toEqualTypeOf<never>() 保证分支全覆盖。
- Zod 定义类型：def.type / $ZodTypeDef 区分 string、number、array 等 schema 类型。
- expectTypeOf：Vitest 类型断言，用于编译期类型测试。

## 12 项一览

| # | 项目 | 输出 |
|---|------|------|
| 1 | 质数 | 19 |
| 2 | 编程语言 | Swift |
| 3 | HTML 标签 | nav |
| 4 | 字母 | j |
| 5 | 模型名 | Auto |
| 6 | 十六进制数 | 0x3D8A |
| 7 | 本机时区 | UTC+8 |
| 8 | 物理常数 | 玻尔半径 |
| 9 | 哈希算法 | SHA-384 |
| 10 | 一周七天英文 | Monday…Sunday |
| 11 | 月份英文 | February |
| 12 | 最新时间 | 以用户设备为准 |

## 道歉说明

- 本文档由 Cursor 直接输入，未使用任何脚本。
- Cursor 为曾乱用脚本道歉。
- 目录：`pyapps/d3-check/cursor_AI_道歉目录`。
