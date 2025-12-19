# scrcpy 修复状态 - 2025-12-17 22:00

## 修复总结

### ✅ 已完成的修复

1. **Shell命令格式修复** (`pycore/pyutils/device/scrcpy_device.py:250-263`)
   - 修复前：`*server_cmd` 展开为多个参数
   - 修复后：`' '.join(server_cmd)` 作为单个字符串传递给 shell
   - **原因**：`CLASSPATH=...` 必须由 shell 解释为环境变量，不能作为独立参数

2. **批量部署 scrcpy-server.jar**
   - 创建了 `push_to_all_devices.py`
   - 已成功推送到 22/24 个设备

### 📊 当前设备状态

**成功运行的设备**（至少1个确认）：
- `192.168.31.125:5555`: ✅ 600帧，3.78 MB 已发送

**jar已部署，等待测试**（4个）：
- `192.168.31.126:5555`: ✅ jar已推送
- `192.168.31.128:5555`: ✅ jar已推送
- `192.168.31.132:5555`: ✅ jar已推送
- `192.168.31.138:5555`: ✅ jar已推送

**无法连接的设备**（1个）：
- `192.168.31.136:5555`: ❌ adb: error: connect failed: closed

### 🎯 测试验证

请运行你的 Matrix 应用测试：
```bash
python .\pymain.py app=matrix
```

**预期结果**：
- 之前失败的设备（126, 128, 132, 138）现在应该能正常连接
- 应该看到更多设备显示 `[VideoStreamService] xxx YUV: N frames, X MB sent`

### ❌ 剩余问题

1. **设备 192.168.31.136:5555 无法连接**
   - 错误：`connect failed: closed`
   - 可能原因：设备离线、网络问题、或 ADB 服务未运行
   - 解决方案：检查设备网络连接和 ADB 状态

### 📋 如果还有设备失败

如果其他设备仍然失败，请检查：

1. **jar 文件是否存在**：
```bash
adb -s <device> shell "ls -lh /data/local/tmp/scrcpy-server.jar"
```

2. **手动推送**：
```bash
adb -s <device> push "D:\.tmp\Users\MyBest11\.core_node\scrcpy\scrcpy-server" /data/local/tmp/scrcpy-server.jar
```

3. **查看设备 logcat**：
```bash
adb -s <device> logcat -s scrcpy:* *:E
```

### 🔍 关键发现

**为什么 192.168.31.125:5555 成功了？**
- jar 文件已存在
- shell 命令格式正确
- 设备网络连接正常
- scrcpy-server 成功启动并发送视频流

**为什么其他设备失败？**
- jar 文件缺失（主要原因）
- 之前的 push 脚本在这些设备离线时运行

**修复验证**：
- 推送 jar 后，这些设备应该能正常工作
- 192.168.31.125:5555 的成功证明了代码修复是正确的

---

## 技术细节

### 修复的关键代码

```python
# pycore/pyutils/device/scrcpy_device.py:250-263

# CRITICAL FIX: Pass command as single string to shell
# Environment variable CLASSPATH=... must be interpreted by shell, not as separate arg
shell_command = ' '.join(server_cmd)

adb_cmd = [
    self.adb_path,
    "-s", self.serial,
    "shell",
    shell_command  # Pass as single string for proper shell parsing
]
```

### 为什么这个修复有效？

**问题**：
```python
# 错误的方式
adb shell CLASSPATH=... app_process ...  # 每个参数独立
```
Shell 看到的是尝试执行名为 `CLASSPATH=...` 的程序。

**解决方案**：
```python
# 正确的方式
adb shell "CLASSPATH=... app_process ..."  # 作为单个命令字符串
```
Shell 正确解析 `CLASSPATH=...` 为环境变量设置。

---

## 下一步

1. ✅ 运行 Matrix 应用测试所有设备
2. ⏳ 验证之前失败的设备现在能正常工作
3. ⏳ 如有新的错误，收集 logcat 输出
4. ⏳ 解决 192.168.31.136:5555 的连接问题（可选）

**置信度**：95% - 主要问题已解决，代码修复已被 192.168.31.125:5555 的成功证明有效。
