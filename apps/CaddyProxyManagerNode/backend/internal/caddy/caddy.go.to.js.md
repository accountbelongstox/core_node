# internal/caddy/caddy.go

## 1. 功能描述
管理Caddy服务器的配置生成和管理，处理反向代理和SSL证书的自动配置等功能。

## 2. API接口清单
不直接提供API接口，为Caddy服务器提供配置管理支持。

## 3. 方法清单
- `NewCaddyManager(config *config.Config) *CaddyManager`: 创建Caddy管理器实例
- `GenerateConfig(hosts []models.Host) ([]byte, error)`: 生成Caddy配置
- `ApplyConfig(config []byte) error`: 应用Caddy配置
- `ReloadConfig() error`: 重新加载Caddy配置
- `ValidateConfig(config []byte) error`: 验证Caddy配置

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置管理)
- internal/database/models.go (主机模型)
- internal/caddy/exec.go (Caddy执行器)
- embed/caddy/host.hbs (配置模板)
- internal/logger/logger.go (日志处理) 