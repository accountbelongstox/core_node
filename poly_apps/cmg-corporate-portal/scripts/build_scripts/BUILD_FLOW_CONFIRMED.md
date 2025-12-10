# Android Build 流程确认 ✅

**状态：** 流程一致，符合预期

---

## 完整流程图

### 用户操作：`.\start.ps1` → 选择 `4` (Build for Android)

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: PowerShell 启动 Python                              │
└─────────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Python 处理所有准备工作                             │
│ (main_controller.py::prepare_android_build)                 │
└─────────────────────────────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 1: 准备 Capacitor 资源            │
    │ - capacitor_resource_manager.py       │
    │ - 验证 assets/logo.png 尺寸           │
    │ - 复制到 resources/icon.png           │
    │ - 验证 assets/splash.png (可选)       │
    │ - 更新 capacitor.config.ts            │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 2: 扫描 Android 资源 (替换前)     │
    │ - resource_scanner.py                 │
    │ - 收集所有图标和启动屏幕              │
    │ - 生成 JSON 报告                      │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 3: 智能替换资源                   │
    │ - resource_replacer.py                │
    │ - 读取目标文件尺寸                    │
    │ - 等比例缩放源图片                    │
    │ - 中心裁剪到精确尺寸                  │
    │ - 替换 15+ 图标文件                   │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 4: 重新扫描 (替换后)              │
    │ - resource_scanner.py                 │
    │ - 验证替换结果                        │
    │ - 生成最终报告                        │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 5: 启动 Web 预览服务器            │
    │ - web_preview_server.py               │
    │ - http://127.0.0.1:8899               │
    │ - 自动打开浏览器                      │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 6: 等待用户确认                   │
    │ ┌─────────────────────────────────┐   │
    │ │ Options:                        │   │
    │ │  1. Click 'Continue Building'   │   │
    │ │  2. Click 'Cancel'              │   │
    │ │  3. Press 'Y' here to continue  │   │
    │ │  4. Press 'N' to cancel         │   │
    │ └─────────────────────────────────┘   │
    │                                       │
    │ Continue? [Y/n]: ___                  │
    └───────────────────────────────────────┘
            ↓
        [用户输入 'Y']
            ↓
    ┌───────────────────────────────────────┐
    │ Step 7: Python 添加编译命令到队列       │
    │ ┌─────────────────────────────────┐   │
    │ │ Command 1: build_web            │   │
    │ │   → pnpm run build              │   │
    │ │                                 │   │
    │ │ Command 2: sync_capacitor_android│  │
    │ │   → npx cap sync android        │   │
    │ │                                 │   │
    │ │ Command 3: build_android_apk    │   │
    │ │   → gradlew assembleDebug       │   │
    │ └─────────────────────────────────┘   │
    │                                       │
    │ var_system.add_command() × 3          │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 8: Python 设置成功标记             │
    │ var_system.set_var(                   │
    │   "PYTHON_SUCCESS", "true"            │
    │ )                                     │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Step 9: Python 退出                    │
    │ print("[Python] Preparation complete. │
    │        Shell can now execute commands")│
    │                                       │
    │ main() 函数结束                        │
    │ Python 进程终止                        │
    └───────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: PowerShell 接管，执行编译命令                       │
│ (execute_commands_windows_new.ps1)                          │
└─────────────────────────────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Shell 读取 Python 状态                 │
    │ $pythonSuccess = Get-VarValue         │
    │   -Key "PYTHON_SUCCESS"               │
    │                                       │
    │ if ($pythonSuccess -ne "true") {      │
    │   exit 1  # 错误退出                  │
    │ }                                     │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Shell 读取命令数量                     │
    │ $commandCount = Get-CommandCount      │
    │ # 应该是 3                            │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Shell 循环执行所有命令                 │
    │                                       │
    │ for ($i = 0; $i -lt 3; $i++) {       │
    │   $cmd = Get-Command -Index $i        │
    │   Execute-Command -CommandType $cmd   │
    │ }                                     │
    └───────────────────────────────────────┘
            ↓
        执行 Command 1
            ↓
    ┌───────────────────────────────────────┐
    │ Build-Web                             │
    │ ┌─────────────────────────────────┐   │
    │ │ cd $projectRoot                 │   │
    │ │ pnpm run build                  │   │
    │ │                                 │   │
    │ │ → 编译 React/Vue 等 Web 资源     │   │
    │ │ → 输出到 dist/ 或 build/        │   │
    │ └─────────────────────────────────┘   │
    └───────────────────────────────────────┘
            ↓
        执行 Command 2
            ↓
    ┌───────────────────────────────────────┐
    │ Sync-CapacitorAndroid                 │
    │ ┌─────────────────────────────────┐   │
    │ │ cd $projectRoot                 │   │
    │ │ npx cap sync android            │   │
    │ │                                 │   │
    │ │ → 复制 Web 资源到 Android       │   │
    │ │ → 更新 Capacitor 插件           │   │
    │ │ → 同步配置                      │   │
    │ └─────────────────────────────────┘   │
    └───────────────────────────────────────┘
            ↓
        执行 Command 3
            ↓
    ┌───────────────────────────────────────┐
    │ Build-AndroidApk                      │
    │ ┌─────────────────────────────────┐   │
    │ │ cd $androidPath                 │   │
    │ │ .\gradlew assembleDebug         │   │
    │ │                                 │   │
    │ │ → 编译 Android 项目              │   │
    │ │ → 生成 APK                      │   │
    │ │ → 输出到 app/build/outputs/apk/ │   │
    │ └─────────────────────────────────┘   │
    └───────────────────────────────────────┘
            ↓
    ┌───────────────────────────────────────┐
    │ Shell 完成                            │
    │ Write-Header "Execution Complete"     │
    └───────────────────────────────────────┘
            ↓
        ✅ 构建完成！
            ↓
    APK 文件位置：
    android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 关键代码确认

### 1. Python 添加命令队列 (main_controller.py:401-425)

```python
# 用户确认后
user_continues = show_preview(resource_data, port=8899)

if not user_continues:
    # 用户取消
    print("[Python] Build cancelled by user")
    self.var_system.set_var("ERROR", "user_cancelled")
    return  # Python 退出，不添加命令

# 用户确认 'Y'
print("\n[Python] User confirmed, continuing with build...")

# 清空旧命令
self.var_system.clear_commands()

# 添加 3 个编译命令
self.var_system.add_command(
    "build_web",
    "Build web assets",
    str(self.project_root)
)

self.var_system.add_command(
    "sync_capacitor_android",
    "Sync Capacitor with Android",
    str(self.project_root)
)

self.var_system.add_command(
    "build_android_apk",
    "Build Android APK",
    str(self.android_path)
)

print("[Python] Android build prepared")
# 函数返回，main() 继续
```

### 2. Python 退出 (main_controller.py:488-491)

```python
# main() 函数最后
# Write success marker
controller.var_system.set_var("PYTHON_SUCCESS", "true")
print("\n[Python] Preparation complete. Shell can now execute commands.")

# main() 结束，Python 进程退出
```

### 3. Shell 接管 (execute_commands_windows_new.ps1:756-794)

```powershell
# 检查 Python 是否成功
$pythonSuccess = Get-VarValue -Key $KEY_PYTHON_SUCCESS -Prefix $AppPrefix

if ($pythonSuccess -ne "true") {
    Write-ColorText "[ERROR] Python controller did not complete successfully" "Red"
    exit 1
}

# 检查是否有错误
$errorMsg = Get-VarValue -Key $KEY_ERROR -Prefix $AppPrefix

if ($errorMsg) {
    Write-ColorText "[ERROR] Python reported error: $errorMsg" "Red"
    exit 1
}

# 获取命令数量
$commandCount = Get-CommandCount -Prefix $AppPrefix

if ($commandCount -eq 0) {
    Write-ColorText "[WARNING] No commands to execute" "Yellow"
    exit 0
}

Write-ColorText "[Shell] Executing $commandCount commands..." "Cyan"

# 执行每个命令
for ($i = 0; $i -lt $commandCount; $i++) {
    $cmd = Get-Command -Index $i -Prefix $AppPrefix

    if ($cmd) {
        if ($cmd.Desc) {
            Write-ColorText "[Execute] $($cmd.Desc)" "Cyan"
        }

        Execute-Command -CommandType $cmd.Type -Prefix $AppPrefix
    }
}

Write-Header "Execution Complete"
```

---

## 用户交互时间线

| 时刻 | 位置 | 状态 | 用户可见输出 |
|------|------|------|------------|
| T0 | Shell | 启动 | `.\start.ps1` 执行 |
| T1 | Python | 运行 | `[Python] Preparing Android build...` |
| T2 | Python | 运行 | `[Python] Preparing resources for Capacitor...` |
| T3 | Python | 运行 | `[Python] Scanning Android resources...` |
| T4 | Python | 运行 | `[Python] Applying custom resource replacements...` |
| T5 | Python | 运行 | `[Python] Re-scanning resources after replacement...` |
| T6 | Python | 等待 | `[Python] Launching resource preview...` |
| T7 | Python | 等待 | `[Web] Resource preview server started at: http://127.0.0.1:8899` |
| T8 | Python | **等待用户输入** | `Continue? [Y/n]: ___` ← **用户在此输入** |
| T9 | Python | 继续 | **用户输入 'Y' 后** |
| T10 | Python | 添加命令 | `[Python] User confirmed, continuing with build...` |
| T11 | Python | 退出 | `[Python] Android build prepared` |
| T12 | Python | 退出 | `[Python] Preparation complete. Shell can now execute commands.` |
| T13 | **Shell** | 接管 | `[Shell] Executing 3 commands...` |
| T14 | Shell | 执行 | `[Execute] Build web assets` |
| T15 | Shell | 执行 | `pnpm run build` (实际命令输出) |
| T16 | Shell | 执行 | `[Execute] Sync Capacitor with Android` |
| T17 | Shell | 执行 | `npx cap sync android` (实际命令输出) |
| T18 | Shell | 执行 | `[Execute] Build Android APK` |
| T19 | Shell | 执行 | `.\gradlew assembleDebug` (实际命令输出) |
| T20 | Shell | 完成 | `Execution Complete` |

---

## 确认点

### ✅ 1. Python 处理所有准备工作
- 资源验证
- 资源替换
- Web 预览
- **等待用户确认**

### ✅ 2. 用户确认后 Python 退出
- 添加 3 个编译命令到队列
- 设置 `PYTHON_SUCCESS=true`
- 打印完成信息
- **Python 进程结束**

### ✅ 3. Shell 接管执行编译
- 检查 Python 成功标记
- 读取命令队列
- **循环执行所有编译命令**
- 显示完成信息

---

## 数据流图

```
Python                          Shell
  │                               │
  ├─ 准备工作                      │
  ├─ 资源替换                      │
  ├─ Web 预览                      │
  ├─ 等待用户输入                   │
  │   (用户输入 'Y')                │
  │                               │
  ├─ add_command("build_web")     │
  ├─ add_command("sync_capacitor")│
  ├─ add_command("build_apk")     │
  │                               │
  ├─ set_var("PYTHON_SUCCESS", "true")
  ├─ print("Preparation complete")│
  │                               │
  └─ 退出 ──────────────────────>  ├─ 检查 PYTHON_SUCCESS
                                  ├─ 读取命令队列
                                  │
                                  ├─ Execute: build_web
                                  ├─ Execute: sync_capacitor
                                  ├─ Execute: build_apk
                                  │
                                  └─ 完成
```

---

## 文件通信机制

Python 和 Shell 通过 **文件变量系统** 通信：

```
临时目录：.build_vars_{app_prefix}/

文件列表：
├── PYTHON_SUCCESS.txt          # "true" / ""
├── ERROR.txt                   # 错误信息 / ""
├── COMMAND_COUNT.txt           # "3"
├── COMMAND_0_TYPE.txt          # "build_web"
├── COMMAND_0_DESC.txt          # "Build web assets"
├── COMMAND_0_WORKDIR.txt       # "D:\...\project_root"
├── COMMAND_1_TYPE.txt          # "sync_capacitor_android"
├── COMMAND_1_DESC.txt          # "Sync Capacitor with Android"
├── COMMAND_1_WORKDIR.txt       # "D:\...\project_root"
├── COMMAND_2_TYPE.txt          # "build_android_apk"
├── COMMAND_2_DESC.txt          # "Build Android APK"
└── COMMAND_2_WORKDIR.txt       # "D:\...\android"
```

**写入:** Python (`file_variable_system.py`)
**读取:** Shell (`execute_commands_windows_new.ps1` / `execute_commands_linux_new.sh`)

---

## 用户取消流程

如果用户在预览时选择 'N' 或 'Cancel':

```python
user_continues = show_preview(resource_data, port=8899)

if not user_continues:  # 用户选择 'N' 或 Cancel
    print("[Python] Build cancelled by user")
    self.var_system.set_var("ERROR", "user_cancelled")
    return  # 不添加任何命令，直接返回
```

Shell 检测到错误：

```powershell
$errorMsg = Get-VarValue -Key $KEY_ERROR -Prefix $AppPrefix

if ($errorMsg) {  # "user_cancelled"
    Write-ColorText "[ERROR] Python reported error: $errorMsg" "Red"
    exit 1  # 退出，不执行任何编译命令
}
```

---

## 总结

**流程完全一致：**

1. ✅ Python 处理所有准备工作
2. ✅ Python 等待用户确认
3. ✅ 用户输入 'Y' → Python 添加编译命令到队列
4. ✅ Python 设置成功标记并退出
5. ✅ Shell 检查成功标记
6. ✅ Shell 读取命令队列
7. ✅ Shell 执行所有编译命令
8. ✅ 构建完成

**职责清晰：**
- **Python:** 准备 + 预览 + 等待确认
- **Shell:** 编译 + 构建

**通信机制：**
- 文件变量系统
- 无 JSON，单文件存储

**用户体验：**
- 预览资源后确认
- 单次确认后自动完成编译
- 可随时取消

---

✅ **确认：流程设计正确，实现一致！**
