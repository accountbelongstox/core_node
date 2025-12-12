# Windows Taskbar Duplicate Icon Fix with AppUserModelID

## 📋 问题概述

当 Windows 快捷方式被设置为"以管理员身份运行"后，任务栏会出现**两个图标**：
1. 固定的快捷方式图标（不高亮）
2. 运行中的应用程序图标（单独显示）

**根本原因**：Windows 使用 **AppUserModelID** 来识别和分组任务栏图标。当快捷方式和应用程序的 AppUserModelID 不匹配时，Windows 会将它们视为不同的应用程序，从而显示两个图标。

**实施日期**：2025-12-12
**状态**：✅ 完成

---

## 🎯 解决方案

### 核心思路

1. 在应用程序启动时设置 AppUserModelID
2. 在快捷方式属性中设置相同的 AppUserModelID
3. 确保两者完全一致

### 技术实现

#### 1. AppUserModelID 格式

```
CompanyName.ProductName[.SubProduct[.VersionInformation]]
```

**规则**：
- 最大长度：128 字符
- 不能包含空格
- 建议使用点号分隔

**Matrix 示例**：
```
XingcanMedia.Matrix.Cloud
```

---

## 🔧 实现细节

### 1. 创建 AppUserModelID 管理器

**文件**：`pycore/pyutils/appusermodelid_manager.py`

#### 核心功能

```python
from pycore.pyutils.appusermodelid_manager import (
    set_app_user_model_id,              # 设置当前进程 AppUserModelID
    set_shortcut_app_user_model_id,     # 设置快捷方式 AppUserModelID
    get_app_user_model_id,              # 获取当前进程 AppUserModelID
    get_recommended_app_id              # 生成推荐的 AppUserModelID
)
```

#### 设置进程 AppUserModelID

```python
import ctypes
from ctypes.wintypes import HRESULT

PCWSTR = ctypes.c_wchar_p
SetCurrentProcessExplicitAppUserModelID = ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID
SetCurrentProcessExplicitAppUserModelID.argtypes = [PCWSTR]
SetCurrentProcessExplicitAppUserModelID.restype = HRESULT

app_id = "XingcanMedia.Matrix.Cloud"
result = SetCurrentProcessExplicitAppUserModelID(app_id)
```

#### 设置快捷方式 AppUserModelID

```python
import pythoncom
from win32com.propsys import propsys, pscon

# Initialize COM
pythoncom.CoInitialize()

# Open shortcut's property store
store = propsys.SHGetPropertyStoreFromParsingName(
    str(shortcut_path),
    None,
    pscon.GPS_READWRITE,
    propsys.IID_IPropertyStore
)

# Create PROPVARIANT with AppUserModelID
pv = propsys.PROPVARIANTType(app_id, pythoncom.VT_LPWSTR)

# Set System.AppUserModel.ID property (PKEY_AppUserModel_ID)
pk = propsys.PROPERTYKEY()
pk.fmtid = pythoncom.MakeIID("{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}")
pk.pid = 5

store.SetValue(pk, pv)
store.Commit()
```

---

### 2. 扩展 DesktopIconGenerator

**文件**：`pycore/pyutils/desktop_icon_generator.py`

#### 新增参数

```python
def create_shortcut(self, target_path, name=None, icon_path=None,
                   working_dir=None, arguments="", description="",
                   app_user_model_id=None):  # ← 新增
    """
    Create or modify a desktop shortcut

    Args:
        app_user_model_id: AppUserModelID (prevents duplicate taskbar icons)
                          Example: "XingcanMedia.Matrix.Cloud"
    """
    # ... 创建快捷方式 ...

    # 设置 AppUserModelID 属性
    if app_user_model_id:
        set_shortcut_app_user_model_id(shortcut_path, app_user_model_id)
```

---

### 3. 扩展 ShortcutManager

**文件**：`pycore/pyutils/shortcut_manager.py`

#### 传递 AppUserModelID

```python
def create_shortcut(self, name, command=None, ...,
                   app_user_model_id=None):  # ← 新增
    """
    Create desktop shortcut

    Args:
        app_user_model_id: AppUserModelID (prevents duplicate icons)
                          IMPORTANT: Must match application's AppUserModelID
    """
    # ... 配置快捷方式 ...

    # 传递给 DesktopIconGenerator
    shortcut_path = self.icon_generator.create_shortcut(
        target_path=final_target_path,
        name=final_name,
        ...,
        app_user_model_id=app_user_model_id  # ← 传递
    )
```

---

### 4. 更新 Matrix 应用

**文件**：`pyapps/matrix/matrix_main.py`

#### 定义 AppUserModelID 常量

```python
# Matrix AppUserModelID (prevents duplicate taskbar icons)
MATRIX_APP_USER_MODEL_ID = "XingcanMedia.Matrix.Cloud"
```

#### 启动时设置进程 AppUserModelID

