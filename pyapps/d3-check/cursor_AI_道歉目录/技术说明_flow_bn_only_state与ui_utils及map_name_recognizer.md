# 技术说明：flow_bn_only_state、ui/utils、map_name_recognizer

**目的**：说明这三处代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `d3utils/rosbot_flow/flow_bn_only_state.py`
- `ui/utils/__init__.py`
- `controller/d4func/map_name_recognizer.py`

---

## 一、d3utils/rosbot_flow/flow_bn_only_state.py

### 1.1 职责与约定

- **用途**：**仅** BN-only 流程自身状态（tick 内步骤 + 上一次 BN tick 结果）。定义 `BnOnlyTickStep`（REFRESH_NOTIFY → RE_READ_ABORT → RUN_BN_TICK → HANDLE_BN_RESULT）、`BnOnlyBlockResult`（CONFIRMED / EXIT / WAIT / UNKNOWN）、模块级变量 `_last_bn_done`、`_last_bn_result`；提供 `get_last_bn_result()`、`set_last_bn_result(done, result)`、`reset_bn_only_flow_state()`。
- **与 flow_bn_block_state 的关系**：文档明确「BN block state (B1..B16) lives in **flow_bn_block_state**；**Flow-master never imports this module**」。即 B1～B16 的节点、当前节点、等待时间等均在 flow_bn_block_state；本模块只存「BN-only 一次 tick 的步骤」和「上次 tick_battlenet_ready_flow 的 done/result」。Flow-master（主流程）**不得** import 本模块；只有 BN-only 的 tick 驱动逻辑使用。

### 1.2 易被误解或改错的原因

1. **Flow-master 引用本模块**：若在 flow_master_driver 或主流程中 import flow_bn_only_state 并读/写 _last_bn_result，会破坏「Flow-master 不依赖 BN-only 内部状态」的约定，且可能把 BN 块状态与 BN-only 状态混在一起。
2. **把 B1..B16 状态放进本模块**：若将当前 BN 节点、_current_node、_wait_until 等移入 flow_bn_only_state，与 flow_bn_block_state 职责重复，且文档已约定块状态在 flow_bn_block_state。
3. **改 BnOnlyTickStep 顺序**：若调换 REFRESH_NOTIFY / RE_READ_ABORT / RUN_BN_TICK / HANDLE_BN_RESULT 的顺序或跳过某步，BN-only tick 的驱动逻辑会错。
4. **改 BnOnlyBlockResult 枚举值**：若修改 CONFIRMED/EXIT/WAIT/UNKNOWN 的字符串值或含义，调用 set_last_bn_result / get_last_bn_result 的 BN-only 逻辑会误判。
5. **reset 只清本模块**：reset_bn_only_flow_state() 只清 _last_bn_done/_last_bn_result；若期望「重置 BN 块」应调用 reset_flow_master_bn_block 或 flow_bn_block_state 的 reset，不要误以为本函数会清 B1..B16。

### 1.3 正确做法

- Flow-master 及主流程不 import flow_bn_only_state；仅 BN-only 的 tick 代码（如 rosbot_task_processor 中仅 BN 段）使用 get/set_last_bn_result、reset_bn_only_flow_state 与 BnOnlyTickStep。
- B1..B16 相关状态只放在 flow_bn_block_state；本模块仅保留「上次 BN tick 结果」与「当前 BN-only tick 步骤」。

---

## 二、ui/utils/__init__.py

### 2.1 职责与约定

- **用途**：ui.utils 包的对外入口，仅导出 `tk_variables` 的 var_bool、var_str、var_int、var_double 与 `app_root` 的 get_app_root；__all__ 明确列出上述符号。其他模块通过 `from ui.utils import var_bool, get_app_root` 等使用。
- **依赖**：依赖同包下的 tk_variables、app_root；若这两个模块改名、移动或删除，__init__.py 会导入失败。

### 2.2 易被误解或改错的原因

