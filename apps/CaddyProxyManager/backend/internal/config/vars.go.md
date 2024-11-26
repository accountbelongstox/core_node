# internal/config/vars.go

## 1. 功能描述
定义应用程序的配置变量和常量，包括默认值、环境变量名称等配置相关的常量定义。

## 2. API接口清单
不直接提供API接口，为配置系统提供变量定义支持。

## 3. 方法清单
- `GetDefaultConfig() Config`: 获取默认配置
- `GetEnvVarName(configKey string) string`: 获取环境变量名
- `IsValidConfigKey(key string) bool`: 验证配置键是否有效
- `GetConfigSchema() map[string]interface{}`: 获取配置模式

## 4. 文件调用关系
调用的其他文件：
- internal/errors/errors.go (错误处理) 