```python
def start():
    """Unified startup entry point"""
    # Set AppUserModelID for current process
    ColorPrint.blue(f"[Matrix] Setting AppUserModelID: {MATRIX_APP_USER_MODEL_ID}")
    if set_app_user_model_id(MATRIX_APP_USER_MODEL_ID):
        ColorPrint.green("[Matrix] ✓ AppUserModelID set for current process")

    # ... 其他启动逻辑 ...
```

#### 创建快捷方式时设置 AppUserModelID

```python
def ensure_desktop_shortcut():
    """Ensure shortcut with AppUserModelID"""
    manager.ensure_shortcut(
        name="Matrix Cloud",
        command=f'python "{PROJECT_ROOT / "pymain.py"}" app=matrix',
        ...,
        app_user_model_id=MATRIX_APP_USER_MODEL_ID  # ← 设置 AppUserModelID
    )
```

---

## 🔄 工作流程

### 完整调用链

```
1. 启动 Matrix 应用
   python pymain.py app=matrix
   ↓
2. matrix_main.start()
   ↓
3. 设置当前进程 AppUserModelID
   set_app_user_model_id("XingcanMedia.Matrix.Cloud")
   ├─ 调用 Windows API: SetCurrentProcessExplicitAppUserModelID
   └─ 返回: S_OK (成功)
   ↓
4. 创建/更新快捷方式
   ensure_desktop_shortcut()
   ├─ ShortcutManager.ensure_shortcut(app_user_model_id="XingcanMedia.Matrix.Cloud")
   ├─ DesktopIconGenerator.create_shortcut(app_user_model_id="XingcanMedia.Matrix.Cloud")
   ├─ 创建 .lnk 文件
   └─ 设置快捷方式 AppUserModelID 属性
       ├─ 打开快捷方式属性存储
       ├─ 设置 System.AppUserModel.ID = "XingcanMedia.Matrix.Cloud"
       └─ 提交更改
   ↓
5. 结果
   快捷方式 AppUserModelID: "XingcanMedia.Matrix.Cloud"
   进程 AppUserModelID:     "XingcanMedia.Matrix.Cloud"
   ✓ 匹配！任务栏显示单个图标
```

---

## 📊 测试场景

### 场景 1：正常启动（不以管理员身份运行）

**操作**：双击桌面快捷方式

**期望结果**：
- ✓ 任务栏只有一个图标
- ✓ 图标与固定的快捷方式合并

### 场景 2：以管理员身份运行

**操作**：
1. 右键快捷方式
2. 选择"以管理员身份运行"

**期望结果**：
- ✓ 任务栏只有一个图标
- ✓ UAC 提示后，图标与快捷方式合并
- ✓ 没有第二个图标出现

### 场景 3：固定快捷方式属性

**操作**：
1. 右键快捷方式 → 属性
2. 勾选"以管理员身份运行此程序"
3. 应用并确定
4. 双击启动

**期望结果**：
- ✓ 任务栏只有一个图标
- ✓ 每次启动都以管理员身份运行
- ✓ 没有重复图标

### 场景 4：固定到任务栏

**操作**：
1. 将快捷方式固定到任务栏
2. 从任务栏启动
3. 以管理员身份运行

**期望结果**：
- ✓ 任务栏图标高亮
- ✓ 没有第二个图标
- ✓ 正确分组

---

## 🧪 验证方法

### 方法 1：检查进程 AppUserModelID

```python
from pycore.pyutils.appusermodelid_manager import get_app_user_model_id

# 在应用运行时检查
current_id = get_app_user_model_id()
print(f"Current AppUserModelID: {current_id}")
# 期望输出: XingcanMedia.Matrix.Cloud
```

### 方法 2：检查快捷方式属性

**PowerShell 脚本**：
```powershell
# 读取快捷方式的 AppUserModelID
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace("$env:USERPROFILE\Desktop")
$item = $folder.ParseName("星灿传媒云矩阵.lnk")

if ($item) {
    $property = $folder.GetDetailsOf($item, 288)  # System.AppUserModel.ID
    Write-Host "Shortcut AppUserModelID: $property"
}
```

### 方法 3：运行测试脚本

```bash
# 测试 AppUserModelID 功能
python pycore/pyutils/appusermodelid_manager.py

# 重新运行 Matrix（会自动设置 AppUserModelID）
python pymain.py app=matrix
```

---

## 🛠️ 依赖项

### Python 包

```bash
pip install pywin32
```

**说明**：
- `win32com.propsys` - 用于操作快捷方式属性
- `ctypes` - 用于调用 Windows API（内置）

### Windows API

- `SetCurrentProcessExplicitAppUserModelID` - 设置进程 AppUserModelID
- `GetCurrentProcessExplicitAppUserModelID` - 获取进程 AppUserModelID
- `SHGetPropertyStoreFromParsingName` - 打开快捷方式属性存储

---

## 🚨 常见问题

### 问题 1：仍然显示两个图标

