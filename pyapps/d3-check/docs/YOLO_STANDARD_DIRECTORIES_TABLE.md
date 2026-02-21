# 要求放的标准目录：唯一定义与全部引用表

**“要求放”的那一个标准目录**：项目/录制数据按规定放在此目录下（及其按 client_type 的子目录）。

---

## 要求放的标准目录（唯一）

| 项目 | 内容 |
|------|------|
| **变量名** | `YOLO_RECORD_BASE_DIR` |
| **定义位置** | `pyapps/d3-check/d3utils/yolo_record.py` 第 **32** 行 |
| **定义代码** | `YOLO_RECORD_BASE_DIR = os.path.join(_D3_CHECK_ROOT, "data", "yolo_record")` |
| **实际路径** | `{d3-check 根}/data/yolo_record`，即 `pyapps/d3-check/data/yolo_record` |
| **含义** | 录制/项目数据的**标准根目录**；其下按 client_type 分子目录（d3_game、d4_game、battlenet），再其下每个子目录为一个项目。 |

---

## 全仓库引用 `YOLO_RECORD_BASE_DIR` 或该目录的位置

| 文件 | 行号 | 说明 |
|------|------|------|
| **d3utils/yolo_record.py** | **32** | **唯一定义**：`YOLO_RECORD_BASE_DIR = os.path.join(_D3_CHECK_ROOT, "data", "yolo_record")` |
| **d3utils/yolo_record.py** | 151 | `_project_path_from_client_type(client_type)`：默认项目路径 = `YOLO_RECORD_BASE_DIR/subdir`（subdir 为 d3_game/d4_game/battlenet） |
| **d3utils/yolo_record.py** | 458 | 将 `YOLO_RECORD_BASE_DIR` 转为 URL 风格路径使用 |
| **ui/panels/coordinate_calibration_panel.py** | 72 | 从 `d3utils.yolo_record` 导入 `YOLO_RECORD_BASE_DIR` |
| **ui/panels/coordinate_calibration_panel.py** | 95 | 无 yolo_record 时：`YOLO_RECORD_BASE_DIR = None` |
| **ui/panels/coordinate_calibration_panel.py** | 758, 761 | `_get_standard_project_paths()`：标准路径 = `YOLO_RECORD_BASE_DIR / client_type`，扫描其下所有子目录作为项目列表 |
| **ui/panels/coordinate_calibration_panel.py** | 777, 779 | `_get_yolo_current_project()`：默认当前项目 = `YOLO_RECORD_BASE_DIR / client_type` |
| **ui/panels/coordinate_calibration_panel.py** | 799 | 新建项目时文件夹选择对话框的 `initialdir` = `YOLO_RECORD_BASE_DIR` |
| **ui/panels/coordinate_calibration_panel.py** | 862 | 下拉列表 = 扫描 `YOLO_RECORD_BASE_DIR/client_type` 下的项目 + 缓存 |

**结论**：全仓库里“要求放”的标准目录就是 **`YOLO_RECORD_BASE_DIR`**，定义在 **`d3utils/yolo_record.py:32`**，路径为 **`{d3-check}/data/yolo_record`**；所有“标准路径下项目”的逻辑都基于该变量。
