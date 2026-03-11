# clientRegistrationHandler — 总结文档

对用户提供的 `<content>`（OAuth 客户端注册 handler）的简明总结。

## 结构
- ES 模块：导入 express、OAuthClientMetadataSchema、crypto、cors、rateLimit、allowedMethods、错误类；导出 clientRegistrationHandler({ clientsStore, clientSecretExpirySeconds, rateLimit, clientIdGeneration }) 返回 Router。Router：cors、allowedMethods(['POST'])、express.json()、可选 rateLimit（1h/20 次）；POST '/' 内 safeParse body、区分 public client、生成 client_secret/client_id、registerClient、201 或错误 JSON。

## 要点
- **默认**：clientSecretExpirySeconds 为 30 天；clientIdGeneration 默认 true；public client（token_endpoint_auth_method === 'none'）无 client_secret。
- **生成**：client_secret 为 crypto.randomBytes(32).toString('hex')；client_id 为 crypto.randomUUID()；client_id_issued_at、client_secret_expires_at 按配置计算。
- **限流**：express-rate-limit 默认 1 小时 20 次，可关；错误返回 TooManyRequestsError 等。**CORS**：允许任意 origin，便于 Web/MCP 客户端。

## 用途
实现 OAuth 2.0 动态客户端注册（RFC 7591 风格）的 HTTP 端点，供 MCP 等 Web 客户端注册并获取 client_id/client_secret，与 clientsStore 集成。
