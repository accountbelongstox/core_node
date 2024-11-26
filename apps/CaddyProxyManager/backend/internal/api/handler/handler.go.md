# internal/api/handler/handler.go

## 1. 功能描述
定义API处理器的基础结构和通用接口，作为所有具体API处理器的基础。

## 2. API接口清单
- `GET /api/health`: 健康检查接口
- `GET /api/version`: 获取API版本信息

## 3. 方法清单
- `NewHandler(db *database.DB, config *config.Config) *Handler`：创建新的处理器实例
- `Health(w http.ResponseWriter, r *http.Request)`：健康检查处理函数
- `Version(w http.ResponseWriter, r *http.Request)`：版本信息处理函数
- `Setup(router *mux.Router)`：设置路由

## 4. 文件调用关系
调用的其他文件：
- internal/database/sqlite.go (数据库操作)
- internal/config/config.go (配置信息)
- internal/api/middleware/auth.go (认证中间件)
- internal/api/http/responses.go (响应处理) 