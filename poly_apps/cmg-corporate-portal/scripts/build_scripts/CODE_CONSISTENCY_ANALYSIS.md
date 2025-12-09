# 代码一致性分析和重构计划

**日期:** 2025-12-10
**分析范围:** `execute_commands_windows_new.ps1` (659行) 和 `execute_commands_linux_new.sh` (574行)

---

## 📊 函数对比分析

### ✅ 完全对应的函数 (18个)

| Windows PowerShell | Linux Bash | 功能 | 一致性 |
|-------------------|-----------|------|--------|
| `Write-ColorText` | `print_color` | 彩色输出 | ✅ |
| `Write-Header` | `print_header` | 大标题 | ✅ |
| `Write-Section` | `print_section` | 小标题 | ✅ |
| `Find-AppPrefix` | `find_app_prefix` | 查找前缀 | ✅ |
| `Get-VarValue` | `get_var_value` | 获取变量 | ✅ |
| `Get-VarAsList` | `get_var_as_list` | 获取列表 | ✅ |
| `Get-CommandCount` | `get_command_count` | 命令数量 | ✅ |
| `Get-Command` | `get_command` | 获取命令 | ✅ |
| `Print-Command` | `print_command` | 打印命令 | ✅ |
| `Execute-Command` | `execute_command` | 命令调度 | ✅ |
| `Run-PnpmInstall` | `run_pnpm_install` | pnpm安装 | ✅ |
| `Backup-PackageJson` | `backup_package_json` | 备份JSON | ✅ |
| `Initialize-Capacitor` | `initialize_capacitor` | 初始化 | ✅ |
| `Add-AndroidPlatform` | `add_android_platform` | 添加安卓 | ✅ |
| `Start-DevServer` | `start_dev_server` | 开发服务器 | ✅ |
| `Build-Web` | `build_web` | Web构建 | ✅ |
| `Sync-CapacitorAndroid` | `sync_capacitor_android` | 同步 | ✅ |
| `Build-AndroidApk` | `build_android_apk` | APK构建 | ✅ |

**总结:** 所有18个函数在两个平台上完全对应 ✅

---

## 🔍 重复代码模式识别

### Pattern 1: 简单命令执行模式 (5个函数)

**特征:**
1. 获取 `PROJECT_ROOT` 变量
2. 切换到项目目录
3. 打印命令 `[CMD]`
4. 执行命令
5. 检查退出码
6. 输出成功/失败消息

**受影响的函数:**
- `Run-PnpmInstall` / `run_pnpm_install`
- `Build-Web` / `build_web`
- `Sync-CapacitorAndroid` / `sync_capacitor_android`

**Windows 代码 (重复3次):**
```powershell
$projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix

Push-Location $projectRoot
try {
    Print-Command "some command"
    & some command

    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "[ERROR] Operation failed" "Red"
    } else {
        Write-ColorText "[Success] Operation completed" "Green"
    }
} finally {
    Pop-Location
}
```

**Linux 代码 (重复3次):**
```bash
local project_root=$(get_var_value "$KEY_PROJECT_ROOT")

cd "$project_root"

print_command "some command"
if some command; then
    print_color "$COLOR_GREEN" "[Success] Operation completed"
else
    print_color "$COLOR_RED" "[ERROR] Operation failed"
fi
```

**重复行数估算:** 每个函数约15行 × 3 = **45行重复代码**

---

### Pattern 2: 带路径验证的命令执行 (2个函数)

**特征:**
1. 获取特定路径变量
2. **验证路径/文件是否存在**
3. 如果不存在，报错并返回
4. 切换目录
5. 执行命令
6. 检查结果

**受影响的函数:**
- `Build-AndroidApk` / `build_android_apk` (验证 gradlew)

**Windows 代码:**
```powershell
$androidPath = Get-VarValue -Key $KEY_ANDROID_PATH -Prefix $Prefix
$gradlewPath = Join-Path $androidPath "gradlew.bat"

if (-not (Test-Path $gradlewPath)) {
    Write-ColorText "[ERROR] Gradle wrapper not found at: $gradlewPath" "Red"
    return
}

Push-Location $androidPath
try {
    Print-Command ".\gradlew.bat assembleDebug"
    & .\gradlew.bat assembleDebug

    if ($LASTEXITCODE -ne 0) {
        Write-ColorText "[ERROR] Android build failed" "Red"
    } else {
        Write-ColorText "[Success] Android build completed" "Green"
    }
} finally {
    Pop-Location
}
```

