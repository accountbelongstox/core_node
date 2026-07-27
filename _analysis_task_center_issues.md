# 任务中心 / Pycore↔Laravel / Agent-History 问题分析清单

> 分析日期: 2026-07-25。逐步追加。

## 问题概览(用户报告)

1. `PycoreHealth.ts:141 [pycore-health] ui.ping failed (attempt 1/2)` — UI 通过 RPC v2 连 pycore 失败。
2. `/pycore-manager/queue-center` 的 assist+translation: `RPC timeout after 30000ms: ui.task_center.set_queue_center_control`。
3. pycore 和 laravel 通信一直转圈 `Loading overview…`;任务中心数据不共享;每个子功能 ON/OFF 卡住,没有和 laravel 交互数据。
4. wordnew (UI) 需要在 `/wordnew#/book-reader`、`/wordnew#/shelf`、`/wordnew#/library/` 中通知 laravel 调整队首,让 pycore 优先处理。
5. `http://43.163.112.77:9000/static/app_qy_v1/audio/agent_history/en/article_85c557d9-....mp3` 404 — `/pycore-manager/agent-history` 需要同时将中英文对照和音频传给 laravel;wordnew 能实时得到推送。
6. 修改路由等为短文,和文章合并;`sys:init` 中幂等修改。

---

## 发现 #1 [致命] task_center_controller.py 缺少 `import time`

**文件:** `pycore/callmodule/controllers/local_processing/task_center_controller.py`

文件头 import 列表(33–73 行)**没有 `import time`**,但以下位置直接调用:

- `_fetch_assist_overview()` L170: `now = time.monotonic()`(及 L203、L207、L247)
- `_capture_slice()` L552: `start_time = time.monotonic()` — **在 try 块之外**,异常不会被捕获
- `get_queue_center_snapshot()` L1036: `request_id = str(int(time.time() * 1000))`

**后果链:**
- `ui.task_center.get_queue_center_snapshot` RPC → `get_queue_center_snapshot()` L1036 立刻抛 `NameError: name 'time' is not defined` → handler 无返回值/异常 → 前端 `Loading overview…` 永远转圈。
- `ui.task_center.get`(get_task_center)本身不直接用 time,但 UI 主要调 snapshot。
- `set_queue_center_control` 路径虽不直接用 time,但若 RPC 框架在同一事件循环里被前一个 NameError 卡死,或前端先调 snapshot 失败,会表现为 30s timeout。

**修复:** 文件头加 `import time`。

---
