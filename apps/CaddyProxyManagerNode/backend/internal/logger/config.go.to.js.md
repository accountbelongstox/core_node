# internal/logger/config.go

## 1. 功能描述
管理日志系统的配置，包括日志级别、输出格式、文件路径等配置项的定义和处理。

## 2. API接口清单
不直接提供API接口，为日志系统提供配置支持。

## 3. 方法清单
- `NewLogConfig() *LogConfig`: 创建新的日志配置
- `SetLogLevel(level string) error`: 设置日志级别
- `SetLogFormat(format string) error`: 设置日志格式
- `SetLogFile(path string) error`: 设置日志文件
- `ValidateConfig() error`: 验证日志配置

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (应用配置)
- internal/errors/errors.go (错误处理) 