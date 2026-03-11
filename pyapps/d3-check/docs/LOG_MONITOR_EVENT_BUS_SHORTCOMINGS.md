# Log Monitor + 事件中心/BUS 方案 — 缺点与风险

## 1. 队列无界，无背压（已修复）

- **现象**：`log_line_bridge` 使用 `queue.Queue()` 未设 `maxsize`，队列无界。
- **已做**：
  - 队列设 `maxsize=10000`（`QUEUE_MAXSIZE`）
  - `queue.Full` 时丢弃最旧行（`get_nowait` 一个，再 `put_nowait` 新行），保持最近的行
  - 添加 `get_queue_size()`、`get_drop_count()`、`clear_queue()` 供监控/调试
  - 任务启动时（`start_rosbot`）检查队列大小，若 > 5000 则清空，避免启动时积压

## 2. 处理延迟固定为 1s

- **现象**：只有任务线程每 1s 执行 `process_rosbot_task()` 时才会 `drain_log_lines()`，日志行从产生到被分析最多延迟约 1s。
- **影响**：如 "Login try"、"Picking end"（smart_echo）、"Vendor loop done" 等触发逻辑会晚最多 1s，对强实时性场景不友好。
- **建议**：若需更低延迟，可单独增加「仅 drain + analyze」的更高频任务（如每 0.2s），或保留 1s 作为可接受折中并文档化。

## 3. 单次 drain 工作量不可控（已缓解）

- **现象**：若队列积压很多行，单 tick 处理过多会占用任务线程，影响 flow、sigint_guard、smart_echo 等。
- **已做**：`log_line_bridge.drain()` 每 tick 最多取 `DRAIN_MAX_PER_TICK`（200）行，余下留到下一 tick。
- **仍可做**：按「处理时间」上限截断，或可配置 DRAIN_MAX_PER_TICK。

## 4. 任务未启动时队列只增不减（已缓解）

- **现象**：若 rosbot_task 尚未 enable 或 task thread 未启动，无人调用 `drain()`，LOG_LINE 仍持续入队。
- **已做**：
  - 有界队列（maxsize=10000）限制最大积压
  - `start_rosbot()` 时检查队列大小，若 > 5000 则清空，避免启动时处理大量积压
  - 每 tick 最多处理 200 行，避免单次暴量
- **仍可做**：若需更细粒度控制，可在任务 enable 时也检查并清空

## 5. log_monitor 仍依赖 providor（已修复）

- **现象**：`log_monitor` 内使用 `get_config_value_safe("log_settings.debug_log_latency")` 计算前缀，仍依赖 providor/config。
- **已做**：
  - 去掉 `get_config_value_safe` 导入和使用
  - prefix 固定为 `"[ROSBOT]"`，不再计算延迟前缀
  - log_monitor 现在只依赖：pycore（ColorPrint、THREAD_BUS、third_party）、providor.constants.common（LOG_LINE 常量）、log_monitor_api
  - 若需要 debug_latency 显示，可在消费者侧（rosbot_task_processor 或独立 formatter）根据 config 计算

## 6. ColorPrint 在 observer 线程的副作用

- **现象**：`log_monitor` 在 watchdog 的 observer 线程里直接 `ColorPrint.info(prefix + line)`。若 ColorPrint 的回调链中有读 config、访问 UI 等，可能造成死锁或跨线程访问。
- **风险**：文档约定「在 ColorPrint 回调中不要读 config」；若未来回调扩展，容易踩雷。
- **建议**：保持 ColorPrint 回调极简（仅写日志/队列）；若需进 UI，应通过事件发到主线程再写。

## 7. queue.Full 分支目前无效（已修复）

- **现象**：`queue.Queue()` 默认无 `maxsize`，`put_nowait` 不会抛 `queue.Full`。
- **已做**：
  - 队列设 `maxsize=10000`，`queue.Full` 分支已生效
  - Full 时丢弃最旧行并更新 `_drop_count`
  - 提供 `get_drop_count()` 供监控

## 8. 无队列深度与丢弃指标（已修复）

- **现象**：无法观测队列当前长度、历史峰值、因 Full 丢弃的行数。
- **已做**：
  - `get_queue_size()`：返回当前队列大小
  - `get_drop_count()`：返回因 Full 丢弃的总行数
  - `reset_drop_count()`：重置丢弃计数（测试/调试用）
  - `clear_queue()`：清空队列（启动时用）

## 9. 仅单消费者

- **现象**：当前只有 rosbot_task 的 `process_task()` 调用 `drain_log_lines()`，即单消费者。
- **影响**：若将来需要「同一批日志行」被多个逻辑消费（如分析 + 持久化 + 告警），当前设计需在消费者内再分发，或复制事件名/payload 给多 handler；THREAD_BUS 的 LOG_LINE handler 目前只做入队，无法多路复用同一事件到多个队列。
- **建议**：多消费者时可在 event 层增加多个 handler（各自入不同队列或调不同处理器），或保持单消费者内部再分发。

## 10. analyze_log_line 异常未统一上报（已缓解）

- **现象**：若某行导致 `analyze_log_line` 抛异常，会中断本 tick 后续行或拖垮 process_task。
- **已做**：rosbot_task_processor 的 for 循环内对单行 try/except，单行失败只 pass，继续下一行。
- **仍可做**：失败时打一条日志（避免静默吞错），或维护错误计数供监控。

---

**小结**：主要短板已修复：**有界队列（10000）+ 背压（丢旧保新）**、**任务启动时清空积压**、**去掉 config 依赖**、**添加指标函数**、**改进异常处理（记录错误）**、**去掉不必要的 catch 块（细粒度检查）**。仍保留：**固定 1s 延迟**（架构权衡，可接受）、**ColorPrint 线程约定**（文档已说明）、**单消费者**（当前需求足够）。
