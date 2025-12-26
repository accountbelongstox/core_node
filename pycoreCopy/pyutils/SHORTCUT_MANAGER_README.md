# 快捷方式管理系统使用说明

## 概述

这是一个通用的桌面快捷方式管理系统，可以为任何 Python 应用创建桌面快捷方式。

## 核心组件

### 1. ShortcutManager 类 (`pycore/pyutils/shortcut_manager.py`)

通用快捷方式管理器，提供以下功能：

- **自动图标检测**：在应用目录中搜索 `.ico` 和 `.png` 图标文件
- **BAT 文件生成**：自动创建临时 BAT 文件来执行 Python 命令
- **Windows 版本检测**：根据 Windows 版本（Win10/Win11）选择合适的环境路径
- **快捷方式创建/更新**：创建或更新桌面快捷方式

#### 使用方法

```python
from pycore.pyutils.shortcut_manager import ShortcutManager
from pathlib import Path

# 初始化管理器
manager = ShortcutManager()

# 方式 1：使用 ensure_shortcut（推荐）
manager.ensure_shortcut(
    name="My App",
    command='python ./pymain.py app=myapp',
    icon_search_dir=Path("pyapps/myapp/resources"),
    working_dir=Path.cwd(),
    description="Launch My Application"
)

# 方式 2：使用便捷函数 create_app_shortcut
from pycore.pyutils.shortcut_manager import create_app_shortcut

create_app_shortcut(
    app_name="myapp",
    command='python ./pymain.py app=myapp',
    icon_search_dir=Path("pyapps/myapp/resources"),
    working_dir=Path.cwd(),
    description="Launch My Application",
    shortcut_name="My App"  # 可选，默认使用 app_name
)
```

### 2. Matrix 应用集成示例

#### 方式 1：应用启动时自动创建（推荐）

在 `pyapps/matrix/matrix_main.py` 中的 `start()` 函数开始时：

```python
def ensure_desktop_shortcut():
    """Ensure Matrix desktop shortcut exists"""
    try:
        ColorPrint.blue("[Matrix] Checking desktop shortcut...")
        manager = ShortcutManager()

        app_dir = Path(__file__).parent
        resources_dir = app_dir / "resources"

        manager.ensure_shortcut(
            name="Matrix Cloud",
            command=f'python "{PROJECT_ROOT / "pymain.py"}" app=matrix',
            icon_search_dir=resources_dir,
            working_dir=PROJECT_ROOT,
            description="Launch Matrix Cloud - Android Device Manager"
        )
        ColorPrint.green("[Matrix] ✓ Desktop shortcut ready")
    except Exception as e:
        ColorPrint.yellow(f"[Matrix] Warning: Could not create desktop shortcut: {e}")

def start():
    # 在应用启动时确保快捷方式存在
    ensure_desktop_shortcut()

    # ... 其余启动代码
```

#### 方式 2：使用独立脚本

运行 `pyapps/matrix/create_shortcut.py`：

```bash
python pyapps/matrix/create_shortcut.py
```

此脚本会：
1. 查找 Matrix 应用图标（`pyapps/matrix/resources/icon.ico`）
2. 创建临时 BAT 文件（`D:\.dev_win10\.winenvs\matrix_cloud.bat`）
3. 创建桌面快捷方式（`Desktop/Matrix Cloud.lnk`）

## 图标搜索优先级

ShortcutManager 按以下优先级搜索图标：

1. `{app_dir}/resources/icon.ico`
2. `{app_dir}/resources/{app_name}.ico`
3. `{app_dir}/resources/icon.png`
4. `{app_dir}/resources/{app_name}.png`
5. `{app_dir}/resources/logo.png`
6. `{app_dir}/resources/` 下的第一个 `.ico` 文件
7. `{app_dir}/resources/` 下的第一个 `.png` 文件
8. Python 解释器图标（后备方案）

## 生成的文件位置

### BAT 文件
- **路径**：`D:\.dev_{win_version}\.winenvs\{shortcut_name_lowercase}.bat`
- **示例**：`D:\.dev_win10\.winenvs\matrix_cloud.bat`
- **内容**：
  ```batch
  @echo off
  cd /d "D:\programing\core_node"
  python "D:\programing\core_node\pymain.py" app=matrix
  ```

