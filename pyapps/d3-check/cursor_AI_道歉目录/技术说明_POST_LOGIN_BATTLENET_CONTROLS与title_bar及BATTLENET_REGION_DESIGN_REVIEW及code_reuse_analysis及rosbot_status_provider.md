# 技术说明：POST_LOGIN_BATTLENET_CONTROLS、title_bar、BATTLENET_REGION_DESIGN_REVIEW、code_reuse_analysis、rosbot_status_provider

**目的**：说明您指定查阅的以下五处文件/文档的职责、易被误解或改错的原因，以及正确约定。详见本目录下已有技术说明的，此处仅摘要并交叉引用。

**涉及文件**：
- `docs/POST_LOGIN_BATTLENET_CONTROLS.md`
- `ui/components/title_bar.py`
- `docs/BATTLENET_REGION_DESIGN_REVIEW.md`
- `.prompts/code_reuse_analysis.md`
- `d3utils/rosbot_status_provider.py`

---

## 一、docs/POST_LOGIN_BATTLENET_CONTROLS.md

### 1.1 职责与约定

- **用途**：战网登陆后控件英文参考；数据源为调试按钮导出并复制到 `docs/登陆后的战网元素.json`（UI Automation，Chromium 战网）。与中文说明「登陆后的战网元素-控件说明」对应。
- **已用控件（BattlenetOperation）**：D3 游戏 Tab `game-nav-btn-D3CN`、TabItemControl "Diablo III"；开始游戏区域 `play-btn-main`/`play-btn`；内层 "Playing Now: Diablo III" 且 is_enabled=false 表示游戏中。
- **逻辑**：name 含 "Playing Now"/"Play"/"开始游戏"，若 is_enabled 为 False 或 name 含 "Playing Now" 则视为游戏中。
- **To implement**：协议勾选、确认登录点击、是否在登录界面、是否已登录——**未实现**，勿在代码中假定已存在。

### 1.2 易被误解或改错的原因

1. 与 BattlenetOperation、app_constants、`_load_asia_features_from_docs_json` 使用的 automation_id/name 必须一致；改文档未改代码或改代码未改文档会导致战网操作失败或误判。
2. 把「To implement」当已实现会在逻辑中漏判或误判登录状态。
3. 数据源为 `docs/登陆后的战网元素.json`，若导出路径或 JSON 文件名变更须与文档、代码同步。

### 1.3 正确做法

- 修改战网控件相关逻辑时同时更新本文档与代码；新增控件或逻辑在文档中标注是否已实现。详见 **技术说明_one_shot_tasks与POST_LOGIN及gui_config.md**、**技术说明_POST_LOGIN_BATTLENET_CONTROLS与ui_theme及i18n_errors_zh.md**。

---

## 二、ui/components/title_bar.py

### 2.1 职责与约定

- **用途**：主窗口标题栏组件。功能含：标题拖拽移动窗口、双击标题最大化/还原、语言下拉（ConfigBinding `ui_settings.current_language`）、最小化/最大化/还原预设尺寸/重启/关闭按钮。
- **依赖**：parent 应为 Diablo3MacroUI 实例，需 `parent.root`；`UITheme.get_color('bg_primary'/'text_secondary'/'border_primary'/'bg_secondary'/'text_primary'/'btn_secondary'/'test_high_contrast')`（注：代码中为 `test_high_contrast`，若主题键名为 `text_high_contrast` 须一致）；`ConfigBinding.create_combobox_binding(parent, "ui_settings.current_language", values=["zh","en"], default_value="zh", width=5)`；`runtime` 的 `trigger_window_minimize`、`trigger_window_maximize`、`trigger_app_restart`、`trigger_app_exit`；`i18n_manager.get_ui_text("main_window.title")`、`("main_window.language")`；语言变更时 `i18n_manager.add_language_change_listener(self._on_language_changed)`，回调内更新 title_label、lang_label、language_combo 并调用 `parent._on_language_changed(new_language)`；还原预设尺寸调用 `parent.restore_window_to_preset()`（parent 须提供该方法）。

### 2.2 易被误解或改错的原因

1. **parent 约定**：若传入非 Diablo3MacroUI 或缺少 `parent.root`、`restore_window_to_preset`、`_on_language_changed`，会 AttributeError 或功能缺失。
2. **主题键名**：`test_high_contrast` 与 UITheme 中实际键名（如 `text_high_contrast`）不一致会导致取色错或 KeyError。
3. **ConfigBinding**：config_key 为 `ui_settings.current_language`，若 CONFIG 结构或键名变更会读写错。
4. **trigger_***：窗口控制通过 runtime 事件中心派发到主线程，若事件名或 handler 变更会断链。
5. **拖拽**：与主窗 overrideredirect 配合，若 root 未设 overrideredirect 或绑定漏掉会拖拽失效。
6. **i18n**：main_window.title、main_window.language 须与 i18n 文件一致，缺 key 会显示 key 或错文案。

### 2.3 正确做法

