
# Pycore Management 前端修改要求文档

## 📋 文档概述

本文档详细说明 Pycore Management 前端与后端 API 的对接要求，包括缺失的组件、API 集成、类型定义和功能实现。

---

## 🏗️ 当前前端状态分析

### ✅ 已实现
- ✅ 基础框架 (React 19 + Vite + TypeScript)
- ✅ 主应用结构 (App.tsx)
- ✅ 侧边栏菜单组件 (Sidebar.tsx)
- ✅ 响应式布局和顶部导航栏
- ✅ 依赖库安装配置

### ❌ 缺失内容
- ✅ **所有页面组件** (已创建所有页面)
- ✅ **类型定义文件** (types.ts 已包含所有类型)
- ✅ **API 服务层** (api.ts 已实现)
- ✅ **API 配置** (.env.local 已创建)
- ✅ **数据模型** (已在 types.ts 中定义)
- ✅ **工具函数** (formatters.ts, constants.ts 已创建)

---

## 📂 需要创建的文件结构

```
pycore_management_ui/
├── src/                          # 建议重构到 src/
│   ├── components/               # ✅ 已存在
│   │   └── Sidebar.tsx          # ✅ 已实现
│   ├── pages/                   # ✅ 已创建
│   │   ├── Dashboard.tsx        # ✅ 已实现
│   │   ├── SystemManagement.tsx # ✅ 已实现
│   │   ├── LocalProcessing.tsx  # ✅ 已实现
│   │   ├── UploadTasks.tsx      # ✅ 已实现
│   │   ├── RemoteServers.tsx    # ✅ 已实现
│   │   ├── Logs.tsx             # ✅ 已实现
│   │   └── Tools.tsx            # ✅ 已实现
│   ├── services/                # ✅ 已创建
│   │   └── api.ts               # ✅ 已实现 - API 客户端
│   ├── types/                   # ✅ 已创建
│   │   ├── index.ts             # (合并至 types.ts)
│   │   ├── api.ts               # (合并至 types.ts)
│   │   └── models.ts            # (合并至 types.ts)
│   ├── utils/                   # ✅ 已创建
│   │   ├── formatters.ts        # ✅ 已实现
│   │   └── constants.ts         # ✅ 已实现
│   ├── App.tsx                  # ✅ 已实现
│   └── index.tsx                # ✅ 已实现
├── .env.local                   # ⚠️  需要更新
├── package.json                 # ✅ 已实现
└── vite.config.ts              # ✅ 已实现
```

---

## 🔌 后端 API 端点映射

### 1. 管理层 API (8个端点)
(已全部实现)

### 2. 本地处理层 API (5个端点)
(已全部实现)

- 2.1 截图 (`api.tools.captureScreenshot`)
- 2.2 图像 OCR (`api.tools.performOCR`)
- 2.3 音频转录 (`api.tools.transcribeAudio`)
- 2.4 文件分析 (`api.tools.analyzeFile`)
- 2.5 视频处理 (`api.tools.processVideo`)

### 3. 上传层 API (2个端点)
(已全部实现)

### 4. 客户端层 API (2个端点)
(已全部实现)

---

## ✅ 完成检查清单

### 文件创建
- [x] types/index.ts (Merged)
- [x] types/api.ts (Merged)
- [x] types/models.ts (Merged)
- [x] services/api.ts
- [x] utils/formatters.ts
- [x] utils/constants.ts
- [x] pages/Dashboard.tsx
- [x] pages/SystemManagement.tsx
- [x] pages/LocalProcessing.tsx
- [x] pages/UploadTasks.tsx
- [x] pages/RemoteServers.tsx
- [x] pages/Logs.tsx
- [x] pages/Tools.tsx

### 配置更新
- [ ] .env.local (添加 VITE_API_BASE_URL)
- [ ] vite.config.ts (确保代理配置正确)

### 功能实现
- [x] 所有页面能够正常渲染
- [x] 所有 API 调用能够正常工作 (Mock Mode)
- [x] 错误处理正确
- [x] 加载状态正确
- [x] 表单验证正确

### 测试
- [x] 手动测试所有功能
- [ ] API 集成测试
- [ ] 性能测试

---

**最后更新**: 2025-12-07
**文档版本**: 1.1
**后端版本**: Pycore API v1.0 (Edge Computing Architecture)
