# YOLO 训练数据采集 — 设计方案

## 1. 目标与范围

在**坐标效准面板**（TABLE5）中，在现有「拾取坐标 / 清除历史 / 导出JSON / 坐标历史记录」旁增加 **「YOLO训练数据采集」** 功能：

- 根据当前**客户端类型**（战网 / D3 / D4）对目标窗口截图。
- 在标注窗口中用**矩形、圆、多边形、自由绘制**对目标进行标注，并支持**多类别**（可动态创建）。
- 支持**刷新截图**、**多张截图**采集，截图与标注保存为**历史**。
- 从历史生成 **YOLO 格式数据集**（目录 `D:\applications\GameTools\Yolo\yolo_dataset_YYYYMMDD_HHMMSS`），**类别平衡**划分 train/val，并生成**训练命令**。

---

## 2. UI 布局与入口

### 2.1 入口位置

- **文件**: `pyapps/d3-check/ui/panels/coordinate_calibration_panel.py`
- **位置**: `_create_control_panel()` 中，在「导出JSON」按钮后增加按钮 **「YOLO训练数据采集」**。
- **行为**: 点击后与「拾取坐标」一致：按当前 `current_client_type` 调用同一套截图逻辑（`WindowScreenshot` + `WINDOW_TITLES_MAP` / `get_d3_manager().get_capture_titles()` 等），成功后**不**打开 `CoordinatePicker`，而是打开 **YOLO 标注窗口**（新组件）。

### 2.2 i18n

- 在 `providor/i18n/i18n_tabs_zh.json` 与 `i18n_tabs_en.json` 的 `ui.coord_calibration` 下增加：
  - `yolo_collect_button`: 中文「YOLO训练数据采集」，英文 "YOLO Training Data Collection"

---

## 3. YOLO 标注窗口

### 3.1 职责

- 展示当前**客户端**的一张截图，支持在其上做**多目标、多类别**的 bbox 标注（矩形 / 圆 → 统一转为 YOLO 所需 bbox）。
- **类别**可动态增删，标注时先选当前类别再画框。
- 支持**刷新截图**（再次截当前客户端），刷新前将「当前图 + 当前标注」写入**历史**，再清空画布加载新图。
- 支持在**历史截图列表**中切换，查看/编辑某张图的标注。
- 提供**生成数据集**：把当前会话所有「截图 + 标注」导出到 `D:\applications\GameTools\Yolo\yolo_dataset_YYYYMMDD_HHMMSS`，并生成训练命令。

### 3.2 与拾取坐标的复用关系

| 能力           | 拾取坐标 (CoordinatePicker)     | YOLO 标注窗口                         |
|----------------|----------------------------------|----------------------------------------|
| 截图来源       | 同：客户端类型 + WindowScreenshot | 同                                     |
| 画布与缩放     | 大图 + scale_factor + 坐标换算   | **复用**：同一套 canvas/缩放/点击换算   |
| 形状           | point / rect / circle            | **rect / circle / polygon / freehand**（polygon/freehand 存顶点，导出时转 bbox） |
| 每项数据       | type, x, y, (width, height \| radius), name | **+ class_id / class_name**，其余同   |
| 历史           | 主面板 pick_history（单列表）    | **按截图分组的 history**：每项 = 一图 + 该图标注列表 |
| 回调           | on_picks_updated(picks)           | 无需回写到主面板；内部维护「截图历史」  |

建议：**新建** `YoloAnnotationWindow`（或 `YoloCollectorWindow`），在 `ui/components/` 下。内部可复用：

- `WindowScreenshot`、客户端类型与窗口标题解析（与 `CoordinateCalibrationPanel` 一致）。
- 画布展示与坐标换算逻辑（可从 `CoordinatePicker` 抽成小函数或直接抄写：`scale_factor`, `canvas_offset_x/y`，原图坐标 `x = (event.x - offset_x) / scale`）。
- 矩形/圆的绘制与两次点击完成（rect：两点；circle：圆心 + 边上一点）。

不直接复用 `CoordinatePicker` 的原因：数据模型不同（多类别、按图分组历史）、无模板匹配、无「完成/同步到主面板」而改为「刷新截图 / 生成数据集」等。

