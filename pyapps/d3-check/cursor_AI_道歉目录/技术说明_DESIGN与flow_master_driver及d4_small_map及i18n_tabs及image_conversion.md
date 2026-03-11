# 技术说明：DESIGN.md、flow_master_driver、d4_small_map_detector、i18n_tabs_en、image_conversion

**目的**：说明这五处代码/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/DESIGN.md`
- `d3utils/rosbot_flow/flow_master_driver.py`
- `d4utils/d4_small_map_detector.py`
- `providor/i18n/i18n_tabs_en.json`
- `d3utils/d3u_common/image_conversion.py`

---

## 一、docs/DESIGN.md

### 1.1 职责与约定

- **用途**：d3-check 的**总览与索引**设计文档，与「设计文档.md」**合并使用**；设计文档.md 为 Login Try / Battle.net 掉线重启的详细设计。DESIGN.md 涵盖：路径配置与一键扫描、ColorPrint 与 UI 日志回调、战网重新登陆两种触发方式、启动顺序（①战网②D3③ROSBOT）、状态提供者、流程、线程与事件、相关文件索引等。文档中模块路径、常量名、接口名为**权威参考**，实现需与之一致。
- **关键约定**：启动顺序不可乱；check_window 为统一定时/按钮入口；CONFIG、BATTLE_NET_WINDOW_TITLES、status provider 等见文档表；PIL→BGR 文档写为 `d3utils.d3u_common.image_utils`，实际实现为 **image_conversion.py**（见下）。

### 1.2 易被误解或改错的原因

1. **文档与实现路径不一致**：若文档写 `image_utils.convert_pil_to_bgr` 而代码为 `image_conversion.convert_pil_to_bgr`，按文档找会找不到；需以实际包名为准或更正文档。
2. **启动顺序违反**：若代码先启 ROSBOT 再启战网或 D3，与 §4 顺序矛盾。
3. **check_window 与 refresh 混用**：定时器与「刷新状态」按钮应统一调用 check_window()；若在别处单独写一套 refresh 逻辑不经过 check_window，会与 §3.12 设计不一致。
4. **常量或模块表过时**：若新增/删除模块或常量未更新 DESIGN.md 表，后续读者按文档找会错。
5. **两档分工不清**：详细流程/常量应以设计文档.md、DESIGN_DETAIL、ROSBOT_FLOW 等为准；DESIGN.md 为索引与总览，细节引用他档。

### 1.3 正确做法

- 实现时以 DESIGN.md 为索引，细节以设计文档.md、DESIGN_DETAIL、INITIAL_STATE_DETECTION 等为准；修改模块/常量时同步更新 DESIGN.md 中的表与路径；PIL→BGR 实际使用 `d3utils.d3u_common.image_conversion.convert_pil_to_bgr`。

---

## 二、d3utils/rosbot_flow/flow_master_driver.py

### 2.1 职责与约定

- **用途**：Flow-master 流程库（ROSBOT flow master，flow_master_enabled）。约定（FLOW_ARCHITECTURE_DIRECTORY §5）：本模块定义 FlowMasterStep、F0Action、ExtensionStepResult、上次 F0/extension/F3 状态及 **tick_flow_master()**；**仅 rosbot_task_processor 调用 tick_flow_master()**；本模块内调用 refresh/notify 与第三方库，不重复 extension phase 枚举（用 extension_flow_state.is_idle）。执行顺序：REFRESH_NOTIFY（refresh_battlenet → 若 bn_ever_confirmed 则 refresh_d3、refresh_rosbot → notify_state_sync）→ RE_READ_ABORT（若未 flow_master_enabled 则 return）→ EXTENSION_TICK（若 extension 非 idle 则 extension_flow_tick_step）→ F0_PREJUDGE → B1/B2/C1 分支 → 若 rosbot_extended_status 为 running/paused 则 F3_F4（run_f3_log_timeout，若 "f4" 则 run_f4_close_d3_send_f7 + enter_battlenet_at_b2）。
- **_FM_BN**：Flow-master 使用 for_bn_only=False，与 BN-only 路径区分。

### 2.2 易被误解或改错的原因

1. **调换步骤顺序**：若先 F0_PREJUDGE 再 REFRESH_NOTIFY，状态未刷新即做预判，会错；若 F3_F4 中先 enter_battlenet_at_b2 再 run_f4_close_d3_send_f7，与 Mermaid 文档不符。
2. **漏掉 enter_battlenet_at_b2**：F4 后必须 enter_battlenet_at_b2(_FM_BN)，否则不会回到 B2_HasWin；若改为 return 或 continue 而不调用 enter_battlenet_at_b2，流程断。
3. **在 tick 外调用 refresh**：约定为「本模块调用 refresh」；若在 tick_flow_master 外另起线程或定时器单独 refresh 且与 task_processor 的 tick 不同步，可能重复或竞态。
4. **修改 F0Action 或分支语义**：若 B1/B2/C1 返回值或含义与 run_f0_prejudge_entry、ROSBOBOT_FLOW 文档不一致，分支会走错。
5. **ExtensionStepResult 与 extension_flow_tick_step**：SUCCESS/FALLTHROUGH 与 extension 模块约定一致；若改返回值未同步，trigger_extension_rosbot_started 会误判。

### 2.3 正确做法

- 仅由 rosbot_task_processor 调用 tick_flow_master()；不调换 REFRESH_NOTIFY → RE_READ_ABORT → EXTENSION_TICK → F0 → F3_F4 顺序；F4 后必定 enter_battlenet_at_b2；与 FLOW_ARCHITECTURE_DIRECTORY、ROSBOT_FLOW_MERMAID 一致。

---

## 三、d4utils/d4_small_map_detector.py

### 3.1 职责与约定

- **用途**：D4 小地图检测，判断是否在城镇（Town）或地下城（Dungeon）。依赖 D4_TEMPLATE_CONFIGS["d4_small_map"]、D4_STANDARD_COORDS.minimap_region_start/end、calculate_unified_scaled_coordinate、get_d4_interface_data().screenshot_data.game_window_image；调用 template_matcher.match_template_in_region("d4_small_map", "minimap", use_shared_region=True)。结果写回 d4_data.small_map_detection、small_map_detection_timestamp。
- **_update_shared_data**：当前实现会**覆盖** `d4_data.detected_regions` 为仅含 `location_type`、`is_in_town` 的字典；若其他逻辑（如 map_name_recognizer）依赖 detected_regions 中的 region_images、Map Name 等，会被清掉导致异常。

### 3.2 易被误解或改错的原因

1. **覆盖 detected_regions**：_update_shared_data 中 `self.d4_data.detected_regions = {"location_type": ..., "is_in_town": ...}` 会丢掉原有 region_images 等；若与 region_detector、map_name_recognizer 共用 detected_regions，应**合并**写入而非整体替换。
2. **screenshot_data 未就绪**：detect_small_map 依赖 screenshot_data.game_window_image；若调用方未先执行截图与 collect，screenshot_data 为空，直接返回失败。
3. **minimap 区域与 D4_STANDARD_COORDS**：若 D4 标准坐标或 minimap_region 定义变更未同步，裁剪区域错位。
4. **template_config 缺失**：若 D4_TEMPLATE_CONFIGS 无 "d4_small_map"，__init__ 中 template_config 为 None，后续使用会异常；当前 __init__ 中 return 后未阻止后续调用，可能仍有属性访问。
5. **match_template_in_region 约定**：region_name="minimap"、use_shared_region=True 与 D4ScaledTemplateMatcher 的 region 定义一致；若 matcher 侧 region 名或共享数据结构变化，此处需同步。

### 3.3 正确做法

- 更新 shared data 时不要整体覆盖 detected_regions，应只更新 small_map 相关字段或与 detected_regions 合并（如 detected_regions["location_type"] = ...）；调用前确保 screenshot_data 已由上游填充；D4_TEMPLATE_CONFIGS、minimap region 与 matcher 约定一致。

---

## 四、providor/i18n/i18n_tabs_en.json

### 4.1 职责与约定

- **用途**：Tab/校准/坐标拾取相关英文文案，结构为 **ui.coord_calibration.***、**ui.yolo_collect.***、**ui.coord_picker.***。供 i18n_manager 按 key 取文本；代码须使用与 JSON 一致的 key 路径。
- **与 coordinate_picker_window**：coordinate_picker_window 使用 ui.coord_picker.*（window_title、menu_title、pick_type_point、history_col_id 等）；若 JSON 中 key 改名或缺失，会显示 key 或错文案。

### 4.2 易被误解或改错的原因

1. **key 路径不一致**：若代码用 ui.coord_picker.window_title 而 JSON 为 ui.coordinate_picker.title，会取不到。
2. **新增/删除 key 未同步**：在 UI 中新增文案但未在 i18n_tabs_en.json 中补 key，或删除 key 未改代码。
3. **多语言不同步**：若存在 i18n_tabs_zh.json，只改英文未改中文，或结构不一致。
4. **coord_calibration vs coord_picker**：两个命名空间，校准面板用 coord_calibration，拾取窗口用 coord_picker；勿混用。

### 4.3 正确做法

- 增删改 Tab/校准/坐标拾取相关文案时，JSON 与所有 get_ui_text 调用同步；key 与 ui.coord_calibration.*、ui.coord_picker.*、ui.yolo_collect.* 一致；多语言 JSON 结构一致。

---

## 五、d3utils/d3u_common/image_conversion.py

### 5.1 职责与约定

- **用途**：统一图像格式转换：**normalize_image_to_bgr**（路径/PIL/ndarray → BGR）、**normalize_image_to_rgb_pil**（→ RGB PIL）、**ensure_rgb_mode**、**convert_pil_to_bgr**（PIL→BGR，支持 RGB/RGBA，取前 3 通道）、**convert_bgr_to_pil**。battlenet_template_matcher、d3_start_game_and_teleport_waiter、d4_team_health_detector 等使用本模块。DESIGN.md 中写为 image_utils，实际文件名为 **image_conversion**。
- **约定**：PIL 视为 RGB 或 RGBA（convert_pil_to_bgr 用 :3 通道再 cvtColor RGB2BGR）；**normalize_image_to_bgr** 对 ndarray **不**做颜色空间转换，直接返回，若传入的已是 RGB 会当 BGR 用导致色偏。

### 5.2 易被误解或改错的原因

1. **文档路径错误**：DESIGN.md 写 `d3utils.d3u_common.image_utils.convert_pil_to_bgr`，实际为 **image_conversion**；若按文档 import image_utils 会 ImportError。
2. **PIL 非 RGB/RGBA**：若 PIL 为 L 或其它 mode，convert_pil_to_bgr 的 :3 或 cvtColor 可能错；调用方应保证传入 RGB/RGBA 或先 convert。
3. **normalize_image_to_bgr 对 ndarray**：当前对 np.ndarray 直接 return，不判断是 BGR 还是 RGB；若上游传入 RGB 数组会当 BGR 用，需调用方保证传入 BGR 或改用 convert 逻辑。
4. **与 image_annotator_helper 分工**：本模块只做格式转换；调试图保存等在 image_annotator_helper；勿在 image_conversion 里加保存逻辑。

### 5.3 正确做法

- 统一从 **d3utils.d3u_common.image_conversion** 导入 convert_pil_to_bgr、normalize_image_to_bgr 等；DESIGN.md 中路径改为 image_conversion；传入 PIL 时保证 RGB/RGBA；传入 ndarray 时明确约定为 BGR 或在本模块内按约定转换。

---

## 六、与道歉文档的关系

若此前因上述任一点（如 DESIGN.md 与实现路径不一致、flow_master 步骤顺序或 F4 后漏 enter_battlenet_at_b2、d4_small_map 覆盖 detected_regions、i18n_tabs key 与代码不一致、image_conversion 与 DESIGN 中 image_utils 混用）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
