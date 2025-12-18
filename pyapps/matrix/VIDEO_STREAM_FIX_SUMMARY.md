# Matrix 视频流服务修复总结

## 🔧 已修复的问题

### 1. **不存在的方法调用错误** (`video_stream_service.py:449`)

**问题**:
```python
device = self.device_manager.create_device(serial, self.adb_path)
```

`DeviceManager` 类没有 `create_device` 方法！

**修复**:
直接创建 `ScrcpyDevice` 实例（参考 QtScrcpy 实现）：

```python
from pycore.pyutils.device.scrcpy_device import ScrcpyDevice

temp_params = ServerParams(
    max_size=720,
    bit_rate=8000000,
    max_fps=60,
    codec=VideoCodec.H264,
    control=True
)
device = ScrcpyDevice(serial, temp_params, self.adb_path)
```

### 2. **错误的 start_server 参数传递**

**问题**:
```python
device.start_server(jar_path=self.scrcpy_server_jar, params=params)
```

`start_server()` 方法不接受任何参数！

**修复**:
```python
# 更新设备 params（ScrcpyDevice 使用 self.params）
device.params = params

# 启动服务器（无参数）
device.start_server()
```

---

## 📋 设备 offline 状态问题分析

### 问题现象

```
[ADBService] Connected to network device: 192.168.31.116:5555
Device 192.168.31.116:5555 is not online (state: offline)
Failed to get info for device 192.168.31.116:5555
```

### 根本原因

网络扫描找到端口 5555 后，直接尝试 `adb connect`，但**设备可能还没有启用 TCP/IP 模式**。

### 正确的 WiFi 连接流程（参考 QtScrcpy 和 USBMonitor）

#### QtScrcpy 方法 (`on_wifiConnectBtn_clicked`)
```cpp
1. 停止所有服务器
2. 更新设备列表
3. 找到第一个 USB 设备
4. 获取设备 IP：adb shell ip -o a
5. 启动 adbd：adb tcpip 5555
6. 等待 1 秒
7. WiFi 连接：adb connect IP:5555
8. 更新设备列表，找到 WiFi 设备
9. 启动 scrcpy 服务器
```

#### Matrix USBMonitor 方法 (`convert_usb_to_wireless`)
```python
def convert_usb_to_wireless(self, serial: str) -> bool:
    """完整的 USB → WiFi 转换流程"""

    # 1. 获取设备 IP
    ip = self.adb.get_device_ip(serial)

    # 2. 启用 TCP/IP 模式
    self.adb.enable_tcpip(serial, 5555)  # adb tcpip 5555

    # 3. 等待 adbd 重启（重要！）
    time.sleep(self.conversion_delay)  # 默认 2 秒

    # 4. 连接 WiFi
    self.adb.connect_wireless(ip, 5555)  # adb connect IP:5555

    # 5. 更新设备表
    wifi_serial = f"{ip}:5555"
    self.device_table.add_device(wifi_device)
```

### 关键步骤

1. **必须先启用 TCP/IP 模式**：`adb tcpip 5555`
2. **必须等待 adbd 重启**：至少 1-2 秒
3. **然后才能 WiFi 连接**：`adb connect IP:5555`

### 为什么网络扫描找到的设备显示 offline？

可能原因：
1. 设备之前启用了 TCP/IP，但现在已重启或关闭
2. 设备需要通过 USB 首次授权
3. 设备的 adbd 没有在 5555 端口监听
4. 设备的 IP 地址已更改

---

## 🎯 解决方案

### 方案 A：自动 WiFi 转换（推荐）

**使用 Matrix 的 USBMonitor 自动转换功能**：

```python
# 在 matrix_main.py 中
from pyapps.matrix.adb_device_manager import ADBHeartbeatService

# USBMonitor 会自动：
# 1. 检测 USB 设备
# 2. 获取 IP
# 3. 启用 tcpip 5555
# 4. 连接 WiFi
# 5. 添加到设备表
```

**优势**：
- ✅ 完全自动化
- ✅ 遵循正确流程
- ✅ 已集成到 Matrix
- ✅ 包含错误处理