1. **在 __init__.py 中新增导出未同步**：若在 tk_variables 或 app_root 中新增符号但未在 __init__.py 的 __all__ 与 import 中加入，调用方 from ui.utils import xxx 会报错；若在 __init__.py 中写了 import 但 __all__ 未包含，部分工具或文档可能认为该符号非公开。
2. **在 __init__.py 中删除导出**：若移除 var_bool/var_str 等之一，所有 from ui.utils import var_bool 的代码会失败。
3. **在 __init__.py 中写业务逻辑**：本文件应只做 re-export，不应放 run_/do_ 或复杂逻辑，否则违反 PROJECT_STANDARDS 中「导入放在顶部、不在业务中散落」及包结构约定。
4. **循环引用**：若 ui.utils 下的模块反过来 import 主窗或上层 ui 包，可能形成循环；新增导入时需避免。

### 2.3 正确做法

- 新增/删除 ui.utils 对外 API 时，同步修改 __init__.py 的 import 与 __all__；保持本文件仅为薄封装，无业务逻辑。

---

## 三、controller/d4func/map_name_recognizer.py

### 3.1 职责与约定

- **用途**：D4 地图名 OCR 识别。仅在 **is_post_switch_idle 为 True** 时执行识别；从 `get_d4_interface_data().detected_regions['region_images']['Map Name']` 取地图名区域图像（PIL）；用 CnOCR 做 OCR；结果通过 **map_name_utils.set_current_map_name(map_name)** 写回共享数据；成功或达到 max_recognition_attempts 后重置 is_post_switch_idle 与 recognition_attempts。依赖 ocr_config.get_ocr_config_for_task('map_name')、CnOCREngine；路径假设：current_dir = Path(__file__).parent.parent.parent（即 pyapps/d3-check 根），pycore 在 current_dir.parent / "pycore"。
- **数据约定**：detected_regions 须含 `region_images`，且 `region_images` 须含键 **'Map Name'**（与 D4 区域定义一致）；set_current_map_name 与 map_name_utils 的 map_name/current_map 约定一致。

### 3.2 易被误解或改错的原因

1. **detected_regions 结构不一致**：若 region 采集方写入的 key 为 `map_name` 或 `map name` 而非 `'Map Name'`，或没有 region_images，recognize_map_name 会直接 return False，不会报错但永远不识别。
2. **在 is_post_switch_idle 为 False 时调用**：函数开头就检查 is_post_switch_idle，为 False 则 return False；若调用方在未设 is_post_switch_idle 或地图尚未切换完成时调用，不会执行 OCR。
3. **set_current_map_name 与 map_name_utils 不同步**：若 map_name_utils 改为写不同字段或不同数据结构，而本模块仍只调 set_current_map_name，需确保 map_name_utils 内部已统一；若在本模块内直接写 d4_data.detected_regions 而不经 set_current_map_name，会绕过 map_name_utils 的约定（如 map_name/current_map、事件通知等）。
4. **路径假设**：current_dir = parent.parent.parent 假定 __file__ 在 controller/d4func/ 下；若文件移动，sys.path 与 pycore 路径会错。CnOCR 通过临时文件调用 ocr(temp_path)，若临时目录无写权限会失败。
5. **max_recognition_attempts 后重置**：达到最大尝试次数后会清 is_post_switch_idle 与 recognition_attempts；若调用方依赖「一直保持 idle 直到识别成功」，会与当前「最多试 N 次就放弃」行为不符。
6. **I18nManager 实例**：构造了 self.i18n 但当前代码未使用；若后续用 i18n 做日志或 UI 文案，需与 i18n_skill_config 等 key 一致；删除 self.i18n 若他处无引用则无影响。

### 3.3 正确做法

- 保证 detected_regions.region_images 的 key 与 D4 标准区域名一致（'Map Name'）；调用方在「地图切换完成、已设 is_post_switch_idle」后再调 recognize_map_name。
- 地图名写入统一通过 map_name_utils.set_current_map_name，不直接改 d4_data.detected_regions 的 map 相关字段；与 map_name_utils、game_state_events 等约定一致。
- 路径与 pycore 依赖保持与项目根、controller/d4func 位置一致；若项目结构调整需同步改 current_dir 与 pycore 路径。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 Flow-master 引用 flow_bn_only_state、把 B1..B16 状态放进 bn_only_state、改 ui.utils 导出未同步、map_name_recognizer 的 region key 或 set_current_map_name 使用错误）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
