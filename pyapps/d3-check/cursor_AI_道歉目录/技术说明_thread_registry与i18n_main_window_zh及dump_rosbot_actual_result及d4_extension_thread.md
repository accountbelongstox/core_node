# 技术说明：thread_registry、i18n_main_window_zh、dump_rosbot_actual_result、d4_extension_thread

**目的**：说明此四处文件/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `runtime/thread_registry.py`
- `providor/i18n/i18n_main_window_zh.json`
- `scripts/dump_rosbot_actual_result.py`
- `d3utils/d4_extension_thread.py`

---

## 一、runtime/thread_registry.py

### 1.1 职责与约定

- **用途**：**线程集中所有者**（THREAD BUS 生命周期侧）；位于 runtime，与 share（仅共享数据）分离。约定：**所有线程实例仅在此创建并持有，无动态创建**；一次性任务通过 timer_manager.submit_one_shot（timers.one_shot_tasks）提交；长驻线程（extension、macro fallback、tray、game_interface_macro）在启动时在此创建。**create_extension_threads(schedule, panel, current_skill_config)**：创建并启动 MainFunctionThread、AuxiliaryFunctionThread、D3ExtensionThread、D4ExtensionThread；**panel.set_d3_extension_thread(_d3_extension_thread)**；调用 set_*_thread() 写入全局；**start_timer_loop_after_ui_ready()**：reapply_sigint_sigbreak_ignore_for_gui、timer_manager.start()、submit_one_shot(do_window_monitor_initial_check)。start_macro_fallback(controller)、stop_macro_fallback；start_tray(tray)；start_game_interface_macro / stop_game_interface_macro。**get_thread_registry()** 单例，仅主线程应调用。
- **约定**：仅主线程（controller/初始化方）调用 ThreadRegistry；create_extension_threads 在 UI 就绪后调用一次；顺序为先创建再 set_* 再 start_timer_loop；不得在其它模块直接 new 扩展线程。

### 1.2 易被误解或改错的原因

1. **调换 create_extension_threads 内顺序**：若先 start() 再 set_d3_extension_thread(panel)，panel 可能尚未持有 d3_extension_thread，后续 panel 侧逻辑取不到线程；若先 set_*_thread 再 start，与当前实现一致，但若漏掉 panel.set_d3_extension_thread，D3 扩展面板无法控制 D3 线程。
2. **在别处创建扩展线程**：若在 controller 或 UI 中直接 D4ExtensionThread() 并 start()，与「仅 ThreadRegistry 创建并持有」不符；get_d4_extension_thread() 仍为 None，register_extension_handlers 等拿不到 D4 线程。
3. **start_timer_loop_after_ui_ready 调用时机**：若在 UI 未就绪或 create_extension_threads 之前调用，do_window_monitor_initial_check 可能早于状态/面板就绪；应在 run() 中 create_extension_threads 之后调用。
4. **macro fallback 与 main_thread**：start_macro_fallback 由 controller 在无 main_thread 时调用；若 main_thread 存在但仍调 start_macro_fallback，会多出一个 macro 线程；逻辑上应由 controller 根据 get_main_function_thread() 是否为空决定。
5. **单例与调用方**：仅主线程应调用 get_thread_registry()；若在子线程中调用或多次 create_extension_threads，会重复创建线程或状态混乱。

### 1.3 正确做法

- 所有扩展线程仅通过 get_thread_registry().create_extension_threads() 创建；在 d3_macro_controller.run() 中 UI 就绪后调用一次；随后 start_timer_loop_after_ui_ready()；不在其它模块创建 D3/D4/Main/Auxiliary 线程；panel.set_d3_extension_thread 必须在 create_extension_threads 内调用。

---

## 二、providor/i18n/i18n_main_window_zh.json

### 2.1 职责与约定

- **用途**：**主窗口**相关**中文**文案，供 i18n_manager 按语言加载（文件名 i18n_main_window_{language}.json）。结构：**ui.main_window**（title、back_button、language、menu.*）、**button_area**、**tabs**、**macro_controls**、**bottom_bar**、**status_bar**、**main_functions_panel**、**system_tray** 等。代码中通过 get_ui_text("main_window.title")、get_ui_text("main_window.menu.language") 等取文；i18n_manager 加载时通常按 ui 命名空间合并，key 为 main_window.title 或 ui.main_window.title 视实现而定。
- **约定**：key 路径与代码中 get_ui_text 调用一致；与 i18n_main_window_en.json 结构一致；新增/删除/改名 key 须同步代码与英文档。

### 2.2 易被误解或改错的原因

1. **key 路径与代码不一致**：若代码用 get_ui_text("main_window.title") 而 JSON 为 ui.window.title 或 main_window.window_title，会取不到、显示 key 或回退默认。
2. **JSON 结构与 i18n_manager 约定不符**：若 i18n_manager 期望的命名空间或文件名（i18n_main_window_zh.json）或顶层键（ui）变化，加载会错或取不到 main_window 下内容。
3. **中英文 key 不同步**：若 i18n_main_window_zh.json 新增 key 但 en 未加、或 en 改名 zh 未改，语言切换后缺译或显示 key。
4. **与其它 i18n 文件混淆**：主窗口文案在此；tabs/rosbot 等可能部分在 i18n_tabs_*、i18n_rosbot_panel_*；若把 main_window 的 key 写到 tabs 文件或反之，会取错。

