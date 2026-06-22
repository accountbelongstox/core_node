# 打开标注 (flow3) 数据流与设计问题

本文档描述「打开标注」流程的数据来源、在各类库间的传递方式，以及当前存在的数据结构与数据传递问题。**当前宿主为 Python Tk 开发**（主界面为 Tk，无 Qt）。对齐 `yolo_train_flow.md`、`YOLO_UNIFIED_DIRECTORY_DESIGN.md`、`ALL_PATH_REQUIREMENTS_TABLE.md`。

---

## 1. 打开标注流程（当前实现）

| 步骤 | 位置 | 行为 |
|------|------|------|
| 1 | 用户点击「打开标注」 | `CoordinateCalibrationPanel._on_flow3_open_label()` |
| 2 | 获取当前项目路径 | `project = self._get_yolo_current_project()` |
| 3 | 调用 flow3 | `flow3_open_label_tool(project_path=project, tk_after=root.after if root else None)` |
| 4 | flow3 分支 | 若 `tk_after` 非空：子进程启动 pycore voc_annotator（Tk 主界面下子进程运行标注工具，避免阻塞主循环）；否则尝试本进程或 GameAISDK launch_labelimg |
| 5 | 子进程 | `python -m pycore.pyutils.voc_annotator --project-path <project_path>`，可选 `--images-dir` |

**数据流**：CONFIG/面板实例变量 → `_get_yolo_current_project()` → `flow3_open_label_tool(project_path=...)` → voc_annotator 子进程。flow 层不读 CONFIG，只接收 UI 传入的路径。

---

## 2. 当前项目路径的来源（_get_yolo_current_project）

`CoordinateCalibrationPanel._get_yolo_current_project()` 按以下优先级返回路径（CONFIG 为权威，每次调用先同步再返回）：

1. **CONFIG**（`coord_calibration.yolo_current_project`）：若存在且为有效项目路径，则同步到 `_yolo_current_project_path` 并返回。
2. **`_last_record_project_path`**：最近一次录制使用的项目路径（若有效），仅内存，未写入 CONFIG 时重启后丢失。
3. **`get_default_project_path(current_client_type)`**：`YOLO_DATA_ROOT/{client_type}/default`，由 `d3utils.yolo_record` 提供。

**持久化**：当前选中的项目路径写入 CONFIG 键 `coord_calibration.yolo_current_project`；项目列表缓存写入 `coord_calibration.yolo_project_list`。写入时机：创建项目、加载项目、切换下拉、**开始录制成功后**（见 §3.6）。

---

## 3. 设计不合理之处

### 3.1 当前项目路径的“双份状态”

- **CONFIG**：`coord_calibration.yolo_current_project` 为持久化的权威值。
- **面板实例**：`_yolo_current_project_path` 为内存缓存。

问题：只有面板会写 CONFIG；若将来其他模块（如脚本、扩展）写入该 CONFIG 键，面板不会自动看到更新，因为面板只在 init 时从 CONFIG 读一次并填入 `_yolo_current_project_path`。

建议：约定「当前 YOLO 项目」由坐标校准面板独占读写；或让 `_get_yolo_current_project()` 在读取时先同步 CONFIG → `_yolo_current_project_path`（例如每次调用前从 CONFIG 读一次，若与缓存不一致则更新缓存），以保证 CONFIG 为唯一事实来源。

### 3.2 YOLO 根的多个定义

- **providor/constants/common.py**：`YOLO_DATA_ROOT = Path(...)`，用于 `YOLO_DATASET_BASE_DIR` 等。
- **d3utils/yolo_record.py**：从 `pycore.pyutils.voc_annotator.yolo_data_layout` 导入 `YOLO_DATA_ROOT`；若导入失败则使用 `os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")`（字符串）。
- **坐标校准面板**：从 `d3utils.yolo_record` 导入 `YOLO_DATA_ROOT`、`get_default_project_path`、`is_valid_project_path`。

