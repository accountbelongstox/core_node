# MCP Server Tests

测试文件用于验证 MCP 服务的启动和地址查询功能。

## 测试文件

### 1. test_start_mcp_service.py - 启动 MCP 服务

启动一个 MCP 服务，监听指定端口并响应标准协议查询。

**用法：**
```bash
# 启动默认服务（端口 8767）
python -m pyapps.mcpserver.tests.test_start_mcp_service

# 启动指定端口的服务
python -m pyapps.mcpserver.tests.test_start_mcp_service 8767 "Test Service 1"

# 在不同机器上启动多个服务
python -m pyapps.mcpserver.tests.test_start_mcp_service 8767 "Service A"
python -m pyapps.mcpserver.tests.test_start_mcp_service 8768 "Service B"
python -m pyapps.mcpserver.tests.test_start_mcp_service 8769 "Service C"
```

**功能：**
- 启动 HTTP 服务器监听指定端口
- 响应 `/mcp/status` 查询（返回是否是 MCP 服务）
- 响应 `/mcp/info` 查询（返回服务信息）
- 运行直到按 Ctrl+C 停止

**端点：**
- `http://localhost:{port}/mcp/status` - 服务状态
- `http://localhost:{port}/mcp/info` - 服务信息

### 2. test_query_addresses.py - 查询可用地址

定时查询局域网和本地可用的 MCP 服务地址。

**用法：**
```bash
# 使用默认设置（端口 8767，间隔 5 秒）
python -m pyapps.mcpserver.tests.test_query_addresses

# 指定端口和查询间隔
python -m pyapps.mcpserver.tests.test_query_addresses 8767 3

# 查询不同端口
python -m pyapps.mcpserver.tests.test_query_addresses 8768 5
```

**功能：**
- 定时查询局域网和本地可用的 MCP 服务
- 打印可用地址列表
- 显示是否使用 localhost
- 显示是否有可用服务
- 统计信息（平均、最大、最小服务数）

**输出示例：**
```
======================================================================
 QUERY #1 - Port 8767
======================================================================
Found 2 available service(s)
Use localhost: True
Has available service: True

Available Addresses:
  [1] 192.168.1.100:8767
      WebSocket: ws://192.168.1.100:8767
      Localhost: False
      Available: True
  [2] localhost:8767
      WebSocket: ws://localhost:8767
      Localhost: True
      Available: True

Statistics:
  Average services found: 2.0
  Max services found: 2
  Min services found: 2
======================================================================
```

## 测试场景

### 场景 1: 单机测试

1. 启动一个 MCP 服务：
   ```bash
   python -m pyapps.mcpserver.tests.test_start_mcp_service 8767 "Local Service"
   ```

2. 在另一个终端查询地址：
   ```bash
   python -m pyapps.mcpserver.tests.test_query_addresses 8767 3
   ```

### 场景 2: 局域网多服务测试

1. 在机器 A 启动服务：
   ```bash
   python -m pyapps.mcpserver.tests.test_start_mcp_service 8767 "Service A"
   ```

2. 在机器 B 启动服务：
   ```bash
   python -m pyapps.mcpserver.tests.test_start_mcp_service 8767 "Service B"
   ```

3. 在机器 C 启动服务：
   ```bash
   python -m pyapps.mcpserver.tests.test_start_mcp_service 8767 "Service C"
   ```

4. 在任意机器查询地址（会找到所有可用服务）：
   ```bash
   python -m pyapps.mcpserver.tests.test_query_addresses 8767 5
   ```

## 注意事项

1. **端口冲突**：确保不同服务使用不同端口，或在不同机器上运行
2. **防火墙**：确保防火墙允许指定端口的 HTTP 访问
3. **网络扫描**：地址查询会扫描整个局域网，可能需要一些时间
4. **服务发现**：服务发现基于标准协议，服务必须响应 `/mcp/status` 端点

## 协议说明

MCP 标准协议端点：

- **GET /mcp/status** - 查询服务是否是 MCP 服务
  ```json
  {
    "is_mcp_service": true,
    "protocol_version": "1.0"
  }
  ```

- **GET /mcp/info** - 获取服务详细信息
  ```json
  {
    "is_mcp_service": true,
    "protocol_version": "1.0",
    "service_name": "Test Service",
    "port": 8767,
    "host": "localhost",
    "capabilities": ["test", "query"],
    "metadata": {}
  }
  ```

