# YOLO 数据录制与训练流程

对齐 **GameAISDK doc/YOLO/TrainDetModel.md**、`doc/SDKTool/UIAutoExplore.md`、`Modules/darknetV3/src/scripts/voc_label.py`，在 d3-check 中的实现与待办。

---

## 总览

| 步骤 | 名称 | 说明 | d3-check / GameAISDK |
|------|------|------|----------------------|
| 1 | 准备游戏视频（录制） | 配置录制 → 开始录制 → 停止录制 / 新段 | 已实现：`yolo_record` + GameAISDK RecordSession |
| 2 | 切图 | 视频/段 → 导出为帧图 | 已实现：`compose_segment_to_frames` |
| 3 | 标注 | labelImg 标注，输出 VOC XML；一类表 per 数据集 | TODO：打开目录 + 可选拉起 labelImg；见下文 §步骤3 |
| 4 | 整理（可选） | 删除无标注图、无图 xml（DelUnLabelImg） | TODO：引用 TrainDetModel §4 逻辑 |
| 5 | VOC→YOLO | VOCdevkit + voc_label.py → YOLO txt | TODO：引用 GameAISDK voc_label |
| 6 | 改配置并训练 | voc.names / voc.data / yolov3-voc.cfg + darknet | TODO：引用 GameAISDK darknet |

**项目与标注关系（GameAISDK）**：一个**录制项目** = 一个根路径 → 多个**段**（output/时间戳）。一个**标注数据集** = 一个图片目录 + 一个标注目录（或同目录）+ **一套类别列表**。多段可合并为一个数据集后统一标注，类别表在该数据集内必须一致。

---

## 步骤 1：YOLO 数据录制

- **配置录制**：打开配置对话框，写 `record_cfg.json`（与 GameAISDK Run > Train > Config Record 对齐）。
- **开始录制**：调用 GameAISDK RecordSession（`d3utils.yolo_record.run_gameaisdk_start_record`），需窗口句柄与项目路径。
- **停止录制**：`end_segment` 后 `stop_record`，并可选导出本段帧、打开标注目录。
- **新段**：`end_record_segment` 后 `start_record_segment`，同一会话内多段。
- **状态**：已停止 / 录制中，由 `is_recording()` 决定。

输出目录：`SavePath/output/<timestamp>/`（每段：data.csv + jpg 或 video.avi）。

---

## 步骤 2：切图

- 对**最新段**调用 `compose_segment_to_frames(segment_dir, output_subdir="frames")`，得到 `segment/frames/`。
- 若段内为 video.avi 则按帧抽取；若为 jpg 则复制到 frames。  
- 对应 GameAISDK 文档中的「将游戏视频切成图片」；d3-check 用段目录替代单视频文件。

---

## 步骤 3：标注

- **工具**：**labelImg**（https://github.com/tzutalin/labelImg），GameAISDK 文档指定，需用户自行安装并运行 `python labelImg.py`。
- **操作**（TrainDetModel.md §3）：
  - **打开目录**：选择步骤2 的 frames 目录（或合并后的图片目录）。
  - **改变存放目录**：选择 VOC XML 的保存位置（可与图片同目录，或单独 Annotations 目录）。
  - 每张图对应一个 XML（VOC 格式）；一张图内可有多处标注（多个 `<object>`）。
- **类别**：labelImg 使用预设类别（如 `data/predefined_classes.txt`）。**一个数据集内必须使用同一套类别**，与后续 voc_label.py、voc.names、cfg 一致。
- **d3-check**：
  - 「打开标注」= 打开图片目录（frames/ 或合并目录）到资源管理器，用户再在 labelImg 中设置打开目录/存放目录。
  - **TODO**：可选「拉起 labelImg」并传入图片目录（若已配置 labelImg 路径）。
- 文档：GameAISDK doc/YOLO/TrainDetModel.md 第 3 节。

---

## 步骤 4：整理（可选）

