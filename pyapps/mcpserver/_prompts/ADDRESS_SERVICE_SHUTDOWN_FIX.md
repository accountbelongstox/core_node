# Address Service后台线程关闭修复

**日期**: 2025-11-13
**问题**: `RuntimeError: cannot schedule new futures after interpreter shutdown`
**类型**: 资源泄漏 / 线程生命周期管理

---

## 问题分析

### 错误堆栈
```
Exception in thread AddressService-Scanner:
RuntimeError: cannot schedule new futures after interpreter shutdown
```

### 调用链分析
```
AddressService._background_scan_loop()  # daemon线程
  → _discover_address()
    → address_mapper.scan_and_map()
      → server_discovery.find_servers_quick()
        → _probe_hosts_for_mcp()
          → executor.submit()  # ← RuntimeError发生在这里
```

### 根本原因

**问题1: daemon线程未被正确停止**
```python
# address_service.py line 268-272
self._scan_thread = threading.Thread(
    target=self._background_scan_loop,
    daemon=True,  # ← daemon线程
    name="AddressService-Scanner"
)
```

**问题2: 服务对象作用域错误**
```python
# mcpserver_main.py line 36 (修复前)
def main_app_entry():
    address_service = MCPServerAddressService(...)  # ← 局部变量
    address_service.start()
    # ...
```

**问题3: 清理回调无法访问服务对象**
```python
# mcpserver_main.py line 46 (修复前)
def on_closing():
    ColorPrint.yellow("Stopping all services...")
    # ← 无法访问 address_service！
    # ← 无法调用 address_service.stop()！
```

### 时序问题
```
时间轴:
T1: main_app_entry() 创建 address_service (局部变量)
T2: address_service.start() 启动daemon线程
T3: 用户退出程序
T4: on_closing() 被调用，但无法访问 address_service
T5: main_app_entry() 返回，address_service 被销毁
T6: Python解释器开始关闭
T7: daemon线程仍在运行，尝试 executor.submit()
T8: RuntimeError: cannot schedule new futures after interpreter shutdown
```

### 为什么会发生

1. **局部变量**: `address_service` 是 `main_app_entry()` 的局部变量
2. **无法访问**: `on_closing()` 无法访问局部变量
3. **无法停止**: daemon线程的stop()方法从未被调用
4. **强制终止**: 解释器关闭时强制终止daemon线程
5. **竞态条件**: 线程在关闭过程中尝试提交任务

---

## 修复方案

### 核心思路
**将服务对象改为全局变量，使 `on_closing()` 可以访问并停止服务**

### 修改的文件
**文件**: `pyapps/mcpserver/mcpserver_main.py`

### 修改A: 添加全局变量
```python
# Line 27-28 (新增)
# Global service instances (needed for cleanup)
_address_service = None
```

### 修改B: 使用全局变量存储服务
```python
# Line 31-42 (修改)
def main_app_entry():
    """Main application entry point - initialize services and configure tray"""
    global _address_service  # ← 声明使用全局变量

    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MCP SERVER - STARTING SERVICES")
    ColorPrint.blue("=" * 70)

    # Initialize address service (first MCP service)
    from pyapps.mcpserver.service.address_service import MCPServerAddressService
    _address_service = MCPServerAddressService(port=8767, use_localhost=True, debug=True)
    _address_service.start()

    ColorPrint.green("MCP Server services initialized")
    ColorPrint.yellow("Services will be started from tray menu")

    # Setup tray configuration via THREAD_BUS manager
    _configure_tray_menu()
```

### 修改C: 在清理回调中停止服务
```python
# Line 51-64 (修改)
def on_closing():
    """Cleanup callback when app closes"""
    global _address_service  # ← 访问全局变量

    ColorPrint.yellow(f"[MCP Server] {i18n.get(MCPServerI18nKeys.CLOSING)}")
    ColorPrint.yellow("Stopping all services...")

    # Stop address service to cleanly shutdown background scanning
    if _address_service:
        try:
            _address_service.stop()  # ← 调用stop()方法
            ColorPrint.green("[MCP Server] Address service stopped")
        except Exception as e:
            ColorPrint.red(f"[MCP Server] Error stopping address service: {e}")
```

---

## 修复原理

### 服务停止流程
```python
# 1. 用户退出程序
# 2. on_closing() 被调用

def on_closing():
    global _address_service
    _address_service.stop()  # 3. 停止服务

# 4. MCPServerAddressService.stop()
def stop(self):
    self.address_service.stop_background_scanning()  # 5. 停止后台扫描

# 6. AddressService.stop_background_scanning()
def stop_background_scanning(self):
    self._scanning = False  # 7. 设置停止标志
    self._stop_event.set()  # 8. 设置停止事件
    if self._scan_thread:
        self._scan_thread.join(timeout=2.0)  # 9. 等待线程结束

# 10. 后台线程检查停止标志
def _background_scan_loop(self):
    while self._scanning and not self._stop_event.is_set():  # 11. 退出循环
        ...

# 12. 线程正常退出
# 13. 解释器可以安全关闭
```

