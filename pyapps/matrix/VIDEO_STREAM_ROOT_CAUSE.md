# scrcpy视频流推送失败根本原因 - 2025-12-17 23:00

## 问题症状

所有设备（除少数例外）显示相同错误：
```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!
[ScrcpyDevice] [SERVER STDERR]: Aborted
```

## 根本原因：ClassNotFoundException

通过logcat捕获到真正的错误：

```
Abort message: 'art/runtime/thread.cc:1657] No pending exception expected:
java.lang.ClassNotFoundException: Didn't find class "com.genymobile.scrcpy.Server"
on path: DexPathList[[],nativeLibraryDirectories=[/system/lib64, /vendor/lib64, ...]]'
```

**关键发现**：`DexPathList[[]]` 是**空的**！

## 问题分析

### 当前命令格式（已修复shell传递，但仍失败）

```python
shell_command = ' '.join([
    "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
    "app_process",
    "/",
    "com.genymobile.scrcpy.Server",
    "3.3.3",
    "scid=...",
    ...
])

adb_cmd = [adb, "-s", serial, "shell", shell_command]
```

虽然命令作为单个字符串传递给shell（这是正确的），但在**Android 7.0**上，`CLASSPATH`环境变量似乎没有被正确应用到`app_process`。

### Android 7.0的特殊性

设备信息：
- 型号：SM-G9200 (Samsung Galaxy S6 Edge+)
- Android版本：7.0
- API Level：24

**Android 7.0可能的问题**：
1. SELinux策略限制从`/data/local/tmp/`加载DEX文件
2. `app_process`在Android 7.0上对CLASSPATH的处理不同
3. 需要使用不同的DEX加载方式

## 可能的解决方案

### 方案1：使用ANDROID_DATA环境变量（推荐）

某些Android版本要求DEX文件在特定路径或使用特定环境变量：

```bash
CLASSPATH=/data/local/tmp/scrcpy-server.jar \
ANDROID_DATA=/data/local/tmp \
app_process / com.genymobile.scrcpy.Server ...
```

### 方案2：修改jar文件权限

Android 7.0可能对文件权限有更严格要求：

```bash
adb shell chmod 755 /data/local/tmp/scrcpy-server.jar
adb shell chown shell:shell /data/local/tmp/scrcpy-server.jar
```

### 方案3：使用不同的执行方式

参考官方scrcpy源代码中的server.c实现，可能需要：

```bash
# 方式A: 使用explicit_abi
CLASSPATH=/data/local/tmp/scrcpy-server.jar \
app_process64 / com.genymobile.scrcpy.Server ...

# 方式B: 使用dalvikvm（Android 7.0之前）
CLASSPATH=/data/local/tmp/scrcpy-server.jar \
dalvikvm -Xmx256m -cp /data/local/tmp/scrcpy-server.jar \
com.genymobile.scrcpy.Server ...
```

### 方案4：检查jar文件格式

scrcpy-server应该是一个包含`classes.dex`的jar文件。需要验证：
- jar文件格式是否正确
- classes.dex是否存在
- DEX版本是否与Android 7.0兼容

## 为什么192.168.31.125等少数设备成功了？

可能的原因：
1. 这些设备的Android版本不同（可能是Android 8.0+）
2. 这些设备的SELinux设置不同
3. 之前测试时使用了不同的jar推送方式或权限

## 下一步调试

1. **验证jar文件内容**：
```bash
adb -s 192.168.31.124:5555 shell "unzip -l /data/local/tmp/scrcpy-server.jar | grep classes.dex"
```

2. **测试不同的执行方式**：
   - 尝试`app_process64`
   - 添加`ANDROID_DATA`环境变量
   - 修改文件权限

3. **对比成功和失败的设备**：
   - Android版本差异
   - SELinux状态（`getenforce`）
   - 文件权限差异

4. **查看官方scrcpy如何处理**：
   - 检查官方scrcpy客户端是否能连接192.168.31.124
   - 如果能，用`ps`命令查看实际的命令行参数

## 参考资料

- [scrcpy官方文档 - Server execution](https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md#server)
- [Android app_process](https://android.googlesource.com/platform/frameworks/base/+/master/cmds/app_process/)
- [Android 7.0 行为变更](https://developer.android.com/about/versions/nougat/android-7.0-changes)

---

**当前状态**：已识别根本原因（ClassNotFoundException），需要调整jar加载方式以适配Android 7.0。
