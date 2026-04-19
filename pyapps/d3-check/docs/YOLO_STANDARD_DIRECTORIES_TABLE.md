# YOLO 标准目录：唯一定义与引用（已与 YOLO_DATA_ROOT 统一）

**“要求放”的 YOLO 根**：项目/录制/标注数据按规定放在 **YOLO_DATA_ROOT** 下（及其 `{client_type}/{project_name}/` 子目录）。与 **YOLO_UNIFIED_DIRECTORY_DESIGN.md**、**ALL_PATH_REQUIREMENTS_TABLE.md** 一致。**旧名 YOLO_RECORD_BASE_DIR**（d3-check/data/yolo_record）已废弃，当前代码与文档均使用 **YOLO_DATA_ROOT**。

---

## 唯一根与定义位置

| 项目 | 内容 |
|------|------|
| **变量名** | **YOLO_DATA_ROOT** |
| **定义位置** | ① `providor/constants/common.py`（Path，用于 YOLO_DATASET_BASE_DIR 等）<br>② `pycore.pyutils.voc_annotator.yolo_data_layout`（若存在）<br>③ `d3utils/yolo_record.py` fallback：pycore 不可用时使用 `providor.constants.common` 或 env 默认 |
| **实际路径** | `os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")` |
| **含义** | 录制/项目/标注/训练统一根；项目树 = `{YOLO_DATA_ROOT}/{client_type}/{project_name}/`，段 = `project_path/{segment_id}/`，内含 record/、frames/、images/、labels/、data.yaml。 |

详见：**docs/ALL_PATH_REQUIREMENTS_TABLE.md**（〇、一、四、六、七）、**docs/YOLO_UNIFIED_DIRECTORY_DESIGN.md**、**docs/YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md** §3.2 / §3.7。

---

## 当前代码引用（YOLO_DATA_ROOT / 相关）

| 文件 | 说明 |
|------|------|
| **providor/constants/common.py** | 定义 `YOLO_DATA_ROOT`（Path）、`YOLO_DATASET_BASE_DIR = YOLO_DATA_ROOT/_generated/d3_game` |
| **d3utils/yolo_record.py** | 从 pycore `yolo_data_layout` 导入 `YOLO_DATA_ROOT`；ImportError 时 fallback 为 providor 或 `os.environ.get(...)`；导出给面板与 flow 使用 |
| **ui/panels/coordinate_calibration_panel.py** | 从 `d3utils.yolo_record` 导入 `YOLO_DATA_ROOT`、`get_default_project_path`、`is_valid_project_path`；标准项目列表 = `YOLO_DATA_ROOT/{client_type}` 下子目录 |
| **d3utils/yolo_train_flow.py** | 使用 yolo_record 的 `get_latest_segment_dir`、`compose_segment_to_frames` 等（均基于 YOLO_DATA_ROOT 布局） |
| **d3utils/yolo_dataset_from_annotations.py** | 使用 `providor.constants.common.YOLO_DATASET_BASE_DIR`（即 YOLO_DATA_ROOT/_generated/d3_game） |
| **ui/components/yolo_annotation_window.py** | 使用 `providor.constants.common.YOLO_DATASET_BASE_DIR` |

结论：**要求放**的 YOLO 根 = **YOLO_DATA_ROOT**；定义与再导出以 **providor** 与 **yolo_record**（及可选 pycore）为准，路径表以 **ALL_PATH_REQUIREMENTS_TABLE.md** 为准。
