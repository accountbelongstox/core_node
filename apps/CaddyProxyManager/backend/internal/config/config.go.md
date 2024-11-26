# internal/config/config.go

## 1. 功能描述
管理应用程序的配置加载、解析和访问，支持多种配置源（环境变量、配置文件等）。

## 2. API接口清单
不直接提供API接口，为应用程序提供配置管理支持。

## 3. 方法清单
- `LoadConfig() (*Config, error)`: 加载配置
- `ParseEnv() error`: 解析环境变量
- `GetString(key string) string`: 获取字符串配置
- `GetInt(key string) int`: 获取整数配置
- `GetBool(key string) bool`: 获取布尔配置

## 4. 文件调用关系
调用的其他文件：
- internal/config/vars.go (配置变量定义)
- internal/config/folders.go (文件夹配置)
- internal/errors/errors.go (错误处理) 