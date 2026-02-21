# pycore pyutils：ultralytics 与 voc_annotator 整合方案

本文档梳理 `pycore/pyutils/ultralytics` 与 `pycore/pyutils/voc_annotator` 的职责、数据流与衔接点，并给出整合方案（先文档，后实现）。

---

## 1. 模块职责概览

### 1.1 ultralytics（pycore/pyutils/ultralytics/）

| 能力 | 说明 | 主要入口 |
|------|------|----------|
| 训练 | 分类/检测/分割模型训练（Ultralytics YOLO） | `ClassificationTrainer`, `DetectionTrainer`, `unified_trainer`, `ultralytics_trainer` |
| 数据集生成 | 从「条目列表」生成 YOLO 目录 + data.yaml | `annotation_to_yolo_dataset.generate_yolo_dataset`, `build_train_command` |
| 数据集结构 | 输出目录：`images/train`, `images/val`, `labels/train`, `labels/val`, `data.yaml` | `annotation_to_yolo_dataset` |

- **输入约定**：`generate_yolo_dataset(entries, class_names, output_dir, ...)`  
  - `entries`: 每项含 `image_path` 或 `image` (PIL)，以及 `annotations`: `[{ class_id, type: "rect"|"circle"|"polygon", ... }]`  
  - rect: `x, y, width, height`；circle: `x, y, radius`；polygon: `vertices [[x,y],...]`
- **输出**：Ultralytics 标准布局（train/val 分拆、归一化 [0,1] 的 .txt、data.yaml）。

### 1.2 voc_annotator（pycore/pyutils/voc_annotator/）

| 能力 | 说明 | 主要入口 |
|------|------|----------|
| 标注 UI | PySide6 标注工具，替代 labelImg；支持矩形/多边形/椭圆/圆 | `run_voc_annotator(images_dir, save_dir, config_path, project_name, classes)` |
| 存储格式 | 每图一 JSON（shapes: shape_type, label, points, difficult）；可选同步写 VOC XML（仅矩形） | `annotation_io.load_annotations`, `save_annotations`, `voc_io` |
| YOLO 目录约定 | 项目/片段目录布局、data.yaml 书写 | `yolo_data_layout`: `YOLO_DATA_ROOT`, `get_yolo_data_dir`, `get_yolo_images_dir`, `get_yolo_labels_dir`, `write_data_yaml` |

- **JSON 形状**：`shape_type`: rectangle | polygon | ellipse | circle；`label` 类名；`points` 像素坐标；`difficult` 0/1。
- **yolo_data_layout**：根目录 `YOLO_DATA_ROOT`，片段目录 `{root}/{project_name}/{segment_id}/`，其下 `images/`, `labels/`, `data.yaml`（单 split，无 train/val 子目录）。

---

## 2. 当前数据流与调用关系

### 2.1 标注 → 训练（GameAISDK + d3-check）

1. **Step 3 标注**：d3-check 调用 GameAISDK `yolo_label_lib.launch_labelimg` → 优先启动 **pycore voc_annotator**，否则 labelImg。  
   - 入参：`images_dir`, `save_dir`（常为同一目录或 labels 目录）, `project_name`, `config_path`。  
   - 产出：每图 `.xml`（VOC）+ 可选 `.json`（voc_annotator 全形状）。

2. **Step 4（可选）**：`yolo_label_lib.clean_unlabeled` 清理无标注图/无图标注。

3. **Step 5 VOC → YOLO**：  
   - 检测：`yolo_label_lib.voc_annotations_to_yolo_labels`（VOC XML → YOLO 检测 .txt）。  
   - 分割：`yolo_label_lib.annotations_to_yolo_segment`（voc_annotator JSON → YOLO 分割 .txt，内部用 `voc_annotator.annotation_io.export_yolo_segment_txt`）。

4. **训练**：d3-check / GameAISDK 侧使用片段目录下的 `images/`, `labels/`, `data.yaml`；训练脚本可调用 ultralytics 或自带脚本。  
   - **pycore ultralytics** 的 `generate_yolo_dataset` 当前主要被 **d3-check 内「截图历史 + 应用内标注」** 使用（`d3utils.yolo_dataset_from_annotations`），生成的是「单次导出」的 train/val 目录，而非直接读 voc_annotator 的磁盘结果。

