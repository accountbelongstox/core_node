# Laravel Dashboard 实施路线图

## 项目目标

将 `poly_apps/laravel_dashboard` React 应用扩展到与 `poly_apps/laravel_main` 的 HTTP 首页功能对齐。

---

## 阶段 1: 基础模块扩展 (P0 - 高优先级)

### 1.1 System Information 模块

**工作量**: 1-2 天

**任务清单**:
- [ ] 创建 `components/views/SystemInfo.tsx`
- [ ] 创建 `services/systemService.ts`
- [ ] 添加 API 端点到 `endpoints.ts`
- [ ] 更新 `types.ts` 添加 `SYSTEM_INFO` ViewType
- [ ] 更新 `Sidebar.tsx` 添加导航项
- [ ] 更新 `constants.tsx` 添加翻译文本
- [ ] 在 `App.tsx` 的 `renderView()` 中集成

**API 集成**:
```typescript
GET /api_info
```

**组件特性**:
- JSON 可视化展示
- 实时数据刷新
- 系统状态指示器

---

### 1.2 MCP Manager 模块

**工作量**: 3-5 天

**任务清单**:
- [ ] 创建 `components/views/MCPManager.tsx`
- [ ] 创建子组件:
  - [ ] `components/mcp/ScreenshotManager.tsx`
  - [ ] `components/mcp/TaskDispatch.tsx`
  - [ ] `components/mcp/PlaceholderGenerator.tsx`
  - [ ] `components/mcp/PromptMappings.tsx`
- [ ] 创建 `services/mcpService.ts`
- [ ] 添加所有 MCP API 端点到 `endpoints.ts`
- [ ] 更新类型定义
- [ ] 集成到主应用

**API 集成**:
```typescript
POST   /api/mcp/v1/screenshots/upload
POST   /api/mcp/v1/screenshots/upload-merge
POST   /api/mcp/v1/screenshots/upload-batch
GET    /api/mcp/v1/screenshots/latest
GET    /api/mcp/v1/screenshots/
GET    /api/mcp/v1/screenshots/{id}
DELETE /api/mcp/v1/screenshots/{id}

GET    /api/mcp/v1/task-dispatch/categories
POST   /api/mcp/v1/task-dispatch/queue/add-file
GET    /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks
PUT    /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status

POST   /api/mcp/v1/placeholders/generate
GET    /api/mcp/v1/placeholders/
DELETE /api/mcp/v1/placeholders/{uuid}
```

**组件特性**:
- 截图上传（单个/批量/合并）
- 截图预览与删除
- 任务分发队列管理
- 占位图生成器
- 提示词映射配置

---

## 阶段 2: 监控与学习模块 (P1 - 中优先级)

### 2.1 Octane Timer Tasks 模块

**工作量**: 2-3 天

**任务清单**:
- [ ] 创建 `components/views/OctaneTasks.tsx`
- [ ] 创建 `services/octaneService.ts`
- [ ] 添加 Octane API 端点
- [ ] 实现实时状态监控
- [ ] 实现任务列表展示
- [ ] 添加刷新功能

**API 集成**:
```typescript
GET /octane-tasks/status
GET /octane-tasks/task/{taskName}
GET /octane-tasks/basic
GET /octane-tasks/verify
```

**组件特性**:
- 统计卡片（Timer Status, Total Tasks, Running Tasks, Total Ticks）
- Heartbeat 状态显示
- 任务列表实时更新
- 手动刷新按钮

---

### 2.2 Vocabulary Learning 模块

**工作量**: 3-4 天

**任务清单**:
- [ ] 创建 `components/views/VocabularyLearning.tsx`
- [ ] 创建子组件:
  - [ ] `components/vocabulary/TranslationPanel.tsx`
  - [ ] `components/vocabulary/TTSPlayer.tsx`
  - [ ] `components/vocabulary/LearningTaskList.tsx`
- [ ] 创建 `services/vocabularyService.ts`
- [ ] 添加 Translation & TTS API 端点
- [ ] 实现音频播放功能

