# API 配置管理中心化实现

## 概述

实现了中心化的 API 配置管理系统，允许用户在系统设置中修改 API 基础 URL 和 API Key，配置会自动保存到 localStorage 并同步到所有 API 调用。

---

## 架构设计

### 1. 中心化状态管理 (`contexts/ApiConfigContext.tsx`)

使用 React Context API 实现中心化的配置管理：

```typescript
interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
}

interface ApiConfigContextType {
  config: ApiConfig;
  updateConfig: (newConfig: Partial<ApiConfig>) => void;
  resetConfig: () => void;
}
```

**功能特性**:
- ✅ 默认配置：从环境变量或默认值加载
- ✅ localStorage 持久化：配置自动保存到 `dashboard_api_config`
- ✅ 自动同步：配置变化时自动保存到 localStorage
- ✅ 重置功能：一键重置为默认配置

---

### 2. API 服务更新 (`services/apiService.ts`)

更新 `ApiService` 类支持动态配置：

```typescript
class ApiService {
  private baseUrl: string = DEFAULT_BASE_URL;
  private apiKey: string | undefined = undefined;

  // 动态更新配置
  public setConfig(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  // 获取当前配置
  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
```

**更新内容**:
- ✅ 所有 API 请求使用 `this.baseUrl` 而非硬编码 URL
- ✅ 自动添加 `X-API-Key` 请求头（如果配置了 API Key）
- ✅ `downloadFile` 方法也使用动态配置

---

### 3. 设置页面 (`components/views/Settings.tsx`)

完整的设置界面，包含：

**功能**:
- ✅ Base URL 输入框（可修改）
- ✅ API Key 输入框（可选，密码类型）
- ✅ 保存按钮（更新配置并同步到 apiService）
- ✅ 重置按钮（恢复默认配置）
- ✅ 测试连接按钮（验证 API 是否可访问）
- ✅ 当前配置显示（只读，显示实际使用的配置）
- ✅ 状态提示（保存成功/失败、连接测试结果）

**UI 特性**:
- 响应式设计
- 暗色模式支持
- 实时状态反馈
- 操作确认对话框

---

### 4. 应用集成 (`App.tsx`)

在应用根组件集成配置管理：

```typescript
// 主组件（提供 Context）
const App: React.FC = () => {
  return (
    <ApiConfigProvider>
      <AppContent />
    </ApiConfigProvider>
  );
};

// 内部组件（使用 Context）
const AppContent: React.FC = () => {
  const { config } = useApiConfig();
  
  // 同步配置到 apiService
  useEffect(() => {
    apiService.setConfig(config.baseUrl, config.apiKey);
  }, [config]);
  
  // ... 其他代码
};
```

**集成点**:
- ✅ `ApiConfigProvider` 包裹整个应用
- ✅ `AppContent` 使用 `useApiConfig` hook
- ✅ 配置变化时自动同步到 `apiService`
- ✅ Settings 视图已集成到路由

---

## 配置流程

### 初始化流程

1. **应用启动**
   - `ApiConfigProvider` 初始化
   - 尝试从 localStorage 加载配置
   - 如果不存在，使用默认配置（环境变量或 `https://api.nexus-orbit.io`）
   - 配置保存到 localStorage

2. **配置同步**
   - `AppContent` 组件挂载
   - `useEffect` 触发，调用 `apiService.setConfig()`
   - 所有后续 API 请求使用新配置

### 用户修改配置流程

1. **打开设置页面**
   - 用户点击侧边栏 Settings 图标
   - Settings 组件加载，显示当前配置

2. **修改配置**
   - 用户修改 Base URL 或 API Key
   - 点击"保存"按钮

3. **保存配置**
   - `handleSave()` 调用 `updateConfig()`
   - Context 状态更新
   - localStorage 自动保存（通过 useEffect）
   - `AppContent` 的 useEffect 检测到配置变化
   - 自动调用 `apiService.setConfig()` 同步配置

4. **测试连接**（可选）
   - 用户点击"测试连接"按钮
   - 发送请求到配置的 Base URL
   - 显示连接结果（成功/失败）

---

## 默认配置

### 默认 Base URL

优先级顺序：
1. `localStorage` 中保存的配置
2. 环境变量 `VITE_API_BASE_URL`
3. 默认值：`https://api.nexus-orbit.io`

### 默认 API Key

优先级顺序：
1. `localStorage` 中保存的配置
2. 环境变量 `VITE_API_KEY`
3. `undefined`（不使用 API Key）

---

## 数据持久化

### localStorage 存储格式

```json
{
  "baseUrl": "https://api.nexus-orbit.io",
  "apiKey": "your-api-key-here"
}
```

