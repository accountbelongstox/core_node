# Secret Manager Integration - 完成总结

## 变更概述

已成功将生成的脚本集成 PyCore Secret Manager，移除了对旧的 shell 脚本密钥管理的依赖。

---

## 主要变更

### 1. ✅ 路径修改

#### Windows
- **保持不变**: `D:\.tmp\Users\default`
- 固定目录名（无时间戳）

#### Linux
- **修改前**: `/tmp/Users/{timestamp}` 或 `/tmp/Users/default`
- **修改后**: `/var/_core_node/Users/default`
- 使用更持久化的目录位置

### 2. ✅ 移除时间戳

#### 目录名
- 不再使用动态时间戳生成目录
- 改用固定的 `default` 目录名
- 避免 git 提交冲突

#### 脚本注释
已移除以下时间戳注释：
- Windows: `- Generation Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`
- Linux: `#     - Generation Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`

### 3. ✅ PyCore Secret Manager 集成

#### Windows PowerShell 实现

```powershell
# 使用 Python 调用 PyCore Secret Manager
$pythonExecutable = "python3"  # 或 "python" 作为备选
$pycoreCaller = Join-Path $projectRootPath "pycore_module_caller.py"

function Get-SecretValue {
    param([string]$KeyName)
    Write-Host "[DEBUG] Loading secret key: $KeyName" -ForegroundColor DarkGray
    $arguments = @($pycoreCaller, '--module', 'pyfoundations.secret_manager', '--call', 'get_secret_key', $KeyName)
    $value = & $pythonExecutable $arguments 2>$null
    return $value
}

# 根据文件序号加载对应密钥
$env:OPENAI_API_KEY = Get-SecretValue "OPENAI_API_KEY_1"
$env:ANTHROPIC_API_KEY = Get-SecretValue "ANTHROPIC_API_KEY_1"
```

#### Linux Bash 实现

```bash
# 使用 Python 调用 PyCore Secret Manager
python_exec="python3"  # 或 "python" 作为备选
pycore_launcher="{project_root}/pycore_module_caller.py"

load_secret_value() {
    local key_name="$1"
    local env_name="$2"
    local display_name="$3"
    local value=""

    echo "[DEBUG] Loading secret key: $key_name -> $env_name"

    value=$($python_exec "$pycore_launcher" --module pyfoundations.secret_manager --call get_secret_key "$key_name" 2>/dev/null)

    if [ -n "$value" ]; then
        printf -v "$env_name" '%s' "$value"
        export "$env_name"
        echo "[SUCCESS] Loaded $display_name"
        return 0
    fi

    echo "[WARNING] Failed to load $display_name"
    return 1
}

# 根据文件序号加载对应密钥
load_secret_value "OPENAI_API_KEY_1" "OPENAI_API_KEY" "OpenAI API Key"
load_secret_value "ANTHROPIC_API_KEY_1" "ANTHROPIC_API_KEY" "Anthropic API Key"
```

---

## 密钥命名规范

### Index-based Key Naming

每个工具/配置的密钥根据其文件序号（file_number）自动添加后缀：

```
原始变量名: OPENAI_API_KEY
文件1: OPENAI_API_KEY_1
文件2: OPENAI_API_KEY_2
文件3: OPENAI_API_KEY_3
...
```

### 支持的密钥类型

1. **AI 工具密钥**
   - `OPENAI_API_KEY_{index}`
   - `ANTHROPIC_API_KEY_{index}`
   - `DEEPSEEK_API_KEY_{index}`
   - `GROQ_API_KEY_{index}`
   - 等等...

2. **SSH 配置密钥**
   - `SSH_PASSWORD_{config_name}_{index}`
   - 示例: `SSH_PASSWORD_myserver_1`

---

## 密钥存储位置