**Linux 代码:**
```bash
local android_path=$(get_var_value "$KEY_ANDROID_PATH")
local gradlew_path="${android_path}/gradlew"

if [ ! -f "$gradlew_path" ]; then
    print_color "$COLOR_RED" "[ERROR] Gradle wrapper not found at: $gradlew_path"
    return 1
fi

cd "$android_path"

print_command "./gradlew assembleDebug"
if ./gradlew assembleDebug; then
    print_color "$COLOR_GREEN" "[Success] Android build completed"
else
    print_color "$COLOR_RED" "[ERROR] Android build failed"
fi
```

**重复行数估算:** 约20行 × 2 = **40行可优化代码**

---

### Pattern 3: 交互式确认模式 (2个函数)

**特征:**
1. 检测现有状态（文件/目录存在）
2. 显示警告信息
3. **交互式提示用户 (Y/N)**
4. 用户确认后执行操作
5. 备份旧数据
6. 执行新操作

**受影响的函数:**
- `Add-AndroidPlatform` / `add_android_platform`
- `Initialize-Capacitor` / `initialize_capacitor`

**Windows 交互代码 (重复2次):**
```powershell
if (Test-Path $somePath) {
    Write-ColorText "[Warning] Already exists" "Yellow"
    Write-Host "WARNING: Will be removed."

    $confirmation = Read-Host "Remove and re-add? [y/N]"

    if ($confirmation -match '^[Yy]$') {
        # Backup
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "${somePath}_backup_$timestamp"
        Rename-Item -Path $somePath -NewName "$backupPath"

        # Re-add
        # ... command
    } else {
        Write-ColorText "[Info] Cancelled by user" "Cyan"
        return
    }
}
```

**Linux 交互代码 (重复2次):**
```bash
if [ -d "$some_path" ]; then
    print_color "$COLOR_YELLOW" "[Warning] Already exists"
    echo "WARNING: Will be removed."

    read -p "Remove and re-add? [y/N]: " confirmation

    if [[ "$confirmation" =~ ^[Yy]$ ]]; then
        # Backup
        local timestamp=$(date +"%Y%m%d_%H%M%S")
        local backup_path="${some_path}_backup_$timestamp"
        mv "$some_path" "$backup_path"

        # Re-add
        # ... command
    else
        print_color "$COLOR_CYAN" "[Info] Cancelled by user"
        return 0
    fi
fi
```

**重复行数估算:** 约30行 × 2 = **60行可抽象代码**

---

### Pattern 4: 备份机制 (3个地方使用)

**使用位置:**
1. `Backup-PackageJson` - 备份 package.json
2. `Add-AndroidPlatform` - 备份 android 目录
3. `Initialize-Capacitor` - 备份配置文件

**Windows 备份代码 (重复3次):**
```powershell
if (Test-Path $backupPath) {
    Write-ColorText "[Backup] Already exists, skipping" "Green"
} else {
    if (Test-Path $sourcePath) {
        try {
            # For files
            Copy-Item $sourcePath $backupPath -Force
            # Or for directories
            Rename-Item -Path $sourcePath -NewName $backupPath -Force

            Write-ColorText "[Backup] Created backup" "Green"
        } catch {
            Write-ColorText "[ERROR] Failed to backup: $_" "Red"
        }
    }
}
```

**Linux 备份代码 (重复3次):**
```bash
if [ -f "$backup_path" ]; then
    print_color "$COLOR_GREEN" "[Backup] Already exists, skipping"
else
    if [ -f "$source_path" ]; then
        # For files
        cp "$source_path" "$backup_path"
        # Or for directories
        mv "$source_path" "$backup_path"

        print_color "$COLOR_GREEN" "[Backup] Created backup"
    fi
fi
```

**重复行数估算:** 约15行 × 3 = **45行可统一代码**

---

## 📈 代码重复统计

| 模式 | 重复次数 | 每次行数 | 总重复行数 |
|------|---------|---------|-----------|
| **简单命令执行** | 3 | 15 | 45 |
| **带验证的命令执行** | 2 | 20 | 40 |
| **交互式确认** | 2 | 30 | 60 |
| **备份机制** | 3 | 15 | 45 |
| **总计** | **10** | - | **190行** |

