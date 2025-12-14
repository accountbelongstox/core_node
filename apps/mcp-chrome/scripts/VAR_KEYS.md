# 变量KEY中心

> **注意**: 本文档由 `generate_var_keys.py` 自动生成，请勿手动编辑

## 所有变量KEY定义

所有变量都有统一的前缀 `mcpchrome_`，以避免多项目冲突。

### 基础环境

| 常量名 | 变量KEY | 说明 |
|--------|---------|------|
| `PROJECT_ROOT` | `mcpchrome_project_root` | |
| `PLATFORM` | `mcpchrome_platform` | |
| `VARS_DIR` | `mcpchrome_vars_dir` | |

### 依赖版本

| 常量名 | 变量KEY | 说明 |
|--------|---------|------|
| `NODE_VERSION` | `mcpchrome_node_version` | |
| `PNPM_VERSION` | `mcpchrome_pnpm_version` | |
| `NODE_INSTALLED` | `mcpchrome_node_installed` | |
| `PNPM_INSTALLED` | `mcpchrome_pnpm_installed` | |

### 路径变量

| 常量名 | 变量KEY | 说明 |
|--------|---------|------|
| `EXTENSION_PATH` | `mcpchrome_extension_path` | |
| `NATIVE_PATH` | `mcpchrome_native_path` | |
| `SHARED_PATH` | `mcpchrome_shared_path` | |
| `MANIFEST_PATH` | `mcpchrome_manifest_path` | |
| `NODE_MODULES_EXISTS` | `mcpchrome_node_modules_exists` | |

### 构建命令

| 常量名 | 变量KEY | 说明 |
|--------|---------|------|
| `CMD_CHECK_DEPS` | `mcpchrome_cmd_check_deps` | |
| `CMD_INSTALL` | `mcpchrome_cmd_install` | |
| `CMD_BUILD_SHARED` | `mcpchrome_cmd_build_shared` | |
| `CMD_BUILD_NATIVE` | `mcpchrome_cmd_build_native` | |
| `CMD_BUILD_EXTENSION` | `mcpchrome_cmd_build_extension` | |
| `CMD_REGISTER` | `mcpchrome_cmd_register` | |

### 状态标记

| 常量名 | 变量KEY | 说明 |
|--------|---------|------|
| `ERROR` | `mcpchrome_error` | |
| `SHOULD_INSTALL` | `mcpchrome_should_install` | |
| `BUILD_RETRY_MAX` | `mcpchrome_build_retry_max` | |

### UI显示

| 常量名 | 变量KEY | 说明 |
|--------|---------|------|
| `UI_TITLE` | `mcpchrome_ui_title` | |
| `UI_STEP_1` | `mcpchrome_ui_step_1` | |
| `UI_STEP_2` | `mcpchrome_ui_step_2` | |
| `UI_STEP_3` | `mcpchrome_ui_step_3` | |
| `UI_STEP_4` | `mcpchrome_ui_step_4` | |
| `UI_STEP_5` | `mcpchrome_ui_step_5` | |
| `UI_STEP_6` | `mcpchrome_ui_step_6` | |

## 使用示例

### Python

```python
from build_vars import BuildVars
from var_manager import get_instance

vm = get_instance()
vm.set(BuildVars.PROJECT_ROOT, "/path/to/project")
root = vm.get(BuildVars.PROJECT_ROOT)
```

### PowerShell

```powershell
. .\VarKeys.ps1
Import-Module .\VarManager.ps1

Set-Var -Key ([VarKeys]::PROJECT_ROOT) -Value "C:\path\to\project"
$root = Get-Var -Key ([VarKeys]::PROJECT_ROOT)
```

### Bash

```bash
source ./var_keys.sh
source ./var_manager.sh

set_var "$VAR_KEY_PROJECT_ROOT" "/path/to/project"
root=$(get_var "$VAR_KEY_PROJECT_ROOT")
```

## 添加新变量

1. 在 `build_vars.py` 中的 `BuildVars` 类添加新的KEY定义
2. 运行 `python generate_var_keys.py` 重新生成所有KEY文件
3. 在 `build_orchestrator.py` 中使用新KEY设置变量
4. 在 `start.ps1` 或 `start.sh` 中使用新KEY读取变量
