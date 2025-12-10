# Matrix 自动化 ADB 设备管理系统

## 概述

基于 QtScrcpy 无线连接技术方案，实现了完全自动化的 ADB 设备发现、连接和管理系统。

## 系统架构

### 组件列表

```
pyapps/matrix/adb_device_manager/
├── __init__.py                    # 模块导出
├── device_table.py                # 设备表（线程安全的设备注册表）
├── adb_executor.py                # ADB 命令执行器
├── network_scanner.py             # 局域网设备扫描器
├── usb_monitor.py                 # USB 设备监控器
└── adb_heartbeat_thread.py        # 心跳线程（主控制器）
```

## 功能特性

### 1. 局域网 Root 设备自动发现 

**扫描频率**: 每 30 秒

**扫描方式**: 并发扫描局域网所有 IP 的 5555 端口

**自动操作**:
- 检测到开放 5555 端口的设备
- 自动执行 `adb connect IP:5555`
- 检测设备是否 Root (`su -c id`)
- 获取设备信息（型号、Android 版本）
- 添加到设备表 

**适用场景**: Root 设备已通过 Magisk 模块或 build.prop 永久启用 WiFi ADB

### 2. USB 设备自动无线转换

**扫描频率**: 每 5 秒

**转换流程**:
```
1. 检测新 USB 设备 (adb devices)
2. 获取设备 IP (adb shell ifconfig wlan0)
3. 启用 TCP/IP 模式 (adb tcpip 5555)
4. 等待 2 秒让 adbd 重启
5. 无线连接 (adb connect IP:5555)
6. 更新设备表（记录转换历史）
```

**智能跳过**: 已经稳定连接的 WiFi 设备不会重复处理

### 3. 设备表维护

**数据结构**:
```python
@dataclass
class DeviceInfo:
    serial: str                      # 设备序列号或 IP:PORT
    device_type: DeviceType          # USB / WIFI / ROOT
    state: DeviceState               # 连接状态
    ip_address: Optional[str]        # IP 地址
    is_root: bool                    # 是否 Root
    model: Optional[str]             # 设备型号
    android_version: Optional[str]   # Android 版本

    # 时间戳
    first_seen: float                # 首次发现时间
    last_seen: float                 # 最后看到时间
    last_heartbeat: float            # 最后心跳时间

    # 转换历史
    usb_serial: Optional[str]        # 原 USB 序列号
    wifi_ip: Optional[str]           # WiFi IP
    conversion_time: Optional[float] # 转换时间
```

**自动清理**: 每 60 秒清理超过 120 秒无心跳的设备

### 4. 设备状态心跳

**更新频率**: 每 10 秒

**自动操作**:
- 执行 `adb devices` 获取当前连接设备
- 更新设备表中设备的心跳时间
- 自动恢复断开后重新连接的设备状态

## 使用方式

### 启动系统

系统已集成到 `matrix_main.py`，启动 Matrix 应用时自动运行：

```bash
python pymain.py app=matrix
```

### 访问设备表

```python
from pyapps.matrix.adb_device_manager import ADBHeartbeatThread

# 获取全局心跳线程实例
heartbeat = _adb_heartbeat_thread

# 获取设备表
device_table = heartbeat.get_device_table()

# 获取所有设备
all_devices = device_table.get_all_devices()

# 获取 USB 设备
usb_devices = device_table.get_usb_devices()

# 获取 WiFi 设备
wifi_devices = device_table.get_wifi_devices()

# 获取 Root 设备
root_devices = device_table.get_root_devices()

# 获取统计信息
stats = device_table.get_stats()
```

### 获取 ADB 执行器

```python
# 获取 ADB 执行器（用于手动执行 ADB 命令）
adb = heartbeat.get_adb_executor()

# 执行自定义 ADB 命令
success, stdout, stderr = adb.execute(['shell', 'getprop'], serial='192.168.1.100:5555')
```

## 配置参数

在 `matrix_main.py` 中可以调整心跳参数：

```python
_adb_heartbeat_thread = ADBHeartbeatThread(
    adb_path="adb",                    # ADB 可执行文件路径
    tick_interval=1.0,                 # 主循环间隔（秒）
    network_scan_interval=30.0,        # 网络扫描间隔（秒）
    usb_scan_interval=5.0,             # USB 扫描间隔（秒）
    cleanup_interval=60.0,             # 清理间隔（秒）
    heartbeat_interval=10.0,           # 心跳更新间隔（秒）
    daemon=True                        # 守护线程
)
```

## 技术要点

### 线程安全
- `DeviceTable` 使用 `threading.RLock()` 确保线程安全
- 所有设备操作都通过加锁保护

### 性能优化
- 网络扫描使用 `ThreadPoolExecutor` 并发扫描（100 线程）
- Socket 超时设置为 0.2 秒，快速检测端口状态
- 智能跳过已知设备，避免重复处理

### 错误处理
- 设备错误计数器（`error_count`）
- 记录最后错误信息和时间
- 失败的转换不会阻塞其他设备

### 关闭管理
- 通过 `THREAD_BUS.register_shutdown_handler()` 注册关闭处理器
- 关闭优先级 90（在 RPC 服务器之后，心跳系统之前）

## 对比 QtScrcpy

| 特性 | QtScrcpy | Matrix ADB Manager |
|------|----------|-------------------|
| **USB 转无线** | 手动点击按钮 | ✅ 自动检测并转换 |
| **网络扫描** | 不支持 | ✅ 每 30 秒自动扫描 |
| **Root 设备** | 不支持 | ✅ 自动检测并连接 |
| **设备表** | 临时列表 | ✅ 持久化设备表 |
| **多设备** | 手动管理 | ✅ 自动发现和管理 |
| **心跳监控** | 无 | ✅ 每 10 秒心跳 |
| **断线恢复** | 手动重连 | ✅ 自动检测并恢复 |

