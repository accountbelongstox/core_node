# internal/logger/logger.go

## 1. 功能描述
实现应用程序的日志系统，提供统一的日志记录接口和功能，支持多种日志级别和输出方式。

## 2. API接口清单
不直接提供API接口，为应用程序提供日志记录支持。

## 3. 方法清单
- `NewLogger(config *LogConfig) (*Logger, error)`: 创建新的日志器
- `Info(msg string, fields ...Field)`: 记录信息日志
- `Error(msg string, err error, fields ...Field)`: 记录错误日志
- `Debug(msg string, fields ...Field)`: 记录调试日志
- `WithContext(ctx context.Context) *Logger`: 创建带上下文的日志器

## 4. 文件调用关系
调用的其他文件：
- internal/logger/config.go (日志配置)
- internal/errors/errors.go (错误处理) 