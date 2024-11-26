# internal/api/router.go

## 1. 功能描述
配置和管理API路由，设置路由规则、中间件和处理器的映射关系，是API服务的路由注册中心。

## 2. API接口清单
不直接提供API接口，负责所有API路由的注册和管理。

## 3. 方法清单
- `NewRouter(h *handler.Handler) *mux.Router`: 创建新的路由器实例
- `setupMiddlewares(r *mux.Router)`: 设置全局中间件
- `setupRoutes(r *mux.Router, h *handler.Handler)`: 设置API路由
- `corsMiddleware(next http.Handler) http.Handler`: CORS中间件配置
- `loggingMiddleware(next http.Handler) http.Handler`: 日志中间件配置

## 4. 文件调用关系
调用的其他文件：
- internal/api/handler/handler.go (处理器)
- internal/api/middleware/auth.go (认证中间件)
- internal/api/handler/hosts.go (主机处理器)
- internal/api/handler/user.go (用户处理器)
- internal/logger/logger.go (日志处理) 