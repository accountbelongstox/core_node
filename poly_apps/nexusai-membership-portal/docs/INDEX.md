# 文档索引
<!-- 语言：简体中文（zh-CN）。创建/更新文档时翻译标题/标签。 -->

这是项目文档的单一入口。

进行中的任务
- [2025-12-26 Clients 账户列表为空修复](tasks/2025-12-26-client-accounts-list-empty.md)
- [2025-12-26 Client 账户字段补齐（阻塞）](tasks/2025-12-26-client-accounts-field-completion.md)
- [2025-12-26 Clients 账户列表复用方案](tasks/2025-12-26-client-accounts-reuse-plan.md)
- [2025-12-27 修复 /admin-next/app 空白页](tasks/2025-12-27-admin-next-app-blank.md)

待办任务
- [2025-12-24 支付沙箱与回调模拟联调（支付宝/微信）](tasks/2025-12-24-payment-sandbox-callback-integration.md)
- [2025-12-24 VPN 访问控制与资源隔离补充及压测](tasks/2025-12-24-vpn-access-control-ops-tests.md)
- [2025-12-24 监控指标落地（WS/VPN 状态、支付对账、MySQL 健康）](tasks/2025-12-24-monitoring-metrics-coverage.md)
- [2025-12-24 同步与发布回滚/开关策略复核](tasks/2025-12-24-release-rollback-switch-review.md)

关键决策
- （暂无）

备注 / 调研
- [CCR 账户 supportedModels 配置位置](notes/ccr-supported-models-admin-ui.md)
- [宿主机运行源码 + Docker 基础设施部署说明](notes/server-deploy-host-app-docker-infra.md)

