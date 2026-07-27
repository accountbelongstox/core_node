# TTS 服务生命周期

## 1. 当前架构

Qwen3TTS 可运行于隔离环境/进程，但控制和进度统一走 RPC v2 WebSocket；HTTP synthesis 已废弃。

~~~text
pyctl lifecycle
  └─ public Python RPC v2 WS client
      └─ Qwen isolated FastAPIRPCServer
          ├─ capability/model lifecycle
          ├─ synthesis operation worker
          └─ pycore/database repositories + outbox
~~~

launcher/environment mechanics 在 pyutils，应用编排在 pyctl，持久化在 database；TTS 状态不得进入 pyfoundations。

## 2. 启动

1. 解析配置和隔离环境。
2. 幂等 launch/attach。
3. 使用稳定 service client_id 打开 WS。
4. 完成 hello/welcome；onopen 不算 ready。
5. 调 qwen.health、qwen.capabilities。
6. 必要时启动/加入 model-load operation。
7. 接收主动 load progress。
8. model operation 成功后才标 synthesis ready。

启动使用 absolute deadline 和结构化错误；model load 不阻塞 UI。

## 3. 合成

qwen.synthesis.start 按 capability revision 和 speaker 逐 item 校验，创建持久 operation，快速返回 operation_id。item 报 queued/started/progress/completed/failed/skipped/cancelled。

事件含 client_id、event_id、seq、operation_id、item_key、causation_id、revision。不支持 speaker 只失败对应 item并返回 requested/supported speakers，不变成 generic 500。

音频通过公共 artifact/cache 临时文件 + 原子替换，结果给 validated reference、hash、size、MIME、duration、expiry，不放大 base64。

## 4. 重连/重启

client ACK 已接纳事件；未 ACK delivery 留 database 并 replay。snapshot 按 revision 校准。idempotency 防 unknown outcome 后重复合成。

service 重启将 active item 判 resumable/retryable/interrupted 并记录。UI 重启从 Pycore 取状态。

## 5. 关闭

1. 停止接新 synthesis。
2. cooperative cancel/drain。
3. 持久化 terminal/interrupted。
4. 已 commit outbox 可继续留待 replay。
5. 等待 synthesis task、callback task、worker。
6. 依所有权顺序关闭 RPC、model、Qt/VSync。
7. pyctl 停隔离服务。

QDxgiVSyncService not destroyed in time 不能忽略。超时日志必须列 service/model/worker/task 所有者、状态和 deadline，并返回 shutdown_timeout，不能用强杀掩盖资源泄漏。

## 6. health

报告 process、handshake、model、queue、active operations、capability revision、outbox lag、last error。HTTP port reachable 不是 TTS ready。

## 7. 禁止

- Qwen HTTP synthesis/fallback。
- 私有 Qwen WS protocol。
- 浏览器 progress 真相。
- foundations 中 database/repository。
- 静默 speaker 替换。
- 大 binary event。
- reconnect 延长原 command deadline。