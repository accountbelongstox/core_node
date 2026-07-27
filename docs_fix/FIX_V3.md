# FIX V3：Qwen3TTS RPC v2 WebSocket 迁移

## 1. 目标

以公共 RPC v2 WebSocket 客户端/服务端替换 Qwen3TTS HTTP 合成控制。保留已完成的 speaker 能力契约和逐 item 失败隔离，新增以 client_id + event_id 关联的持久主动事件。

## 2. 前置

V4、V7 完成后执行。V7 未完成时禁止自建 Qwen 私有 WS 协议。

## 3. 勿重做

保留运行时 speaker discovery、supported speakers 返回、batch item 独立失败和隔离环境。只为公共 RPC/operation 契约做适配。

## 4. 目标拓扑

~~~text
Pycore 主进程
  PythonRpcV2WsClient
       │ 单一已握手 WS
       ▼
Qwen 隔离进程
  FastAPIRPCServer + 公共 rpc_v2 routes
       ├─ model worker
       ├─ synthesis worker
       └─ pycore/database operation + outbox
~~~

新增可复用 pycore/pyutils/rpc_v2/client/python_ws_client.py。不得复制浏览器客户端状态机。

## 5. RPC routes

| route | 行为 |
|---|---|
| qwen.health | 返回进程、协议、模型、队列、能力和最后错误。 |
| qwen.capabilities | 返回模型实际 speakers/languages/formats/limits/revision。 |
| qwen.model.load | 幂等启动或加入模型加载 operation，立即返回 operation_id。 |
| qwen.synthesis.start | 逐 item 校验、持久化、入队，立即返回 operation_id。 |
| qwen.synthesis.status | 返回权威 operation/item 快照。 |
| qwen.synthesis.cancel | 请求取消并返回新 revision。 |

写请求携带 client_id、request_id、idempotency_key、deadline_at。错误使用稳定 code，不解析文本。

## 6. 主动事件

- qwen.model.load.started/progress/completed/failed
- qwen.synthesis.queued
- qwen.synthesis.item.started/progress/completed/failed
- qwen.synthesis.completed/failed/cancelled

事件必须含 client_id、event_id、seq、operation_id、item_key（适用时）、causation_id、revision、timestamp。一个 item 失败不得结束分发或删除成功结果。

## 7. Speaker 契约

capabilities 的 speaker 集合来自当前模型并带 revision。start 按同一 revision 逐 item 校验。

不支持 Emma 等 speaker 时：

- continue 策略只失败该 item；
- code 为 unsupported_speaker；
- 返回 requested_speaker、supported_speakers；
- 不升级成传输 500；
- 不静默换 voice。

能力 revision 变化返回 capability_revision_conflict，让调用者刷新。

## 8. 音频结果

事件 JSON 不放大 base64。worker 通过公共 artifact/cache 以临时文件 + 原子替换写入。终态返回受控 token/path reference、sha256、bytes、MIME、duration、sample rate/channels（可用时）、created_at、expires_at。

## 9. 生命周期

只有 WS welcome 成功且 qwen.health 成功才 ready；socket onopen/端口开放不算。模型加载异步报告进度。

重连使用稳定 service client_id，按 last ACK 重放，校准 operation 快照，恢复订阅；相同 idempotency 不重复合成。对齐后删除旧 HTTP synthesis route/client/health 假设和 fallback，不保留双写入口。

隔离 venv 中使用的 rpc_v2 必须依赖安全，不得触发 pycore 整包高层导入；持久化仍走 database。

## 10. 关闭修复

QDxgiVSyncService not destroyed in time 必须按所有权修复，而非忽略日志：

1. 禁止新 job；
2. 请求 worker/model cooperative stop；
3. 等待 synthesis task、callback task、VSync/Qt 资源；
4. 记录未退出对象、线程、task 和 deadline；
5. 持久化 interrupted/cancelled 结果；
6. 关闭 RPC session、model、Qt/VSync，再退出进程；
7. 超时返回稳定 shutdown_timeout，不用强制退出掩盖泄漏。

## 11. 顺序

1. 复用 V7 Python WS client 和 notify_client。
2. 注册 Qwen 公共 routes。
3. 适配已有 capabilities。
4. 适配 operation/job/item。
5. 发布持久模型/合成事件。
6. 主进程 adapter、health 切 WS。
7. UI 切 snapshot + replay。
8. 删除 HTTP 合成。
9. 补齐有序 shutdown。

## 12. 验收

- Qwen 合成控制无 HTTP。
- start 快速返回 operation_id。
- UI 关闭再打开可恢复模型和逐 item 进度。
- 重启/重连不会重复幂等命令。
- Emma 产生结构化单 item 失败并列 supported speakers。
- 音频事件只有引用和元数据。
- 主动事件以 client_id + event_id 投递并重放。
- 正常关闭不再遗留 QDxgiVSyncService；超时有具体所有者诊断。