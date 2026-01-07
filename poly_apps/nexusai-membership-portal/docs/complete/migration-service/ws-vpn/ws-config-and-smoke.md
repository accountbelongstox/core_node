# WebSocket Server 配置与冒烟速记

> 详细说明见 `docs/migration-service/ws-vpn/ws-overview.md`

## 配置/环境变量
- `WS_MODE`：`server`|`client`|`off`（默认 `client`；不支持 `both`）
- WS Server：
  - `WS_SERVER_ENABLED`（默认 false，若开启同时建议 `WS_MODE=server`）
  - `WS_SERVER_PORT`、`WS_SERVER_PATH`（默认 `/ws/client`）
  - `WS_SERVER_HEARTBEAT_INTERVAL`、`WS_SERVER_CONNECTION_TIMEOUT`
  - `WS_SERVER_API_KEYS`（逗号分隔；为空则不校验 key）
  - 可选：`WS_SERVER_ALLOWED_ORIGINS`（如需浏览器场景）、`WS_SERVER_BUFFER_MAX_BYTES`（跟随 vpn.buffer）
- WS Client（保持现状，仅列出以防冲突）：
  - `WS_CLIENT_ENABLED`、`WS_SERVER_URL`、`WS_CLIENT_API_KEY`
  - 重连：`WS_MAX_RECONNECT_RETRIES`、`WS_RECONNECT_INITIAL_DELAY`、`WS_RECONNECT_MAX_DELAY`、`WS_RECONNECT_BACKOFF`
  - 心跳：`WS_HEARTBEAT_INTERVAL`、`WS_HEARTBEAT_TIMEOUT`
  - 代理：`WS_PROXY_*`
- VPN buffer/backpressure（对 WS 二进制传输有效）：`VPN_BUFFER_MAX_BYTES`、`VPN_BUFFER_DRAIN_TIMEOUT`

## 消息/功能（服务端 wsServer）
- 认证：`register` -> `register_ack/register_error`（校验 API key）
- 心跳：`ping/pong`（server 发 ping，client 回 pong，记录 RTT/心跳 stats）
- 请求/响应：`request` + `response/response_chunk/response_end/error`（pendingRequests 匹配）
- 配置：`config_update` -> `config_ack`
- 账户：列表与增删改统一走本地 JSON `request`（旧 `add_account/update_account/delete_account` 仅兼容）
- 系统健康：`query_system_health` -> `system_health_info`
- OAuth：统一走 `request`（本地 JSON）；旧 `generate_oauth_url/exchange_oauth_code` 仅兼容
- VPN：`tunnel_connect_ack`、`tunnel_disconnect`、二进制 `vpn_data`（通过 TunnelBridge）

## 消息规范（通用 Envelope）
所有 JSON 消息统一包含：
- `type`：消息类型（见下方枚举）
- `id`：消息 ID（用于匹配 request/ack 及管理类操作）
- `timestamp`：毫秒时间戳
- `data`：业务负载

### 认证/心跳
- `register` (client -> server)
  - data: `{ apiKey, version, capabilities, resources, status, metadata }`
  - capabilities: `{ supportedPlatforms, supportedAccountTypes, supportedModels, features, vpn? }`
  - resources: `{ activeAccounts, totalAccounts, availableSlots, maxConcurrency, vpn? }`
  - status: `{ uptime, currentLoad, healthStatus }`
  - metadata: `{ hostname, platform, nodeVersion, region }`
- `register_ack` (server -> client)
  - data: `{ clientId, status: 'success', message }`
- `register_error` (server -> client)
  - data: `{ errorCode, errorType, message, details }`
- `ping` (server -> client)
  - data: `{}`（无负载）
- `pong` (client -> server)
  - data: `{ requestTime, stats }`，stats 示例：`{ activeRequests, queueLength, memoryUsage, uptime }`

### 转发请求（模型/本地 JSON）
- `request` (server -> client)
  - data: `{ apiKey, requestId, service, accountType, endpoint, method, headers, body, options, upstream? }`
  - `options.local === true` 或 `data.kind === 'local'` 表示本地 JSON 请求（OAuth/账户管理类）
  - `options.forceNonStream` 可强制非流式
- `request_ack` (client -> server)
  - data: `{ requestId, status, message }`
- `response` (client -> server, 非流式或本地 JSON)
  - data: `{ requestId, statusCode, headers, body, usage? }`
- `response_chunk` (client -> server, 流式)
  - data: `{ requestId, sequence, chunk, encoding }`
- `response_end` (client -> server, 流式结束)
  - data: `{ requestId, usage? }`
- `error` (client -> server)
  - data: `{ requestId, errorCode, errorType, message, details?, retryable }`

### 配置/账户/健康/OAuth
- `config_update` (server -> client)
  - data: `{ config, applyImmediately, summary }`
- `config_ack` (client -> server)
  - data: `{ success, appliedConfig?, requiresRestart, errors? }`
- `add_account/update_account/delete_account`（legacy，可选）
  - data: `{ accountType, accountData }` / `{ accountId, accountType, updates }`
- `account_operation_result`（legacy，可选）
  - data: `{ operation, success, accountId?, message?, errors? }`
- `query_system_health` (server -> client)
  - data: `{}`
- `system_health_info` (client -> server)
  - data: `{ ...health, clientId, error? }`
- OAuth（legacy，可选）
  - `generate_oauth_url` / `oauth_url_result`
  - `exchange_oauth_code` / `oauth_exchange_result`
  - 新实现优先走 `request`（本地 JSON）
- `disconnect` (server -> client)
  - data: `{ reason, allowReconnect, retryAfter? }`

