# Claude Relay Fork 功能迁移重构方案

> 目标：将 `/Users/wangxin/Documents/WangXinProjects/ai-projects/claude-relay-client` 中的新增功能迁移到本项目，并保持后续可持续同步上游。

## 当前状态（已完成）
- 迁移范围内变更已全部落地，变更清单闭环，本次迁移圆满完成。
- 阶段 1-2、6-7、8-9 已完成；阶段 3-5 按计划保持不执行。
- 翻译触发支持 `x-translation-target` / `translation_target`（覆盖 Claude/OpenAI/Gemini 路由）。

## 阶段 0｜基线与分支策略
- 创建 `upstream-main` 追踪上游，`feature/fork-sync` 承载迁移；维护差异清单文档并持续更新。
- 生成模块化差异报告（数据层/服务/路由/Web/脚本），标注“直接引入/需适配/高风险”。

## 阶段 1｜配置与依赖打底
- 引入依赖：`better-sqlite3`、`ws`，@aws-sdk 版本对齐。（**不引入 Joi 和 nock，保持现有配置验证方式；如后续新增相关测试再单独引入 nock**）
- 合并配置示例：`config/config.example.js`、`.env.example` 增加 datastore/websocket/translation/vpn 配置，默认兼容旧行为（无需 Joi 校验）。
- 工具：复用现有 `src/utils/sseParser.js`；不新增 `usageTrackingHelper`、`sanitizer.js`、`src/config/constants.js`。

## 阶段 2｜数据层抽象（Redis→可插拔）
- 新增 `src/models/datastore/{index.js,sqliteDataStore.js}`，保留 `src/models/datastore.js` 兼容接口；在 config 增加 `datastore.provider` 选择（redis/sqlite），确保单独 Redis 或单独 SQLite 均可运行。
- 先让低耦合模块接入 datastore（缓存监控、部分统计），适配接口保持可切换。
- 演练数据迁移：基于 Fork 的 `scripts/data-transfer*.js` 做 dry-run 导出/导入。

## 阶段 3｜核心抽象与校验
- **决定：保持本项目现有抽象实现，不从 Fork 引入或调整该层，以下内容保留为历史参考，不执行。**
- 引入 `src/services/base/{BaseAccountService.js,EncryptionService.js}`，各 *AccountService 改继承基类但保持对外签名。
- 统一输入校验：移植 `messageValidator`/`apiKeyValidator`/`accountValidator` 与校验中间件，先在 `/v1/messages`、`/v1/messages/count_tokens` 试点。
- 统一错误模型：新增 `ApplicationError` 体系与错误处理中间件，先覆盖编排/新增路由，渐进替换旧抛错。

## 阶段 4｜服务拆分与编排层
- **决定：保持本项目现有实现，不从 Fork 引入或调整该层；以下内容保留为历史参考，不执行。**
- Claude 拆分：引入 `src/services/claude/{ClaudeOAuthService,ClaudeProfileService,ClaudeQuotaService,ClaudeRateLimitService,ClaudeSchedulerService}.js`，`claudeAccountService` 改为委托子服务。
- Gemini/OpenAI 拆分：引入 `src/services/gemini/{GeminiOAuthService,GeminiCodeAssistService}.js`、`src/services/openai/{OpenAIOAuthService,OpenAIRateLimitService,OpenAICodexUsageService,OpenAIAccountStatusService}.js`，AccountService 改委托。
- 编排层：移植 `src/services/orchestration/{ClaudeRequestOrchestrator,AccountRelayMapper}.js`，`src/routes/api.js` 使用编排入口 + `usageTrackingHelper` 收敛流回调。
- 提炼共性（限流/加密/缓存生命周期），统一接入基类，逐步替换重复代码。

## 阶段 5｜路由与管理端拆分
- **决定：保持本项目现有实现，不做拆分/重构；以下内容保留为参考，不执行。**
- Admin 路由模块化：引入 `src/routes/admin/*`，`src/routes/admin.js` 退化为聚合，逐步迁移现有逻辑保持路径/响应兼容。
- API 路由更新：合并 Fork 对 `geminiRoutes.js`、`standardGeminiRoutes.js`、`openaiRoutes.js` 的 SSE/compact 改进，增加 Gemini-API 支持；按文件小步 cherry-pick，必要时加功能开关。
- 中间件拆分：参考 Fork 的 `authMiddleware/corsMiddleware/requestLogger/securityHeaders/rateLimitMiddleware`，用薄封装替换大文件 `auth.js`，接口保持不变。
- Token 计数 Beta、Gemini-API 管理端点：按 `UPSTREAM_SYNC_PLAN` 提示逐项合入。

