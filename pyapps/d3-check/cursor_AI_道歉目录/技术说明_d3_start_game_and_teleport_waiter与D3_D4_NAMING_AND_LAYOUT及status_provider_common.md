# 技术说明：d3_start_game_and_teleport_waiter.py、D3_D4_NAMING_AND_LAYOUT.md、status_provider_common.py

**目的**：说明您指定查阅的以下三处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `d3utils/d3_start_game_and_teleport_waiter.py`
- `docs/D3_D4_NAMING_AND_LAYOUT.md`
- `d3utils/status_provider_common.py`

---

## 一、d3utils/d3_start_game_and_teleport_waiter.py

### 1.1 职责与约定

- **用途**：D3 启动与传送流程，对应 ROSBOT_FLOW_MERMAID.md C 分支。C5/C5w（Start Game 点击与等待 game_tool）、C6（game_tool 路径）、C7a/C7w/C7b（按 M 打开地图、2s 等待、缩小+传送三击）、C8；C10 仅用于**掉线检测**（截图(前)→发 M→截图(后)→相似度对比，与 C7 打开地图传送为**两套逻辑**）。capture_and_detect_all_d3_states 一次截图匹配 disconnected/start_game_button/game_tool/connecting；detect_d3_already_running_state 返回 "disconnect"|"start"|"game_tool"|"wait"|None。step_c7b_minimize_only / step_c7b_teleport_only 分拍执行；_do_c7b_teleport 为一次执行缩小+传送（legacy）。依赖 D3 常量（D3_MAP_MINIMIZE_CLICK、D3_TELEPORT_CLICK、D3_TELEPORT_CLICK_2、C7B_*、D3_START_GAME_* 等）、get_d3_scaled_template_matcher、get_screenshot_provider、calculate_unified_scaled_coordinate、get_game_interface_data().is_windowed_mode()、WindowFinder、ClickHandler、window_send_key(VK_M)。
- **约定**：改 C 块逻辑须对照 ROSBOT_FLOW_MERMAID 与 ROSBOT_FLOW_C_BLOCK 文档，保持节点与代码 1:1；C10 与 C7 不可混淆（C10 判掉线、C7 传送前开地图）；state_dict 的 key（disconnected、start_game_button、game_tool、connecting）与 d3_status_provider._detect_d3_dynamic、match_all_d3_states 一致。详见本目录 **技术说明_INITIAL_STATE_DETECTION与d4_modules_README及_obsolete_play_button_clicker及ROSBOT_FLOW_C_BLOCK及bn_flow_B9.md** 等。

### 1.2 易被误解或改错的原因

1. **C10 与 C7 混淆**：C10 为 M 前后截图相似度判掉线；C7 为按 M 开地图、悬赏进度检测、C7b 缩小+传送。若在 C7 中复用 C10 的 step_c10_* 或反之，语义错。
2. **step 与 blocking 混用**：tick 流用 step_c7a_send_m、step_c7b_minimize_only、下一拍 step_c7b_teleport_only；blocking 用 _run_c7a_c7w_c7b、send_m_then_teleport_three_clicks、wait_for_game_tool_then_send_m_and_click。若在 tick 中调 blocking 会卡住主循环。
3. **state_dict 与 detect_d3_already_running_state 返回值**：state_dict 来自 matcher.match_all_d3_states；返回值 "disconnect"/"start"/"game_tool"/"wait"/None 与流程分支对应，若改 key 或返回值未同步 flow 或 d3_status_provider 会错。
4. **常量与坐标**：D3_MAP_MINIMIZE_CLICK、D3_TELEPORT_CLICK、D3_TELEPORT_CLICK_2 等来自 providor.constants.d3；calculate_unified_scaled_coordinate 需 game_window_size、standard_resolution、is_windowed；若常量改名或坐标系变更未同步会点错。
5. **_c10_img_a 全局**：step_c10_send_m 存图、step_c10_compare 读图，同流程同线程；若多线程或跨流程复用会串图。

### 1.3 正确做法

- 修改前通读 ROSBOT_FLOW_MERMAID C 分支与本文档头部注释；区分 C10（掉线）与 C7（传送）；区分 step_*（单拍）与 blocking 函数；改 state_dict key 或 detect_d3_already_running_state 返回值须同步 flow 与 d3_status_provider；常量与坐标以 providor.constants.d3 与 get_game_interface_data 为准。

---

## 二、docs/D3_D4_NAMING_AND_LAYOUT.md

### 2.1 职责与约定

