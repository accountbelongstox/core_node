# 技术说明：scan_rosbot_running、neutral_color_matcher、ocr_helper

**目的**：说明这三处脚本/模块的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `scripts/scan_rosbot_running.py`
- `scripts/neutral_color_matcher.py`
- `d3utils/ocr_helper.py`

---

## 一、scripts/scan_rosbot_running.py

### 1.1 职责与约定

- **用途**：**调试脚本**，扫描当前 Windows 下正在运行的 ROSBOT（主 exe + 同目录其它 exe）。使用 **d3utils.rosbot_manager**：get_rosbot_manager()、get_ros_directory()、find_other_exe_files()、get_running_rosbot_processes()、get_rosbot_window()。文档要求 **从 pyapps/d3-check 运行**：`python scripts/scan_rosbot_running.py`。
- **路径**：project_root = dirname(dirname(abspath(__file__)))，repo_root = project_root 的再上一级；sys.path 插入 project_root 与 repo_root。若 ros_directory 未配置，会先尝试 providor_index.initialize_config()，再扫；未设置时输出 "(not set)" 与空列表。

### 1.2 易被误解或改错的原因

1. **运行目录错误**：若在 repo 根或其它目录运行 `python pyapps/d3-check/scripts/scan_rosbot_running.py` 且未把 d3-check 加入 path，会 import 失败；必须从 pyapps/d3-check 为 cwd 运行，或保证 sys.path 已含 d3-check 与 core_node。
2. **CONFIG 未加载**：若 CONFIG.ros_settings.ros_directory 为空且 initialize_config() 失败或未执行，get_ros_directory() 返回空，find_other_exe_files/get_running_rosbot_processes 为空，易被误认为「没有 ROSBOT」；实际可能是配置未就绪。
3. **与 _obsolete_rosbot_manager 混淆**：本脚本用的是 **d3utils.rosbot_manager**（当前约定），不是 utils._obsolete_rosbot_manager；若改为从 obsolete 取进程列表，会与 rosbot_status_provider、flow 使用的不一致。
4. **get_rosbot_window() 与 get_running_rosbot_processes()**：前者返回「当前选中的 ROSBOT 窗口」（同目录 exe 的单一窗口）；后者返回所有同目录下运行中的进程列表；若期望「一个窗口对应一个进程」需理解 same-dir exe 约定（见 ROSBOT_LOOKUP_FLOW）。

### 1.3 正确做法

- 始终从 pyapps/d3-check 运行脚本；确保 CONFIG 已加载且 ros_directory 已配置后再解读输出；不改为依赖 _obsolete_rosbot_manager；理解 get_rosbot_window 与 get_running_rosbot_processes 的差异与 same-dir exe 语义。

---

## 二、scripts/neutral_color_matcher.py

### 2.1 职责与约定

- **用途**：**中性颜色匹配**：将模板图等比缩放到宽 4px，用 k-means 提取最多 5 个中性色（BGR），在大图上用原图尺寸的滑动窗口匹配，只返回**一个**最佳位置；支持 ± 色差（DEFAULT_TOLERANCE=15）。主要接口：find_template_in_image(haystack_bgr, template_path, tolerance, min_ratio)、build_template_descriptor、find_single_match。模板路径依赖 **providor.constants.common.TEMPLATE_DIR**；main() 中使用 primal_native.png、ancient_native.png，输出到 TEMPLATE_DIR/neutral_color_reverse。
- **约定**：输入图像为 **BGR**（cv2.imread）；颜色元组为 (B,G,R)；min_ratio 为窗口内匹配像素占比下限；只保留得分最高的一处 (x,y)。

### 2.2 易被误解或改错的原因

