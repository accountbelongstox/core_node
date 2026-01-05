# WebSocket 功能综述（Server/Client）

## 目标与角色
- 仅支持 **Server 或 Client 单一角色**，不会同时启动。
- Server：接收 WS client 连接、鉴权与心跳、维护在线状态，并将 HTTP 请求转发给 client。
- Client：连接 Server，接收 WS request，调用本地 HTTP（模型或本地 JSON），返回响应。

## 启动与配置
- 模式：`WS_MODE=server|client|off`（不支持 `both`）
- Server 开关：`WS_SERVER_ENABLED=true` 才会真正启动
- Client 开关：`WS_CLIENT_ENABLED=true` 才会真正启动
- Server 监听：`WS_SERVER_PORT`、`WS_SERVER_PATH=/ws/client`
- 认证白名单：`WS_SERVER_API_KEYS`（空则不校验）
- Client 连接：`WS_SERVER_URL`、`WS_CLIENT_API_KEY`
- 心跳/重连：`WS_HEARTBEAT_INTERVAL`、`WS_HEARTBEAT_TIMEOUT`、`WS_MAX_RECONNECT_RETRIES` 等

## 连接与注册
- Client 连接后发送 `register`，包含：
  - `capabilities`：支持的平台/账户类型/模型/特性
  - `resources`：活跃账户数、并发能力
  - `status`：负载与健康状态
  - `metadata`：主机、平台、Node 版本
- Server 校验 API key 后回 `register_ack`，并写入在线状态。

## 状态存储与关键键
- WS 客户端状态键：`ws_client:status:{id}`
- 认证映射：`ws_client:apikey:{hash}` -> clientId
- 明文 key（仅本地保存）：`ws_client:secret:{id}`
- 并发槽位统计：`concurrency:client:{id}`

## 消息类型与方向
### 基础控制
- `register` / `register_ack` / `register_error`
- `ping` / `pong`
- `disconnect`

### 请求转发
- `request` -> `response` / `response_chunk` / `response_end` / `error`
- `request.data.options.local === true` 或 `request.data.kind === 'local'`
  - 视为本地 JSON 请求（OAuth、账户维护、系统健康等）
  - 由 client 调用本地 HTTP 接口返回 JSON

### 配置/能力/状态
- `config_update` -> `config_ack`
- `status_update`（client -> server）
- `capability_update`（client -> server）

### 账户管理
- 账户列表与新增/更新/删除统一走 **本地 JSON request**（`request` + `endpoint/method/body`）
- `generate_auth_url` / `exchange_code` / `refresh_account_token`
- `generate_setup_token_url` / `exchange_setup_token_code`
- `oauth_with_cookie` / `setup_token_with_cookie`
  - 账户维护类优先走 **本地 JSON 请求**（`request` + `endpoint/method/body`）
  - `add_account/update_account/delete_account` 与旧 OAuth 消息类型视为兼容用法（不推荐）

### VPN/隧道
- 控制消息：`tunnel_connect_ack` / `tunnel_disconnect` / `tunnel_error`
- 数据通道：二进制帧 `vpn_data`（TunnelBridge 转发）

## 请求转发流程（模型）
1. Server 接收 HTTP 请求（OpenAI/Claude/Gemini 等）
2. 选中 `accountType=client` -> 进入 `clientRelayService`
3. Server 发送 WS `request` 给 client
4. Client 调用本地 HTTP（模型接口）并回传响应
5. Server 将响应回写给调用方（流式/非流式）

## 本地 JSON 请求流程（账户/健康/OAuth）
1. Server 发送 WS `request`（带 `options.local=true`）
2. Client 调用本地 HTTP（JSON 接口）
3. Client 回 `response`（JSON）

## 管控接口（Admin）
- WS 客户端列表与操作：`/admin/clients`
- 单 client 配置/健康/断开：`/admin/clients/:id/*`
- Client 账户管理：`/admin/clients/:clientId/*`
  - 支持账户 CRUD 与 OAuth/SetupToken 操作

## 注意事项
- **Server/Client 不能同时启动**，`WS_MODE=both` 会被忽略并降级为单一角色（优先 server）。
- 开启 WS Server 前务必配置 `WS_SERVER_API_KEYS` 或其他访问控制。
- 本地 JSON 请求默认走 `http://{HOST}:{PORT}`，建议 client 侧 `HOST=127.0.0.1`。
- 管理接口走内网 Header 校验：`x-ws-internal-key`（仅回环地址可用）。
- `x-ws-internal-key` 值为 `WS_CLIENT_API_KEY`（仅用于本机调用）。
- 账户维护类请求依赖本地 OAuth/账户接口，需确保 client 侧路由已对齐并可直接访问。