### VPN/隧道（控制 + 二进制）
- 控制消息：`tunnel_connect_ack`、`tunnel_disconnect`、`tunnel_error`（JSON）
- 数据通道：二进制帧 `vpn_data`（通过 TunnelBridge 转发）

### 其他
- `status_update` / `status_update_ack`：客户端状态变更上报（预留/可选）
- `capability_update` (client -> server)：能力变化通知（服务端已接入处理）

### 客户端 ws 消息能力（fork 对齐）
- Outbound（client -> server）：`register`、`pong`、`response`、`response_chunk`、`response_end`、`error`、`status_update`、`request_ack`、`capability_update`、`tunnel_connect_ack`、`tunnel_disconnect`、`tunnel_error`、`config_ack`、`account_operation_result`（legacy）、`system_health_info`、`oauth_url_result`、`oauth_exchange_result`
- Inbound（server -> client）：`ping`、`request`、`config_update`、`status_update_ack`、`add_account`（legacy）、`update_account`（legacy）、`delete_account`（legacy）、`query_system_health`、`generate_oauth_url`（legacy）、`exchange_oauth_code`（legacy）、`disconnect`、tunnel 控制/二进制

## 管控接口（已接入）
- `/admin/clients` 列表；`/admin/clients/:id/disconnect` 断开
- `/admin/clients/:id/config` 配置下发；`/admin/clients/:id/accounts` 查询/操作
- `/admin/clients/:id/system-health` 系统健康；`/admin/clients/:id/generate-oauth-url`、`/admin/clients/:id/exchange-oauth-code`
- 前端：`/admin/clients` 页面提供上述操作入口

## 运维速记（WS Client 上线）
1) 生成/设置 Client API Key（在 client 侧）：
   - `node scripts/create-client-apikey.js`（会写入 `WS_CLIENT_API_KEY` 并落库）
2) Server 侧允许该 key：
   - `WS_SERVER_API_KEYS=<client_api_key>`（可多个逗号分隔）
3) 启动模式（仅 Server 或 Client 其一）：
   - Server：`WS_MODE=server` + `WS_SERVER_ENABLED=true`
   - Client：`WS_MODE=client` + `WS_CLIENT_ENABLED=true` + `WS_SERVER_URL=ws://<server_host>:<port>/ws/client`
4) Client 本地请求（模型/管理类）：
   - Client 侧建议 `HOST=127.0.0.1`
   - 内网鉴权 Header：`x-ws-internal-key=WS_CLIENT_API_KEY`（由 client 自动注入）
5) 验证与观察：
   - `node scripts/status.js --ws` 查看 `ws_client:status:*`
   - `node scripts/client-config.js --json`
   - `/admin/clients` 在线与心跳

## 基本冒烟脚本（示例命令）
> 需先启用 WS server 并确保有一个 WS client 启动且 API key 已配置。

1. 列出客户端（验证管控 API）：  
   `curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/admin/clients`

2. 发配置下发（dry 配置）：  
   `curl -X POST -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \\`  
   `  -d '{"config":{"test":true},"applyImmediately":true,"summary":"smoke"}' \\`  
   `  http://localhost:3000/admin/clients/<clientId>/config`

3. 查询账户/健康：  
   `curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/admin/clients/<clientId>/accounts`  
   `curl -H "Authorization: Bearer <admin_token>" http://localhost:3000/admin/clients/<clientId>/system-health`

4. 账户操作（示例 add）：  
   `curl -X POST -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \\`  
   `  -d '{"operation":"add_account","data":{"accountType":"claude-official","name":"demo"}}' \\`  
   `  http://localhost:3000/admin/clients/<clientId>/accounts`

5. OAuth 生成/交换：  
   `curl -X POST -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \\`  
   `  -d '{"accountType":"claude-official"}' http://localhost:3000/admin/clients/<clientId>/generate-oauth-url`

6. 断开客户端：  
   `curl -X POST -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \\`  
   `  -d '{"reason":"admin_disconnect"}' http://localhost:3000/admin/clients/<clientId>/disconnect`

## 可选冒烟脚本（不执行，仅预检）
- `scripts/test-ws-smoke.js`（需要 admin token，仅做 GET 列表/健康检查，不做配置变更）
- 示例：`ADMIN_TOKEN=... node scripts/test-ws-smoke.js --base=http://127.0.0.1:3000`

## 注意
- 新能力默认关闭；开启前确认端口/鉴权/API key 配置，避免暴露未鉴权的 WS server。
- 日志中避免泄露客户端 API key/敏感字段；如需额外脱敏，补日志包装层。
- 若使用 mysql/sqlite 驱动，client 状态仍存储在当前 datastore（兼容 redis 接口）。
- 本地 JSON 请求使用内网 Header：`x-ws-internal-key=WS_CLIENT_API_KEY`；client 侧建议 `HOST=127.0.0.1`。

## Client 账户接入速记（WS 转发）
- Server 侧白名单：在 `WS_SERVER_API_KEYS` 配置允许的 client API key；WS server 启动后 `clientRelayService` 自动接管。
- Client 侧：设置 `WS_CLIENT_API_KEY`、`WS_SERVER_URL`、`WS_MODE=client` 或显式开启 client；连接成功后会在 datastore 生成 `accountType=client` 的在线记录。
- 调度：OpenAI `/responses` 流程已纳入 client 账户，当 selection.accountType=`client` 时走 `clientRelayService` 转发（流/非流）；并发计数存于 `concurrency:client:{id}`。
- 并发/调度字段：`maxConcurrency`（默认 10）、`schedulable`、`supportedModels`；需在线且 `connectionStatus=connected` 才参与调度。
- 管控：同 `/admin/clients`，可断开、下发配置、查看状态；API key 明文仅存本地 datastore，用于服务端向 client 发起请求验签。
