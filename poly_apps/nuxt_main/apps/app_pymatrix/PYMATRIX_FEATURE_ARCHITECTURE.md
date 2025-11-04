# PyMatrix 功能架构与 UI 组织

**版本**: 2.0
**更新日期**: 2025-11-04
**状态**: ✅ 完整功能清单与UI规划

---

## 📐 架构原则

本文档基于 Nuxt Multi-App Namespace Architecture，遵循以下原则：
1. **功能模块化**: 每个功能模块独立开发，可复用
2. **UI 分版块**: 按用户使用场景组织 UI 布局
3. **前后端对齐**: 所有功能与后端 API 完全对应
4. **组件复用**: 共享组件库 (common/components/ui/)

参考文档: `development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`

---

## 🎯 UI 布局结构

### 主布局 (layouts_app_pymatrix/default.vue)

```
┌─────────────────────────────────────────────────────────────┐
│  PyMatrixTopBar (顶部导航栏)                                  │
│  - Logo & 标题                                                │
│  - 连接状态显示                                               │
│  - 快捷操作按钮 (连接设备、群组模式、系统设置、用户信息)         │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                    │
│  Left    │  Main Content Area (中央内容区)                    │
│  Panel   │  - PyMatrixDeviceGrid (设备网格显示)              │
│  (左侧)  │  - VideoPlayer (视频播放器)                        │
│          │  - DeviceControlPanel (设备控制面板)               │
│  设备列表 │                                                    │
│  群组树   │                                                    │
│          │                                                    │
│          │                                                    │
├──────────┤                                                    │
│          │                                                    │
│  功能面板 │                                                    │
│  快捷入口 │                                                    │
│          │                                                    │
└──────────┴────────────────────────────────────────────────────┘
```

---

## 🗂️ 功能分版块 (Feature Modules)

### 📱 模块一: 设备连接与管理 (Device Connection & Management)

**UI 位置**: 左侧面板 (PyMatrixLeftPanel) + 顶部栏 (PyMatrixTopBar)

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F001 | 设备列表获取 | PyMatrixLeftPanel.vue | ✅ | GET /api/devices/list |
| F002 | 设备连接 (USB/WiFi) | PyMatrixConnectDialog.vue | ✅ | POST /api/devices/{serial}/connect |
| F003 | 设备断开 | PyMatrixLeftPanel.vue | ✅ | POST /api/devices/{serial}/disconnect |
| F023 | 连接预设系统 | ConnectionPresetsPanel.vue | ✅ | GET/POST /api/connection-presets |
| F024 | 设备搜索和过滤 | DeviceSearchBar.vue + DeviceFilterPanel.vue | ✅ | 前端过滤 |
| F025 | 设备标签系统 | DeviceTagManager.vue + DeviceTagBadge.vue | ✅ | 前端存储 (localStorage) |
| F030 | 设备详细信息查看 | DeviceInfoPanel.vue | ✅ | GET /api/devices/{serial}/info |
| F033 | 设备连接历史 | ConnectionHistoryPanel.vue | ✅ | 前端存储 (connectionHistoryStore) |

**UI 特点**:
- 左侧面板显示设备列表，支持搜索、过滤、标签
- 顶部栏显示连接状态和快速连接按钮
- 连接对话框支持 USB、WiFi、历史记录连接
- 设备卡片显示标签、状态、角色

---

### 📺 模块二: 视频投屏与控制 (Video Streaming & Control)

**UI 位置**: 中央内容区 (PyMatrixDeviceGrid + VideoPlayer)

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F004 | 视频流播放 | VideoPlayer.vue + useVideoStream.ts | ✅ | WS /ws/video/{serial} |
| F005 | 触摸控制 | VideoPlayer.vue (鼠标交互) | ✅ | WS /ws/control/{serial} (control.touch) |
| F026 | 全屏视频播放器 | PyMatrixFullscreenPlayer.vue | ✅ | 前端功能 |
| - | 视频质量控制 | VideoControlPanel.vue | ✅ | WS quality参数 |
| - | 视频暂停/恢复 | VideoControlPanel.vue | ✅ | WS pause/resume |

