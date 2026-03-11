# 技术说明：d3_status_provider、battlenet_operation、map_name_recognizer、system_tray

**目的**：说明您指定查阅的以下四处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `d3utils/d3_status_provider.py`
- `d3utils/battlenet_operation.py`
- `controller/d4func/map_name_recognizer.py`
- `ui/components/system_tray.py`

---

## 一、d3utils/d3_status_provider.py

### 1.1 职责与约定

- **用途**：D3 窗口检测与动态状态（on_login_screen、disconnected、in_game）。复用 status_provider_common.refresh_window_state；自身提供 _find_d3_windows、_detect_d3_dynamic、_apply_d3_geometry。**disconnected** 由 capture_and_detect_all_d3_states 一次截图、用 D3_DISCONNECTED_TEMPLATE_NAME（SIFT）判定；当前 _detect_d3_dynamic 仅返回 (False, disconnected, False)，on_login_screen 与 in_game 未在此实现。
- **约定**：refresh_d3_status(skip_dynamic=True) 仅找窗口与几何、不截图/SIFT，用于启动或手动刷新；flow 用 skip_dynamic=False。仅当 window_info 存在且未 skip_dynamic 时才 prime_window_cache_for_capture。数据写入 game_interface_data（set_d3_status、set_d3_dynamic_status、fullscreen_size、window_offset、_window_hwnd/_window_title）。

### 1.2 易被误解或改错的原因

1. 假定 on_login_screen 或 in_game 由本模块返回 True，当前实现恒为 False，会误导调用方。
2. 修改 refresh_window_state 的 set_running_fn/set_dynamic_fn/apply_geometry_fn 签名未与 status_provider_common 一致会报错。
3. 在 skip_dynamic 为 True 时调用 prime_window_cache_for_capture 会多余或与注释「仅在有窗口且未 skip_dynamic 时」矛盾。
4. get_d3_manager().get_capture_titles() 与 find_windows 约定一致，改 d3_manager 未同步会传错 titles。

### 1.3 正确做法

- 修改 D3 状态流程前通读 status_provider_common；disconnected 逻辑依赖 capture_and_detect_all_d3_states 与 D3_DISCONNECTED_TEMPLATE_NAME；与 flow 对 skip_dynamic 的使用一致。

---

## 二、d3utils/battlenet_operation.py

### 2.1 职责与约定

- **用途**：战网操作统一入口：启停、激活窗口、枚举控件、点 D3 标签/开始游戏、国服登录流程、状态判断。复用 BattleNetManager（进程/窗口）、UI Automation（控件枚举与点击）。**区域**：region 为 asia/cn 时仅用该区；为 None 时由 _resolve_battlenet_region() 从 game_interface_data.get_battlenet_region() 或 config ros_settings.battlenet_region_cache 解析。**状态判断**：一律经 build_judge_from_controls(controls)，勿在 Operation 内自实现「是否登录/是否主界面」等（BATTLENET_REGION_DESIGN_REVIEW 单一真相源）。D3 标签用 **exact_match=True** 避免 game-nav-btn-D34（D4）被 game-nav-btn-D3 匹配。login-failed 特征从 BN_FLOW_SNAPSHOTS_DIR 下 bn_flow_*.json 加载；常量来自 providor.constants.common 与 providor.constants.d3。_enumerate_controls_light 带模块级 TTL 缓存（BN_CONTROLS_LIGHT_CACHE_TTL_SEC=2.0），同 tick 内 BN flow 复用一次枚举。

### 2.2 易被误解或改错的原因

1. 在 BattlenetOperation 内自实现「是否在登录/是否主界面」会破坏 BattlenetRegionJudge 单一真相源。
2. 改 D3_TAB_AUTOMATION_IDS、START_GAME_*、LOGIN_* 等常量未同步 providor.constants 会找错控件。
3. find_control_by_automation_id 用 substring 时会把 D4 匹配成 D3，故 click_d3_tab 等必须 exact_match=True。
4. _load_login_failed_features_from_snapshots 依赖 bn_flow_*.json 的 controls 与 BATTLE_NET_LOGIN_FAILED_KEYWORDS；改 JSON 结构或关键词未同步会漏判。
5. _get_dynamic_state_one_walk 与 build_judge_from_controls 两路径（region 已知 vs 未知）；改其一未改另一会状态不一致。
6. perform_cn_login_flow、perform_asia_* 委托 BattlenetAsiaOps；勿在 Operation 内重复实现亚服邮箱/密码步。