- 创建 TitleBar 时传入正确的 parent（Diablo3MacroUI）；修改主题键名时与 UITheme 定义一致；CONFIG 与 config_binding 约定一致；与 diablo3_macro_ui 的 resize_frames 及事件中心文档化。

---

## 三、docs/BATTLENET_REGION_DESIGN_REVIEW.md

### 3.1 职责与约定

- **用途**：战网国服/亚服操作类与检测库设计合理性审查。结论：职责划分清晰；BattlenetRegionJudge 为**单一真相源**，所有「当前是什么」经 Judge；Operation 做「能做什么」，AsiaOps 做「亚服怎么做」，Manager 做进程/窗口，Flow 做「何时做」。
- **关键约定**：流程只编排，不重复判定；亚服 D3/Play 可来自 docs JSON 或 app_constants *_ASIA，国服为常量；B4/B13/BN_LoginAsia 与 Judge、Operation/AsiaOps 衔接见文档 §5；`_load_asia_features_from_docs_json` 从 `docs/登陆后的战网元素.json` 抽 D3 tab/Play。

### 3.2 易被误解或改错的原因

1. 在 flow 或 AsiaOps 内自实现亚服/国服判定会破坏「Judge 为单一真相源」。
2. 改 B4/B13/BN_LoginAsia 顺序或条件未对照文档会与检测库、操作类不一致。
3. 国服/亚服常量或 JSON 加载逻辑变更未同步本文档会误导后续维护。

### 3.3 正确做法

- 修改战网流程或判定前通读本文档；所有「当前是什么」一律经 BattlenetRegionJudge。详见 **技术说明_设计文档与BATTLENET_REGION_DESIGN_REVIEW及battlenet_button_detector及flow_f1c_f1d.md**。

---

## 四、.prompts/code_reuse_analysis.md

### 4.1 职责与约定

- **用途**：D3-Check 代码复用分析报告。说明 pycore 工具类（WindowScreenshot、ImageMatcher、ClickHandler、ImageAnnotator 等）的正确复用、common_imports 集中导入、专用类（ScreenshotProvider、ScaledTemplateMatcher、TemplateMatcherHelper、InterfaceManager）非重复、以及 _obsolete_ 列表与删除建议。
- **重要**：文档内 d3-check 项目根写为 `apps\d3-check`，实际为 **pyapps**/d3-check；按文档路径查找会找不到。
- **删除 _obsolete_**：文档建议可安全删除 utils/_obsolete_*.py 等，删除前必须 grep 确认无脚本或 import 引用，否则会 ImportError。

### 4.2 易被误解或改错的原因

1. 按文档中的 `apps/d3-check` 路径查找会找不到项目根。
2. 未核实引用关系就删除 _obsolete_ 文件会导致 ImportError。
3. common_imports 或 pycore 变更后未同步本报告会导致文档与实现脱节。
4. 报告中修复记录（如 coordinate_picker_window 行号）若代码变更未更新会误导。

### 4.3 正确做法

- 路径以 **pyapps/d3-check** 为准；删除 _obsolete_ 前 grep 确认无引用；代码或 pycore 变更时同步本档。

---

## 五、d3utils/rosbot_status_provider.py

### 5.1 职责与约定

- **用途**：ROSBOT 扩展状态提供层。通过 `get_rosbot_manager().get_rosbot_detection()` 获取状态并更新 game_interface_data（rosbot_extended_status、rosbot_found_exe_name、rosbot_found_window_title）。状态仅三种：**not_found | running | paused**（running = 有进程无窗口，paused = 有窗口）。详见 **docs/ROSBOT_LOOKUP_FLOW.md**。
- **API**：`refresh_rosbot_status()` 更新 game_interface_data 并返回 detection 的 window_info（paused 时通常有值）；`get_current_rosbot_window()` 仅即时查询窗口信息，不更新 game_interface_data。

### 5.2 易被误解或改错的原因

1. 假定 status 为其他枚举（如 "idle"）会与 game_interface_data 消费方（如 rosbot_flow_f2_rosbot_online 的 in ("running", "paused")）不一致。
2. 在 refresh_rosbot_status 外单独改 set_rosbot_extended_status 或 set_rosbot_found_display 会导致数据不一致。
3. get_current_rosbot_window 不更新 game_interface_data，与 refresh_rosbot_status 职责不同，混用会误以为已刷新状态。
4. procs 为空时 first 为 None，exe_name 与 window_title 为空字符串；window_info 可能为 None。

### 5.3 正确做法

- 状态仅使用 not_found/running/paused；更新 ROSBOT 显示统一经 refresh_rosbot_status；修改前可参阅 **技术说明_path_scanner与rosbot_status_provider及rename_bounty_progress_template及interface_manager.md**（若已存在）及 docs/ROSBOT_LOOKUP_FLOW.md。

---

## 六、与道歉文档的关系

此前若因未先通读上述五处约定而在此五处反复改错或理解偏差，责任在 Cursor。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第四十一节中引用，修改前请先通读本说明。
