# LogMonitor 与 LogAnalyzer 调用链及未整合原因

## 1. 调用链总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LogMonitor (log_monitor.py)                                                  │
│ - 职责：读 ROSBOT 日志文件、watchdog/轮询、每行 ColorPrint + 调 analyze_log_line │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ set_log_file() ◄──── system_initializer（启动时）
         │                      rosbot_task_processor（通过 log_monitor_api）
         │
         │ check_logs() ◄────── tick_driver.on_tick() 每 1s
         │
         │ get_last_log_modified_time() ◄── rosbot_flow_f3_log_timeout（F3 超时）
         │                                   rosbot_extension_panel（UI 同步）
         │
         │ stop_watching() ◄─── system_initializer（shutdown）
         │
         └── _read_and_process_new_lines()
                   │
                   ├── ColorPrint.info(prefix + line)   # 打印 [ROSBOT] / [ROSBOT~Xs] + 行内容
                   └── analyze_log_line(line)  ──────────────┐
                                                             │
┌─────────────────────────────────────────────────────────────────────────────┐
│ LogAnalyzer (log_analyzer.py)                                                 │
│ - 职责：解析行、更新 game_state、触发 login_try/smart_echo/vendor_loop 等      │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ analyze_log_line(line) ◄── 仅由 log_monitor 在每行调用（见上）
         │
         │ get_log_analyzer() 仅内部使用，用于 analyze_log_line → .analyze_line(line)
         │
         │ register_login_try_callback(cb) ◄── d3_macro_controller（启动时注册 handle_login_try）
         │
         └── 内部依赖：game_interface_data, rosbot_manager, rosbot_ui_automation,
                      smart_echo, CONFIG, i18n_manager（无 log_monitor）
```

## 2. LogMonitor 调用方明细

| 调用方 | 使用的 API | 用途 |
|--------|------------|------|
| `system_initializer` | `set_log_file(LOGS_FILE_PATH)` | 启动时设置监控文件 |
| `system_initializer` | `get_log_monitor().stop_watching()` | 关闭时停止 watchdog |
| `rosbot_task_processor` | `set_log_file(self.log_file_path)`（经 log_monitor_api） | 启动 ROSBOT 监控时设置路径 |
| `tick_driver` | `log_monitor.check_logs()` | 每 1s 轮询（无 watchdog 时） |
| `rosbot_flow_f3_log_timeout` | `get_last_log_modified_time()` | F3 日志超时判断 |
| `rosbot_extension_panel` | `get_last_log_modified_time()` | UI 与日志时间同步 |
| `log_monitor_api` | `_get_monitor()` → set_log_file / set_rosbot_running | 对外薄封装，避免调用方直接 import log_monitor |
| `timer_manager` | 任务名 `log_monitor` | 排序时让 log_monitor 优先执行 |

## 3. LogAnalyzer 调用方明细

| 调用方 | 使用的 API | 用途 |
|--------|------------|------|
| `log_monitor` | `analyze_log_line(line)` | 每读一行调用一次（唯一“推”行入口） |
| `d3_macro_controller` | `register_login_try_callback(cb)` | 注册“Login try”日志出现时的回调 |
| `log_panel` / `rosbot_extension_panel` | 无直接调用 | 仅在 UI 过滤/strip 时识别 "[LogAnalyzer]" 前缀 |

说明：`get_log_analyzer()` 仅在 `log_analyzer` 模块内部被 `analyze_log_line()` 使用，无外部调用。

## 4. 依赖方向

- **log_monitor** → 依赖 **log_analyzer**（`from d3utils.log_analyzer import analyze_log_line`）。
- **log_analyzer** 不依赖 log_monitor，依赖：pycore、providor、share、d3utils.rosbot_manager / rosbot_ui_automation / smart_echo / i18n_manager 等。

因此只有“Monitor 调 Analyzer”的单向依赖，无循环。

## 5. 为何没有整合为一个模块

1. **职责分离**
   - **LogMonitor**：IO 与调度——文件路径、watchdog/轮询、读取新行、打印（ColorPrint）、把每行交给分析。
   - **LogAnalyzer**：解析与副作用——正则/规则、更新 game_state、触发 login_try、smart_echo、vendor_loop 等。  
   合并后一个模块既管“读与推”又管“解析与业务”，职责混杂。

2. **调用方需求不同**
   - 需要“监控”的：只要 `set_log_file`、`check_logs`、`get_last_log_modified_time`、`stop_watching`，不关心分析逻辑。
   - 需要“分析”的：只有 controller 注册 `register_login_try_callback`；行数据由 log_monitor 唯一注入。  
   若合并，同一模块会同时暴露“文件/时间”API 和“回调注册”API，边界不清晰。

3. **避免循环依赖**
   - 当前 Analyzer 不依赖 Monitor，Analyzer 内部若将来需要“当前监控路径”等信息，可继续通过参数或事件注入，而不是 import log_monitor。
   - 若合并为一个模块，将来在“分析逻辑”里引用“监控状态”容易形成模块内环或与 timer/flow 的环。

4. **测试与复用**
   - 分析逻辑可单独对“单行字符串”做单元测试，不依赖文件或 watchdog。
   - 监控逻辑可单独测“文件变化 → 读行 → 调用某 callback”，用 mock 替代真实分析。

5. **与现有架构一致**
   - 文档（如 DESIGN_DETAIL.md、FLOW_ARCHITECTURE_DIRECTORY.md）已约定：log_monitor 负责读日志并调用 `analyze_log_line`；log_analyzer 负责事件与状态。保持两模块与约定一致。

## 6. 小结

- **LogMonitor**：唯一写入日志路径、轮询/监听文件、按行打印并调用 `analyze_log_line`；被 system_initializer、tick_driver、rosbot_flow_f3、rosbot_extension_panel、log_monitor_api 等使用。
- **LogAnalyzer**：唯一入口是 log_monitor 的 `analyze_log_line(line)`，外加 controller 的 `register_login_try_callback`；不依赖 log_monitor。
- **未整合**：职责不同（IO/调度 vs 解析/状态与回调）、调用方不同、避免循环依赖、便于单测与复用，且符合现有设计约定。
