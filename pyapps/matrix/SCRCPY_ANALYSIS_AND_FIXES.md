# Scrcpy Connection Analysis & Fixes

## 问题摘要

Python实现的scrcpy客户端无法连接到服务器，服务器启动后立即abort。官方scrcpy工作正常。

## 已完成的修复

### 1. REVERSE模式实现 ✓
**问题**: 代码使用FORWARD模式
**修复**: 改为REVERSE模式（scrcpy默认）

**关键差异**:
- **REVERSE模式**: PC监听，设备连接（默认，推荐）
- **FORWARD模式**: 设备监听，PC连接（备用）

**代码位置**:
- `pycore/pyfoundations/device/scrcpy_device.py`: 使用`_setup_reverse_tunnel()`
- `test_scrcpy_device.py`: 使用adb reverse而非forward

### 2. Dummy Byte处理 ✓
**问题**: REVERSE模式下尝试读dummy byte
**修复**: 仅在FORWARD模式下读dummy byte

**参考**: `scrcpy develop.md` lines 333-336
> "On the _first_ socket opened, **if the tunnel is _forward_**, then a [dummy byte] is sent"

**关键点**:
- REVERSE模式: 无dummy byte
- FORWARD模式: 有dummy byte

### 3. 参数优化 ✓
**问题**: 发送了不必要的默认参数
**修复**: 仅发送非默认值参数

**删除的参数** (均为服务器默认值):
```python
# 删除前
"tunnel_forward=false"  # 默认已经是false
"control=true"          # 默认已经是true
"cleanup=true"          # 默认已经是true
"power_on=true"         # 默认已经是true
"clipboard_autosync=true"  # 默认已经是true
"downsize_on_error=true"   # 默认已经是true
```

**保留的参数**:
```python
f"scid={scid:08x}"           # 必需
f"video_bit_rate={...}"       # 非默认值
f"max_size={...}"             # 配置值
f"max_fps={...}"              # 配置值
"audio=false"                 # 非默认值(默认true)
```

**参考**: `scrcpy app/src/server.c` lines 265-434

### 4. Unicode编码修复 ✓
**问题**: Windows控制台无法显示Unicode字符
**修复**: 添加UTF-8编码支持

```python
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
```

## 当前状态

### 问题：服务器Abort
所有手动启动的服务器都立即退出，输出"Aborted"（退出代码134 = SIGABRT）

**可能原因**:
1. **缺少必需参数** - 某个参数是必需的但我们没有发送
2. **参数格式错误** - SCID或其他参数格式不正确
3. **版本不匹配** - 服务器期望的参数与我们发送的不匹配

### 验证：官方Scrcpy正常工作
```bash
scrcpy --serial=R4RCHEKBRWFEEYB6 --no-audio --max-size=720
# ✓ 正常工作，成功连接并显示画面
```

## 下一步诊断步骤

### 方法1: 查看官方scrcpy实际命令
```bash
# 使用verbose模式查看官方scrcpy发送的确切参数
scrcpy --serial=R4RCHEKBRWFEEYB6 --verbosity=verbose --no-audio --max-size=720 > scrcpy_log.txt 2>&1

# 搜索server command
grep "shell.*app_process" scrcpy_log.txt
```

### 方法2: 使用adb logcat查看服务器日志
```bash
# 清除日志
adb -s R4RCHEKBRWFEEYB6 logcat -c

# 启动服务器
python test_scrcpy_device.py &

# 实时查看日志
adb -s R4RCHEKBRWFEEYB6 logcat -s scrcpy:V app_process:V AndroidRuntime:E

# 查看崩溃日志
adb -s R4RCHEKBRWFEEYB6 logcat -d | grep -A 20 "FATAL\\|Exception\\|Error"
```

### 方法3: 比较官方vs我们的命令
```bash
# 官方scrcpy
adb shell ps | grep app_process  # 查看运行中的命令

# 我们的命令
adb -s R4RCHEKBRWFEEYB6 shell CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3 scid=79ce7e11 video_bit_rate=8000000 max_size=720 max_fps=60 audio=false
```

## 源码分析要点

### Server.java 启动流程
```java
main()
  → internalMain()
    → Options.parse(args)          // 解析参数
    → prepareMainLooper()
    → scrcpy(options)
      → DesktopConnection.open()   // 连接客户端
        → connect(socketName)       // REVERSE模式: 连接到localabstract
```