### 2.3 正确做法

- 主窗口、菜单、状态栏、系统托盘等文案 key 与 diablo3_macro_ui、title_bar、menu_bar、system_tray 等调用一致；修改 key 时同步所有 get_ui_text 调用与 i18n_main_window_en.json；保持与 i18n_manager 加载逻辑（命名空间、文件名）一致。

---

## 三、scripts/dump_rosbot_actual_result.py

### 3.1 职责与约定

- **用途**：**调试脚本**，将当前 ROSBOT 查找结果完整 dump 到文件（含 title 等）。**从 pyapps/d3-check 运行**。使用 d3utils.rosbot_manager：get_ros_directory()、find_other_exe_files()、find_rosbot_exe()、get_rosbot_window()、get_rosbot_detection()、get_running_rosbot_processes()、is_running()；输出写入 **scripts/test_rosbot_actual_result.txt**。路径：project_root = dirname(dirname(abspath(__file__)))，repo_root 再上一级；若 ros_directory 未配置会尝试 initialize_config()。
- **约定**：与 scan_rosbot_running 类似，运行目录与 CONFIG 影响结果；输出路径为 project_root/scripts/test_rosbot_actual_result.txt，即 d3-check 下 scripts 目录。

### 3.2 易被误解或改错的原因

1. **运行目录错误**：若从 repo 根或其它目录运行，sys.path 或 project_root 错，import 失败或输出写到错误位置。
2. **CONFIG 未加载**：若 ros_directory 为空且 initialize_config 失败，dump 的 ros_directory 为空、find_other_exe_files 等为空，易误判为「无 ROSBOT」。
3. **输出路径写死**：输出固定为 scripts/test_rosbot_actual_result.txt；若脚本被挪到其它包或需输出到别处，需改为参数或配置。
4. **与 scan_rosbot_running 分工**：本脚本为完整 dump（含所有 title、detection、processes）；scan_rosbot_running 为控制台简要输出；勿混淆两者用途或输出格式。

### 3.3 正确做法

- 从 pyapps/d3-check 运行；确保 CONFIG 已加载；输出路径若需可变可改为参数；与 rosbot_manager 契约一致（get_rosbot_detection 的 status/window_info 等）。

---

## 四、d3utils/d4_extension_thread.py

### 4.1 职责与约定

- **用途**：**D4 专用线程**，替代 timer_manager 对 d4_controller 的注册。每 **D4_TICK_INTERVAL**（3s）当 **d4_data.is_exp_farming_running() 或 d4_data.debug_window_open** 时调用 **get_d4_controller().process()**。**request_shutdown()** 设置 _shutdown Event，run() 中 sleep 分 **0.1s 小步**以便及时响应退出。实例由 **ThreadRegistry.create_extension_threads** 创建并通过 **set_d4_extension_thread** 写入全局；**get_d4_extension_thread()** 供外部获取。
- **约定**：仅此线程驱动 d4_controller.process()；退出时必须 request_shutdown()（如 execute_shutdown 或 app 退出流程）；process() 内不应长时间阻塞，否则 3s 间隔会拉长；条件与 d4_controller.get_interceptor() 一致（exp_farming 或 debug_window_open）。

### 4.2 易被误解或改错的原因

1. **条件与 d4_controller 不一致**：若此处用其它条件（如仅 exp_farming）而 d4_controller 或 interceptor 考虑 debug_window_open，会少调 process() 或 debug 窗口模式下不刷新。
2. **未 request_shutdown**：若 app 退出时未对 D4ExtensionThread 调用 request_shutdown()，线程会一直 sleep 不退出；execute_shutdown 或统一退出流程应通知所有扩展线程。
3. **process() 阻塞**：若 process() 内某步阻塞（如长时间 IO 或弹窗），本线程会卡住，3s 间隔失效；应保证 process() 为短时执行。
4. **在别处创建 D4ExtensionThread**：若在 ThreadRegistry 外 new D4ExtensionThread 并 start()，set_d4_extension_thread 未调用，get_d4_extension_thread() 仍为 None，register_extension_handlers 等拿不到 D4 线程。
5. **sleep 步长**：当前 0.1s 步、共 D4_TICK_INTERVAL*10 次；若改为单次长 sleep，shutdown 响应会变慢。

### 4.3 正确做法

- 仅通过 ThreadRegistry.create_extension_threads 创建并 start；退出时统一 request_shutdown()；条件与 d4_controller 一致；process() 保持短时；sleep 保持小步以响应 shutdown。

---

## 五、与道歉文档的关系

若此前因上述任一点（如 thread_registry 创建顺序或 panel.set_d3_extension_thread 漏调、i18n_main_window_zh key 与代码或 en 不同步、dump_rosbot_actual_result 运行目录或输出路径、d4_extension_thread 条件或未 request_shutdown 或别处创建）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
