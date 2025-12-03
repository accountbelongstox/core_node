# React Native Python Scripts - Architecture

## 架构原则

```
Python = 文件操作 + 纯逻辑 (NO subprocess)
Shell  = 所有命令执行 (pnpm, gradle, metro, adb, emulator)
文件变量 = 通信桥梁 (~/.core_node/.global_vars/)
```

## 目录结构

```
react_native_py_scripts/
├── Core Modules
│   ├── main_launcher.py          # 入口：扫描apps、显示菜单
│   ├── app_switcher.py           # App切换：更新配置文件
│   ├── factory_manager.py        # Factory管理：复制文件到工厂目录
│   ├── emulator_manager.py       # Emulator扫描：查找emulator路径
│   ├── app_scanner.py            # App发现：扫描src/apps
│   └── interactive_menu.py       # 交互菜单：选择app、模式、平台
│
├── Configuration
│   ├── config_keys.py            # 配置键标准定义
│   ├── default_config.py         # 默认配置值
│   ├── key_center.py             # 文件变量键定义
│   └── port_manager.py           # Metro端口管理
│
├── Utilities
│   ├── file_var_system.py        # 文件变量系统（高级API）
│   ├── global_var_manager.py     # 全局变量管理（底层API）
│   ├── project_locator.py        # 项目根路径定位
│   └── command_center.py         # 命令准备中心（已弃用junction相关）
│
├── Shell Adapters
│   ├── win_adapter/              # Windows PowerShell
│   │   ├── FileVarReader.ps1     # 读取文件变量
│   │   ├── KeyCenter.ps1         # 键定义（对应Python key_center.py）
│   │   └── PlatformBuilder.ps1   # 平台构建（Metro、Gradle、iOS）
│   └── sh_adapter/               # Linux Shell
│       └── file_var_reader.sh    # 读取文件变量
│
└── README.md                     # 文档说明
```

## Python ↔ Shell 通信协议

### Python写入 → Shell读取执行

| 键名 | Python写入位置 | Shell读取后执行 | 说明 |
|------|--------------|----------------|------|
| `FACTORY_BUILD_PATH` | factory_manager.py | `cd $path` | Factory目录路径 |
| `FACTORY_BUILD_ENABLED` | factory_manager.py | `pnpm install` | 是否启用factory build |
| `EMULATOR_PATH` | emulator_manager.py | - | Emulator可执行文件路径 |
| `EMULATOR_SCAN_REQUIRED` | emulator_manager.py | `emulator -list-avds` | 是否需要扫描AVD |
| `METRO_PORT` | app_switcher.py | `npx react-native start --port` | Metro bundler端口 |
| `APP_SWITCH_STATUS` | app_switcher.py | - | App切换状态（用于错误检查） |

### Shell写回 → Python读取

| 键名 | Shell写入 | Python读取用途 |
|------|----------|---------------|
| `EMULATOR_AVD` | start.ps1 | 启动指定AVD的emulator |
| `EMULATOR_AVAILABLE` | start.ps1 | 判断emulator是否可用 |

## 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                    1. Python执行阶段                         │
│  main_launcher.py → app_switcher.py → factory_manager.py   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    写入文件变量
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    2. Shell执行阶段                          │
│       start.ps1 / start.sh 读取文件变量并执行命令            │
└─────────────────────────────────────────────────────────────┘
```

### 详细步骤

**Python阶段**
```python
1. 扫描apps               → app_scanner.scan_apps()
2. 显示交互菜单            → interactive_menu.show_menu()
3. 切换app配置            → app_switcher.switch_app()
4. 复制文件到factory       → factory_manager.copy_project()
5. 查找emulator路径        → emulator_manager.store_emulator_info()
6. 写入文件变量:
   - FACTORY_BUILD_PATH
   - FACTORY_BUILD_ENABLED
   - EMULATOR_PATH
   - EMULATOR_SCAN_REQUIRED
   - METRO_PORT
```

**Shell阶段**
```powershell
1. 读取FACTORY_BUILD_PATH
2. cd到factory目录
3. pnpm install              # 在factory目录完整安装node_modules
4. 读取EMULATOR_SCAN_REQUIRED
5. emulator -list-avds       # 扫描可用AVD，写回EMULATOR_AVD
6. npx react-native start    # 启动Metro bundler
7. gradlew assembleDebug     # Android构建
8. adb install               # 安装APK
```

## 关键设计决策

### 1. 为什么不用Junction/Symlink连接node_modules？

**之前的设计**：复制项目到factory → 创建junction连接node_modules
**问题**：junction需要管理员权限，跨平台兼容性差
**当前设计**：pnpm在factory目录完整安装

### 2. 为什么不在Python中使用subprocess？

**原因**：
- subprocess跨平台兼容性差（Windows vs Linux命令不同）
- 错误处理复杂（需要处理stdout、stderr、exit codes）
- 无法利用Shell的环境变量和PATH配置
- Python异步调用subprocess会阻塞UI

**解决方案**：
- Python只负责文件操作和逻辑
- Shell负责所有命令执行
- 文件变量作为通信桥梁

### 3. Factory目录的作用

**目的**：隔离多个app的构建环境，避免相互干扰

**优势**：
- 每个app独立的node_modules
- 每个app独立的Android/iOS构建产物
- 不会污染源代码目录
- 可以并行构建多个app

**位置**：
- Windows: `D:\programing\.build_dir\react_native\{app_namespace}`
- Linux: `~/.build_dir/react_native/{app_namespace}`

## 文件变量系统

### 位置
- Windows: `C:\Users\{user}\.core_node\.global_vars\`
- Linux: `~/.core_node/.global_vars/`

### 命名规则
- **全局键**（无namespace）：直接使用键名
  - 例如：`FACTORY_BUILD_PATH` → 文件名 `FACTORY_BUILD_PATH`
- **命名空间键**：`{namespace}_{key}`
  - 例如：`RN_BUILD_MENU_SELECTION` → 文件名 `RN_BUILD_MENU_SELECTION`

### Python API
```python
# 全局键（无namespace）
from global_var_manager import GlobalVarManager
gvm = GlobalVarManager(namespace=None)
gvm.set("FACTORY_BUILD_PATH", "/path/to/factory")
value = gvm.get("FACTORY_BUILD_PATH")

# 命名空间键
gvm = GlobalVarManager(namespace="RN_BUILD")
gvm.set("MENU_SELECTION", {...})  # 写入到 RN_BUILD_MENU_SELECTION
```

### Shell API (PowerShell)
```powershell
# 全局键
$path = Get-GlobalFileVar -Key "FACTORY_BUILD_PATH"

# 命名空间键
$selection = Get-FileVarJson -Key "MENU_SELECTION"  # 读取 RN_BUILD_MENU_SELECTION
```

## 对齐检查清单

- [x] Python写入的所有键在key_center.py中定义
- [x] Shell的KeyCenter.ps1与Python的key_center.py对齐
- [x] Shell能读取所有Python写入的全局键
- [x] Shell执行命令后写回结果键
- [x] Python不使用subprocess
- [x] Factory目录检查关键文件（build.gradle, settings.gradle）
- [x] pnpm在factory目录完整安装node_modules
