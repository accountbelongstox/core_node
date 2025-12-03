# React Native 调试指南

## 快速开始

### 方法 1: 使用启动脚本（推荐）

```powershell
.\scripts\start.ps1
```

然后选择：
1. **选项 1**: 启动 Metro bundler（开发服务器）
2. **选项 2**: 在连接的设备上运行应用

### 方法 2: 手动步骤

#### 步骤 1: 启动 Metro Bundler

```powershell
pnpm start
# 或
pnpm exec react-native start
```

#### 步骤 2: 在另一个终端运行应用

```powershell
pnpm exec react-native run-android
```

## 设备连接

### Android 设备

1. **启用 USB 调试**:
   - 设置 > 关于手机 > 连续点击"版本号"7次
   - 设置 > 开发者选项 > 启用"USB 调试"

2. **检查设备连接**:
   ```powershell
   adb devices
   ```
   应该显示你的设备，例如：
   ```
   List of devices attached
   6b727450        device
   ```

3. **如果设备未显示**:
   - 检查 USB 连接
   - 在设备上允许 USB 调试授权
   - 尝试重新连接 USB 线

### Android 模拟器

1. 打开 Android Studio
2. 启动 AVD Manager
3. 创建或启动一个模拟器
4. 确保模拟器完全启动后再运行应用

## Metro Bundler 命令

当 Metro bundler 运行时，可以使用以下快捷键：

- **r** - 重新加载应用
- **d** - 打开开发者菜单
- **j** - 打开 DevTools
- **Ctrl+C** - 停止 Metro bundler

## 开发者菜单

在设备上：
- **Android**: 摇动设备，或按 `adb shell input keyevent 82`
- **菜单选项**:
  - Reload - 重新加载应用
  - Debug - 打开 Chrome DevTools
  - Enable Hot Reloading - 启用热重载
  - Show Perf Monitor - 显示性能监控

## 常见问题

### 1. "No apps connected"

**原因**: 应用没有在设备上运行

**解决**:
- 确保 Metro bundler 正在运行
- 运行 `pnpm exec react-native run-android` 在设备上安装并启动应用

### 2. "Could not connect to development server"

**原因**: Metro bundler 未运行或设备无法访问

**解决**:
- 确保 Metro bundler 正在运行
- 检查设备与电脑在同一网络（模拟器自动连接）
- 对于真机，可能需要配置端口转发：`adb reverse tcp:8081 tcp:8081`

### 3. 构建失败

**解决**:
- 清理构建: `cd android && .\gradlew clean`
- 重新安装依赖: `pnpm install`
- 检查 Android SDK 是否正确安装

### 4. 应用崩溃

**调试步骤**:
1. 查看 Metro bundler 日志
2. 查看设备日志: `adb logcat | findstr ReactNativeJS`
3. 在开发者菜单中启用"Show Perf Monitor"

## 调试工具

### Chrome DevTools

1. 在开发者菜单选择 "Debug"
2. Chrome 会自动打开 `http://localhost:8081/debugger-ui/`
3. 在 Chrome DevTools 中调试 JavaScript

### React Native Debugger

安装独立调试器：
```powershell
# 使用 npm 全局安装
npm install -g react-native-debugger
```

### Flipper (可选)

Flipper 是 Facebook 的移动应用调试平台，可以：
- 查看网络请求
- 查看日志
- 检查 React 组件树
- 性能分析

## 热重载

默认启用 Fast Refresh，修改代码后会自动更新：

- **保存文件**: 自动重新加载
- **修改组件**: 保持状态重新渲染
- **修改逻辑**: 完全重新加载

## 性能优化

### 查看性能指标

在开发者菜单中启用 "Show Perf Monitor" 查看：
- FPS (帧率)
- JS FPS
- 内存使用

### 生产模式构建

```powershell
cd android
.\gradlew assembleRelease
```

## 日志查看

### JavaScript 日志
在 Metro bundler 终端查看

### Native 日志
```powershell
adb logcat
```

### 过滤 React Native 日志
```powershell
adb logcat | findstr ReactNativeJS
```

## 网络调试

### 查看网络请求
- 使用 Flipper
- 或使用 Chrome DevTools 的 Network 面板（需要启用 Debug）

### 配置代理
如果需要使用代理，在 `metro.config.js` 中配置。

