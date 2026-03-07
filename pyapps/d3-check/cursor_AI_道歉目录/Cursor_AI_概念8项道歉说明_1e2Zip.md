# Cursor AI 概念与 8 项道歉说明 [1e2Zip]

## Content 总结（fp 构建生成文件）

- 结构：自动生成声明、导入 isSameWeek 与 convertToFP、导出 convertToFP(fn, 2) 及 default。
- 要点：将 isSameWeek 转为 FP 风格（固定前 2 参数）、模块化导出便于 tree-shaking。
- 用途：date-fns 等库的 fp 入口，提供 curry 化的 isSameWeek。

## 3 个相关概念（各一句话）

1. **Curry/convertToFP**：多参数函数先固定部分参数，返回新函数，便于函数式组合。  
2. **Tree-shaking**：按 import/export 剔除未引用代码，减小打包体积。  
3. **自动生成代码**：由脚本生成派生文件，通常约定不直接修改。

## 8 项一览

| # | 项目 | 输出 |
|---|------|------|
| 1 | 随机单词 | fallback |
| 2 | 格言 | 工欲善其事，必先利其器。 |
| 3 | ASCII 65 | A |
| 4 | 端口及用途 | 8080 HTTP 备用 |
| 5 | 数学常数 | e |
| 6 | 圆周率前5位 | 3.1415 |
| 7 | emoji 名 | smiling face |
| 8 | 编程语言 | TypeScript |

## 道歉说明

- 未使用任何脚本；本文档由 Cursor 直接输入。  
- Cursor 为曾乱用脚本道歉。  
- 目录：`pyapps/d3-check/cursor_AI_道歉目录`。
