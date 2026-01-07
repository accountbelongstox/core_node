# VPN / WS 管控与前端查看速记

> 迁移后保持上游兼容，默认关闭 WS/VPN server。开启前需审配置并确认依赖 (`mysql2`, `rimraf` 已获批)。

## 配置与模式
- `WS_MODE` (`server`|`client`|`off`，默认 `client`，不支持 `both`)
- WS Server：`WS_SERVER_ENABLED=false`、`WS_SERVER_PORT`、`WS_SERVER_PATH=/ws/client`、`WS_SERVER_HEARTBEAT_INTERVAL`、`WS_SERVER_CONNECTION_TIMEOUT`、`WS_SERVER_API_KEYS`（空则不校验 key）
- WS Client：`WS_CLIENT_ENABLED`、`WS_SERVER_URL`、`WS_CLIENT_API_KEY`、心跳/重连/代理相关变量
- VPN Server：`VPN_MODE=server`、`VPN_SOCKS_PORT`、`VPN_SOCKS_AUTH_TOKEN`（默认隧道密码）  
  其他：`VPN_BUFFER_MAX_BYTES`、`VPN_BUFFER_DRAIN_TIMEOUT`、`VPN_DEFAULT_MAX_CONNECTIONS/IDLE_TIMEOUT/DATA_TIMEOUT`
- 数据存储驱动：`DATASTORE_PROVIDER=redis|sqlite|mysql`，`mysql2` 已接入，`vpn:*` 键兼容三种驱动。

## 契约与错误码（WS/VPN）
- Control 消息：`tunnel_connect` → `tunnel_connect_ack`，`tunnel_disconnect`，`tunnel_stats`；兼容旧 `vpn_session_*`
- 统一字段：`status` (`success`|`error`)、`success` (bool)、`errorCode`、`message`、`assignedAddress/Port`
- 常见错误码：`INVALID_REQUEST`、`CLIENT_CONNECT_TIMEOUT`、`CLIENT_CONNECT_FAILED`、`TARGET_CONNECTION_REFUSED`、`TARGET_UNREACHABLE`、`TARGET_TIMEOUT`、`DOWNSTREAM_OVERFLOW`、`SOCKET_CLOSED`、`CONNECT_FAILED`
- 统计/事件：`vpn:stats:{tunnelId}` 记录连接/流量/错误/握手计数；`vpn:events:{tunnelId}` 追加最近 50 条握手/错误事件（时间、errorCode、message、RTT，默认 50 可调）
- 保留/TTL：`vpn.stats.ttlSeconds`（默认 7 天）应用于 stats/events；WS 客户端状态 `ws_client:status:*` 没有 TTL。Admin 支持 `/admin/vpn/tunnels/:id/reset` 清空单隧道的 stats/events。
- WS 客户端在线状态：`ws_client:status:{id}`（wsId、capabilities、status）

## 后端 API（已挂载 /admin）
- `GET /admin/vpn/tunnels`：隧道 + stats
- `POST /admin/vpn/tunnels`、`PATCH /admin/vpn/tunnels/:id`、`DELETE /admin/vpn/tunnels/:id`
- `POST /admin/vpn/tunnels/purge`：清理过期
- `GET /admin/vpn/tunnels/:id/sessions`：当前会话列表（来源 `TunnelBridge`)
- `GET /admin/vpn/tunnels/:id/events?limit=20`：握手/错误时间线（来自 `vpn:events:*`）

## 前端（`/admin/vpn` 新增）
- 隧道列表：状态、端口、活跃/累计连接、流量、`lastErrorCode`、最后握手/错误时间
- 详情：握手成功/失败计数、最近错误码/消息，活跃会话（目标/来源/上下行字节/状态），握手/错误时间线；支持新建/删除/过期清理，30s 自动刷新 + 手动刷新
- 默认关闭 WS/VPN server，打开前需配置 env + 确认监听端口冲突与访问控制。

## SOCKS 数据路径冒烟
- 脚本：`scripts/test-vpn-socks.js`
- 说明：在 WS+VPN 通道打通后运行，可覆盖“SOCKS → WS server → WS client → 目标站点”的数据路径。
- 示例：`node scripts/test-vpn-socks.js --target=example.com --tport=80`
- 默认读取：`VPN_SOCKS_HOST` / `VPN_SOCKS_PORT` / `VPN_SOCKS_AUTH_TOKEN`（或 `config.vpn.socks.*`）

## WS + VPN 联合冒烟（仅文档）
1) Server 侧：
   - `WS_MODE=server`、`WS_SERVER_ENABLED=true`
   - `VPN_MODE=server`、`VPN_ENABLED=true`、`VPN_SOCKS_PORT=1080`、`VPN_SOCKS_AUTH_TOKEN=...`
2) Client 侧：
   - `WS_MODE=client`、`WS_CLIENT_ENABLED=true`、`WS_SERVER_URL=ws://<server>:<port>/ws/client`
   - `HOST=127.0.0.1`（确保本地 API 可被 WS client 调用）
3) 验证（不执行）：
   - `node scripts/status.js --ws` 查看 `ws_client:status:*`
   - `node scripts/test-vpn-socks.js --target=example.com --tport=80`