**API 集成**:
```typescript
POST /translation/translate
POST /translation/batch
POST /translation/detect
POST /translation/learning
GET  /translation/languages
GET  /translation/templates
POST /tts/generate
POST /tts/batch-generate
GET  /tts/audio/{language}/{type}/{filename}
GET  /tts/voices
```

**组件特性**:
- 翻译输入/输出面板
- 批量翻译
- TTS 音频生成与播放
- 学习任务管理
- 语言选择器

---

## 阶段 3: Development Tools 增强 (P2 - 低优先级)

### 3.1 工具收藏系统

**工作量**: 1-2 天

**任务清单**:
- [ ] 在 `ToolsDashboard.tsx` 中添加收藏状态管理
- [ ] 使用 localStorage 持久化收藏列表
- [ ] 添加收藏/取消收藏按钮
- [ ] 实现收藏工具快速访问视图
- [ ] 添加收藏工具排序

**实现方式**:
```typescript
const [favorites, setFavorites] = useState<string[]>(() => {
  const saved = localStorage.getItem('tool_favorites');
  return saved ? JSON.parse(saved) : [];
});
```

---

### 3.2 历史记录系统

**工作量**: 1-2 天

**任务清单**:
- [ ] 在 `ToolsDashboard.tsx` 中添加历史记录状态
- [ ] 使用 localStorage 存储最近使用工具
- [ ] 实现历史记录面板
- [ ] 添加历史记录清除功能
- [ ] 限制历史记录数量（如最近 20 个）

---

### 3.3 完整工具集成

**工作量**: 5-7 天

**任务清单**:
- [ ] 从 Laravel Main 的 JavaScript 文件提取工具配置
- [ ] 将 100+ IT 工具迁移到 `constants.tsx`
- [ ] 为每个工具实现 UI 和逻辑
- [ ] 按批次实现（batch1a ~ batch15）
- [ ] 测试所有工具功能

**工具类别**:
- Text Tools (文本工具)
- Crypto Tools (加密工具)
- Formatters (格式化器)
- Converters (转换器)
- Generators (生成器)
- Web Tools (Web 工具)
- Image Tools (图片工具)
- Math Tools (数学工具)
- Network Tools (网络工具)

---

### 3.4 字典统计集成

**工作量**: 1 天

**任务清单**:
- [ ] 创建字典统计 API 服务
- [ ] 在 `ToolsDashboard.tsx` 底部显示统计信息
- [ ] 实现统计数据刷新

---

## 阶段 4: Clipboard 功能集成 (可选)

### 4.1 Clipboard Manager

**工作量**: 2-3 天

**任务清单**:
- [ ] 创建 `components/tools/ClipboardManager.tsx`
- [ ] 集成 Clipboard API
- [ ] 实现文本保存/读取
- [ ] 实现文件上传/下载
- [ ] 实现历史记录恢复

**API 集成**:
```typescript
GET  /clipboard/namespace
POST /clipboard/text
GET  /clipboard/data
POST /clipboard/upload
GET  /clipboard/download
POST /clipboard/delete-file
POST /clipboard/new
POST /clipboard/restore
```

---

## 技术债务与优化

### 代码质量
- [ ] 抽取共用组件（如 LoadingSpinner, ErrorBoundary）
- [ ] 统一错误处理机制
- [ ] 添加 TypeScript 严格模式
- [ ] 编写单元测试

### 性能优化
- [ ] 实现虚拟滚动（长列表）
- [ ] 图片懒加载
- [ ] API 请求防抖/节流
- [ ] 缓存策略优化

### 用户体验
- [ ] 添加加载骨架屏
- [ ] 优化错误提示
- [ ] 实现离线模式提示
- [ ] 添加键盘快捷键

---

## 文件结构预览

