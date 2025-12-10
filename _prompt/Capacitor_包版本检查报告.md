# Capacitor 包版本检查报告

## 📦 核心包版本信息

### 当前配置 vs 最新版本

| 包名 | 当前配置 | 最新稳定版 (latest) | 最新 7.x 版 (latest-7) | 状态 | 建议 |
|------|---------|---------------------|----------------------|------|------|
| `@capacitor/core` | 7.0.0 | **8.0.0** | 7.4.4 | ⚠️ 有重大更新 | 升级到 8.0.0 或保持 7.4.4 |
| `@capacitor/cli` | 7.0.0 | **8.0.0** | 7.4.4 | ⚠️ 有重大更新 | 升级到 8.0.0 或保持 7.4.4 |
| `@capacitor/android` | 7.0.0 | **8.0.0** | 7.4.4 | ⚠️ 有重大更新 | 升级到 8.0.0 或保持 7.4.4 |
| `@capacitor/ios` | 7.0.0 | **8.0.0** | 7.4.4 | ⚠️ 有重大更新 | 升级到 8.0.0 或保持 7.4.4 |
| `@capacitor/assets` | latest | **3.0.5** | - | ✅ 已是最新 | 保持 latest 或固定 3.0.5 |

## 🔌 插件包版本信息

### 当前配置 vs 最新版本

| 包名 | 当前配置 | 最新稳定版 (latest) | 最新 7.x 版 (latest-7) | 状态 | 建议 |
|------|---------|---------------------|----------------------|------|------|
| `@capacitor/action-sheet` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/app` | 8.0.0 | **8.0.0** | 7.1.1 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/app-launcher` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/browser` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/camera` | 8.0.0 | **8.0.0** | 7.1.5 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/clipboard` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/device` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/dialog` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/filesystem` | 8.0.0 | **8.0.0** | 7.1.6 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/geolocation` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/haptics` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/keyboard` | 8.0.0 | **8.0.0** | 7.0.4 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/local-notifications` | 8.0.0 | **8.0.0** | 7.0.4 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/network` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/preferences` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/share` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/splash-screen` | 8.0.0 | **8.0.0** | 7.0.4 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/status-bar` | 8.0.0 | **8.0.0** | 7.0.4 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |
| `@capacitor/toast` | 8.0.0 | **8.0.0** | 7.0.3 | ⚠️ 版本不匹配 | 核心包是 7.x，插件是 8.x，不兼容 |

## ⚠️ 关键问题

### 1. 版本不兼容问题

**问题描述：**
- 核心包 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`) 使用的是 **7.0.0**
- 所有插件包使用的是 **8.0.0**

**影响：**
- Capacitor 8.0 插件与 Capacitor 7.0 核心包**不兼容**
- 可能导致运行时错误、API 调用失败或构建失败

**解决方案：**

#### 方案 A：全部升级到 Capacitor 8.0（推荐用于新项目）
```yaml
# 核心包
'@capacitor/core': '8.0.0'
'@capacitor/cli': '8.0.0'
'@capacitor/android': '8.0.0'
'@capacitor/ios': '8.0.0'
'@capacitor/assets': 'latest'  # 或 '3.0.5'

# 插件包（保持 8.0.0）
'@capacitor/action-sheet': '8.0.0'
'@capacitor/app': '8.0.0'
# ... 其他插件保持 8.0.0
```

#### 方案 B：全部降级到 Capacitor 7.x（推荐用于稳定项目）
```yaml
# 核心包
'@capacitor/core': '7.4.4'  # 或 '7.0.0'
'@capacitor/cli': '7.4.4'   # 或 '7.0.0'
'@capacitor/android': '7.4.4'  # 或 '7.0.0'
'@capacitor/ios': '7.4.4'   # 或 '7.0.0'
'@capacitor/assets': 'latest'

# 插件包（降级到 7.x）
'@capacitor/action-sheet': '7.0.3'
'@capacitor/app': '7.1.1'
'@capacitor/app-launcher': '7.0.3'
'@capacitor/browser': '7.0.3'
'@capacitor/camera': '7.1.5'
'@capacitor/clipboard': '7.0.3'
'@capacitor/device': '7.0.3'
'@capacitor/dialog': '7.0.3'
'@capacitor/filesystem': '7.1.6'
'@capacitor/geolocation': '7.0.3'
'@capacitor/haptics': '7.0.3'
'@capacitor/keyboard': '7.0.4'
'@capacitor/local-notifications': '7.0.4'
'@capacitor/network': '7.0.3'
'@capacitor/preferences': '7.0.3'
'@capacitor/share': '7.0.3'
'@capacitor/splash-screen': '7.0.4'
'@capacitor/status-bar': '7.0.4'
'@capacitor/toast': '7.0.3'
```

## 📋 版本标签说明

npm 上的版本标签含义：

- **`latest`**: 最新稳定版本（当前为 8.0.0）
- **`latest-7`**: Capacitor 7.x 系列的最新版本
- **`latest-6`**: Capacitor 6.x 系列的最新版本
- **`latest-5`**: Capacitor 5.x 系列的最新版本
- **`next`**: 下一个主要版本的预发布版本（通常是 beta）
- **`nightly`**: 每日构建版本（不稳定）
- **`dev`**: 开发版本（不稳定）