### DesktopConnection.java 连接逻辑
```java
// REVERSE模式 (tunnelForward=false)
if (!tunnelForward) {
    if (video) {
        videoSocket = connect(socketName);  // 连接到 scrcpy_XXXXXXXX
    }
    if (audio) {
        audioSocket = connect(socketName);
    }
    if (control) {
        controlSocket = connect(socketName);
    }
}
```

### 关键发现
1. **SCID格式**: 必须是8位十六进制，带前导零: `scid={scid:08x}`
2. **Abstract Socket**: 服务器连接`localabstract:scrcpy_XXXXXXXX`
3. **Reverse Tunnel**: `adb reverse localabstract:scrcpy_XXX tcp:PORT`
4. **连接顺序**: Video → Audio → Control (按启用顺序)

## 可能的解决方案

### 尝试1: 添加log_level参数
官方scrcpy总是发送log_level参数：
```python
cmd = [
    ...,
    "scid=XXXXXXXX",
    "log_level=info",  # 添加这个
    ...
]
```

### 尝试2: 使用完整参数列表
参考scrcpy official command，添加所有可能必需的参数。

### 尝试3: 检查scrcpy-server.jar版本
```bash
# 确保设备上的jar与客户端版本匹配
adb -s R4RCHEKBRWFEEYB6 shell ls -l /data/local/tmp/scrcpy-server.jar

# 重新推送
adb -s R4RCHEKBRWFEEYB6 push scrcpy-server /data/local/tmp/scrcpy-server.jar
```

## 架构说明

### REVERSE模式流程（我们的实现）
```
1. PC创建listening socket (127.0.0.1:PORT)
2. PC设置reverse tunnel:
   adb reverse localabstract:scrcpy_XXX tcp:PORT
3. PC启动服务器进程
4. 服务器在设备上运行，尝试连接localabstract:scrcpy_XXX
5. Android OS通过reverse tunnel转发到PC的PORT
6. PC accept连接
7. 建立video/audio/control socket
```

### Socket连接时序
```
PC                          Device (Server)
|                           |
| Listen on PORT            |
| Setup reverse tunnel      |
| Start server process  -->  |
|                            | Connect to localabstract:scrcpy_XXX
| <-- (via reverse tunnel)   |
| Accept video socket       |
|                            | Send device metadata (64 bytes)
| Read metadata             |
|                            | Send codec metadata (12 bytes)
| Read codec metadata       |
|                            | Start streaming video
```

## 文件清单

### 已修改的文件
1. `pycore/pyfoundations/device/scrcpy_device.py` - 核心设备类
2. `pyapps/pyMatrix/test_scrcpy_device.py` - 测试脚本
3. `pyapps/pyMatrix/SCRCPY_FIX_SUMMARY.md` - 修复摘要

### 参考文档
1. `scrcpy_source/doc/develop.md` - 协议文档
2. `scrcpy_source/doc/connection.md` - 连接模式
3. `scrcpy_source/app/src/server.c` - 客户端实现
4. `scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Server.java` - 服务器主类
5. `scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java` - 参数定义
6. `scrcpy_source/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java` - 连接实现

## 建议

1. **立即尝试**: 使用`--verbosity=verbose`运行官方scrcpy，查看实际命令
2. **比较参数**: 将官方命令与我们的命令逐参数对比
3. **启用日志**: 使用`log_level=debug`并通过logcat查看服务器日志
4. **简化测试**: 先尝试最小参数集，逐步添加参数

## 联系官方

如果问题持续，可以：
1. 查看scrcpy GitHub Issues
2. 搜索类似的"Aborted"问题
3. 在scrcpy讨论区询问正确的参数格式

## 总结

我们的实现在协议层面是**正确的**：
- ✓ 使用REVERSE模式
- ✓ 正确处理dummy byte
- ✓ 遵循scrcpy源码逻辑
- ✓ 参数格式符合Options.java

但服务器仍然abort，这表明可能：
- 缺少某个隐式必需的参数
- 参数值格式有细微差异
- 需要特定的初始化顺序

**关键下一步**: 查看官方scrcpy的实际命令参数！