**UI 特点**:
- 中央区域网格显示多个设备视频
- 悬停显示设备操作按钮
- 双击全屏播放
- 拖拽重新排列设备位置

---

### 🎮 模块三: 设备控制面板 (Device Control Panels)

**UI 位置**: 右侧面板 (PyMatrixRightPanel) + 浮动面板

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F006 | 系统按键控制 | SystemKeyPanel.vue | ✅ | WS /ws/control/{serial} (system) |
| F007 | 文本输入 | TextInputPanel.vue | ✅ | WS /ws/control/{serial} (control.text) |
| F011 | 剪贴板同步 - 设置 | ClipboardSyncPanel.vue | ✅ | WS /ws/control/{serial} (clipboard.set) |
| F012 | 剪贴板同步 - 获取 | ClipboardSyncPanel.vue | ✅ | WS /ws/control/{serial} (clipboard.get) |
| - | 鼠标/手势控制 | MouseControlPanel.vue | ✅ | WS /ws/control/{serial} (control.touch) |

**UI 特点**:
- 右侧面板显示常用控制功能
- 可折叠的章节（系统按键、文本输入、剪贴板）
- 浮动面板用于高级控制

---

### 🎬 模块四: 录制与截图 (Recording & Screenshot)

**UI 位置**: VideoPlayer 上的浮动控制 + RecordingControlPanel

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F008 | 录制控制 - 开始录制 | RecordingControlPanel.vue | ✅ | POST /api/devices/{serial}/recording/start |
| F009 | 录制控制 - 停止录制 | RecordingControlPanel.vue | ✅ | POST /api/devices/{serial}/recording/stop |
| F010 | 截图功能 | RecordingControlPanel.vue | ✅ | POST /api/devices/{serial}/screenshot |
| - | 录制格式选择 | RecordingControlPanel.vue | ✅ | 前端参数 (format: mp4/mkv) |
| - | 录制模式选择 | RecordingControlPanel.vue | ✅ | 前端参数 (mode: normal/background) |

**UI 特点**:
- 视频播放器上显示录制按钮
- 录制时显示计时器和状态
- 支持格式和模式选择
- 快捷键支持 (Alt+S 截图, Alt+Shift+R 开始录制, Alt+X 停止录制)

---

### 🖥️ 模块五: 屏幕控制 (Screen Control)

**UI 位置**: ScreenControlPanel (浮动面板)

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F013 | 屏幕电源控制 | ScreenControlPanel.vue | ✅ | POST /api/devices/{serial}/screen/power |
| F014 | 屏幕亮度控制 | ScreenControlPanel.vue | ✅ | POST /api/devices/{serial}/screen/brightness |
| F015 | 屏幕旋转控制 | ScreenControlPanel.vue | ✅ | POST /api/devices/{serial}/screen/rotation |
| F031 | 自动旋转控制 | ScreenControlPanel.vue | ✅ | POST /api/devices/{serial}/screen/auto-rotation |
| - | 保持唤醒 | ScreenControlPanel.vue | ✅ | 屏幕电源 API 的一部分 |

**UI 特点**:
- 一体化屏幕控制面板
- 滑块控制亮度
- 切换按钮控制电源和旋转
- 支持预设快捷操作

---

### 👥 模块六: 群组控制与批量操作 (Group Control & Batch Operations)

**UI 位置**: 顶部栏群组模式 + 群组控制面板 + 左侧群组树

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F019 | 群组角色指示器 | GroupRoleIndicator.vue | ✅ | 前端状态 (groupStore) |
| F022 | 群组树视图 | GroupTreeView.vue + GroupTreeNode.vue | ✅ | 前端 + 后端 tree API |
| F016 | 群组批量截图 | GroupControlPanel.vue | ✅ | POST /api/group/batch/screenshot |
| F017 | 群组批量录制 | GroupControlPanel.vue | ✅ | POST /api/group/batch/recording |
| F018 | 群组批量系统按键 | GroupControlPanel.vue | ✅ | POST /api/group/batch/system-key |
| F034 | 批量设备配置 | BatchConfigPanel.vue | ✅ | POST /api/group/batch/config |
| - | 群组批量文件推送 | GroupControlPanel.vue | ✅ | POST /api/group/batch/file-push |

