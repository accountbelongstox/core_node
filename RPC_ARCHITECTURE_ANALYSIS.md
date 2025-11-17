# RPC架构全面分析
**日期**: 2025-11-18
**状态**: 架构重构前分析

---

## 一、当前架构概览

### 1.1 目录结构

```
pycore/pyutils/rpc/
├── __init__.py
├── client/                    # 客户端库
│   ├── unified_rpc_client.js  # ✅ 主客户端（统一HTTP+WebSocket）
│   ├── http_rpc_client.js     # ⚠️ 可能重复
│   └── ws_rpc_client.js       # ⚠️ 可能重复
├── server/                    # 服务器端
│   ├── unified_server.py      # ✅ 主服务器（aiohttp）
│   ├── http_handler.py        # HTTP请求处理
│   ├── websocket_handler.py   # WebSocket处理
│   ├── request_processor.py   # 请求处理器
│   ├── ack_manager.py         # ACK管理
│   ├── client_manager.py      # 客户端管理
│   ├── routes.py              # 路由管理
│   └── threaded_server_DEPRECATED.py  # 已废弃
├── common/                    # 公共模块
│   ├── request_event_table.py # 请求事件表
│   ├── inventory_table.py     # 库存表（失败推送）
│   ├── event_cache.py         # 事件缓存
│   └── request_manager.py     # 请求管理器
├── config/                    # 配置
│   ├── constants.py           # 常量定义
│   └── rpc_config.py          # RPC配置
├── discovery/                 # 服务发现
├── protocol/                  # 协议定义
└── heartbeat/                 # 心跳机制
    ├── ack_check.py
    ├── client_cleanup.py
    └── inventory_cleanup.py
```

---

## 二、核心问题分析

### 2.1 **设计模式混乱：同步RPC vs 异步任务**

**当前问题**：
```javascript
// 客户端：同步等待模式
const result = await client.call('tts', params);
// 30秒timeout，长任务会失败
```

**应该是**：
```javascript
// 异步任务模式
const taskId = await client.submit('tts', params);  // 立即返回
// WebSocket: 等待服务器推送结果
// HTTP: 轮询任务状态
```

### 2.2 **event_table 和 inventory_table 的混乱使用**

#### request_event_table (请求事件表)
- **作用**: 存储所有进行中的请求
- **状态流转**: PENDING → PROCESSING → COMPLETED/FAILED
- **问题**: 与同步RPC设计耦合

#### inventory_table (库存表)
- **作用**: 存储推送失败的结果
- **触发**: WebSocket推送失败时
- **问题**: 与event_table职责重叠

### 2.3 **重复的客户端实现**

```
unified_rpc_client.js  ✅ 主实现
http_rpc_client.js     ⚠️ 可能重复
ws_rpc_client.js       ⚠️ 可能重复
```

**需要确认**：
- http/ws_rpc_client 是否还在使用？
- 是否可以删除？

### 2.4 **ACK机制的复杂性**

当前流程：
1. 服务器发送响应 + `requires_ack: true`
2. 客户端接收后发送ACK
3. 服务器等待ACK，超时则重试
4. 重试失败后存入inventory

**问题**：
- 在异步任务模式下，ACK应该更简单
- 不需要立即ACK，任务完成后推送即可

### 2.5 **HTTP轮询的低效实现**

当前：
```python
# HTTP handler返回"accepted"，客户端轮询/query/{id}
response = {'status': 'accepted', 'id': request_id}
# 客户端每秒轮询一次
```

**问题**：
- 短任务也要轮询（浪费）
- 长任务轮询效率低

---

## 三、理想的异步任务RPC架构

### 3.1 核心设计原则

1. **提交即返回**:
   - 客户端提交任务，立即获得task_id
   - 不等待结果

2. **事件驱动**:
   - WebSocket: 服务器主动推送
   - HTTP: 客户端轮询

3. **统一的任务表**:
   - 所有任务存储在 `TaskTable`
   - 状态: PENDING → PROCESSING → COMPLETED/FAILED/STORED

4. **简化inventory**:
   - 只存储推送失败的已完成任务
   - 重连时批量推送

### 3.2 数据流设计

#### WebSocket模式

