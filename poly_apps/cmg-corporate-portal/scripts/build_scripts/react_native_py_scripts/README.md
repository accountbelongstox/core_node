# React Native Multi-App Build System - Python Scripts

## 架构原则

```
Python Layer  = 文件操作 + 纯逻辑 (NO subprocess)
Shell Layer   = 所有命令执行
File Variables = 通信桥梁 (~/.core_node/.global_vars/)
Trust-Based Programming = Shell信任Python输出，无冗余验证
```

### 信任式编程 (Trust-Based Programming)

- Python负责验证和准备，Shell直接执行
- Shell不进行冗余的防御性检查
- 如果Python写入 `FACTORY_BUILD_ENABLED=true`，Shell直接使用，不再验证
- 如果Python写入 `EMULATOR_PATH`，Shell直接执行，不再检查文件存在性
- pnpm、gradle等工具自己处理依赖检查，不要重复判断

## 职责划分

### Python (文件操作+逻辑)
- ✅ 文件复制 (shutil.copy2, copytree)
- ✅ 路径扫描 (Path.exists, glob)
- ✅ 配置解析 (INI, JSON)
- ✅ 逻辑判断 (if/else, loops)
- ✅ 写入文件变量
- ❌ **禁止subprocess - 不执行任何命令**

### Shell (命令执行)
- ✅ pnpm install (读取FACTORY_BUILD_PATH后在factory目录完整安装)
- ✅ emulator -list-avds (读取EMULATOR_*后执行)
- ✅ gradle assembleDebug
- ✅ npx react-native start
- ✅ adb install

## 文件变量键 (key_center.py)

### Factory Build
```python
FACTORY_BUILD_PATH          # Factory目录路径
FACTORY_BUILD_ENABLED       # 是否启用factory build
```

### Emulator
```python
EMULATOR_PATH               # emulator可执行文件路径
EMULATOR_SCAN_REQUIRED      # true=需要扫描AVD列表
EMULATOR_AVD                # 选中的AVD名称 (Shell写回)
EMULATOR_AVAILABLE          # true=emulator可用
```

### Metro & Build
```python
METRO_PORT                  # Metro bundler端口
APP_SWITCH_STATUS           # App切换状态
```

## 工作流程

### 1. Python执行 (main_launcher.py → app_switcher.py → factory_manager.py)

```python
# 1. 扫描apps
apps = scan_apps(project_root)

# 2. 用户选择app (interactive_menu)
show_interactive_menu(menu_items)

# 3. 切换app配置
switch_app(project_root, selected_app)

# 4. 复制文件到factory (Python负责)
factory_manager.copy_project()
# 写入: FACTORY_BUILD_PATH, FACTORY_BUILD_ENABLED

# 5. 查找emulator路径
store_emulator_info()
# 写入: EMULATOR_PATH, EMULATOR_SCAN_REQUIRED
```

### 2. Shell读取并执行 (start.ps1 / start.sh)

```powershell
# 1. 读取factory路径 (信任式编程 - 直接使用Python写入的值)
$factoryPath = Get-GlobalFileVar "FACTORY_BUILD_PATH"

# 2. 自动安装依赖 (pnpm自己判断是否需要安装)
cd $factoryPath
pnpm install

# 3. 扫描emulator (信任式编程 - Python已验证路径)
if (Get-GlobalFileVar "EMULATOR_SCAN_REQUIRED" -eq "true") {
    $emulatorPath = Get-GlobalFileVar "EMULATOR_PATH"
    $avds = & $emulatorPath -list-avds
    # 写回: EMULATOR_AVD
}

# 4. 启动Metro
$metroPort = Get-GlobalFileVar "METRO_PORT"
npx react-native start --port $metroPort

# 5. 构建Android
cd "$factoryPath/android"
.\gradlew assembleDebug

# 6. 安装APK
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## 核心模块

### command_center.py
统一命令准备中心 (只写文件变量，不执行命令)

```python
cmd = CommandCenter()

