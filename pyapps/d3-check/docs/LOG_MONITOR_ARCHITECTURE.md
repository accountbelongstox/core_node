# Log Monitor 架构说明

## 架构概述

日志监控采用**实时处理**架构：watchdog observer 线程读取日志文件后，立即调用 `analyze_log_line` 进行分析，不经过队列延迟。

---

## 数据流

```
watchdog observer thread (独立线程)
  ↓
log_monitor._read_and_process_new_lines()
  ↓
for each line:
  1. ColorPrint.info("[ROSBOT] " + line)  [打印]
  2. analyze_log_line(line)               [实时分析]
     → game_state 更新
     → login_try callback
     → smart_echo
     → vendor_loop
     → 等等
```

**关键点**：
- **实时处理**：日志行一出现就立即分析，无延迟
- **单线程**：所有日志分析都在 watchdog observer 线程执行
- **无队列**：不经过 log_line_bridge 队列，直接调用

---

## 模块职责

### log_monitor.py
- **职责**：读取日志文件、打印、调用 `analyze_log_line`
- **线程**：watchdog observer 线程（独立）
- **依赖**：pycore（ColorPrint、watchdog）、log_analyzer（analyze_log_line）
- **不依赖**：THREAD_BUS、log_line_bridge、rosbot_task_processor

### log_analyzer.py
- **职责**：分析日志行，更新 game_state，触发业务逻辑（login_try、smart_echo、vendor_loop 等）
- **调用线程**：watchdog observer 线程（通过 log_monitor）
- **线程安全要求**：
  - 必须线程安全（可能在 observer 线程调用）
  - 不能阻塞 config worker（直接 `CONFIG.get()` 读字典 OK，不要用 `get_config_value` 阻塞）
  - 不能阻塞 UI（窗口操作应快速完成或异步）

### rosbot_task_processor.py
- **职责**：1s tick 驱动、flow（超时检测等）
- **不处理日志**：日志分析由 log_monitor 实时完成
- **线程**：任务线程（rosbot_task）

---

## 与旧架构的对比

### 旧架构（已废弃）
```
watchdog → THREAD_BUS.trigger_event(LOG_LINE) → log_line_bridge 队列
  → 任务线程 drain → analyze_log_line
```
- **问题**：延迟约 1s（需等任务线程 tick）
- **问题**：队列可能积压
- **问题**：架构复杂（事件中心 + 队列 + 任务线程）

### 新架构（当前）
```
watchdog → analyze_log_line（实时）
```
- **优势**：实时处理，无延迟
- **优势**：架构简单，直接调用
- **优势**：无队列积压风险

---

## 线程安全注意事项

`analyze_log_line` 在 watchdog observer 线程执行，需确保：

1. **CONFIG 读取**：使用 `CONFIG.get()` 直接读字典（不阻塞），不要用 `get_config_value()`（可能阻塞 config worker）
2. **game_state 更新**：game_state 的 set 方法应该是线程安全的（单变量赋值或原子操作）
3. **窗口操作**：`get_rosbot_manager()`、`do_smart_echo_pause_after_complete()` 等应快速完成，避免长时间阻塞 observer 线程
4. **回调**：`_login_try_callback()` 应快速执行，不要阻塞

---

## 启动流程

1. `system_initializer` 调用 `log_monitor_module.set_log_file(LOGS_FILE_PATH)`
2. log_monitor 启动 watchdog observer，开始监控文件变更
3. 文件变更时，`_read_and_process_new_lines()` 读取新行并实时调用 `analyze_log_line`
4. rosbot_task_processor 独立运行（1s tick），只处理 flow 和超时检测，不处理日志

---

## 相关文件

- `d3utils/log_monitor.py`：日志监控主模块
- `d3utils/log_analyzer.py`：日志分析逻辑
- `d3utils/rosbot_task_processor.py`：任务线程（不处理日志）
- `d3utils/log_line_bridge.py`：已废弃（不再使用）
