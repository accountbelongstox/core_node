# 技术说明：i18n_rosbot_panel_en、providor/constants、_obsolete_color_print、validate

**目的**：说明这四处代码/配置的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `providor/i18n/i18n_rosbot_panel_en.json`
- `providor/constants/__init__.py`
- `utils/_obsolete_color_print.py`
- `validate.py`

---

## 一、providor/i18n/i18n_rosbot_panel_en.json

### 1.1 职责与约定

- **用途**：ROSBOT 扩展面板的英文文案，供 i18n_manager 按 key 取文本。结构为 **ui.rosbot** 下大量键：title、configuration、path、browse、start、stop、status、log、scan、battlenet/d3/ros 状态标签（如 status_running、d3_disconnected、battlenet_on_login_screen）、ensure_battlenet_only、debug、oauth_script 等。与 i18n_main_window_en、i18n_skill_config_en 等并列，按**面板/功能域**分文件。
- **使用方式**：代码侧通过 i18n_manager 的 get_ui_text 等接口，使用与 JSON 内路径一致的 key（如 ui.rosbot.start_rosbot、ui.rosbot.d3_disconnected）；key 与 JSON 层级、命名必须一致。

### 1.2 易被误解或改错的原因

1. **key 路径不一致**：若代码里用 `rosbot.start_rosbot` 或 `ui.rosbot_extension.start`，而 JSON 只有 `ui.rosbot.start_rosbot`，会取不到或取错；反之在 JSON 中改名/移动节点未同步代码也会缺译。
2. **新增/删除 key 未同步**：在面板中新增文案但未在 i18n_rosbot_panel_en.json 中补 key，或删除/重命名 key 未改代码，会导致显示 key 或 KeyError。
3. **多语言不一致**：若存在 i18n_rosbot_panel_zh.json 等，只改英文未改中文或结构不一致，某语言会缺 key。
4. **占位符格式**：如 log_last_ago 为 "Last: {0} ago"，代码须按 i18n_manager 的占位符约定传参（如 .format(t)）；若改用 {seconds} 等命名占位符而 i18n 实现只支持位置参数，会显示未替换。

### 1.3 正确做法

- 增删改 ROSBOT 面板文案时，JSON 与所有 get_ui_text 的代码一起改；key 与 i18n_manager 的命名空间约定一致（如 ui.rosbot.*）；多语言 JSON 结构保持一致。

---

## 二、providor/constants/__init__.py

### 2.1 职责与约定

- **用途**：constants 命名空间入口，**仅做子模块导入与 __all__ 声明**，不做常量聚合再导出。约定用法：`from providor.constants import common, d3, d4`，再 `from providor.constants.common import TMP_DIR` 等。文档注明 "Direct reference only; no aggregation re-export"。
- **子模块**：common、d3、d4；__all__ = ["common", "d3", "d4"]。

### 2.2 易被误解或改错的原因

1. **新增子模块未在 __init__.py 中声明**：若在 constants 下新增 d5 或 app_constants 等，但未在 __init__.py 中 `from . import d5` 并加入 __all__，则 `from providor.constants import d5` 会失败。
2. **删除或重命名子模块未同步**：若将 common 改名为 base 或删除 d4，未同步 __init__.py，会破坏现有 `from providor.constants import common, d4` 等导入。
3. **在 __init__.py 中做聚合导出**：若写 `from .common import *` 并 re-export 到本包顶层，与文档「不聚合 re-export」矛盾，且易造成命名冲突或循环依赖。
4. **与 app_constants 混淆**：providor 下另有 app_constants（D3/D4 业务常量）；constants 包为 common/d3/d4 等**目录**；不要误在 constants/__init__.py 里导出 app_constants 的符号除非明确约定。

### 2.3 正确做法

- 新增/删除/重命名 constants 子模块时，同步修改 __init__.py 的 import 与 __all__；保持「仅引用子模块、不聚合常量」的用法。

---

## 三、utils/_obsolete_color_print.py

### 3.1 职责与约定