**可能原因**：
1. AppUserModelID 不匹配
2. 快捷方式未更新
3. 旧的快捷方式缓存

**解决方法**：
```bash
# 1. 删除桌面快捷方式
# 2. 重新运行应用（会创建新快捷方式）
python pymain.py app=matrix

# 3. 取消固定并重新固定到任务栏
```

### 问题 2：pywin32 未安装

**错误信息**：
```
[AppUserModelID] ✗ Missing dependency: No module named 'win32com'
[AppUserModelID] Install: pip install pywin32
```

**解决方法**：
```bash
pip install pywin32
```

### 问题 3：AppUserModelID 设置失败

**错误信息**：
```
[AppUserModelID] ✗ Failed to set (HRESULT: 0x80070057)
```

**可能原因**：
- AppUserModelID 格式无效（包含空格、太长等）
- 非 Windows 系统

**解决方法**：
- 检查 AppUserModelID 格式
- 确保在 Windows 上运行

---

## 📝 最佳实践

### 1. 命名约定

```python
# ✓ 推荐：清晰的层级结构
"CompanyName.ProductName.Feature"
"XingcanMedia.Matrix.Cloud"

# ✗ 不推荐：包含空格
"Xingcan Media.Matrix Cloud"

# ✗ 不推荐：太长
"XingcanMediaTechnologyCompany.MatrixCloudApplication.Version1.0.0.Beta"
```

### 2. 一致性

```python
# 定义常量（在一个地方）
MATRIX_APP_USER_MODEL_ID = "XingcanMedia.Matrix.Cloud"

# 在整个应用中使用相同的常量
set_app_user_model_id(MATRIX_APP_USER_MODEL_ID)
manager.ensure_shortcut(..., app_user_model_id=MATRIX_APP_USER_MODEL_ID)
```

### 3. 早期设置

```python
def start():
    # ✓ 在应用启动早期设置（第一件事）
    set_app_user_model_id(MATRIX_APP_USER_MODEL_ID)

    # 然后是其他初始化
    # ...
```

### 4. 错误处理

```python
# ✓ 检查返回值
if set_app_user_model_id(app_id):
    print("✓ Success")
else:
    print("⚠ Failed (non-Windows or error)")
    # 继续运行，不要中断应用
```

---

## 📚 参考资料

### Microsoft 官方文档

- [Application User Model IDs (AppUserModelIDs)](https://learn.microsoft.com/en-us/windows/win32/shell/appids)
- [System.AppUserModel.ID Property](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id)
- [SetCurrentProcessExplicitAppUserModelID](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-setcurrentprocessexplicitappusermodelid)

### 问题讨论

- [How to avoid SetCurrentProcessExplicitAppUserModelID causing duplicating](https://learn.microsoft.com/en-us/answers/questions/145964/how-to-avoid-setcurrentprocessexplicitappusermodel)
- [Portable mode: Use distinct AppUserModelID](https://github.com/gitextensions/gitextensions/issues/12524)
- [Set AppUserModelID in subprocesses](https://github.com/cztomczak/cefpython/issues/395)

---

## ✅ 实施检查清单

Matrix 应用已完成以下工作：

- [x] 创建 AppUserModelID 管理器 (`appusermodelid_manager.py`)
- [x] 扩展 DesktopIconGenerator 支持 AppUserModelID 参数
- [x] 扩展 ShortcutManager 支持 AppUserModelID 参数
- [x] 在 Matrix 应用启动时设置进程 AppUserModelID
- [x] 在创建快捷方式时设置 AppUserModelID 属性
- [x] 定义统一的 AppUserModelID 常量
- [x] 添加详细的日志输出
- [x] 创建完整的文档

---

## 📁 修改的文件

### 1. 新增文件
- ✅ `pycore/pyutils/appusermodelid_manager.py` - AppUserModelID 管理器

### 2. 修改文件
- ✅ `pycore/pyutils/desktop_icon_generator.py` - 添加 `app_user_model_id` 参数
- ✅ `pycore/pyutils/shortcut_manager.py` - 传递 `app_user_model_id` 参数
- ✅ `pyapps/matrix/matrix_main.py` - 设置进程和快捷方式 AppUserModelID

### 3. 文档
- ✅ `doc/APPUSERMODELID_FIX_IMPLEMENTATION.md` - 本文档

---

## 🎉 总结

**问题**：以管理员身份运行时任务栏显示两个图标

**原因**：AppUserModelID 不匹配

**解决方案**：
1. 在应用启动时设置进程 AppUserModelID
2. 在快捷方式上设置相同的 AppUserModelID
3. 确保两者完全一致

**效果**：
- ✅ 任务栏只显示一个图标
- ✅ 正确分组和高亮
- ✅ 支持固定到任务栏
- ✅ 支持以管理员身份运行

---

**文档版本**：v1.0
**最后更新**：2025-12-12
**作者**：Claude Code
**状态**：✅ 实现完成
