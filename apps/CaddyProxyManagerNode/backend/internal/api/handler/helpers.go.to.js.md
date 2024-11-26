# internal/api/handler/helpers.go

## 1. 功能描述
提供API处理器所需的通用辅助函数，包括请求参数解析、响应格式化、错误处理等功能。

## 2. API接口清单
不直接提供API接口，为其他处理器提供支持函数。

## 3. 方法清单
- `SendJSON(w http.ResponseWriter, status int, data interface{}) error`：发送JSON响应
- `SendError(w http.ResponseWriter, err error) error`：发送错误响应
- `ParseJSON(r *http.Request, v interface{}) error`：解析JSON请求体
- `ValidateRequest(v interface{}) error`：请求数据验证

## 4. 文件调用关系
调用的其他文件：
- internal/api/http/responses.go (响应结构定义)
- internal/errors/errors.go (错误处理)
- internal/logger/logger.go (日志记录) 