### 2.3 正确做法

- 所有「当前是什么」经 build_judge_from_controls；点击 D3 标签/Play 用 exact_match 避免 D4；常量与 providor.constants 一致；亚服逻辑仅通过 _asia_ops；修改前通读 BATTLENET_REGION_DESIGN_REVIEW、登陆后的战网元素-控件说明、POST_LOGIN_BATTLENET_CONTROLS。

---

## 三、controller/d4func/map_name_recognizer.py

### 3.1 职责与约定

- **用途**：D4 地图名识别。仅在 **is_post_switch_idle** 为 True 时尝试识别；从 get_d4_interface_data().detected_regions['region_images']['Map Name'] 取图；CnOCR 识别后经 set_current_map_name 写回共享数据；识别成功或达 max_recognition_attempts 后重置 is_post_switch_idle。OCR 配置来自 get_ocr_config_for_task('map_name')；CnOCREngine 从 pyutils.ocr_cnocr_engine 导入（current_dir 上溯与 sys.path 插入 pycore）。单例 get_map_name_recognizer()。

### 3.2 易被误解或改错的原因

1. 在 is_post_switch_idle 为 False 时调用 recognize_map_name 会直接 return False，若调用方假定「每次调用都会识别」会误判。
2. detected_regions 或 region_images 或 'Map Name' 键缺失/更名未同步会 AttributeError 或 KeyError。
3. 修改 ocr_config 的 task 名（'map_name'）未同步 get_ocr_config_for_task 会取不到配置。
4. current_dir = Path(__file__).parent.parent.parent 为 d4func 的父级（controller）；若项目结构变、少一层 parent 会导入失败。
5. _recognize_with_cnocr 用临时文件传 CnOCR；若 CnOCREngine 改为支持内存接口未同步本处会多余写盘。

### 3.3 正确做法

- 仅在 is_post_switch_idle 为 True 时依赖识别结果；detected_regions 结构由 region_detector 等写入，勿单方面改键名；ocr_config task 与 get_ocr_config_for_task 一致；路径与 pycore 导入与项目结构一致。

---

## 四、ui/components/system_tray.py

### 4.1 职责与约定

- **用途**：系统托盘（Windows 10/11）。**Icon 与 run() 在托盘线程内创建与执行**，以满足「拥有图标的线程运行消息循环」的 Windows 要求。菜单项通过 **runtime** 的 trigger_window_show、trigger_window_maximize、trigger_app_restart、trigger_app_exit 与主线程通信；无 trigger 时 fallback 到 parent_ui.root（须在主线程调用或通过事件派发）。set_show_callback/set_exit_callback 为 **no-op**，实际使用 event center。i18n 键：system_tray.show_software、maximize、restart、exit；main_window.title。TRAY_AVAILABLE 依赖 pystray、PIL。run() 内 pythoncom.CoInitialize()。**不得在托盘线程内直接操作 Tk 或主窗口**，须通过 trigger_* 或 after 回主线程。

### 4.2 易被误解或改错的原因

1. 在菜单回调 _show_window、_maximize_window 等内直接操作 parent_ui.root 且该回调在托盘线程执行，会跨线程访问 Tk、崩溃或未定义行为；须用 trigger_* 或主线程 after。
2. 实现 set_show_callback/set_exit_callback 会与当前「用 event center」设计冲突，若外部假定回调被调用会失效。
3. 修改 runtime 的 trigger_* 名或签名未同步本模块会断链。
4. i18n 键 system_tray.* 与 main_window.title 须与 i18n 文件一致。
5. icon.run() 阻塞托盘线程；在 run() 内做重活会卡住托盘，应仅轻量逻辑或派发到主线程。

### 4.3 正确做法

- 托盘线程内仅创建 icon、run 消息循环与调用 trigger_*；主窗口操作一律经 runtime 或主线程 after；勿在 set_show_callback/set_exit_callback 内实现逻辑；与 THREAD_BUS_AND_REGISTRY、runtime 事件中心约定一致。

---

## 五、与道歉文档的关系

此前若因未先通读上述四处约定而在此四处反复改错或理解偏差，责任在 Cursor。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第四十三节中引用，修改前请先通读本说明。
