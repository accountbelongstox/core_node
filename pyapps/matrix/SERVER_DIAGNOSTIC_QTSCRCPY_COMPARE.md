# 服务器诊断 - 对比QtScrcpy命令

**日期**: 2025-12-17
**状态**: 等待服务器错误输出

---

## 当前问题

所有设备都能成功建立socket连接，但服务器在发送dummy byte之前就关闭连接：

```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)  ← 连接成功
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!  ← 服务器关闭连接
RuntimeError: Connection closed by server while reading dummy byte
```

**这说明**：
1. ✅ Forward tunnel工作正常
2. ✅ 服务器能启动并accept连接
3. ❌ 服务器检测到某些错误后立即关闭连接

---

## 已添加的诊断功能

### 1. 显示完整服务器命令

现在会显示发送给scrcpy-server的完整命令：
```
[ScrcpyDevice] Starting scrcpy-server process...
[ScrcpyDevice] Full command: CLASSPATH=... app_process ... (所有参数)
[ScrcpyDevice] ADB command: adb -s <serial> shell ...
```

### 2. 捕获服务器错误输出

在连接关闭时会尝试读取服务器的stdout/stderr：
```python
# 等待0.5秒让进程退出
time.sleep(0.5)
# 尝试读取输出（2秒超时）
stdout, stderr = self._server_process.communicate(timeout=2.0)
# 如果超时，强制kill进程并读取输出
```

输出会显示为：
```
[ScrcpyDevice] Attempting to read server output...
[ScrcpyDevice] [SERVER STDOUT]: <服务器标准输出>
[ScrcpyDevice] [SERVER STDERR]: <服务器错误输出>
```

---

## 重新测试步骤

### 1. 清理环境
```bash
# 关闭所有旧连接
adb kill-server
adb start-server
```

### 2. 启动你的应用并连接设备

### 3. 查看新的日志输出

你应该看到：
```
[ScrcpyDevice] Full command: CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3 scid=... log_level=debug audio=false max_size=... max_fps=... tunnel_forward=true

[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!
[ScrcpyDevice] Attempting to read server output...
[ScrcpyDevice] [SERVER STDERR]: <这里会显示真正的错误!>
```

---

## 与QtScrcpy对比

### 如何获取QtScrcpy的命令

**方法1: 查看QtScrcpy日志**

QtScrcpy会在日志中显示它使用的命令，类似：
```
[QtScrcpy] adb reverse failed
[QtScrcpy] using forward mode
[QtScrcpy] command: CLASSPATH=... app_process ... (完整命令)
```

**方法2: 使用Process Monitor监控**

在Windows上使用Process Monitor (Procmon)：
1. 下载并运行Procmon
2. 过滤 `Process Name is adb.exe`
3. 启动QtScrcpy连接设备
4. 查看adb.exe的命令行参数

**方法3: 检查QtScrcpy源码**

查看文件 `pyapps/QtScrcpy/QtScrcpy/device/server/server.cpp` 中的server命令构建逻辑。

### 关键参数对比

**检查这些参数**：

| 参数 | 我们的值 | QtScrcpy的值 | 说明 |
|-----|---------|--------------|------|
| 版本号 (args[0]) | 3.3.3 | ? | 必须匹配服务器jar版本 |
| scid | `scid=<hex>` | ? | Session ID |
| log_level | debug | ? | 日志级别 |
| audio | false | ? | 音频开关 |
| max_size | <value> | ? | 最大分辨率 |
| max_fps | <value> | ? | 最大帧率 |
| tunnel_forward | true (FORWARD模式) | ? | FORWARD模式标志 |
| control | (默认true) | ? | 控制开关 |
| video_codec | (默认h264) | ? | 视频编码 |

---

## 可能的错误原因

根据官方scrcpy源码分析，服务器可能因为以下原因立即关闭连接：

### 1. 参数错误
```
java.lang.IllegalArgumentException: Unknown option: xxx
    at com.genymobile.scrcpy.Options.parse(Options.java:...)
```
→ 检查是否有QtScrcpy不使用的参数

### 2. 版本不匹配
```
Error: Server version (3.3.3) does not match ...
```
→ 检查服务器jar版本

### 3. 编码器不支持
```
MediaCodec.createEncoderByType: codec not found: video/avc
```
→ 设备不支持请求的编码格式

### 4. 权限问题
```
SecurityException: Requires permission ...
```
→ 设备权限不足

### 5. 端口冲突
```
BindException: Address already in use
```
→ 抽象socket名称冲突

### 6. Android版本不兼容
```
UnsupportedOperationException: Video encoding not supported on API level ...
```
→ Android版本太老

---

## 下一步行动

1. **重新测试** - 查看服务器错误输出
2. **获取QtScrcpy命令** - 对比参数差异
3. **修复参数** - 根据错误信息调整
4. **验证修复** - 测试19个设备

---

## 预期结果

**失败时**（现在）：
```
[ScrcpyDevice] Full command: <我们的命令>
[ScrcpyDevice] [OK] Video socket connected
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!
[ScrcpyDevice] [SERVER STDERR]: <真正的错误原因>
```

**成功时**（修复后）：
```
[ScrcpyDevice] Full command: <修复后的命令>
[ScrcpyDevice] [OK] Video socket connected
[ScrcpyDevice] Read dummy byte in FORWARD mode: 00  ← 成功读取!
[ScrcpyDevice] [OK] Control socket connected
[ScrcpyDevice] [OK] Device: SM-G9200
✅ 开始串流
```

---

**关键问题**: 为什么QtScrcpy能成功而我们不行？

**答案**: 很可能是服务器命令参数的细微差异导致服务器崩溃。现在的诊断代码会告诉我们**具体是哪个参数**出了问题。