### 3.3 窗口布局（左侧菜单 + 右侧画布）

- **左侧**（固定宽度）：
  - **类别**
    - 列表：当前类别名（如 `d3_bag`, `progress_bar`），可点击选中为「当前标注类别」。
    - 按钮「添加类别」：弹输入框，追加到列表并设为其 class_id（0, 1, 2, …）。
    - 可选：删除/重命名类别（至少保留 1 个）。
  - **标注形状**：矩形 / 圆形 / 多边形（点击加点、闭合或双击结束）/ 自由绘制（拖拽、松手闭合）。
  - **当前图标注列表**：当前显示的这张图上的 bbox 列表（ID、类别名、类型、坐标简写），支持选中删除/编辑。
  - **操作**
    - **刷新截图**：保存当前图+标注到历史 → 重新调用截图 → 清空当前标注并显示新图。
    - **生成数据集**：校验至少 1 张图、每类至少若干框（可配置或仅提示）→ 打开生成逻辑（见下）→ 弹结果（路径 + 训练命令）。
  - **历史截图**：列表/缩略图，每项显示「缩略图或序号 + 标注数」。点击切换当前显示图并加载其标注，可编辑。

- **右侧**：与 CoordinatePicker 一致的大画布，显示当前截图；按当前形状（矩形/圆/多边形/自由绘制）和当前类别添加标注，矩形/圆两次点击完成，多边形点击加点+闭合/双击结束，自由绘制拖拽松手闭合；实时预览线条。

### 3.4 数据模型（内存）

- **class_names**: `List[str]`，如 `["d3_bag", "progress_bar"]`，下标即 class_id。
- **screenshot_history**: `List[Dict]`，每项：
  - `image`: PIL.Image 或临时路径（若存盘）；建议统一为 PIL 便于画布展示。
  - `annotations`: `List[Dict]`，每条：
    - `class_id`: int
    - `class_name`: str（冗余，便于展示）
    - `type`: "rect" | "circle" | "polygon"
    - rect: `x`, `y`, `width`, `height`
    - circle: `x`, `y`, `radius`（圆心 + 半径，导出时转 bbox）
    - polygon: `vertices`（顶点列表 `[[x,y], ...]`，导出时用顶点 min/max 转 bbox）
  - `timestamp` 或 `id`：便于列表显示。
- **current_index**: 当前显示的是 `screenshot_history[current_index]`；当前图的标注即 `screenshot_history[current_index]["annotations"]`。

### 3.5 坐标与 YOLO 格式

- 画布得到的为**原图像素坐标**：
  - rect: `x, y, width, height`（左上 + 宽高）
  - circle: `cx, cy, radius` → 导出时转为 bbox：`x = cx - r`, `y = cy - r`, `width = 2*r`, `height = 2*r`
  - polygon / freehand: `vertices`（顶点列表）→ 导出时用顶点 `min(x)`, `min(y)`, `max(x)-min(x)`, `max(y)-min(y)` 得到 bbox
- YOLO 标注格式（每行一个目标）：`class_id cx cy nw nh`（归一化 0~1，6 位小数）。  
  `cx = (x + width/2) / img_w`, `cy = (y + height/2) / img_h`, `nw = width/img_w`, `nh = height/img_h`。

---

## 4. 数据集生成逻辑

### 4.1 输入

- 当前会话的 `screenshot_history` + `class_names`。
- 每张图的 `annotations` 中：rect 已是 (x,y,w,h)；circle 转为 (x,y,w,h)；polygon/freehand 用顶点 min/max 转为 (x,y,w,h)，再参与后续步骤。

### 4.2 输出目录结构

- 根目录：`D:\applications\GameTools\Yolo\yolo_dataset_YYYYMMDD_HHMMSS`（由 `providor.app_constants.YOLO_DATASET_BASE_DIR` + 时间戳子目录构成）。
- 目录结构：
  - `images/train/`、`images/val/`
  - `labels/train/`、`labels/val/`
  - `data.yaml`

### 4.3 类别平衡与 train/val 划分

