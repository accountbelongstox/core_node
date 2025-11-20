# Matrix - Dependency Check Added

## 修改说明

已在所有必要的控制器类中添加依赖检查和安装，确保所有库在初始化时被自动安装。

## 修改的文件

### 1. `controller/ui_controller.py`

**添加位置：** 文件开头，import 语句之前

```python
# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import tkinter as tk
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint
```

**原因：** MatrixUIController 使用 tkinterweb/tkhtmlview 等可选库

### 2. `controller/frontend_controller.py`

**添加位置：** 文件开头，import 语句之前

```python
# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import os
import subprocess
# ... other imports
```

**原因：** FrontendController 使用 requests 库进行健康检查

### 3. `controller/backend_controller.py`

**添加位置：** 文件开头，import 语句之前

```python
# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import threading
# ... other imports
```

**原因：** BackendController 使用 uvicorn 和 fastapi

### 4. `controller/matrix_service.py`

**添加位置：** 文件开头，import 语句之前

```python
# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import time
from dataclasses import dataclass
# ... other imports
```

**原因：** MatrixService 依赖于其他控制器，确保整个服务链的依赖都被检查

### 5. `matrix_main.py`

**添加位置：** 项目根路径设置之后，其他 import 之前

```python
# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

from pycore.pyfoundations.color_print import ColorPrint
# ... other imports
```

**原因：** 主入口文件，确保所有依赖在应用启动前被检查和安装

## 依赖检查机制

`check_and_install_dependencies()` 函数会：

1. **检查必需的包**
   - 读取项目的依赖配置
   - 检查当前环境中已安装的包
   - 识别缺失的包

2. **自动安装缺失的包**
   - 使用 pip 自动安装缺失的包
   - 显示安装进度和结果
   - 处理安装失败的情况

3. **验证安装**
   - 确认所有包都成功安装
   - 返回安装状态

## 受益的库

添加依赖检查后，以下库会被自动检查和安装：

### 核心依赖
- `fastapi` - Backend API 框架
- `uvicorn[standard]` - ASGI 服务器
- `websockets` - WebSocket 支持
- `requests` - HTTP 客户端（健康检查）

### UI 依赖（可选）
- `tkinterweb` - HTML/CSS/JS webview（首选）
- `tkhtmlview` - HTML 渲染（备选）
- `pystray` - 系统托盘支持
- `pillow` - 图像处理

### 其他依赖
- `pydantic` - 数据验证
- `adb-shell` - ADB 通信
- `numpy` - 数值计算
- `opencv-python` - 图像处理

## 启动流程

```
python ./pymain.py app=matrix
  ↓
matrix_main.py 加载
  ↓
check_and_install_dependencies() 执行
  ├── 检查 fastapi, uvicorn, requests 等
  ├── 自动安装缺失的包
  └── 显示检查结果
  ↓
导入 pycore 模块
  ↓
导入 matrix 控制器
  ├── controller/matrix_service.py
  │   └── check_and_install_dependencies()
  ├── controller/frontend_controller.py
  │   └── check_and_install_dependencies()
  ├── controller/backend_controller.py
  │   └── check_and_install_dependencies()
  └── controller/ui_controller.py
      └── check_and_install_dependencies()
  ↓
启动应用
```

## 优点

### 1. **自动化依赖管理**
- 无需手动 `pip install -r requirements.txt`
- 首次运行自动安装所有依赖
- 减少用户配置错误

### 2. **更好的用户体验**
- 清晰的依赖检查输出
- 自动处理缺失的包
- 友好的错误提示

### 3. **开发便利性**
- 新开发者只需运行应用
- 自动配置开发环境
- 减少环境配置文档

### 4. **容错性**
- 多次检查确保依赖完整
- 每个模块独立检查
- 降级处理（如无 webview 库）

## 注意事项

### 1. **性能影响**

依赖检查会在每次导入时执行，但：
- 只有首次会实际安装包
- 后续检查很快（仅验证）
- 可以通过缓存优化

### 2. **安装权限**

某些环境可能需要管理员权限：
```bash
# Windows
python ./pymain.py app=matrix  # 通常可以
# 如果失败：以管理员身份运行

# Linux/macOS
python ./pymain.py app=matrix  # 通常可以
# 如果失败：sudo python ./pymain.py app=matrix
```

### 3. **虚拟环境**

建议在虚拟环境中使用：
```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

# 运行应用（会自动安装依赖）
python ./pymain.py app=matrix
```

## 测试验证

### 1. **全新环境测试**

```bash
# 创建新的虚拟环境
python -m venv test_env
test_env\Scripts\activate  # Windows
# source test_env/bin/activate  # Linux/macOS

# 只安装 pycore 必需的包
pip install loguru

# 运行应用（会自动安装其他依赖）
python ./pymain.py app=matrix
```

**期望输出：**
```
[INFO] Checking for required Python packages...
[INFO] Installing missing packages: fastapi, uvicorn, requests, websockets...
[INFO] All required packages are available.
```

### 2. **依赖缺失测试**

```bash
# 卸载某个包
pip uninstall fastapi -y

# 运行应用
python ./pymain.py app=matrix

# 应该看到自动安装
[INFO] Installing missing packages: fastapi...
```

### 3. **可选依赖测试**

```bash
# 卸载 webview 库
pip uninstall tkinterweb tkhtmlview -y

# 运行应用
python ./pymain.py app=matrix

# UI 应该降级处理（显示打开浏览器按钮）
```

## 配置文件位置

依赖配置通常在以下位置：
- `pycore/requirements.txt` - pycore 基础依赖
- `pyapps/matrix/requirements.txt` - Matrix 特定依赖（如果有）
- `requirements.txt` - 项目根目录（全局依赖）

## 未来改进

### 1. **依赖缓存**
```python
# 避免重复检查
_dependency_checked = False

def check_and_install_dependencies():
    global _dependency_checked
    if _dependency_checked:
        return
    # ... 检查和安装逻辑 ...
    _dependency_checked = True
```

### 2. **选择性安装**
```python
# 只安装特定组件的依赖
check_and_install_dependencies(components=['webview', 'backend'])
```

### 3. **版本管理**
```python
# 检查并更新到特定版本
check_and_install_dependencies(upgrade=True, min_versions={
    'fastapi': '0.104.0',
    'uvicorn': '0.24.0'
})
```

## 总结

已在所有 Matrix 控制器和主入口文件中添加 `check_and_install_dependencies()` 调用：

- ✅ matrix_main.py
- ✅ controller/matrix_service.py
- ✅ controller/frontend_controller.py
- ✅ controller/backend_controller.py
- ✅ controller/ui_controller.py

这确保了应用启动时所有必需的依赖都会被自动检查和安装，提供更好的用户体验。
