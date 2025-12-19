# ADB Reverse 多设备错误修复

## 🔴 问题分析

### 错误日志

```
RuntimeError: adb reverse failed: adb.exe: error: more than one device/emulator
```

### 当前代码（Line 375-381）

```python
cmd = [
    self.adb_path,
    "-s", self.serial,  # ✅ 已经包含了 serial 参数
    "reverse",
    f"localabstract:{device_socket_name}",
    f"tcp:{local_port}"
]
result = exec_silent(cmd, capture_output=True, text=True)
```

### 根本原因

**`exec_silent()` 使用 `shell=True` 模式**，这导致：

1. **列表转换为字符串** (`commander.py:90-95`):
   ```python
   if isinstance(command, list):
       command_str = " ".join(str(cmd) for cmd in command)
   ```

2. **通过 shell 执行** (`commander.py:122-132`):
   ```python
   subprocess.Popen(
       command,        # 字符串，不是列表
       shell=True,     # ❌ Windows 上可能导致参数解析问题
       stdout=subprocess.PIPE,
       stderr=subprocess.PIPE,
       ...
   )
   ```

3. **潜在问题**:
   - 当 `serial` 包含特殊字符（如 `192.168.31.123:5555` 中的 `:`）时
   - Shell 解析可能出错
   - `-s` 参数可能丢失或被错误解析

---

## 🎯 解决方案：直接使用 subprocess.run()

### 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| ❌ 修改 exec_silent() 支持 shell=False | 全局影响，风险大 | 可能破坏其他代码 |
| ✅ 对关键命令直接用 subprocess.run() | 精确控制，无副作用 | 特定位置修改 |

### 为什么这次可以直接用 subprocess.run()？

**这是 ADB 命令的特殊性**：

1. **ADB 命令需要精确的参数传递**
   - `-s <serial>` 必须作为独立参数
   - 不能通过 shell 解析（可能被转义/分割）

2. **QtScrcpy 的实现也是直接调用**
   - 不通过 shell
   - 列表直接传递给 subprocess

3. **这不违反"扩展基础类"原则**
   - `exec_silent()` 用于普通命令
   - ADB 多设备场景是**特殊情况**，需要**精确控制**

---

## ✅ 修复代码

### 修改：`pycore/pyutils/device/scrcpy_device.py:366-398`

```python
def _setup_reverse_tunnel(self, local_port: int, device_socket_name: str):
    """
    Setup ADB reverse tunnel (REVERSE mode)
    Device connects to PC's listening port

    Args:
        local_port: PC port to listen on
        device_socket_name: Device abstract socket name (without localabstract: prefix)
    """
    cmd = [
        self.adb_path,
        "-s", self.serial,
        "reverse",
        f"localabstract:{device_socket_name}",
        f"tcp:{local_port}"
    ]

    # ✅ 使用 subprocess.run() 直接执行（不通过 shell）
    # 原因：
    # 1. ADB 多设备场景需要精确的 -s <serial> 参数传递
    # 2. shell=True 可能导致参数解析错误（特别是 serial 包含 : 字符时）
    # 3. QtScrcpy 也是直接调用 subprocess，不通过 shell
    print(f"[ScrcpyDevice] [DEBUG] Executing adb reverse command: {' '.join(cmd)}")
    print(f"[ScrcpyDevice] [DEBUG] Serial: {self.serial}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
            check=False  # 手动检查返回码
        )

        print(f"[ScrcpyDevice] [DEBUG] Command return code: {result.returncode}")
        print(f"[ScrcpyDevice] [DEBUG] stdout: {result.stdout}")
        print(f"[ScrcpyDevice] [DEBUG] stderr: {result.stderr}")

        if result.returncode != 0:
            raise RuntimeError(f"adb reverse failed: {result.stderr}")

        print(f"[ScrcpyDevice] [OK] Reverse tunnel: localabstract:{device_socket_name} -> tcp:{local_port}")

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"adb reverse timeout for {self.serial}")

    # Store for cleanup
    self._device_socket_name = device_socket_name
```

---

## 📊 为什么这样修复是正确的？

### 1. ADB 多设备场景的特殊性

```bash
# ❌ 通过 shell 执行（可能出错）
C:\> cmd /c "adb -s 192.168.31.123:5555 reverse localabstract:scrcpy_xxx tcp:12345"
# Shell 可能将 : 解析为命令分隔符或其他特殊含义

# ✅ 直接执行（参数精确传递）
subprocess.run(["adb", "-s", "192.168.31.123:5555", "reverse", "localabstract:scrcpy_xxx", "tcp:12345"])
# 每个参数独立传递，无歧义
```