```
Client                          Server
  |                                |
  |-- submit(route, params) ----->|
  |                                |- Create task in TaskTable
  |                                |- Return task_id
  |<--- { task_id } --------------|
  |                                |
  |                                |- Process task (async)
  |                                |- Task completed
  |                                |
  |<--- push(result) -------------|
  |     { task_id, result }        |
  |                                |
  |-- ack(task_id) -------------->|
  |                                |- Mark task as ACK'd
  |                                |- Delete from TaskTable
```

如果推送失败：
```
  |                                |- Push failed (client offline)
  |                                |- Store in InventoryTable
  |                                |
  |-- reconnect ----------------->|
  |-- send client_id ------------>|
  |                                |- Check InventoryTable
  |<--- batch_push --------------|
  |     { tasks: [...] }           |
  |                                |
  |-- ack(batch) ---------------->|
  |                                |- Delete from InventoryTable
```

#### HTTP模式

```
Client                          Server
  |                                |
  |-- POST /rpc/submit ---------->|
  |    { route, params }           |
  |                                |- Create task in TaskTable
  |<--- { task_id, status } ------|
  |     "pending"                  |
  |                                |
  (wait 1 second)                  |- Process task
  |                                |
  |-- GET /rpc/task/{id} -------->|
  |                                |- Check TaskTable
  |<--- { status: "processing" }--|
  |                                |
  (wait 1 second)                  |- Task completed
  |                                |
  |-- GET /rpc/task/{id} -------->|
  |                                |- Check TaskTable
  |<--- { status: "completed",    |
  |       result: {...} } ---------|
  |                                |
  |                                |- Delete from TaskTable
```

---

## 四、新架构设计

### 4.1 核心组件重构

#### 4.1.1 统一任务表 (TaskTable)

替代：`request_event_table`

```python
class TaskTable:
    """
    统一任务表 - 存储所有异步任务

    字段:
    - task_id: 任务ID（UUID）
    - route: 路由名称
    - params: 请求参数
    - client_id: 客户端ID
    - status: PENDING | PROCESSING | COMPLETED | FAILED
    - result: 结果数据
    - error: 错误信息
    - created_at: 创建时间
    - completed_at: 完成时间
    - protocol: 'websocket' | 'http'
    """

    def create_task(task_id, route, params, client_id, protocol):
        """创建新任务"""

    def get_task(task_id):
        """获取任务信息"""

    def update_status(task_id, status, result=None, error=None):
        """更新任务状态"""

    def delete_task(task_id):
        """删除任务（已确认收到）"""

    def get_pending_tasks(client_id):
        """获取客户端的待处理任务"""
```

#### 4.1.2 简化库存表 (InventoryTable)

保持不变，但职责更清晰：

```python
class InventoryTable:
    """
    库存表 - 只存储推送失败的已完成任务

    触发条件:
    1. 任务完成
    2. 尝试推送给WebSocket客户端
    3. 推送失败（客户端断开）
    4. 存入InventoryTable

    清理时机:
    1. 客户端重连，推送成功
    2. 任务过期（configurable）
    """
```

#### 4.1.3 删除重复模块

**删除**:
- `event_cache.py` - 不再需要
- `request_manager.py` - 功能合并到TaskTable
- `client/http_rpc_client.js` - 如果未使用
- `client/ws_rpc_client.js` - 如果未使用

**保留**:
- `unified_rpc_client.js` - 唯一客户端
- `unified_server.py` - 唯一服务器

### 4.2 客户端API重新设计

#### 旧API（同步等待）
```javascript
// ❌ 旧设计：同步等待
const result = await client.call('tts', { text: 'hello' });
// 问题：长任务会timeout
```

#### 新API（异步任务）
```javascript
// ✅ 新设计：异步任务

// 方式1：Promise模式（推荐）
const result = await client.call('tts', { text: 'hello' });
// 内部实现：
//   - WebSocket: 提交任务，等待推送
//   - HTTP: 提交任务，自动轮询
// 返回：最终结果（不会timeout）

// 方式2：回调模式
const taskId = client.submit('tts', { text: 'hello' }, (result) => {
    console.log('Task completed:', result);
});

// 方式3：事件监听
client.on('task_completed', (data) => {
    console.log('Task:', data.task_id, 'Result:', data.result);
});
const taskId = client.submit('tts', { text: 'hello' });
```

### 4.3 服务器端API重新设计

#### WebSocket Handler

