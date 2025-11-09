# MCP Server Architecture

## 概述

MCP Server 使用 **Singleton + WebSocket RPC** 架构，提供统一的微服务后端。

## 架构分层

```
pyapps/mcpserver/
├── mcpserver_main.py          # 主服务入口（Singleton RPC Backend）
├── services/                   # RPC 服务层
│   ├── __init__.py
│   └── document_offline_service.py
└── controllers/                # 业务逻辑层
    └── document_offline/
        ├── __init__.py
        ├── domain_context.py       # 领域上下文
        ├── file_mapper.py          # 文件映射
        ├── url_queue.py            # URL 队列
        └── document_offline_controller.py  # 主控制器
```

## 三层架构

### 1. RPC 服务层 (Service Layer)

**位置**: `pyapps/mcpserver/services/`

**职责**:
- 注册 RPC 路由
- 处理 RPC 请求/响应
- 参数验证
- 错误处理
- 状态管理（如 crawl_id 映射）

**示例**: `document_offline_service.py`

```python
class DocumentOfflineService:
    def register_routes(self, rpc_server):
        @rpc_server.route('document_offline.start_crawl')
        async def start_crawl(params):
            return await self.start_crawl(params)

    async def start_crawl(self, params):
        controller = DocumentOfflineController()
        result = await controller.start(params)
        return result
```

### 2. 业务逻辑层 (Controller Layer)

**位置**: `pyapps/mcpserver/controllers/`

**职责**:
- 纯业务逻辑实现
- 不涉及 RPC 通信
- 可独立测试
- 可被不同入口复用（RPC、CLI、其他）

**示例**: `document_offline_controller.py`

```python
class DocumentOfflineController:
    async def start(self, config):
        # 纯业务逻辑
        self.domain_context = DomainContext(target_url)
        await self.process_queue()
        return {'success': True, 'statistics': stats}
```

### 3. 领域模型层 (Domain Layer)

**位置**: `pyapps/mcpserver/controllers/*/`

**职责**:
- 领域实体（DomainContext, FileMapper, UrlQueue）
- 业务规则
- 数据结构

## RPC 通信流程

```
客户端 (WsRpcClient)
    ↓
    WebSocket 连接 (ws://localhost:8767)
    ↓
MCP Server (Singleton RPC Backend)
    ↓
路由分发 (@rpc_server.route)
    ↓
Service Layer (document_offline_service)
    ↓
Controller Layer (document_offline_controller)
    ↓
Domain Layer (domain_context, file_mapper, url_queue)
```

## Singleton 模式

**特点**:
- 第一个启动的实例成为 PRIMARY（运行 RPC 服务器）
- 后续实例成为 SECONDARY（作为客户端连接）
- 所有实例共享同一个后端

**检测端口**: `localhost:19997`
**RPC 端口**: `localhost:8767`

## 服务注册

在 `mcpserver_main.py` 中：

```python
class UnifiedMCPServer(SingletonRpcBackend):
    def __init__(self):
        # 初始化服务
        self.document_offline_service = DocumentOfflineService()

    def _register_backend_routes(self):
        # 注册 document_offline 路由
        self.document_offline_service.register_routes(self.rpc_server)
```

## 可用服务

### document_offline

**路由**:
- `document_offline.start_crawl` - 启动爬取
- `document_offline.get_status` - 获取状态
- `document_offline.stop_crawl` - 停止爬取
- `document_offline.list_crawls` - 列出所有爬取

**参数示例**:

```python
# start_crawl
{
    'target_url': 'https://example.com',
    'depth': 3,
    'fetcher_type': 'http',
    'scope_type': 'full'
}

# get_status
{
    'crawl_id': 'crawl_1_1234567890'
}
```

### system

**路由**:
- `system.health` - 健康检查
- `system.list_services` - 列出所有服务
- `system.get_info` - 获取系统信息

## 客户端使用

### 示例 1: Python RPC Client

```python
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient

client = WsRpcClient({'host': 'localhost', 'port': 8767})
await client.connect()

result = await client.call('document_offline.start_crawl', {
    'target_url': 'https://example.com',
    'depth': 1
})

await client.disconnect()
```

### 示例 2: Sub-App 入口

位置: `pyapps/document_offline/main.py`

```python
from pyapps.mcpserver.controllers.document_offline import DocumentOfflineController

controller = DocumentOfflineController()
result = await controller.start(config)
```

**注意**: Sub-app 只导入逻辑，不实现类。

## 扩展新服务

### 步骤：

1. **创建 Controller**:
   ```
   pyapps/mcpserver/controllers/my_service/
   ├── __init__.py
   └── my_service_controller.py
   ```

2. **创建 Service**:
   ```python
   # pyapps/mcpserver/services/my_service_service.py
   class MyServiceService:
       def register_routes(self, rpc_server):
           @rpc_server.route('my_service.do_something')
           async def do_something(params):
               controller = MyServiceController()
               return await controller.do_something(params)
   ```

3. **注册到 MCP Server**:
   ```python
   # mcpserver_main.py
   def __init__(self):
       self.my_service = MyServiceService()

   def _register_backend_routes(self):
       self.my_service.register_routes(self.rpc_server)
   ```

4. **更新服务列表**:
   ```python
   # system.list_services
   'my_service': ['do_something']
   ```

## 测试

### Controller 测试

```bash
python pyapps/mcpserver/test_controllers_simple.py
```

### RPC 客户端测试

1. 启动 MCP Server:
   ```bash
   python pyapps/mcpserver/mcpserver_main.py
   ```

2. 运行客户端示例:
   ```bash
   python pyapps/document_offline/rpc_client_example.py
   ```

## 优势

1. **分层清晰**: Service层处理RPC，Controller层处理业务逻辑
2. **易于测试**: Controller可独立测试，无需启动RPC服务器
3. **可复用**: Controller可被多种入口调用（RPC、CLI、其他）
4. **易于扩展**: 新服务只需添加Service和Controller
5. **Singleton模式**: 多实例共享后端，节省资源

## 注意事项

1. **Service层不应包含业务逻辑** - 只负责RPC路由和参数转换
2. **Controller层不应知道RPC** - 纯业务逻辑，可独立测试
3. **所有类实现在Controller** - Sub-app只导入，不实现
4. **使用pyrpc (wsrpc)** - 标准的RPC通信方式
