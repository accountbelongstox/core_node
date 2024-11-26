# internal/api/handler/hosts.go

## 1. 功能描述
处理与主机管理相关的API请求，包括主机配置的增删改查等操作。负责Caddy服务器的主机配置管理。

## 2. API接口清单
- `GET /api/hosts`: 获取所有主机配置列表
- `POST /api/hosts`: 创建新的主机配置
- `PUT /api/hosts/{id}`: 更新指定主机配置
- `DELETE /api/hosts/{id}`: 删除指定主机配置
- `GET /api/hosts/{id}`: 获取单个主机配置详情

## 3. 方法清单
- `ListHosts(w http.ResponseWriter, r *http.Request) error`: 列出所有主机配置
- `CreateHost(w http.ResponseWriter, r *http.Request) error`: 创建主机配置
- `UpdateHost(w http.ResponseWriter, r *http.Request) error`: 更新主机配置
- `DeleteHost(w http.ResponseWriter, r *http.Request) error`: 删除主机配置
- `GetHost(w http.ResponseWriter, r *http.Request) error`: 获取单个主机配置

## 4. 文件调用关系
调用的其他文件：
- internal/caddy/caddy.go (Caddy配置管理)
- internal/database/models.go (数据模型)
- internal/api/http/requests.go (请求处理)
- internal/api/http/responses.go (响应处理)
- internal/jobqueue/main.go (任务队列处理) 