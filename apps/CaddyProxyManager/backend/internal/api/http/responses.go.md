# internal/api/http/responses.go

## 1. 功能描述
定义API响应的标准格式和结构，确保所有API返回统一的响应格式。

## 2. API接口清单
不直接提供API接口，为其他处理器提供响应结构定义。

## 3. 方法清单
- `NewResponse(data interface{}, err error) Response`: 创建新的响应对象
- `Response struct`: 标准响应结构
- `ErrorResponse struct`: 错误响应结构
- `SuccessResponse struct`: 成功响应结构
- `PaginatedResponse struct`: 分页响应结构

## 4. 文件调用关系
调用的其他文件：
- internal/errors/errors.go (错误处理)
- internal/util/interfaces.go (通用接口) 