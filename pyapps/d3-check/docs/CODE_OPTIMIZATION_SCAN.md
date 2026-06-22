# 代码可优化点扫描报告

## 一、结构 / 分层问题

### 1. d3utils → controller 反向依赖（高优先级）

- **位置**：`d3utils/debug_bag_hover.py` 在 `run_debug_bag_hover()` 内延迟导入  
  `from controller.ctl_func.blacksmith_handler import get_blacksmith_handler`
- **问题**：项目约定为「d3utils / timers 不 import controller」（见 `timers/one_shot_tasks.py`、`d3utils/log_analyzer.py`、`d3utils/d3u_common/hotkey_registry.py` 注释）。debug_bag_hover 违反该约定，形成 **d3utils → controller** 依赖。
- **关联**：`controller/ctl_func/blacksmith_handler.py` 从 `d3utils.debug_bag_hover` 导入 `classify_slot_quality_from_window`，形成 **controller ↔ d3utils** 双向耦合。
- **建议**：
  - 将 `classify_slot_quality_from_window` 抽到**无 controller 依赖**的模块（如 `d3utils/slot_quality.py` 或 `share/` 下仅依赖 share/providor 的模块），blacksmith_handler 与 debug_bag_hover 均从该处引用。
  - 「调试铁匠」时对铁匠 DEBUG 保留/可分解列表的调用，改为由 **controller 注入回调**：面板或 d3_macro_controller 在注册「调试铁匠」时传入 `(shared_data) -> 若 blacksmith 则调用 handle_auto_salvage_by_slots(..., debug_only=True)`，`run_debug_bag_hover` 只接收可选 callback，不再 import controller。

### 2. share 依赖 d3utils（中优先级） — 已做

- **原位置**：  
  - `share/scaled_template_matcher_base.py` → `d3utils.image_matcher_registry`  
  - `share/template_match_debug.py` → `d3utils.d3u_common.image_annotator_helper`
- **已做**：  
  - Base 通过构造函数注入 `get_matcher`、`on_after_match`，不再 import d3utils。D3/D4 matcher 传入 `get_image_matcher_for_method` 与 `d3utils.match_debug_notify.notify_match`。  
  - `share/template_match_debug` 仅保留 queue/push/clear/bgr_array_to_pil，无 d3utils 依赖。`notify_match` 与标注图构建已迁至 `d3utils/match_debug_notify.py`（依赖 image_annotator_helper），由 matcher 的 `on_after_match` 调用。

### 3. 接口检测逻辑两处重复（中优先级） — 已有单一实现

- **现状**：`d3utils/interface_detection.py` 提供 `detect_interface_type_from_full_window(full_image, want_blacksmith, matcher)`，规则（左 30%、模板名、优先级）仅在此维护。`game_assistant_controller` 与 `bag_info_collector` 均已调用该函数。`_image_width` 已改为基于 `isinstance`（ndarray / PIL Image）的代码层判断，无 hasattr。

---

## 二、引用 / 属性访问不合理

### 4. 对已知类型的 getattr/hasattr（按约定应代码层保证）

- **d3utils/kanai/operations.py:68**  
  `getattr(shared_data.bag_layout, "items", None)`  
  - `bag_layout` 类型为 `BagLayout`（见 share/game_interface_data），已声明 `items`。  
  - **建议**：改为 `shared_data.bag_layout.items`，前置条件写为 `if not shared_data.bag_layout: return False`，再使用 `shared_data.bag_layout.items`。

- **d3utils/collectors/collect_tools/bag_layout_detector.py:806**  
  `getattr(self, "original_bag_image", None)`  
  - `original_bag_image` 在同文件 142 行被赋值 `self.original_bag_image = ...`，但类上可能未显式声明。  
  - **建议**：在类上声明 `original_bag_image: Optional[np.ndarray] = None`（或当前实际类型），访问改为 `self.original_bag_image`。