1. **运行目录或路径**：脚本路径基于 __file__（_d3_check_root、_core_node_root）；若脚本移动或 TEMPLATE_DIR 指向错误，primal_native.png/ancient_native.png 找不到，main() 会 skip；find_template_in_image 若传入错误 template_path 返回 None。
2. **BGR 与 RGB 混用**：若调用方传入的是 RGB 图或 PIL 未转 BGR，颜色范围与 cv2.inRange 会错，匹配失败或误匹配。
3. **tolerance / min_ratio 与调用方不一致**：若主流程（如 debug_bag_hover）用不同 tolerance 或 min_ratio 调用 find_template_in_image，或默认 15/0.5 与其它模板匹配逻辑不一致，结果会与预期不符。
4. **单点返回**：find_single_match 只返回一个 (x,y)；若业务需要「所有匹配」或「多模板」，需在外层循环或改用其它匹配逻辑，勿假定可返回列表。
5. **模板文件名**：main() 与文档写死 primal_native、ancient_native；若模板改名或增加新模板未同步 main()，可视化输出不完整；作为库用时以传入的 path 为准。

### 2.3 正确做法

- 调用 find_template_in_image 时保证 haystack 为 BGR、template_path 存在且为 primal_native/ancient_native 或约定模板；tolerance/min_ratio 与使用场景一致；需要多结果时在外部循环或另写逻辑；脚本从 d3-check 根运行、TEMPLATE_DIR 正确时 main() 才能完整跑通。

---

## 三、d3utils/ocr_helper.py

### 3.1 职责与约定

- **用途**：**OCR 辅助**：共享「图中是否含某关键词」及「关键词框」逻辑。依赖 **pycore.pyfoundations.third_party.get_third_package_CnOCREngine()**（单例）。接口：**ocr_get_result(image_input)**（path 或 PIL Image，返回 {text, raw_result} 或 None）、**ocr_has_any_keywords(image_path, keywords)**（返回 bool）、**ocr_find_keyword_boxes(image_path, keywords)**（返回 [{keyword, text, bbox}]）；bbox 为 (min_x, min_y, max_x, max_y)。辅助：_boxes_from_raw_result(raw_result, keywords)、_position_to_bbox(position)、bbox_center、bbox_first_char_center、bbox_left_center（用于同意条款点击等）。
- **约定**：raw_result 为 list of {text, position}；position 可为 list of [x,y] 或 np.ndarray (4,2)；缺失 position 时 bbox 为 None 且 _boxes_from_raw_result 会跳过该项。关键词匹配为 **子串**（kw in text）。

### 3.2 易被误解或改错的原因

1. **ocr_get_result 与 ocr_has_any_keywords 入参不同**：ocr_get_result 支持 path 或 **PIL Image**（避免磁盘 I/O）；ocr_has_any_keywords、ocr_find_keyword_boxes 当前只接受 path。若对内存图调用 ocr_has_any_keywords 会传 path 失败；应先用 ocr_get_result(image) 再 _boxes_from_raw_result(raw_result, keywords)。
2. **engine 为 None**：若 CnOCR 未安装或 get_third_package_CnOCREngine() 返回 None，所有接口返回 None/False/[]；调用方若未判空会报错或误判为「无关键词」。
3. **raw_result 结构变化**：若 CnOCR 升级后 raw_result 格式变化（如 position 键名或形状），_position_to_bbox 或 _boxes_from_raw_result 可能报错或漏框；需与第三方引擎约定一致。
4. **关键词为子串**：ocr_has_any_keywords 用 `kw in text`；若关键词过短或与其它词子串重合，会误判；若需要整词或正则，需在调用方或本模块扩展。
5. **bbox 坐标系**：bbox 为图像坐标；bbox_left_center、bbox_first_char_center 用于点击时需加上窗口/裁剪偏移，调用方若直接当屏幕坐标会点错。
6. **重复 OCR**：ocr_find_keyword_boxes 内部调 ocr_get_result；若已有一次 ocr_get_result 结果，应用 _boxes_from_raw_result 复用，避免同一张图 OCR 两次。

### 3.3 正确做法

- 内存图用 ocr_get_result(PIL Image) + _boxes_from_raw_result；文件路径可用 ocr_has_any_keywords/ocr_find_keyword_boxes；使用前检查 engine 可用性；关键词与 raw_result/position 约定与 CnOCR 一致；bbox 转点击坐标时加上窗口/区域偏移；避免对同一图重复调用 OCR。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 scan_rosbot_running 运行目录或 CONFIG 未加载误判、neutral_color_matcher 的 BGR/单点返回/tolerance 混用、ocr_helper 的 path 与 PIL 入参混用或 raw_result 结构假设错误）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
