# 技术说明：bn_flow_B6.json、d4_controller、square_sampler、DESIGN_DETAIL

**目的**：说明此四处文件/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `.cache/bn_flow_snapshots/bn_flow_B6.json`
- `controller/d4_controller.py`
- `athtest/square_sampler.py`
- `docs/DESIGN_DETAIL.md`

---

## 一、.cache/bn_flow_snapshots/bn_flow_B6.json

### 1.1 职责与约定

- **用途**：BN 流程 **B6** 节点运行时快照（UI Automation 控件树）。由 `rosbot_flow_battlenet` 内 `_save_ui_snapshot("B6", "B6_to_B13")` 写入；`meta.node`="B6"、`meta.reason`="B6_to_B13"；`controls` 为战网窗口在该节点时的控件列表（name、automation_id、type、rect 等）。用于调试、1:1 对照与登录/主界面判断参考；与 B4/B5/B7/B9/B13 等节点快照结构一致。缓存路径由 `providor.constants.common.BN_FLOW_SNAPSHOTS_DIR` 决定。
- **约定**：下游（battlenet_region_judge、_load_login_failed_features_from_snapshots、is_on_login_screen 等）若读取快照，需与 meta/controls 结构约定一致；.cache 为运行时产物，可清理；勿写死路径或把 B6 快照用于其它节点判断。

### 1.2 易被误解或改错的原因

1. **写死路径或节点名**：若代码写死 `bn_flow_B6.json` 或 .cache 绝对路径，换节点或清缓存后读不到；应使用 BN_FLOW_SNAPSHOTS_DIR 与节点名拼接。
2. **controls 结构与判断逻辑不一致**：若 battlenet_region_judge 或登录失败检测期望的 automation_id/name/rect 与 B6 快照实际结构不同，会导致 B6→B13 分支或登录状态误判。
3. **B6 与其它节点快照混用**：B6 的 reason 为 B6_to_B13，与 B5/B7 等语义不同；若用 B6 快照做 B7 轮询或 B4 首次检查，会误判。
4. **.cache 当权威提交**：.cache 为本地运行时产物，跨机或清缓存后可能不存在；勿在文档或脚本中假定其一定存在。

### 1.3 正确做法

- 快照路径从 BN_FLOW_SNAPSHOTS_DIR 与节点名生成；读取快照的代码与 battlenet_operation、battlenet_region_judge 约定的 controls 结构一致；B6 仅用于 B6 相关逻辑；不把 .cache 当唯一数据源。

---

## 二、controller/d4_controller.py

### 2.1 职责与约定

- **用途**：D4 主控制器；**仅由 D4ExtensionThread 按 D4_TICK_INTERVAL 驱动**。process()：当 exp_farming_running 时执行 start_exp_farming_process + update_ui_status + check_state_changes + _update_debug_window_if_open；当 debug_window_open 时执行截图 → capture_and_collect_info → region_detector.detect_regions_from_shared_data → map_switch_detector → map_name_recognizer → _update_debug_window_if_open；否则 return。get_interceptor() 返回「is_exp_farming_running or debug_window_open」谓词。详见本目录 **技术说明_bn_flow_B5与obsolete_game_state及rosbot_status_provider及ctl_func与d4_controller.md** §五。
- **约定**：不调换 process() 内顺序；detected_regions 更新为合并而非整体覆盖；仅 D4ExtensionThread 调用 process()。

### 2.2 易被误解或改错的原因

（同前技术说明：由错误方驱动 process、调换截图→region→map 顺序、detected_regions 被整体覆盖、与 D4ExtensionThread 条件不一致等。）

### 2.3 正确做法

（同前技术说明：仅 D4ExtensionThread 驱动、顺序不变、detected_regions 合并写入、与 d4_extension_thread 约定一致。）

---

## 三、athtest/square_sampler.py

### 3.1 职责与约定

- **用途**：**athtest 工具**：22×22 方格四角采样检测按钮颜色区域。load_button_colors(pixel_data_file) 从 JSON 读 `data['regions']['hex_pixels']`，转 RGB、去重、取前 50 色；square_sampling_detection(img, button_colors, ...) 按 step_size 滑窗、四角匹配则 expand_detection_region，≥20 匹配像素且与已有区域不重叠则记为一个 detected_region；detect_buttons_square_sampling(image_path, button_data_file, output_path) 为完整流程。**main()** 中路径写死：`D:\programing\core_node\apps\d3-check\.test\test.png`、`.cache\file_processor\button_pixels_sample.json`、`apps\d3-check\.test\square_sampling_result.png`（注意为 **apps** 而非 **pyapps**）。
- **约定**：与主流程 D3/D4 检测分离；输入 JSON 须含 regions.hex_pixels；路径应参数化或基于项目根，否则在 pyapps 或他机运行会 FileNotFoundError。

