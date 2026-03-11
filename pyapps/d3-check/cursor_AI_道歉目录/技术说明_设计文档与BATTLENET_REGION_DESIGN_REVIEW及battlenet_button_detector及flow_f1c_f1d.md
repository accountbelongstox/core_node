# 技术说明：设计文档、BATTLENET_REGION_DESIGN_REVIEW、battlenet_button_detector、flow_f1c_f1d

**目的**：说明此四处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/设计文档.md`
- `docs/BATTLENET_REGION_DESIGN_REVIEW.md`
- `d3utils/battlenet_button_detector.py`
- `d3utils/rosbot_flow/flow_f1c_f1d.py`

---

## 一、docs/设计文档.md

### 1.1 职责与约定

- **用途**：D3-Check 设计文档详细版，与 DESIGN.md 合并使用；本文档侧重 **Login Try 与 Battle.net 掉线重启** 的完整设计。流程：日志出现触发串（log_detection.login_try，默认 "Login try"）→ log_analyzer 调 LoginTryScreenshotController.handle_login_try() → 读配置 battlenet_path → 截 Battle.net 窗口（screenshot_provider.gen、BATTLE_NET_WINDOW_TITLES）→ OCR（CnOCREngine、BATTLE_NET_DISCONNECT_KEYWORDS）→ 若掉线则 taskkill Battle.net.exe + 等待约 2 秒 + explorer 启动。**无 Python 线程**；未配置或未截到窗口时退化为全屏截图。
- **约定**：常量在 config.constants（LOGIN_TRY_*、BATTLE_NET_DISCONNECT_KEYWORDS、BATTLE_NET_EXE_NAME）；CONFIG["battlenet"]["battlenet_path"]、providor_index.BATTLE_NET_WINDOW_TITLES；日志路径由 get_dynamic_paths()、paths.rosbot_logs_relative/logs_file_relative。与 DESIGN.md 为总览与索引、本文档为详细设计，修改 Login Try 或掉线重启逻辑须与本文档一致。

### 1.2 易被误解或改错的原因

1. **在 handle_login_try 内使用 Python 线程做 taskkill 或启动**：文档明确「无 Python 线程」、仅 subprocess.run taskkill 与 explorer；若改用 threading 或 asyncio 会违反设计。
2. **改 BATTLE_NET_DISCONNECT_KEYWORDS 或 LOGIN_TRY_TRIGGER_DEFAULT 未同步 config.constants 与文档**：文档列出常量定义位置，若只改一处会不一致。
3. **OCR 掉线判断逻辑与文档不符**：文档为「识别文本包含任一 BATTLE_NET_DISCONNECT_KEYWORDS 即掉线」；若改为全部匹配或增加其他条件会与 2.2 不符。
4. **Battle.net 路径或窗口标题来源错**：battlenet_path 来自 CONFIG["battlenet"]["battlenet_path"]；窗口标题来自 providor_index.BATTLE_NET_WINDOW_TITLES；若从别处读会路径或截窗错。

### 1.3 正确做法

- 修改 Login Try 或掉线重启前先读本文档 §2–§4；保持无 Python 线程、taskkill + explorer；常量与 config.constants 及文档一致；与 DESIGN.md 合并理解。

---

## 二、docs/BATTLENET_REGION_DESIGN_REVIEW.md

### 2.1 职责与约定

- **用途**：**战网国服/亚服操作类与检测库设计合理性审查**。BattlenetOperation（统一入口）、BattlenetAsiaOps（亚服邮箱/密码步）、BattlenetRegionJudge（**单一真相源**：亚服/国服/登录/主界面/掉线/连接中/detected_region）、BattleNetManager（进程与窗口）、rosbot_flow_battlenet（流程编排）。Judge 的控件列表由 Operation._enumerate_controls() 实时枚举；preferred_region 来自 ros_settings.battlenet_region_cache；亚服/国服判定依 LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 与 MARKERS（含 ntes 为国服）、步骤 is_asia_email_step/is_asia_password_step。B4/B13/BN_LoginAsia 与 Judge、Operation/AsiaOps 衔接。
- **约定**：所有「当前是什么」的判断均经 BattlenetRegionJudge；Operation 只负责枚举、点击、国服流程；亚服动作委托 BattlenetAsiaOps；detected_region 与 get_dynamic_state_result 的 region_detected 同源。若在流程或别处直接判「亚服/国服」而不经 Judge 会破坏单一真相源。亚服 D3/Play 可来自 docs JSON 或 app_constants *_ASIA；国服为常量。

### 2.2 易被误解或改错的原因

1. **在 rosbot_flow_battlenet 或别处直接根据控件判亚服/国服**：文档明确 Judge 为单一真相源；若在 flow 内自实现判定会与 Judge 重复或不一致。
2. **改 LOGIN_WINDOW_AUTOMATION_ID_MARKERS 与 ASIA 重叠**：国服含 ntes、亚服不含；若亚服版本也出现 legalAcceptance 可能偏国服，但亚服还依赖 is_asia_email_step/is_asia_password_step，改 markers 未同步步骤会误判。
3. **_load_asia_features_from_docs_json 与国服常量的不对称**：亚服可从 docs JSON 加载、国服写死 constants；若国服也改从 JSON 须同步文档与加载逻辑。
4. **B4/B13/BN_LoginAsia 调用 Judge 或 Operation 的顺序与文档不符**：B4 先 login_failed、browser_wait，再 is_on_login_screen/is_on_asia_login_screen；B13 用 get_dynamic_state(preferred_region)；若颠倒或漏判会流程错。

### 2.3 正确做法

- 修改战网判定或操作前先读本文档与各模块职责表；状态与「当前是什么」只经 BattlenetRegionJudge；流程只做编排、不重复实现判定；常量与 JSON 更新须同步 app_constants 或 docs。

---

## 三、d3utils/battlenet_button_detector.py

### 3.1 职责与约定

- **用途**：**Battle.net 蓝色按钮检测**（颜色 #0074E0）。以任意该色像素为左上角尝试构建 button_w×button_h 框（默认 200×20），**仅校验左、上、右三边**（不校验底边）；第一个成功构建即返回 bbox、center、width、height。常量来自 **providor.constants.common**：BATTLE_NET_BUTTON_HEX、BATTLE_NET_BUTTON_RGB、DEFAULT_BRIGHTNESS_TOL、DEFAULT_BUTTON_W、DEFAULT_BUTTON_H。
- **约定**：find_battlenet_blue_button(image, color_hex, brightness_tol, button_w, button_h, log_prefix) 返回 Optional[Dict]；image 可为 path、PIL Image、ndarray；_check_left_top_right 不检查底边；若改校验逻辑为四边或改默认尺寸须与调用方及 constants 一致。与 BattlenetOperation/Judge 的控件点击为不同路径（本模块为像素色块检测）。

### 3.2 易被误解或改错的原因

1. **在 _check_left_top_right 内增加底边校验**：文档与注释明确「validate left, top, right edges only (not bottom)」；若加底边可能因裁剪或遮挡导致检不到。
2. **改 BATTLE_NET_BUTTON_HEX 或 DEFAULT_BUTTON_W/H 未同步 providor.constants.common**：常量从 common 导入，若在 detector 内写死或改 common 未同步调用方会尺寸或颜色错。
3. **brightness_tol 默认与 _rgb_bounds 逻辑**：0 通道用 [0, ceil(255*tol)]；非 0 用 value*(1±tol)；若改 tolerance 或 bounds 会误匹配或漏匹配。
4. **与 BattlenetRegionJudge 或 Operation 的 D3/Play 点击混淆**：Judge/Operation 用 automation_id/name 与控件树；本模块用像素色块；若在流程中混用两套逻辑须明确场景。

### 3.3 正确做法

- 保持左/上/右三边校验；常量以 providor.constants.common 为准；改尺寸或颜色须同步 common 与调用方；与控件点击路径区分清楚。

---

## 四、d3utils/rosbot_flow/flow_f1c_f1d.py

### 4.1 职责与约定

- **用途**：**F1c / F1d**（ROSBOT_FLOW_MERMAID F 块）。**F1d**：检测到掉线 → set d3_disconnected（get_game_interface_data().set_d3_dynamic_status(..., disconnected=True)）、reset_bn_block_state(False)，**caller 随后调 run_f1c_end_d3**。**F1c**：kill D3（get_d3_manager().kill_if_running()），下一 tick 进 F_Entry。F1d 不在此内调 F1c，由 caller 顺序调用。
- **约定**：run_f1d_on_disconnect() 与 run_f1c_end_d3() 的调用顺序为**先 F1d 再 F1c**；F1c 不在此内调用 F_Entry，由下一 tick 进入。若在 run_f1d 内直接调 run_f1c 会耦合单 tick 内完成两段；当前设计为 caller 调 F1d 再 F1c。reset_bn_block_state(False) 为重置 BN 块状态（与 FLOW_ARCHITECTURE_DIRECTORY 一致）。

### 4.2 易被误解或改错的原因

1. **在 run_f1d_on_disconnect 内直接调用 run_f1c_end_d3**：文档与注释写「Caller then calls run_f1c_end_d3」；若在此内调会改变 caller 的调用约定与单 tick 语义。
2. **颠倒调用顺序（先 F1c 再 F1d）**：应先 set 状态与 reset BN 再 kill D3；若先 kill 再 set 状态会状态与流程不一致。
3. **set_d3_dynamic_status 参数与文档不符**：文档为 on_login_screen=False, disconnected=True, in_game=False；若改参数会 game_interface_data 状态错。
4. **reset_bn_block_state(False) 与 reset_bn_block_state(True) 混淆**：False 为 Flow-master 的 BN 块重置；若传 True 或省略可能语义不同（见 flow_bn_block_state）。

### 4.3 正确做法

- 保持 F1d 仅 set 状态与 reset BN、不在此内调 F1c；caller 先 F1d 再 F1c；与 ROSBOT_FLOW_MERMAID、FLOW_ARCHITECTURE_DIRECTORY 一致。

---

## 五、与道歉文档的关系

若此前因未先通读上述四处约定（设计文档 Login Try 无线程与常量、BATTLENET_REGION_DESIGN_REVIEW Judge 单一真相源与流程衔接、battlenet_button_detector 三边校验与 constants、flow_f1c_f1d caller 调 F1d 再 F1c）而在此四处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