### 2.2 两套目录布局差异

| 来源 | 目录结构 | data.yaml train/val |
|------|----------|----------------------|
| **voc_annotator yolo_data_layout** | `{segment}/images/`, `{segment}/labels/` | 单 split：`train: images`, `val: images` |
| **ultralytics annotation_to_yolo_dataset** | `output_dir/images/train`, `images/val`, `labels/train`, `labels/val` | `train: images/train`, `val: images/val` |

即：voc_annotator 侧是「单段一个 images + 一个 labels」；ultralytics 的生成器是「train/val 分目录」。训练时 Ultralytics 两种都能用（data.yaml 指向即可），但路径和命名需统一约定，否则调用方要区分两套。

---

## 3. 整合目标

- **统一目录与配置**：以 voc_annotator 的 `yolo_data_layout` 为「项目/片段」的权威路径来源；ultralytics 的生成与训练尽量沿用同一布局或显式兼容。
- **打通「标注 → 数据集 → 训练」**：从 voc_annotator 输出（VOC + JSON）到 ultralytics 可用的 YOLO 数据集，有清晰、可复用的路径（含检测与分割）。
- **减少重复与歧义**：格式转换、data.yaml 书写、目录创建集中在一处或明确分工，避免 GameAISDK 与 pycore 各写一套。

---

## 4. 整合方案（建议）

### 4.1 目录与 data.yaml 统一（yolo_data_layout 为基准）

- **片段目录**：继续使用 `yolo_data_layout` 的约定：  
  `{YOLO_DATA_ROOT}/{project_name}/{segment_id}/`  
  其下：`images/`, `labels/`, `data.yaml`。  
- **是否再分子目录**：  
  - **方案 A**：保持当前「单层 images + labels」，训练时 data.yaml 中 `train`/`val` 可同指 `images`（或后续由训练脚本按比例 split）。  
  - **方案 B**：若需与 `annotation_to_yolo_dataset` 的 train/val 子目录一致，可在片段下增加 `images/train`, `images/val`, `labels/train`, `labels/val`，并由「导出/转换」步骤写入；`yolo_data_layout.write_data_yaml` 可扩展参数支持 `train_subdir`/`val_subdir` 为 `images/train`/`images/val`。  
- **建议**：先以方案 A 为主（与现有 GameAISDK/d3-check 流程一致），在文档中明确「训练时可用同一 images/labels」；若后续需要固定 train/val 划分再在转换步骤中写入子目录并扩展 `write_data_yaml`。

### 4.2 格式桥接：voc_annotator 输出 → ultralytics 输入

- **VOC → YOLO 检测**：保持现有 GameAISDK `voc_annotations_to_yolo_labels`；pycore 不重复实现，仅文档说明调用链。  
- **JSON → YOLO 分割**：已由 GameAISDK `annotations_to_yolo_segment` + `voc_annotator.annotation_io.export_yolo_segment_txt` 完成；可考虑在 **pycore** 内提供薄封装，使「仅依赖 pycore」的调用方也能从 voc_annotator 的 JSON 生成 YOLO 分割标签，而不依赖 GameAISDK 仓库路径。  
- **JSON → generate_yolo_dataset 的 entries**：  
  - 在 **pycore** 中新增一函数，例如：  
    `voc_annotator_annotations_to_entries(images_dir, save_dir, class_names) -> list[dict]`  
  - 逻辑：遍历 images_dir 中图片，对每张图读 `annotation_io.load_annotations` 得到 shapes；将 shapes 转为 `annotation_to_yolo_dataset` 所需的 `annotations` 列表（class_id, type, x/y/w/h 或 vertices/radius）；返回 `[{ image_path, annotations }, ...]`。  
  - 这样可直接对接 `generate_yolo_dataset(entries, class_names, output_dir)`，实现「voc_annotator 标注目录 → ultralytics 数据集」一条龙（含 train/val 划分与 data.yaml）。

