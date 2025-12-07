# 多语言覆盖检测报告

## 检测时间
2025-01-XX

## 检测范围
`poly_apps/matrixui` 目录下所有组件文件

---

## ❌ 完全没有使用 i18n 的文件

### 1. `components/BottomToolbar.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "SELECTED"
- "SYNC ON" / "SYNC OFF"
- "TikTok", "Insta", "Momo", "WeChat", "YouTube", "Facebook", "WhatsApp" (应用标签)
- "Home", "Back", "Recent", "Snap", "Rec", "Bright", "Rotate", "Paste"
- "Broadcast text..."
- "SYS.LOG"
- "Power Toggle"

### 2. `components/ControlTerminal.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "AI CORE: {lastAnalysis}"
- "Enter natural language command (e.g., 'Shutdown all units with critical battery')"

### 3. `components/DeviceControl.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "LIVE 60FPS"
- "Touch Control"
- "INSPECTOR"
- "Select Device"
- "SELECT NODE TO INSPECT"
- "IDENTITY"
- "MODEL", "SERIAL", "BATTERY", "TEMP"
- "TELEMETRY"
- "CPU LOAD"
- "QUICK ACTIONS"
- "Snap", "Rec", "Paste", "Lock", "Clean", "Kill"
- "SYSTEM LOG"

### 4. `components/GroupControlPanel.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "Target Devices"
- "SYNC ACTIVE" / "SYNC OFF"
- "NAVIGATION"
- "Back", "Home", "Recent", "Power", "Unlock", "Snap"
- "GESTURES"
- "SWIPE UP", "SWIPE DOWN"
- "BROADCAST INPUT"
- "Type message to all devices..."
- "QUICK LAUNCH"
- "TikTok", "Insta", "WeChat", "YouTube", "Facebook", "WhatsApp"

### 5. `components/ScriptFlowVisualizer.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "Start"
- "Complete"

### 6. `components/SystemStats.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "Network Status"
- "ONLINE"
- "System Load (Avg)"
- "Critical Alerts"
- "UNITS"

### 7. `components/UnitGrid.tsx`
**状态**: ❌ 未使用 i18n  
**硬编码文本**:
- "Load"
- "Power"

### 8. `components/ChatInterface.tsx`
**状态**: ❌ 未使用 i18n (已废弃)  
**硬编码文本**:
- "Deprecated. Please use DeviceDashboard."

### 9. `components/LiveInterface.tsx`
**状态**: ❌ 未使用 i18n (已废弃)  
**硬编码文本**:
- "Deprecated. Please use DeviceDashboard."

---

## ⚠️ 使用了 i18n 但仍有硬编码文本的文件

### 1. `App.tsx`
**状态**: ⚠️ 部分使用 i18n  
**已使用 i18n**: ✅ 大部分文本已国际化  
**硬编码文本**:
- Line 186: `"LANGUAGE / 语言"` (应使用 i18n)
- Line 330: `"Admin"` (用户信息)
- Line 331: `"Level 9 Access"` (权限信息)
- Line 274: `"Unified WebSocket (Default)"` (协议选项)
- Line 275: `"Raw TCP"` (协议选项)
- Line 259-261: `"H.264 (AVC)"`, `"H.265 (HEVC)"`, `"AV1"` (编码器选项)

### 2. `components/DeviceConfigModal.tsx`
**状态**: ⚠️ 部分使用 i18n  
**已使用 i18n**: ✅ 大部分文本已国际化  
**硬编码文本**:
- Line 137: `"Cancel"` (取消按钮)
- Line 61: `"360p"`, `"720p"`, `"1080p"` (分辨率标签)
- Line 88-91: `"30 FPS"`, `"60 FPS"`, `"90 FPS"`, `"120 FPS"` (帧率选项)
- Line 101-103: `"H.264"`, `"H.265"`, `"AV1"` (编码器选项)

### 3. `components/FileManager.tsx`
**状态**: ⚠️ 部分使用 i18n  
**已使用 i18n**: ✅ 大部分文本已国际化  
**硬编码文本**:
- Line 81: `"Delete"` (删除按钮)
- Line 96: `"items selected"` (选中项数量)
- Line 97: `"24.5 GB Free"` (存储空间)
- Line 97: `"Apps Installed"` (应用数量)
- Line 54: `"ALL DEVICES"` (目标设备)
- Line 56: `"Installed Packages"` (包管理标签)
- Line 121: `"Folder"` (文件夹类型)
- Line 121: `"2.4 MB"` (文件大小示例)
- Line 154: `"System"` (系统应用标签)

### 4. `components/ScriptLibrary.tsx`
**状态**: ⚠️ 部分使用 i18n  
**已使用 i18n**: ✅ 大部分文本已国际化  
**硬编码文本**:
- Line 265: `"Devices"` (设备数量单位)
- Line 243: `"Actions"` (步骤数量单位)
- Line 294: `"Select a script to view flow"` (空状态提示)
- Line 168: `"Douyin/TikTok"` (平台名称，可能需要保留)

### 5. `index.html`
**状态**: ⚠️ HTML 标题硬编码  
**硬编码文本**:
- Line 6: `<title>星灿传媒科技 - 云矩阵</title>` (页面标题)

---

## ✅ 已完全使用 i18n 的文件

1. `components/DeviceDashboard.tsx` ✅
2. `components/MediaGallery.tsx` ✅
3. `components/Navigation.tsx` ✅

---

## 统计摘要

- **完全未使用 i18n**: 9 个文件
- **部分使用 i18n**: 5 个文件
- **完全使用 i18n**: 3 个文件
- **总计检测**: 17 个组件文件

---

## 建议

1. **优先处理**: 完全未使用 i18n 的文件，特别是用户界面核心组件
2. **补充翻译键**: 在 `locales/translations.ts` 中添加缺失的翻译键
3. **逐步迁移**: 先处理高频使用的组件（如 BottomToolbar, DeviceControl）
4. **统一规范**: 所有用户可见文本都应通过 `t()` 函数获取

