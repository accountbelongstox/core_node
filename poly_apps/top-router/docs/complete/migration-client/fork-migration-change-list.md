# Fork 功能迁移变更清单（待审）

> 范围：仅涵盖计划执行的迁移项目（SQLite、WebSocket、Translation、VPN等），核心抽象/路由拆分保持现状。

## 完成结论
- 迁移范围内的配置、脚本、模块与路由接入已闭环，本次迁移圆满完成。
- 后续仅需按需执行验证与上线/同步流程。

## 未完成/偏差（待跟踪）
- （当前无遗留项，以下为已关闭记录）
- [x] `config/config.js` 未同步示例配置：缺 `websocket`/`websocketServer`/`vpn.mode`/`datastore.mysql`，`.env.example` 中对应变量未生效。
- [x] 兼容文件 `src/models/datastore.js` 不存在（文档/CLAUDE.md 仍引用），需补 shim 或更新引用。
- [x] 缺失脚本：`scripts/status.js`、`scripts/debug-datastore-keys.js`、`scripts/client-config.js`；现有 `scripts/status-unified.sh` 仅覆盖 Redis。
- [x] 存在 `src/websocket/configService.js` 占位实现，与“计划不引入 configService”不一致，需明确保留或移除。
- [x] Translation 未接入实际业务调用（仅模块内与 WS 客户端使用），需决定接入点或明确不接入。（已在 `src/routes/api.js` 按需接入）
- [x] 测试缺失：SQLite/WS/Translation/VPN 相关用例未补齐（目前仅 `scripts/test-datastore-compat.js`）。

## 依赖与配置
- 新增依赖：`better-sqlite3`、`ws`（@aws-sdk 版本对齐）；不引入 Joi 和 nock，继续使用现有配置验证方式（如后续新增外部接口测试，再单独引入 nock）。
- 配置示例更新：`config/config.example.js`、`.env.example` 增加 datastore 选择（redis/sqlite）、WebSocket、Translation、VPN 等配置项，默认保持 Redis、关闭新增能力。
- 工具：复用现有 `src/utils/sseParser.js`；不新增 `usageTrackingHelper`、`sanitizer.js`、`src/config/constants.js`；`systemHealth` 随 WebSocket 迁移至 `src/websocket/`。

## SQLite 可插拔数据层
- 新增：`src/models/datastore/{index.js,sqliteDataStore.js}`，接口对齐 `src/models/datastore.js`，通过 `datastore.provider` 选择后端，确保单独 Redis 或单独 SQLite 均可独立运行。
- 接入：低耦合读取路径（如缓存监控、部分统计）可改用 datastore 适配层；Redis 仍为默认。
- 脚本：`scripts/setup-sqlite.js`、`scripts/data-transfer*.js`（支持 Redis↔SQLite 导入导出）、`scripts/status.js`、`scripts/debug-datastore-keys.js`。

## WebSocket 能力（默认关闭）
- 新增目录：`src/websocket/{websocketClientService.js,websocketMonitorService.js,websocketRequestHandler.js,clientCapabilityService.js}`（从 Fork 的 services 位置调整至独立目录，clientCapabilityService 用于能力收集与注册数据）。
- 配置项：`websocketClient`（serverUrl、clientApiKey、reconnect/heartbeat/proxy/request 限制等）。
- 脚本：`scripts/create-client-apikey.js`、`scripts/client-config.js`/`scripts/status.js` 增加 WS 状态输出。
- 集成：在启动流程按开关初始化，未开启时无副作用。

## Translation 能力（默认关闭）
- 新增目录：`src/translation/{translationService.js,translationStatsService.js,providers/{claudeTranslationProvider.js,geminiTranslationProvider.js}}`。
- 新增工具：`src/utils/{languageDetector.js,simpleLRUCache.js}`（或放入 translation 目录下 utils 子目录，按实现选择）。
- 配置项：`translation.enabled/provider/fallback/cacheTTL/memoryCache` 等；可按需在路由/服务中调用，缓存命中优先。

## VPN 能力（默认关闭）
- 新增目录：`src/vpn/{index.js,vpnRuntime.js,vpnSessionController.js,socksGateway.js,vpnStorageService.js,vpnMetricsService.js,binaryCodec.js,bufferPool.js,constants.js}`。
- 配置项：`vpn`（启用、端口、并发/带宽限制、认证等）；启用后新增 SOCKS/VPN 监听，未启用时不影响现有 HTTP 接口。

## 脚本与工具链
- 数据迁移、状态、调试相关脚本补全（见 SQLite 部分），确保与新配置/后端匹配。
- 可选：`cacheWarmingService` 视需要引入，受开关控制；`clientCapabilityService` 随 WebSocket 能力一起提供；不引入 `configService`，如未来需要动态配置/热加载再评估。

## 测试与 CI
- 新增/补充测试：SQLite 数据层与迁移脚本、WS 客户端（连接/重连/心跳/收发）、Translation（缓存/回退/脱敏）、VPN（会话/指标/资源占用），必要时使用 `nock`。
- 已补充基础单元测试：`tests/datastore.sqlite.test.js`、`tests/websocket.binaryProtocol.test.js`、`tests/translation.service.test.js`、`tests/vpn.binaryCodec.test.js`。
- CI：`npm run lint && npm test && npm run format:check`，可视情况添加批量查询/迁移脚本演练步骤。

## 不改动/保持现状
- 阶段 3-5（核心抽象、服务拆分、路由拆分）不执行，保持现有实现。
- 默认仍使用 Redis，新增能力默认关闭，对外 API 行为保持兼容。
