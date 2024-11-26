# internal/auth/jwt.go

## 1. 功能描述
处理JWT（JSON Web Token）相关的所有操作，包括令牌的生成、验证、解析等功能。

## 2. API接口清单
不直接提供API接口，为认证系统提供JWT处理支持。

## 3. 方法清单
- `GenerateJWT(claims jwt.Claims) (string, error)`: 生成JWT令牌
- `ValidateJWT(token string) (*jwt.Claims, error)`: 验证JWT令牌
- `ParseToken(tokenString string) (*jwt.Token, error)`: 解析JWT令牌
- `GetTokenClaims(token *jwt.Token) (*CustomClaims, error)`: 获取令牌声明
- `NewRefreshToken(userID uint) (string, error)`: 生成刷新令牌

## 4. 文件调用关系
调用的其他文件：
- internal/auth/keys.go (密钥管理)
- internal/config/config.go (配置信息)
- internal/errors/errors.go (错误处理) 