- **d3utils/collectors/bag_info_collector.py:1043–1045**  
  用 `hasattr(game_window_image, "shape")` / `getattr(..., "shape", ())` 和 `hasattr(..., "size")` 区分 PIL 与 ndarray。  
  - **建议**：改为显式类型分支，例如 `if isinstance(game_window_image, np.ndarray): img_width = int(game_window_image.shape[1])`，`elif hasattr(game_window_image, "size")` 且 `isinstance(game_window_image.size, (tuple, list))` 则取 `size[0]`，避免对「已知可能类型」依赖 getattr/hasattr。

### 5. game_assistant_controller 中 hasattr

- **controller/game_assistant_controller.py:51**  
  `w = full_image.size[0] if hasattr(full_image, "size") else full_image.shape[1]`  
  - 与上类似，入参约定为 PIL 或 ndarray 时，可改为 `isinstance` 分支，避免 hasattr。

---

## 三、其他结构 / 可维护性

### 6. 调试铁匠与 run_debug_bag_hover 的职责混合

- **现状**：`run_debug_bag_hover` 既做「背包悬停 + 格子识别 + 存图」，又在 `interface_type == "blacksmith"` 时调用 `handle_auto_salvage_by_slots(..., debug_only=True)`，导致必须从 d3utils 依赖 controller（即第 1 点）。
- **建议**：run_debug_bag_hover 只做「截图 → 用现有 collect 得到 interface_type → 悬停 + 识别 + 存图」；铁匠 DEBUG 列表由上层（面板/controller）在调用 run_debug_bag_hover 前后、根据 shared_data.interface_type 决定是否调用 blacksmith 的 debug_only 接口，或通过传入 callback 由 run_debug_bag_hover 在检测到 blacksmith 时调用（callback 由 controller 注入，d3utils 不 import controller）。

### 7. 常量与魔法数

- **左 30%**：已集中在 `share/scaled_template_matcher_base.py` 的 `LEFT_REGION_RATIO = 0.3`，controller 与 bag_info_collector 中 `0.3` 的注释/日志建议统一引用该常量或注明「与 LEFT_REGION_RATIO 一致」，避免以后只改一处漏改另一处。

### 8. UI / 外部库相关的 getattr

- **ui/components/yolo_annotation_window.py**、**ui/utils/config_binding.py** 等对 widget 的 `getattr(self, "xxx", None)`、`hasattr(widget, "get")` 等：多为兼容多种控件类型或延迟创建控件，属于合理用法；若某处已明确类型，可改为类型注解 + 直接属性访问以利静态检查。
- **d3utils/battlenet_operation.py**、**d3utils/ui_control_operations.py** 等对 UI Automation 控件的 getattr/hasattr：对接外部 COM/UI 接口，保留一定动态性可接受，建议在注释中标明「外部接口，属性非静态保证」。

---

## 四、建议优先顺序

| 优先级 | 项 | 说明 |
|--------|----|------|
| 高 | 1. 消除 d3utils→controller 依赖 | 抽离 classify_slot_quality_from_window + 调试铁匠改为回调注入 |
| 中 | 2. share 不依赖 d3utils | 已做：base 注入 get_matcher/on_after_match，notify 迁至 d3utils/match_debug_notify |
| 中 | 3. 接口检测逻辑单一实现 | 已有：d3utils/interface_detection.py，controller 与 bag_info_collector 共用 |
| 中 | 4. 已知类型去掉 getattr | 部分已做（image_matcher _silent、base center、interface_detection _image_width）；其余见 §4 |
| 低 | 7. 左 30% 常量引用统一 | 文档/注释引用 LEFT_REGION_RATIO |
| 低 | 8. UI/外部接口 getattr | 标注原因，必要时收窄为类型分支 |

---

*扫描范围：pyapps/d3-check（controller、d3utils、share、providor、ui、timers、runtime 等）。*
