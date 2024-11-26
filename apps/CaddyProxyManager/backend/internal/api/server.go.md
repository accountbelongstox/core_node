# internal/api/server.go

## 1. 功能描述
实现HTTP服务器的核心功能，包括服务器的启动、关闭、配置管理等，是API服务的主要入口点。

## 2. API接口清单
不直接提供API接口，负责服务器的生命周期管理。

## 3. 方法清单
- `NewServer(config *config.Config, db *database.DB) *Server`: 创建新的服务器实例
- `Start() error`: 启动HTTP服务器
- `Shutdown(ctx context.Context) error`: 优雅关闭服务器
- `setupServer() *http.Server`: 配置HTTP服务器
- `setupTLS() (*tls.Config, error)`: 配置TLS设置

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置管理)
- internal/api/router.go (路由配置)
- internal/database/sqlite.go (数据库连接)
- internal/logger/logger.go (日志处理)
- internal/api/handler/handler.go (API处理器) 