**存储键**: `dashboard_api_config`

**存储时机**:
- 配置初始化时（如果存在）
- 配置更新时（自动保存）
- 重置配置时（删除存储）

---

## 使用示例

### 在组件中使用配置

```typescript
import { useApiConfig } from '../contexts/ApiConfigContext';

const MyComponent: React.FC = () => {
  const { config } = useApiConfig();
  
  // 访问当前配置
  console.log('Current API URL:', config.baseUrl);
  console.log('Has API Key:', !!config.apiKey);
  
  // 更新配置
  const { updateConfig } = useApiConfig();
  updateConfig({ baseUrl: 'https://new-api.example.com' });
  
  return <div>...</div>;
};
```

### 在 API 服务中使用

```typescript
// apiService 会自动使用最新配置
const response = await apiService.getSystemInfo();
// 请求会发送到 config.baseUrl + '/api/servermanager/v1/system/info'
```

---

## 多语言支持

### 英文翻译

```typescript
settings: {
  title: "Settings",
  api_config: "API Configuration",
  base_url: "Base URL",
  api_key: "API Key",
  save: "Save",
  reset: "Reset to Default",
  test_connection: "Test Connection",
  // ...
}
```

### 中文翻译

```typescript
settings: {
  title: "系统设置",
  api_config: "API 配置",
  base_url: "基础 URL",
  api_key: "API 密钥",
  save: "保存",
  reset: "重置为默认",
  test_connection: "测试连接",
  // ...
}
```

---

## 技术实现细节

### 1. Context 初始化

```typescript
const [config, setConfig] = useState<ApiConfig>(() => {
  // 从 localStorage 加载
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  // 使用默认配置
  return DEFAULT_CONFIG;
});
```

### 2. 自动保存

```typescript
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}, [config]);
```

### 3. 配置同步

```typescript
// App.tsx
useEffect(() => {
  apiService.setConfig(config.baseUrl, config.apiKey);
}, [config]);
```

### 4. API 请求头

```typescript
const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

if (this.apiKey) {
  headers['X-API-Key'] = this.apiKey;
}
```

---

## 文件清单

### 新增文件

1. ✅ `contexts/ApiConfigContext.tsx` - 配置管理 Context
2. ✅ `components/views/Settings.tsx` - 设置页面组件

### 修改文件

1. ✅ `App.tsx` - 集成 ApiConfigProvider 和 Settings 视图
2. ✅ `services/apiService.ts` - 支持动态配置
3. ✅ `constants.tsx` - 添加 Settings 翻译
4. ✅ `components/Sidebar.tsx` - Settings 导航已存在

---

## 功能验证

### ✅ 已完成的功能

1. **配置管理**
   - ✅ 默认配置加载
   - ✅ localStorage 持久化
   - ✅ 配置更新
   - ✅ 配置重置

2. **UI 功能**
   - ✅ 设置页面
   - ✅ 配置输入
   - ✅ 保存/重置按钮
   - ✅ 连接测试
   - ✅ 状态提示

3. **API 集成**
   - ✅ 动态 Base URL
   - ✅ 动态 API Key
   - ✅ 自动同步
   - ✅ 所有请求使用新配置

4. **用户体验**
   - ✅ 多语言支持
   - ✅ 暗色模式
   - ✅ 实时反馈
   - ✅ 操作确认

---

## 使用说明

### 修改 API 配置

1. 点击侧边栏的 **Settings** 图标
2. 在 **API Configuration** 部分：
   - 修改 **Base URL**（例如：`https://api.example.com`）
   - 可选：输入 **API Key**
3. 点击 **Save** 保存配置
4. 可选：点击 **Test Connection** 测试连接
5. 配置会自动保存到 localStorage 并应用到所有 API 请求

### 重置配置

1. 在 Settings 页面点击 **Reset to Default**
2. 确认重置操作
3. 配置将恢复为默认值（环境变量或 `https://api.nexus-orbit.io`）

---

## 技术优势

1. **中心化管理** - 单一数据源，避免配置分散
2. **自动同步** - 配置变化自动应用到所有 API 调用
3. **持久化** - localStorage 保存，刷新后配置不丢失
4. **类型安全** - TypeScript 类型定义完整
5. **易于扩展** - Context 模式便于添加新配置项

---

## 总结

✅ **API 配置管理中心化实现完成**

- 默认 API 为源站（`https://api.nexus-orbit.io`）
- 可在系统设置中修改 API 配置
- 配置自动保存到 localStorage
- React Context 管理状态
- 所有 API 调用自动使用最新配置
- 完整的 UI 和用户体验

所有功能已实现并通过 lint 检查。

