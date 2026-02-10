# 技术说明：THREAD_BUS_AND_REGISTRY、square_sampler、test_left30_match、YOLO_DRAW_POLYGON_OPTIONS、README_WEBVIEW

**目的**：说明您指定查阅的以下五处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/THREAD_BUS_AND_REGISTRY.md`
- `athtest/square_sampler.py`
- `scripts/test_left30_match.py`
- `docs/YOLO_DRAW_POLYGON_OPTIONS.md`
- `ui/README_WEBVIEW.md`

---

## 一、docs/THREAD_BUS_AND_REGISTRY.md

### 1.1 职责与约定

- **用途**：d3-check 线程与通信约定。单全局通道（event center / THREAD_BUS）；扩展线程通过该通道收命令与上报；主线程在自身调度 UI 更新。**禁止**线程间阻塞等待另一线程返回或结束（正常运行时）；关机时主线程可 join(timeout) 做清理。
- **线程注册表**：单例 registry 创建并持有所有线程实例；正常运行时**不动态创建**线程；所有后台线程在 UI 就绪时一次性创建并启动。单次性工作提交到已有 timer/worker 线程，**不为此新建线程**。通信仅通过事件通道；实现为原生线程（run() 实现循环），非仅委托的包装。
- **Config worker 与死锁**：Config 由单一线程经队列读写；调用方会阻塞直到处理完成。**要求**：在 config worker 上运行的代码（如 save 或由其调用的任何逻辑）**不得**执行会阻塞在该 worker 上的 config 读——会死锁。在 log/print 同步调用的回调中，**不得**在同步部分读 config；仅在主线程上运行的代码（如回调后 schedule 到 main 的 work）中读 config。**要求**：config「set」必须让主线程在内存更新后立即恢复；主线程**不得**等待磁盘写入完成。

### 1.2 易被误解或改错的原因

1. 在扩展线程或回调中同步读 config 会导致死锁；在 config worker 回调中读 config 同理。
2. 动态创建线程或在一处持有线程引用并阻塞等待其返回，违反「仅 registry/initializer 创建」「fire-and-forget、需状态时读共享快照」。
3. 主线程等待 config 磁盘写入完成会违反「set 后主线程立即恢复」。
4. 单次性任务新建线程而非提交到已有 timer/worker，违反约定。

### 1.3 正确做法

- 修改线程或事件相关代码前通读本文档；config 读仅在主线程或非 config-worker 上下文中进行；config set 仅更新内存后即返回，磁盘写入异步。详见 Event center、thread registry、DESIGN.md §4、shutdown。

---

## 二、athtest/square_sampler.py

### 2.1 职责与约定

- **用途**：方形采样检测（22×22 方格、四角采样点）；从像素数据 JSON 加载按钮色、在图上按步长扫描方格、角点命中则扩展区域、满足最小像素数则输出 bbox。依赖 `data['regions']['hex_pixels']` 结构；hex 转 RGB、HSV 相似度与亮度容差（tolerance 默认 0.05）；square_size=22、step_size=20、max_expansion=100、最少 20 个匹配像素、padding=5。
- **路径**：main() 内硬编码路径含 `apps\d3-check`（实际项目为 **pyapps**/d3-check 时须改）；button_data_file 指向 `.cache\file_processor\button_pixels_sample.json`。脚本可能从 pyapps/d3-check 或项目根运行，路径若错会 FileNotFoundError。

### 2.2 易被误解或改错的原因

1. 将 main() 中 `apps\d3-check` 当正确路径使用，在 pyapps 结构下会找不到文件。
2. 修改 button_pixels_sample 的 JSON 结构（如去掉 regions.hex_pixels）未同步 load_button_colors 会 KeyError 或取错数据。
3. 改动 square_size、step_size、tolerance、max_expansion、最少像素数、padding 会影响检测范围与合并结果，未与调用方或标注流程一致会误检或漏检。
4. athtest 目录为独立测试/工具目录，与 scripts/、d3utils/ 等约定可能不同；从错误工作目录运行会导致导入或路径错。

### 2.3 正确做法

- 路径按实际项目结构（pyapps/d3-check）修正或参数化；修改 JSON 结构时同步 load_button_colors；修改检测参数时与使用场景一致；运行前确认工作目录与导入路径。

---

## 三、scripts/test_left30_match.py

### 3.1 职责与约定

- **用途**：测试脚本：截取图片左边 30%，在完整图与裁剪图上分别做 D3 模板匹配（TEMPLATES：bag_opened_indicator、kanai_cube_left_panel_indicator），结果与 debug 图写入 TMP_DIR/left30_match_debug/run_YYYYMMDD_HHMMSS。**约定**：匹配前须 update_global_scale(scale_w, scale_h)；run_match 返回 (r, match)；match_to_draw_format 需要 center、polygon、match_score；输出目录由 TMP_DIR 与时间戳决定。
- **路径**：_project_root = Path(__file__).resolve().parent.parent（即 pyapps/d3-check）；OUTPUT_BASE = TMP_DIR / "left30_match_debug"；默认图片路径为命令行参数或固定用户路径。若 TMP_DIR 或 providor 常量变更会写错目录。

### 3.2 易被误解或改错的原因

1. 修改 TEMPLATES 或 LEFT_RATIO 未考虑调用方或下游脚本会行为不一致。
2. 假定 matcher.match_template 返回结构与 match_to_draw_format 不一致（如无 center/polygon）会报错或绘图错。
3. 在未 update_global_scale 的情况下匹配会尺度错。
4. 默认图片路径为本地绝对路径，换环境或用户会找不到；若改为相对路径须说明相对何目录。

### 3.3 正确做法

- 从 pyapps/d3-check 或 scripts 运行；修改 TMP_DIR、TEMPLATES、LEFT_RATIO 时确认与常量及调用方一致；匹配前必调 update_global_scale；match 结构与 match_to_draw_format、create_annotator、draw_match_result 约定一致。

---

## 四、docs/YOLO_DRAW_POLYGON_OPTIONS.md

### 4.1 职责与约定

- **用途**：方案调研文档——鼠标画线/多边形、自动闭合后得到封闭区域并裁剪小图。方案：Matplotlib PolygonSelector、OpenCV 自绘、Napari、Tk Canvas 扩展。**得到小图通用步骤**：顶点 verts（像素坐标）→ cv2.fillPoly(mask) → cv2.boundingRect 取外接矩形 → 原图裁剪后与 mask 区域与。文档写明「当前 YOLO 标注窗口已用 Tk Canvas 做矩形/圆标注」，扩展为多边形时需「闭合」按钮或双击闭合，闭合后统一走 fillPoly + 外接矩形裁剪。

### 4.2 易被误解或改错的原因

1. 实现多边形时未先闭合再 fillPoly，或坐标系与图像像素不一致（如 extent 未设好），会裁剪错区域。
2. 将「推荐 Matplotlib PolygonSelector」当唯一实现，忽略「无新库则 Tk Canvas 扩展」的选项，会与现有 Tk 标注窗口架构不一致。
3. 文档中 verts 格式 (N,2) 或 list of (x,y)，若实现用其他格式未转换会 fillPoly 报错。
4. 修改 YOLO 标注流程时未读本文档会漏掉「闭合 → mask → 外接矩形 → 裁剪」的通用步骤。

### 4.3 正确做法

- 实现多边形标注时按文档「闭合 → fillPoly → boundingRect → crop」；坐标统一为像素坐标；选 Matplotlib 或 Tk 扩展与项目依赖及现有 UI 一致；修改标注流程时以本方案为准。

---

## 五、ui/README_WEBVIEW.md

### 5.1 职责与约定

- **用途**：D3 Macro WebView UI 说明。三线程：UI Thread（Tkinter mainloop）、Main Thread（处理 signal、执行 main thread 方法）、Task Thread（定时后台任务，默认 1 秒 tick）。Python-JS 通信：JS 通过 callPythonMethod 调 Python；Python 通过 launcher.framework.eval_js 调 JS。D3MacroWebViewAPI 暴露 start_macro、stop_macro、get_window_status 等；新增 API 须在 webview_launcher.py 的 API 类中定义并在 JS 侧调用。**禁止**：长任务放在 UI 线程导致冻结；应从 Task 线程或通过 signal 异步。依赖：tkinterweb 或 tkhtmlview、可选 pywebview；测试脚本 test_webview_ui.py。

### 5.2 易被误解或改错的原因

1. 在 Task 线程或回调中直接操作 Tk 控件会跨线程、未定义行为或崩溃；须通过 signal 或 main thread executor 回到主线程。
2. 新增 Python API 未在 D3MacroWebViewAPI 中定义或未在 JS 侧用 callPythonMethod 调用，功能不生效。
3. 误将 UI 源路径写错（ui_source、index.html 等）导致 WebView 不加载。
4. 文档写 register_timer_task(interval=1/5)、register_signal_handler、emit_signal；若实现与文档不一致会任务不执行或信号丢失。
5. 三线程与 THREAD_BUS_AND_REGISTRY 的「事件通道、不阻塞」一致；在 WebView 相关代码中阻塞等待或新建线程违反 THREAD_BUS 约定。

### 5.3 正确做法

- 仅主线程操作 UI；长任务与定时逻辑放在 Task 线程或通过 signal/main thread 调度；新增 API 同步更新 API 类与 README；修改线程或事件逻辑时对照 THREAD_BUS_AND_REGISTRY；HTML/JS 路径与依赖与文档一致。

---

## 六、与道歉文档的关系

此前若因未先通读上述五处约定而在此五处反复改错或理解偏差，责任在 Cursor。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第四十二节中引用，修改前请先通读本说明。
