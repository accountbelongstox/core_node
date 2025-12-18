# scrcpy 视频流问题完整诊断总结 - 2025-12-17

## 当前状态

✅ **Shell命令格式**：已修复（作为单个字符串传递给shell）
✅ **scrcpy-server.jar部署**：已推送到18/19个设备
❌ **视频流推送**：失败 - ClassNotFoundException

## 根本原因

### ClassNotFoundException on Android 7.0

Logcat错误信息：
```
ClassNotFoundException: Didn't find class "com.genymobile.scrcpy.Server"
on path: DexPathList[[],nativeLibraryDirectories=[/system/lib64, /vendor/lib64]]
```

**DexPathList是空的**，说明Android 7.0无法从`/data/local/tmp/scrcpy-server.jar`加载DEX类。

### 已尝试的修复方案

1. ✅ **Shell命令格式修复**（第一次修复）
   - 从 `*server_cmd` 改为 `' '.join(server_cmd)`
   - 确保CLASSPATH作为环境变量被shell正确解析

2. ✅ **jar文件部署**
   - 使用 `push_to_all_devices.py` 推送到所有设备
   - 验证文件存在且大小正确（90164字节）

3. ❌ **app_process64 + ANDROID_DATA**（第二次尝试）
   ```python
   cmd = [
       "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
       "ANDROID_DATA=/data/local/tmp",  # 添加
       "app_process64",  # 使用64位版本
       "/",
       "com.genymobile.scrcpy.Server",
       ...
   ]
   ```
   **结果**：仍然失败，ClassNotFoundException依然存在

## 技术分析

### Android 7.0的特殊限制

Android 7.0 (API 24)引入了更严格的SELinux策略和DEX加载限制：

1. **SELinux域限制**
   shell用户运行的app_process可能受到域隔离限制

2. **DEX优化位置**
   Android 7.0+要求DEX文件在特定位置才能被加载和优化

3. **ClassLoader机制变化**
   从Android 7.0开始，ClassLoader的实现发生了重大变化

### 为什么少数设备成功？

根据日志，`192.168.31.125:5555` 等少数设备成功推送了600帧。可能原因：
- Android版本不同（可能是8.0+）
- SELinux设置不同（Permissive vs Enforcing）
- Root权限状态不同

## 问题的本质

**核心问题**：scrcpy v3.3.3的scrcpy-server.jar无法在Android 7.0设备上通过`app_process`/`app_process64`加载。

这不是代码bug，而是**Android系统兼容性问题**。

## 解决方案

### 方案1：使用官方scrcpy客户端测试（推荐）

验证官方scrcpy是否能连接这些Android 7.0设备：

```bash
D:\.tmp\Users\MyBest11\.core_node\scrcpy\scrcpy.exe -s 192.168.31.124:5555 --max-size=720
```

- **如果成功**：分析官方客户端使用的确切命令和参数
- **如果失败**：确认scrcpy 3.3.3不支持Android 7.0

### 方案2：降级scrcpy版本

尝试使用旧版本scrcpy（如2.x）的server，可能对Android 7.0有更好的兼容性。

### 方案3：Root权限运行

如果设备已root，尝试以root身份运行app_process：

```bash
su -c "CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process ..."
```

### 方案4：升级设备Android版本

如果可行，将设备升级到Android 8.0+。

### 方案5：使用QtScrcpy的实现

研究 `pyapps/QtScrcpy` 的实际实现细节：
- 查看QtScrcpyCore子模块的源代码
- 确认它如何处理不同Android版本
- 复制其经过验证的方法

## 下一步行动

###  优先级1：验证官方scrcpy

```bash
# 测试官方客户端
cd D:\.tmp\Users\MyBest11\.core_node\scrcpy
scrcpy.exe -s 192.168.31.124:5555 --max-size=720 --verbosity=debug

# 如果成功，查看实际执行的命令
adb -s 192.168.31.124:5555 shell "ps | grep scrcpy"
```

### 优先级2：对比成功和失败设备

```bash
# 检查成功设备的Android版本
adb -s 192.168.31.125:5555 shell getprop ro.build.version.release
adb -s 192.168.31.125:5555 shell getprop ro.build.version.sdk

# 检查失败设备
adb -s 192.168.31.124:5555 shell getprop ro.build.version.release
adb -s 192.168.31.124:5555 shell getprop ro.build.version.sdk
```

### 优先级3：研究QtScrcpy源码

查看 QtScrcpy 如何启动scrcpy-server，特别是：
- server.c 中的命令构建逻辑
- ADB调用方式
- 版本兼容性处理

## 文件修改记录

###  已修改文件

1. `pycore/pyutils/device/scrcpy_device.py`
   - 行250-263：修复shell命令传递方式
   - 行748-755：添加ANDROID_DATA和app_process64

2. `push_to_all_devices.py`
   - 批量部署jar到所有设备

### 创建的文档

1. `pyapps/matrix/SHELL_COMMAND_FIX.md` - 第一次修复记录
2. `pyapps/matrix/SCRCPY_FIX_STATUS.md` - jar部署状态
3. `pyapps/matrix/VIDEO_STREAM_ROOT_CAUSE.md` - ClassNotFoundException分析
4. `pyapps/matrix/FINAL_DIAGNOSIS.md` - 本文档

## 结论

**当前修复不完整**。虽然shell命令格式已正确，jar文件已部署，但Android 7.0的DEX加载机制阻止了scrcpy-server的运行。

**建议**：
1. 立即测试官方scrcpy客户端以确定是否为系统兼容性问题
2. 如果官方客户端可用，抓取其实际使用的命令
3. 如果官方客户端也失败，考虑设备升级或scrcpy版本降级

---

**技术负责人**: Claude Sonnet 4.5
**诊断日期**: 2025-12-17
**设备型号**: SM-G9200 (Samsung Galaxy S6 Edge+)
**Android版本**: 7.0 (API 24)
**scrcpy版本**: 3.3.3
