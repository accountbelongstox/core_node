# internal/errors/errors.go

## 1. 功能描述
定义应用程序的错误类型和错误处理机制，提供统一的错误处理方案。

## 2. API接口清单
不直接提供API接口，为应用程序提供错误处理支持。

## 3. 方法清单
- `NewError(code int, message string) *AppError`: 创建新的应用错误
- `WrapError(err error, message string) *AppError`: 包装已有错误
- `IsNotFound(err error) bool`: 检查是否为未找到错误
- `IsValidationError(err error) bool`: 检查是否为验证错误
- `IsAuthError(err error) bool`: 检查是否为认证错误

## 4. 文件调用关系
调用的其他文件：
- internal/logger/logger.go (日志处理) 