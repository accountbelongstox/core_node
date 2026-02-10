# 技术说明：one_shot_tasks、POST_LOGIN_BATTLENET_CONTROLS、gui_config

**目的**：说明这三处代码/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `timers/one_shot_tasks.py`
- `docs/POST_LOGIN_BATTLENET_CONTROLS.md`
- `config/gui_config.json`

---

## 一、timers/one_shot_tasks.py

### 1.1 职责与约定

- **运行方式**：所有函数通过 `timer_manager.submit_one_shot()` 在**定时器线程**中执行，不新建线程；长时间阻塞会占满该线程。
- **UI 回调**：需更新 UI 时用 `panel.container.after(0, lambda: ...)` 回到主线程；回调前若 panel 已 destroy 或 generation 已过期，会导致回调到无效控件或闪屏。
- **主要入口**：
  - `do_path_scan(panel, include_rosbot)`：路径扫描，结果通过 `panel._apply_scan_results(bn, ros, d3)` 回主线程。
  - `do_login_check(panel, login_check_fn, generation)`：登录检查，结果通过 `panel._on_login_check_done(result, err, generation=gen)` 回主线程；generation 用于忽略过期回调。
  - `do_start_d3()`：调 `ensure_battlenet_started_and_login_check()`，无 UI 回调，内部可能长时间阻塞。
  - `do_ensure_d3_running_from_battlenet_no_rosbot()`：调 `ensure_d3_running_from_battlenet_no_rosbot()`，无 UI 回调。
  - `do_battlenet_only_check(panel)`：调 `ensure_battlenet_only()`，结果通过 `panel._on_battlenet_only_done(r, e)` 回主线程。
  - `do_window_monitor_initial_check()`：调 `run_full_status_refresh()` + `window_monitor.notify_window_callbacks(d3_info)`，带 3 秒 debounce。
  - `do_rosbot_update(panel)`：E 块 E1→E6（kill、sleep、config、start、E5a wait、E6），完成后 `_rosbot_update_done` 刷新状态并 `panel._update_control_button`。
  - `do_rosbot_debug(panel)`、`do_battlenet_ui_analyze(panel)` 等：依赖 `panel.container.after(0, ...)` 与 debounce/busy 模块级变量。
- **Debounce / 并发**：`_last_rosdebug_f7_at`、`_rosdebug_running_busy`、`_WINDOW_MONITOR_INITIAL_LAST_RUN` 为模块级变量；多线程下非原子，若在回调或其它线程中改写可能竞态。

### 1.2 易被误解或改错的原因

1. **在 one_shot 里直接操作 UI**：在定时器线程中除 `panel.container.after(0, ...)` 外不应直接改 Tk 控件；若直接改会导致跨线程访问 Tk，崩溃或未定义行为。
2. **忽略 generation 或 panel 有效性**：`do_login_check` 的 generation 用于防止 stale 回调；若删除或未传入，可能把结果应用到已切换的界面。回调前未检查 `panel.container.winfo_exists()` 或 generation 会闪屏或报错。
3. **长时间 ensure_* 在 one_shot 中执行**：`do_start_d3`、`do_ensure_d3_running_from_battlenet_no_rosbot` 调用的 ensure_* 内含大量 time.sleep 与轮询；在 submit_one_shot 的同一线程执行会阻塞该线程直至完成，其它 one_shot 任务被推迟。若误将 ensure 拆成多段 one_shot 且依赖顺序，容易乱序或重复执行。
4. **修改 E 块顺序或跳过步骤**：`do_rosbot_update` 严格按 E1→E2→E3→E4→E5→E5a→E6；若为“优化”跳过 E2 sleep 或调换 E3/E4，会与 ROSBOT_FLOW_MERMAID E 块不一致或导致启动不稳定。
5. **Debounce / busy 未保护**：若多处同时触发 do_rosbot_debug 或 do_window_monitor_initial_check，模块级 debounce 与 busy 可能被并发写；应用 threading.Lock 或单线程约定，否则易重复发 F7 或重复刷新。
6. **Battle.net UI 导出路径与 docs 文档**：`do_battlenet_ui_analyze` 写 docs 为 `battlenet_ui_elements[_asia|_cn]_N.json`；若 docs 侧文档（如 POST_LOGIN_BATTLENET_CONTROLS.md）引用的 JSON 名或路径与代码不一致，会误导后续实现。

### 1.3 正确做法