归档
- [2026-01-02 生成 .env.server.example](archive/2026-01/2026-01-02-env-server-example.md)
- [2026-01-02 生成 .env.client.example](archive/2026-01/2026-01-02-env-client-example.md)
- [2026-01-02 宿主机源码 + Docker 基础设施部署说明](archive/2026-01/2026-01-02-host-app-docker-infra-deploy-guide.md)
- [2026-01-02 生成 infra/docker-compose.yml 与 infra/nginx.conf 模板](archive/2026-01/2026-01-02-infra-docker-compose-template.md)
- [2026-01-02 主机运行源码 + Docker 化 Redis/MySQL/Nginx 方案](archive/2026-01/2026-01-02-host-app-docker-infra.md)
- [2026-01-02 Linux 服务器 MySQL 部署方案（Docker vs 手工）](archive/2026-01/2026-01-02-server-mysql-deployment-plan.md)
- [2026-01-02 Claude 代理 TLS socket 未捕获异常排查与修复](archive/2026-01/2026-01-02-claude-proxy-socket-uncaught.md)
- [2026-01-01 Claude 代理连接 ECONNRESET 重试与超时保护](archive/2026-01/2026-01-01-claude-proxy-econnreset-retry.md)
- [2026-01-01 SQLite 模式 /admin/users 触发 MySQL 连接错误核查](archive/2026-01/2026-01-01-sqlite-admin-users-mysql-connection.md)
- [2026-01-01 Claude tool_use concurrency 400 日志核查](archive/2026-01/2026-01-01-claude-tool-concurrency-400.md)
- [2026-01-01 Bedrock 日志与无账户配置核查](archive/2026-01/2026-01-01-bedrock-log-without-account.md)
- [2026-01-01 Bedrock thinking 校验错误日志核查](archive/2026-01/2026-01-01-bedrock-thinking-validation-error.md)
- [2026-01-01 CCR 流式 bytesWritten 日志核查](archive/2026-01/2026-01-01-ccr-stream-byteswritten-log.md)
- [2026-01-01 上游合并检查（2026-01-01）](archive/2026-01/2026-01-01-merge-review-upstream.md)
- [2025-12-28 启动后删除 init.json 仍可管理员登录](archive/2025-12/2025-12-28-admin-login-init-json-delete.md)
- [2025-12-26 客户端在线状态恢复](archive/2025-12/2025-12-26-client-online-status-recovery.md)
- [2025-12-26 清理未使用的 admin 视图](archive/2025-12/2025-12-26-admin-unused-views-cleanup.md)
- [2025-12-26 清理未使用的 admin Users 视图](archive/2025-12/2025-12-26-admin-unused-users-view-cleanup.md)
- [2025-12-26 流式分片日志降噪](archive/2025-12/2025-12-26-stream-chunk-log-reduction.md)
- [2025-12-26 客户端账户调度为空修复](archive/2025-12/2025-12-26-client-account-selection-fix.md)
- [2025-12-27 清理 /admin/ws 路由与前端 WS Store](archive/2025-12/2025-12-27-admin-ws-cleanup.md)
- [2025-12-24 MySQL 迁移验证与回滚/只读模式说明补充](archive/2025-12/2025-12-24-mysql-migration-verification.md)
- [2025-12-26 MySQL 订阅/支付/Clients 迁移与冒烟](archive/2025-12/2025-12-26-mysql-subscription-payment-clients-migration.md)
- [2025-12-26 WebSocket 方式 server 调用 client 服务测试](archive/2025-12/2025-12-26-websocket-server-calls-client-test.md)
- [2025-12-26 日志输出精简规划](archive/2025-12/2025-12-26-log-reduction-plan.md)
- [2025-12-26 请求日志采样与慢请求阈值调整](archive/2025-12/2025-12-26-request-log-noise-reduction.md)
- [2025-12-26 开发日志降噪（启动/后台/管理端）](archive/2025-12/2025-12-26-dev-log-noise-reduction.md)
- [2025-12-26 合并结果问题修复（1.1.246）](archive/2025-12/2025-12-26-merge-review-fixes.md)
- [2025-12-26 API 统计页默认 Tab 调整](archive/2025-12/2025-12-26-api-stats-default-tab.md)
- [2025-12-26 上游更新后的合并检查](archive/2025-12/2025-12-26-merge-review-upstream-update.md)
- [2025-12-26 账户余额接口 Redis 实例为空报错修复](archive/2025-12/2025-12-26-account-balance-redis-null.md)
- [2025-12-26 清理 admin-next no-console 警告](archive/2025-12/2025-12-26-admin-next-console-warnings.md)
- [2025-12-26 Client 账户列表弹窗显示修复](archive/2025-12/2025-12-26-client-accounts-modal-list.md)
- [2025-12-26 Clients 账户列表弹窗放大](archive/2025-12/2025-12-26-client-accounts-modal-size.md)
- [2025-12-26 清理未使用的 WsClientsView](archive/2025-12/2025-12-26-remove-unused-ws-clients-view.md)
- [2025-12-26 Client 账户列表透传](archive/2025-12/2025-12-26-client-accounts-pass-through.md)
- [2025-12-26 清理未使用的 WsClientsView](archive/2025-12/2025-12-26-remove-unused-ws-clients-view.md)
- [2025-12-24 扩展CCR到所有模型服务](archive/2025-12/2025-12-24-expand-ccr-to-all-model-services.md)
- [2025-12-24 项目未完成工作跟进清单](archive/2025-12/2025-12-24-project-remaining-work.md)
- [2025-12-25 修复 CCR OpenAI/Gemini 用量与费用记录缺失](archive/2025-12/2025-12-25-ccr-openai-gemini-usage-missing.md)
- [2025-12-25 API Keys 列表 CCR 最后使用账号显示“已删除”根因排查](archive/2025-12/2025-12-25-ccr-apikey-last-used-deleted.md)
- [2025-12-25 CCR 计费处理流程检查](archive/2025-12/2025-12-25-ccr-billing-review.md)
- [2025-12-25 CCR Claude 转发 /v1 重复拼接问题分析](archive/2025-12/2025-12-25-ccr-claude-double-v1.md)
- [2025-12-25 CCR API URL 规范化修复](archive/2025-12/2025-12-25-ccr-apiurl-normalization-fix.md)
- [2025-12-25 MySQL 数据库存储功能实现核查](archive/2025-12/2025-12-25-mysql-datastore-implementation-review.md)
- [2025-12-26 数据存储三驱动兼容冒烟清单](archive/2025-12/2025-12-26-datastore-compat-smoke-checks.md)
- [2025-12-24 WS 收发/重连/限流鉴权/日志脱敏冒烟检查](archive/2025-12/2025-12-24-ws-smoke-checks.md)
- [2025-12-24 前端编译警告清理（no-console 等）](archive/2025-12/2025-12-24-frontend-build-warnings-cleanup.md)