```python
async def handle_websocket_message(ws, client_id, data):
    msg_type = data.get('type')

    if msg_type == 'submit':
        # 提交任务
        task_id = data.get('task_id')  # 客户端生成
        route = data.get('route')
        params = data.get('params')

        # 创建任务
        task_table.create_task(
            task_id=task_id,
            route=route,
            params=params,
            client_id=client_id,
            protocol='websocket'
        )

        # 立即返回确认
        await ws.send_json({
            'type': 'submitted',
            'task_id': task_id,
            'status': 'pending'
        })

        # 异步处理任务
        asyncio.create_task(process_task(task_id, route, params, client_id))

    elif msg_type == 'ack':
        # 确认收到结果
        task_id = data.get('task_id')
        task_table.delete_task(task_id)
```

#### HTTP Handler

```python
async def handle_submit(request):
    """POST /rpc/submit"""
    data = await request.json()
    task_id = data.get('task_id') or str(uuid.uuid4())
    route = data['route']
    params = data.get('params', {})

    # 创建任务
    task_table.create_task(
        task_id=task_id,
        route=route,
        params=params,
        client_id=request.headers.get('X-Client-ID'),
        protocol='http'
    )

    # 异步处理
    asyncio.create_task(process_task(task_id, route, params, None))

    # 立即返回
    return web.json_response({
        'task_id': task_id,
        'status': 'pending'
    })

async def handle_task_status(request):
    """GET /rpc/task/{task_id}"""
    task_id = request.match_info['task_id']
    task = task_table.get_task(task_id)

    if not task:
        return web.json_response({'error': 'Task not found'}, status=404)

    response = {
        'task_id': task_id,
        'status': task.status,
        'result': task.result if task.status == 'COMPLETED' else None,
        'error': task.error if task.status == 'FAILED' else None
    }

    # HTTP模式：返回结果后删除任务
    if task.status in ['COMPLETED', 'FAILED']:
        task_table.delete_task(task_id)

    return web.json_response(response)
```

---

## 五、重构计划

### 阶段1：核心重构
1. ✅ 创建新的 `TaskTable` 类
2. ✅ 重构 `unified_rpc_client.js` 的 `call()` 方法
3. ✅ 重构 `websocket_handler.py` 的消息处理
4. ✅ 重构 `http_handler.py` 的请求处理

### 阶段2：清理重复
1. ✅ 删除 `event_cache.py`（如果未使用）
2. ✅ 删除 `request_manager.py`（功能合并）
3. ✅ 删除 `http_rpc_client.js` 和 `ws_rpc_client.js`（如果未使用）
4. ✅ 重命名 `request_event_table.py` → `task_table.py`

### 阶段3：简化ACK机制
1. ✅ WebSocket推送后不立即重试
2. ✅ 推送失败直接存入inventory
3. ✅ 重连时批量推送inventory

### 阶段4：优化HTTP轮询
1. ✅ 客户端智能轮询（短任务快速轮询，长任务降频）
2. ✅ 服务器端任务超时清理

---

## 六、预期收益

### 6.1 性能提升
- **无timeout限制**: 长任务不会失败
- **减少轮询**: WebSocket模式0轮询
- **智能轮询**: HTTP模式根据任务类型调整频率

### 6.2 代码简化
- **减少模块**: 删除3-4个重复模块
- **统一模型**: TaskTable统一管理
- **清晰职责**: 每个组件职责明确

### 6.3 可维护性
- **易于理解**: 异步任务模型简单直观
- **易于扩展**: 新增route只需注册handler
- **易于调试**: 任务状态可追踪

---

## 七、风险评估

### 7.1 兼容性风险
**风险**: 现有调用代码可能依赖同步模式

**缓解**:
- 保持 `call()` API不变，内部切换异步
- 添加 `callSync()` 兼容旧代码（deprecated）

### 7.2 迁移成本
**风险**: 大量代码需要修改

**缓解**:
- 分阶段迁移
- 新旧API并存一段时间
- 充分测试

---

## 八、下一步行动

1. **确认删除目标**:
   - 检查 `http_rpc_client.js` 和 `ws_rpc_client.js` 是否被使用
   - 检查 `event_cache.py` 是否被使用

2. **创建新模块**:
   - `task_table.py` (重构自 request_event_table)

3. **重构客户端**:
   - `unified_rpc_client.js` 的 `call()` 方法

4. **重构服务器**:
   - WebSocket handler
   - HTTP handler

5. **测试验证**:
   - 单元测试
   - 集成测试
   - 性能测试

---

**准备开始重构？**
