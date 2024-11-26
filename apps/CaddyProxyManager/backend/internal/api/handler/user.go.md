# internal/api/handler/user.go

## 1. 功能描述
处理用户相关的API请求，包括用户认证、注册、登录、个人信息管理等功能。

## 2. API接口清单
- `POST /api/auth/login`: 用户登录
- `POST /api/auth/register`: 用户注册
- `GET /api/users/me`: 获取当前用户信息
- `PUT /api/users/me`: 更新当前用户信息
- `POST /api/auth/refresh`: 刷新访问令牌

## 3. 方法清单
- `Login(w http.ResponseWriter, r *http.Request) error`: 用户登录处理
- `Register(w http.ResponseWriter, r *http.Request) error`: 用户注册处理
- `GetCurrentUser(w http.ResponseWriter, r *http.Request) error`: 获取当前用户信息
- `UpdateUser(w http.ResponseWriter, r *http.Request) error`: 更新用户信息
- `RefreshToken(w http.ResponseWriter, r *http.Request) error`: 刷新令牌

## 4. 文件调用关系
调用的其他文件：
- internal/auth/auth.go (认证逻辑)
- internal/auth/jwt.go (JWT处理)
- internal/database/models.go (用户模型)
- internal/api/http/requests.go (请求处理)
- internal/api/http/responses.go (响应处理) 