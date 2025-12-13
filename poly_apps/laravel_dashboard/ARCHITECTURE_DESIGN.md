# Laravel Dashboard - 中心化架构设计方案

## 🎯 设计目标

1. **单一API中心** - 所有API调用通过统一服务
2. **数据模型分离** - 使用多个数据Model管理状态
3. **最小化代码** - 避免重复代码，最大化复用
4. **组件复用** - 构建通用组件库
5. **对齐后端** - 与后端API结构完全对齐

---

## 📐 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                          Views Layer                         │
│  (AITools, VocabularyLearning, CodeBrowser, etc.)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                    Universal Components                      │
│  (ToolWrapper, DataTable, FormBuilder, MediaPlayer, etc.)  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                    Data Models Layer                         │
│   (ToolModel, UserModel, APIModel, ConfigModel, etc.)      │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                 Centralized API Service                      │
│           (Single Entry Point for All APIs)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 第一层：中心化API服务

### 设计原则
- **单一职责**：每个API模块负责一个应用（AppQyV1, McpV1, etc.）
- **统一接口**：所有API调用返回统一格式
- **自动重试**：网络错误自动重试
- **缓存机制**：自动缓存GET请求
- **错误处理**：统一错误处理和日志

### 文件结构
```
services/
├── api/
│   ├── core/
│   │   ├── BaseAPI.ts          # 基础API类
│   │   ├── APIConfig.ts        # API配置
│   │   └── APIInterceptor.ts   # 拦截器
│   ├── modules/
│   │   ├── AppQyV1API.ts       # AppQyV1模块
│   │   ├── McpV1API.ts         # McpV1模块
│   │   ├── ItToolsV1API.ts     # ItToolsV1模块
│   │   └── ServerManagerV1API.ts
│   └── index.ts                # 统一导出
└── apiService.ts (DEPRECATED)  # 旧文件，待删除
```

### BaseAPI实现示例
```typescript
class BaseAPI {
  constructor(baseURL: string, config: APIConfig) {}
  
  async get<T>(url: string, params?: any): Promise<APIResponse<T>>
  async post<T>(url: string, data?: any): Promise<APIResponse<T>>
  async put<T>(url: string, data?: any): Promise<APIResponse<T>>
  async delete<T>(url: string): Promise<APIResponse<T>>
  
  // 自动缓存
  async getCached<T>(url: string, ttl?: number): Promise<APIResponse<T>>
  
  // 批量请求
  async batch<T>(requests: APIRequest[]): Promise<APIResponse<T>[]>
}
```

---

## 📊 第二层：数据模型层

### 设计原则
- **状态隔离**：每个模型管理自己的状态
- **Observable**：支持订阅状态变化
- **持久化**：自动同步到localStorage
- **验证**：数据验证和类型检查

### 核心模型

#### 1. ToolModel - 工具模型
```typescript
interface ToolModel {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  component: React.ComponentType;
  config: ToolConfig;
  
  // 方法
  execute(input: any): Promise<any>;
  validate(input: any): ValidationResult;
  getHistory(): ToolHistory[];
}
```

#### 2. UserModel - 用户模型
```typescript
interface UserModel {
  id: string;
  username: string;
  email: string;
  preferences: UserPreferences;
  
  // 方法
  login(credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
  updatePreferences(prefs: Partial<UserPreferences>): void;
}
```

#### 3. APIConfigModel - API配置模型
```typescript
interface APIConfigModel {
  baseURL: string;
  apiKey?: string;
  headers: Record<string, string>;
  timeout: number;
  
  // 方法
  setHeader(key: string, value: string): void;
  getHeader(key: string): string | undefined;
  resetHeaders(): void;
}
```

#### 4. CacheModel - 缓存模型
```typescript
interface CacheModel {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttl?: number): void;
  clear(key?: string): void;
  has(key: string): boolean;
}
```

---

## 🧩 第三层：通用组件库

### 设计原则
- **可组合**：组件可自由组合
- **可配置**：通过props控制行为
- **可扩展**：支持自定义渲染
- **响应式**：自动适配不同屏幕

### 核心组件

#### 1. ToolWrapper - 工具包装器
```typescript
<ToolWrapper
  title="Translation Tool"
  icon={<Languages />}
  gradient="blue-purple"
  history={true}
  favorites={true}
>
  <TranslationPanelContent />
</ToolWrapper>
```

#### 2. DataTable - 数据表格
```typescript
<DataTable
  columns={columns}
  data={data}
  pagination={true}
  search={true}
  sort={true}
  actions={rowActions}
/>
```

#### 3. FormBuilder - 表单构建器
```typescript
<FormBuilder
  schema={formSchema}
  onSubmit={handleSubmit}
  validation={validationRules}
/>
```

