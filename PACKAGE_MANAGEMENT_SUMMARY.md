# pycore 项目包管理系统总结

生成时间: 2025-12-18
类型: 技术文档

## 概述

pycore 项目使用**自定义的包管理系统**,而不是传统的 pip、poetry 或 pipenv。

## 核心组件

### 1. `pycore/pyfoundations/third_party.py` - 自动依赖管理器

这是项目的**统一包管理器**,提供以下功能:

#### 功能特点

1. **自动检测和安装缺失的包**
   - 首次导入时自动运行
   - 使用 ENCYCLOPEDIA 缓存(每个进程运行一次)
   - 优先升级 pip

2. **平台特定处理**
   - Linux/Mac: 使用 `--break-system-packages --ignore-installed`
   - Windows: 使用 `--no-user`
   - 自动跳过不兼容平台的包

3. **实时输出**
   - 使用 `Commander.exec_realtime()` 显示安装进度
   - 提供详细的错误信息

4. **MCP 模式兼容**
   - 检测 `PYCORE_MCP_MODE=1` 环境变量
   - 在 MCP 模式下抑制所有 ColorPrint 输出

#### 包分类

```python
# pycore/pyfoundations/third_party.py

DEPENDENCY_MAP = {
    # 必需包 - 自动安装
    "PIL": "Pillow<11,>=10",
    "cv2": "opencv-python",
    "PySide6": "PySide6",
    # ... 更多
}

OPTIONAL_PACKAGES = {
    # 可选包 - 不自动安装
    "edge_tts": "edge-tts",
    "whisper": "openai-whisper",
    "gi": "PyGObject",  # ← 新增: AppIndicator3 支持
}

WINDOWS_ONLY_PACKAGES = {
    # Windows 专用 - Linux/Mac 自动跳过
    "win32gui": "pywin32",
    "pywinauto": "pywinauto",
    # ... 更多
}
```

#### 版本约束

支持 pip 版本约束语法:
```python
"PIL": "Pillow<11,>=10",  # 版本范围
"numpy": "numpy<2.3.0,>=2",  # 兼容性约束
"uvicorn": "uvicorn[standard]",  # 额外依赖
```

### 2. `requirements.txt` - 项目核心依赖(新建)

**位置**: `/www/programing/core_node/requirements.txt`

**用途**:
- 项目级统一依赖声明
- 跨平台的核心依赖
- CI/CD 环境安装

**内容**:
```txt
# Core requirements
PySide6>=6.5.0
PySide6-WebEngine>=6.5.0
FastAPI>=0.100.0
uvicorn[standard]>=0.23.0
sqlalchemy>=2.0.0
psutil>=5.9.0
requests>=2.31.0
aiohttp>=3.8.0
websockets>=11.0
```

**安装**:
```bash
pip install -r requirements.txt
```

### 3. `requirements_linux.txt` - Linux 特定依赖(新建)

**位置**: `/www/programing/core_node/requirements_linux.txt`

**用途**:
- Linux 平台特定的包
- Ubuntu 系统托盘支持(AppIndicator3)
- 可选安装

**内容**:
```txt
# Linux-specific requirements
PyGObject>=3.42.0  # GTK3/AppIndicator3 绑定
pystray>=0.19.0    # 系统托盘备选方案
Pillow>=9.0.0      # 图像处理
dbus-python>=1.2.18  # D-Bus 通信
```

**系统依赖** (需要先安装):
```bash
sudo apt-get install \
    python3-gi \
    gir1.2-appindicator3-0.1 \
    libgirepository1.0-dev \
    libcairo2-dev \
    libdbus-1-dev
```

**安装**:
```bash
# 方法 1: 系统包(推荐)
sudo apt-get install python3-gi gir1.2-appindicator3-0.1

# 方法 2: pip 安装
pip install -r requirements_linux.txt
```

### 4. `scripts/install_ubuntu_tray_support.sh` - 自动化安装脚本(新建)

**位置**: `/www/programing/core_node/scripts/install_ubuntu_tray_support.sh`

**功能**:
- 自动检测系统(Ubuntu/Debian)
- 安装所有系统依赖
- 安装 GNOME Shell 扩展
- 启用 AppIndicator 扩展
- 验证安装
- 提供后续步骤指导

**使用方法**:
```bash
chmod +x scripts/install_ubuntu_tray_support.sh
./scripts/install_ubuntu_tray_support.sh
```

**执行内容**:
1. 更新包列表
2. 安装 `python3-gi`, `gir1.2-appindicator3-0.1`
3. 安装开发库(`libgirepository1.0-dev`, `libcairo2-dev`)
4. 安装 GNOME Shell 扩展(如果检测到 GNOME)
5. 启用扩展
6. 验证安装
7. 提示重启 GNOME Shell

### 5. 系统包脚本(已存在)

**位置**: `scripts/shells/linux/debian/install_shells/13_ensure_python.sh`

**管理的包**:
- `python3-tk` - Tkinter GUI
- `python3-gi` - GObject/GTK 绑定
- 其他系统级 Python 包