## 优势总结

✅ **完全自动化** - 无需手动操作，插上 USB 或开启 WiFi ADB 即可
✅ **智能管理** - 自动维护设备表，清理断开设备
✅ **多设备支持** - 同时管理多台 USB、WiFi、Root 设备
✅ **高性能** - 并发扫描，低延迟检测
✅ **可扩展** - 清晰的模块化架构，易于添加新功能

## API 参考

### DeviceTable

```python
# 添加设备
device_table.add_device(device_info: DeviceInfo) -> bool

# 移除设备
device_table.remove_device(serial: str) -> bool

# 获取设备
device_table.get_device(serial: str) -> Optional[DeviceInfo]

# 更新设备
device_table.update_device(serial: str, **updates) -> bool

# 更新设备状态
device_table.update_device_state(serial: str, new_state: DeviceState) -> bool

# 获取所有设备
device_table.get_all_devices() -> List[DeviceInfo]

# 按状态获取
device_table.get_devices_by_state(state: DeviceState) -> List[DeviceInfo]

# 按类型获取
device_table.get_devices_by_type(device_type: DeviceType) -> List[DeviceInfo]

# 清理过期设备
device_table.cleanup_stale_devices(timeout: float = 60.0) -> int

# 获取统计
device_table.get_stats() -> Dict[str, Any]
```

### ADBExecutor

```python
# 执行 ADB 命令
adb.execute(args: List[str], serial: Optional[str] = None) -> Tuple[bool, str, str]

# 获取设备列表
adb.get_devices() -> List[Tuple[str, str]]

# 获取设备 IP
adb.get_device_ip(serial: str) -> Optional[str]

# 启用 TCP/IP 模式
adb.enable_tcpip(serial: str, port: int = 5555) -> bool

# 无线连接
adb.connect_wireless(ip: str, port: int = 5555) -> bool

# 断开无线连接
adb.disconnect_wireless(ip: str, port: int = 5555) -> bool

# Root 设备启用 WiFi ADB
adb.enable_root_wifi_adb(serial: str, port: int = 5555) -> bool

# 检查 Root
adb.check_device_root(serial: str) -> bool

# 获取设备信息
adb.get_device_info(serial: str) -> Dict[str, Optional[str]]
```

### NetworkScanner

```python
# 扫描网络
scanner.scan_network(network_cidr: Optional[str] = None) -> List[str]

# 快速扫描指定 IP
scanner.quick_scan_ips(ips: List[str]) -> List[str]

# 获取本地网络范围
scanner.get_local_network_range() -> Optional[str]
```

### USBMonitor

```python
# 扫描 USB 设备
usb_monitor.scan_usb_devices() -> List[str]

# 检测新设备
usb_monitor.detect_new_usb_devices() -> List[str]

# 转换为无线
usb_monitor.convert_usb_to_wireless(serial: str) -> bool

# 处理所有 USB 设备
usb_monitor.process_usb_devices() -> Dict[str, bool]
```

### ADBHeartbeatThread

```python
# 启动线程
heartbeat.start()

# 停止线程
heartbeat.stop()

# 检查运行状态
heartbeat.is_running() -> bool

# 获取统计信息
heartbeat.get_stats() -> dict

# 获取设备表
heartbeat.get_device_table() -> DeviceTable

# 获取 ADB 执行器
heartbeat.get_adb_executor() -> ADBExecutor
```

## 设备状态流转

```
UNKNOWN
  ↓
USB_CONNECTED ──→ CONFIGURING ──→ WIFI_CONNECTED
  ↓                                    ↓
ERROR ←──────────────────────────── DISCONNECTED
```

## 设备类型

- `USB`: USB 设备（序列号如 "P7C0218510000537"）
- `WIFI`: WiFi 设备（IP:PORT 如 "192.168.1.100:5555"）
- `ROOT`: Root 设备（通过网络扫描发现）

## 日志输出示例

```
[Matrix] Starting ADB Device Management Heartbeat...
[ADBHeartbeat] Started (tick=1.0s)
[ADBHeartbeat] Network scan interval: 30.0s
[ADBHeartbeat] USB scan interval: 5.0s
[ADBHeartbeat] Running network scan task...
[NetworkScanner] Scanning 192.168.1.0/24 for port 5555...
[NetworkScanner] Found device at 192.168.1.100:5555
[ADBHeartbeat] Connected to network device: 192.168.1.100:5555
[ADBHeartbeat] Added device: 192.168.1.100:5555 (root=True)
[USBMonitor] Detected 1 new USB device(s)
[USBMonitor] Starting conversion: P7C0218510000537 → wireless
[USBMonitor] Device IP: 192.168.1.101
[ADB] Enabled tcpip on P7C0218510000537
[USBMonitor] Conversion successful: P7C0218510000537 → 192.168.1.101:5555
[Matrix] ADB Device Manager initialized
```

## 故障排除

### 设备无法转换为无线

**原因**: 设备未连接 WiFi
**解决**: 确保设备已连接到与电脑相同的局域网

### 网络扫描找不到 Root 设备

**原因**: Root 设备未启用 WiFi ADB
**解决**: 在设备上执行 `su -c "setprop service.adb.tcp.port 5555 && stop adbd && start adbd"`

### 设备频繁断开重连

**原因**: 设备休眠或网络不稳定
**解决**: 关闭设备休眠，使用稳定的 WiFi 网络

## 未来扩展

- [ ] 设备分组管理
- [ ] 设备别名和标签
- [ ] 设备性能监控（CPU、内存、电量）
- [ ] 远程 scrcpy 启动和控制
- [ ] 设备日志采集
- [ ] Web UI 设备管理界面
