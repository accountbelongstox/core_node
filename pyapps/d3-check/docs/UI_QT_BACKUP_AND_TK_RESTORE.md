# UI: 备份 Qt 版本并恢复 Tk UI

本文档说明如何：先备份当前 PySide6（Qt）版本，再从 `backup_before_pyside6` 恢复原来的 Tkinter（Tk）界面。

## 1. 当前状态

- **主分支**：入口 `main.py` 使用 PySide6，创建 `QApplication`，`ui/diablo3_macro_ui.py` 为 Qt 实现（`D3MainWindow`、`panels_qt`、`components_qt`、`widgets_qt`、`config_qt` 等）。
- **备份目录** `backup_before_pyside6`：迁移到 PySide6 之前的 Tk 版本，包含 Tk 版 `main.py`、`controller/d3_macro_controller.py`、整份 `ui/`（panels、components、theme、unified_styles、utils、widgets）、以及部分 `share/`、`share/values/`、`d3utils/` 等（见该目录下 `README_BACKUP.txt`）。

## 2. 操作顺序

1. **先备份 Qt 版本**：将当前使用 PySide6 的代码复制到新备份目录，便于日后恢复 Qt UI。
2. **再恢复 Tk UI**：用 `backup_before_pyside6` 中的 Tk 文件覆盖主分支对应路径，并视需要移除或保留 Qt 专用目录。

---

## 3. 第一步：备份 Qt 版本

### 3.1 新建备份目录

在 `pyapps/d3-check` 下新建目录，例如：

- `backup_pyside6`  
或  
- `backup_qt_YYYYMMDD`（按日期命名）

以下以 `backup_pyside6` 为例。

### 3.2 需要备份的文件与目录

| 路径 | 说明 |
|------|------|
| `main.py` | 当前入口（含 PySide6、QApplication 创建） |
| `controller/d3_macro_controller.py` | 当前 controller（与 Qt UI 配合的版本） |
| `ui/diablo3_macro_ui.py` | 当前 Qt 版主 UI 协调器 |
| `ui/qt_main_window.py` | Qt 主窗口 |
| `ui/qt_app_styles.py` | Qt 全局样式 |
| `ui/qt_compat.py` | Qt/Tk 兼容 mixin |
| `ui/components_qt/` | 整个目录（title_bar_qt、bottom_bar_qt、macro_controls_qt 等） |
| `ui/panels_qt/` | 整个目录（各面板 Qt 实现及 __init__、stubs） |
| `ui/widgets_qt/` | 整个目录（如 hotkey_input_qt 等） |
| `ui/utils/config_qt.py` | Qt 用 config 读写封装 |

说明：仅备份与 Qt 直接相关的部分；若某文件在 Tk 恢复后仍与 Qt 共用（如部分 `ui/utils`、`share`），可按需决定是否一并备份到同一目录以便对照。

### 3.3 备份命令示例（PowerShell，在 pyapps/d3-check 下执行）

```powershell
$bak = "backup_pyside6"
New-Item -ItemType Directory -Force $bak
New-Item -ItemType Directory -Force $bak\controller
New-Item -ItemType Directory -Force $bak\ui
New-Item -ItemType Directory -Force $bak\ui\utils

Copy-Item main.py $bak\
Copy-Item controller\d3_macro_controller.py $bak\controller\
Copy-Item ui\diablo3_macro_ui.py $bak\ui\
Copy-Item ui\qt_main_window.py $bak\ui\
Copy-Item ui\qt_app_styles.py $bak\ui\
Copy-Item ui\qt_compat.py $bak\ui\
Copy-Item -Recurse ui\components_qt $bak\ui\
Copy-Item -Recurse ui\panels_qt $bak\ui\
Copy-Item -Recurse ui\widgets_qt $bak\ui\
Copy-Item ui\utils\config_qt.py $bak\ui\utils\
```

备份完成后，可在 `backup_pyside6/README_BACKUP.txt` 中注明备份日期与“用于从 Tk 恢复后再次切回 Qt”的说明。

---

## 4. 第二步：恢复原来的 Tk UI

### 4.1 从 backup_before_pyside6 恢复的文件与目录

以下路径均从 `backup_before_pyside6` 复制回主分支对应位置（覆盖当前文件）：

| 备份路径 (backup_before_pyside6/...) | 恢复目标 (主分支) |
|--------------------------------------|--------------------|
| `main.py` | `main.py` |
| `controller/d3_macro_controller.py` | `controller/d3_macro_controller.py` |
| `ui/diablo3_macro_ui.py` | `ui/diablo3_macro_ui.py` |
| `ui/panels/*` | `ui/panels/`（整目录覆盖） |
| `ui/components/*` | `ui/components/`（整目录覆盖） |
| `ui/widgets/*` | `ui/widgets/`（整目录覆盖） |
| `ui/theme/*` | `ui/theme/`（整目录覆盖） |
| `ui/unified_styles.py` | `ui/unified_styles.py` |
| `ui/utils/*`（Tk 用：config_binding、tk_variables、app_root、offset_input 等） | `ui/utils/`（按文件覆盖，注意不要覆盖掉仅 Qt 用的 config_qt 若需保留） |

