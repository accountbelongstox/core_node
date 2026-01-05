# Fork 功能迁移变更清单（细化待审）

> 范围：以本地 fork `/Users/wangxin/Documents/WangXinProjects/ai-projects/claude-relay-service` 为来源，列出可迁移项供审核；保持上游兼容，新能力默认关闭。

## 后端待办清单（当前）
- [ ] 数据层：MySQL 回滚/只读模式说明补充（见“数据层与脚本”）
- [ ] 数据层：MySQL 迁移验证（`reconcile` + 读写冒烟）
- [ ] WS：client/server 收发、断网重连、限流/鉴权、日志脱敏检查（`scripts/test-ws-smoke.js` 脚本已提供）
- [ ] 支付：沙箱/回调模拟、签名校验、超时/失败重试联调（支付宝/微信）
- [ ] VPN：访问控制/资源隔离策略补充、状态脚本/指引、压力与资源占用测试
- [ ] 监控/指标：WS/VPN 状态、支付对账指标、MySQL 健康检查落地
- [ ] 同步与发布：回滚与开关策略复核（见“同步与发布清单”）

## 依赖与工具链
- [x] 依赖新增/升级：`mysql2`、`rimraf`、`@alicloud/pop-core`、`tencentcloud-sdk-nodejs`、`wechatpay-node-v3`（已引入）
- [ ] 依赖候选（待评估/审批后再引入）  
  - [x] **未迁移**：`jsonwebtoken`（沿用现有认证方案）  
  - [x] **未迁移**：`express-rate-limit`（保持现有限流方案以最大化上游兼容）
  - [x] **未迁移**：`ts-node`/`typescript`（本项目使用 JS，迁移时将 fork 中 TS 代码转换为 JS 后接入）
- [ ] 依赖移除/替换（如与现有实现冲突，需列出）
- [ ] 开发工具：若需 babel/ts 构建链，仅限迁移涉及的文件，确定是否保留或一次性转译为 JS