**UI 特点**:
- 顶部栏显示群组开关和状态
- 左侧面板显示群组树视图
- Host 设备高亮显示
- 批量操作面板支持多种操作
- 配置模板系统

---

### 📁 模块七: 文件与应用管理 (File & App Management)

**UI 位置**: 浮动面板 (FilePushPanel + ApkInstallPanel + PackageListPanel)

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F020 | 文件推送 | FilePushPanel.vue | ✅ | POST /api/devices/{serial}/file/push |
| F021 | APK安装 | ApkInstallPanel.vue | ✅ | POST /api/devices/{serial}/file/install-apk |
| F027 | 包列表查看和卸载 | PackageListPanel.vue | ✅ | GET /api/devices/{serial}/packages |

**UI 特点**:
- 拖拽上传文件
- 进度条显示传输状态
- 应用列表支持搜索和过滤
- 卸载确认对话框

---

### ⚙️ 模块八: 系统设置与配置 (System Settings & Configuration)

**UI 位置**: PyMatrixSettingsDialog (模态对话框)

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F029 | 配置管理 | PyMatrixSettingsDialog.vue | ✅ | 前端存储 + 后端配置 |
| - | UI 偏好设置 | PyMatrixSettingsDialog.vue | ✅ | uiPreferencesStore |
| - | 连接设置 | PyMatrixSettingsDialog.vue | ✅ | 后端配置 |
| - | 视频设置 | PyMatrixSettingsDialog.vue | ✅ | 后端配置 |
| - | 录制设置 | PyMatrixSettingsDialog.vue | ✅ | 后端配置 |

**UI 特点**:
- 分章节设置页面
- 实时保存设置
- 设置导入/导出
- 默认值重置

---

### 📊 模块九: 系统监控与健康检查 (System Monitoring & Health Check)

**UI 位置**: SystemHealthMonitor (状态栏) + 监控面板

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F028 | 系统健康监控 | SystemHealthMonitor.vue | ✅ | GET /api/health/detailed |
| - | 性能指标显示 | SystemHealthMonitor.vue | ✅ | GET /api/health/detailed |
| - | CPU/内存/磁盘监控 | SystemHealthMonitor.vue | ✅ | GET /api/health/detailed |
| - | API 性能统计 | SystemHealthMonitor.vue | ✅ | GET /api/health/detailed |

**UI 特点**:
- 实时显示系统状态
- CPU、内存、磁盘使用率
- API 请求统计
- 健康状态指示器

---

### 🎨 模块十: 用户体验增强 (UX Enhancements)

**UI 位置**: 全局 + 辅助面板

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 后端API |
|----|---------|----------|------|---------|
| F032 | 键盘快捷键帮助面板 | KeyboardShortcutsHelp.vue | ✅ | 前端功能 |
| - | 网格布局控制 | GridLayoutControl.vue | ✅ | 前端功能 (uiPreferencesStore) |
| - | 设备拖拽排序 | PyMatrixDeviceGrid.vue | ✅ | 前端功能 (uiPreferencesStore) |
| - | Toast 通知系统 | ToastContainer.vue + useToast.ts | ✅ | 前端功能 |
| - | 上下文菜单 | DeviceContextMenu.vue | ✅ | 前端功能 |
| - | 空状态提示 | PyMatrixEmptyState.vue | ✅ | 前端功能 |

**UI 特点**:
- 全局快捷键支持 (Alt+组合键)
- 网格布局可调整 (1-6列)
- 拖拽排序设备
- Toast 通知提示
- 右键菜单快捷操作

---

### 🧩 模块十一: 共享组件库 (Shared Component Library)

**UI 位置**: common/components/ui/ (跨应用复用)

#### 功能列表

