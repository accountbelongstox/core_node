# internal/api/middleware/auth.go

## 1. 功能描述
实现API认证中间件，处理请求的身份验证和授权逻辑。

## 2. API接口清单
不直接提供API接口，作为中间件为其他API提供认证支持。

## 3. 方法清单
- `AuthMiddleware(next http.Handler) http.Handler`: JWT认证中间件
- `RequireAuth(next http.HandlerFunc) http.HandlerFunc`: 需要认证的处理器包装器
- `OptionalAuth(next http.HandlerFunc) http.HandlerFunc`: 可选认证的处理器包装器
- `ValidateToken(token string) (*jwt.Claims, error)`: 验证JWT令牌
- `ExtractToken(r *http.Request) string`: 从请求中提取令牌

## 4. 文件调用关系
调用的其他文件：
- internal/auth/jwt.go (JWT处理)
- internal/auth/auth.go (认证逻辑)
- internal/api/context/context.go (上下文处理)
- internal/database/models.go (用户模型)
- internal/errors/errors.go (错误处理) 