# OpenAI 官方 API 兼容入口（单 Key 简版）实施方案

> 目标：在本项目新增真正的 `/v1/chat/completions`（及 `/v1/completions`）官方兼容入口，部署在海外节点直接连 `api.openai.com` 或自有海外反代。先落地单 API Key 简版，后续再扩展账户池/调度。

## 范围与行为
- 新增路由（建议 `src/routes/openaiOfficialRoutes.js`，或在现有 openaiRoutes 中拆分官方分支）：  
  - 支持 `/v1/chat/completions`、`/v1/completions`。  
  - 不再做 Codex 改写，不注入 instructions，不删除/覆盖 SDK 参数，保持 messages/tools/response_format 等字段原样透传。  
  - 流式 SSE/非流式均透传。
- 上游目标：默认 `https://api.openai.com`，可通过 `OPENAI_BASE_URL` 指向自建海外反代；支持代理/自定义 Agent（沿用现有 ProxyHelper 机制）。
- 认证：`Authorization: Bearer ${OPENAI_API_KEY}`（单 Key 简版）；可选透传 `OpenAI-Organization`、`OpenAI-Project`（ENV 配置）。
- 兼容性：保留现有 Codex 路由不变；新官方入口独立，不影响现有 Web access token 流程。

## 配置（env/example 更新）
- `OPENAI_API_KEY`：官方 API Key（单 Key）。  
- `OPENAI_BASE_URL`：可选，上游基址（默认 `https://api.openai.com`）。  
- `OPENAI_OFFICIAL_TIMEOUT_MS`：可选，默认复用全局请求超时或自定义（如 120000）。  
- 代理：沿用全局 `HTTP_PROXY` / `HTTPS_PROXY` 或在 ProxyHelper 中为 official-openai 增加配置。  
- 可选：`OPENAI_ORG`、`OPENAI_PROJECT` 透传头。

## 处理流程（简版）
1) 权限校验：`authenticateApiKey` 后检查 `permissions` in {`openai`, `all`}; 后续可扩展新权限位（如 `openai-official`）。  
2) 认证选 Key：单 Key 直接读 `OPENAI_API_KEY`；无则报 500/配置错误。  
3) 请求构造：保持请求体/headers 原样，补充 Authorization/Content-Type；若配置了 org/project，则增加对应头。  
4) 调用上游：axios 直连 `OPENAI_BASE_URL/v1/chat/completions` 或 `.../completions`，支持流式 `responseType: stream`。  
5) 响应处理：  
   - 非流式：直接透传 JSON；记录 usage（prompt_tokens/completion_tokens/total_tokens），模型取响应中的 `model`。  
   - 流式：SSE 透传；解析 `usage`/`model`（若末尾 event 带有）再记录；暴露诊断头（如 `x-request-id` 等安全头）。  
   - 错误：429/401/402 按上游返回透传，并记录/日志。单 Key 版可仅日志提示；账户池版本才标记 rate limit 状态。

## WebSocket/客户端中继（如需）
- 若 WS 客户端也要用官方 OpenAI：在 WS 消息中携带 `endpoint/method/body/headers`，本地 HTTP 直接调用官方路由（复用 `requestByApi.callModelApi`）。无需 Codex 适配或额外 relay service。

## 测试清单（最小）
- 非流式：`messages=[{role:'user',content:'hi'}]`，确认 200 且 usage 记录。  
- 流式：`stream=true`，确认 SSE 透传、结束后无挂起。  
- 401：无/错 key；429：可模拟上游限流（或检查透传逻辑）。  
- 若配置反代/代理：验证连通性、超时、SNI/证书正常。

## 后续扩展（待选）
- 账户池/调度：`openaiOfficialAccountService` + scheduler，支持多 Key 轮询/健康检查/权重；与 rate-limit/欠费标记联动。  
- 组织/项目透传的 per-key 配置；前端/ops 管控面板。  
- 更完整的错误分类与指标（成功率、P95、429/401 计数）。  
- 结合现有 usage/rate-limit 视图，增加官方 OpenAI 维度。

## 风险与注意
- 部署节点需可直连海外（或有稳定反代），关注带宽/延迟/错误重试。  
- 计费独立于 ChatGPT Plus，需准备可替换的 API Key/配额告警。  
- 与 Codex 路由并存时，明确文档：SDK/官方语义走官方路由，Codex CLI 走现有 Codex 路由。