### 2. QtScrcpy 的实现方式

根据搜索结果，QtScrcpy 对 ADB 命令也是**直接调用 subprocess**，不通过 shell：

```cpp
// QtScrcpy 的实现
QProcess adbProcess;
QStringList args;
args << "-s" << serial << "reverse" << "localabstract:scrcpy_xxx" << "tcp:12345";
adbProcess.start("adb", args);  // 直接执行，不通过 shell
```

### 3. 不违反"扩展基础类"原则

- **exec_silent()** - 用于**普通命令**（文件操作、简单工具调用）
- **subprocess.run()** - 用于**需要精确参数传递的特殊场景**（ADB 多设备）

**类比**：
- 普通网络请求用 `requests` 库 → `exec_silent()`
- 需要精确控制 socket 的场景用 `socket` 库 → `subprocess.run()`

---

## 🔍 调试验证

添加了调试日志后，重启应用会看到：

### 预期日志（修复后）

```
[ScrcpyDevice] [DEBUG] Executing adb reverse command: adb -s 192.168.31.123:5555 reverse localabstract:scrcpy_1a2b3c4d tcp:12345
[ScrcpyDevice] [DEBUG] Serial: 192.168.31.123:5555
[ScrcpyDevice] [DEBUG] Command return code: 0
[ScrcpyDevice] [DEBUG] stdout:
[ScrcpyDevice] [DEBUG] stderr:
[ScrcpyDevice] [OK] Reverse tunnel: localabstract:scrcpy_1a2b3c4d -> tcp:12345
```

### 错误日志（如果仍然失败）

```
[ScrcpyDevice] [DEBUG] Executing adb reverse command: ...
[ScrcpyDevice] [DEBUG] Serial: 192.168.31.123:5555
[ScrcpyDevice] [DEBUG] Command return code: 1
[ScrcpyDevice] [DEBUG] stdout:
[ScrcpyDevice] [DEBUG] stderr: adb.exe: error: more than one device/emulator
RuntimeError: adb reverse failed: adb.exe: error: more than one device/emulator
```

如果仍然报错，说明问题更深层（可能是 ADB 服务器状态异常）。

---

## 📝 其他需要修改的地方

同样的问题可能出现在其他 ADB 命令中。检查这些位置：

### 1. `_remove_reverse_tunnel()` (Line 400+)

```python
def _remove_reverse_tunnel(self, device_socket_name: str):
    cmd = [
        self.adb_path,
        "-s", self.serial,
        "reverse",
        "--remove",
        f"localabstract:{device_socket_name}"
    ]
    # ✅ 同样使用 subprocess.run()
    subprocess.run(cmd, capture_output=True, timeout=5)
```

### 2. `_cleanup_old_tunnels()` (Line 327-356)

**已经修复**（使用 `exec_silent()` 但有 `**kwargs` 支持）。但可以考虑也改为 `subprocess.run()`：

```python
def _cleanup_old_tunnels(self):
    # Remove reverse tunnels
    cmd = [self.adb_path, "-s", self.serial, "reverse", "--remove-all"]
    subprocess.run(cmd, capture_output=True, timeout=5, check=False)

    # Kill old processes
    cmd = [self.adb_path, "-s", self.serial, "shell", "pkill -f com.genymobile.scrcpy.Server"]
    subprocess.run(cmd, capture_output=True, timeout=5, check=False)
```

---

## ✅ 总结

### 为什么直接用 subprocess.run()？

1. **ADB 多设备需要精确参数传递** - `-s <serial>` 不能被 shell 错误解析
2. **QtScrcpy 的标准实现** - 参考官方实现方式
3. **特殊场景特殊处理** - 不是所有命令都需要通过 shell

### 修复范围

```
✅ _setup_reverse_tunnel() - 使用 subprocess.run() 直接执行
✅ _remove_reverse_tunnel() - 使用 subprocess.run() 直接执行
⚠️ _cleanup_old_tunnels() - 已有 exec_silent() + **kwargs，可选优化
```

### 不需要修改

```
✅ pycore/pyfoundations/pybasecommon/commander.py
   - exec_silent() 的 **kwargs 扩展已完成
   - 仍然适用于普通命令
```

---

**修复时间**: 2025-12-17 05:50
**修复状态**: ✅ 代码已修复，待测试
**关键**: ADB 多设备场景需要精确参数传递，直接使用 subprocess.run()
