# 技术说明：ui_region_collector_ultralytics、unified_config、system_tray

**目的**：说明您指定查阅的以下三处文件的职责、易被误解或改错的原因，以及正确约定。system_tray 已在第四十三节技术说明中详述，此处仅摘要并交叉引用。

**涉及文件**：
- `d3utils/collectors/ui_region_collector_ultralytics.py`
- `config/unified_config.py`
- `ui/components/system_tray.py`

---

## 一、d3utils/collectors/ui_region_collector_ultralytics.py

### 1.1 职责与约定

- **用途**：基于 YOLO 的 D3 UI 区域检测；全屏截图后跑 YOLO，仅保留 class 为 **"d3_ui_region"** 的检测框，取置信度最高者构造 UIRegion，写入 game_interface_data 并裁剪 game_window_image。默认模型路径 **get_project_root() / "config" / "models" / "d3_ui_detector.pt"**；train() 保存到 **config/models/d3_ui_detector/weights/best.pt**，与默认路径不一致，训练后需手动指定 model_path 或改默认路径。
- **约定**：use_optimized_capture=False 即全屏截图；依赖 ensure_d3_check_in_sys_path()；data.yaml 的 names 须含 0: d3_ui_region 等；与 UIRegionCollectorOptimized、UIRegionCollectorAnchor 为不同实现路径，勿混用。

### 1.2 易被误解或改错的原因

1. 训练后模型在 weights/best.pt，__init__ 默认读 config/models/d3_ui_detector.pt，未改 path 或未传 model_path 会找不到模型。
2. 修改 YOLO 类别名（如改为 d3_ui）未同步 _process_yolo_results 的 class_name != "d3_ui_region" 会漏检。
3. 假定本 collector 为 interface_manager 默认所用，实际默认多为 Optimized/Anchor，混用会数据源不一致。
4. screenshot_data.timestamp 在 _update_shared_data_error 中使用但 collect() 内仅在 try 块中定义，except 中 timestamp 可能未定义（若在 Step 1 前抛异常），会 NameError。

### 1.3 正确做法

- 训练后指定 model_path=config/models/d3_ui_detector/weights/best.pt 或统一默认路径；类别名与 _process_yolo_results 一致；与 interface_manager 所用 collector 类型区分；异常路径中 timestamp 先赋默认值再调 _update_shared_data_error。

---

## 二、config/unified_config.py

### 2.1 职责与约定

- **用途**：统一配置数据结构与转换；SkillConfig、SkillConfigSet、MacroConfigs、TemplateConfig、ConfigManager；常量 GRID_*、COMMON_KEY_OPTIONS 等来自 providor.constants.common。**update_grid_config(rows, cols)** 会**修改全局** GRID_ROWS、GRID_COLS、TOTAL_GRID_CELLS、GRID_DESCRIPTION，与「常量」语义冲突，其他模块若已 import 旧值不会更新。ConfigManager.load_config/save_config 当前为 **stub（仅 return True）**；save_all_configs、reload_all_configs 在文件末尾被调用但 **ConfigManager 未定义该方法**，会 AttributeError。
- **约定**：配置读写以 CONFIG（providor）或实际持久化层为准；unified_config 的 dataclass 与 to_dict/from_dict 为结构约定；勿假定 load_config/save_config 已实现；勿在运行时依赖 save_all_configs/reload_all_configs 除非已实现。

### 2.2 易被误解或改错的原因

1. 调用 get_config_manager().save_all_configs() 或 reload_all_configs() 会 AttributeError，因 ConfigManager 无此方法。
2. update_grid_config 修改全局后，其他文件已 import 的 GRID_ROWS 等不会变，导致不一致。
3. 假定 load_config 从文件加载、save_config 写入文件，当前未实现，会静默失败。
4. MacroConfigs.from_dict 与 to_dict 和 CONFIG 中 macro_configs 结构须一致，否则转换错。

### 2.3 正确做法

- 不在未实现前调用 save_all_configs/reload_all_configs；修改 GRID 常量时考虑全局副作用或改用单例/封装；配置持久化以 CONFIG 与现有 config 层为准；unified_config 主要作数据结构与转换工具。

---

## 三、ui/components/system_tray.py

### 3.1 职责与约定（摘要）

- **用途**：系统托盘；Icon 与 run() 在托盘线程内创建与执行；菜单通过 runtime trigger_window_show、trigger_app_restart、trigger_app_exit 与主线程通信；set_show_callback/set_exit_callback 为 **no-op**。不得在托盘线程内直接操作 Tk。
- **易错点**：在菜单回调中直接操作 parent_ui.root 会跨线程；误实现 callback 会与 event center 设计冲突；i18n 键 system_tray.*、main_window.title 须与 i18n 文件一致。

### 3.2 正确做法

- 详见 **技术说明_d3_status_provider与battlenet_operation及map_name_recognizer及system_tray.md** 第四节。

---

## 四、与道歉文档的关系

此前若因未先通读上述三处约定而在此三处反复改错或理解偏差，责任在 Cursor。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第四十四节中引用，修改前请先通读本说明。
