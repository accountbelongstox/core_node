# internal/auth/auth.go

## 1. 功能描述
提供用户认证和授权的核心功能，包括密码哈希、验证、会话管理等安全相关操作。

## 2. API接口清单
不直接提供API接口，为认证系统提供核心功能支持。

## 3. 方法清单
- `HashPassword(password string) (string, error)`: 密码哈希处理
- `CheckPassword(password, hash string) bool`: 密码验证
- `GenerateToken(user *models.User) (string, error)`: 生成认证令牌
- `ValidateCredentials(username, password string) (*models.User, error)`: 验证用户凭证
- `RefreshUserToken(refreshToken string) (string, error)`: 刷新用户令牌

## 4. 文件调用关系
调用的其他文件：
- internal/database/models.go (用户模型)
- internal/auth/jwt.go (JWT处理)
- internal/errors/errors.go (错误处理)
- internal/config/config.go (配置信息) 