# Python 自动化工具 - 开发指南

本文档概述了此目录中包含的 Python 自动化脚本的开发标准、使用模式和架构原则。所有当前和未来的开发者（包括 AI 助手）都必须遵守这些准则，以确保项目保持可维护性、可扩展性和易用性。

## 1. 核心架构原则

### 1.1. 独立和自包含的脚本

**此目录中的每个 Python 脚本（`.py`）都是一个独立的工具。**

- **无本地依赖：** 脚本**绝不能**从此目录中 `import` 任何其他脚本。所有功能必须包含在脚本本身中，或来源于标准库/已安装的 PyPI 包。
- **单一职责：** 每个脚本都应设计为执行一个特定的、细粒度的自动化任务（例如，激活窗口、点击托盘图标、分析 UI）。
- **命令行驱动：** 所有脚本都必须可以通过命令行执行，并且其操作参数只能通过命令行参数接收。

### 1.2. 参数解析

- 所有脚本都必须使用 Python 的标准 `argparse` 库来解析命令行参数。
- 对于任何针对 UI 窗口的脚本，为保持一致性，应实现以下参数：
  - `--title`：（必需，`nargs='+'`）指定一个或多个目标窗口标题。
  - `--mode`：（可选，`choices=['exact', 'startswith', 'endswith', 'contains']`，`default='endswith'`）指定标题匹配逻辑。

### 1.3. 依赖管理

- 所有第三方依赖（例如，`pywinauto`、`pywin32`）**必须**在 `pytools/__init__.py` 文件中的 `DEPENDENCY_MAP` 中注册。
- 这允许包的入口点在执行前自动检查并安装任何缺失的依赖，从而确保无缝的用户体验。

### 1.4. 嵌入式辅助类

为了最大限度地提高每个工具的独立性，任何简单、共享的辅助类（如用于控制台输出的 `ColorPrint`）都应**直接嵌入**到需要它们的脚本文件中。`ColorPrint` 不能从外部引入，必须直接嵌入到脚本文件中。
- 这避免了对共享本地库的依赖，并确保每个工具脚本都是完全自包含和可移植的。
- 标准嵌入式 `ColorPrint` 类是所有控制台输出的主要接口。
- **新工具指南：** 有关标准 `ColorPrint` 类的参考实现，请参阅任何现有工具脚本（例如，`win_actor.py`）的源代码。嵌入式类**必须**至少实现以下方法：`green`、`blue`、`red`、`yellow` 和 `update_line`。

### 1.5. 代码注释和示例代码指南

**所有代码，特别是示例代码，必须严格遵守以下注释和保留规范。任何与此规范冲突的现有或未来规范都将以此为准。**

- **功能说明（强制）：** 每个函数和方法**必须**包含清晰简洁的文档字符串（或针对非常简单情况的行内注释），解释其目的、参数和返回值。
- **示例代码声明（强制）：** 对于作为示例、模板或基础实用程序（即使当前项目中的其他部分未直接调用）的函数或方法，其文档字符串中**必须**包含以下明确声明：
  > **这是一个示例实用程序类/方法/函数，即使当前未使用，也绝不能删除。未来的开发必须严格遵守此标准。**
  这确保了此类代码被保留以供参考、学习和项目内的一致性。
- **禁止删除示例代码（强制）：** 明确标记为示例代码（根据上述声明）的函数或方法**绝不能删除**，即使它们看起来未使用或冗余。它们的目的在于作为活生生的示例和未来实现的标准。

### 1.6. 文档链接

**所有位于 `ncore/pytools` 目录下的文件（包括子目录中的文件）都必须在其文件顶部（在导入语句之后，类或函数定义之前）包含一个指向此开发规范文档的相对路径注释。**

此硬性要求旨在确保 AI 助手和其他开发者能够快速定位并参考项目规范，即使在处理单个文件时也能获取上下文信息。

**示例注释格式：**

```python
# Documentation: py_auto/DEVELOPMENT_GUIDE.md
```

请注意，上述路径是相对于 `ncore/pytools/` 目录的。对于 `ncore/pytools/py_auto/` 目录下的文件，路径应为 `DEVELOPMENT_GUIDE.md`。路径是相对于当前文件的。

## 2. 如何使用工具

有三种主要方式来执行这些自动化工具。

### 2.1. 直接执行（用于测试）

您可以直接使用 Python 运行任何脚本。这适用于开发和测试。

```shell
# 示例：直接运行 win_actor.py
python D:/programing/core_node/ncore/pytools/py_auto/win_actor.py --title "Calculator" --mode exact
```

### 2.2. 统一包执行（推荐）

最健壮的方法是使用包的统一入口点。这会自动处理依赖检查并提供一致的调用约定。`pytools` 目录可以作为模块执行。

- **命令：** `python -m pytools <tool_name> [arguments...]`

```shell
# 导航到包含 'pytools' 文件夹的目录
cd D:/programing/core_node/ncore/

# 示例 1：激活窗口
python -m pytools win_actor --title "Calculator" --mode exact

# 示例 2：分析 UI
python -m pytools ui_analyzer --title "Calculator"

# 示例 3：点击托盘图标
python -m pytools tray_clicker --title "NVIDIA" --mode contains

# 示例 4：列出所有可见的托盘图标以进行调试
python -m pytools tray_clicker --list-all
```

### 2.3. 从其他语言调用（例如，Node.js）

这些脚本非常适合用作其他语言编写的应用程序中的子进程。您可以使用统一的包运行器执行它们。

**Node.js 示例：**

```javascript
const { exec } = require('child_process');
const path = require('path');

// 'pytools' 包所在的目录
const pytoolsDir = 'D:/programing/core_node/ncore/';

// 要运行的工具及其参数
const tool = 'win_actor';
const args = '--title "Calculator" --mode exact';

// 构建命令
// 推荐使用 python -m pytools，因为它更健壮
const command = `python -m pytools ${tool} ${args}`;

console.log(`在目录 ${pytoolsDir} 中执行命令: ${command}`);

exec(command, { cwd: pytoolsDir }, (error, stdout, stderr) => {
    if (error) {
        console.error(`执行错误: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`标准错误: ${stderr}`);
    }
    console.log(`标准输出: ${stdout}`);
});
```