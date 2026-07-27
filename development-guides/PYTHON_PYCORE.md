# Pycore 开发规范

## 1. 依赖层

~~~text
pyfoundations
    ↓
database
    ↓
pyutils
    ↓
pyctl
    ↓
feature entrypoints / UI
~~~

依赖可跳过中间层向下，但不能向上。

### pyfoundations

只含最低 OS/runtime 原语：path、platform、process/thread、简单 lock、中立 event primitive、ABI 常量。禁止 database、repository、feature/model policy、launcher service、persistent store、workflow。

### database

拥有 engine、session、model、TableKeys、schema migration、repository、durable cursor、record serializer、transaction。只依赖 pyfoundations。database 外禁止直接 sqlite3、SQLAlchemy engine/session、PostgreSQL driver、CREATE TABLE 或 repository ownership。

全局 record identity、revision、cursor、outbox delivery、idempotency、transaction result 属于 database。

### pyutils

按 domain 放可复用工具，可依赖 pyfoundations/database，不得导入其他 pyutils domain。共享代码只有确为最低原语才下沉 foundations。

典型 domain：rpc_v2、tts、launcher、heartbeat、device、text、storage、security、dependencies、python_env。

### pyctl

编排 service、lifecycle、feature policy、application action。entrypoint 只做薄委派。

## 2. import

- import 在文件顶部。
- 重构 cycle，不用局部/延迟 import 隐藏。
- package __init__ 只导出稳定 symbol，不做 optional load、service start、package install、model load、DB mutation。
- foundations 不导入 database/pyutils/pyctl/feature。
- database 不导入 pyutils/pyctl/feature。
- standalone worker 可导入依赖安全的 rpc_v2/database public surface，不使用触发整包初始化的 from pycore import。

## 3. persistence

统一使用 pycore/database 的 DatabaseManager、BaseModel、TableKeys、serializer/converter、migration、repository；先复用现有组件。

必须：显式 migration、UTC、state + outbox 原子、repository 管事务、有界 JSON、revision/idempotency constraint、database 管并发/shutdown、migration 可重启、无 import-time schema。

UI state、job/item/progress、event outbox、client offset、remote cursor、持久 config、artifact metadata 均属于 database。

## 4. RPC v2

WebSocket 是 RPC + server event canonical transport；SSE 只兼容。

client_id 跨重连；connection_id 单 socket；event_id 标识事件；seq 为 per-client 顺序；ACK 含 client_id/connection_id/event_id/seq。先写 database outbox 再 send，未 ACK 重连重放。

welcome 后才 ready；onopen 不算。call 有重连不能延长的 absolute deadline。callback 多订阅并隔离同步异常和 async rejection。

复用公共 Python/browser client；feature 不自建 WS、reconnect、callback map、pending table、event cursor。

## 5. operation/UI

长任务统一 operation service，在 handler 外执行。operation/item transition、progress、terminal result、events 持久化。

UI 通过 snapshot + replay，以 event_id/revision 校准。浏览器只存 presentation cache；新 UI 必须从 Pycore 恢复。

## 6. Qwen3TTS

隔离进程也使用 RPC v2 WS，复用 Python client 和 FastAPIRPCServer。model load/synthesis 是异步 operation，通过 client_id + event_id 主动通知。禁止 HTTP synthesis fallback。

speaker 来自 active model；不支持时是结构化 item error。audio 使用受控 artifact reference，不放大 JSON。

## 7. launcher/heartbeat/device

launcher implementation/config/provider → pyutils/launcher；heartbeat scheduling/service → pyutils/heartbeat；device service → 现有 pyutils/device；application task orchestration → pyctl。只有最低 process/thread/path primitive 可留 foundations。

## 8. modularity

源码超过 800 行要拆；先找已有组件。分开 codec、persistence、service、orchestration、UI adapter。禁止用 version suffix 复制框架。

## 9. errors/logs

稳定英文 error code + structured details。日志带 correlation identity，不含 secrets、credential、完整敏感 prompt、大 binary。transport/domain/cancel/timeout/unknown outcome 分开。

## 10. 修改清单

- 依赖方向正确。
- 复用已有组件。
- database 外无直接驱动。
- 无 local-import cycle。
- durable mutation/event 原子。
- deadline/idempotency 明确。
- UI 状态可重启/重连。
- cutover 后删除旧 transport/store/import。