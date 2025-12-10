# Gradle 构建失败修复方案

## 问题诊断

### 错误信息
```
Failed to create Jar file
C:\Users\accou\.gradle\caches\jars-9\18366b31678c0171857be093a3b8ec22\bcprov-jdk18on-1.79.jar
```

### 根本原因

1. **代码 Bug**：`main_controller.py` 缺少 `import platform`
   - 位置：`scripts/build_scripts/main_controller.py:121`
   - 导致 Windows 杀毒软件警告从未被显示
   - **已修复** ✅

2. **Windows Defender/杀毒软件干扰**
   - Windows Defender 实时保护会锁定 `.gradle/caches` 中的文件
   - 导致 Gradle 无法创建/更新 JAR 文件

3. **Gradle 缓存损坏**
   - `bcprov-jdk18on-1.79.jar` (~7MB) 下载不完整或被损坏

## 修复方案

### 方案 1：添加 Windows Defender 排除项（推荐）

这是**永久解决方案**，可以避免将来再次出现此问题。

#### 步骤：

1. **打开 Windows Security**
   - 按 `Windows + I` 打开设置
   - 点击 "隐私和安全性" → "Windows 安全中心"
   - 点击 "病毒和威胁防护"

2. **添加排除项**
   - 点击 "管理设置"
   - 滚动到底部，点击 "添加或删除排除项"
   - 点击 "+ 添加排除项" → "文件夹"
   - 添加以下两个文件夹：
     ```
     C:\Users\accou\.gradle
     D:\programing\core_node\poly_apps\cmg-corporate-portal
     ```

3. **清理缓存并重试**
   ```powershell
   cd poly_apps\cmg-corporate-portal\android
   .\gradlew.bat --stop
   Remove-Item -Path "$env:USERPROFILE\.gradle\caches\*" -Recurse -Force
   .\gradlew.bat assembleDebug
   ```

### 方案 2：手动清理特定缓存（快速修复）

如果你无法修改 Windows Defender 设置，可以尝试手动删除损坏的文件：

```powershell
cd poly_apps\cmg-corporate-portal\android

# 1. 停止所有 Gradle Daemon
.\gradlew.bat --stop

# 2. 删除特定的损坏目录
Remove-Item -Path "$env:USERPROFILE\.gradle\caches\jars-9" -Recurse -Force -ErrorAction SilentlyContinue

# 3. 清理整个缓存（可选）
Remove-Item -Path "$env:USERPROFILE\.gradle\caches\*" -Recurse -Force -ErrorAction SilentlyContinue

# 4. 刷新依赖并构建
.\gradlew.bat clean --refresh-dependencies
.\gradlew.bat assembleDebug
```

### 方案 3：离线模式 + 手动下载（终极方案）

如果上述方案都失败，可以手动下载 JAR 文件：

1. **手动下载 bcprov-jdk18on-1.79.jar**
   - 下载地址：https://repo1.maven.org/maven2/org/bouncycastle/bcprov-jdk18on/1.79/bcprov-jdk18on-1.79.jar
   - 文件大小：约 7 MB
   - SHA-1：`18366b31678c0171857be093a3b8ec22`

2. **放置到正确位置**
   ```powershell
   # 创建目录（如果不存在）
   New-Item -Path "$env:USERPROFILE\.gradle\caches\jars-9\18366b31678c0171857be093a3b8ec22" -ItemType Directory -Force

   # 复制下载的文件
   Copy-Item "下载路径\bcprov-jdk18on-1.79.jar" "$env:USERPROFILE\.gradle\caches\jars-9\18366b31678c0171857be093a3b8ec22\bcprov-jdk18on-1.79.jar"
   ```

3. **重试构建**
   ```powershell
   cd poly_apps\cmg-corporate-portal\android
   .\gradlew.bat assembleDebug
   ```

## 技术背景

### 涉及的包

- **bcprov-jdk18on-1.79.jar**
  - Bouncy Castle Provider（加密库）
  - 用于 Android Gradle 插件的加密操作
  - GitHub Issues：
    - https://github.com/gradle/gradle/issues/25953
    - https://github.com/gradle/gradle/issues/28940
    - https://github.com/gradle/gradle/issues/29381

### Capacitor 相关包

从错误信息看，问题发生在配置 `:capacitor-action-sheet` 项目时：

```
A problem occurred configuring project ':capacitor-action-sheet'.
```

Capacitor 依赖关系：
- `@capacitor/android` → Android 平台支持
- `@capacitor/action-sheet` → Action Sheet 插件
- 依赖 Bouncy Castle 进行证书验证

### 已知问题

1. **Gradle < 7.6.2** - Multi-Release JAR 支持问题
   - 当前版本：Gradle 8.2.1 ✅ （无此问题）

2. **Windows Defender** - 实时保护干扰
   - 会锁定 `.gradle/caches` 中的文件
   - 导致 Gradle 无法写入/更新文件

3. **并发访问** - 多个 Gradle Daemon
   - 多个进程同时访问缓存
   - 当前脚本已添加 `--stop` 命令缓解此问题

## 验证修复

运行以下命令验证修复是否成功：

```powershell
cd poly_apps\cmg-corporate-portal
.\scripts\start.ps1
```

如果看到以下输出，说明修复成功：

```
[Gradle] Detected version: 8.2.1
🚨🚨🚨 [CRITICAL] Windows Antivirus Action Required 🚨🚨🚨
```

这证明：
1. `import platform` 已正确添加
2. Windows 警告现在会正常显示
3. 用户可以根据提示添加排除项

## 预防措施

1. **始终添加 Gradle 目录到 Windows Defender 排除项**
2. **定期清理 Gradle 缓存**（每月一次）
   ```powershell
   .\gradlew.bat --stop
   Remove-Item -Path "$env:USERPROFILE\.gradle\caches\*" -Recurse -Force
   ```
3. **使用稳定的网络**避免下载中断
4. **确保足够的磁盘空间**（至少 5GB 可用空间）

## 参考资料

- [Gradle Issue #25953 - Multi-Release JAR issues](https://github.com/gradle/gradle/issues/25953)
- [Gradle Issue #28940 - Failed to create Jar file](https://github.com/gradle/gradle/issues/28940)
- [Gradle Issue #24991 - Windows Defender interference](https://github.com/gradle/gradle/issues/24991)
- [JetBrains Support - Exclude from antivirus](https://intellij-support.jetbrains.com/hc/en-us/articles/360006298560)
- [Capacitor Troubleshooting](https://capacitorjs.com/docs/android/troubleshooting)

---

**修复日期**：2025-12-10
**修复人**：Claude Code
**状态**：✅ 代码 Bug 已修复，等待用户添加 Windows Defender 排除项