- 目标：**两边数据相当**（train 与 val 的图片数、每类框数尽量均衡）。
- 做法（二选一或组合）：
  - **按图划分**：每张图要么全在 train 要么全在 val。按「每张图所含类别分布」做分层：例如先统计每张图各类别数量，再尽量使 train/val 中各类别总框数比例接近（如 80% / 20%）。
  - **简单实现**：按图片随机 80/20 划分，再检查各类别在 train/val 中是否都有；若某类只在一边有，则把少量该类的图从多的那边挪到少的一边，直到两边都有且比例大致 8:2。
- 划分完成后：将对应图片复制到 `images/train` 或 `images/val`；**仅当该图至少有一个目标时**在 `labels/train` 或 `labels/val` 下写入同名 `.txt`（无目标则不写 .txt，符合 Ultralytics 约定）。每行 `class_id cx cy nw nh`（归一化 0~1，6 位小数）。

### 4.4 data.yaml（与 Ultralytics 官方格式一致）

- `path`: 数据集根目录绝对路径，使用**正斜杠**（`Path.resolve().as_posix()`），便于跨平台与 Ultralytics 解析。
- `train`: `images/train`
- `val`: `images/val`
- `nc`: len(class_names)
- `names`: **字典** `{0: "class0", 1: "class1", ...}`，与官方 `check_det_dataset` 及文档约定一致。

### 4.5 训练命令生成

- 参考 `ui_region_collector_ultralytics.py` 的 `train()`：`YOLO("yolov8n.pt")` + `model.train(data=data_yaml_path, ...)`。
- 生成一条可复制命令或脚本，例如：
  - `python -m ultralytics train model=yolov8n.pt data=<path>/data.yaml epochs=50 imgsz=640 batch=16 device=cuda`
  - 或项目内封装调用（如 unified_trainer / detection_trainer）的等效参数。
- 在 UI 上「生成数据集」完成后弹窗显示：**数据集路径** + **训练命令**（可复制）。

### 4.6 实现位置

- **新模块**：`pyapps/d3-check/d3utils/yolo_dataset_from_annotations.py`（或放在 `pycore/pyutils/ultralytics/` 下作为「由 UI 标注生成数据集」的通用小库）。
- 函数签名建议：
  - `generate_yolo_dataset(screenshot_history: List[Dict], class_names: List[str], output_dir: Path, train_ratio: float = 0.8) -> Dict`
  - 返回：`{ "output_dir", "data_yaml_path", "train_count", "val_count", "class_counts_train", "class_counts_val" }`，便于 UI 显示与生成训练命令。

---

## 5. 流程小结

1. 用户在坐标效准面板选择客户端类型（战网/D3/D4），点击 **「YOLO训练数据采集」**。
2. 按当前客户端截图；成功则打开 **YOLO 标注窗口**，显示该截图。
3. 用户添加类别（至少 1 个），选择矩形/圆，在图上标注多个目标；可多次「刷新截图」截新图，每次刷新前当前图+标注写入历史。
4. 在历史中可切换不同截图并继续编辑标注。
5. 点击「生成数据集」：将当前会话所有截图与标注写入 `D:\applications\GameTools\Yolo\yolo_dataset_YYYYMMDD_HHMMSS`，做类别平衡的 train/val 划分，生成 `data.yaml` 与训练命令并展示。

---

## 6. 涉及文件与依赖

| 类型     | 路径 |
|----------|------|
| UI 入口  | `ui/panels/coordinate_calibration_panel.py`：增加按钮、调用截图 + 打开 YOLO 标注窗口 |
| 新组件   | `ui/components/yolo_annotation_window.py`：YOLO 标注窗口（画布、类别、历史、刷新、生成数据集） |
| 数据集生成 | `d3utils/yolo_dataset_from_annotations.py`：调用 pycore `annotation_to_yolo_dataset.generate_yolo_dataset`，输出目录为 `YOLO_DATASET_BASE_DIR`（`D:\applications\GameTools\Yolo`）/ `yolo_dataset_YYYYMMDD_HHMMSS` |
| i18n     | `providor/i18n/i18n_tabs_zh.json`, `i18n_tabs_en.json`：yolo_collect_button 等 |
| 常量     | `providor.app_constants.YOLO_DATASET_BASE_DIR` = `D:\applications\GameTools\Yolo` |
| 复用     | `WindowScreenshot`、客户端类型/标题（与 coordinate_calibration_panel 一致）；画布坐标换算与 rect/circle 绘制逻辑参考 `coordinate_picker_window.py` |

