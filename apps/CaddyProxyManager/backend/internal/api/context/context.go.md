# internal/api/context/context.go

## 1. 功能描述
该文件定义了API请求上下文的核心结构和处理方法，为HTTP请求处理提供统一的上下文环境。

## 2. API接口清单
不直接提供API接口，而是为其他API处理器提供上下文支持。

## 3. 方法清单
- `NewContext(w http.ResponseWriter, r *http.Request) *Context`：创建新的上下文实例
- `GetUserID(ctx *Context) (uint, error)`：获取当前用户ID
- `SetUser(ctx *Context, user *models.User)`：设置当前用户信息
- `GetUser(ctx *Context) *models.User`：获取当前用户信息

## 4. 文件调用关系
调用的其他文件：
- internal/database/models.go (用户模型)
- internal/errors/errors.go (错误处理)
- internal/auth/jwt.go (JWT相关功能) 