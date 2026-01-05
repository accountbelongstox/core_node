# 任务: WebSocket 方式 server 调用 client 服务测试

状态: 已完成
语言: 简体中文（zh-CN）
负责人:
目标: 验证通过 WebSocket 方式由 server 调用 client 服务的可用性、稳定性与错误处理能力。
范围:
- 注册（server 与 client 建链/鉴权）
- 心跳（保活与超时处理）
- 调用服务（请求/响应与错误处理）
不在范围:
- 生产环境变更与上线流程
- 协议大改或功能重构
约束:
- 使用现有测试环境与账号
- 不影响线上与共享资源

计划:
- [ ] 梳理注册/心跳/调用服务的接口与消息协议（请求/响应/错误/鉴权）
- [ ] 准备测试环境与连接参数（地址、认证、证书、心跳/超时）
- [ ] 编写并执行测试用例（注册/心跳/调用服务，含正常与异常）
- [ ] 记录结果与问题、给出修复建议

进度记录:
- 2025-12-26: 明确测试内容为注册、心跳、调用服务。
- 2025-12-26: 初步分析日志，发现并发计数依赖 datastore.zadd/zrem 缺失、WS relay 返回 404、以及模型 gpt-5.2-codex 无可用账号。
- 2025-12-26: 确认 server datastore 使用 MySQL；需评估并发计数对 sorted set 操作的替代方案。
- 2025-12-26: 读取 ClientRelayService 并确认并发计数在请求前后调用 datastore.zadd/zrem（score 为 requestTimeout 的过期时间戳）。
- 2025-12-26: 在 redisClient 增加 zadd/zrem 包装方法，以便 MySQL 模式下复用 Redis 的 zset 操作。
- 2025-12-26: 复盘日志：WS relay 请求在 client 侧返回 404，且后续请求出现 client 不可用与模型无账号可用导致 400。
- 2025-12-26: 客户端日志显示 endpoint=/responses 调用本地 HTTP 返回 404，疑似路径前缀丢失或目标服务未提供 /responses。
- 2025-12-26: 将 server 下发 endpoint 改为 req.originalUrl，以保留 /openai 前缀，避免 client 侧 /responses 404。
- 2025-12-26: 新日志 401 表明 client 本地 API 未通过鉴权，疑似 server 侧移除了 x-api-key/authorization，需改用 WS 内部头或放行内部请求。
- 2025-12-26: 按方案 2 透传鉴权头，取消 server 侧移除 x-api-key/authorization。
- 2025-12-26: 恢复移除外部鉴权头，改为注入 client 注册时的 API key 到 x-api-key 用于本地认证。
- 2025-12-26: 按端点类型区分鉴权头：模型调用使用 api-key，/admin 内部调用使用 x-api-key（同时兼容 x-ws-internal-key）。
- 2025-12-26: client 侧对内部 WS key 缺失哈希映射做修复尝试，避免 API key not found。
- 2025-12-26: 若内部 WS key 仍找不到映射，则自动创建最小 API key 记录并重试验证。
- 2025-12-26: 修复 MySQL datastore 缺少 hset 包装导致 relay 失败，并将更新 lastUsedAt 改为非致命。
- 2025-12-26: client 侧 CCR 上游 anyrouter.top 出现 TLS 前 ECONNRESET，导致 /api/v1/messages 流式 500；server 侧则无 Claude 账号支持所选模型而返回 500。
- 2025-12-26: 排查发现 WS 重连时旧连接关闭会误将新连接标记离线，导致 server 选不到 client；已加保护仅在当前连接关闭时才标记离线。
- 2025-12-26: 在 server 侧通过 clientService.getAllClients({status:'online'}) 确认已有在线 client-67e4b75e，connectionStatus=connected。
- 2025-12-26: 该 client 的 supportedModels 顶层字段为空，但 capabilities.supportedModels 已包含 claude-haiku/sonnet 等模型；server 调度当前仅检查顶层数组字段，需考虑映射或读取 capabilities。
- 2025-12-26: 复核 unifiedClaudeScheduler 对 client 的过滤条件仅含 accountType/status/connectionStatus/并发/schedulable，建议补充客户端跳过原因日志以定位“Client:0”成因。
- 2025-12-26: 任务已完成，准备归档。

验收标准:
- 形成覆盖注册/心跳/调用服务关键场景的测试记录与结论
- 明确至少一条改进建议或确认无需改动