### 快捷方式
- **路径**：`Desktop/{shortcut_name}.lnk`
- **示例**：`Desktop/Matrix Cloud.lnk`
- **属性**：
  - 目标：BAT 文件路径
  - 图标：应用图标路径
  - 工作目录：项目根目录
  - 描述：应用描述

## 为其他应用添加快捷方式支持

### 步骤 1：在应用入口添加导入

```python
from pycore.pyutils.shortcut_manager import ShortcutManager
```

### 步骤 2：在启动函数中添加快捷方式创建

```python
def start():
    # 创建快捷方式
    try:
        manager = ShortcutManager()
        app_dir = Path(__file__).parent

        manager.ensure_shortcut(
            name="Your App Name",
            command='python ./pymain.py app=yourapp',
            icon_search_dir=app_dir / "resources",
            working_dir=PROJECT_ROOT,
            description="Launch Your Application"
        )
        print("Desktop shortcut ready")
    except Exception as e:
        print(f"Warning: Could not create desktop shortcut: {e}")

    # ... 其余启动代码
```

### 步骤 3：（可选）创建独立脚本

参考 `pyapps/matrix/create_shortcut.py` 创建类似的独立脚本。

## 命令行使用

ShortcutManager 支持命令行调用：

```bash
# 为应用创建快捷方式
python pycore/pyutils/shortcut_manager.py --app matrix

# 创建自定义快捷方式
python pycore/pyutils/shortcut_manager.py \
    --name "My App" \
    --command "python ./myapp.py" \
    --icon "path/to/icon.ico" \
    --description "My Application"
```

## 与现有 launcher 系统的兼容性

原有的 `pycore/pyutils/launcher/shortcut_check.ps1` 仍然保留，用于 Window Launcher 的快捷方式创建。

新的 ShortcutManager 系统：
- 提供更灵活的 Python API
- 支持任意应用调用
- 自动化图标检测
- 统一的 BAT 文件管理

两个系统可以并存，互不影响。

## 故障排查

### 问题：快捷方式未创建

**解决方案**：
1. 检查是否有管理员权限
2. 确认桌面路径是否正确
3. 查看错误日志

### 问题：图标未显示

**解决方案**：
1. 确认图标文件存在于 `resources` 目录
2. 检查图标文件格式（支持 `.ico` 和 `.png`）
3. 确保图标文件路径正确

### 问题：快捷方式执行失败

**解决方案**：
1. 检查 BAT 文件内容（`D:\.dev_win10\.winenvs\{app_name}.bat`）
2. 确认工作目录正确
3. 手动运行 BAT 文件测试

## 技术细节

### Windows 版本检测

```python
def get_windows_version():
    """获取 Windows 版本"""
    version = platform.version()
    build = int(version.split('.')[-1])
    return 'win11' if build >= 22000 else 'win10'
```

### 桌面路径检测

```python
def _get_desktop_path():
    """获取桌面路径"""
    if platform.system() == "Windows":
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
        )
        desktop = winreg.QueryValueEx(key, "Desktop")[0]
        return Path(desktop)
    return Path.home() / "Desktop"
```

### PowerShell 快捷方式创建

```python
ps_script = f"""
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
$Shortcut.TargetPath = "{bat_file}"
$Shortcut.WorkingDirectory = "{working_dir}"
$Shortcut.IconLocation = "{icon_path}"
$Shortcut.Description = "{description}"
$Shortcut.Save()
"""
subprocess.run(["powershell", "-NoProfile", "-Command", ps_script])
```

## 总结

新的快捷方式管理系统提供了：
- ✅ 通用化的 API，支持任何应用
- ✅ 自动图标检测
- ✅ 自动 BAT 文件生成
- ✅ 统一的快捷方式管理
- ✅ Matrix 应用集成示例
- ✅ 命令行工具支持
- ✅ 与现有系统兼容

现在，任何应用都可以轻松创建桌面快捷方式，只需几行代码！