### 3.2 易被误解或改错的原因

1. **路径写死 apps 与 pyapps 不符**：项目实际为 pyapps/d3-check；main() 写 apps\d3-check 会找不到文件；.cache 路径也可能因环境不同而变。
2. **JSON 结构依赖**：若采样输出或 button_pixels_sample 改为其它键（如 data.pixels 而非 regions.hex_pixels），会 KeyError；与 file_processor 或其它采样脚本的产出格式须一致。
3. **与主流程混用**：若 D3/D4 界面检测误引用本模块且未保证输入格式与路径一致，会行为异常；应明确「仅 athtest 或手工跑脚本用」。
4. **魔数**：square_size=22、step_size=20、tolerance=0.05、≥20 匹配像素、max_expansion=100 等；修改未同步文档或调用方会结果不一致。

### 3.3 正确做法

- main() 路径改为参数或基于 __file__ 推导项目根（pyapps/d3-check）；JSON 与采样产出约定一致；不在主流程中直接依赖本脚本未文档化的接口；阈值与步长变更时同步说明。

---

## 四、docs/DESIGN_DETAIL.md

### 4.1 职责与约定

- **用途**：D3-Check **详细设计**，与 DESIGN.md **合用**：DESIGN.md 为总览与索引，本档侧重 **Login Try 与 Battle.net 掉线重启**。§2：触发为日志中出现配置触发串（log_detection.login_try，默认 "Login try"）；流程无 Python 线程：log_analyzer.analyze_log_line(line) → 若含触发则 LoginTryScreenshotController.handle_login_try() → 读 CONFIG battlenet_path → 截战网窗口（get_screenshot_provider().gen、BATTLE_NET_WINDOW_TITLES）→ OCR 检测掉线关键词（BATTLE_NET_DISCONNECT_KEYWORDS）→ 若掉线则 taskkill Battle.net.exe → 等约 2 秒 → explorer 启动 Battle.net。§2.3：log_monitor 定时读日志调 log_analyzer.analyze_log_line；log_analyzer 调 get_login_try_screenshot_controller().handle_login_try()。
- **约定**：实现须与文档一致：CONFIG 键、常量（LOGIN_TRY_TRIGGER_DEFAULT、BATTLE_NET_DISCONNECT_KEYWORDS、LOGIN_TRY_SCREENSHOT_DIR 等）、调用链 log_monitor → log_analyzer → handle_login_try、重启用 taskkill + explorer。

### 4.2 易被误解或改错的原因

1. **与 DESIGN.md 分工混淆**：DESIGN_DETAIL 只写 Login Try 与战网重启；总览、模块表、启动顺序等在 DESIGN.md；若只改本档未改 DESIGN.md（或反之），文档不一致。
2. **CONFIG/常量与代码不符**：若代码用 battlenet.exe_path 而文档写 battlenet_path、或关键词常量改名未同步文档，会配置读错或检测不到掉线。
3. **调用链断掉**：若 log_monitor 不调 log_analyzer、或 log_analyzer 不调 handle_login_try、或 handle_login_try 内顺序与文档不一致（如先启动再 kill），行为与设计不符。
4. **重启方式**：文档明确 taskkill + explorer；若改用其它方式（如 subprocess.Popen 直接起 Battle.net.exe）需在文档中说明，否则与设计不一致。

### 4.3 正确做法

- 修改 Login Try 或战网重启逻辑时同步更新本档与 DESIGN.md；CONFIG 键与常量与代码一致；保证 log_monitor → log_analyzer → handle_login_try 调用链与文档 §2 一致；重启方式与 §2.2 一致或在本档中注明变更。

---

## 五、与道歉文档的关系

若此前因上述任一点（如 B6 快照路径或结构混用、d4_controller 驱动方或 process 顺序、square_sampler 路径或 JSON 或主流程混用、DESIGN_DETAIL 与实现或 DESIGN.md 不同步）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