**说明**: 系统包通过此脚本管理,而不是在 `third_party.py` 中。

## 包管理工作流

### 添加新的第三方包

#### 步骤 1: 确定包分类

- **必需包**: 项目核心功能所需 → `DEPENDENCY_MAP`
- **可选包**: 增强功能,代码能处理缺失 → `OPTIONAL_PACKAGES`
- **Windows 专用**: 仅 Windows 可用 → `WINDOWS_ONLY_PACKAGES`
- **系统包**: Linux 系统包(apt-get) → 系统脚本

#### 步骤 2: 添加到 `third_party.py`

**示例**:
```python
# 在 pycore/pyfoundations/third_party.py 中添加

DEPENDENCY_MAP = {
    # ... 现有包

    # For new feature X
    "new_package": "new-package-name>=1.0.0",
}

# 或者如果是可选包:
OPTIONAL_PACKAGES = {
    # ... 现有包

    # For optional feature Y
    "optional_pkg": "optional-package",
}
```

#### 步骤 3: 更新 requirements.txt(可选)

如果是核心依赖,也添加到 `requirements.txt`:
```txt
# requirements.txt
new-package>=1.0.0
```

#### 步骤 4: 测试自动安装

```bash
# 删除包(如果已安装)
pip uninstall new-package-name

# 导入,应该自动安装
python3 -c "from pycore.pyfoundations.third_party import new_package"
```

### 使用第三方包

#### ✅ 正确方式 - 延迟加载(推荐)

```python
# 方法 1: 导入 getter 函数
from pycore.pyfoundations.third_party import get_third_package_torch

def my_function():
    # 只在需要时加载
    torch = get_third_package_torch()
    if torch is None:
        print("Torch not available")
        return

    # 使用 torch
    result = torch.tensor([1, 2, 3])
```

**优点**:
- 减少启动时间(从 ~12s 到 <1s)
- 包只在使用时加载
- 全局缓存,后续调用无开销

#### ✅ 正确方式 - 直接导入

```python
# 方法 2: 直接从 third_party 导入
from pycore.pyfoundations.third_party import requests, aiohttp

# 可以直接使用
response = requests.get("https://api.example.com")
```

**优点**:
- 代码简洁
- 自动检查和安装
- 统一的导入点

#### ❌ 错误方式

```python
# 不要直接导入!
import torch  # ✗ 不会触发自动安装
import requests  # ✗ 不会触发自动安装

# 不要这样使用 getter!
from third_party import torch  # ✗ 错误的导入路径
torch = get_third_package_torch  # ✗ 忘记调用 ()
```

## AppIndicator3 集成示例

### 添加到包管理系统

```python
# pycore/pyfoundations/third_party.py

OPTIONAL_PACKAGES = {
    # ... 现有包

    # For native Linux system tray (Ubuntu/GNOME)
    # Note: Requires system packages: gir1.2-appindicator3-0.1
    "gi": "PyGObject",
}
```

### 使用 AppIndicator3

```python
# 方法 1: 直接导入(如果已安装系统包)
try:
    import gi
    gi.require_version('AppIndicator3', '0.1')
    from gi.repository import AppIndicator3
    APPINDICATOR_AVAILABLE = True
except ImportError:
    APPINDICATOR_AVAILABLE = False

# 方法 2: 使用 pycore 的包装器
from pycore.pyutils.native_ui.step6_tray import (
    AppIndicatorSystemTray,
    APPINDICATOR_AVAILABLE,
    check_appindicator_available
)

if APPINDICATOR_AVAILABLE:
    tray = AppIndicatorSystemTray(...)
else:
    # 使用备选方案
    from pycore.pyutils.native_ui.step6_tray import TkinterSystemTray
    tray = TkinterSystemTray(...)
```

## 依赖安装流程

### 新环境设置

```bash
# 1. 克隆项目
git clone <repo>
cd core_node

# 2. 安装核心依赖
pip install -r requirements.txt

# 3. (Linux) 安装系统托盘支持
./scripts/install_ubuntu_tray_support.sh

# 4. 运行应用(自动安装缺失的包)
python pycore_module_caller.py
```

### Docker 环境

```dockerfile
FROM python:3.10

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    python3-gi \
    gir1.2-appindicator3-0.1 \
    libgirepository1.0-dev \
    libcairo2-dev

# 安装 Python 依赖
COPY requirements.txt requirements_linux.txt ./
RUN pip install -r requirements.txt
RUN pip install -r requirements_linux.txt

# 拷贝代码
COPY . .

# third_party.py 会自动处理其他依赖
```

### CI/CD 环境

```yaml
# .github/workflows/test.yml

- name: Install dependencies
  run: |
    pip install -r requirements.txt

    # Linux runners
    if [ "$RUNNER_OS" == "Linux" ]; then
      sudo apt-get install python3-gi gir1.2-appindicator3-0.1
      pip install -r requirements_linux.txt
    fi

- name: Run tests
  run: pytest  # third_party.py 自动处理其他依赖
```