- **用途**：**重定向说明**，声明 D3/D4/共用区设计命名规范已整合至 `docs/PROJECT_STANDARDS.md` §三。本文件仅两行，不包含具体规范内容，权威内容在 PROJECT_STANDARDS.md。
- **约定**：涉及 D3/D4 命名、目录归属、常量与模块命名、导入规则时以 PROJECT_STANDARDS.md §三为准；若 PROJECT_STANDARDS 重组章节，本文件引用的「§三」可能失效，须同步更新本文件或 PROJECT_STANDARDS 的目录/锚点。

### 2.2 易被误解或改错的原因

1. **§三 与 PROJECT_STANDARDS 实际结构脱节**：若 PROJECT_STANDARDS 中 D3/D4 命名与布局已移至其它章节或拆成多节，本文件仍写「§三」会导致指向错误。
2. **在本文件内写具体规范**：本文件应为重定向，若在此写命名细则会与 PROJECT_STANDARDS 重复或冲突，造成「以哪份为准」困惑。
3. **删除本文件**：保留本文件名便于搜索「D3 D4 naming layout」；若删除则需在其它文档或 README 中注明规范见 PROJECT_STANDARDS。

### 2.3 正确做法

- 修改 D3/D4 命名或目录规范时先改 PROJECT_STANDARDS.md，再核对本文件「§三」是否仍正确；不在本文件内写具体规范；若 PROJECT_STANDARDS 章节编号变更须同步本文件引用。

---

## 三、d3utils/status_provider_common.py

### 3.1 职责与约定

- **用途**：**状态提供方共用刷新流程**。refresh_window_state(game_data, window_info_or_none, *, set_running_fn, set_dynamic_fn, detect_dynamic_fn, apply_geometry_fn=None, log_prefix="")：先 set_running_fn(game_data, found)，再可选 apply_geometry_fn(game_data, window_info_or_none)，再 detect_dynamic_fn(found, window_info_or_none) 得 (on_login, disconnected, third)，再 set_dynamic_fn(game_data, on_login, disconnected, third)。被 **battlenet_status_provider** 与 **d3_status_provider** 使用，二者注入各自的 set_running_fn、set_dynamic_fn、detect_dynamic_fn、apply_geometry_fn。
- **约定**：四个回调的签名不可改：set_running_fn(Any, bool)、set_dynamic_fn(Any, bool, bool, bool)、detect_dynamic_fn(bool, Optional[Dict]) -> Tuple[bool, bool, bool]、apply_geometry_fn(Any, Optional[Dict])；若改 refresh_window_state 参数顺序或回调签名未同步两处 provider 会报错或行为错。异常时 set_dynamic_fn(..., False, False, False)。

### 3.2 易被误解或改错的原因

1. **改 refresh_window_state 签名**：若增删参数或改回调顺序，battlenet_status_provider 与 d3_status_provider 的调用处须同步，否则 TypeError 或传错参数。
2. **detect_dynamic_fn 返回三元组含义**：(on_login, disconnected, third) 由各 provider 自行定义；d3_status_provider 当前为 (False, disconnected, False)。若假定 on_login 或 third 在此为 True 或改返回长度未同步 set_dynamic_fn 的接收会错。
3. **apply_geometry_fn 可选**：若某 provider 不传 apply_geometry_fn，则只做 set_running、detect_dynamic、set_dynamic；若在 common 内假定 apply_geometry_fn 必存在会 AttributeError。
4. **异常处理**：detect_dynamic 异常时已 set_dynamic_fn(game_data, False, False, False)；若在 common 内增加其它 fallback 未与两 provider 约定会状态不一致。

### 3.3 正确做法

- 修改 refresh_window_state 或任一回调签名前必须同步 battlenet_status_provider 与 d3_status_provider；各 provider 的 detect_dynamic_fn 返回 (on_login, disconnected, third) 含义以各 provider 文档为准；勿在 common 内假定 apply_geometry_fn 必存在。详见本目录 **技术说明_d3_status_provider与battlenet_operation及map_name_recognizer及system_tray.md**、**技术说明_template_match_debug与rosbot_flow_f4及d3_status_provider.md**。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（d3_start_game_and_teleport_waiter 的 C10/C7 分离、step 与 blocking 区分、state_dict 与常量；D3_D4_NAMING_AND_LAYOUT 为重定向且 §三 须与 PROJECT_STANDARDS 一致；status_provider_common 的回调签名与两 provider 的注入）而在此三处反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第六十四节中引用。