- **用途**：文件名带 **_obsolete_**，表示**已废弃**。提供旧版 ColorPrint：静态方法 green/blue/red/yellow/gray/white、update_line；使用 ANSI 转义码；模块级 _last_was_update_line 用于 update_line 后换行。**无** register_callback、无 notify、无 log_level。当前项目统一使用 **pycore.pyfoundations.color_print** 的 ColorPrint，支持回调（如 log_panel 注册）、log_level、notify，供主流程与 UI 日志展示。
- **与主流程关系**：主流程、log_panel、d3utils 等应只从 pycore 的 ColorPrint 导入；不从此 _obsolete_ 文件导入。若某处误从此文件导入，则 log 不会进入主界面日志、且行为与项目其余部分不一致。

### 3.2 易被误解或改错的原因

1. **误用 obsolete 版**：若在新增代码或修复时从 `utils.color_print` 或 `utils._obsolete_color_print` 导入 ColorPrint，则无回调、log_panel 收不到消息，或与其它模块使用的 pycore ColorPrint 不是同一实例。
2. **在 obsolete 文件中“修 bug”**：若在 _obsolete_color_print 中修改逻辑并期望主程序生效，主程序并不使用此文件，修改无效。
3. **两套 ColorPrint 混用**：部分模块用 pycore、部分用 utils，会导致日志只在一处显示、或 update_line 与 callback 行为不一致。
4. **columns 依赖**：obsolete 版在模块加载时用 shutil.get_terminal_size().columns，若在无 TTY 环境（如 GUI 启动时）可能异常或得到默认值；pycore 版可能在不同时机取 columns，行为可能不同。

### 3.3 正确做法

- 所有需要打日志或参与 UI 日志的代码，统一 `from pycore.pyfoundations.color_print import ColorPrint`；不导入 utils._obsolete_color_print。废弃文件仅作参考，不在其上做功能修改。

---

## 四、validate.py

### 4.1 职责与约定

- **用途**：统一模型校验入口脚本。路径：current_dir = os.path.dirname(os.path.abspath(__file__))（即 pyapps/d3-check 根）；cache_dir = project_root / ".cache" / "training_data"；classification_dir = cache_dir / "3_models" / "classification"；detection_dir = cache_dir / "3_models" / "detection"；output_dir = ~/.core_node/pytools/tmp/validation。扫描分类模型：各子目录下 weights/best.pt；分类固定 window_size=76，class_id=1 表示 "yes"。检测模型：data.yaml 从 2_datasets/detection/unified_model/data.yaml 读 class names；推理用 640x640 letterbox。使用 **pycore** ColorPrint。
- **依赖**：ultralytics YOLO、cv2、numpy、yaml；分类/检测目录结构与 train 脚本产出一致（3_models/classification、3_models/detection、2_datasets/.../data.yaml）。

### 4.2 易被误解或改错的原因

1. **路径假设**：脚本假定 __file__ 在 pyapps/d3-check 根；若从其他目录用 python -m 或软链方式运行，current_dir 可能不是 d3-check 根，cache_dir 会错。
2. **目录结构变更**：若 train 脚本改为 2_models 或 classification 放在别处，validate 的 3_models/classification、3_models/detection 会找不到；data.yaml 固定为 2_datasets/detection/unified_model/data.yaml，若数据集改名或拆分，classes 会错或缺失。
3. **分类 class_id 与训练一致**：代码假定 class_id=1 为 "yes"；若训练时 data 的 names 顺序为 [no, yes] 则 1=yes，若为 [yes, no] 则 0=yes，顺序反了会误判。需与 prepare_detection_training / train 的 data.yaml names 顺序一致。
4. **检测 classes 与 data.yaml**：detection_models 的 classes 来自同一份 data.yaml；若一个 detection 子目录有独立 data.yaml 而当前逻辑只用 unified_model 的 data.yaml，多数据集时类别可能不对。
5. **output_dir 与权限**：输出到用户目录 ~/.core_node/pytools/tmp/validation；若该目录无写权限或磁盘满会失败。

### 4.3 正确做法

- 从 pyapps/d3-check 根目录运行 validate.py，或保证 current_dir 指向 d3-check 根；与 train 脚本的目录命名（3_models、2_datasets、unified_model）及 data.yaml 的 names 顺序保持一致；分类 class_id 与训练 data 的 yes/no 顺序对应。

---

## 五、与道歉文档的关系

若此前因上述任一点（如 i18n_rosbot_panel key 与代码不一致、constants __init__ 未同步子模块、误用 _obsolete_color_print 导致日志不显示、validate 路径或 class_id/data.yaml 与训练不一致）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