# 准备emulator扫描
cmd.prepare_emulator_list_command(emulator_path)
```

### factory_manager.py
Factory目录管理 (Python负责文件复制)

```python
fm = FactoryManager(project_root, app_namespace)

# 工厂目录策略：递增命名
# D:/programing/.build_dir/react_native/app_name/app_name1
# D:/programing/.build_dir/react_native/app_name/app_name2
# ...

# 显示交互菜单选择目录
selected_path = fm.show_factory_directory_menu()
fm.set_factory_path(selected_path)

# 逐文件对比，智能复制
# - 新目录：全量复制
# - 旧目录：增量复制（只复制changed/new文件）
is_existing = selected_path.exists()
fm.copy_project(incremental=is_existing)
# pnpm会在factory目录完整安装node_modules (Shell执行)
```

**Factory目录选择菜单**:
- 默认选项：使用新目录（递增编号）
- 可选：使用旧目录（增量更新）
- 显示每个目录的状态（up to date / changed files / new files）

### emulator_manager.py
Emulator路径扫描 (只查找路径，不执行命令)

```python
# 查找emulator路径并写入文件变量
store_emulator_info()
# Shell读取后执行: emulator -list-avds
```

### app_switcher.py
App切换逻辑

```python
# 更新app.json, index.js, AndroidManifest.xml
switch_app(project_root, app_namespace)
```

## Shell适配器

### Windows (win_adapter/)
- FileVarReader.ps1 - 读取文件变量
- KeyCenter.ps1 - 键定义
- PlatformBuilder.ps1 - 执行构建命令

### Linux (sh_adapter/)
- file_var_reader.sh - 读取文件变量
- 执行构建命令

## 文件变量位置

- Windows: `C:\Users\{user}\.core_node\.global_vars\`
- Linux: `~/.core_node/.global_vars/`

## 关键修复

### 1. Factory目录智能管理
**策略**: 递增目录命名 + 逐文件对比 + 交互菜单选择
```python
# 目录命名: app_name1, app_name2, app_name3...
# 逐文件对比: 检查所有文件的timestamp (除了node_modules等缓存)
# 交互菜单: 显示所有已存在目录的状态，默认使用新目录
```
**优点**:
- 保留多个构建版本，可快速切换
- 增量复制节省时间（旧目录只复制changed/new文件）
- 避免覆盖导致的问题

### 2. 让pnpm自己处理
**问题**: pnpm显示"Already up to date"但node_modules可能不完整
**修复**: 直接调用`pnpm install`，让pnpm自己判断是否需要安装
```powershell
pnpm install  # pnpm通过lockfile判断是否需要安装
# 不要重复pnpm的工作 - 信任工具自己的判断
```

### 3. 跳过android_prebuild
**问题**: android_prebuild.main()使用argparse，不接受直接传参
**修复**: app_switcher.py跳过android_prebuild调用
- Icon处理可以手动完成
- 避免违反"NO subprocess"原则

## Python和Shell对齐检查清单

- [x] Python写入的所有键在key_center.py中定义
- [x] Shell能读取所有Python写入的键
- [x] Shell执行命令后写回结果键
- [x] Python读取Shell写回的结果
- [x] 没有任何subprocess调用
- [x] 实施信任式编程 - Shell不进行冗余验证
- [x] 让工具自己处理 - pnpm/gradle自己判断是否需要工作

## 示例：完整流程

```bash
# 1. Python准备
cd poly_apps/react_native/scripts
python build_scripts/react_native_py_scripts/main_launcher.py

# Python执行:
# - 复制文件到 D:\programing\.build_dir\react_native\awy
# - 写入 FACTORY_BUILD_PATH
# - 写入 EMULATOR_SCAN_REQUIRED=true

# 2. Shell执行
.\start.ps1

# Shell执行:
# - 读取 FACTORY_BUILD_PATH
# - cd D:\programing\.build_dir\react_native\awy
# - pnpm install (在factory目录完整安装node_modules)
# - emulator -list-avds (读取EMULATOR_PATH)
# - npx react-native start
# - .\gradlew assembleDebug
# - adb install
```
