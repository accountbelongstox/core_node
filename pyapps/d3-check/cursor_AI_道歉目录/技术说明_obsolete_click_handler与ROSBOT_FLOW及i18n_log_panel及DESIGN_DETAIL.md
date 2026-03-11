# 技术说明：_obsolete_click_handler、ROSBOT_FLOW、i18n_main_window_en、log_panel、DESIGN_DETAIL

**目的**：说明这五处代码/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `utils/_obsolete_click_handler.py`
- `docs/ROSBOT_FLOW.md`
- `providor/i18n/i18n_main_window_en.json`
- `ui/panels/log_panel.py`
- `docs/DESIGN_DETAIL.md`

---

## 一、utils/_obsolete_click_handler.py

### 1.1 职责与约定

- **用途**：文件名带 `_obsolete_`，表示**已废弃**。提供战网相关点击能力：托盘图标查找与点击、通过窗口消息/PostMessage/PyAutoGUI/置顶+PyAutoGUI/UI Automation 点击元素、查找并点击 D3 按钮与 Play 按钮、枚举 UI Automation 控件。依赖 `providor.providor_second` 的 CONFIG、DEBUG_DIR、PLAY_BUTTON_AUTO_ID、PLAY_BUTTON_MAIN_AUTO_ID、PLAY_BUTTON_AUTOMATION_IDS。
- **与主流程关系**：当前战网「枚举控件、点击 D3 tab/Play、国服/亚服登录」由 `d3utils.battlenet_operation` 与 `d3utils.battlenet_asia_ops` 负责，通过 BattlenetRegionJudge 做状态判断。本文件**未接入主流程**，仅作遗留参考。

### 1.2 易被误解或改错的原因

1. **当现行模块用**：若在此文件内新增或修改「战网点击/登录」逻辑并期望主流程生效，会无效——主流程不调用此处。
2. **与 battlenet_operation 重复**：若在 obsolete 里改 automation_id、Play 按钮列表等，与 app_constants 及 BattlenetOperation 不一致，会导致文档与实现两套逻辑。
3. **CONFIG 与 providor_second**：此处读 CONFIG 与 providor_index 的 config worker 若并存，需避免双写；且主流程已统一用 battlenet_manager + battlenet_operation，此处 CONFIG 用途为历史。
4. **坐标与 rect**：click_element_by_window_message / by_post_message 使用「相对窗口的 client 坐标」；MAKELONG(x,y) 为 lparam，若传入屏幕坐标会点错。element_info.rect 来自 UI Automation 的 BoundingRectangle，需确认是客户区还是屏幕坐标再换算。

### 1.3 正确做法

- 战网相关点击与登录逻辑只改 `battlenet_operation.py`、`battlenet_asia_ops.py` 及 app_constants；不在此 obsolete 文件上做功能增强。
- 若仅参考本文件实现（如 PostMessage 点击），抄逻辑到新模块并接入主流程，而非直接复用本文件入口。

---

## 二、docs/ROSBOT_FLOW.md

### 2.1 职责与约定

- **用途**：ROSBOT 启动流程的**设计文档**，只描述「做什么、在什么条件下走哪条分支」，**不指定**具体代码、模块名、类库。实现由仓库内既有模块与规范自行对接。
- **关键约定**：  
  - 全局定时器 **1 秒**一跳；本流程通过 **% 方式** 实现 **2 秒** 一个 tick（每 2 个 1 秒 tick 才驱动一次）。  
  - 总状态关闭 → 跳过所有分支；总状态开启 → 按当前分支驱动；节点分为 **wait**（本 tick 跳过）与 **有导向**（执行并切换）。  
  - **D3 开始界面**：对 D3 窗口截图，用 **scale match** 匹配 **d3_start_game_button.png**，匹配到即视为「开始游戏」界面。  
  - **按 M 键前提**：**仅当已出现 d3_game_tool 时才按 M 键**；未出现则标记 wait，本 tick 跳过。  
  - **D3 是否在线**：仅当已出现 d3_game_tool 时执行五步：先截图（图 A）→ 按 M → 再截图（图 B）→ 对比相似度（高度相似⇒掉线）→ 再按 M 恢复。  
  - 掉线相关模板命名：**d3_disconnected.png**。  
  - 战网界面识别：**不对战网做 OCR 截图**，使用 **Windows Analyzer / UI 自动化** 识别战网窗口与控件。  
  - 启动顺序：战网启动并登录 → 暗黑 3 启动 → ROSBOT 启动，顺序不可乱。

