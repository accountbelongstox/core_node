# internal/auth/keys.go

## 1. 功能描述
管理JWT密钥对的生成、加载和存储，确保系统安全性的关键组件。

## 2. API接口清单
不直接提供API接口，为JWT认证提供密钥管理支持。

## 3. 方法清单
- `GenerateKeyPair() error`: 生成新的RSA密钥对
- `LoadKeys() error`: 加载存储的密钥
- `SaveKeys() error`: 保存密钥到存储
- `GetPublicKey() *rsa.PublicKey`: 获取公钥
- `GetPrivateKey() *rsa.PrivateKey`: 获取私钥

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置信息)
- internal/errors/errors.go (错误处理)
- internal/logger/logger.go (日志记录) 