## 最佳实践

### 1. 包分类原则

**必需包(DEPENDENCY_MAP)**:
- 项目核心功能必需
- 无法优雅降级
- 示例: `fastapi`, `PySide6`, `sqlalchemy`

**可选包(OPTIONAL_PACKAGES)**:
- 增强功能
- 代码能处理缺失(通过 `XXX_AVAILABLE` 标志)
- 示例: `edge_tts`, `whisper`, `PyGObject`

**Windows 专用(WINDOWS_ONLY_PACKAGES)**:
- 仅 Windows 平台可用
- Linux/Mac 自动跳过
- 示例: `pywin32`, `pywinauto`

### 2. 版本约束策略

**严格约束**(用于兼容性问题):
```python
"PIL": "Pillow<11,>=10",  # tkhtmlview 需要
"numpy": "numpy<2.3.0,>=2",  # opencv-python 需要
```

**宽松约束**(用于稳定性):
```python
"requests": "requests>=2.31.0",  # 最低版本
"fastapi": "fastapi",  # 无约束
```

**额外依赖**:
```python
"uvicorn": "uvicorn[standard]",  # 包含额外的依赖
"cnocr": "cnocr[ort-cpu]",  # 指定 OCR 引擎
```

### 3. 性能优化

**使用延迟加载**:
```python
# ✓ 启动快
def use_torch():
    torch = get_third_package_torch()
    return torch.tensor([1, 2, 3])

# ✗ 启动慢
from pycore.pyfoundations.third_party import torch
def use_torch():
    return torch.tensor([1, 2, 3])
```

**原因**:
- `import torch` 需要 ~5-10 秒
- 延迟加载只在使用时加载
- 减少应用启动时间

### 4. 错误处理

**检查可用性**:
```python
from pycore.pyutils.native_ui.step6_tray import (
    APPINDICATOR_AVAILABLE,
    check_appindicator_available
)

if not APPINDICATOR_AVAILABLE:
    print("AppIndicator3 not available")
    print("Install with: sudo apt-get install python3-gi gir1.2-appindicator3-0.1")
    # 使用备选方案
```

**优雅降级**:
```python
# 尝试最佳方案
if APPINDICATOR_AVAILABLE:
    tray = AppIndicatorSystemTray(...)
elif PYSTRAY_AVAILABLE:
    tray = TkinterSystemTray(...)
else:
    tray = None
    print("No tray backend available")
```

## 与其他包管理器的对比

| 特性 | pycore (third_party.py) | pip | poetry | pipenv |
|------|------------------------|-----|--------|--------|
| 自动安装 | ✓ | ✗ | ✗ | ✗ |
| 平台特定 | ✓ | 手动 | 手动 | 手动 |
| 实时输出 | ✓ | ✓ | ✗ | ✗ |
| 版本锁定 | 部分 | ✗ | ✓ | ✓ |
| 虚拟环境 | ✗ | 手动 | ✓ | ✓ |
| 延迟加载 | ✓ | ✗ | ✗ | ✗ |
| MCP 兼容 | ✓ | ✗ | ✗ | ✗ |

**总结**:
- **third_party.py**: 自动化,适合开发和生产
- **requirements.txt**: 声明式,适合 CI/CD
- **poetry/pipenv**: 依赖锁定,适合团队协作

## 未来改进

### 1. 依赖锁定

当前: 使用版本约束,但没有 lock 文件

未来:
```bash
# 生成 requirements.lock
pip freeze > requirements.lock

# 或使用 pip-tools
pip-compile requirements.txt
```

### 2. 缓存机制

当前: ENCYCLOPEDIA 缓存(内存,进程级别)

未来:
- 文件缓存(持久化)
- 跨进程共享
- TTL 过期机制

### 3. 安装验证

当前: 检查 `success` 和 "successfully installed"

未来:
- 验证导入(`import <package>`)
- 版本验证(`pkg.__version__`)
- 健康检查(功能测试)

### 4. 并行安装

当前: 顺序安装

未来:
- 并行安装多个包
- 依赖图分析
- 智能排序

## 总结

pycore 项目的包管理系统是一个**自定义的、自动化的、平台感知的**依赖管理解决方案:

### 核心优势

1. **自动安装**: 首次导入时自动检测和安装
2. **平台感知**: 自动处理 Windows/Linux/Mac 差异
3. **延迟加载**: 减少启动时间,按需加载
4. **MCP 兼容**: 支持 MCP 模式(抑制输出)
5. **实时反馈**: 显示安装进度和错误

### 使用指南

1. **添加新包**: 在 `third_party.py` 中注册
2. **使用包**: 从 `third_party` 导入或使用 getter
3. **Linux 系统包**: 使用安装脚本或手动安装
4. **检查可用性**: 使用 `XXX_AVAILABLE` 标志
5. **优雅降级**: 提供备选方案

现在项目有了完整的包管理文档和 Ubuntu AppIndicator3 支持! 🎉
