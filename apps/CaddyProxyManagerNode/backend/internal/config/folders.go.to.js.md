# internal/config/folders.go

## 1. 功能描述
管理应用程序的文件夹结构和路径，处理配置文件、数据文件等资源的存储位置。

## 2. API接口清单
不直接提供API接口，为应用程序提供文件路径管理支持。

## 3. 方法清单
- `GetConfigDir() string`: 获取配置目录路径
- `GetDataDir() string`: 获取数据目录路径
- `GetLogsDir() string`: 获取日志目录路径
- `EnsureDirectories() error`: 确保必要目录存在
- `GetAbsolutePath(relativePath string) string`: 获取绝对路径

## 4. 文件调用关系
调用的其他文件：
- internal/config/vars.go (配置变量)
- internal/errors/errors.go (错误处理) 