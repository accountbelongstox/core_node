# YOLO 统一目录设计（含生成数据、训练数据、补丁图）

以 **YOLO_DATA_ROOT** 为唯一根，所有 YOLO 相关目录（录制、标注、补丁图、生成数据集、训练用数据集、模型输出）均在此根下，层级与文件结构统一。

---

## 1. 统一根与顶层分区

- **唯一根**：`YOLO_DATA_ROOT`（环境变量或配置，默认 `D:\programing\yolo_data`）。

- **顶层分区**（根下仅以下四类 + 项目树）：
  - **项目树**：`{client_type}/{project_name}/` — 录制、标注、单段训练、补丁图。
  - **生成数据**：`_generated/` — 截图/标注一次性导出的数据集（含 train/val）。
  - **训练用数据集**：`_datasets/` — 处理好的 detection/classification 数据集（供训练读）。
  - **模型输出**：`_models/` — 训练得到的权重与推理用目录。
  - **合成用源**：`_sources/` — 补丁图、共享背景图等（合成检测/分类数据用）。

---

## 2. 项目树：完整目录与文件结构（含补丁图）

路径：`{YOLO_DATA_ROOT}/{client_type}/{project_name}/`

```
{client_type}/                    # d3_game | d4_game | battlenet
  {project_name}/                 # 项目名，一个文件夹一个项目
    # ---------- 项目级（多段共用） ----------
    annotator_config.json         # 项目名、类别列表 classes；标注器与流程共用
    patch_data.json               # 补丁图多源：sources: [{ base_dir, items: [{ file, class }] }]
    patch_images/                 # 项目级补丁图目录（通常 base_dir 指这里）
    #   *.png, *.jpg              # 单张补丁图，patch_data 中 file 为相对 base_dir 或绝对路径
    #
    # ---------- 段（每个录制段一个目录） ----------
    {segment_id}/                 # 如 seg_0_20250101_120000
      record/                     # 原始录制（GameAISDK 写入）
      #   video.avi
      #   *.jpg                   # 设备直出图片（若有）
      frames/                     # 导出的帧，用于标注
      #   frame_000000.png
      #   frame_000000.json       # 每图对应标注（shape_type, label, points）
      #   frame_000000.xml        # VOC XML（可选，矩形时）
      #   frame_000000.txt        # YOLO 标签（可选）
      images/                     # 训练用图片（与 Ultralytics 一致）
      #   *.png, *.jpg
      labels/                     # 训练用标签
      #   *.txt                   # YOLO 格式，与 images 同名
      data.yaml                   # Ultralytics 数据集配置（path/train/val/names）
    {segment_id}/
      ...
```

**说明**：
- **补丁图**：`patch_data.json` 与 `patch_images/` 在项目级；多源时 `base_dir` 可指向 `patch_images/` 或外部目录，由 patch_data 管理。
- **段内**：`record/` 仅原始数据；`frames/` 为标注与导出帧；`images/`、`labels/`、`data.yaml` 为训练用，与 Ultralytics 一致。

---

## 3. 生成数据（_generated）：一次性导出的数据集

路径：`{YOLO_DATA_ROOT}/_generated/{client_type}/yolo_dataset_YYYYMMDD_HHMMSS/`  
（或 `_generated/yolo_dataset_YYYYMMDD_HHMMSS/` 若不分 client_type）

来源：截图 + 标注后「生成数据集」、或标注窗口内「Generate YOLO dataset」一次性导出（含 train/val 划分）。

```
_generated/
  {client_type}/                  # 可选，按客户端分
    yolo_dataset_20250120_143052/
      images/
        train/
        #   *.png
        val/
        #   *.png
      labels/
        train/
        #   *.txt
        val/
        #   *.txt
      data.yaml                   # path/train/val/names，供训练直接使用
      _staging/                   # 生成过程临时文件（可清理）
```

---

## 4. 训练用数据集（_datasets）：处理好的 detection/classification

路径：`{YOLO_DATA_ROOT}/_datasets/{namespace}/{dataset_name}/`

供 UnifiedTrainer、validate、训练脚本等读取；与现有 2_datasets 语义一致，只是根改为 YOLO_DATA_ROOT。

```
_datasets/
  detection/                      # 检测
    {dataset_name}/               # 如 unified_model
      images/
      labels/
      data.yaml
  classification/                # 分类
    {dataset_name}/
      ...
```

---

## 5. 模型输出（_models）：训练得到的权重与推理目录

路径：`{YOLO_DATA_ROOT}/_models/{namespace}/{project_or_run_name}/`

与现有 3_models 语义一致，根改为 YOLO_DATA_ROOT。