### 关键改进

#### 1. 全局变量访问
```python
# 修复前
def main_app_entry():
    address_service = MCPServerAddressService(...)  # 局部变量

def on_closing():
    # 无法访问 address_service

# 修复后
_address_service = None  # 全局变量

def main_app_entry():
    global _address_service
    _address_service = MCPServerAddressService(...)  # 设置全局变量

def on_closing():
    global _address_service
    _address_service.stop()  # 可以访问并停止
```

#### 2. 优雅关闭
```python
# 修复前: daemon线程被强制终止
# Python解释器: "我要关闭了，强制终止所有daemon线程！"
# daemon线程: *被强制终止* → RuntimeError

# 修复后: daemon线程正常退出
# on_closing(): "停止所有服务"
# AddressService: "设置停止标志，等待线程退出"
# daemon线程: "检查到停止标志，正常退出"
# Python解释器: "所有线程已退出，安全关闭"
```

#### 3. 异常处理
```python
try:
    _address_service.stop()
    ColorPrint.green("[MCP Server] Address service stopped")
except Exception as e:
    ColorPrint.red(f"[MCP Server] Error stopping address service: {e}")
```
即使stop()失败，也不会阻止程序退出。

---

## 测试验证

### 测试步骤
1. 启动MCP服务器
   ```bash
   python ./pymain.py app=mcp
   ```

2. 等待后台扫描启动（几秒钟）

3. 关闭程序（Ctrl+C 或关闭窗口）

4. 观察输出

### 预期结果

**修复前**:
```
Stopping all services...
Exception in thread AddressService-Scanner:
RuntimeError: cannot schedule new futures after interpreter shutdown
```

**修复后**:
```
Stopping all services...
[MCP Server] Address service stopped
[AddressService] Background scanning stopped
(程序正常退出，没有异常)
```

---

## 最佳实践

### 1. 服务生命周期管理
```python
# ✓ 正确: 全局变量或类变量
_service = None

def init():
    global _service
    _service = Service()
    _service.start()

def cleanup():
    global _service
    if _service:
        _service.stop()

# ✗ 错误: 局部变量
def init():
    service = Service()  # 无法从外部访问
    service.start()
```

### 2. daemon线程使用
```python
# daemon线程适用场景:
# - 后台日志记录
# - 心跳检测
# - 缓存更新

# 关键要求:
# 1. 必须提供stop()方法
# 2. 必须在程序退出前调用stop()
# 3. 必须使用停止标志和Event

thread = threading.Thread(
    target=worker,
    daemon=True  # daemon线程
)

# 必须提供停止机制
stop_event = threading.Event()

def worker():
    while not stop_event.is_set():  # 检查停止标志
        do_work()

def stop():
    stop_event.set()
    thread.join(timeout=2.0)
```

### 3. 清理回调设计
```python
# 清理回调应该:
# 1. 访问所有需要清理的资源
# 2. 按正确顺序停止服务
# 3. 处理所有可能的异常
# 4. 记录清理状态

def on_closing():
    try:
        # 停止服务1
        if service1:
            service1.stop()
    except Exception as e:
        log.error(f"Error stopping service1: {e}")

    try:
        # 停止服务2
        if service2:
            service2.stop()
    except Exception as e:
        log.error(f"Error stopping service2: {e}")
```

---

## 相关问题

### 类似模式的其他服务
如果有其他类似的后台服务，也需要同样的修复：
1. 改为全局变量或类变量
2. 在on_closing()中停止
3. 确保daemon线程有停止机制

### 通用解决方案
```python
# 服务管理器模式
class ServiceManager:
    def __init__(self):
        self.services = []

    def register(self, service):
        self.services.append(service)

    def stop_all(self):
        for service in self.services:
            try:
                service.stop()
            except Exception as e:
                log.error(f"Error stopping {service}: {e}")

# 使用
_service_manager = ServiceManager()

def main_app_entry():
    service1 = Service1()
    service2 = Service2()
    _service_manager.register(service1)
    _service_manager.register(service2)
    service1.start()
    service2.start()

def on_closing():
    _service_manager.stop_all()
```

---

## 总结

### 问题根源
**服务对象是局部变量，清理回调无法访问，导致daemon线程未被停止**

### 修复要点
1. **全局变量**: 将 `_address_service` 改为全局变量
2. **访问服务**: `on_closing()` 可以访问全局变量
3. **调用停止**: 在 `on_closing()` 中调用 `_address_service.stop()`
4. **优雅关闭**: daemon线程在解释器关闭前正常退出

### 影响
- ✓ 解决了关闭时的RuntimeError
- ✓ 后台线程被正确停止
- ✓ 资源被正确释放
- ✓ 程序可以干净地退出

### 关键教训
**后台daemon线程必须提供停止机制，并在程序退出前被正确停止**

---

**状态**: ✓ 已修复
**优先级**: 高（影响用户体验和资源管理）
**类型**: 线程生命周期管理 / 资源泄漏