问题：YOLO 根存在多处定义；类型不统一（Path vs str）；yolo_record 与 providor 可能指向不同默认值或不同类型，增加维护成本和潜在不一致。

建议：在单一位置定义 YOLO_DATA_ROOT（例如 providor 或 share），yolo_record 和 pycore 的 yolo_data_layout 均从该处读取或再导出；类型统一为 str 或 Path 其一。

### 3.3 flow3_open_label_tool 接口过载

`flow3_open_label_tool(images_dir=None, labels_output_dir=None, project_path=None, tk_after=None)` 内部分支（当前为 Python Tk 开发，主界面为 Tk）：

- 若 `project_path` 有效且 `tk_after` 非空 → 子进程启动 voc_annotator（仅用 project_path，可选 images_dir），避免标注 UI 阻塞 Tk 主循环。
- 若 `project_path` 有效且 `tk_after` 为空 → 本进程 `run_voc_annotator` 或失败。
- 否则若 `images_dir` 有效 → GameAISDK `launch_labelimg`。

问题：一个函数承担三种入口（子进程 / 本进程 / GameAISDK），参数组合语义不直观；调用方（面板）只传 `project_path` + `tk_after`，其他参数多为 None，但阅读者需通读实现才能理解。

建议：在文档中明确三种分支的触发条件与推荐用法；或拆成两个入口：`open_label_tool_for_project(project_path, tk_after, images_dir=None)` 与 `open_label_tool_for_images(images_dir, ...)`，供不同场景调用。

### 3.4 面板对 yolo_record / yolo_train_flow 的强依赖

坐标校准面板通过 try/except 批量导入 `d3utils.yolo_record` 与 `d3utils.yolo_train_flow`；若导入失败则大量置为 None，面板内再用 `if flow3_open_label_tool is None` 等做分支。

问题：面板同时承担 UI 与“是否具备 YOLO 能力”的判断，逻辑分散；flow 与 record 的接口变更会直接波及面板。

建议：将「当前 YOLO 项目路径」的解析与校验收敛到少数函数（例如仍在面板内，但通过 `_get_yolo_current_project()` 统一出口）；flow 层保持“只接受路径，不读 CONFIG”；能力检测可集中到 runtime 或单独 capability 模块，面板只消费“是否支持 flow3”的布尔结果。

### 3.5 项目路径的“标准”与“非标准”

- **标准路径**：`YOLO_DATA_ROOT/{client_type}/{project_name}`，由 `is_valid_project_path()` 校验。
- **非标准路径**：用户通过“加载项目”选择任意目录，加入 `yolo_project_list` 并持久化到 CONFIG。

设计上（YOLO_UNIFIED_DIRECTORY_DESIGN、voc_annotator DESIGN §9）允许项目在非标准目录，但要求标注/训练目录结构一致。当前实现已支持非标准路径；需注意 `get_default_project_path`、`is_valid_project_path` 均基于 YOLO_DATA_ROOT，非标准路径仍可设为当前项目并传给 flow3，voc_annotator 应能接受任意合法项目目录。

### 3.6 _last_record_project_path 未持久化且与 CONFIG 可脱节

- **现状**：开始录制时 `_last_record_project_path = project_path` 仅写面板实例，不写 CONFIG。
- **问题**：若本次「当前项目」来自 fallback（CONFIG 无效 → 用 default 或上一进程的 _last_record 已丢失），录制实际发生在 default 等路径上，但 CONFIG 仍为旧值；重启后 `_get_yolo_current_project()` 只读 CONFIG 与 default，会丢掉「本次录制所在项目」。
- **建议**：开始录制成功后，将 `project_path` 同步写入 CONFIG（`coord_calibration.yolo_current_project`）并更新 `_yolo_current_project_path`，使「当前项目」与「本次录制项目」一致且持久化。已落实于代码。

### 3.7 路径表与代码不一致（YOLO_RECORD_BASE_DIR vs YOLO_DATA_ROOT）