```
_models/
  detection/
    {project_or_run_name}/
      weights/
      #   best.pt, last.pt 等
  classification/
    {project_or_run_name}/
      ...
```

---

## 6. 合成用源（_sources）：补丁图与共享背景（1_sources 迁入）

路径：`{YOLO_DATA_ROOT}/_sources/`

用于「用补丁图 + 背景合成检测/分类数据」的流程；与 migrate_structure 的 1_sources 对应，统一到同一根下。

```
_sources/
  projects/                       # 按项目/任务分的补丁图（可与项目树 patch_images 同源或独立）
    {project_id}/                # 如 cancel_button, rift_progress_bar
      patch_images/
      #   *.png
  shared/
    backgrounds/                 # 共享背景图
    #   *.jpg, *.png
```

说明：项目树里的 `{client_type}/{project_name}/patch_images/` 是「标注/录制项目自带的补丁图」；`_sources/projects/` 下可以是同一批图或专门用于合成任务的副本，由训练配置引用。

---

## 7. 全根下目录与文件总览（仅列结构）

```
YOLO_DATA_ROOT/
├── {client_type}/               # 项目树
│   └── {project_name}/
│       ├── annotator_config.json
│       ├── patch_data.json
│       ├── patch_images/
│       └── {segment_id}/
│           ├── record/
│           ├── frames/
│           ├── images/
│           ├── labels/
│           └── data.yaml
├── _generated/                  # 生成数据（截图/标注一次性导出，含 train/val）
│   └── {client_type}/
│       └── yolo_dataset_YYYYMMDD_HHMMSS/
│           ├── images/train/, images/val/
│           ├── labels/train/, labels/val/
│           └── data.yaml
├── _datasets/                  # 训练用数据集（2_datasets 语义）
│   ├── detection/{dataset_name}/
│   └── classification/{dataset_name}/
├── _models/                    # 模型输出（3_models 语义）
│   ├── detection/{run_name}/
│   └── classification/{run_name}/
└── _sources/                   # 合成用源（1_sources 语义）
    ├── projects/{project_id}/patch_images/
    └── shared/backgrounds/
```

---

## 8. 关键文件格式（约定）

| 文件 | 位置 | 用途 |
|------|------|------|
| annotator_config.json | 项目根 | project_name, classes；标注器与流程共用 |
| patch_data.json | 项目根 | sources: [{ base_dir, items: [{ file, class }] }]；补丁图多源 |
| data.yaml | 段根 或 _generated/… 或 _datasets/… | Ultralytics：path, train, val, names（及 nc） |
| VOC XML / JSON / .txt | 段 frames/ 或 labels/ | 每图标注；训练前统一到 images/ + labels/ + data.yaml |

---

## 9. 与当前实现的对应关系

| 当前（旧） | 统一后（新） |
|------------|--------------|
| YOLO_RECORD_BASE_DIR = d3-check/data/yolo_record | 项目树 = YOLO_DATA_ROOT/{client_type}/{project_name} |
| project_path/output/seg_xxx（record + frames） | segment_path = project_path/{segment_id}；record/、frames/ 在段内 |
| 项目级 patch_images、patch_data.json | 仍在项目根；路径 = YOLO_DATA_ROOT/…/project_name/patch_images、patch_data.json |
| YOLO_DATASET_BASE_DIR/yolo_dataset_*（生成数据） | YOLO_DATA_ROOT/_generated/…/yolo_dataset_YYYYMMDD_HHMMSS/ |
| .cache/training_data/2_datasets、3_models | YOLO_DATA_ROOT/_datasets、YOLO_DATA_ROOT/_models |
| .cache/training_data/1_sources/projects、shared/backgrounds | YOLO_DATA_ROOT/_sources/projects、_sources/shared/backgrounds |

---

## 10. 小结

- **唯一根**：YOLO_DATA_ROOT。
- **项目树**：录制、标注、单段训练、**补丁图**（patch_data.json + patch_images/）全部在 `{client_type}/{project_name}/{segment_id}/` 及项目级文件。
- **生成数据**：`_generated/` 下 yolo_dataset_*，含 images/train|val、labels/train|val、data.yaml。
- **训练数据**：`_datasets/` 下 detection、classification，供训练脚本与 UnifiedTrainer 使用。
- **模型**：`_models/` 下 detection、classification。
- **合成用源**：`_sources/` 下 projects、shared/backgrounds。

所有目录与文件结构均按上述设计统一，实现时按此改 yolo_record、yolo_data_layout、yolo_dataset_from_annotations、UnifiedTrainer、migrate_structure 及 UI 中的路径常量即可。
