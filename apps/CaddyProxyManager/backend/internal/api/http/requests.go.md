# internal/api/http/requests.go

## 1. 功能描述
定义所有API请求的数据结构和验证规则，为API处理器提供请求数据的解析和验证支持。

## 2. API接口清单
不直接提供API接口，为其他处理器提供请求结构定义。

## 3. 方法清单
- `Validate() error`: 请求数据验证方法
- `LoginRequest struct`: 登录请求结构
- `RegisterRequest struct`: 注册请求结构
- `UpdateUserRequest struct`: 更新用户请求结构
- `CreateHostRequest struct`: 创建主机请求结构
- `UpdateHostRequest struct`: 更新主机请求结构

## 4. 文件调用关系
调用的其他文件：
- internal/errors/errors.go (错误处理)
- internal/util/interfaces.go (通用接口)
- internal/database/models.go (数据模型定义) 