```
poly_apps/laravel_dashboard/
├── components/
│   ├── views/
│   │   ├── MediaBrowser.tsx        (已存在)
│   │   ├── CodeBrowser.tsx         (已存在)
│   │   ├── ToolsDashboard.tsx      (已存在)
│   │   ├── ApiTester.tsx           (已存在)
│   │   ├── SystemInfo.tsx          ⬅️ 新增
│   │   ├── VocabularyLearning.tsx  ⬅️ 新增
│   │   ├── MCPManager.tsx          ⬅️ 新增
│   │   └── OctaneTasks.tsx         ⬅️ 新增
│   ├── mcp/
│   │   ├── ScreenshotManager.tsx   ⬅️ 新增
│   │   ├── TaskDispatch.tsx        ⬅️ 新增
│   │   ├── PlaceholderGenerator.tsx⬅️ 新增
│   │   └── PromptMappings.tsx      ⬅️ 新增
│   ├── vocabulary/
│   │   ├── TranslationPanel.tsx    ⬅️ 新增
│   │   ├── TTSPlayer.tsx           ⬅️ 新增
│   │   └── LearningTaskList.tsx    ⬅️ 新增
│   ├── tools/
│   │   ├── ToolWorkspace.tsx       (已存在)
│   │   ├── UniversalTool.tsx       (已存在)
│   │   └── ClipboardManager.tsx    ⬅️ 新增
│   ├── shared/
│   │   ├── LoadingSpinner.tsx      ⬅️ 新增
│   │   ├── ErrorBoundary.tsx       ⬅️ 新增
│   │   └── JsonViewer.tsx          ⬅️ 新增
│   ├── Sidebar.tsx                 (需更新)
│   ├── LoginModal.tsx              (已存在)
│   └── BentoCard.tsx               (已存在)
├── services/
│   ├── api.ts                      (已存在)
│   ├── systemService.ts            ⬅️ 新增
│   ├── vocabularyService.ts        ⬅️ 新增
│   ├── mcpService.ts               ⬅️ 新增
│   └── octaneService.ts            ⬅️ 新增
├── utils/
│   ├── formatters.ts               (已存在?)
│   ├── validators.ts               ⬅️ 新增
│   └── cache.ts                    ⬅️ 新增
├── types.ts                        (需更新)
├── constants.tsx                   (需更新)
├── endpoints.ts                    (需更新)
├── App.tsx                         (需更新)
├── MISSING_FEATURES_ANALYSIS.md    ✅ 已创建
└── IMPLEMENTATION_ROADMAP.md       ✅ 当前文档
```

---

## 时间估算

| 阶段 | 模块 | 工作量 | 优先级 |
|------|------|--------|--------|
| 1.1 | System Information | 1-2 天 | P0 |
| 1.2 | MCP Manager | 3-5 天 | P0 |
| 2.1 | Octane Tasks | 2-3 天 | P1 |
| 2.2 | Vocabulary Learning | 3-4 天 | P1 |
| 3.1 | 工具收藏系统 | 1-2 天 | P2 |
| 3.2 | 历史记录系统 | 1-2 天 | P2 |
| 3.3 | 完整工具集成 | 5-7 天 | P2 |
| 3.4 | 字典统计 | 1 天 | P2 |
| 4.1 | Clipboard Manager | 2-3 天 | 可选 |

**总计**: 20-30 天（按单人全职开发计算）

---

## 开始建议

### 第一步: System Information (最简单)
1. 创建基础组件框架
2. 集成单个 API
3. 实现 JSON 展示
4. 验证数据流

### 第二步: MCP Manager (最重要)
1. 先实现 Screenshot Manager
2. 再实现 Task Dispatch
3. 最后实现 Placeholder Generator
4. 分步测试各个子模块

### 第三步: 其他模块按优先级递进

---

## 测试策略

### 单元测试
- 使用 Vitest/Jest
- 覆盖所有 Service 层
- 覆盖关键组件逻辑

### 集成测试
- API 请求测试
- 组件交互测试

### E2E 测试
- Playwright/Cypress
- 关键用户流程测试

---

## 部署与发布

### 开发环境
```bash
cd poly_apps/laravel_dashboard
npm install
npm run dev
```

### 生产构建
```bash
npm run build
npm run preview
```

### 集成到 Laravel Main
- 构建输出到 `public/dashboard/`
- 配置路由指向 React 应用
- 确保 API 代理正确配置

---

## 维护与迭代

### 定期检查
- 依赖包更新
- 安全漏洞修复
- 性能监控

### 功能增强
- 用户反馈收集
- 新工具添加
- UI/UX 优化

---

**开始日期**: 待定
**预计完成**: 待定
**负责人**: 待定