## 阶段 6｜新增能力（默认关闭，可配置启用）
- 翻译服务：移植 `translationService`/`translationStatsService` 与 `providers/*`、`utils/languageDetector`、`simpleLRUCache`，配置项 `translation.enabled/provider/fallback/cache`，在路由按需调用。
- WebSocket 客户端：引入 `websocketClientService/websocketMonitorService/websocketRequestHandler` 与相关 config/env，提供 `setup:create-client-apikey` 脚本，默认关闭。
- VPN 模块：引入 `src/vpn/*`，在配置开关下暴露启动入口。
- 其他服务：`cacheWarmingService`、`clientCapabilityService` 可选；不引入 `configService`（如未来需要动态配置/热加载再评估）。

## 阶段 7｜前端对齐（择优合并）
- **决定：不做任何前端迁移/合并。** 保持现有前端不变。

## 阶段 8｜测试与验证
- 已完成验证：
  - SQLite 模式业务 smoke（应用启动 + 核心路由）✔
  - `npm run test:datastore`（Redis/SQLite 兼容检查）✔
  - 数据迁移脚本 dry-run：`scripts/data-transfer.js export --sanitize` + `import --dry-run` ✔
  - SQLite/WS/Translation/VPN 基础单元测试已补充 ✔
- 待定/后续（可按需执行）：
  - WebSocket / Translation / VPN 启用后的最小化测试（默认关闭，后续再测）
  - 如需 CI，可加入 `npm run lint && npm test -- --passWithNoTests && npm run test:datastore`
  - 注：验证执行情况以实际运行记录为准，可按需补跑

## 阶段 9｜上线与同步策略
- 发布前检查：配置向后兼容（默认 Redis/关闭新增能力）、迁移脚本执行记录、脱敏日志验证。
- 同步上游流程（操作指南）：
  1) 添加上游远端（如需）：`git remote add upstream <上游仓库URL>`；`git fetch upstream`
  2) 保持本地 main 同步：`git checkout main && git pull origin main`
  3) 合并/变基上游：`git merge upstream/main`（或 `git rebase upstream/main`）；冲突时优先保留上游实现，再用开关/适配层挂接本地定制
  4) 跑基础检查：`npm run lint && npm test -- --passWithNoTests && npm run test:datastore`
  5) 记录同步结果：在文档中更新同步日期、冲突点与处理方式，必要时在临时分支 `sync/<date>` 完成后再合入 main
- 持续维护同步清单（参考 `UPSTREAM_SYNC_PLAN` 模式），每次同步后更新“需手动适配”列表。

## 当前执行范围与优先级
- 执行范围：阶段 1-2（配置/依赖/SQLite 可插拔），阶段 6（WebSocket/Translation/VPN/相关工具），阶段 7（前端择优），阶段 8-9（验证与上线）。阶段 3-5 保持现状，不执行重构。
- 建议顺序：1) 阶段 1-2 打底；2) 里程碑 A-D（SQLite、WebSocket、Translation、VPN）；3) 阶段 7 前端（如需）；4) 阶段 8 测试与验证；5) 阶段 9 发布与同步。

## 风险与缓解
- 数据迁移风险：先 dry-run，保留 Redis 回退，双写/只读切换窗口。
- 路由大改风险：功能开关 + 编排层隔离，分路由逐步替换。
- 性能回退：批量查询和缓存策略保持，新增监控基线。
- 安全与敏感日志：统一使用 `sanitizer`，审计新增日志点。

---

# 里程碑拆解：已确认迁移内容

## 里程碑 A｜SQLite 支持
- 目标：在保持 Redis 兼容的前提下引入 SQLite 数据层，可通过配置切换。
- 文件与改动
  - 新增 `src/models/datastore/index.js`、`src/models/datastore/sqliteDataStore.js`（接口兼容 redis.js）。
  - 配置示例：更新 `config/config.example.js`、`.env.example`，添加 `datastore.provider`（redis/sqlite）、SQLite 文件路径、WAL/缓存参数。
  - 脚本：移植/改造 `scripts/setup-sqlite.js`、`scripts/data-transfer*.js`、`scripts/status.js`（支持 datastore 状态）、`scripts/debug-datastore-keys.js`。
  - 服务接入：低耦合读取路径先改用 `require('../models/datastore')`（如 cacheMonitor、统计查询），保留 Redis 默认。
