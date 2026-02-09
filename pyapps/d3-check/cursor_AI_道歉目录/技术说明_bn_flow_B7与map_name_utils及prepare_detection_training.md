# 技术说明：bn_flow_B7.json、map_name_utils.py、prepare_detection_training.py

**目的**：说明这三处代码/缓存的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `.cache/bn_flow_snapshots/bn_flow_B7.json`
- `controller/d4func/map_name_utils.py`
- `scripts/prepare_detection_training.py`

---

## 一、.cache/bn_flow_snapshots/bn_flow_B7.json

### 1.1 职责与约定

- **性质**：战网流程 B7 节点的**运行时快照**，由 `save_ui_elements_snapshot` 等写入；非源码，属 .cache 下的可再生产物。
- **结构**：`meta.node`（如 "B7"）、`meta.reason`（如 "B7_poll_elements"）、`controls` 数组；每项含 `name`、`automation_id`、`type`、`rect` 等。B7 对应「轮询登录/界面元素」阶段。
- **使用方**：battlenet_region_judge、is_login_failed_screen、is_on_login_screen 等依赖 controls 的 automation_id/name/结构判断登录状态；若快照结构与这些逻辑的预期不一致，会导致误判（如把登录中判成未登录、或把失败页判成正常）。

### 1.2 易被误解或改错的原因

1. **把 .cache 当权威数据**：若在代码中写死 `bn_flow_B7.json` 路径或假定该文件一定存在，在全新环境或清理缓存后会导致读失败；应通过配置/常量取快照目录，并对缺失文件做兼容。
2. **修改 JSON 结构未同步代码**：若在逻辑中期望 `controls[].automation_id` 或 `meta.reason` 的取值/层级与现有快照不一致（如新增字段、改名），而快照写入方未改，会导致解析失败或判断错误；反之若只改写入格式未改读取/判断逻辑也会错。
3. **B7 快照缺少关键控件**：B7 为轮询元素阶段，若快照中缺少登录相关控件（如 "正在登录..."、LoginWindow 等），下游会误判为未登录或非登录页；保存快照的时机与窗口状态需与 B7 语义一致。
4. **跨机/提交缓存**：.cache 为本地运行时产物，若被提交到版本库或在他机当权威引用，可能因分辨率、客户端版本、语言不同而失效；文档与脚本中应注明「快照为运行时缓存，不可移植则勿依赖」。

### 1.3 正确做法

- 快照路径从常量或配置读取，不写死 `bn_flow_B7.json`；读取前检查文件存在，缺失时降级或跳过。
- 快照的 meta/controls 结构与 battlenet_operation、battlenet_region_judge、is_on_login_screen 等约定一致；新增字段或改名时同时改写入与读取。
- 不在版本库中依赖 .cache 内容作为唯一数据源；文档中说明各节点快照用途与可移植性限制。

---

## 二、controller/d4func/map_name_utils.py

### 2.1 职责与约定

- **用途**：D4 地图名与 shared data 的读写封装；`get_d4_interface_data().detected_regions` 中用 `map_name` 或 `current_map` 存当前地图名。
- **接口**：`get_current_map_name_from_shared_data()`（优先 `map_name`，其次 `current_map`，无则 "Unknown"）；`set_current_map_name(map_name)`（同时写两个键）；`clear_current_map_name()`；`is_map_name_available()`；`get_current_map_name()` 为兼容别名。
- **依赖**：写入方通常为 map_name_recognizer 或 region_detector；若无人先写入，get 会一直返回 "Unknown"。

### 2.2 易被误解或改错的原因

1. **路径假定**：`current_dir = Path(__file__).parent.parent.parent` 假定文件在 `controller/d4func/` 下；若移动文件未改该行，sys.path 会错，导致 import 失败。
2. **detected_regions 为 None 或缺失键**：get 时若 `detected_regions` 为 None 或既无 `map_name` 也无 `current_map` 则返回 "Unknown"；若 region_detector / map_name_recognizer 未先写入，调用方会误以为「未识别」而重复调用或逻辑分支错误。
3. **直接写 detected_regions**：set/clear 直接改 `d4_data.detected_regions`；若与 region_detector 的 `_extract_all_regions_to_share` 或其它写 detected_regions 的代码并发，可能竞态；多线程或异步场景需约定单写或加锁。
4. **只读一个键**：当前 get 兼容 `map_name` 与 `current_map`；若某处只写其中一个而另一处只读另一个，会不一致；set 已同时写两个键，保持此约定即可。
5. **异常被吞**：若在 get/set/clear 内用裸 except 并返回 "Unknown"/False 而不打日志，会掩盖 bug，难以排查。

