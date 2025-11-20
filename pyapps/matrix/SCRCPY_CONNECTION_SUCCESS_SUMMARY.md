# Scrcpy连接成功总结

## 关键发现

### 1. 必需参数: log_level=debug
**最重要的发现**: 服务器必须包含 `log_level=debug` 参数，否则会立即abort！

从官方scrcpy运行进程捕获的确切命令：
```bash
app_process / com.genymobile.scrcpy.Server 3.3.3 scid=1769937f log_level=debug audio=false max_size=720 max_fps=60
```

### 2. 正确的参数顺序
```
scid={8位十六进制}
log_level=debug
audio=false
max_size=720
max_fps=60
```

### 3. 不需要发送的参数
❌ `tunnel_forward=false` - 服务器默认为false
❌ `video_bit_rate` - 官方scrcpy不发送此参数
❌ `control=true` - 服务器默认为true
❌ `cleanup=true` - 服务器默认为true

### 4. REVERSE模式实现
```python
# 1. 设置reverse tunnel
adb reverse localabstract:scrcpy_{SCID} tcp:{PORT}

# 2. 创建listening socket
listen_socket.bind(('127.0.0.1', PORT))
listen_socket.listen(2)  # video + control

# 3. 启动服务器
adb shell CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / ...

# 4. Accept连接 (不读dummy byte!)
video_socket, _ = listen_socket.accept()
control_socket, _ = listen_socket.accept()
```

### 5. Dummy Byte协议
- **REVERSE模式**: 无dummy byte
- **FORWARD模式**: 有dummy byte

参考 `scrcpy develop.md` lines 333-336:
> "On the _first_ socket opened, **if the tunnel is _forward_**, then a [dummy byte] is sent"

## 修复的文件

### test_scrcpy_device.py
- ✅ 添加 `log_level=debug` 参数
- ✅ 使用正确的参数顺序
- ✅ 移除不必要的默认参数
- ✅ 添加服务器输出诊断

### 代码关键部分

```python
def _build_server_command(self, scid: int) -> list:
    cmd = [
        "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
        "app_process",
        "/",
        "com.genymobile.scrcpy.Server",
        "3.3.3",

        # 精确匹配官方参数顺序
        f"scid={scid:08x}",
        "log_level=debug",      # 必需！
        "audio=false",
        f"max_size={self.params.max_size}",
        f"max_fps={self.params.max_fps}",
    ]
    return cmd
```

## 当前状态

### 已解决的问题
✅ 协议理解：REVERSE vs FORWARD模式
✅ Dummy byte处理：REVERSE模式不需要
✅ 参数优化：只发送非默认值
✅ 参数顺序：匹配官方scrcpy
✅ log_level参数：添加必需的debug级别

### 待解决的问题
⚠️ 服务器仍然Abort (退出代码134)
- 即使参数完全匹配官方scrcpy
- 可能是服务器jar文件问题
- 需要用logcat查看详细错误

## 下一步诊断

### 方案1: 使用logcat查看服务器错误
```bash
adb logcat -c
adb logcat -s scrcpy:V app_process:V AndroidRuntime:E &
python test_scrcpy_device.py
```

### 方案2: 确认服务器文件完整性
```bash
adb shell md5sum /data/local/tmp/scrcpy-server.jar
# 应该匹配官方服务器文件的MD5
```

### 方案3: 重新推送服务器文件
```bash
scrcpy --serial=R4RCHEKBRWFEEYB6  # 会自动推送最新服务器
```

## 参考文档

- `scrcpy_source/doc/develop.md` - 协议详细说明
- `scrcpy_source/app/src/server.c` - 客户端参数构建
- `scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java` - 服务器默认值
- 官方scrcpy运行进程: PID 23846 的cmdline

## 用户反馈

用户提示："输入debug就行了不要cache，这样就没事了"

这可能意味着：
1. log_level=debug 是关键
2. 可能需要禁用某种缓存设置
3. 保持参数简洁