- 接口/行为
  - 外部 API 无变更；配置决定使用 Redis 或 SQLite。
  - 数据导出导入工具需支持 Redis↔SQLite 双向。
- 验证步骤
  1. `npm install`（确保 `better-sqlite3` 可用）。
  2. `node scripts/setup-sqlite.js --dry-run`（生成/校验 SQLite 文件）。
  3. `node scripts/data-transfer.js export --sanitize` + `import --dry-run`。
  4. `npm run lint && npm test`。
  5. 手动启动 `NODE_ENV=development`，验证 `/health`、`/metrics`。

## 里程碑 B｜WebSocket 功能
- 目标：增加客户端 WebSocket 能力（连接、重连、心跳、请求转发），默认关闭。
- 文件与改动
  - 新增目录 `src/websocket/`，包含 `websocketClientService.js`、`websocketMonitorService.js`、`websocketRequestHandler.js`、`clientCapabilityService.js`（能力收集/注册数据，原 Fork 位于 services）。
  - 配置示例：`config/config.example.js`、`.env.example` 添加 `websocketClient` 块（serverUrl/clientApiKey/reconnect/heartbeat/proxy/request limits）。
  - 脚本：`scripts/create-client-apikey.js`（生成客户端 API Key）、`scripts/client-config.js`/`scripts/status.js` 补充 WS 状态输出。
  - 应用入口：在 `src/app.js`（或相应启动流程）按配置初始化 WS 客户端，放置在开关后。
- 接口/行为
  - 无对外 HTTP 变更；新增 WS 连接行为与心跳日志。
  - 需要服务端白名单的客户端 API Key，未配置时不自动连接。
- 验证步骤
  1. 配置 `.env`/`config`：`WS_CLIENT_ENABLED=true`、服务端地址与 API Key。
  2. 本地启动后观测日志：连接成功/重连/心跳，断网重连验证。
  3. 若有上游 WS 测试脚本，运行集成用例；否则手动下发/回传消息验证。
  4. 关闭开关确认无连接副作用。

## 里程碑 C｜Translation 功能
- 目标：增加可选的翻译服务，支持缓存和多 Provider，默认关闭。
- 文件与改动
  - 新增目录 `src/translation/`：`translationService.js`、`translationStatsService.js`、`providers/{claudeTranslationProvider.js,geminiTranslationProvider.js}`。
  - 新增工具：`src/utils/languageDetector.js`、`src/utils/simpleLRUCache.js`（如需可放置在 translation 目录下 utils 子目录，视实现而定）。
  - 配置示例：`translation.enabled/provider/fallback/cacheTTL/memoryCache` 等写入 `config/config.example.js`、`.env.example`。
  -（可选）在需要翻译的路由/服务处接入，受开关控制。
- 接口/行为
  - 对外 API 不变；内部可在请求前后调用翻译，缓存命中优先返回。
  - 统计写入 translationStats（需 datastore 支持）。
- 验证步骤
  1. 开启 `translation.enabled=true`，设置 provider，提供必要凭据。
  2. 运行单元测试（若移植 Fork 测试）或手工调用翻译入口，验证缓存命中/回退。
  3. 查看日志确认脱敏输出，观察 datastore 缓存写入。

## 里程碑 D｜VPN 功能
- 目标：增加 VPN/SOCKS 隧道能力，默认关闭。
- 文件与改动
  - 新增目录 `src/vpn/{index.js,vpnRuntime.js,vpnSessionController.js,socksGateway.js,vpnStorageService.js,vpnMetricsService.js,binaryCodec.js,bufferPool.js,constants.js}`。
  - 配置示例：在 `config/config.example.js`、`.env.example` 增加 `vpn` 块（启用开关、端口、并发/带宽限制、认证等）。
  - 应用入口：在启动流程按开关初始化 VPN 服务，独立于 HTTP 服务器。
- 接口/行为
  - 新增 SOCKS/VPN 端口监听；HTTP 接口保持不变。
  - 需考虑资源占用与安全（认证/访问控制）。
- 验证步骤
  1. 关闭状态启动，确认无监听端口。
  2. 开启配置，启动后用 SOCKS 客户端连通性测试，验证会话创建/销毁、指标输出。
  3. 压测基础并发，观察内存/CPU，查看日志无敏感泄露。