不依赖 `prepare_detection_training.py` 的「小图贴大图」流程；本方案是**真实截图 + 人工 bbox** 直接导出为 YOLO 格式。`DetectionDatasetGenerator`（dataset_generator_yolo）是「从已有大图+坐标生成合成图」的另一种管线，本功能不直接调用，仅参考其 `data.yaml` 与标注格式。

---

## 7. 可选增强

- **导入已有标注**：支持从某次导出的 JSON 或已有 `images+labels` 目录重新加载到历史，便于续标。
- **导出 JSON**：将当前会话的 screenshot_history（含 base64 或路径 + annotations）导出，便于备份或二次处理。
- **point 作为小矩形**：若保留「点」选项，可转为固定小框（如 2×2 或 5×5）写入 YOLO，便于点状目标。

以上为 YOLO 训练数据采集的完整设计方案，可直接按此实现开发。

---

## 8. 开发细节（已实现）

### 8.1 临时目录（会话目录）

- **显示**：窗口左侧顶部有「临时目录」输入框，只读显示当前会话目录路径（可选中复制；绑定 `<Key>` 拦截输入，点击可全选）。
- **创建**：打开标注窗口时，若主 CONFIG 中 `yolo_collect.session_dir` 存在且对应目录存在则复用，否则新建 `YOLO_DATASET_BASE_DIR / yolo_dataset_YYYYMMDD_HHMMSS` 并 `mkdir(parents=True, exist_ok=True)`。
- **配置落盘**：该目录下写入：
  - `yolo_collect_config.json`：`session_dir`、`classes`（含 name、color）、`updated`；类别名/颜色修改后立即写入，并调用 `set_config_value_async("yolo_collect", {...})` 同步到主 CONFIG。
  - `current_subdataset.json`：当前子训练集快照（图片数、每图标注数、class_names、updated）；在追加截图、增删标注、生成数据集后更新。
- **生成数据集**：点击「生成数据集」时，将本次会话的数据写入**当前会话目录**（即该临时目录），不再新建时间戳目录；`d3utils.yolo_dataset_from_annotations.generate_dataset_from_screenshot_history(..., output_dir=session_dir)`。

### 8.2 识别类型（类别）

- **列表展示**：左侧「识别类型」为可滚动列表（Canvas + 内层 Frame），每行 = 色块（约 2 字符宽）+ 类别名称；色块使用该类别分配的颜色（与画布绘制一致）。
- **点击编辑**：点击类别**名称**即进入内联编辑（表单式）：该行名称区替换为 Entry，预填当前名称并全选，按 Enter 或失焦立即保存并恢复 Label 显示，同步到 `yolo_collect_config.json` 与主 CONFIG；取消编辑时保留原名称。
- **选中当前类别**：点击行或色块可选中为「当前标注类别」；选中行背景高亮（bg_tertiary）。标注时使用 `_selected_class_index` 即当前选中类别的 `class_id`。
- **颜色分配（程序化，非固定列表）**：每个类别对应一种颜色，**不**使用固定色表，而是按**色区递增**在 HSV 空间生成，保证数量足够且区分度合理：
  - 实现：`providor.app_constants.get_yolo_collect_class_color(index: int) -> str`。
  - 算法：HSV 中 **H（色相）** 在区间 `[YOLO_COLLECT_HUE_MIN, YOLO_COLLECT_HUE_MAX]`（默认 0°～360°）内按步长 `YOLO_COLLECT_HUE_STEP`（默认 17°）递增并取模，**S、V** 固定为 `YOLO_COLLECT_SATURATION`、`YOLO_COLLECT_VALUE`（如 0.85、0.95）以保证鲜艳可见；再用 `colorsys.hsv_to_rgb` 转成 RGB 并格式化为 `#RRGGBB`。
  - 槽位数：`n_slots = max(1, int((h_max - h_min) / step))`，第 `index` 个类别使用 `h = (h_min + (index % n_slots) * step) % 360`，因此类别数再多也可循环得到不同色相，且同一 index 始终得到同一颜色。
