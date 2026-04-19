# 技术说明：providor/constants/d4、rosbot_flow_state、COORDINATE_SCALE_SPEC、bn_flow_B8、FLOW_STATE_OWNERSHIP_DESIGN

**目的**：说明此五处文件的职责、易被误解或改错的原因，以及正确约定。**修改前请先通读本说明。**

**涉及文件**：
- `providor/constants/d4.py`
- `d3utils/rosbot_flow_state.py`
- `docs/COORDINATE_SCALE_SPEC.md`
- `.cache/bn_flow_snapshots/bn_flow_B8.json`
- `docs/FLOW_STATE_OWNERSHIP_DESIGN.md`

---

## 一、providor/constants/d4.py

### 1.1 职责与约定

- **用途**：D4 专用常量；所有符号为 D4_* 或 Diablo IV 相关。D4_STANDARD_RESOLUTION_WIDTH/HEIGHT（1763×1126）、D4_SCREENSHOT_DIR/D4_ANNOTATED_DIR（基于 TMP_DIR）、D4_TAB_*、D4_START_GAME_*（CN 与 Asia 两套 automation_id/name_keywords）、D4_TICK_INTERVAL（3.0）、D4_EVENT_KEYS（事件名→event center 用键）。导入：`from providor.constants.d4 import D4_TICK_INTERVAL, D4_SCREENSHOT_DIR` 等。
- **约定**：D4_EVENT_KEYS 的 key 为事件名，value 为 event center 订阅用；增删或改名须与 d4_extension_thread、exp_farming、event center 注册处同步；D4_TAB_* / D4_START_GAME_* 与 rosbot_ui_structure、operate_by_spec 等 BN/D4 控件查找一致；TMP_DIR 来自 common，勿在 d4.py 内重定义。

### 1.2 易错点

- 改 D4_EVENT_KEYS 的 key 未与 event center 订阅/发布处同步会导致事件收不到或 key 错；改 D4_TICK_INTERVAL 未与 d4_extension_thread 的 tick 间隔一致会节奏错；改 D4_SCREENSHOT_DIR/D4_ANNOTATED_DIR 未与 d4_controller、exp_farming 写入路径一致会写错目录。

### 1.3 正确做法

- 增删 D4_* 常量前 grep 消费者（d4_controller、exp_farming_manager、event center、rosbot_flow 中 D4 相关）；改 D4_EVENT_KEYS 必与发布/订阅方对照；路径类常量与 common.TMP_DIR 及实际写入处一致。

---

## 二、d3utils/rosbot_flow_state.py

### 2.1 职责与约定

- **用途**：流程状态单源真相（FLOW_STATE_ARCHITECTURE）；持有 _flow_master_enabled、_bn_only_enabled；提供 get_flow_master_enabled()、get_bn_only_enabled()、is_flow_active()；仅 set_flow_master_enabled()、set_bn_only_enabled() 可写，且写时同步到 game_interface_data（get_game_interface_data().set_rosbot_flow_master_enabled / set_ensure_battlenet_only_master_enabled）。状态变更时流程控制类跳过逻辑；tick 始终运行，不关 task。
- **约定**：**仅面板通过 set_* 写；process_task、check_window、BN 流等仅通过 get_* 读**。其他类库（provider、BN 节点、F0/F3/F4、extension_flow_tick_step）不读 flow_master/bn_only 做分支判断（FLOW_STATE_OWNERSHIP_DESIGN）；例外仅 BN 流内 no_activate 下用户关闭「确保战网」可读 get_bn_only_enabled() 用于提前 abort。

### 2.2 易错点

- 在 process_task、provider、run_f0、extension_flow_tick_step 等内读 get_flow_master_enabled()/get_bn_only_enabled() 做「是否执行」分支则破坏单源与设计；在非面板处调用 set_flow_master_enabled/set_bn_only_enabled 会破坏所有权；改 set_* 时未同步 game_interface_data 会导致 UI 与真实状态不一致。

### 2.3 正确做法

- 修改前必读 docs/FLOW_STATE_OWNERSHIP_DESIGN.md；仅 rosbot_extension_panel（或等价面板）调用 set_*；分支判断统一用 get_*，且仅在 process_task/check_window 等流程入口处读；不在此文件外新增对 _flow_master_enabled/_bn_only_enabled 的写。

---

## 三、docs/COORDINATE_SCALE_SPEC.md

### 3.1 职责与约定

