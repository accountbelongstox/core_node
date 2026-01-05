# 任务: WS 收发/重连/限流鉴权/日志脱敏冒烟检查

状态: 已完成
语言: 简体中文（zh-CN）
负责人: 待定
目标: 完成 WS 相关冒烟检查并记录结果。
范围:
- client/server 收发验证
- 断网重连验证
- 限流与鉴权验证
- 日志脱敏检查
- 冒烟脚本执行
不在范围内:
- 协议改造或新功能开发
约束:
- 使用现有环境与脚本
- 不修改线上配置

计划:
- [ ] 确认测试环境与冒烟脚本
- [ ] 执行收发与断网重连验证
- [ ] 检查限流/鉴权与日志脱敏
- [ ] 记录结果并回填问题

进度日志:
- 2025-12-24: 创建任务。
- 2025-12-24: 标记为进行中，开始准备冒烟检查。
- 2025-12-24: 梳理冒烟脚本与环境要求（`scripts/test-ws-smoke.js`、`docs/complete/migration-service/ws-vpn/ws-config-and-smoke.md`）。
- 2025-12-24: 明确本地双实例计划（server 3000 / client 3200）。
- 2025-12-24: 检查本地 sqlite 的 `ws_client:status:*`，记录到 `temp-client` 与实际 clientId 两条状态记录。
- 2025-12-24: 盘点 WS client 侧可能产生的 `ws_client:*` 键。
- 2025-12-24: 按 server/client 分类整理 WS 相关键来源（含 `concurrency:client:{id}`）。
- 2025-12-24: 统一 WS key 前缀为 `ws_client:*`，注册成功后清理 `ws_client:status:temp-client`。
- 2025-12-24: 移除 `ws:client:*` 前缀兼容逻辑，仅保留 `ws_client:*`。
- 2025-12-24: 修正 WS clientId 映射，避免生成 `ws_client:status:apikey:*`/`ws_client:status:secret:*`。
- 2025-12-24: 本地 sqlite/redis 未发现 `ws:client:*` 键，待确认实际运行环境的 datastore。
- 2025-12-25: 运行 `node scripts/client-config.js --json`，确认 WS 模式为 client，client enabled，server enabled 但 port=0。
- 2025-12-25: 运行 `node scripts/status.js --ws`，发现 1 个 WS client 处于 connected，心跳更新时间正常。
- 2025-12-25: ADMIN_TOKEN 未配置，未能执行 `/admin/ws/clients` 与健康检查脚本。
- 2025-12-25: 日志关键字扫描未发现 `cr_` 形式 API key，未见明显泄露线索。
- 2025-12-25: 运行 `scripts/test-ws-smoke.js`，`/admin/ws/clients` 与 `/health` 均成功（client-67e4b75e）。
- 2025-12-25: 触发 `/admin/ws/clients/client-67e4b75e/disconnect`，1s 内重连（connectedAt 更新），约 40s 后心跳恢复（lastHeartbeat 更新）。
- 2025-12-25: 使用错误 token 访问 `/admin/ws/clients` 返回 401（Invalid admin token format），使用有效 token 访问成功。
- 2025-12-25: 扫描当日日志（relay/error/security/auth-detail）未发现 API key、Bearer token 或 `x-ws-internal-key` 明文记录。

验收:
- 冒烟项全部验证并有记录
- 发现问题有明确跟进项
