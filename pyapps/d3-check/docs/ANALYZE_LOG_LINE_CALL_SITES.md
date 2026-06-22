# analyze_log_line 调用位置

## 函数定义

**文件**：`d3utils/log_analyzer.py`  
**位置**：第 297-299 行

```python
def analyze_log_line(line: str) -> bool:
    """Analyze a log line and update game state"""
    return get_log_analyzer().analyze_line(line)
```

**内部实现**：调用 `get_log_analyzer().analyze_line(line)`，实际分析逻辑在 `LogAnalyzer.analyze_line()` 方法中。

---

## 调用位置

### 1. log_monitor.py（唯一实际调用位置）

**文件**：`d3utils/log_monitor.py`  
**位置**：第 181 行（在 `_read_and_process_new_lines()` 方法中）  
**导入**：第 28 行 `from d3utils.log_analyzer import analyze_log_line`

**调用上下文**：
```python
def _read_and_process_new_lines(self) -> None:
    """Read new content from last_position; per line: ColorPrint then analyze_log_line. Called by watchdog."""
    # ... 读取文件 ...
    for line in lines:
        if not line or not line.strip():
            continue
        ColorPrint.info(f"[ROSBOT] {line}")
        try:
            analyze_log_line(line)  # ← 唯一调用位置（实时处理）
        except Exception as e:
            ColorPrint.red(f"[LogMonitor] analyze_log_line failed for line (len={len(line)}): {e}")
```

**调用频率**：实时（文件变更时立即调用）  
**调用时机**：watchdog observer 线程检测到文件变更时  
**数据来源**：直接从日志文件读取的新行

---

## 调用链

```
watchdog observer thread (独立线程)
  → log_monitor._read_and_process_new_lines()
  → for line in lines:
       ColorPrint.info("[ROSBOT] " + line)  [打印]
       analyze_log_line(line)                [实时分析] ← 唯一调用位置
         → game_state 更新
         → login_try callback
         → smart_echo
         → vendor_loop
         → 等等
```

---

## 其他相关

### 废弃文件（不参与实际调用）

**文件**：`utils/_obsolete_analyzer_log.py`  
**位置**：第 83 行  
**说明**：旧版实现，已废弃，文件名带 `_obsolete_` 前缀，不参与当前调用链。

### 已废弃的调用路径

**文件**：`d3utils/rosbot_task_processor.py`  
**说明**：旧架构中在任务线程调用 `analyze_log_line`，已废弃。当前架构中 rosbot_task_processor 只处理 flow 和超时检测，不处理日志。

---

## 总结

- **唯一调用位置**：`log_monitor._read_and_process_new_lines()`（第 181 行）
- **调用频率**：实时（文件变更时立即调用）
- **调用线程**：watchdog observer 线程（独立线程）
- **数据流**：watchdog → 直接读取文件 → `analyze_log_line`（无队列、无延迟）
- **异常处理**：单行失败记录错误但不中断整批处理
- **输入验证**：检查 `line` 是否为有效字符串

---

## 设计说明

`analyze_log_line` 是日志分析的**唯一入口**，所有日志行都由 watchdog observer 线程实时调用 `analyze_log_line` 进行分析。这确保了：

1. **实时处理**：日志行一出现就立即分析，无延迟
2. **架构简单**：直接调用，无队列、无事件中心中转
3. **统一处理**：所有日志行都经过同一个分析入口，便于维护和调试
4. **线程安全**：`analyze_log_line` 必须在 observer 线程中线程安全执行（不能阻塞 config worker 或 UI）