**优化潜力:** 可减少约 **190行** 重复代码 (约29%)

---

## 🎯 重构方案

### 方案 1: 创建通用命令执行辅助函数 ✅

**目标:** 消除 Pattern 1 的重复 (45行)

**Windows 新增函数:**
```powershell
function Invoke-ProjectCommand {
    param(
        [string]$Command,
        [string]$Description,
        [string]$Prefix,
        [string]$WorkDir = $null,  # Optional, defaults to PROJECT_ROOT
        [switch]$NoErrorCheck      # Optional, skip error checking
    )

    if (-not $WorkDir) {
        $WorkDir = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    }

    Push-Location $WorkDir
    try {
        Print-Command $Command

        if ($Command -match '^npx |^pnpm |^python') {
            # Shell commands need to use & operator
            Invoke-Expression "& $Command"
        } else {
            Invoke-Expression $Command
        }

        if (-not $NoErrorCheck -and $LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] $Description failed" "Red"
            return $false
        } else {
            Write-ColorText "[Success] $Description completed" "Green"
            return $true
        }
    } finally {
        Pop-Location
    }
}
```

**Linux 新增函数:**
```bash
invoke_project_command() {
    local command="$1"
    local description="$2"
    local work_dir="${3:-$(get_var_value "$KEY_PROJECT_ROOT")}"
    local no_error_check="${4:-false}"

    cd "$work_dir"

    print_command "$command"

    if eval "$command"; then
        if [ "$no_error_check" != "true" ]; then
            print_color "$COLOR_GREEN" "[Success] $description completed"
        fi
        return 0
    else
        if [ "$no_error_check" != "true" ]; then
            print_color "$COLOR_RED" "[ERROR] $description failed"
        fi
        return 1
    fi
}
```

**简化后的函数示例:**

**Before (15行):**
```powershell
function Build-Web {
    param([string]$Prefix)

    Write-Section "Building Web Assets"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix

    Push-Location $projectRoot
    try {
        Print-Command "pnpm run build"
        & pnpm run build

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Web build failed" "Red"
        } else {
            Write-ColorText "[Success] Web build completed" "Green"
        }
    } finally {
        Pop-Location
    }
}
```