#### 4. MediaPlayer - 媒体播放器
```typescript
<MediaPlayer
  type="video|audio|image"
  src={url}
  controls={true}
  playlist={items}
  onNext={handleNext}
/>
```

#### 5. CodeEditor - 代码编辑器
```typescript
<CodeEditor
  language="typescript"
  value={code}
  onChange={setCode}
  theme="dark"
  lineNumbers={true}
/>
```

---

## 🏗️ 第四层：视图层

### 设计原则
- **轻量化**：视图层只负责UI展示
- **数据驱动**：所有状态来自Model
- **组件组合**：使用通用组件组装

### 示例：AI Tools重构

#### 重构前（堆代码）
```typescript
// 每个工具都是独立的500行组件
TranslationPanel.tsx - 370 lines
TTSPanel.tsx - 458 lines
OCRPanel.tsx - 514 lines
PromptManager.tsx - 501 lines
Total: ~2000 lines
```

#### 重构后（中心化）
```typescript
// 1. 工具配置（100 lines）
const AI_TOOLS_CONFIG = {
  translation: {
    id: 'translation',
    api: 'AppQyV1.translate',
    schema: TranslationSchema,
    component: TranslationForm
  },
  // ...
};

// 2. 通用工具组件（200 lines）
const UniversalTool = ({ config }) => {
  const model = useToolModel(config);
  return <ToolWrapper {...config}>
    <config.component model={model} />
  </ToolWrapper>;
};

// 3. 具体表单（每个50-100 lines）
TranslationForm.tsx - 80 lines
TTSForm.tsx - 90 lines
OCRForm.tsx - 85 lines
PromptForm.tsx - 95 lines

Total: ~550 lines (减少73%)
```

---

## 📁 新的文件结构

```
poly_apps/laravel_dashboard/
├── core/
│   ├── api/                   # 中心化API
│   │   ├── base/
│   │   │   ├── BaseAPI.ts
│   │   │   ├── APIConfig.ts
│   │   │   └── APICache.ts
│   │   ├── modules/
│   │   │   ├── AppQyV1.ts
│   │   │   ├── McpV1.ts
│   │   │   └── ItToolsV1.ts
│   │   └── index.ts
│   ├── models/                # 数据模型
│   │   ├── ToolModel.ts
│   │   ├── UserModel.ts
│   │   ├── ConfigModel.ts
│   │   └── index.ts
│   └── utils/                 # 工具函数
│       ├── validation.ts
│       ├── storage.ts
│       └── helpers.ts
├── components/
│   ├── universal/             # 通用组件
│   │   ├── ToolWrapper.tsx
│   │   ├── DataTable.tsx
│   │   ├── FormBuilder.tsx
│   │   ├── MediaPlayer.tsx
│   │   └── index.ts
│   ├── forms/                 # 表单组件（最小化）
│   │   ├── TranslationForm.tsx
│   │   ├── TTSForm.tsx
│   │   └── OCRForm.tsx
│   └── views/                 # 视图组件
│       ├── AITools.tsx
│       ├── VocabularyLearning.tsx
│       └── ...
├── config/
│   ├── tools.config.ts        # 工具配置
│   ├── api.config.ts          # API配置
│   └── app.config.ts          # 应用配置
└── types/
    ├── api.types.ts
    ├── tool.types.ts
    └── index.ts
```

---

## 🔄 迁移策略

### Phase 1: API中心化（Week 1）
1. 创建BaseAPI和API模块
2. 迁移现有apiService到新结构
3. 保留旧API作为兼容层

### Phase 2: 模型层实现（Week 1-2）
1. 创建核心数据模型
2. 实现状态管理
3. 添加持久化支持

### Phase 3: 组件库构建（Week 2-3）
1. 提取通用组件
2. 创建ToolWrapper框架
3. 构建FormBuilder

### Phase 4: 视图重构（Week 3-4）
1. 重构AI Tools
2. 重构VocabularyLearning
3. 重构其他模块

---

## 📊 预期收益

### 代码减少
- AI Tools: 2000 lines → 550 lines (73% ↓)
- VocabularyLearning: 1500 lines → 400 lines (73% ↓)
- DevTools: 750 lines → 200 lines (73% ↓)
- **总计**: ~5000 lines → ~1500 lines (70% ↓)

### 维护性提升
- 单点修改，全局生效
- 类型安全，减少错误
- 统一模式，易于理解

### 性能优化
- 请求合并和缓存
- 懒加载组件
- 减少bundle大小

---

**设计完成日期**: December 13, 2025  
**版本**: 3.0.0-rc1  
**状态**: Ready for Implementation