说明：

- `backup_before_pyside6` 的 `ui/utils/` 含 Tk 用的 `tk_variables`、`app_root`、`config_binding` 等；恢复时用备份中这些文件覆盖主分支同名文件即可。若主分支存在 `config_qt.py`，恢复 Tk 后主入口不再使用它，可保留不删（仅避免 Tk 代码误引）或移至备份。
- `share/`、`share/values/`、`d3utils/` 等：若主分支这些文件与备份有差异且希望与 Tk 时代一致，可按 `backup_before_pyside6/README_BACKUP.txt` 所列逐项从备份恢复；若已与 Qt 共用且无冲突，可只恢复 UI 相关部分。

### 4.2 恢复命令示例（PowerShell，在 pyapps/d3-check 下执行）

```powershell
$src = "backup_before_pyside6"

Copy-Item $src\main.py . -Force
Copy-Item $src\controller\d3_macro_controller.py controller\ -Force
Copy-Item $src\ui\diablo3_macro_ui.py ui\ -Force
Copy-Item $src\ui\unified_styles.py ui\ -Force
Copy-Item -Recurse $src\ui\panels\* ui\panels\ -Force
Copy-Item -Recurse $src\ui\components\* ui\components\ -Force
Copy-Item -Recurse $src\ui\widgets\* ui\widgets\ -Force
Copy-Item -Recurse $src\ui\theme\* ui\theme\ -Force
# 按需恢复 ui/utils 下 Tk 相关文件（若主分支已缺失或被改）
Copy-Item $src\ui\utils\config_binding.py ui\utils\ -Force
Copy-Item $src\ui\utils\tk_variables.py ui\utils\ -Force
Copy-Item $src\ui\utils\app_root.py ui\utils\ -Force
Copy-Item $src\ui\utils\offset_input.py ui\utils\ -Force
Copy-Item $src\ui\utils\__init__.py ui\utils\ -Force
```

若备份中还有 `ui/utils` 下其它 Tk 专用文件（如 `config_binding` 依赖的模块），一并从 `backup_before_pyside6/ui/utils/` 复制到 `ui/utils/`。

### 4.3 恢复后可选：移除 Qt 专用目录/文件（避免误用）

恢复 Tk 后，主入口不再引用以下 Qt 专用代码；若希望树结构干净，可删除或移走（不删也可，只要不 import）：

- `ui/qt_main_window.py`
- `ui/qt_app_styles.py`
- `ui/qt_compat.py`
- `ui/components_qt/`
- `ui/panels_qt/`
- `ui/widgets_qt/`
- `ui/utils/config_qt.py`

删除示例（可选）：

```powershell
Remove-Item ui\qt_main_window.py, ui\qt_app_styles.py, ui\qt_compat.py -Force
Remove-Item -Recurse -Force ui\components_qt, ui\panels_qt, ui\widgets_qt
Remove-Item ui\utils\config_qt.py -Force
```

若已做“第一步：备份 Qt 版本”，这些文件已保存在 `backup_pyside6`，需要时可从该备份再恢复 Qt UI。

### 4.4 恢复后入口行为

- `main.py` 不再创建 `QApplication`，不再 `import PySide6`；与 `backup_before_pyside6/main.py` 一致，仅启动 Tk GUI + HTTP bridge。
- `controller/d3_macro_controller.py` 仍通过 `from ui.diablo3_macro_ui import Diablo3MacroUI` 创建 UI；恢复后为 Tk 版 `Diablo3MacroUI`，接口（`get_panel`、`run`、`destroy`、回调设置等）与现有 controller 兼容。
- `share.ui_registry`、`ui.utils.app_root` 仍通过 `get_root()`/`get_ui_panel()` 提供根窗口与面板，Tk 版会再次注册 `tk.Tk` 为 root。

---

## 5. 小结

| 步骤 | 动作 |
|------|------|
| 1 | 新建 `backup_pyside6`（或带日期目录），将当前 `main.py`、controller、`ui/diablo3_macro_ui.py`、`qt_*`、`components_qt`、`panels_qt`、`widgets_qt`、`config_qt` 复制进去 |
| 2 | 从 `backup_before_pyside6` 将 `main.py`、controller、Tk 版 `ui`（diablo3_macro_ui、panels、components、widgets、theme、unified_styles、utils 中 Tk 相关）覆盖到主分支 |
| 3 | （可选）删除或移走主分支中 Qt 专用文件/目录，避免误引 |

完成后运行 `python main.py`（或 `PYTHON .\pyapps\d3-check\main.py`）应启动 Tk GUI；若需再次使用 Qt UI，可从 `backup_pyside6` 按上述文件列表反向恢复。