## 🔄 Capacitor 8.0 迁移注意事项

### 主要变更（从 7.x 到 8.0）

1. **API 变更**
   - 某些 API 可能已更改或移除
   - 需要检查官方迁移指南

2. **构建配置变更**
   - Gradle 配置可能需要更新
   - Android/iOS 原生配置可能有变化

3. **依赖要求**
   - 可能需要更新 Node.js 版本
   - 可能需要更新 Android SDK 版本

### 迁移步骤

1. **查看官方迁移指南**
   - 访问：https://capacitorjs.com/docs/updating/8-0
   - 查看破坏性变更列表

2. **测试环境验证**
   - 在测试分支中升级
   - 全面测试所有功能

3. **逐步迁移**
   - 先升级核心包
   - 再升级插件包
   - 运行 `npx cap sync`

## 🛠️ 替代方案提示

### 1. 社区插件

如果官方插件不满足需求，可以考虑社区插件：

- **Splash Screen**: `@aparajita/capacitor-splash-screen` - 提供更丰富的启动屏幕功能
- **其他社区插件**: 在 npm 搜索 `capacitor-plugin-*` 或查看 [Capacitor 社区插件列表](https://capacitorjs.com/docs/community/plugins)

### 2. 原生实现

对于特定功能，可以考虑：
- 使用 Capacitor 的 Platform Channels 直接调用原生代码
- 创建自定义 Capacitor 插件

### 3. 其他框架

如果 Capacitor 不满足需求，可以考虑：
- **Ionic**: 基于 Capacitor 的完整框架
- **React Native**: 跨平台框架
- **Flutter**: Google 的跨平台框架

## 📝 推荐配置

### 稳定生产环境配置（推荐）

```yaml
# 核心包 - 使用 7.x 最新稳定版
'@capacitor/core': '7.4.4'
'@capacitor/cli': '7.4.4'
'@capacitor/android': '7.4.4'
'@capacitor/ios': '7.4.4'
'@capacitor/assets': '3.0.5'

# 插件包 - 使用 7.x 最新稳定版
'@capacitor/action-sheet': '7.0.3'
'@capacitor/app': '7.1.1'
'@capacitor/app-launcher': '7.0.3'
'@capacitor/browser': '7.0.3'
'@capacitor/camera': '7.1.5'
'@capacitor/clipboard': '7.0.3'
'@capacitor/device': '7.0.3'
'@capacitor/dialog': '7.0.3'
'@capacitor/filesystem': '7.1.6'
'@capacitor/geolocation': '7.0.3'
'@capacitor/haptics': '7.0.3'
'@capacitor/keyboard': '7.0.4'
'@capacitor/local-notifications': '7.0.4'
'@capacitor/network': '7.0.3'
'@capacitor/preferences': '7.0.3'
'@capacitor/share': '7.0.3'
'@capacitor/splash-screen': '7.0.4'
'@capacitor/status-bar': '7.0.4'
'@capacitor/toast': '7.0.3'
```

### 最新版本配置（需要迁移）

```yaml
# 核心包 - 使用 8.0.0
'@capacitor/core': '8.0.0'
'@capacitor/cli': '8.0.0'
'@capacitor/android': '8.0.0'
'@capacitor/ios': '8.0.0'
'@capacitor/assets': '3.0.5'

# 插件包 - 使用 8.0.0
'@capacitor/action-sheet': '8.0.0'
'@capacitor/app': '8.0.0'
'@capacitor/app-launcher': '8.0.0'
'@capacitor/browser': '8.0.0'
'@capacitor/camera': '8.0.0'
'@capacitor/clipboard': '8.0.0'
'@capacitor/device': '8.0.0'
'@capacitor/dialog': '8.0.0'
'@capacitor/filesystem': '8.0.0'
'@capacitor/geolocation': '8.0.0'
'@capacitor/haptics': '8.0.0'
'@capacitor/keyboard': '8.0.0'
'@capacitor/local-notifications': '8.0.0'
'@capacitor/network': '8.0.0'
'@capacitor/preferences': '8.0.0'
'@capacitor/share': '8.0.0'
'@capacitor/splash-screen': '8.0.0'
'@capacitor/status-bar': '8.0.0'
'@capacitor/toast': '8.0.0'
```

## 🔍 检查命令

### 查看所有包的最新版本
```bash
npm view @capacitor/core version
npm view @capacitor/cli version
npm view @capacitor/android version
npm view @capacitor/ios version
npm view @capacitor/assets version
npm view @capacitor/action-sheet version
# ... 其他插件
```

### 查看版本标签
```bash
npm view @capacitor/core dist-tags
npm view @capacitor/action-sheet dist-tags
```

### 检查项目中的过时包
```bash
npm outdated
```

## 📚 参考资源

- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [Capacitor 更新指南](https://capacitorjs.com/docs/updating)
- [Capacitor 8.0 迁移指南](https://capacitorjs.com/docs/updating/8-0)
- [npm Capacitor 包列表](https://www.npmjs.com/search?q=%40capacitor)
- [Capacitor GitHub](https://github.com/ionic-team/capacitor)

---

**生成时间**: 2024年12月
**数据来源**: npm registry (通过 `npm view` 命令获取)