- **目的**：删除「无标注的图」和「无对应图的 xml」，保证图与 xml 一一对应，便于 VOC 转换与训练。
- **逻辑**（TrainDetModel.md §4 DelUnLabelImg.py）：给定图片目录与 xml 目录，删除没有对应 xml 的图片、没有对应图片的 xml。
- **d3-check**：**TODO** 实现 `flow4_clean_unlabeled(image_dir, label_dir)` 或等价接口；UI 可选「整理未标注」对当前段 frames/ 或合并目录执行。
- 文档：TrainDetModel.md 第 4 节。

---

## 步骤 5：VOC 转 YOLO 格式

- **VOC 目录**（TrainDetModel.md §5.1）：在 darknet/scripts 下建 `VOCdevkit/VOC2007/`（或 VOC2012）：`Annotations/`（XML）、`ImageSets/Main/`（train.txt、val.txt、test.txt 为 image_id 列表）、`JPEGImages/`（图片）、`labels/`（由脚本生成）。
- **voc_label.py**（GameAISDK `Modules/darknetV3/src/scripts/voc_label.py`）：
  - 需修改脚本内 **classes** 列表（与 labelImg 预设、voc.names 一致）。
  - 读取 `ImageSets/Main/*.txt` 得到 image_id，对每个 id 读 `Annotations/<id>.xml`，写入 YOLO 格式到 `labels/<id>.txt`（归一化中心+宽高）。
- **d3-check**：**TODO** 封装 `flow5_voc_to_yolo(voc_root, classes)` 或调用 GameAISDK 脚本；可选 UI「导出为 VOC」/「VOC 转 YOLO」。
- 文档：TrainDetModel.md 第 5 节。

---

## 步骤 6：改配置并训练

- 修改 `data/voc.names`、`cfg/voc.data`、`cfg/yolov3-voc.cfg`（classes、filters 等），下载预训练权重，执行 `./darknet detector train ...`。
- **TODO**：路径与执行逻辑 **引用 GameAISDK** 目录与文档（TrainDetModel.md 第 6 节），在 d3-check 中提供配置入口与「开始训练」调用。

---

## 流程代码入口（d3utils.yolo_train_flow）

| 函数 | 说明 |
|------|------|
| `flow1_config_record` | 步骤1a 配置（由 UI 弹窗） |
| `flow1_start_record` | 步骤1b 开始录制（引用 yolo_record） |
| `flow1_stop_record` | 步骤1c 停止录制 |
| `flow1_new_segment` | 步骤1d 新段 |
| `flow1_is_recording` | 步骤1 状态 |
| `flow2_export_frames` | 步骤2 切图 |
| `flow3_open_label_tool` | 步骤3 打开标注。当前为 Python Tk 开发；推荐由 UI 传 `project_path` + `tk_after`；`tk_after` 非空时子进程启动 voc_annotator，避免阻塞主循环。详见 docs/YOLO_OPEN_LABEL_DATA_FLOW_AND_ISSUES.md。 |
| `flow4_clean_unlabeled` | 步骤4 整理（TODO：GameAISDK） |
| `flow5_voc_to_yolo` | 步骤5 转换（TODO：GameAISDK voc_label） |
| `flow6_get_train_config_paths` | 步骤6a 配置路径（TODO：GameAISDK） |
| `flow6_start_train` | 步骤6b 启动训练（TODO：GameAISDK darknet） |
| `flow_get_step_summary` | 各步骤就绪与状态汇总 |

所有 TODO 均需按 GameAISDK 文档或 SDK 接口补全并注明引用来源。

---

## 标注与多段关系（小结）

- **一段**：一个 `output/<timestamp>/`，可有 `frames/`，其内每张图可对应一个 XML（VOC）或 txt（YOLO）；「已标注」= 存在至少一个 xml/txt。
- **多段合并**：多段导出到同一文件夹（如 seg_0_*, seg_1_*）形成**一个数据集**；用户用 labelImg 对该文件夹一次性标注，**共用一套类别**。
- **类别**：同一数据集内类别表必须一致；voc_label.py、voc.names、yolov3-voc.cfg 中的 classes 需与标注时一致。
