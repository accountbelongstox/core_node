# 技术说明：INITIAL_STATE_DETECTION、square_sampler、game_state_events

**目的**：说明这三处文档/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/INITIAL_STATE_DETECTION.md`
- `athtest/square_sampler.py`
- `controller/d4func/events/game_state_events.py`

---

## 一、docs/INITIAL_STATE_DETECTION.md

### 1.1 职责与约定

- **主题**：应用启动时**仅做一次**的初始状态检测，用于底部栏等 UI 显示 战网/ROS/D3/地图/阶段/窗口尺寸 等真实值；本次检测**只做 detection，不驱动 flow**（不调用 tick_bn_only_flow、tick_flow_master）。
- **可复用入口**：`run_full_status_refresh()`（`d3utils/rosbot_task_processor.py`）负责 Battle.net（含亚服/国服）+ D3 + ROSBOT 的刷新并 notify UI，**不做 flow 检查**。适用于：启动时、手动刷新、或 flow 未激活时的定时刷新。
- **流程**：  
  1. UI 就绪后，Controller 调用 `get_thread_registry().start_timer_loop_after_ui_ready()`（在 `ui.run()` 之前）。  
  2. `start_timer_loop_after_ui_ready()` **先在主线程同步**执行 `do_window_monitor_initial_check()`，这样在首帧前就完成 refresh 与 `notify_state_sync()`，UI 回调通过 `after(0, ...)` 在首帧显示。  
  3. 然后启动 timer 循环并 `submit_one_shot(do_window_monitor_initial_check)`（短时间内再跑一次，无害）。  
  4. `do_window_monitor_initial_check()`（在 `timers/one_shot_tasks.py`）**直接调 `run_full_status_refresh()`**，从不调 `check_window()`，因此与 `is_flow_active()` 无关，始终执行。  
  5. 之后 `window_monitor.notify_window_callbacks(d3_info)` 通知 D3 窗口回调。
- **与 2s flow 的区别**：持续 2s tick（flow 驱动）由 `process_task()` 在 flow 激活时执行，只调 tick_bn_only_flow / tick_flow_master，**不参与**此次初始检测。

### 1.2 易被误解或改错的原因

1. **用 flow 做“初始检测”**：若在启动时为“省事”直接调 `tick_bn_only_flow()` 或 `tick_flow_master()` 做首次状态，会误驱动 B/F/C 等流程，与文档“detection only、does not drive flow”矛盾。
2. **初始检测放到非主线程**：文档明确“Initial check on main thread”以便首帧前完成 refresh 与 notify；若把 `do_window_monitor_initial_check()` 改成异步或放到 timer 线程才跑，首帧可能拿不到状态，底部栏会闪或显示空。
3. **用 check_window() 做首次检测**：`check_window()` 在 window_monitor_timer 里用于“flow inactive 时 10s 刷新”；初始检测应直接用 `run_full_status_refresh()`，若首次跑成 `check_window()` 可能受 is_flow_active 或其它条件影响，导致未执行或逻辑分支错。
4. **调用顺序**：必须先 `start_timer_loop_after_ui_ready()`（内含同步 do_window_monitor_initial_check），再 `ui.run()`；若先 run 再 initial check，首帧已显示才刷新，会有明显延迟或空白。
5. **文档与代码不同步**：若 thread_registry、one_shot_tasks、rosbot_task_processor 中符号或流程改了（如重命名 do_window_monitor_initial_check、或 initial check 改到别处），文档未更新会误导后续修改。

### 1.3 正确做法

- 启动时仅通过 `start_timer_loop_after_ui_ready()` 内的**主线程同步** `do_window_monitor_initial_check()` 做初始检测；该函数内只调 `run_full_status_refresh()` + `notify_window_callbacks()`，不调 flow tick。
- 不在此路径使用 `check_window()` 或任何 tick_bn_only_flow / tick_flow_master 作为“初始检测”。
- 修改 thread_registry、one_shot_tasks、window_monitor 的初始检测逻辑时，同步更新本文档的 Flow 与 Code locations 表。

---

## 二、athtest/square_sampler.py

### 2.1 职责与约定

- **用途**：方格采样检测算法——用 22×22 方格、四角采样点，在图像上检测与“按钮颜色”匹配的区域；从中心扩展连通区，满足最小像素数则记为一个检测区域。
- **输入**：主图（PIL Image）+ 按钮颜色数据（JSON：`regions.hex_pixels`，每项含 `color` 等）；颜色经 hex_to_rgb、is_color_in_button_colors（亮度±5%、HSV 容差）匹配。
- **参数**：square_size=22、step_size=20、tolerance=0.05、expand 时 max_expansion=100、最小区域像素数 20、bbox padding 5。
- **main()**：写死了三个路径——主图、button_data_file、结果图；路径中为 `apps\d3-check`、`.cache\file_processor\button_pixels_sample.json` 等，与当前项目若为 `pyapps/d3-check` 或不同缓存目录会不一致。

### 2.2 易被误解或改错的原因

1. **路径写死**：main() 内路径指向 `apps\d3-check` 与 `.cache\file_processor\...`；若项目根或子项目为 `pyapps/d3-check`、缓存目录名不同，直接运行会 FileNotFoundError；应改为从配置/命令行/项目根推导路径。
2. **JSON 结构依赖**：`load_button_colors` 假定 `data['regions']['hex_pixels']` 存在且每项有 `color`；若上游导出格式改为其它 key（如 `pixels`、`samples`）或嵌套结构变化，会 KeyError 或取错数据。
3. **与主流程混用**：本脚本在 athtest 下，属测试/工具；若主流程（如 D3/D4 界面检测）误引用本模块且未保证输入格式与路径一致，会行为异常；应明确“仅 athtest 或手工跑脚本用”。
4. **参数未文档化**：tolerance、square_size、step_size、min pixels、padding 等若在代码中改默认值未同步文档或注释，他人复用时会用错假设。
5. **PIL getpixel**：对多通道图返回元组，对 P 模式可能返回整数；is_color_in_button_colors 等若假定始终为 (r,g,b) 三元组，在其它模式可能报错。

### 2.3 正确做法

- main() 中路径改为命令行参数或基于 `Path(__file__)`/项目根推导，避免写死 apps 或 .cache 子路径。
- 对 JSON 输入做存在性检查（如 `data.get('regions', {}).get('hex_pixels', [])`），并对缺失/空列表给出明确提示。
- 在模块头或 README 中注明用途（方格采样检测、athtest）、输入格式与参数含义，与主流程 D3/D4 检测区分开。

---

## 三、controller/d4func/events/game_state_events.py

### 3.1 职责与约定

- **用途**：D4 游戏状态相关事件的回调；**不接收参数**，所有数据从 `get_d4_interface_data()` 的 shared data 读取。
- **事件**：  
  - `on_game_state_changed()`：根据 `d4_data.is_exp_farming_running()` 显示 Running/Stopped。  
  - `on_current_map_changed()`：从 `d4_data.detected_regions['map_name']` 读当前地图，无则显示 Unknown。  
  - `on_dungeon_progress_changed()`：从 `d4_data.detected_regions['dungeon_progress']` 读副本进度，无则 Unknown。
- **数据源**：文档注明“D4State functionality now integrated into D4InterfaceData”；即应统一用 `get_d4_interface_data()`，不要再用已废弃的 D4State 单独接口。
- **路径**：`current_dir = Path(__file__).parent.parent.parent.parent`（从 `controller/d4func/events/` 上四级到项目根），用于 sys.path.insert；若文件移动或包结构变化会错。

### 3.2 易被误解或改错的原因

1. **detected_regions 键名**：on_current_map_changed 只读 `map_name`；map_name_utils 同时维护 `map_name` 与 `current_map`。若某处只写 `current_map` 而这里只读 `map_name`，会一直 Unknown；需与 map_name_utils 的 set/get 约定一致。
2. **detected_regions 为 None**：若 detected_regions 为 None，`d4_data.detected_regions and 'map_name' in ...` 会短路为 False，不会报错但显示 Unknown；若其它代码假定 detected_regions 始终为 dict 可能 elsewhere 报错；事件内已做判断，但写入方需保证要么 None 要么 dict。
3. **路径假定**：四个 parent 假定文件在 `controller/d4func/events/`；若移动到 d4func 下别层或 events 改名，需改 parent 次数或改用 share.project_path 等统一入口。
4. **D4State 与 D4InterfaceData**：注释说 D4State 已并入 D4InterfaceData；若新代码仍从 D4State 读状态而事件从 D4InterfaceData 读，会两套数据不一致。
5. **事件注册与调用时机**：若事件在 shared data 尚未更新时被触发（如写入前就 fire），会读到旧值；谁在何时 fire 这些事件需与写入 detected_regions / is_exp_farming_running 的时机约定清楚。

### 3.3 正确做法

- 读写 map_name 时与 map_name_utils 一致：同时维护 `map_name` 与 `current_map`，读取时优先 map_name 再 current_map。
- 事件内保持对 detected_regions 的 None 与 key 存在性检查；写入方保证 detected_regions 为 None 或合法 dict。
- 项目路径由统一入口（如 share.project_path）提供，避免在多个文件里重复 parent.parent 链。
- 事件触发时机与 region_detector、map_name_recognizer、exp_farming 等写入 shared data 的时机文档化，避免先 fire 后写。

---

## 四、与道歉文档的关系

若此前因上述任一点（如初始检测用了 flow tick 或非主线程、INITIAL_STATE_DETECTION 文档未同步、square_sampler 路径或 JSON 结构写死/改坏、game_state_events 的 detected_regions 键名或路径假定错误）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