- **画布绘制**：矩形/圆的边框使用该标注的 `class_id` 对应颜色绘制（与列表色块一致）；颜色来自 `class_colors[class_id]` 或 `get_yolo_collect_class_color(class_id)` 兜底。

### 8.3 标注列表与「图」列

- **列结构**：表格列为「图」「Class」「Type」「Coords」。「图」列表示该标注属于第几张截图（1-based），便于后续生成与核对。
- **叠加显示**：标注列表**不做**「仅当前图」过滤，而是**叠加**显示所有截图上的所有标注；每一行带有所属图片序号（图 1、图 2、…），方便统一查看与生成。
- **删除**：在列表中选中某行后按 Delete，从对应截图条目的 `annotations` 中移除该条。实现方式：Treeview 每行的 item id 设为 `img{img_idx}_ann{ann_idx}`，删除时解析出 `(img_idx, ann_idx)`，从 `screenshot_history[img_idx]["annotations"]` 中 `pop(ann_idx)`，再刷新列表与画布（若被删的是当前图则重绘画布）。

### 8.4 刷新截图行为

- **不清空、不覆盖**：点击「刷新截图」时，不清空已有标注列表；当前截图及其标注已保存在 `screenshot_history[current_index]` 中。
- **叠加**：新截图作为新条目 `screenshot_history.append({...})` 追加到历史，新图标注列表初始为空，用户可在新图上继续标；左侧标注列表为**叠加**展示所有图的标注（见 8.3），因此刷新后新图标注会随追加而出现在列表中，并带「图」列序号。

### 8.5 涉及常量与配置键

- **常量与函数**（`providor.app_constants`）：
  - `YOLO_DATASET_BASE_DIR`：`D:\applications\GameTools\Yolo`
  - 类别颜色（程序化，非固定列表）：
    - `YOLO_COLLECT_HUE_MIN`、`YOLO_COLLECT_HUE_MAX`：色相范围（度），默认 0、360。
    - `YOLO_COLLECT_HUE_STEP`：色相步长（度），默认 17，在色区内递增以得到足够多可区分颜色。
    - `YOLO_COLLECT_SATURATION`、`YOLO_COLLECT_VALUE`：饱和度与明度，默认 0.85、0.95。
    - `get_yolo_collect_class_color(index: int) -> str`：根据类别索引返回十六进制颜色，供类别色块与画布边框使用；类别数任意多时仍可循环色区得到不同色相。
- **主 CONFIG 键**：`yolo_collect`（dict），含 `session_dir`（str）、`classes`（list of `{name, color}`）；通过 `get_config_value_safe` / `set_config_value_async` 读写。

### 8.6 数据集生成接口

- **d3utils**：`generate_dataset_from_screenshot_history(screenshot_history, class_names, train_ratio=0.8, output_dir=None)`。  
  - 若传入 `output_dir`（如 `session_dir`），则直接在该目录下生成 `images/train`、`images/val`、`labels/...`、`data.yaml`；不传则新建 `yolo_dataset_YYYYMMDD_HHMMSS`。
- **pycore**：`annotation_to_yolo_dataset.generate_yolo_dataset(entries, class_names, output_dir, ...)`，支持 `entry["image"]`（PIL）或 `entry["image_path"]`；annotation 支持 `type`: `rect` | `circle` | `polygon`（polygon 含 `vertices`，导出时转 bbox）。写入 YOLO 格式与 `data.yaml`。

### 8.7 与 Ultralytics 官方格式对齐

- **目录与路径**：`path` 下 `images/train`、`images/val` 为图像目录，`labels/train`、`labels/val` 为标签目录；`train`/`val` 相对 `path`，与官方 `img2label_paths`（images → labels、扩展名 → .txt）一致。
- **data.yaml**：必选键 `path`、`train`、`val`、`names` 或 `nc`；`names` 与 `nc` 同时存在时 `len(names) == nc`；`names` 为字典 `{0: name0, ...}`；`path` 使用正斜杠。
- **标签文件**：每行 `class_id cx cy width height`，归一化 0~1、6 位小数；**仅对有至少一个目标的图像**写入对应 `.txt`，无目标图像不写 .txt（符合官方「no .txt file is required」）。
- **类别**：class_id 从 0 开始；坐标导出前做 clip 到 [0,1]，与官方示例一致。
