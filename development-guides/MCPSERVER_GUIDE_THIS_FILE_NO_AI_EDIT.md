<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# MCP Server 本地开发指南

## 1. 概述

### 1.1 核心原则
本项目支持在 `D:\programing\core_node\ncore\mcp_server` 目录下开发独立的 MCP 服务。每个子目录代表一个独立的 MCP 服务，推荐使用 Python 技术栈开发。
当前文档目录 `$DocDir`, 项目根目录 `$RootDir` = `$DocDir/..`

### 1.2 工作流程
1. 在 `$RootDir/ncore/mcp_server/` 下创建 MCP 服务目录
2. 开发 MCP 服务（推荐使用 Python 3.13）
3. **⚠️ 增量更新** `$RootDir/_prompt/mcpWindowsTemplate.json` and  `$RootDir/_prompt/mcpLinuxTemplate.json` 配置文件（严禁删除重建）

**重要提醒**: `$RootDir/_prompt/mcpWindowsTemplate.json` and  `$RootDir/_prompt/mcpLinuxTemplate.json`  文件只能增量添加新服务配置，绝对不允许删除重建！

**特殊MCP node .\main.js app=core_node，该MCP由 ../main.js启动并位于D:\programing\core_node\apps\core_node_init目录**
特殊MCP不在`core_node/ncore/mcp_server`目录


### 1.3 技术要求
- 使用绝对路径启动命令,无需安装步骤，直接启动运行
- 路径使用正斜杠 `/` 格式，Windows和Linux都使用 `/` 方式
- 每个MCP服务需要同时服务多个AI，所以要有明确的规范与AI协调命名空间（有可能同名的多个AI访问比如claude 1 ,claude 2）
- MCP虽然是单例、支持多个AI并发使用命名空间访问同一MCP，但对于后面启动的AI，不能让AI认为MCP没有启动成功，而是要让AI知道服务已经启动
- 编码只能使用ASCII码
- MCP中对话sessions或临时目录等都要有`tmp_`前缀，便于github 的.gitignore 忽略;
- 每个MCP服务必须实现一个常量类（Constants），包含服务配置、路径、环境变量等
- **路径自动推导**: PROJECT_ROOT、SERVICE_ROOT、PYTHONPATH等路径都通过代码自动推导，不再通过环境变量传递
- **模板路径规范**:
  - Windows模板: `D:/programing/core_node/ncore/mcp_server/service/main.py`
  - WSL模板: `/mnt/d/programing/core_node/ncore/mcp_server/service/main.py`
  - Linux模板: `/www/wwwroot/core_node/ncore/mcp_server/service/main.py`
- **日志输出规范**: MCP使用stdio进行JSON-RPC通信，stdout必须保持纯净只用于JSON消息，所有日志必须输出到stderr
  - ✅ 正确: `logging.StreamHandler(sys.stderr)`
  - ❌ 错误: `logging.StreamHandler(sys.stdout)` 或 `print()` 语句
  - 原因: 任何非JSON的stdout输出都会破坏MCP协议，导致 "Unexpected non-whitespace character" 错误
- 开发中禁止写测试代码、运行测试命令、编写文档。

### 1.4 常量类规范
每个MCP服务必须实现一个常量类，包含以下内容：

```python
class ServiceNameConstants:
    # 服务信息
    SERVICE_NAME = "ServiceName"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Service description"
    
    # 自动检测项目根目录（3级向上）
    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    
    # 服务路径
    SERVICE_ROOT = _CURRENT_DIR
    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "service.log"
    
    # 必需包
    REQUIRED_PACKAGES = ["mcp", "package1", "package2"]
    
    # 环境变量（路径自动推导，不通过环境变量传递）
    ENV_VARS = {
        "MCP_ALLOW_ALL_PATHS": "true"
    }
    
    # MCP工具能力
    TOOL_CAPABILITIES = ["tool1", "tool2", "health_check"]
    AUTO_APPROVE_TOOLS = ["tool1", "tool2", "health_check"]
```

### 1.5 开发后的MCP更新 mcpWindowsTemplate.json 和 mcpLinuxTemplate.json、mcpUbuntoDesktopTemplate.jso、mcpWSLTemplate.json 文件
**🚨 严禁删除重建 Template 文件！**
- **只能增量添加**: 向现有配置中添加新的 MCP 服务配置
- **禁止删除重建**: 绝对不允许删除整个文件后重新创建
- **禁止覆盖**: 不能用新内容完全覆盖现有配置
- **保持现有配置**: 必须保留所有已存在的服务配置
- **增量修改**: 只能在 `mcpServers` 对象中添加新的服务条目
- **启动命令规范**: `mcpWindowsTemplate` 需要加上 `"command": "cmd", "/c"` 前缀启动命令
- **路径格式**: 使用正斜杠 `/` 格式，具体路径规范：
  - Windows模板: `D:/programing/core_node/ncore/mcp_server/service/main.py`
  - WSL模板: `/mnt/d/programing/core_node/ncore/mcp_server/service/main.py`
  - Linux模板: `/www/wwwroot/core_node/ncore/mcp_server/service/main.py`
- **环境变量**: 不再传递路径相关环境变量，路径通过代码自动推导