### 加密存储
```
.secret_keys/
├── already_encrypted/          # 加密文件（提交到 git）
│   ├── OPENAI_API_KEY_1.JS
│   ├── OPENAI_API_KEY_2.JS
│   ├── ANTHROPIC_API_KEY_1.JS
│   └── SSH_PASSWORD_myserver_1.JS
└── .secret_ignore/             # 解密文件（git ignored）
    ├── OPENAI_API_KEY_1.JS
    ├── OPENAI_API_KEY_2.JS
    └── ...
```

---

## PyCore Module Caller

### 功能
- 项目根路径自动检测
- 模块动态导入
- 函数调用支持位置参数和关键字参数
- 跨平台支持（Windows/Linux/macOS）

### 使用方法

```bash
# 获取单个密钥
python pycore_module_caller.py \
  --module pyfoundations.secret_manager \
  --call get_secret_key \
  OPENAI_API_KEY_1

# 获取所有密钥（JSON 格式）
python pycore_module_caller.py \
  --module pyfoundations.secret_manager \
  --call get_all_secret_keys \
  --json
```

### 特性
- ✅ 自动跳过依赖检查（通过 `PYCORE_SKIP_DEP_CHECK=1`）
- ✅ 支持相对路径和绝对路径
- ✅ 支持从任意工作目录调用
- ✅ 返回值自动打印到 stdout

---

## 生成脚本示例

### 环境变量加载部分（Windows）

```powershell
#region Load Environment Variables via PyCore caller
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading Environment Variables" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExecutable = "python3"
if (-not (Get-Command $pythonExecutable -ErrorAction SilentlyContinue)) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonExecutable = "python"
    } else {
        Write-Host "[ERROR] Python not found. Cannot load secrets." -ForegroundColor Red
        exit 1
    }
}

$pycoreCaller = Join-Path $projectRootPath "pycore_module_caller.py"
Write-Host "[DEBUG] Python executable: $pythonExecutable" -ForegroundColor DarkGray
Write-Host "[DEBUG] PyCore module caller: $pycoreCaller" -ForegroundColor DarkGray

function Get-SecretValue {
    param([string]$KeyName)
    Write-Host "[DEBUG] Loading secret key: $KeyName" -ForegroundColor DarkGray
    $arguments = @($pycoreCaller, '--module', 'pyfoundations.secret_manager', '--call', 'get_secret_key', $KeyName)
    $value = & $pythonExecutable $arguments 2>$null
    return $value
}

$env:OPENAI_API_KEY = Get-SecretValue "OPENAI_API_KEY_1"
if ($env:OPENAI_API_KEY) {
    Write-Host "[SUCCESS] Loaded OPENAI_API_KEY" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Failed to load OPENAI_API_KEY" -ForegroundColor Yellow
}
#endregion
```

### 环境变量加载部分（Linux）

```bash
# =============================================================================
# Load Environment Variables from Secret Manager
# =============================================================================
echo ""
echo "============================================================"
echo "Loading Environment Variables"
echo "============================================================"
echo ""

python_exec="python3"
if ! command -v "$python_exec" &> /dev/null; then
    if command -v python &> /dev/null; then
        python_exec="python"
    else
        echo "[ERROR] Python is required to load secrets"
        exit 1
    fi
fi

pycore_launcher="{project_root}/pycore_module_caller.py"

echo "[DEBUG] python executable: $python_exec"
echo "[DEBUG] pycore module caller: $pycore_launcher"

load_secret_value() {
    local key_name="$1"
    local env_name="$2"
    local display_name="$3"
    local value=""

    echo "[DEBUG] Loading secret key: $key_name -> $env_name"

    value=$($python_exec "$pycore_launcher" --module pyfoundations.secret_manager --call get_secret_key "$key_name" 2>/dev/null)

    if [ -n "$value" ]; then
        printf -v "$env_name" '%s' "$value"
        export "$env_name"
        echo "[SUCCESS] Loaded $display_name"
        return 0
    fi

    echo "[WARNING] Failed to load $display_name"
    return 1
}

load_secret_value "OPENAI_API_KEY_1" "OPENAI_API_KEY" "OpenAI API Key"
load_secret_value "ANTHROPIC_API_KEY_1" "ANTHROPIC_API_KEY" "Anthropic API Key"

echo ""
```

