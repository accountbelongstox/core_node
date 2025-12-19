# RPC v2 架构全面分析

## 📋 目录
1. [架构概览](#架构概览)
2. [核心组件](#核心组件)
3. [路由机制](#路由机制)
4. [请求处理流程](#请求处理流程)
5. [同步vs异步模式](#同步vs异步模式)
6. [HTTP端点](#http端点)
7. [WebSocket支持](#websocket支持)
8. [缓存与持久化](#缓存与持久化)
9. [作为统一HTTP网关的可行性](#作为统一http网关的可行性)
10. [建议的改进方案](#建议的改进方案)

---

## 架构概览

### 基本信息
- **协议版本**: 2.0.0
- **底层框架**: FastAPI + Uvicorn
- **默认端口**: 58765
- **传输协议**: HTTP + WebSocket

### 目录结构
```
pycore/pyutils/rpc_v2/
├── __init__.py                 # 主导出文件
├── constants.py                # 常量定义(路径、超时、错误码)
├── config/
│   ├── __init__.py
│   └── rpc_config.py          # RPC配置管理(单例)
├── server/
│   ├── fastapi_server.py      # ⭐ FastAPI RPC 服务器核心
│   ├── routes_manager.py      # ⭐ 路由注册管理
│   ├── request_processor.py   # 请求处理器
│   ├── ack_manager.py         # ACK机制管理
│   └── client_registry.py     # 客户端注册表
├── common/
│   ├── event_cache.py         # 事件缓存(30分钟TTL)
│   ├── request_event_table.py # 请求事件表(生命周期追踪)
│   ├── inventory_table.py     # 库存表(失败重投)
│   └── request_manager.py     # 请求管理器
├── protocol/
│   ├── models.py              # 协议数据模型
│   └── rpc_protocol.py        # RPC协议客户端/服务端
├── discovery/
│   ├── rpc_discovery.py       # RPC服务发现
│   ├── network_scanner.py     # 网络扫描
│   └── local_ip_detector.py   # 本地IP检测
├── address/
│   └── address_provider.py    # RPC地址提供者
└── heartbeat/
    ├── ack_check.py           # ACK检查
    ├── client_cleanup.py      # 客户端清理
    └── inventory_cleanup.py   # 库存清理
```

---

## 核心组件

### 1. FastAPIRPCServer (fastapi_server.py)
**主要职责**: FastAPI RPC服务器核心实现

**关键特性**:
```python
class FastAPIRPCServer:
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        self.host = options.get("host", "0.0.0.0")
        self.port = options.get("port", 58765)
        self.debug = options.get("debug", False)
        
        # 核心组件
        self.routes_manager = RoutesManager(debug=self.debug)
        self.client_registry = ClientRegistry(debug=self.debug)
        self.request_processor = RequestProcessor(...)
        self.ack_manager = FastAPIAckManager(...)
        
        # FastAPI应用
        self.app = FastAPI(
            title="Pycore RPC Server",
            version="2.0.0",
            docs_url=None,  # Swagger禁用
            redoc_url=None  # ReDoc禁用
        )
```

**主要方法**:
- `route(name, handler, sync=False, description=None)` - 注册RPC路由
- `add_static_dir(url_prefix, directory)` - 挂载静态文件目录
- `_handle_http_rpc(request, route_override)` - HTTP请求处理
- `_handle_websocket(websocket)` - WebSocket连接处理

### 2. RoutesManager (routes_manager.py)
**主要职责**: 路由注册与元数据管理

**核心数据结构**:
```python
class RoutesManager:
    self.routes: Dict[str, Callable] = {}           # 路由处理函数
    self.route_configs: Dict[str, RouteConfig] = {} # 路由配置元数据
    self.events: Dict[str, List[Callable]] = {}     # 事件处理器
```

**RouteConfig结构**:
```python
@dataclass
class RouteConfig:
    handler: Callable       # 处理函数
    sync: bool             # 是否同步模式
    is_coroutine: bool     # 是否协程函数
    description: str       # 路由描述
    timeout: float         # 超时时间
```

**关键方法**:
- `register_route(name, handler, sync, description, timeout)` - 注册路由
- `get_route_config(name)` - 获取路由配置
- `is_sync_route(name)` - 检查是否同步路由
- `get_route_stats()` - 获取路由统计信息

### 3. RequestEventTable (request_event_table.py)
**主要职责**: 请求生命周期追踪

**请求状态**:
```python
class RequestStatus(Enum):
    PENDING = "pending"         # 等待处理
    PROCESSING = "processing"   # 处理中
    COMPLETED = "completed"     # 已完成
    FAILED = "failed"          # 失败
    CANCELLED = "cancelled"    # 已取消
```

**存储结构**:
- TTL: 1小时
- Max Size: 10,000,000
- 自动清理过期事件

### 4. InventoryTable (inventory_table.py)
**主要职责**: 失败消息重投队列

**用途**:
- 缓存处理失败的响应
- 客户端重试时返回缓存结果
- 避免重复处理

**存储特性**:
- TTL: 1小时
- Max Size: 10,000,000

### 5. EventCache (event_cache.py)
**主要职责**: 短期事件缓存(幂等性)

**特性**:
- TTL: 30分钟
- Max Size: 10,000
- 用于去重

---

## 路由机制

### 路由注册方式

#### 方式1: 直接注册
```python
rpc_server = FastAPIRPCServer(options)

# 同步路由(立即返回)
rpc_server.route("get_status", get_status_handler, sync=True)

# 异步路由(ACK机制)
rpc_server.route("process_file", process_file_handler, sync=False)
```

#### 方式2: 批量注册(如MCP Backend)
```python
from pycore.pyctl.mcpctl.backend.rpc_routes import register_mcp_routes

register_mcp_routes(rpc_server)
```

### 路由配置元数据
每个路由都有完整的元数据:
```python
{
    "name": "translate_text",
    "sync": False,                    # 异步路由
    "is_coroutine": True,             # 协程处理函数
    "description": "翻译文本",
    "timeout": 30.0                   # 超时30秒
}
```

---

## 请求处理流程

### HTTP请求流程

#### 1. 请求接收
```http
POST /rpc/translate_text
Content-Type: application/json

{
    "route": "translate_text",
    "id": "req-12345",
    "params": {
        "text": "Hello",
        "src": "en",
        "dest": "ko"
    }
}
```

#### 2. 路由查找
```python
# fastapi_server.py:202
route = route_override or data.get("route")
if not self.routes_manager.has_route(route):
    return 404 Error
```

#### 3. 缓存检查
**Inventory Cache**:
```python
# fastapi_server.py:252
inventory_item = self.inventory_table.get(request_id, remove=False)
if inventory_item:
    return cached_result  # 直接返回缓存结果
```

**Event Cache**:
```python
# fastapi_server.py:284
existing_event = self.request_event_table.get_event(request_id)
if existing_event and existing_event.status == COMPLETED:
    return existing_result  # 返回已完成的结果
```

#### 4. 同步/异步分支

**同步路由** (sync=True):
```python
# fastapi_server.py:328-368
if is_sync:
    # 等待处理完成
    await self.request_processor.process_request_async(...)
    
    # 立即返回结果
    return JSONResponse({
        "type": "response",
        "id": request_id,
        "result": event.result,
        "error": event.error,
        "sync_response": True,  # 标记为同步响应
    })
```

**异步路由** (sync=False):
```python
# fastapi_server.py:382-413
else:
    # 异步处理(不等待)
    asyncio.create_task(
        self.request_processor.process_request_async(...)
    )
    
    # 返回ACK响应
    return JSONResponse({
        "type": "response",
        "id": request_id,
        "status": "accepted",
        "message": "Request accepted, please query result after 1 second",
        "requires_ack": True  # 需要后续查询
    })
```

#### 5. 结果查询(异步路由)
```http
GET /rpc/query/req-12345

Response:
{
    "type": "response",
    "id": "req-12345",
    "result": {"translated": "안녕하세요"},
    "success": true
}
```

---

## 同步vs异步模式

### 同步模式 (sync=True)
**特点**:
- ✅ 立即返回结果
- ✅ 无需轮询
- ✅ 简单直观
- ❌ 阻塞HTTP连接
- ❌ 不适合长时间任务

**适用场景**:
- 快速查询(<1秒)
- 数据库查询
- 缓存读取
- 状态检查

**示例**:
```python
# 注册同步路由
rpc_server.route("get_user", get_user_handler, sync=True)

async def get_user_handler(user_id: str):
    return {"id": user_id, "name": "John"}

# HTTP调用
POST /rpc/get_user
{"params": {"user_id": "123"}}

# 立即返回
{
    "result": {"id": "123", "name": "John"},
    "sync_response": true
}
```

### 异步模式 (sync=False) 
**特点**:
- ✅ 不阻塞连接
- ✅ 支持长时间任务
- ✅ 高并发
- ❌ 需要轮询
- ❌ 复杂性增加

**适用场景**:
- 文件处理
- AI推理
- 批量任务
- 长时间计算

**示例**:
```python
# 注册异步路由
rpc_server.route("translate_file", translate_file_handler, sync=False)

async def translate_file_handler(file_path: str):
    # 长时间处理
    await translate_large_file(file_path)
    return {"status": "completed"}

# HTTP调用
POST /rpc/translate_file
{"id": "req-001", "params": {"file_path": "/path/to/file"}}

# 立即返回ACK
{
    "id": "req-001",
    "status": "accepted",
    "requires_ack": true
}

# 轮询结果
GET /rpc/query/req-001
{
    "result": {"status": "completed"},
    "success": true
}
```

---

## HTTP端点

### 内置端点

#### 1. RPC调用端点
```
POST /rpc/{route_name}
POST /rpc
```

**请求格式**:
```json
{
    "route": "route_name",
    "id": "request_id",
    "params": {
        "key": "value"
    }
}
```

#### 2. 结果查询端点
```
GET /rpc/query/{request_id}
```

#### 3. 路由列表端点
```
GET /rpc/routes
```

**响应**:
```json
{
    "routes": [
        "get_user",
        "translate_text",
        "process_file"
    ]
}
```

#### 4. 协议端点(由RPCProtocolServer提供)
```
GET /rpc/status        # 服务状态
GET /rpc/info          # 服务信息
GET /rpc/addresses     # RPC地址列表
GET /rpc/protocol_sync # 协议同步
```

#### 5. WebSocket端点
```
WS /rpc/ws
```

---

## WebSocket支持

### 连接流程
```python
# fastapi_server.py:541-589
async def _handle_websocket(self, websocket: WebSocket):
    await websocket.accept()
    
    # 生成客户端ID
    client_id = f"ws-{uuid.uuid4()}"
    
    # 注册客户端
    self.client_registry.register_client(client_id, "websocket")
    
    # 发送WELCOME消息
    await websocket.send_json({
        "type": "welcome",
        "client_id": client_id,
        "timestamp": int(time.time() * 1000)
    })
    
    # 处理消息循环
    try:
        while True:
            data = await websocket.receive_json()
            await self._handle_ws_message(websocket, client_id, data)
    except WebSocketDisconnect:
        self.client_registry.unregister_client(client_id)
```

### 消息类型
```python
MESSAGE_TYPES = {
    "request": "request",    # RPC请求
    "response": "response",  # RPC响应
    "event": "event",       # 事件通知
    "ping": "ping",         # 心跳
    "pong": "pong",         # 心跳响应
    "ack": "ack",           # 确认
}
```

---

## 缓存与持久化

### 三级缓存系统

#### Level 1: EventCache (30分钟)
**用途**: 短期幂等性缓存
```python
# 防止重复处理
if event_cache.has(request_id):
    return event_cache.get(request_id)
```

#### Level 2: RequestEventTable (1小时)
**用途**: 请求生命周期追踪
```python
{
    "request_id": "req-001",
    "route": "translate_text",
    "status": "completed",
    "result": {...},
    "created_at": 1700000000,
    "updated_at": 1700000010
}
```

#### Level 3: InventoryTable (1小时)
**用途**: 失败消息重投
```python
{
    "request_id": "req-001",
    "route": "translate_text",
    "result": {...},
    "error": null,
    "client_id": "http-123",
    "client_type": "http"
}
```

---

## 作为统一HTTP网关的可行性

### 当前能力评估

#### ✅ 已具备能力
1. **路由注册系统** - 完整的路由管理
2. **同步/异步支持** - 灵活的处理模式
3. **缓存机制** - 三级缓存系统
4. **协议支持** - HTTP + WebSocket
5. **静态文件服务** - `add_static_dir()`
6. **CORS支持** - 跨域配置
7. **元数据管理** - 路由配置、描述、超时
8. **客户端注册** - 客户端管理系统

#### ❌ 缺失能力(与callmodule对比)
1. **无硬编码模块列表** - 当前是动态注册
2. **无模块预加载机制** - 没有启动时初始化
3. **无统一的模块调用接口** - 需要为每个模块单独注册路由
4. **无模块导入管理** - 没有防止频繁初始化的机制
5. **无Swagger/OpenAPI文档** - `docs_url=None`
6. **无RESTful API规范** - 完全自定义协议

### 改进方向

#### 方案1: 基于RPC v2扩展(推荐)
**优势**:
- 复用现有RPC基础设施
- 保持向后兼容
- 统一的请求处理流程

**实现**:
1. 创建 `ModuleRegistry` - 硬编码模块列表
2. 创建 `ModuleLoader` - 预加载模块(防止重复初始化)
3. 扩展 `RoutesManager` - 支持模块化路由
4. 添加 `ModuleCallHandler` - 统一的模块调用接口

#### 方案2: 独立HTTP网关
**优势**:
- 职责分离
- 更灵活的API设计
- 可以启用Swagger文档

**实现**:
1. 创建新的 `UnifiedHTTPGateway`
2. 硬编码支持的模块列表
3. 实现模块预加载系统
4. 提供RESTful API接口

---

## 建议的改进方案

### 1. 创建模块注册表(硬编码)
```python
# pycore/pyutils/rpc_v2/modules/module_registry.py

SUPPORTED_MODULES = {
    "translator": {
        "module_path": "pycore.pyutils.translator",
        "class_name": "GoogleTranslator",
        "preload": True,  # 启动时预加载
        "methods": {
            "translate_single": {
                "sync": False,
                "description": "翻译单个文本",
                "timeout": 30.0
            },
            "translate_batch": {
                "sync": False,
                "description": "批量翻译",
                "timeout": 60.0
            }
        }
    },
    "ocr": {
        "module_path": "pycore.pyutils.ocr.ocr_manager",
        "class_name": "OCRManager",
        "preload": True,
        "methods": {
            "recognize_text": {
                "sync": False,
                "description": "OCR识别文本",
                "timeout": 10.0
            }
        }
    }
}
```

### 2. 创建模块加载器
```python
# pycore/pyutils/rpc_v2/modules/module_loader.py

class ModuleLoader:
    def __init__(self):
        self._loaded_modules = {}  # 缓存已加载的模块
        self._instances = {}        # 缓存模块实例
    
    def preload_modules(self):
        """启动时预加载所有标记为preload的模块"""
        for name, config in SUPPORTED_MODULES.items():
            if config.get("preload"):
                self.load_module(name)
    
    def load_module(self, module_name: str):
        """加载模块(带缓存)"""
        if module_name in self._loaded_modules:
            return self._loaded_modules[module_name]
        
        config = SUPPORTED_MODULES.get(module_name)
        if not config:
            raise ValueError(f"Module {module_name} not in registry")
        
        # 导入模块
        module = importlib.import_module(config["module_path"])
        self._loaded_modules[module_name] = module
        return module
    
    def get_instance(self, module_name: str):
        """获取模块实例(单例)"""
        if module_name in self._instances:
            return self._instances[module_name]
        
        module = self.load_module(module_name)
        config = SUPPORTED_MODULES[module_name]
        
        # 创建实例
        cls = getattr(module, config["class_name"])
        instance = cls()
        self._instances[module_name] = instance
        return instance
```

### 3. 创建统一模块调用路由
```python
# pycore/pyutils/rpc_v2/modules/module_call_handler.py

class ModuleCallHandler:
    def __init__(self, module_loader: ModuleLoader):
        self.module_loader = module_loader
    
    async def handle_call(self, module: str, method: str, **params):
        """统一的模块调用接口"""
        # 检查模块是否在注册表
        if module not in SUPPORTED_MODULES:
            raise ValueError(
                f"Module '{module}' not supported. "
                f"Supported modules: {list(SUPPORTED_MODULES.keys())}"
            )
        
        # 检查方法是否在注册表
        module_config = SUPPORTED_MODULES[module]
        if method not in module_config["methods"]:
            raise ValueError(
                f"Method '{method}' not supported for module '{module}'. "
                f"Supported methods: {list(module_config['methods'].keys())}"
            )
        
        # 获取模块实例
        instance = self.module_loader.get_instance(module)
        
        # 调用方法
        func = getattr(instance, method)
        if asyncio.iscoroutinefunction(func):
            result = await func(**params)
        else:
            result = func(**params)
        
        return result
```

### 4. 注册到RPC服务器
```python
# 启动时初始化
module_loader = ModuleLoader()
module_loader.preload_modules()  # 预加载所有模块

module_call_handler = ModuleCallHandler(module_loader)

# 自动注册所有模块的方法到RPC路由
for module_name, module_config in SUPPORTED_MODULES.items():
    for method_name, method_config in module_config["methods"].items():
        route_name = f"{module_name}.{method_name}"
        
        async def handler(**params):
            return await module_call_handler.handle_call(
                module=module_name,
                method=method_name,
                **params
            )
        
        rpc_server.route(
            name=route_name,
            handler=handler,
            sync=method_config["sync"],
            description=method_config["description"]
        )
```

### 5. 使用示例
```python
# HTTP调用
POST /rpc/translator.translate_single
{
    "params": {
        "text": "Hello",
        "src": "en",
        "dest": "ko"
    }
}

# 响应
{
    "result": {
        "original_text": "Hello",
        "translated_text": "안녕하세요",
        "from_cache": false
    }
}
```

---

## 总结

### RPC v2 的核心优势
1. ✅ **完整的RPC基础设施** - 路由、缓存、ACK机制
2. ✅ **灵活的同步/异步支持** - 适应不同场景
3. ✅ **强大的缓存系统** - 三级缓存提升性能
4. ✅ **WebSocket支持** - 实时通信
5. ✅ **协议规范** - 统一的消息格式

### 作为统一HTTP网关的潜力
**可行性**: ⭐⭐⭐⭐⭐ (5/5)

**需要添加的核心功能**:
1. 硬编码模块注册表 (防止动态加载)
2. 模块预加载机制 (防止频繁初始化)
3. 统一模块调用接口 (简化调用)
4. 自动路由注册 (基于注册表)

**建议**:
- 采用**方案1**(基于RPC v2扩展)
- 创建 `pycore/pyutils/rpc_v2/modules/` 子模块
- 保持向后兼容,不破坏现有RPC功能
- 提供清晰的模块注册文档

**下一步**:
1. 创建模块注册表规范
2. 实现模块加载器
3. 实现统一调用处理器
4. 编写详细文档和示例