### 2.2 易被误解或改错的原因

1. **定时器与 tick**：若实现成 1 秒一个流程 tick 或不用 % 实现 2 秒，与文档「2 秒一个 tick」不符，会导致节奏错。  
2. **未出现 d3_game_tool 就按 M**：若在未出现 d3_game_tool 时发 M 键，文档明确禁止，会导致误判或 UI 错乱。  
3. **D3 在线检测顺序**：若调换或省略「截图→M→截图→相似度→再按 M」任一步，与文档约定不符。  
4. **战网用 OCR**：若对战网窗口做截图 OCR 判定登录/主界面，与文档「使用 UI 自动化、不 OCR」矛盾。  
5. **节点 wait vs 有导向**：若把应为 wait 的节点做成有导向或反过来，流程会多走/少走或卡死。  
6. **d3_disconnected 命名**：若使用其他文件名或常量名，与文档约定不一致，不利于维护。

### 2.3 正确做法

- 实现时严格按「状态管理与全局定时器」「D3 界面判定与在线检测」两节的约定；tick 用 % 实现 2 秒；M 键与在线检测仅在有 d3_game_tool 时执行；战网用 UI 自动化；流程节点区分为 wait/有导向并在代码中体现。
- 修改流程逻辑时先对一下 ROSBOT_FLOW.md，避免与文档冲突。

---

## 三、providor/i18n/i18n_main_window_en.json

### 3.1 职责与约定

- **用途**：主窗口英文界面文案，供 i18n_manager 按 key 取文本。结构为嵌套 JSON：`ui.main_window.*`、`button_area.*`、`tabs.*`、`macro_controls.*`、`bottom_bar.*`、`status_bar.*`、`main_functions_panel.*`、`system_tray.*` 等。
- **使用方式**：代码侧通过 `i18n_manager.get_ui_text("xxx.yyy.zzz")` 等与 JSON 内路径一致的 key 获取文案；key 与 JSON 层级、命名必须一致。

### 3.2 易被误解或改错的原因

1. **改 key 未同步**：在 JSON 中改名或移动节点后，未在代码中把 get_ui_text 的 key 一起改，会导致取不到或取错。  
2. **新增 key 未加文案**：新增功能时只在代码里 get_ui_text("new_key")，未在 JSON 中补 new_key，会显示 key 或空。  
3. **多语言不一致**：若存在 i18n_main_window_zh.json 等，只改英文未改中文，或结构不一致，会导致某语言缺 key。  
4. **路径写错**：如把 tabs.main_functions 写成 main_functions_panel.xxx 或 tabs.main，与 JSON 结构不符。

### 3.3 正确做法

- 增删改文案时，JSON 与所有调用 get_ui_text 的代码一起改；保持各语言 JSON 结构一致；key 与文档或注释中的「文案 key 表」一致。

---

## 四、ui/panels/log_panel.py

### 4.1 职责与约定

- **用途**：主日志面板（TABLE4），提供日志展示、清空、保存、过滤（级别、是否显示 DEBUG）、自动滚动、右键复制等。通过 **ColorPrint.register_callback(self.add_log_message)** 接收日志；**add_log_message 在调用方线程执行**，仅做入队与 **container.after(0, _append)**，真实追加与过滤在主线程的 _append 内执行。
- **关键约定**：  
  - **不可在 add_log_message 内读 CONFIG**：add_log_message 由 ColorPrint 回调，可能在**任意线程**（包括 config worker）调用。若在此处调用 ConfigBinding.get_config_value，而 config worker 正在写配置并等待 CONFIG_QUEUE，会**死锁**。过滤（show_debug_logs、log_level）必须在 **主线程** 的 _should_display_message 里读配置。  
  - ColorPrint 回调参数：实际传入为 (message, color_type, log_level)，log_panel 将第二个参数当 level、第三个当 color 用；color_type 为 red/green/yellow/blue/gray/cyan/white，log_level 为 DEBUG/INFO/WARNING/ERROR/SUCCESS。  
  - 展示前用 _strip_ui_log_prefix 去掉 [ROSBOT]、[ROSBOT~*s]、[LogAnalyzer] 前缀。  
  - log_settings：show_debug_logs、auto_scroll、log_level 存于 ConfigBinding，与 control panel 的 checkbox/combobox 绑定。