## 配置与环境变量
- [x] MySQL：`DATASTORE_PROVIDER=mysql`、`DB_HOST/PORT/USER/PASSWORD/NAME/POOL_SIZE`、`DB_SSL_*`、`MYSQL_SCHEMA_PATH` 等
- [x] SQLite：`DATASTORE_PROVIDER=sqlite`、`SQLITE_FILENAME` 等
- [x] WebSocket：`WS_MODE`、`WS_SERVER_ENABLED/PORT/PATH/API_KEYS`、`WS_CLIENT_ENABLED`、`WS_SERVER_URL`、`WS_CLIENT_API_KEY`、`WS_MAX_RECONNECT_RETRIES`、`WS_RECONNECT_*`、`WS_HEARTBEAT_*`、`WS_PROXY_*`、`WS_REQUEST_TIMEOUT`、`WS_MAX_CONCURRENT_REQUESTS`
- [x] 官方 OpenAI：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_OFFICIAL_TIMEOUT_MS`、`OPENAI_ORG`、`OPENAI_PROJECT`
- [x] CCR 调度策略：`CCR_POOL_MODE`（`disabled`=默认池禁用，仅前缀；`fallback`=无可用账户时兜底；`include`=直接加入默认池）
- [x] 支付/订阅：`ALIPAY_*`、`WECHAT_MCH_ID/APP_ID/SERIAL_NO/API_KEY/API_V3_KEY`、`WECHAT_CERT_PATH`、`WECHAT_KEY_PATH`、`WECHAT_NOTIFY_URL`、`WECHAT_API_VERSION`、套餐开关/默认套餐配置
- [x] 订阅生命周期：`SUBSCRIPTION_LIFECYCLE_ENABLED`、`SUBSCRIPTION_LIFECYCLE_INTERVAL_MINUTES`
- [x] 安全/限流（不迁移，无新增 env）
- [x] VPN：`VPN_MODE`、`VPN_ENABLED`、`VPN_SOCKS_*`、`VPN_BUFFER_*`、`VPN_*_TIMEOUT`
- [x] 示例文件：`config/config.example.js`、`.env.example` 已同步；`docker-compose.yml`（可选，未更新）

## 数据层与脚本（必迁移，支持 sqlite/redis 或 mysql+redis）
- [x] 新增 `src/models/datastore/mysqlDataStore.js`，接口对齐 redis/sqlite
- [x] 工厂/入口：`src/models/datastore/index.js` 支持 `mysql`，保持默认 redis/sqlite 兼容；允许 `mysql+redis` 组合（如 mysql 持久化 + redis 缓存）
- [x] 初始化/迁移脚本：`scripts/migrate-redis-to-mysql.js` 支持 migrate/reconcile/`--dry-run`（总是从 redis 读，单独 mysql 连接写入；覆盖 provider/计划/订阅/订单/支付/clients/api_keys/usage）
- [x] Redis → SQLite 迁移：`scripts/data-transfer.js` 支持 extras（OpenAI 账户、共享账户、OEM 设置、管理员凭据），并修复 CLI 参数解析
- [x] SQLite 兼容性修复：cost rank/pipeline fallback、用户消息队列 scan 跳过（避免 Redis-only API 报错）
- [x] 数据模型/索引：MySQL schema 与 fork 迁移对齐（见 `docs/migration-service/database/mysql-schema-diff.md`）
- [ ] 回滚与只读模式：补充说明（迁移为新增写入，可切回 redis，按需清空 mysql）
- [ ] 验证：`scripts/migrate-redis-to-mysql.js reconcile`、读写冒烟（redis/sqlite/mysql）待执行

## WebSocket（server 端迁移，保留现有 client，默认关闭新 server）
- [x] 服务与处理器：`src/websocket/wsServer.js` 迁移 server 端全量能力（register/heartbeat、response chunk/end、config/accounts/health/OAuth、tunnel 控制等），与现有 client 并存
- [x] 模式开关：已在 config 支持 server/client/关闭（`WS_MODE`、`websocketServer.*`），默认仅 client
- [x] 消息类型：配置下发/确认、账户查询/返回、账户增删改执行/结果、心跳/状态（枚举已补充至 `docs/migration-service/ws-vpn/ws-config-and-smoke.md`）
- [x] 路由/API：`src/routes/admin`/`src/routes/api` 管控接口已补（配置下发、账户查询/操作），鉴权沿用现状
- [x] 配置：重连、心跳、请求并发/速率限制、代理设置、server 监听端口/鉴权已落地并同步示例文件
- [x] CLI/脚本：`scripts/create-client-apikey.js`、`scripts/client-config.js`、`scripts/status-unified.sh`（WS 状态）
- [ ] CLI/脚本：`scripts/client-runtime.js`（不迁移：WS client 依赖本地 HTTP/API 服务）
- [x] 前端：`web/admin-spa` 管理视图（状态面板、配置、账户操作）已接入
- [ ] 测试：client/server 收发、断网重连、限流/鉴权验证、日志脱敏检查（已提供 `scripts/test-ws-smoke.js` 冒烟脚本，待执行）

## 支付与订阅（默认关闭）
- [x] 服务：支付集成（签名、证书校验、回调验证）与订单创建联动（Alipay 页面支付、WeChat v3 Native/H5）
- [x] 路由：订单创建、支付回调、订单查询/退款（验签成功后落 `markOrderPaymentSucceeded`）
- [x] 配置：证书路径/商户号/序列号/回调 URL、沙箱/生产开关已落地并补齐 `.env.example`
- [x] 套餐/订阅：套餐 CRUD、订阅列表/更新（基础管理路由）
- [x] 脚本：`scripts/get-wechat-sandbox-key.js`、`scripts/verify-wechat-certs.js`
- [x] 脚本：`scripts/test-payment-sandbox.js`
- [x] 回调/退款幂等：重复通知防重入，退款同步订阅/用户状态（清理 `subscriptionId`）
- [x] 生命周期：订单过期、订阅过期/取消/续费任务
- [x] 前端：用户端支付/订阅页面对接现有 `/subscriptions/*` 接口（计划/订单/轮询），界面功能简化
- [x] 日志与安全：支付字段脱敏、回调验签失败告警（webhook 类型 `paymentNotifyFailed`）
- [ ] 测试：沙箱/回调模拟、签名校验、超时/失败重试场景

## 安全与限流（当前保持现状，如后续需要再评估迁移）
- [x] 不迁移 `express-rate-limit`（继续使用现有限流/并发/队列机制，保持上游兼容）
- [x] 不迁移 JWT/客户端白名单（沿用现有认证/授权流程）
- [x] 全局日志脱敏不额外接入（仅在新增模块如支付/短信做局部脱敏）
- [ ] 若未来评估需要，再定义限流窗口/阈值、JWT 秘钥等配置

## VPN/隧道（需迁移，默认关闭；server/client 模式）
- [x] 代码：`src/vpn/*`（runtime/session controller/socks gateway/storage/metrics/buffer 等）
- [x] 模式开关：环境变量选择 server/client/关闭，默认关闭 server
- [x] 启动入口：应用启动时按开关初始化，独立端口监听
- [x] 配置：`VPN_ENABLED`、端口、并发/带宽限制、认证/密钥、超时/心跳
- [ ] 安全：访问控制、日志脱敏、资源隔离
- [ ] CLI/脚本：是否提供运行/状态脚本或在 `scripts/status-unified.sh` 增加 VPN 状态
- [x] 监控/指标：VPN 会话/流量/错误指标
- [ ] 测试：连通性已验证，压力与资源占用待补
- [x] 端到端 SOCKS 数据路径覆盖（WS/VPN client+server）冒烟脚本（`scripts/test-vpn-socks.js`）
- [x] WS/VPN 契约与错误码：`src/vpn/messageContract.js` 标准化 `status/errorCode`；TunnelBridge/Runtime 发送 `tunnel_connect/_ack`、`tunnel_disconnect`，常见错误码 `INVALID_REQUEST`、`CLIENT_CONNECT_TIMEOUT`、`TARGET_CONNECTION_REFUSED`、`DOWNSTREAM_OVERFLOW` 等
- [x] 管控/可视化（前端已接入）：`/admin/vpn` 新增隧道列表与详情；显示握手失败次数、`lastErrorCode/message`、会话列表、握手/错误时间线（来源 `vpn:events:*`），刷新/新建/删除/过期清理入口
- [x] 数据持久化键：`vpn:tunnel:*`（隧道元数据）、`vpn:stats:*`（统计）、`vpn:events:*`（握手/错误时间线，保留最近50条），WS 客户端在线状态 `ws_client:status:*`

## WebSocket（server 端迁移，保留现有 client，默认关闭新 server）
- [x] 服务与处理器：`src/websocket/wsServer.js` 迁移 server 端全量能力（register/heartbeat、response chunk/end、config/accounts/health/OAuth、tunnel 控制等），与现有 client 并存
- [x] 管控路由：`/admin/clients/*`（客户端列表、断开、配置下发、账户查询/操作、系统健康、OAuth URL/交换）
- [x] 前端：`/admin/clients` 管理视图（状态/心跳、断开、配置、账户操作、OAuth）
- [x] 模式开关：已在 config 支持 server/client/关闭（`WS_MODE`、`websocketServer.*`），默认仅 client
- [x] 消息类型：配置下发/确认、账户查询/返回、账户增删改执行/结果、心跳/状态（枚举梳理补充到 `docs/migration-service/ws-vpn/ws-config-and-smoke.md`）
- [x] 配置：重连、心跳、请求并发/速率限制、代理设置、server 监听端口/鉴权已对齐并同步示例文件
- [x] CLI/脚本：`scripts/create-client-apikey.js`、`scripts/client-config.js`、`scripts/status-unified.sh`（WS 状态）
- [ ] CLI/脚本：`scripts/client-runtime.js`（不迁移：WS client 依赖本地 HTTP/API 服务）
- [ ] 测试：client/server 收发、断网重连、限流/鉴权验证，日志脱敏检查（已提供 `scripts/test-ws-smoke.js` 冒烟脚本，待执行）

## 其他能力
- [x] `clientRelayService`：已转译为 JS（`src/services/clientRelayService.js`），通过 WS server 转发流式/非流式请求并捕获 usage/限流计数，待确认路由接入场景
- [x] 官方 OpenAI 兼容入口：`src/routes/openaiOfficialRoutes.js`（`/openai/official/v1/chat/completions`、`/v1/completions`），单 Key 透传；文档 `docs/migration-service/openai/openai-official-endpoint-plan.md`
- [x] WS Client Relay 上线清单（运维速记，见 `docs/migration-service/ws-vpn/ws-config-and-smoke.md`）
  - server：`WS_SERVER_ENABLED=true`、`WS_MODE=server`、`WS_SERVER_API_KEYS` 配置白名单
  - client：`WS_CLIENT_ENABLED=true`、`WS_SERVER_URL`、`WS_CLIENT_API_KEY`，确保与白名单一致
  - 预期键：`ws_client:status:{id}`（状态）、`ws_client:apikey:*` 映射、`concurrency:client:{id}` 并发计数
  - 观察：`/admin/clients` 在线/心跳，流量命中 `/responses`（OpenAI）、Claude/Gemini 时 accountType=`client` 走 `clientRelayService`
- [ ] 监控/指标：WS/VPN 状态、支付对账指标、MySQL 健康检查
- [ ] CLI 与运维：`scripts/client-runtime.js`（不迁移）、命令别名对齐
- [ ] 文档：迁移后补充 README/QUICK_START/运维指引（可放 docs/migration-service/）

## 用户管理（目前保持现状，若订阅/支付落地需同步评估）
- [x] 用户字段对齐：`passwordHash/emailVerified/registrationMethod/subscriptionId`、邮箱映射、密码重置 token；Redis 存储与会话兼容
- [x] 路由：用户注册（可控开关）、本地密码登录 fallback（优先本地，无则 LDAP）、密码重置请求/重置
- [x] 邮件发送：`emailService`（SMTP/日志回退），用于密码重置邮件
- [ ] 前端/路由：如需用户中心/注册/重置页面，对接新 API 响应格式
- [ ] 如迁移支付/订阅：评估是否需在用户模型增加套餐/到期字段、状态同步逻辑，并确保默认行为与上游兼容
- [ ] 认证流程保持现状，不引入 JWT（除非后续单独审批）

## 短信/通知（如有需求再迁移）
- [x] 确认 fork 中短信/通知提供商（腾讯云/阿里云），列出依赖、配置项、签名/模板字段并引入 SDK
- [x] 服务与路由：短信发送服务 + 用户短信配置/验证码/偏好接口
- [x] 配置：访问密钥、签名、模板 ID、区域、速率限制，默认关闭
- [x] 失败策略：默认不自动重试并记录失败原因（可选开启仅网络类错误重试）
- [x] 日志与安全：敏感字段脱敏
- [ ] 前端/控制台：是否有短信配置或通知管理入口；如无需求则不改动

## 前端迁移（需单独梳理范围）
- [ ] 确定迁移的页面/模块：WS 管控、VPN、支付/订阅、客户端管理、支持/教程/数据分析等
- [ ] 依赖/构建：确认前端依赖差异与构建脚本（vitest/playwright 等测试），是否部分迁移
- [ ] 接口对齐：列出需要后端支持的新增 API 与响应格式
- [ ] UI/UX：适配现有风格，确保默认不影响已存在页面；新增入口受开关控制
- [ ] 测试：对应组件/端到端测试是否迁移或补充
- [x] 管理端 `User Management` 页面中文化（`web/admin-spa/src/views/UserManagementView.vue`）
- [x] 落地页与用户面板页面同步（marketing/user 视图与组件）✅ 对照 fork 完成
- [x] 管理端页面与样式对齐（Admin SPA Phase 1-4）
- [x] 全局样式对齐（`global.css`/`main.css` 与 fork 一致）
- [x] 落地页“注册”按钮跳转已确认（`/admin-next/` 下指向 `/auth/register`；`APP_CONFIG.basePath` 生产默认已对齐 `/admin-next/`）
- [x] WS Client 模式路由策略已确认：访问 `/` → `/api-stats`；访问 `/auth/user-login`/`/auth/register` → `/`
- [x] WS Client 模式 Admin UI 已确认：隐藏 Clients/Users/订阅入口（订阅总览不显示）；WS 客户端入口保留但展示本机状态；VPN 页面保留且展示本机状态

## 测试与 CI
- [ ] 基础：`npm run lint && npm test && npm run test:datastore`
- [ ] MySQL：连接/读写/迁移干跑，数据一致性校验
- [ ] WS：收发、断网重连、心跳、限流/并发保护
- [ ] 支付：沙箱回调、签名校验、失败/超时重试
- [ ] 安全/限流：命中率与降级验证（如迁移）
- [ ] CI Job：是否新增可选 job 运行支付/WS/MySQL 专项

## 同步与发布清单
- [ ] 上游同步后复核：冲突点记录与解决方案（见 `sync-log.md`）
- [ ] 开关缺省：新能力默认关闭，老路径保持兼容
- [ ] 回滚预案：Redis/SQLite 回退、限流/支付/WS/VPN 快速关闭

---

### 变更记录（按事项追加）
| 日期 | 模块 | 描述 | 状态 | 测试/验证 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2025-12-22 | 数据层 | Redis→SQLite 导出/导入脚本增强（OpenAI/共享/OEM/管理员凭据） | 已完成 | 导入验证 ✅ | `scripts/data-transfer.js` |
| 2025-12-22 | SQLite | 兼容修复（user queue scan、cost rank pipeline/rename fallback） | 已完成 | 启动验证 ✅ | SQLite client 模式 |
| 2025-12-22 | VPN | 隧道生命周期/指标/管控面板完善 | 已完成 | 冒烟 ✅ | |
| 2025-12-22 | OpenAI | 官方 API 兼容入口 `/openai/official` | 已完成 | 待联调 | 单 Key 简版 |
| 2025-12-22 | 前端 | User Management 页面中文化 | 已完成 | - | |
| 2025-12-22 | 前端 | 落地页与用户面板同步 + 全局样式范围调整 | 已完成 | - | |
| 2025-12-23 | 支付/订阅 | 支付回调/退款幂等 + 订阅/用户状态同步 | 已完成 | lint ✅ | `src/services/subscriptionService.js` |
| 2025-12-23 | 支付 | 微信支付切换为 `wechatpay-node-v3` SDK | 已完成 | 未验证 | `src/services/wechatPayService.js` |
| 2025-12-23 | 短信 | 短信服务/用户短信配置与接口迁移（阿里云/腾讯云） | 已完成 | lint ✅ | `src/services/smsService.js` |
| 2025-12-23 | 订阅 | 生命周期任务 + 支付回调告警/日志脱敏 | 已完成 | lint ✅ | `src/services/subscriptionLifecycleService.js` |
| 2025-12-23 | 数据层 | MySQL 迁移脚本扩展（providers/计划/订阅/订单/支付/clients/api_keys/usage） | 已完成 | 待 dry-run | `scripts/migrate-redis-to-mysql.js` |
| 2025-12-24 | 前端 | Admin SPA 样式对齐（`global.css`/`main.css`） | 已完成 | - | |
| YYYY-MM-DD | 依赖 | 例：新增 mysql2/express-rate-limit | 待完成 | - | - |
| YYYY-MM-DD | 数据层 | 例：MySQL provider 接入 | 进行中 | dry-run ✅ | - |
| YYYY-MM-DD | WS | 例：WS 管控路由合入 | 未开始 | - | - |
| YYYY-MM-DD | 支付 | 例：回调路由 & 沙箱测试 | 未开始 | - | - |
| YYYY-MM-DD | 安全 | 例：全局限流上线 | 未开始 | - | - |
