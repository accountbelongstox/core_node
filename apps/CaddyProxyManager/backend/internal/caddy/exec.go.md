# internal/caddy/exec.go

## 1. 功能描述
处理Caddy服务器进程的执行、管理和控制，包括启动、停止、重启等操作。

## 2. API接口清单
不直接提供API接口，为Caddy服务器提供进程管理支持。

## 3. 方法清单
- `StartCaddy(configPath string) error`: 启动Caddy服务器
- `StopCaddy() error`: 停止Caddy服务器
- `RestartCaddy() error`: 重启Caddy服务器
- `IsCaddyRunning() bool`: 检查Caddy服务器状态
- `ExecuteCaddyCommand(args ...string) error`: 执行Caddy命令

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置管理)
- internal/logger/logger.go (日志处理)
- internal/errors/errors.go (错误处理) 