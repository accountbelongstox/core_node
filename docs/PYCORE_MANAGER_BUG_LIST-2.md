# Pycore Manager 当前修复基线

本文是第三轮修复后的精简总单。历史分析与已完成实现细节已删除；另一个 AI 只执行 docs_fix 中的活动批次。

## 1. 已锁定架构

1. Pycore 的所有持久化统一归 pycore/database。
2. pycore/pyfoundations 只放系统最底层原语，不放仓储、SQLite、业务状态、UI 状态、任务状态或数据库生命周期。
3. database 只依赖 pyfoundations；pyutils 可依赖 database 和 pyfoundations；pyctl 负责更高层编排。
4. pycore/database 之外禁止直接导入 sqlite3 或拥有数据库驱动、建表、迁移、仓储。
5. RPC v2 WebSocket 是调用和服务端主动事件的唯一新增全双工通道。
6. 持久事件以 client_id + event_id 定址，以 seq 排序，显式 ACK，断线后重放。
7. UI 进度和工作流状态以服务端持久快照为准；浏览器内存和 localStorage 只能做显示缓存。
8. Qwen3TTS 必须迁到公共 RPC v2 WebSocket；功能对齐后删除合成 HTTP 路径。
9. 复用并重构现有 pycore/database 和 pycore/pyutils/rpc_v2，禁止并行造第二套框架。

## 2. 第三轮已完成，勿重做

- Agent History 导入头和循环依赖修复。
- tick_extract、tick_pipeline 已从 Agent History RPC handler 移出。
- get_status 已取消全量 fragment 扫描。
- 可选路由缺失会隔离为 feature_unavailable。
- 已有初版 state store、operation service/events/routes、Agent History pipeline/checkpoint。
- 已有 Qwen 运行时 speaker 能力及 batch item 失败隔离。
- 不支持的 speaker 已能返回 supported speakers。

以上只是基线。保留正确行为，纠正错误分层并完成集成。

## 3. 仍需修复

| ID | 问题 | 批次 |
|---|---|---|
| BOOT-01 | pycore/__init__.py 曾出现 try 块缩进缺失，导致模块入口整体 IndentationError；迁移时必须保持入口可导入，不能用局部延迟导入掩盖。 | V10 |
| DB-01 | 初版 SQLite state store 错放在 pyfoundations/state_store，并绕过现有 database。 | V4 |
| DB-02 | pycore/database/__init__.py 存在不完整/错位导入，无法作为稳定公共入口。 | V4 |
| OP-01 | operation、items、events 尚未全部由标准 database 仓储和事务托管。 | V5 |
| AH-01 | Agent History 尚缺详细启动日志、每 item 双语/音频进度、结果及重连恢复。 | V6 |
| RPC-01 | 多个 RPC v2 客户端的 ready、ID、deadline、ACK、重连和 callback 语义不一致。 | V7 |
| RPC-02 | 服务端 pending、offset、request event/callback 仍有内存态，存在丢失、重复和竞态。 | V7 |
| RPC-03 | 缺少持久的 notify_client(client_id, event_id, ...) 主动通知架构。 | V7 |
| TTS-01 | Qwen3TTS 合成控制仍走 HTTP，无法满足主动进度和断线重放。 | V3 |
| TTS-02 | QDxgiVSyncService not destroyed in time 暴露服务/模型 worker 关闭所有权和超时诊断不足。 | V3 |
| LOG-01 | Pycore 不能可靠镜像 Laravel 最后更新日志并以持久 cursor 返回 UI。 | V8 |
| UI-01 | 其余 UI 页面尚未统一 operation、snapshot、重连和 callback 模型。 | V9 |
| LAYER-01 | pyfoundations 中仍有数据库、策略、launcher、device、storage 等较高层模块。 | V10 |

## 4. 依赖演算

~~~text
V4 → V5 → V7 → V3、V6、V8 → V9 → V10
~~~

V3、V6、V8 在 V7 后可并行。V10 最后做广泛分层迁移；但 state_store 的移出属于 V4，必须最先完成。

## 5. 跨批次数据契约

database 至少提供：

- operations、operation_items、operation_events；
- ui_state_snapshots；
- remote_log_cursors；
- rpc_event_outbox、rpc_client_deliveries、rpc_client_offsets；
- rpc_command_idempotency。

长任务统一有 operation_id；列表单元统一有稳定 item_key；事件统一有 event_id、seq、type、revision、timestamp、payload。状态变更与 outbox 写入必须同一事务提交。

RPC 身份：

- client_id：跨重连稳定的逻辑客户端；
- connection_id：单次 WebSocket 会话；
- event_id：不可变事件身份；
- seq：该 client 的投递序号；
- causation_id：触发该事件的请求/事件；
- idempotency_key：防止命令重复执行。

UI 首次加载或重连必须：完成 welcome；按 last_acked_seq 重放；读取快照；仅合并较新 revision；ACK 已接纳事件；从服务端重建终态结果。

## 6. 总验收

- 进程重启后 operations、items、events、UI snapshot、RPC outbox/offset、Laravel cursor 均保留。
- 断线重连可收到遗漏事件；重复 event_id 不会重复应用。
- 新 UI 实例不依赖旧浏览器内存即可恢复。
- Qwen 模型加载、逐 item 合成和结果全走 RPC v2 WS。
- Laravel 暂时不可用时仍返回最后成功镜像及 stale/error 信息。
- pyfoundations 中无数据库和较高层业务模块。
- Qwen/Qt 关闭时能等待并诊断 QDxgiVSyncService、worker、model 资源所有权。
- 新功能均不依赖 SSE。

## 7. 活动文档

- docs_fix/FIX_V3.md：Qwen3TTS RPC v2 WS。
- docs_fix/FIX_V4.md：database state store 地基。
- docs_fix/FIX_V5.md：通用 operation service。
- docs_fix/FIX_V6.md：Agent History operation 完成。
- docs_fix/FIX_V7.md：RPC v2 语义、事件流、callback。
- docs_fix/FIX_V8.md：Laravel 日志镜像。
- docs_fix/FIX_V9.md：其余 UI 页面迁移。
- docs_fix/FIX_V10.md：pyfoundations 分层清理。
- docs_fix/FIX_INDEX.md：顺序、依赖和交付规则。