### 4.3 单入口：从标注目录到可训练数据集（可选）

- 在 **pycore/pyutils/ultralytics/** 或 **pycore/pyutils/** 下提供：  
  `build_yolo_dataset_from_voc_annotator(images_dir, save_dir, class_names, output_dir, train_ratio=0.8, seed=42)`  
- 内部：  
  1. 调用上述 `voc_annotator_annotations_to_entries(images_dir, save_dir, class_names)`；  
  2. 调用 `annotation_to_yolo_dataset.generate_yolo_dataset(entries, class_names, output_dir, train_ratio, seed)`；  
  3. 返回生成结果（路径、数量等）。  
- 这样 d3-check 或其它宿主既可走「GameAISDK Step 5 + 自写 data.yaml」，也可走「pycore 一条龙」，两路输出格式一致（Ultralytics 标准）。

### 4.4 训练命令与 data.yaml 路径

- **build_train_command**：保持使用 `annotation_to_yolo_dataset.build_train_command(data_yaml_path, ...)`。  
- **data.yaml 路径**：  
  - 若采用 yolo_data_layout 的片段目录：`data.yaml` 即 `{segment_dir}/data.yaml`，由 `yolo_data_layout.write_data_yaml` 生成（或由 `generate_yolo_dataset` 生成到 output_dir 后，将 output_dir 设为 segment_dir）。  
  - 文档中明确：训练时传入的 `data.yaml` 必须与 `path` 中目录一致（即 path 为 dataset root，train/val 相对 path）。

### 4.5 依赖关系（整合后）

- **voc_annotator**：仅依赖 PySide6、stdlib、pycore 基础；不依赖 ultralytics 包。  
- **ultralytics**：可依赖 `voc_annotator.annotation_io`、`voc_annotator.yolo_data_layout`（用于「从标注目录构建数据集」和统一路径）；不反向依赖 PySide6。  
- **GameAISDK yolo_label_lib**：继续负责 launch_labelimg（调 voc_annotator）、clean_unlabeled、voc_annotations_to_yolo_labels、annotations_to_yolo_segment；可选地内部改为调用 pycore 的桥接函数，减少重复逻辑。

---

## 5. 实施步骤建议（按顺序）

1. **文档**：本文档定稿，与 DESIGN.md（voc_annotator）、TrainDetModel.md 对齐。  
2. **桥接函数**：在 pycore 中实现 `voc_annotator_annotations_to_entries`（voc_annotator JSON/shapes → entries），并实现 `build_yolo_dataset_from_voc_annotator`（可选）。  
3. **目录与 data.yaml**：在 `yolo_data_layout` 中补充说明与 `annotation_to_yolo_dataset` 的对应关系；若采用方案 B，扩展 `write_data_yaml` 支持 train/val 子目录。  
4. **调用方**：d3-check / GameAISDK 如需「从 voc_annotator 目录直接得到 train/val 数据集」，改为调用上述 pycore 接口；其余流程（Step 3/4/5）可保持不变或逐步迁移到 pycore 实现。  
5. **测试**：用同一批 voc_annotator 输出（VOC + JSON）分别走「GameAISDK Step 5」与「pycore build_yolo_dataset_from_voc_annotator」，对比生成的 labels 与 data.yaml，确认一致或兼容。

---

## 6. 小结

| 项目 | 说明 |
|------|------|
| **ultralytics** | 训练 + 从「内存 entries」生成 YOLO 数据集（train/val + data.yaml）。 |
| **voc_annotator** | 标注 UI + VOC/JSON 存储 + YOLO 目录布局约定（yolo_data_layout）。 |
| **整合点** | 目录以 yolo_data_layout 为基准；通过「JSON → entries → generate_yolo_dataset」桥接；可选单入口 `build_yolo_dataset_from_voc_annotator`。 |
| **与 GameAISDK** | 保留 yolo_label_lib 的 Step 3/4/5；VOC→YOLO 与 JSON→YOLO 分割可逐步与 pycore 桥接统一，避免双份实现。 |

以上为「先写出文档」的整合方案，后续按 5 的步骤落地实现即可。