### 4.2 易被误解或改错的原因

1. **在 add_log_message 里读配置**：在回调里调用 get_config_value("log_settings.show_debug_logs") 等，若调用来自 config worker，易死锁。  
2. **修改回调签名**：ColorPrint 固定传 (message, color_type, log_level)，若 log_panel 假设参数顺序或含义不同，会错用 level/color。  
3. **过滤逻辑位置**：若在 after(0) 之外根据配置过滤并决定是否 append，仍可能在非主线程读配置，存在竞态或死锁。  
4. **i18n key**：按钮、标签使用 log_panel.xxx（如 log_panel.clear_logs、log_panel.show_debug_logs），若 JSON 中无对应 key 或 key 改名未同步，会显示 key 或错文案。

### 4.3 正确做法

- 所有「是否显示」「按级别过滤」的配置读取放在 _should_display_message（主线程）内；add_log_message 只组 log_entry 并 after(0, _append)。  
- 保持 ColorPrint 回调 (message, color_type, log_level) 与 log_panel 解析方式一致；新增 log 相关配置时用 log_settings.* 并仅在主线程读。

---

## 五、docs/DESIGN_DETAIL.md

### 5.1 职责与约定

- **用途**：与 DESIGN.md 配套的**详细设计**，侧重 **Login Try** 与 **Battle.net 断线检测与重启**。描述触发条件、流程步骤、涉及模块与常量。
- **关键约定**：  
  - 触发：日志中出现配置的 trigger（默认 `config.constants.LOGIN_TRY_TRIGGER_DEFAULT`，如 "Login try"）。  
  - 流程：读配置（战网路径）→ 截战网窗口（screenshot_provider，BATTLE_NET_WINDOW_TITLES）→ OCR 检测断线（CnOCREngine，BATTLE_NET_DISCONNECT_KEYWORDS）→ 若断线则 taskkill Battle.net → 等待约 2 秒 → explorer 启动 Battle.net。  
  - 截图目录与前缀：LOGIN_TRY_SCREENSHOT_DIR、LOGIN_TRY_SCREENSHOT_PREFIX。  
  - 模块：log_monitor 轮询日志、log_analyzer 解析行并调用 LoginTryScreenshotController.handle_login_try()。

### 5.2 易被误解或改错的原因

1. **触发字符串不一致**：若代码里用不同常量或配置 key，与文档 log_detection.login_try、LOGIN_TRY_TRIGGER_DEFAULT 不一致，会触发不到或误触发。  
2. **流程顺序或缺失**：若先启动再 kill、或未等待、或用错 exe/cwd，与文档「kill → 等 2 秒 → explorer 启动」不符。  
3. **OCR 与关键词**：若断线关键词或 OCR 引擎与文档不一致，会误判/漏判。  
4. **窗口标题与截图**：若 BATTLE_NET_WINDOW_TITLES 与文档或多语言不一致，截不到正确窗口。

### 5.3 正确做法

- 实现 Login Try 与战网重启时以 DESIGN_DETAIL.md 为准；改触发、流程、常量时同步更新文档；保持 log_analyzer、LoginTryScreenshotController、constants、screenshot_provider 与文档描述一致。

---

## 六、与道歉文档的关系

若此前因上述任一点（如误用 _obsolete_click_handler、违反 ROSBOT_FLOW 的 tick/M 键/战网 UI 方式、i18n key 不同步、log_panel 在回调中读配置导致死锁、DESIGN_DETAIL 与实现不一致）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