### 2.3 正确做法

- 路径由项目入口或 share.project_path 统一保证；若必须在本模块算路径，文档注明「假定在 controller/d4func 下」。
- 与 map_name_recognizer、region_detector 的调用顺序与写入时机在文档中写明；get 返回 "Unknown" 时调用方应视为「尚未识别」而非「无地图」。
- 多线程/异步写入 detected_regions 时，约定单写或加锁，避免与 map_name_utils 的 set/clear 竞态。
- 异常至少打日志，避免裸 except 静默失败。

---

## 三、scripts/prepare_detection_training.py

### 3.1 职责与约定

- **用途**：YOLO 检测训练数据制备；从 yes/no 子目录加载小图，贴到背景图上并做随机变换，生成 images/train、images/val、labels、data.yaml、metadata.json。
- **约定**：class_id 0=no、1=yes，与 data.yaml 的 `names: ['no', 'yes']` 顺序一致；bbox 为 YOLO 归一化格式（center_x, center_y, width, height）；namespace 用于文件名与 metadata。
- **路径**：`current_dir = os.path.dirname(script)`、`parent_dir = os.path.dirname(current_dir)`、`sys.path.insert(0, parent_dir)` 假定脚本在 `scripts/` 下运行。

### 3.2 易被误解或改错的原因

1. **裸 except 吞错**：`_paste_image_on_background` 内 `try: result[y:y+sm_h, x:x+sm_w] = small_image` 后 `except: pass`；若 slice 尺寸越界或类型错误会静默失败，但 bbox 仍按原 small_image 尺寸返回，导致标注与图像内容不一致，训练出错。
2. **非 ASCII 路径**：`cv2.imread(str(img_file))` 在部分环境下对含中文等非 ASCII 的路径失败，小图目录若含中文会漏载，yes/no 数量为 0 仍继续跑会出空列表或异常。
3. **output_dir 相对路径**：data.yaml 中 `path: self.output_dir.absolute()` 依赖当前工作目录；若脚本从别的工作目录运行，path 会指向错误位置，训练时找不到图。
4. **class 顺序**：class_id 0=no、1=yes 与 data.yaml 的 names 顺序必须与训练/推理脚本一致；若只改一侧会导致类别反了。
5. **背景图加载失败**：`background = cv2.imread(str(...))` 失败时 background 为 None，后面 `background.shape` 会报错；当前有 `if background is None: continue`，但若漏改或复制到别处可能缺失。
6. **data.yaml/metadata 写入时机**：在循环外写入，若循环中异常退出，可能生成不完整数据集但已有 yaml/metadata，易误导；可在全部成功后再写，或注明「生成中断时 yaml 可能不完整」。

### 3.3 正确做法

- 裸 except 改为 `except Exception as e`，打日志并跳过该图或返回错误，避免粘贴失败仍写标注。
- 小图路径含非 ASCII 时用 `np.fromfile(..., dtype=np.uint8)` + `cv2.imdecode` 或统一 UTF-8 路径；加载后检查 yes_images/no_images 非空再生成。
- output_dir 建议用绝对路径或由调用方传入；在 data.yaml 中写 path 时注明「相对于本 yaml 所在目录」或「绝对路径」并在文档说明。
- 保持 class_id 与 names 顺序一致，并在脚本注释或文档中写明 0=no、1=yes；训练/推理代码引用同一约定。
- 背景图加载失败时跳过并计数，避免 None 进入后续逻辑。

---

## 四、与道歉文档的关系

若此前因上述任一点（如把 bn_flow_B7 当权威数据、快照结构与判断逻辑不一致、map_name_utils 路径或并发未约定、prepare_detection_training 裸 except 或 class 顺序不一致）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
