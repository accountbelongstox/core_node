# Escrcpy 扩展 UI 架构说明

## 📋 概述

已为 Escrcpy 添加**扩展 UI 框架**，在现有 UI 外层添加了更大的容器：

- **左侧导航栏**：菜单和设备分组
- **中央画布区**：主工作区（待另一个 AI 填充）
- **右侧工具栏**：**原始 Escrcpy UI**（完全保留）
- **顶部标题栏**：应用标题和全局操作

## 🏗️ 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│                    顶部标题栏 (60px)                          │
│  Logo + 搜索 + 通知 + 用户菜单 + 折叠按钮                      │
├─────────────┬────────────────────────────┬──────────────────┤
│             │                            │                  │
│ 左侧导航栏   │   中央画布区                 │  右侧工具栏       │
│             │   (主工作区)                │  (原始UI)        │
│             │                            │                  │
│ - 导航菜单   │  ✏️ 由另一个AI填充          │  ⛔ 不允许修改    │
│ - 设备分组   │                            │                  │
│ - 快捷工具   │  - 设备网格                 │  - 设备表格       │
│             │  - 视频流                   │  - 设置页面       │
│ (240px)     │  - 控制面板                 │  - WiFi连接      │
│ 或          │  - 文件管理                 │  - 快捷栏        │
│ (60px)      │  - 仪表板                   │  - 所有原功能     │
│             │                            │                  │
│             │                            │  (420px)         │
└─────────────┴────────────────────────────┴──────────────────┘
```

## 📁 文件结构

```
src/
├── layouts/
│   ├── index.vue                    # 布局路由器（已更新）
│   ├── default/                     # ⛔ 原始UI - 禁止修改
│   │   └── index.vue                #    完全保留
│   └── wrapper/                     # ✅ 新增包裹器布局
│       └── index.vue                #    外框容器
│
├── components/
│   └── layout/                      # ✅ 新增布局组件
│       ├── TopHeader/
│       │   └── index.vue            # ✏️ 顶部标题栏
│       ├── LeftSidebar/
│       │   └── index.vue            # ✏️ 左侧导航栏
│       └── MainCanvas/
│           └── index.vue            # ✏️ 中央画布区
```

## ⛔ 严格禁止修改

### 绝对不能改动的部分：

1. **`src/layouts/default/index.vue`**
   - 这是原始 Escrcpy UI
   - 所有现有功能都在这里
   - 必须保持原样工作

2. **Store 逻辑** (`src/store/*`)
   - 不允许添加新的 actions/mutations
   - 不允许修改现有 API
   - 建议只读访问

3. **现有页面** (`src/pages/*`)
   - Device、Preference、About 页面
   - 所有组件逻辑和模板
   - 这些页面在右侧工具栏中渲染

4. **组件接口**
   - Props 和 events 定义
   - 必须保持不变以确保集成正常

## ✏️ 允许自定义的部分

### 可以自由修改：

1. **TopHeader** (`src/components/layout/TopHeader/index.vue`)
   - Logo 和品牌
   - 搜索功能
   - 通知系统
   - 用户菜单
   - 样式和动画

2. **LeftSidebar** (`src/components/layout/LeftSidebar/index.vue`)
   - 导航菜单项
   - 设备分组显示
   - 快捷工具
   - 折叠行为
   - 样式主题

3. **MainCanvas** (`src/components/layout/MainCanvas/index.vue`)
   - **完全自由定制**
   - 设备网格/列表视图
   - 实时视频流
   - 批量控制面板
   - 文件管理界面
   - 脚本执行
   - 仪表板和监控
   - 任何自定义功能

4. **WrapperLayout** (`src/layouts/wrapper/index.vue`)
   - 面板尺寸（宽度、高度）
   - 颜色和主题
   - 折叠/展开行为
   - 响应式断点
   - 动画和过渡

## 🎨 开发建议

### 数据读取（推荐）

```vue
<script setup>
import { useDeviceStore } from '@/store/device'

const deviceStore = useDeviceStore()
const devices = computed(() => deviceStore.list)
</script>
```

### 操作触发（推荐模式）

```vue
// 在 MainCanvas 或其他自定义组件中
emit('action', {
  type: 'mirror',
  deviceIds: ['device-id-1'],
  params: { resolution: 1080 }
})

// wrapper 会处理这个事件并调用对应的 store 方法
```

## 🔄 切换布局

### 默认使用扩展 UI
应用默认使用 **wrapper 布局**（扩展 UI）。

### 切换回原始 UI
编辑 `src/layouts/index.vue`：
```vue
// 修改这一行：
const activeLayout = computed(() => LayoutMap[route.meta.layout || 'wrapper'])

// 改为：
const activeLayout = computed(() => LayoutMap[route.meta.layout || 'default'])
```

## 🚀 开发流程

### 1. 启动开发服务器
```bash
# Windows
.\scripts\start.ps1
# 选择 "1. Start Development Server"

# Unix/Linux/macOS
./scripts/start.sh
# 选择 "1. Start Development Server"
```

### 2. 访问应用
```
http://localhost:1535
```

### 3. 开始自定义

**推荐顺序：**

1. **从 MainCanvas 开始**
   - 打开 `src/components/layout/MainCanvas/index.vue`
   - 替换占位内容为你的 UI
   - 添加设备网格、视频流、控制面板等

2. **完善 LeftSidebar**
   - 打开 `src/components/layout/LeftSidebar/index.vue`
   - 添加真实的导航菜单
   - 连接设备分组数据
   - 添加过滤器和快捷操作

3. **美化 TopHeader**
   - 打开 `src/components/layout/TopHeader/index.vue`
   - 实现搜索功能
   - 添加通知系统
   - 创建用户菜单下拉框

4. **调整 WrapperLayout**
   - 打开 `src/layouts/wrapper/index.vue`
   - 微调面板尺寸
   - 调整响应式断点
   - 自定义颜色和主题

## 📝 重要提醒

1. **每个组件文件都有详细的注释**，标明了什么可以修改，什么不能修改
2. **查看 `EXTENDED_UI_README.md`** 获取完整的英文文档
3. **保持接口不变**，确保 wrapper 布局能正常工作
4. **只读访问 store**，通过 emit 事件来触发操作

## 🎯 核心原则

### ✅ 可以做的：
- 在中央画布区添加任何自定义功能
- 修改所有新增组件的样式和内容
- 读取现有 store 中的数据
- 通过 emit 事件触发操作

### ⛔ 不能做的：
- 修改原始 Escrcpy UI 的任何逻辑
- 直接修改 store 中的 actions/mutations
- 改变组件的 props/events 接口
- 删除或移动现有页面文件

## 💡 示例参考

参考 matrixui 项目的设计：
- 设备网格布局
- 实时视频流
- 玻璃态设计
- 渐变色主题

---

**祝开发顺利！ 🚀**

详细文档请查看 `EXTENDED_UI_README.md`
