# 技术说明：YOLO_TRAINING_DATA_COLLECTION_DESIGN、bottom_bar_status_block、screenshot_handler、_obsolete_analyzer_log、d3_macro_controller

**目的**：说明这五处文档/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/YOLO_TRAINING_DATA_COLLECTION_DESIGN.md`
- `ui/components/bottom_bar_status_block.py`
- `controller/d4func/screenshot_handler.py`
- `utils/_obsolete_analyzer_log.py`
- `controller/d3_macro_controller.py`

---

## 一、docs/YOLO_TRAINING_DATA_COLLECTION_DESIGN.md

### 1.1 职责与约定

- **用途**：YOLO 训练数据采集的**完整设计方案**。入口：坐标效准面板「YOLO训练数据采集」按钮（coordinate_calibration_panel）；按当前客户端截图后打开 **YOLO 标注窗口**（YoloAnnotationWindow / YoloCollectorWindow）；数据模型：class_names、screenshot_history（每项 image + annotations）、current_index；标注类型 rect/circle/polygon/freehand，导出转 bbox；生成数据集到 **YOLO_DATASET_BASE_DIR / yolo_dataset_YYYYMMDD_HHMMSS**（或会话目录 session_dir）；data.yaml、train/val 划分、仅对有目标的图写 .txt；i18n ui.coord_calibration.yolo_collect_button；**§8 开发细节（已实现）**：临时目录、yolo_collect_config.json、current_subdataset.json、识别类型列表与 get_yolo_collect_class_color(index)、标注列表「图」列叠加、刷新截图不清空而追加、generate_dataset_from_screenshot_history(..., output_dir=session_dir)。
- **约定**：实现须与文档一致：输出路径、data.yaml 键（path/train/val/nc/names）、标签格式、无目标不写 .txt；类别颜色由 app_constants.get_yolo_collect_class_color(index)；CONFIG 键 yolo_collect.session_dir、yolo_collect.classes。

### 1.2 易被误解或改错的原因

1. **输出目录与文档不符**：若实现写到其它路径或不用 YOLO_DATASET_BASE_DIR/yolo_dataset_*、或「生成数据集」时新建时间戳目录而非当前 session_dir，与 §8.1/8.6 不符。
2. **data.yaml 或标签格式与 Ultralytics 不一致**：若 path 用反斜杠、或 names 非字典 {0: name0, ...}、或标签未归一化 0~1 六位小数、或无目标图也写了 .txt，训练会报错或官方工具不认。
3. **数据模型与文档不一致**：若 screenshot_history 项缺 image/annotations、或 annotations 缺 class_id/type/rect 等、或 class_names 与 class_id 不对应，生成数据集或画布会错。
4. **刷新截图行为**：文档 §8.4 明确「不清空、不覆盖」、新截图 **append** 到 history；若实现成清空或覆盖当前条，与设计不符。
5. **i18n 或常量未同步**：若 yolo_collect_button 未在 i18n_tabs_zh/en 的 ui.coord_calibration 下、或 YOLO_COLLECT_HUE_* / get_yolo_collect_class_color 未在 app_constants 中实现，UI 或颜色会错。

### 1.3 正确做法

- 实现前通读全文尤其 §4（数据集生成）、§8（已实现细节）；输出目录、data.yaml、标签格式、screenshot_history 与 session_dir 行为与文档一致；类别颜色与 CONFIG 键与文档一致。

---

## 二、ui/components/bottom_bar_status_block.py

### 2.1 职责与约定

- **用途**：底部栏**状态块**：两行、无标题，每行由 **STATUS_ROW_1** / **STATUS_ROW_2**（status_row_config）配置；(label_i18n_key, var_key, default_fg)；用 status_vars[var_key] 绑定 StringVar，make_status_item 生成 Label；**register_callback(value_labels)** 把 var_key -> value_Label 的 dict 回传给调用方，供后续按状态更新 value Label 的 fg。调用方为 bottom_bar.py：传入 status_vars（含 battlenet、ros、d3、map、stage、oauth、window_size 等），_register_status_labels 存为 _value_labels，_update_ui_from_state 时遍历 _value_labels 设 fg。
- **约定**：status_vars 的 key 必须与 STATUS_ROW_1/STATUS_ROW_2 的 var_key 一致；register_callback 必须被调用且传入的 value_labels 的 key 与 var_key 一致；label_key 为 i18n key（如 rosbot.battlenet_status），须在 i18n 中存在。

### 2.2 易被误解或改错的原因

1. **status_vars 缺 key**：若 STATUS_ROW_1/2 有 ("rosbot.xxx", "oauth", None) 而 status_vars 无 "oauth"，_build_row 会 skip 该 item，value_labels 无 oauth，底部栏该列不显示或无法更新。
2. **新增/删除行未同步**：若在 status_row_config 增加或删除一项，未在 bottom_bar 的 status_vars 或 _update_ui_from_state 中同步，会多出空列或少列或 fg 更新错 key。
3. **register_callback 未正确保存**：若调用方未把 value_labels 存下来（如 bottom_bar 的 _value_labels），后续 _update_ui_from_state 无法更新 value Label 的 fg，状态栏不随状态变色。
4. **i18n key 错误**：若 label_key 在 i18n 中不存在或路径错，get_ui_text 返回 key 或默认，显示异常。

### 2.3 正确做法

- status_vars 包含所有 STATUS_ROW_1/2 的 var_key；修改 status_row_config 时同步修改 status_vars 的构建与 _update_ui_from_state 中遍历的 key；保证 register_callback 传入的 value_labels 被保存并用于 fg 更新；i18n key 与 i18n_tabs/rosbot 等一致。

---

## 三、controller/d4func/screenshot_handler.py

### 3.1 职责与约定

- **用途**：D4 控制器用的**截图与信息采集**。capture_and_collect_info(d4_data)：调用 get_screenshot_provider().gen(use_optimized_capture=True, window_titles=DIABLO_IV_WINDOW_TITLES)；成功时写 **self.d4_data**（screenshot_data、game_window_size、fullscreen_size、window_offset、timestamp）并设 d4_data.window_detected 等；失败时写**参数 d4_data** 的 window_detected=False 等。save_screenshot_to_disk(screenshot_data, screenshot_dir) 将 game_window_image 存为 d4_exp_farming_*.png。
- **约定**：调用方传入的 d4_data 与 get_d4_interface_data() 应为同一实例；成功分支写的是 self.d4_data，若调用方传入的是另一引用，则「成功」时调用方拿到的 d4_data 未更新，仅 self.d4_data 更新，会导致数据不一致。

### 3.2 易被误解或改错的原因

1. **d4_data 引用不一致**：capture_and_collect_info 成功时只写 self.d4_data，参数 d4_data 未写；若调用方传的是 get_d4_interface_data() 的同一实例，则 self.d4_data 即该实例，一致；若调用方传的是别的对象，成功时调用方侧 d4_data 无新截图，后续 region_detector 等读的是旧数据。
2. **失败分支只写参数 d4_data**：失败时写的是参数 d4_data 的 window_detected 等，不写 self.d4_data；若通常调用都传 get_d4_interface_data()，两处应同引用，无问题；若混用，失败时 self.d4_data 仍为旧值。
3. **调用顺序**：D4 流程必须先 capture_and_collect_info 再 region_detection/map_switch 等；若先调 region_detector 再截图，screenshot_data 为空，检测失败。
4. **save_screenshot_to_disk 独立**：需传入已有 screenshot_data；若在 capture 失败后调用 save，screenshot_data 可能为 None 或旧图。

### 3.3 正确做法

- 调用 capture_and_collect_info 时始终传入 get_d4_interface_data() 的返回值，保证与 handler 内 self.d4_data 同一引用；或统一改为只写参数 d4_data 并在成功时也写参数；先截图再执行 region_detection 等；save_screenshot_to_disk 仅在已有有效 screenshot_data 时调用。

---

## 四、utils/_obsolete_analyzer_log.py

### 4.1 职责与约定

- **用途**：文件名带 **\_obsolete_**，表示**已废弃**。原为根据日志行更新地图状态：check_map_status(line)、analyze_log_line(log_line)；从 CONFIG 读 map_status（rift_start_triggers、rift_end_triggers、start_picking_items 等）、log_detection（start_loop、login_try）；更新 **GAME_STATE**（providor.providor_second）：mapstatus、pause、activate_loop_state、deactivate_loop_state 等。
- **约定**：主流程中地图/日志状态不应依赖此模块；若当前实现有专门的 log monitor 或 map state 提供方，应使用那套逻辑，不在此文件改或从此文件 import。

### 4.2 易被误解或改错的原因

1. **当作主流程日志解析入口**：若在 log monitor 或 D3 扩展中调用 analyze_log_line 期望更新全局 GAME_STATE，会与现有状态提供方或 flow 不一致；且 GAME_STATE 与 FLOW_STATE_OWNERSHIP 中「状态由流程类库持有」可能冲突。
2. **CONFIG 键依赖**：若主流程已不用 map_status/log_detection 这些键，在此改 CONFIG 不会影响主流程；若主流程用不同键，两套逻辑会分叉。
3. **在 obsolete 中加逻辑**：在此新增 trigger 或状态会形成死代码或与主流程重复。

### 4.3 正确做法

- 主流程不引用 _obsolete_analyzer_log；地图/日志状态以当前设计文档与状态提供方为准；不在此文件增加功能或修复作为主方案。

---

## 五、controller/d3_macro_controller.py

### 5.1 职责与约定

- **用途**：D3 宏应用**主控制器**。初始化 GameInterfaceController、Diablo3MacroUI；macro 启停：start_macro/stop_macro → trigger_extension_main_start_macro/stop_macro、get_thread_registry().start_macro_fallback/stop_macro_fallback；技能配置 current_skill_config（config1～config4）、CONFIG.macro_configs.skill_configs、auxiliary_config；run()：初始化 game_interface → 创建 UI → 设置 macro/config 回调 → 注册语言监听 → window_monitor 注册 UI 状态回调、panel.get_status_ui_callback()、refresh_window_status_if_inactive → get_thread_registry().create_extension_threads → register_extension_handlers → start_timer_loop_after_ui_ready → 托盘 → ui.run()（阻塞）→ execute_shutdown()。关机优先 ui._unified_exit()，否则 fallback 停 macro、shutdown_game_interface、托盘 stop、os._exit。
- **约定**：线程与定时器由 runtime.get_thread_registry()、register_extension_handlers、window_monitor 统一注册；技能配置名仅 config1～config4；CONFIG 键 macro_configs.skill_configs、macro_configs.auxiliary_config；退出应走 _unified_exit 以保证定时器与线程正确收尾。

### 5.2 易被误解或改错的原因

1. **注册顺序或依赖错误**：若 create_extension_threads 在 register_extension_handlers 之前、或 window_monitor 回调未在 UI 就绪前注册，会导致状态不刷新或扩展线程未拿到 panel。
2. **CONFIG 键错误**：若代码用 macro_config.skill_config 等单数或其它键名，与 CONFIG 结构不符，取不到配置。
3. **shutdown 不经 _unified_exit**：若直接 os._exit 而不先 stop macro、shutdown game_interface、停止托盘与定时器，可能留下后台线程或资源未释放。
4. **MacroLoopThread 与 MainFunctionThread**：有 main_thread 时由 main_thread 执行 macro；无时由 fallback MacroLoopThread；若两处逻辑不一致或 fallback 未正确 stop，macro 会停不下来或重复执行。
5. **语言切换**：_on_language_changed 带 500ms debounce，并转发给 ui._on_language_changed；若 UI 未实现该方法或 listener 未注册，语言切换不生效。

### 5.3 正确做法

- 保持 run() 内注册与启动顺序与现有设计一致；CONFIG 键与 save_config 处一致；关机一律优先 _unified_exit；技能配置仅用 config1～config4；main_thread 与 fallback 的启停与 thread_registry 一致。

---

## 六、与道歉文档的关系

若此前因上述任一点（如 YOLO 设计文档与实现路径/数据模型/刷新行为不一致、bottom_bar_status_block 的 status_vars 或 register_callback 未同步、screenshot_handler 的 d4_data 引用混用、误用 _obsolete_analyzer_log、d3_macro_controller 注册顺序或 shutdown 未走 _unified_exit）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
