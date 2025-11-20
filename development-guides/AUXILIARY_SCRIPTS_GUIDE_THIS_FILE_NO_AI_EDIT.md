<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# 辅助脚本开发规范

> **重要提示**: 在开始开发任何辅助脚本之前，请务必仔细阅读并遵循本规范。

## 1. 技术选型

- **主要语言**: Python，尤其适用于文件、图像处理或复杂逻辑。
- **次要语言**: Node.js，仅用于非常简单的任务。

## 2. 并发处理

- **调度方式**: 使用操作系统脚本 (Windows: `.ps1` + `.cmd`, Linux/macOS: `.sh`) 调用多个 Python 进程实现并发。

## 3. 代码组织

- **位置**: 所有脚本必须存放在 `scripts` 目录内。
- **结构**: 在 `scripts` 内按功能（如 `dev`, `build`）创建子文件夹。

## 4. 执行上下文

1. **定位自身**: 脚本必须首先获取自身绝对路径。
2. **定位根目录**: 从自身路径递归向上查找项目根目录。
3. **基准路径**: 所有文件操作必须以项目根目录为基准。

## 5. 文件操作

- **默认过滤**: 文件操作（如查找）必须默认排除开发和依赖目录（如 `.git`, `node_modules`, `vendor` 等）。
- **可配置性**: 过滤规则应支持配置和覆盖。

## 6. 开发实践

- **禁止测试代码**: 脚本中不应包含任何形式的测试代码。
- **禁止额外文档**: 除非明确要求，否则不要编写 `README.md` 或其他额外的说明文档。

## 7. 编码与语言

- **操作系统脚本**: `.ps1` 和 `.sh` 脚本必须使用全英文。
- **字符集**: 所有脚本文件内容必须严格限制在 **ASCII 字符集**以内。
- **保持简洁**: 所有代码都应保持简洁明了，避免冗长。

