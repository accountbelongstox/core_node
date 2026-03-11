# Annotator 类库分布与统一扩展方案

## 一、Annotator 相关定义所在目录

### 1. 底层实现（pycore，项目外）

| 位置 | 内容 | 说明 |
|------|------|------|
| `pycore.pyutils.image_annotator.ImageAnnotator` | 类 | 绘图后端：`draw_text` / `draw_rectangle` / `draw_line` / `draw_circle` / `draw_polygon` / `draw_grid` / `draw_grid_full` / `draw_image`；`set_image` / `load_image` / `get_image` / `save`。BGR ndarray。 |

### 2. 共用 Helper（d3utils，当前事实上的“总入口”）

| 位置 | 内容 | 说明 |
|------|------|------|
| `d3utils.d3u_common.image_annotator_helper` | 模块（无类，函数 + 单例） | 全项目标注的集中实现；**唯一**持有 pycore `ImageAnnotator` 单例并对外提供工厂与各类绘制/保存封装。 |

**image_annotator_helper 提供的 API：**

- **单例与工厂**
  - `get_pycore_image_annotator()` → 全项目唯一 `ImageAnnotator` 实例
  - `create_annotator(image_source)` → 对单例做 `load_image`/`set_image` 后返回（支持 str/Path、ndarray、PIL）
- **常量**
  - `ANNOTATION_COLORS`（BGR 名→元组）
  - `COLOR_SEQUENCE`（自动上色顺序）
- **工具**
  - `get_annotation_color(name)`, `get_auto_color(index)`
  - `get_tmp_dir()`, `generate_timestamp()`
  - `get_image_pil(annotator)` → BGR 转 RGB PIL
- **绘制**
  - `draw_info_texts`, `draw_grid_overlay`
  - `draw_match_result`, `draw_match_results`
- **保存/调试**
  - `save_match_debug_image`, `save_no_match_debug_image`, `save_click_debug_image`
  - `save_anchor_detection_result`, `save_bag_detection_result`
- **内部**
  - `_draw_bag_layout_grid(annotator, bag_coords, bag_layout)`（D3 背包网格，被 bag_info_collector 等调用）

**d3u_common 包对外导出：**

- `d3utils.d3u_common.__init__` 仅导出 `draw_match_result`，其余均从 `image_annotator_helper` 直接 import。

### 3. D4 控制器侧（controller，对 helper 的领域封装）

| 位置 | 内容 | 说明 |
|------|------|------|
| `controller.d4func.image_annotator.ImageAnnotator` | **类**（与 pycore 同名） | D4 专用：使用 helper 的 `create_annotator`、`get_image_pil`、`ANNOTATION_COLORS`；实现 D4 坐标缩放（含 +31 全屏逻辑）、`annotate_screenshot_with_coordinates`、`save_annotated_image`。通过 `get_image_annotator()` 单例使用。 |

- 与 pycore 的 `ImageAnnotator` 是**不同类**，仅名字相同。
- 依赖：`D4_ANNOTATED_DIR`、`D4_STANDARD_COORDS`、`D4_STANDARD_RESOLUTION_*`、helper 的上述接口。

### 4. 直接使用 pycore.ImageAnnotator 的模块（未统一走 helper）

| 位置 | 用途 |
|------|------|
| `ui/components/coordinate_picker_window.py` | `from pycore.pyutils.image_annotator import ImageAnnotator` |
| `controller/pathfinding_controller.py` | 同上 |
| `providor/common_imports.py` | `from pycore.pyutils.image_annotator import ImageAnnotator` |
| `d3utils/collectors/bag_info_collector.py` | 类型注解用 `ImageAnnotator`，实际绘制仍通过 helper 的 `create_annotator`、`draw_match_result`、`_draw_bag_layout_grid` |

---

## 二、依赖 image_annotator_helper 的调用方（按模块）