| ID | 功能名称 | 组件位置 | 状态 | 说明 |
|----|---------|----------|------|-----|
| F035 | BaseModal 组件 | common/components/ui/BaseModal.vue | ✅ | 高级模态框，焦点陷阱，可访问性 |
| - | BasePanel 组件 | common/components/ui/BasePanel.vue | ✅ | 通用面板容器 |
| - | BaseButton 组件 | common/components/ui/BaseButton.vue | ✅ | 按钮组件 |
| - | BaseSlider 组件 | common/components/ui/BaseSlider.vue | ✅ | 滑块组件 |
| - | BaseToggle 组件 | common/components/ui/BaseToggle.vue | ✅ | 切换开关 |
| - | BaseToast 组件 | common/components/ui/BaseToast.vue | ✅ | Toast 通知 |
| - | BaseContextMenu 组件 | common/components/ui/BaseContextMenu.vue | ✅ | 上下文菜单 |
| - | DeviceTagBadge 组件 | common/components/ui/DeviceTagBadge.vue | ✅ | 设备标签徽章 |

**特点**:
- 可跨应用复用
- 一致的设计风格
- 完整的类型定义
- Props 验证和默认值

---

## 🎯 快捷键绑定 (Keyboard Shortcuts)

**实现位置**: composables_app_pymatrix/useKeyboardShortcuts.ts

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| Alt+N | 连接新设备 | 打开连接对话框 |
| Alt+D | 断开当前设备 | 断开选中的设备 |
| Alt+G | 切换群组模式 | 开启/关闭群组控制 |
| Alt+F | 全屏播放 | 全屏显示当前设备 |
| Alt+S | 截图 | 截取当前设备屏幕 |
| Alt+Shift+R | 开始录制 | 开始录制当前设备 |
| Alt+X | 停止录制 | 停止录制 |
| Alt+H | 帮助 | 显示快捷键帮助面板 |
| Alt+, | 设置 | 打开设置对话框 |
| Esc | 关闭对话框 | 关闭当前打开的对话框 |

**注意**: 使用 Alt 键而非 Ctrl 键，避免与浏览器/系统快捷键冲突。

---

## 📦 功能统计

### 总览

| 类别 | 功能数量 | 完成度 |
|------|---------|--------|
| 设备连接与管理 | 8 | 100% (8/8) |
| 视频投屏与控制 | 5 | 100% (5/5) |
| 设备控制面板 | 5 | 100% (5/5) |
| 录制与截图 | 5 | 100% (5/5) |
| 屏幕控制 | 5 | 100% (5/5) |
| 群组控制与批量操作 | 7 | 100% (7/7) |
| 文件与应用管理 | 3 | 100% (3/3) |
| 系统设置与配置 | 5 | 100% (5/5) |
| 系统监控与健康检查 | 4 | 100% (4/4) |
| 用户体验增强 | 6 | 100% (6/6) |
| 共享组件库 | 8 | 100% (8/8) |
| **总计** | **61** | **100% (61/61)** |

### 桥接功能对齐

| 桥接文件功能 (F001-F035) | 35个 | 100% 完成 |
| 前端额外功能 | 26个 | 100% 完成 |
| **总功能数** | **61个** | **100% 完成** |

---

## 🏗️ 技术栈

### 前端技术

- **框架**: Nuxt 3 + Vue 3 Composition API
- **状态管理**: Pinia
- **样式**: NFTMax Theme + CSS Variables
- **WebSocket**: 原生 WebSocket API
- **类型**: TypeScript
- **工具**: Vite

### 后端技术

- **框架**: FastAPI
- **WebSocket**: FastAPI WebSocket
- **ADB**: Android Debug Bridge
- **设备控制**: adb-kit

---

## 📚 相关文档

1. **架构文档**
   - `NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md` - Nuxt 多应用架构
   - `THEME_APPLICATION_SUMMARY.md` - NFTMax 主题应用总结

2. **桥接文档**
   - `AI_COLLABORATION_BRIDGE.json` - 前后端协作桥接文件 (后端仓库)

3. **功能文档**
   - `FEATURE_LIST.md` - 功能清单 (基于截图识别)
   - `IMPLEMENTATION_PROGRESS.json` - 前端实现进度

4. **API 文档**
   - `API_USAGE_EXAMPLES.md` - API 使用示例 (后端仓库)
   - `BACKEND_COMPLETION_REPORT.md` - 后端完成报告 (后端仓库)

---

## 🎉 完成状态

**功能完成度**: 100% (61/61)
**前后端对齐度**: 100% (35/35)
**UI 组织完成度**: 100%
**文档完成度**: 100%

**最后更新**: 2025-11-04
**维护者**: PyMatrix Team