**After (7行):**
```powershell
function Build-Web {
    param([string]$Prefix)

    Write-Section "Building Web Assets"

    Invoke-ProjectCommand `
        -Command "pnpm run build" `
        -Description "Web build" `
        -Prefix $Prefix
}
```

**减少行数:** 15 → 7 = **8行/函数** × 3函数 = **24行减少**

---

### 方案 2: 创建通用路径验证函数 ✅

**目标:** 消除 Pattern 2 的重复 (40行)

**Windows 新增函数:**
```powershell
function Test-RequiredPath {
    param(
        [string]$Path,
        [string]$Description,
        [string]$Type = "File"  # "File" or "Directory"
    )

    $exists = if ($Type -eq "File") {
        Test-Path $Path -PathType Leaf
    } else {
        Test-Path $Path -PathType Container
    }

    if (-not $exists) {
        Write-ColorText "[ERROR] $Description not found at: $Path" "Red"
        return $false
    }

    return $true
}
```

**Linux 新增函数:**
```bash
test_required_path() {
    local path="$1"
    local description="$2"
    local type="${3:-file}"  # "file" or "directory"

    if [ "$type" = "file" ]; then
        if [ ! -f "$path" ]; then
            print_color "$COLOR_RED" "[ERROR] $description not found at: $path"
            return 1
        fi
    else
        if [ ! -d "$path" ]; then
            print_color "$COLOR_RED" "[ERROR] $description not found at: $path"
            return 1
        fi
    fi

    return 0
}
```

**简化后的函数示例:**

**Before (20行):**
```powershell
function Build-AndroidApk {
    param([string]$Prefix)

    Write-Section "Building Android APK"

    $androidPath = Get-VarValue -Key $KEY_ANDROID_PATH -Prefix $Prefix
    $gradlewPath = Join-Path $androidPath "gradlew.bat"

    if (-not (Test-Path $gradlewPath)) {
        Write-ColorText "[ERROR] Gradle wrapper not found at: $gradlewPath" "Red"
        return
    }

    Push-Location $androidPath
    try {
        Print-Command ".\gradlew.bat assembleDebug"
        & .\gradlew.bat assembleDebug

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Android build failed" "Red"
        } else {
            Write-ColorText "[Success] Android build completed" "Green"
        }
    } finally {
        Pop-Location
    }
}
```

**After (12行):**
```powershell
function Build-AndroidApk {
    param([string]$Prefix)

    Write-Section "Building Android APK"

    $androidPath = Get-VarValue -Key $KEY_ANDROID_PATH -Prefix $Prefix
    $gradlewPath = Join-Path $androidPath "gradlew.bat"

    if (-not (Test-RequiredPath $gradlewPath "Gradle wrapper" "File")) { return }

    Invoke-ProjectCommand `
        -Command ".\gradlew.bat assembleDebug" `
        -Description "Android build" `
        -WorkDir $androidPath `
        -Prefix $Prefix
}
```

**减少行数:** 20 → 12 = **8行减少**

---

### 方案 3: 创建通用交互式确认函数 ✅

**目标:** 消除 Pattern 3 的重复 (60行)

**Windows 新增函数:**
```powershell
function Confirm-UserAction {
    param(
        [string]$PromptMessage,
        [string]$WarningMessage = "",
        [string]$DefaultAnswer = "N"  # Y or N
    )

    if ($WarningMessage) {
        Write-Host ""
        Write-ColorText $WarningMessage "Yellow"
        Write-Host ""
    }

    $promptSuffix = if ($DefaultAnswer -eq "Y") { "[Y/n]" } else { "[y/N]" }
    $confirmation = Read-Host "$PromptMessage $promptSuffix"

    # Check confirmation
    if ($DefaultAnswer -eq "Y") {
        # Default YES - only reject on explicit N/n
        return -not ($confirmation -match '^[Nn]$')
    } else {
        # Default NO - only accept on explicit Y/y
        return ($confirmation -match '^[Yy]$')
    }
}
```

**Linux 新增函数:**
```bash
confirm_user_action() {
    local prompt_message="$1"
    local warning_message="$2"
    local default_answer="${3:-N}"  # Y or N

    if [ -n "$warning_message" ]; then
        echo ""
        print_color "$COLOR_YELLOW" "$warning_message"
        echo ""
    fi

    local prompt_suffix
    if [ "$default_answer" = "Y" ]; then
        prompt_suffix="[Y/n]"
    else
        prompt_suffix="[y/N]"
    fi

    read -p "$prompt_message $prompt_suffix: " confirmation

    # Check confirmation
    if [ "$default_answer" = "Y" ]; then
        # Default YES - only reject on explicit N/n
        if [[ "$confirmation" =~ ^[Nn]$ ]]; then
            return 1
        else
            return 0
        fi
    else
        # Default NO - only accept on explicit Y/y
        if [[ "$confirmation" =~ ^[Yy]$ ]]; then
            return 0
        else
            return 1
        fi
    fi
}
```

**简化后的函数示例:**

**Before (10行交互代码):**
```powershell
if (Test-Path $androidPath) {
    Write-ColorText "[Warning] Android platform already exists" "Yellow"
    Write-Host "WARNING: Your native Android project will be completely removed."

    $confirmation = Read-Host "Remove existing android directory and re-add platform? [y/N]"

    if ($confirmation -match '^[Yy]$') {
        # Do backup and re-add
    } else {
        Write-ColorText "[Info] Cancelled by user" "Cyan"
        return
    }
}
```

**After (5行):**
```powershell
if (Test-Path $androidPath) {
    if (Confirm-UserAction `
            -PromptMessage "Remove existing android directory and re-add platform?" `
            -WarningMessage "WARNING: Your native Android project will be completely removed." `
            -DefaultAnswer "N") {
        # Do backup and re-add
    } else {
        Write-ColorText "[Info] Cancelled by user" "Cyan"
        return
    }
}
```

**减少行数:** 10 → 5 = **5行/次** × 2次 = **10行减少**

---

### 方案 4: 创建通用备份函数 ✅

**目标:** 消除 Pattern 4 的重复 (45行)

**Windows 新增函数:**
```powershell
function Backup-PathWithTimestamp {
    param(
        [string]$SourcePath,
        [string]$Type = "File",  # "File" or "Directory"
        [switch]$UseRename       # If true, rename instead of copy
    )

    if (-not (Test-Path $SourcePath)) {
        Write-ColorText "[Backup] Source not found, skipping: $SourcePath" "Yellow"
        return $null
    }

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "${SourcePath}_backup_$timestamp"

    if (Test-Path $backupPath) {
        Write-ColorText "[Backup] Backup already exists: $backupPath" "Yellow"
        return $backupPath
    }

    try {
        if ($UseRename) {
            Print-Command "Rename-Item ""$SourcePath"" ""$backupPath"""
            Rename-Item -Path $SourcePath -NewName $backupPath -Force
        } else {
            Print-Command "Copy-Item ""$SourcePath"" ""$backupPath"""
            Copy-Item -Path $SourcePath -Destination $backupPath -Recurse -Force
        }

        Write-ColorText "[Backup] Created: $(Split-Path -Leaf $backupPath)" "Green"
        return $backupPath
    } catch {
        Write-ColorText "[ERROR] Backup failed: $_" "Red"
        return $null
    }
}
```

**Linux 新增函数:**
```bash
backup_path_with_timestamp() {
    local source_path="$1"
    local type="${2:-file}"      # "file" or "directory"
    local use_rename="${3:-false}"  # true for rename, false for copy

    if [ ! -e "$source_path" ]; then
        print_color "$COLOR_YELLOW" "[Backup] Source not found, skipping: $source_path"
        return 1
    fi

    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="${source_path}_backup_$timestamp"

    if [ -e "$backup_path" ]; then
        print_color "$COLOR_YELLOW" "[Backup] Backup already exists: $backup_path"
        echo "$backup_path"
        return 0
    fi

    if [ "$use_rename" = "true" ]; then
        print_command "mv \"$source_path\" \"$backup_path\""
        mv "$source_path" "$backup_path"
    else
        print_command "cp -r \"$source_path\" \"$backup_path\""
        cp -r "$source_path" "$backup_path"
    fi

    if [ $? -eq 0 ]; then
        print_color "$COLOR_GREEN" "[Backup] Created: $(basename "$backup_path")"
        echo "$backup_path"
        return 0
    else
        print_color "$COLOR_RED" "[ERROR] Backup failed"
        return 1
    fi
}
```

**简化后的函数示例:**

**Before (15行):**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "${androidPath}_backup_$timestamp"

try {
    Print-Command "Rename-Item ""$androidPath"" ""$backupPath"""
    Rename-Item -Path $androidPath -NewName "$backupPath" -Force
    Write-ColorText "[Backup] Moved to: .\android_backup_$timestamp" "Green"
} catch {
    Write-ColorText "[ERROR] Failed to remove android directory: $_" "Red"
    return
}
```

**After (4行):**
```powershell
$backupPath = Backup-PathWithTimestamp -SourcePath $androidPath -Type "Directory" -UseRename
if (-not $backupPath) {
    return
}
```

**减少行数:** 15 → 4 = **11行/次** × 3次 = **33行减少**

---

## 📊 重构效果预估

### 代码减少统计

| 方案 | 减少行数 | 优化函数数 |
|------|---------|-----------|
| **方案1: 命令执行辅助** | 24 | 3 |
| **方案2: 路径验证** | 8 | 2 |
| **方案3: 交互式确认** | 10 | 2 |
| **方案4: 备份机制** | 33 | 3 |
| **新增辅助函数** | +120 | +4 |
| **净减少** | **-45行** | - |

### 优化后的文件大小

| 文件 | 原始行数 | 优化后 | 减少比例 |
|------|---------|--------|---------|
| **Windows** | 659 | ~614 | 7% |
| **Linux** | 574 | ~529 | 8% |

### 可维护性提升

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| **重复代码行数** | 190行 | 0行 |
| **重复代码比例** | 29% | 0% |
| **辅助函数数量** | 10 | 14 |
| **平均函数长度** | 36行 | 25行 |

---

## 🔧 实施步骤

### Phase 1: 添加辅助函数 (不破坏现有功能)

**Step 1.1:** 在两个文件顶部添加新的辅助函数
- `Invoke-ProjectCommand` / `invoke_project_command`
- `Test-RequiredPath` / `test_required_path`
- `Confirm-UserAction` / `confirm_user_action`
- `Backup-PathWithTimestamp` / `backup_path_with_timestamp`

**Step 1.2:** 验证辅助函数可以独立工作
- 测试每个辅助函数
- 确保跨平台一致性

### Phase 2: 逐个重构现有函数

**Step 2.1:** 重构简单命令执行函数
- `Build-Web` / `build_web`
- `Sync-CapacitorAndroid` / `sync_capacitor_android`
- 测试功能完整性

**Step 2.2:** 重构带验证的函数
- `Build-AndroidApk` / `build_android_apk`
- 测试路径验证逻辑

**Step 2.3:** 重构交互式函数
- `Add-AndroidPlatform` / `add_android_platform`
- `Initialize-Capacitor` / `initialize_capacitor`
- 测试用户交互流程

**Step 2.4:** 统一备份调用
- `Backup-PackageJson` / `backup_package_json`
- `Add-AndroidPlatform` 中的备份
- `Initialize-Capacitor` 中的备份

### Phase 3: 测试和验证

**Test 3.1:** 完整流程测试
```powershell
# Option 1: Install Capacitor
.\start.ps1
# 选择 1

# Option 2: Dev Server
.\start.ps1
# 选择 2

# Option 3: Build Web
.\start.ps1
# 选择 3

# Option 4: Build Android
.\start.ps1
# 选择 4
```

**Test 3.2:** 边界条件测试
- Android 平台已存在（用户选择Y）
- Android 平台已存在（用户选择N）
- Capacitor 已初始化
- 路径不存在的情况

**Test 3.3:** 跨平台一致性测试
- Windows 和 Linux 行为完全相同
- 输出格式一致
- 错误处理一致

### Phase 4: 文档更新

**Doc 4.1:** 更新辅助函数文档
- 函数签名
- 参数说明
- 使用示例

**Doc 4.2:** 创建重构总结报告
- 代码减少统计
- 优化效果对比
- 维护性改进说明

---

## ✅ 预期收益

### 1. 代码质量提升

- ✅ **消除重复:** 190行重复代码归零
- ✅ **统一接口:** 4个通用辅助函数
- ✅ **一致性:** Windows/Linux 完全对应
- ✅ **可读性:** 平均函数长度减少30%

### 2. 维护成本降低

- ✅ **单点修改:** 修改辅助函数即可影响所有调用处
- ✅ **错误减少:** 统一的错误处理逻辑
- ✅ **测试简化:** 只需测试辅助函数

### 3. 扩展性增强

- ✅ **快速添加新命令:** 使用 `Invoke-ProjectCommand`
- ✅ **统一用户交互:** 使用 `Confirm-UserAction`
- ✅ **标准化备份:** 使用 `Backup-PathWithTimestamp`

---

## 🎯 重构优先级

| 优先级 | 方案 | 原因 | 预计工时 |
|--------|------|------|----------|
| **P0** | 方案1: 命令执行辅助 | 影响最多函数(3个)，减少最多行数(24) | 2小时 |
| **P0** | 方案4: 备份机制 | 重复度最高(3处)，安全相关 | 1.5小时 |
| **P1** | 方案3: 交互式确认 | 提升用户体验，统一交互逻辑 | 1小时 |
| **P2** | 方案2: 路径验证 | 影响较少(2个函数)，但有价值 | 0.5小时 |

**总预计工时:** 5小时

---

## 📝 注意事项

### 1. 向后兼容性 ✅

- 不改变任何外部接口
- 不改变命令队列格式
- 不改变文件变量格式

### 2. 错误处理一致性 ✅

- 辅助函数统一返回值规范:
  - Windows: `$true/$false` 或 对象/`$null`
  - Linux: `return 0/return 1` 或 输出路径/空

### 3. 测试覆盖 ✅

- 每个辅助函数单独测试
- 重构后的函数回归测试
- 完整流程端到端测试

### 4. 文档更新 ✅

- 内联注释
- 函数文档块
- 重构总结报告

---

**文档创建:** 2025-12-10
**状态:** 📋 分析完成，待实施
**下一步:** 开始 Phase 1 - 添加辅助函数