| 模块 | 使用的 API |
|------|------------|
| `d3utils.match_debug_notify` | create_annotator |
| `d3utils.collectors.collect_tools.bag_layout_detector` | create_annotator, draw_grid_overlay, get_annotation_color |
| `d3utils.collectors.bag_info_collector` | create_annotator, get_tmp_dir, generate_timestamp, get_image_pil, draw_match_result, _draw_bag_layout_grid |
| `d3utils.collectors.ui_region_collector_optimized` | create_annotator, get_tmp_dir, generate_timestamp |
| `d3utils.collectors.ui_region_collector_ultralytics` | create_annotator, get_tmp_dir, generate_timestamp |
| `d3utils.collectors.ui_region_collector_anchor` | create_annotator, save_anchor_detection_result, get_tmp_dir, generate_timestamp |
| `d3utils.d3_start_game_and_teleport_waiter` | save_click_debug_image |
| `d3utils.battlenet_match_debug` | save_match_debug_image, save_no_match_debug_image |
| `controller.d4func.image_annotator` | create_annotator, get_image_pil, ANNOTATION_COLORS |
| `controller.login_try_screenshot_controller` | save_match_debug_image, save_no_match_debug_image, save_click_debug_image |
| `d4utils.d4_window_region_detector` | create_annotator, get_image_pil, ANNOTATION_COLORS |
| `d4utils.d4_team_health_detector` | create_annotator, get_image_pil, get_annotation_color |
| `scripts.template_matcher_test` | create_annotator, draw_match_results, draw_info_texts, get_annotation_color, get_auto_color |
| `scripts.test_left30_match` | create_annotator, draw_match_result, get_annotation_color |

---

## 三、如何扩展成“一个总的”Annotator

### 现状小结

- **唯一实现集中地**：`d3utils.d3u_common.image_annotator_helper`（单例 + 所有 draw/save 封装）。
- **两处“ImageAnnotator”名字**：pycore 的类（底层）、d4func 的类（D4 领域封装）。
- **多处目录**：pycore（外部）、d3u_common（helper）、d4func（D4 封装）、以及直接引用 pycore 的 ui/controller/providor。

### 扩展为“统一入口”的几种方式

**方案 A：保持 helper 为唯一实现，仅做“统一入口”导出（推荐、改动最小）**

- 在 `d3utils.d3u_common.__init__.py`（或新建 `d3utils.annotator`）中**集中再导出**所有对外需要的 annotator API，形成单一 import 来源，例如：
  - `from d3utils.d3u_common import create_annotator, get_image_pil, get_annotation_color, get_auto_color, draw_match_result, draw_match_results, ANNOTATION_COLORS, ...`
- 各调用方逐步从 `from d3utils.d3u_common.image_annotator_helper import ...` 改为从统一入口 import。
- D4 的 `controller.d4func.image_annotator.ImageAnnotator` 保持为**领域层**，仅依赖该统一入口（或继续直接依赖 helper），必要时改名为 `D4ImageAnnotator` 避免与 pycore 类名混淆。

**方案 B：统一门面类（Facade）**

- 新建一层，例如 `share.image_annotator` 或 `d3utils.annotator`，提供：
  - 一个门面类或命名空间，方法委托到 `image_annotator_helper` 的现有函数；
  - 同一套 API：create、get_image_pil、colors、draw_*、save_* 等。
- 新代码只依赖该门面；旧代码可逐步迁移。以后若更换底层（例如不用 pycore 单例），只改门面内部即可。

**方案 C：把 helper 收拢为一个“总类”**

- 将 `image_annotator_helper` 中的单例 + 所有函数改为一个类（如 `UnifiedAnnotator` 或 `ImageAnnotatorHelper`）的实例方法/类方法。
- 对外只暴露：`get_annotator()` 单例 + 该类的静态/模块级方法（例如 `create_annotator(image_source)` 仍为入口，内部用单例）。
- D4 的 `ImageAnnotator` 改为继承或组合该类，仅增加 D4 坐标与保存路径逻辑。

### 建议优先顺序

1. **短期**：采用**方案 A**，在 `d3u_common.__init__.py` 中显式导出完整 annotator API（含 create_annotator、get_image_pil、ANNOTATION_COLORS、draw_*、save_*、get_tmp_dir、generate_timestamp 等），并在文档中注明“所有 annotator 能力均由此入口获取”。
2. **中期**：将 `controller.d4func.image_annotator` 中的类改名为 `D4ImageAnnotator`，避免与 pycore 的 `ImageAnnotator` 混淆；D4 模块继续只依赖 d3u_common 的同一套 API。
3. **可选**：需要更强边界时再引入**方案 B** 的门面，或**方案 C** 的“总类”，便于以后替换底层或做多后端支持。

---

## 四、文件清单（便于 grep / 重构）

- **定义**
  - `pycore/pyutils/image_annotator.py`（若在仓库内）或 pycore 包
  - `pyapps/d3-check/d3utils/d3u_common/image_annotator_helper.py`
  - `pyapps/d3-check/controller/d4func/image_annotator.py`
- **包导出**
  - `pyapps/d3-check/d3utils/d3u_common/__init__.py`（当前只导出 draw_match_result）
- **调用方**（见上表；grep 关键词：`create_annotator`、`get_image_pil`、`image_annotator_helper`、`ImageAnnotator`）