- 所有 UI 更新一律通过 `panel.container.after(0, ...)`，且回调内检查 panel 有效性与 generation（若适用）。
- 长时间 ensure 若必须保留在 one_shot 中，需在文档中注明“会阻塞定时器线程”；或考虑单独线程/队列，避免与其它 one_shot 争用。
- E 块顺序与 ROSBOT_FLOW_MERMAID 一致，不擅自跳过或调换。
- 对 debounce、busy 等模块级状态，若存在多线程调用可能，加锁或明确“单线程调用”约定并文档化。

---

## 二、docs/POST_LOGIN_BATTLENET_CONTROLS.md

### 2.1 职责与约定

- **数据来源**：导出自 Battle.net UI Automation，复制到 `docs/登陆后的战网元素.json`（或同目录下 battlenet_ui_elements_*.json）。
- **文档内容**：列出当前使用的控件（automation_id、name/type）、逻辑（如 Playing Now、is_enabled）、以及待实现项（协议勾选、登录按钮、是否在登录页等）。
- **与代码对应**：BattlenetOperation 或战网相关点击/判断逻辑应使用与本文档一致的 automation_id、name 字符串；若 JSON 导出或 UI 版本变化，需同步更新本文档与代码。

### 2.2 易被误解或改错的原因

1. **代码与文档不一致**：若代码中写死 `play-btn-main`、`game-nav-btn-D3CN` 等，而文档或 JSON 已改为其它 id/name，或反之只改了文档未改代码，会导致“文档说 A、代码用 B”，战网操作失败或点错控件。
2. **把“待实现”当已实现**：文档中“To implement”列出的 agreement、login screen、already logged in 等若尚未在代码中实现，不应在逻辑里假设已存在；否则会漏判或误判登录状态。
3. **忽略区域/语言**：POST_LOGIN 文档未区分 asia/cn 时，若代码按 asia 的 automation_id 写死，在 cn 客户端可能对不上；one_shot_tasks 中 `_battlenet_docs_basename_with_region()` 已按 region 区分 JSON 文件名，文档若引用具体 JSON 需与 region 对应。
4. **JSON 路径与文档描述不符**：文档写“复制到 docs/登陆后的战网元素.json”，而 one_shot_tasks 实际写 docs 为 `battlenet_ui_elements_*.json`；若后续实现从“登陆后的战网元素”读配置，需统一路径或说明两者关系。

### 2.3 正确做法

- 修改战网 UI 相关 automation_id、name、逻辑时，同时更新本文档与代码；新增控件或逻辑时在文档中补充并标注是否已实现。
- 从 JSON 读控件列表时，使用与 one_shot_tasks 导出一致的路径/命名（或文档中明确“数据来源”与“代码读取路径”的对应关系）。
- 区域/语言相关差异在文档中注明，代码中按 region 分支时与文档一致。

---

## 三、config/gui_config.json

### 3.1 职责与约定

- **用途**：GUI 与启动方式配置；当前结构包含 `gui`（enabled、type、web_frontend、http_bridge、system_tray）、`legacy_ui`（enabled、type）。
- **读取方**：主程序或启动逻辑通过该文件决定是否启 web 前端、http_bridge、系统托盘、是否启 legacy tkinter UI；键路径如 `gui.enabled`、`gui.web_frontend.port`、`gui.http_bridge.port`、`legacy_ui.enabled` 等。
- **约定**：JSON 键名与层级若被重命名或移动，所有读取该配置的代码必须同步修改，否则启动失败或行为异常。

### 3.2 易被误解或改错的原因

1. **只改 JSON 不改代码**：若将 `gui.web_frontend` 改为 `web_ui` 或把 `port` 提到顶层，而代码仍读 `gui.web_frontend.port`，会读不到或读到错误类型。
2. **只改代码不改 JSON**：若代码改为读 `gui.legacy_ui.enabled` 而 JSON 仍为 `legacy_ui.enabled`，会导致配置不生效或 KeyError。
3. **类型不一致**：JSON 中 `enabled` 为 true/false，若代码用字符串 `"true"` 或 0/1 判断，可能误判；应统一为 bool 或明确转换规则。
4. **新增键未文档化**：若在 JSON 中新增键（如 `gui.web_frontend.host`），未在文档或默认值中说明，其它环境未配该键时可能依赖实现“缺省行为”，容易不一致。

### 3.3 正确做法

- 修改配置键名或层级时，全局搜索读取 gui_config 的代码并一并修改；必要时提供迁移说明或默认值。
- 配置项类型（bool、int、string）与代码使用处一致；新增键在文档或注释中说明用途与默认值。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 one_shot 中直接改 UI、忽略 generation、E 块顺序被改、POST_LOGIN 文档与代码不一致、gui_config 键名与代码不同步）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