---

## 优势

### 1. 统一密钥管理
- ✅ 所有密钥使用 PyCore Secret Manager
- ✅ 一致的加密/解密逻辑
- ✅ 支持多种密钥后端（文件、环境变量等）

### 2. 多配置支持
- ✅ 通过 index 后缀支持多个相同工具的不同配置
- ✅ 例如：`OPENAI_API_KEY_1`, `OPENAI_API_KEY_2`
- ✅ 每个脚本自动使用对应的 index

### 3. 避免 Git 冲突
- ✅ 目录名固定（无时间戳）
- ✅ 脚本内容稳定（无生成时间）
- ✅ 多次生成结果一致

### 4. 跨平台一致性
- ✅ Windows/Linux 使用相同的密钥管理逻辑
- ✅ Python 统一处理加密/解密
- ✅ Shell 脚本仅负责调用和环境变量设置

### 5. 错误处理
- ✅ Python 不存在时友好提示
- ✅ 密钥加载失败时警告但不中断
- ✅ 详细的 DEBUG 日志

---

## 测试验证

### 验证步骤

1. **生成脚本**
   ```bash
   # Windows
   python -m scripts.pytools.special_software_env_manager

   # Linux
   python3 -m scripts.pytools.special_software_env_manager
   ```

2. **检查生成的脚本**
   - 确认使用 `pycore_module_caller.py`
   - 确认密钥命名包含 `_1`, `_2` 等后缀
   - 确认无时间戳相关代码

3. **运行生成的脚本**
   ```bash
   # Windows
   .\scripts\winenvs\openai1.ps1

   # Linux
   bash ./scripts/liunxenvs/openai1.sh
   ```

4. **验证密钥加载**
   - 查看控制台输出
   - 确认 `[SUCCESS] Loaded xxx` 消息
   - 验证环境变量已设置

---

## 故障排除

### 问题：Python 未找到
```
[ERROR] Python not found. Cannot load secrets.
```
**解决方案**:
- 安装 Python 3.7+
- 确保 `python` 或 `python3` 在 PATH 中

### 问题：密钥未找到
```
[WARNING] Failed to load OPENAI_API_KEY
```
**解决方案**:
1. 检查密钥是否已加密并存储
2. 运行密钥解密：
   ```bash
   python pycore_module_caller.py \
     --module pyfoundations.secret_manager \
     --call decrypt_all_secrets
   ```
3. 确认密钥名称正确（包含 index 后缀）

### 问题：路径错误
```
FileNotFoundError: pycore_module_caller.py
```
**解决方案**:
- 确保从项目根目录运行脚本
- 或使用生成的完整路径脚本

---

## 文件修改清单

### 修改的文件
1. `command_content_generator_windows.py`
   - 移除时间戳生成
   - 集成 PyCore Secret Manager
   - 实现 index-based 密钥命名

2. `command_content_generator_linux.py`
   - 修改路径为 `/var/_core_node/Users/default`
   - 移除时间戳生成
   - 集成 PyCore Secret Manager
   - 实现 index-based 密钥命名

### 依赖的文件
1. `pycore_module_caller.py` - PyCore 模块调用器
2. `pycore/pyfoundations/secret_manager.py` - 密钥管理模块
3. `.secret_keys/already_encrypted/*.JS` - 加密密钥存储

---

## 后续计划

- [x] 移除时间戳
- [x] 集成 PyCore Secret Manager
- [x] 实现 index-based 密钥命名
- [x] 修改 Linux 路径
- [ ] 添加密钥轮换功能
- [ ] 支持密钥过期检测
- [ ] 添加密钥使用统计

---

**最后更新**: 2025-11-10
**作者**: Claude AI Assistant