- **用途**：坐标与缩放的最新算法规范。统一规则：**先减边框（转 content-space）→ 按 content ratio 缩放 → 再加回边框（转实际外像素）**。Frame 固定 (8,8,31,8)；仅内容区参与缩放。标准外尺寸（内容 1300×800 时）为 1316×839。
- **约定**：坐标换算公式 scaled_x = (std_x - 8) * scale_x + 8，scaled_y = (std_y - 31) * scale_y + 31；偏移用 scale_standard_value_to_actual(value, scale, border)；实现处为 calculate_unified_scaled_coordinate()（windowed 路径）、scale_standard_value_to_actual()；背包区域以标准外空间 (925,445),(1297,665) 等存储，缩放仅在 scale 方法内做 subtract/scale/add-back。全屏无 frame，scaled = std * scale。

### 3.2 易错点

- 未先减边框即缩放或未在最后加回边框会导致坐标/偏移错位；改 WINDOW_BORDER_* 或 TITLE_BAR_HEIGHT 未与 calculate_unified_scaled_coordinate、scale_standard_value_to_actual 及所有调用方同步会界面错；把「标准空间」当「内容空间」或反之会算错。

### 3.3 正确做法

- 改任何坐标/缩放/边框相关逻辑前通读本 spec；所有涉及窗口坐标、offset、背包区域处均遵循 subtract border → scale → add border back；改常量须与实现与 spec 同步。

---

## 四、.cache/bn_flow_snapshots/bn_flow_B8.json

### 4.1 职责与约定

- **用途**：BN 节点 B8 的快照；结构为 meta（node="B8", reason="B8_to_B9"）+ controls（本文件可为空数组 []）。与 bn_flow_B5、B9 等同类；用于调试/回放，非流程逻辑数据源。
- **约定**：meta.node 须与 BN 节点名一致（B8）；消费方可能依赖 meta.node、meta.reason、controls；勿在 flow 分支中读本文件做决策；改结构或清 .cache 须确认依赖（如 unified_styles 技术说明中 bn_flow_B8 约定）。

### 4.2 易错点

- 误当流程定义改或在此文件写业务逻辑；meta.node 与 BN 节点名不一致会对照错；controls 为空与 B5 等非空结构不同，解析时须容错；删 .cache 未确认是否有代码依赖快照路径或结构。

### 4.3 正确做法

- 视作 B8 节点快照；meta.node 与 BN 一致；改结构或清缓存前 grep 依赖；不在流程分支中读本文件。

---

## 五、docs/FLOW_STATE_OWNERSHIP_DESIGN.md

### 5.1 职责与约定

- **用途**：流程状态所有权设计方案。要点：流程类库定义并持有 flow_master、bn_only 及步骤/节点状态；其他类库不持有、不读流程开关做分支；其他类库返回明确结果（True/False 或 "confirmed"、"b1" 等）；流程根据返回值更新状态与步骤；Tick 只驱动流程类库（process_task）。状态归属：flow_master_enabled、bn_only_enabled 存于 rosbot_flow_state，面板通过 set_* 写，process_task/check_window/BN 流通过 get_* 读；game_interface_data 两项仅流程 set 时写入，用于 UI 展示。
- **约定**：代码位置速查：流程状态 API 在 d3utils/rosbot_flow_state.py；BN-only 在 flow_bn_only.py；Tick 入口与分支在 rosbot_task_processor.process_task()；面板在 rosbot_extension_panel 仅通过 flow_state 的 get/set；check_window 用 is_flow_active()。与 ENSURE_BATTLENET_ONLY_TICK_FLOW 一致。

### 5.2 易错点

- 在 provider、battlenet_status_provider、run_f0、extension_flow_tick_step 等内读 flow_master/bn_only 做分支即违反设计；在流程外写 flow_master_enabled/ensure_battlenet_only_master_enabled（如写 game_interface_data 该两项）会破坏单源；改本文档未同步 rosbot_flow_state、process_task、面板与 ENSURE 文档会文档与实现不符。

### 5.3 正确做法

- 修改流程相关代码前必读本文档；凡「是否跑流程」分支仅读 rosbot_flow_state 的 get_*；凡写流程开关仅通过 set_flow_master_enabled/set_bn_only_enabled；被调用方只返回结果、不写流程状态。

---

## 六、五处交叉注意

- **d4.py** 与 d4_extension_thread、exp_farming、event center 一致；**rosbot_flow_state** 与 FLOW_STATE_OWNERSHIP_DESIGN 为同一设计的两面（代码与文档），改其一须同步另一；**COORDINATE_SCALE_SPEC** 与 calculate_unified_scaled_coordinate、scale_standard_value_to_actual、背包区域存储一致；**bn_flow_B8.json** 与 BN 节点 B8、快照消费方一致；**FLOW_STATE_OWNERSHIP_DESIGN** 与 rosbot_flow_state、process_task、面板、ENSURE_BATTLENET_ONLY_TICK_FLOW 一致。修改前请先通读本说明及上述五处文件与对应消费者。
