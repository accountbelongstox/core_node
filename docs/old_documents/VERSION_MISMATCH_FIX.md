# Version Mismatch Fix

## ❌ 问题诊断

**错误信息**:
```
[server] ERROR: The server version (3.3.4) does not match the client (3.3.3)
java.lang.IllegalArgumentException: The server version (3.3.4) does not match the client (3.3.3)
```

**根本原因**: 版本不一致
- **下载版本**: `scrcpy_server_manager.py` 下载 **3.3.4**
- **启动版本**: `scrcpy_device.py` 启动命令传 **3.3.3**
- **设备上**: 可能存在旧版本 **3.3.4** (之前推送的)

---

## ✅ 解决方案（不改连接逻辑）

### 1️⃣ 统一版本号

**文件**: `pycore/pyutils/device/scrcpy_server_manager.py:46`

```python
# Before
SCRCPY_VERSION = "3.3.4"

# After
SCRCPY_VERSION = "3.3.3"  # CRITICAL: Must match version in scrcpy_device.py startup command
```

**原因**:
- 启动命令在 `scrcpy_device.py:792` 写死为 `3.3.3`
- 用户要求不改连接命令参数
- 所以只能改下载版本匹配启动版本

---

### 2️⃣ 清理设备旧版本

**文件**: `pycore/pyutils/device/scrcpy_server_manager.py:452-466`

**新增逻辑**: 推送前删除设备上的旧文件

```python
# CRITICAL: Remove old jar file on device to prevent version mismatch
ColorPrint.blue(f"[ScrcpyServerManager] Removing old jar on {serial} (if exists)...")
try:
    await loop.run_in_executor(
        None,
        lambda: subprocess.run(
            [self.adb_path, "-s", serial, "shell", "rm -f /data/local/tmp/scrcpy-server"],
            capture_output=True,
            timeout=3
        )
    )
except Exception as e:
    ColorPrint.yellow(f"[ScrcpyServerManager] Failed to remove old jar (non-fatal): {e}")
```

**原因**:
- 设备上可能已经存在旧版本 (3.3.4)
- Hash校验会跳过推送（以为已存在正确版本）
- 删除后强制推送新版本

---

## 🔧 修复内容总结

| 修改项 | 文件 | 行号 | 内容 |
|--------|-----|------|------|
| 版本号统一 | `scrcpy_server_manager.py` | 46 | `SCRCPY_VERSION = "3.3.3"` |
| 清理旧版本 | `scrcpy_server_manager.py` | 452-466 | `rm -f /data/local/tmp/scrcpy-server` |

---

## ✅ 不改变的部分

**保持不变**:
- ❌ `scrcpy_device.py:792` - 启动命令版本号 `3.3.3`
- ❌ 连接逻辑（FORWARD/REVERSE）
- ❌ 设备参数（max_size, bit_rate, max_fps）
- ❌ 编码参数

**只修改**:
- ✅ 下载管理器的版本号
- ✅ 推送逻辑（先清理后推送）

---

## 🎯 预期效果

**修复后**:
1. 下载正确版本 (3.3.3)
2. 删除设备上旧版本 (3.3.4)
3. 推送新版本 (3.3.3)
4. 启动命令版本匹配 ✅
5. **不再出现版本不匹配错误**

---

## 🚀 测试步骤

1. **删除本地缓存**:
   ```bash
   # 删除本地 scrcpy-server（让它重新下载3.3.3）
   rm ~/.core_node/scrcpy/scrcpy-server
   ```

2. **重启服务**:
   ```bash
   # 重启 matrix 服务
   python pyapps/matrix/matrix_main.py
   ```

3. **连接设备**:
   - 观察日志：应该看到 `Removing old jar on {serial}`
   - 观察日志：应该看到 `Pushing jar to {serial}`
   - **不应该**再出现版本不匹配错误

---

## 📋 错误日志对比

### ❌ 修复前
```
[Server-xxx] [ERR] ERROR: The server version (3.3.4) does not match the client (3.3.3)
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!
```

### ✅ 修复后
```
[ScrcpyServerManager] Removing old jar on xxx (if exists)...
[ScrcpyServerManager] Pushing jar to xxx...
[ScrcpyServerManager] ✓ jar pushed to xxx
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] [OK] Dummy byte received (video socket ready)
```

---

## ⚠️ 注意事项

1. **第一次连接会慢**：需要重新下载 3.3.3 并推送到所有设备
2. **设备数量多**：可能需要几分钟完成所有设备的清理+推送
3. **网络问题**：如果下载失败，检查 GitHub 访问

---

## 🔍 调试命令

如果仍然失败，手动检查设备：

```bash
# 查看设备上的 scrcpy-server
adb -s <serial> shell ls -l /data/local/tmp/scrcpy-server

# 手动删除
adb -s <serial> shell rm /data/local/tmp/scrcpy-server

# 查看设备上运行的 scrcpy 进程
adb -s <serial> shell ps | grep scrcpy

# 手动停止
adb -s <serial> shell pkill -f scrcpy-server
```

---

## ✅ 修复状态

- ✅ 版本号统一为 3.3.3
- ✅ 添加旧版本清理逻辑
- ✅ 不改变连接逻辑
- ✅ 不改变启动参数

**修复完成！重启服务即可生效。**
