# 跨平台构建系统架构

## 概述

这个构建系统使用统一的架构，通过 Python 处理跨平台差异，Shell/PowerShell 负责实际命令执行。

## 架构设计

```
start.ps1/start.sh (入口脚本)
    ↓
调用 Python 脚本 (build_orchestrator.py)
    ↓
Python 处理逻辑，生成变量文件
    ↓
Shell 读取变量文件
    ↓
执行实际的 pnpm/编译命令
```

## 核心原则

1. **Python 只负责逻辑处理**：不执行任何 shell 命令，只处理跨平台差异并生成配置
2. **Shell 只负责命令执行**：读取 Python 生成的变量，执行实际的构建命令
3. **文件变量交换**：Python 和 Shell 通过文件系统交换数据，不直接传参
4. **统一变量管理**：所有变量都有前缀 `mcpchrome_`，避免多项目冲突

## 目录结构

```
scripts/
├── build_vars.py           # 变量中心 Key 定义
├── var_manager.py          # Python 变量管理库
├── VarManager.ps1          # PowerShell 变量管理库
├── var_manager.sh          # Bash 变量管理库
├── build_orchestrator.py   # Python 主逻辑（跨平台差异处理）
├── start.ps1               # Windows 入口脚本
├── start.sh                # Linux/macOS 入口脚本
└── BUILD_SYSTEM.md         # 本文档
```

## 变量存储位置

### Windows
```
C:\Users\用户名\.core_node\.build_global_vars\
```

### Linux/macOS
```
/var/_core_node/_build_global_vars/  (如果有权限)
或
~/.core_node/.build_global_vars/     (降级方案)
```

## 变量命名规范

所有变量都使用 `mcpchrome_` 前缀，在 `build_vars.py` 中统一定义：

### 基础环境变量
- `mcpchrome_project_root` - 项目根目录
- `mcpchrome_platform` - 平台（windows/linux/darwin）
- `mcpchrome_vars_dir` - 变量存储目录

### 依赖版本
- `mcpchrome_node_version` - Node.js 版本
- `mcpchrome_pnpm_version` - pnpm 版本
- `mcpchrome_node_installed` - Node.js 是否已安装
- `mcpchrome_pnpm_installed` - pnpm 是否已安装

### 路径变量
- `mcpchrome_extension_path` - 扩展输出路径
- `mcpchrome_native_path` - Native Server 路径
- `mcpchrome_shared_path` - Shared 包路径
- `mcpchrome_manifest_path` - Native Messaging Host manifest 路径
- `mcpchrome_node_modules_exists` - node_modules 是否存在

### 构建命令
- `mcpchrome_cmd_check_deps` - 检查依赖命令
- `mcpchrome_cmd_install` - 安装依赖命令
- `mcpchrome_cmd_build_shared` - 构建 shared 包命令
- `mcpchrome_cmd_build_native` - 构建 native server 命令
- `mcpchrome_cmd_build_extension` - 构建扩展命令
- `mcpchrome_cmd_register` - 注册 Native Messaging Host 命令

### 状态标记
- `mcpchrome_error` - 错误信息
- `mcpchrome_should_install` - 是否需要安装依赖
- `mcpchrome_build_retry_max` - 构建最大重试次数

### UI 显示
- `mcpchrome_ui_title` - UI 标题
- `mcpchrome_ui_step_1` ~ `mcpchrome_ui_step_6` - 各步骤描述

## 使用方法

### Windows
```powershell
.\scripts\start.ps1
```

### Linux/macOS
```bash
chmod +x ./scripts/start.sh
./scripts/start.sh
```

## 工作流程

### 1. Python 阶段（build_orchestrator.py）

```python
from var_manager import get_instance as get_var_manager
from build_vars import BuildVars

vm = get_var_manager()

# 检测环境
vm.set(BuildVars.PLATFORM, "windows")
vm.set(BuildVars.PROJECT_ROOT, "/path/to/project")

# 生成命令
vm.set(BuildVars.CMD_BUILD_SHARED, "pnpm run build:shared")
```

### 2. Shell 阶段（start.ps1 / start.sh）

**PowerShell:**
```powershell
Import-Module .\VarManager.ps1
$platform = Get-Var -Key "mcpchrome_platform"
$cmdBuildShared = Get-Var -Key "mcpchrome_cmd_build_shared"
Invoke-Expression $cmdBuildShared
```

**Bash:**
```bash
source ./var_manager.sh
platform=$(get_var "mcpchrome_platform")
cmd_build_shared=$(get_var "mcpchrome_cmd_build_shared")
eval "$cmd_build_shared"
```

## 扩展指南

### 添加新变量

1. 在 `build_vars.py` 中定义变量 Key：
```python
class BuildVars:
    NEW_VAR = f"{PREFIX}new_var"
```

2. 在 `build_orchestrator.py` 中设置变量：
```python
self.vm.set(BuildVars.NEW_VAR, "value")
```

3. 在 Shell 脚本中读取变量：
```powershell
$newVar = Get-Var -Key "mcpchrome_new_var"
```

### 添加新的构建步骤

1. 在 `build_orchestrator.py` 中生成命令
2. 在 `start.ps1` 和 `start.sh` 中读取并执行命令
3. 保持两个脚本的逻辑一致

## 优点

1. **跨平台一致性**：Python 处理差异，Shell 执行命令
2. **易于维护**：业务逻辑集中在 Python，Shell 只负责执行
3. **解耦设计**：Python 和 Shell 通过文件变量通信，互不依赖
4. **变量集中管理**：所有变量 Key 在一处定义，避免拼写错误
5. **多项目支持**：变量前缀机制避免冲突
6. **可扩展**：添加新功能只需修改 Python 和 Shell 脚本

## 调试

### 查看所有变量

**PowerShell:**
```powershell
Import-Module .\scripts\VarManager.ps1
Get-AllVars
```

**Bash:**
```bash
source ./scripts/var_manager.sh
list_all_vars
```

**Python:**
```python
from var_manager import get_instance
vm = get_instance()
print(vm.list_all())
```

### 清除所有变量

**PowerShell:**
```powershell
Clear-AllVars
```

**Bash:**
```bash
clear_all_vars
```

**Python:**
```python
vm.clear_all()
```

## 注意事项

1. 确保 Python 3.7+ 已安装
2. 变量文件名不能包含特殊字符
3. 变量内容不应包含换行符（用于单行值）
4. Windows 用户需要有创建 `.core_node` 目录的权限
5. Linux 用户如果没有 `/var` 写权限，会自动降级到用户目录

## 故障排除

### Python 脚本失败
检查 `mcpchrome_error` 变量：
```powershell
Get-Var -Key "mcpchrome_error"
```

### 变量未找到
确保 Python 脚本成功运行，检查变量目录是否存在。

### 路径问题
所有路径变量都是绝对路径，检查它们是否正确。
