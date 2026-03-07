# 技术说明：slot_line_scan_columns、interface_manager、coordinate_picker_window、d4_extension_thread、exp_farming

**目的**：说明这五处代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `scripts/slot_line_scan_columns.py`
- `d3utils/interface_manager.py`
- `ui/components/coordinate_picker_window.py`
- `d3utils/d4_extension_thread.py`
- `controller/d4func/exp_farming.py`

---

## 一、scripts/slot_line_scan_columns.py

### 1.1 职责与约定

- **用途**：调试脚本，用固定太古线色（DEFAULT_PRIMAL_BGRS）对目标图逐列扫描，每列找连续匹配段；若长度 >= MIN_LINE_HEIGHT_PX 视为「一条线」，否则记该列最长段为 fallback。输出到 target_dir/slot_line_scan/*_scan.png（绿=线，橙=最长段）。路径：_script_dir = Path(__file__).resolve().parent，_d3_check_root = _script_dir.parent，_core_node_root = _d3_check_root.parent.parent；TARGET_DIR、TARGET_NAME 为默认硬编码，也可通过 argv 传文件或目录。
- **颜色**：仅用本文件 DEFAULT_PRIMAL_BGRS（BGR 元组列表），不从参考图提取；COLOR_TOLERANCE_RATIO = 0.10。

### 1.2 易被误解或改错的原因

1. **路径假设**：脚本假定 __file__ 在 pyapps/d3-check/scripts/，故 _d3_check_root 为 d3-check、_core_node_root 为 core_node 上两级；若脚本移动或从别处运行，sys.path 插入可能错，导致 pycore 等导入失败。
2. **硬编码 TARGET_DIR/TARGET_NAME**：默认指向用户目录下 .core_node/pytools/tmp/...；若未传参且该路径不存在或无该文件，main 直接 exit(1/2)。
3. **颜色与 MIN_LINE_HEIGHT_PX**：若修改 DEFAULT_PRIMAL_BGRS 或 MIN_LINE_HEIGHT_PX 未与调用方/文档一致，扫描结果会变；build_mask_relative 用 inRange 每通道 ±ratio，与 game_interface_data 中其他颜色逻辑可能不一致。
4. **输出目录**：固定为 target_dir / "slot_line_scan"，若目标文件系统只读或无权限会写失败。

### 1.3 正确做法

- 从 d3-check 根或 scripts 目录运行，或通过 argv 传入正确目标路径；修改默认 TARGET_DIR/TARGET_NAME 或颜色常量时确认与使用场景一致；输出目录需可写。

---

## 二、d3utils/interface_manager.py

### 2.1 职责与约定

- **用途**：D3 界面信息采集协调；统一入口为 collect_ui_info（Optimized）/ collect_ui_info_anchor（Anchor）、collect_bag_info_quik（Optimized）/ collect_bag_info_anchor（Anchor）。**约定**：必须先 collect_ui_info（或 collect_ui_info_anchor），再 collect_bag；两套路径（Optimized 与 Anchor）不可混用（即不能先 collect_ui_info 再 collect_bag_info_anchor）。无背包时送 I 键再试一次（window_send_key(hwnd, VK_I)），然后重新 collect_ui_info 与 bag collect。
- **collect_bag_info_quik / collect_bag_info_anchor**：内部**始终**先调 collect_ui_info（或 collect_ui_info_anchor）且 force_new_capture=True，再 BagInfoCollector.collect；BagInfoCollector 从 shared data 取 game_window_image，不单独传图。

### 2.2 易被误解或改错的原因

1. **先 collect_bag 再 collect_ui**：若调用方先调 collect_bag_* 而未先 collect_ui_*，shared data 无最新 game_window_image/ui_region，bag 检测会失败或用旧图。
2. **Optimized 与 Anchor 混用**：若一次流程中 collect_ui_info（Optimized）后调 collect_bag_info_anchor，或反过来，数据源不一致（窗口缓存 vs 全屏锚点），会错。
3. **省略「无背包送 I 再试」**：若去掉「无 bag 时 send I + sleep + 再 collect_ui + 再 collect bag」逻辑，背包未打开时永远采不到 bag。
4. **collect_bag_info_from_current_shared**：前提是已调过 collect_ui_info，shared 中已有 game_window_image；若未先 collect_ui_info 就调，会直接 return None。
5. **window_send_key**：来自 pycore.pyutils.window_ops，不是 utils._obsolete_window_ops；VK_I 来自 providor.constants.common。

### 2.3 正确做法

- 调用顺序：先 collect_ui_info 或 collect_ui_info_anchor，再 collect_bag_info_quik 或 collect_bag_info_anchor（同套路径）；无 bag 时保留送 I 再试一次；不在本层混用 Optimized/Anchor。

---

## 三、ui/components/coordinate_picker_window.py

### 3.1 职责与约定

- **用途**：坐标拾取窗口，大图展示 + 点/矩形/圆拾取；可选模板匹配（TemplateMatcherHelper）；client_mode 为 CLIENT_TYPE_BATTLENET / CLIENT_TYPE_D3_GAME / CLIENT_TYPE_D4_GAME，用于模板列表与匹配。**实时同步**：每次添加 pick 即调 on_picks_updated([pick])；历史显示用 pick_history_ref（主 UI 的列表）若提供，否则用 self.picks。i18n key：ui.coord_picker.*（window_title、menu_title、pick_type_point 等）。
- **依赖**：UnifiedStyles、ui.utils（var_str/var_int/var_bool）、get_app_root、TemplateMatcherHelper、providor_index 的 CLIENT_TYPE_*。

### 3.2 易被误解或改错的原因

1. **client_mode 与模板**：get_available_templates(self.client_mode)、match_templates(self.client_mode) 依赖 client_mode；若创建时未传或传错，模板列表与匹配会错（战网/D3/D4 模板不同）。
2. **on_picks_updated 与 pick_history_ref**：若主 UI 未传入 on_picks_updated 或 pick_history_ref，则拾取不会回传主界面，或历史树显示的是本地 self.picks 而非主 UI 统一历史。
3. **坐标系**：pick 存的是**原图坐标**；画布用 scale_factor、canvas_offset_x/y 换算；若外部把 pick 当画布坐标用会错。
4. **i18n key**：ui.coord_picker.* 须与 i18n JSON 一致；若 JSON 缺 key 或改名未同步，会显示 key 或错文案。
5. **「Apply & Match」/「Reset Image」**：对话框内按钮文案当前为英文硬编码；若需 i18n 须加 key 并统一。

### 3.3 正确做法

- 创建 CoordinatePicker 时传入正确的 client_mode 与 on_picks_updated、pick_history_ref（若主 UI 有统一历史）；pick 的 x/y/width/height/radius 一律视为原图坐标；新增/修改 ui.coord_picker.* 时同步 i18n 文件。

---

## 四、d3utils/d4_extension_thread.py

### 4.1 职责与约定

- **用途**：D4 专用线程，替代 timer 注册；每 D4_TICK_INTERVAL（如 3 秒）在 **is_exp_farming_running() 或 debug_window_open** 为 True 时调用 d4_controller.process()。用 time.sleep(0.1) 分步 sleep 以便 request_shutdown 及时退出。单例通过 get_d4_extension_thread/set_d4_extension_thread 管理。
- **与文档**：见 Cursor_专属道歉文档 第十二节：D4_TICK_INTERVAL 与条件不可改错；process 不宜阻塞过长；退出时需 request_shutdown。

### 4.2 易被误解或改错的原因

1. **条件写错**：若改为仅 exp_farming 或仅 debug_window，与设计「两者任一即 tick」不符；若漏写其一，另一场景下 D4 不跑。
2. **未调用 request_shutdown**：应用退出时若未对 _instance 调 request_shutdown，线程会一直 sleep 到进程结束，可能影响退出或资源释放。
3. **process() 阻塞**：若 d4_controller.process() 内长时间阻塞，本线程会卡住，tick 间隔变长；应保证 process 尽快返回。
4. **D4_TICK_INTERVAL**：来自 providor.constants.d4；若常量改为 0 或极大，会导致不 sleep 或几乎不 tick。

### 4.3 正确做法

- 保持「is_exp_farming_running() or debug_window_open」条件；应用退出时调用 request_shutdown；process 内避免长阻塞；D4_TICK_INTERVAL 与常量定义一致。

---

## 五、controller/d4func/exp_farming.py

### 5.1 职责与约定

- **用途**：D4 经验 farming 流程编排。start_exp_farming_process(d4_data)：**step1** screenshot_and_collect_info（ScreenshotHandler.capture_and_collect_info）、**step2** region_detection（RegionDetector.detect_regions_from_shared_data）、**step3** map_switch_detector.detect_map_switch + map_name_recognizer.recognize_map_name、**step4** _save_screenshot_and_annotate。依赖 get_d4_interface_data()、D4_SCREENSHOT_DIR、D4_ANNOTATED_DIR；step3 内动态 import get_map_switch_detector、get_map_name_recognizer。
- **路径**：current_dir = Path(__file__).parent.parent.parent（d4func -> controller -> pyapps/d3-check），用于 sys.path。

### 5.2 易被误解或改错的原因

1. **步骤顺序**：必须 step1 -> step2 -> step3 -> save；若先 step2 再 step1，shared data 无截图与 collect info，region_detector 无输入；若先 step3 再 step2，detected_regions 可能未就绪，map_name_recognizer 取不到 Map Name 区域。
2. **d4_data 与 shared data**：step1 写入 d4_data/screenshot_data 等；step2 从 shared data 读并写 detected_regions；step3 读 detected_regions 与 is_post_switch_idle。若 step1/step2 未正确写入，step3 或 save 会失败或误判。
3. **is_windowed_mode**：_save_screenshot_and_annotate 里调 d4_data.is_windowed_mode()；D4InterfaceData 继承 InterfaceDataBase，需保证 fullscreen_size/game_window_size 已 set，否则 is_windowed_mode 可能错。
4. **last_annotated_screenshot_path**：条件写为「若没有 last_annotated_screenshot_path 才标注并保存」；若逻辑反了会重复写或从不写。
5. **路径**：current_dir 假定 __file__ 在 controller/d4func/；若文件移动，sys.path 可能错。

### 5.3 正确做法

- 严格保持 step1 -> step2 -> step3 -> save 顺序；确保 ScreenshotHandler、RegionDetector 按约定写入 d4_data 与 shared data；step3 与 map_name_recognizer 约定一致（detected_regions['region_images']['Map Name']、is_post_switch_idle）；路径与项目结构一致。

---

## 六、与道歉文档的关系

若此前因上述任一点（如 slot_line_scan 路径/颜色、interface_manager 顺序或 Optimized/Anchor 混用、coordinate_picker client_mode/回调、d4_extension_thread 条件或 shutdown、exp_farming 步骤顺序或 d4_data 依赖）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。interface_manager、d4_extension_thread 已在先前章节提及，本节与对应技术说明统一为准。