- **ALL_PATH_REQUIREMENTS_TABLE** 表一写：`YOLO_RECORD_BASE_DIR` 在 `d3utils/yolo_record.py:32`，用途为 `{d3-check}/data/yolo_record`。
- **当前代码**：`yolo_record.py` 已改为从 `pycore.pyutils.voc_annotator.yolo_data_layout` 导入 `YOLO_DATA_ROOT`，或 fallback 为 `os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")`；未见 `YOLO_RECORD_BASE_DIR`。
- **结论**：路径表与 YOLO_UNIFIED_DIRECTORY_DESIGN 不一致；实际唯一 YOLO 数据根为 YOLO_DATA_ROOT（外部或 env），非 d3-check 下的 data/yolo_record。应更新 ALL_PATH_REQUIREMENTS_TABLE，避免误导。

### 3.8 面板通过全局 ui_registry 获取 Tk root

- **现状**：`_on_flow3_open_label()` 中 `root = get_root()`（`share.ui_registry`），用于传 `tk_after=root.after`。
- **问题**：面板不通过构造函数或依赖注入获得主窗口，而是依赖全局注册；若主 UI 未注册或为其他框架，行为未定义。数据传递为「全局读」。
- **建议**：文档中明确「Tk root 由 share.ui_registry 提供，主 UI 启动时 register_ui(ui)」；中长期可考虑由主 UI 将 root 或 after 回调注入面板/flow，减少全局依赖。

---

## 4. 数据传递小结

| 数据 | 持有/写入处 | 读取处 | 传递方式 |
|------|-------------|--------|----------|
| 当前 YOLO 项目路径 | 面板（CONFIG 为权威；实例缓存与 _last_record 仅作 fallback） | 面板自身、flow3 | 面板 → `_get_yolo_current_project()`（先同步 CONFIG）→ `flow3_open_label_tool(project_path=...)` |
| 本次录制项目 | 开始录制时写入 CONFIG + `_yolo_current_project_path` + `_last_record_project_path` | 面板 | 录制成功后三者一致，避免 3.6 脱节 |
| 项目列表缓存 | 面板 → CONFIG | 面板 | CONFIG `yolo_project_list` |
| YOLO 根 / 默认项目 | yolo_record（或 pycore） | 面板、yolo_train_flow | 面板从 yolo_record 导入；flow 从 yolo_record 导入（get_latest_segment_dir 等） |
| tk_after | 主窗口 (Tk root) | 面板 | `get_root()`（全局 ui_registry）→ `root.after`，传入 flow3；见 3.8 |

---

## 5. 建议的代码与文档更新

1. **文档**：在 `yolo_train_flow.md` 中增加「步骤 3 调用约定」：推荐仅由 UI 传入 `project_path` 与 `tk_after`；子进程启动时以 `project_path` 为唯一项目根。已落实。
2. **CONFIG 为唯一事实来源**：在 `_get_yolo_current_project()` 中，每次调用时从 CONFIG 读取并同步到实例变量再返回。已落实。
3. **录制时同步当前项目**（对应 3.6）：开始录制成功后，将 `project_path` 写入 CONFIG（`coord_calibration.yolo_current_project`）并更新 `_yolo_current_project_path`，使「当前项目」与「本次录制项目」一致且持久化。已落实。
4. **路径表**：更新 ALL_PATH_REQUIREMENTS_TABLE，将 YOLO 录制/项目根统一为 YOLO_DATA_ROOT（与 yolo_record 实际实现及 YOLO_UNIFIED_DIRECTORY_DESIGN 一致），去掉或标注废弃 YOLO_RECORD_BASE_DIR（若表中仍存在）。
5. **YOLO 根**：中长期将 YOLO_DATA_ROOT 收敛到单一模块（如 providor 或 share），yolo_record 从该处引用并再导出，类型与默认值统一。
6. **flow3 接口**：保持现有签名，在实现与本文档中补充三种分支的触发条件与推荐用法。已落实。
7. **get_root 依赖**：文档中已明确 Tk root 来自 share.ui_registry（3.8）；中长期可考虑注入 root/after 减少全局依赖。