### 方案 B：手动 WiFi 连接

**通过前端 UI 提供手动连接功能**：

```typescript
// 1. 列出 USB 设备
const usbDevices = await rpc.call('adb.list_usb_devices')

// 2. 用户选择设备

// 3. 启用 WiFi
await rpc.call('adb.enable_wifi', { serial: selectedDevice })

// 4. 等待转换完成

// 5. 连接视频流
```

### 方案 C：Root 设备持久化 TCP/IP

**对于 root 设备，可以永久启用 TCP/IP**：

```bash
# 通过 ADB shell
adb shell su -c "setprop service.adb.tcp.port 5555"
adb shell su -c "stop adbd"
adb shell su -c "start adbd"
```

**然后添加到启动脚本**：
```bash
# /system/etc/init.d/adb_wifi
#!/system/bin/sh
setprop service.adb.tcp.port 5555
```

---

## 🔄 FFmpeg 路径传递验证

### PyAV 不需要 FFmpeg 可执行文件路径

**重要发现**：
- `VideoDecoderService` 使用 **PyAV**（FFmpeg Python bindings）
- PyAV 使用 **FFmpeg 动态链接库**（DLL/SO）
- PyAV **不需要** FFmpeg.exe 路径
- PyAV 从系统库路径加载 FFmpeg 库

### 当前状态

从启动日志看：
```
[FFmpegInstaller] ✓ Found FFmpeg in install dir:
  D:\_win10\ffmpeg\ffmpeg-2025-12-10-git-4f947880bd-essentials_build\bin\ffmpeg.exe
```

**问题**：这个路径可能不在系统 PATH 中。

### 解决方案

#### 选项 1：添加到系统 PATH（推荐）
```python
# 在 ensure_ffmpeg 中
import os
ffmpeg_bin_dir = os.path.dirname(ffmpeg_path)
if ffmpeg_bin_dir not in os.environ['PATH']:
    os.environ['PATH'] = ffmpeg_bin_dir + os.pathsep + os.environ['PATH']
```

#### 选项 2：设置 PyAV 库路径
```python
# 在创建解码器前
import os
ffmpeg_lib_dir = os.path.dirname(ffmpeg_path)
os.environ['PATH'] = ffmpeg_lib_dir + os.pathsep + os.environ['PATH']
```

#### 选项 3：使用 conda FFmpeg
```bash
# PyAV 官方推荐
conda install av -c conda-forge
```

---

## 📝 修改的文件

```
✅ pyapps/matrix/services/video_stream_service.py
   - 行 447-472: 修复 create_device 调用
   - 行 492-511: 修复 start_server 参数传递
```

---

## ✅ 验证步骤

### 1. 测试修复后的代码

```bash
Python .\pymain.py app=matrix
```

### 2. 使用 USB 设备测试（推荐）

**步骤**：
1. 通过 USB 连接 Android 设备
2. 确保 ADB 调试已启用
3. 启动 Matrix 应用
4. USBMonitor 会自动转换为 WiFi
5. 尝试连接视频流

### 3. 使用已启用 WiFi 的设备测试

**前提条件**：
- 设备已通过正确流程启用 WiFi ADB
- 设备状态为 `device`（不是 offline）

---

## 🎊 总结

### 已修复
✅ DeviceManager.create_device 方法不存在 → 直接创建 ScrcpyDevice
✅ start_server 错误参数传递 → 更新 device.params 后调用
✅ 分析了设备 offline 原因 → 需要完整的 WiFi 转换流程

### 建议使用
✅ **USBMonitor 自动 WiFi 转换**（最可靠）
✅ 首次连接使用 USB，然后自动转换
✅ 网络扫描仅用于已转换设备的发现

### 下一步
1. 测试修复后的代码
2. 如果仍有 offline 问题，使用 USB 连接
3. 检查 USBMonitor 是否正常工作
4. 考虑在前端 UI 添加手动 WiFi 连接功能

---

**修复完成时间**: 2025-12-17
**修复状态**: ✅ 代码已修复，待测试
**建议**: 优先使用 USB 设备进行首次测试
