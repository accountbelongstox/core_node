# Pycore Management 实现检查清单

## ✅ 已完成的核心功能

### 1. 统一中心化 API 客户端
- [x] `services/endpoints.ts` - 端点配置中心
- [x] `services/api-client.ts` - 统一 API 客户端
- [x] `services/error-handler.ts` - 错误处理模块
- [x] `services/interceptors.ts` - 请求/响应拦截器
- [x] `services/api.ts` - 重构后的 API 服务层

### 2. 数据中心化
- [x] `contexts/DataContext.tsx` - 全局数据上下文
- [x] `App.tsx` - 集成 DataProvider

### 3. 配置文件
- [x] `vite.config.ts` - 添加 API 代理配置
- [x] `vite-env.d.ts` - TypeScript 环境变量类型定义
- [x] `.env.example` - 环境变量示例文件

### 4. 类型安全
- [x] 所有 API 调用都有完整的 TypeScript 类型
- [x] 环境变量类型定义完整

## 📋 使用说明

### 环境变量配置

创建 `.env.local` 文件（参考 `.env.example`）：

```bash
# API 配置
VITE_API_BASE_URL=http://localhost:59000

# Mock 模式配置
VITE_USE_MOCK=true
VITE_FALLBACK_TO_MOCK=true
```

### API 调用方式

#### 方式 1: 直接使用 API 服务（推荐用于工具类操作）

```typescript
import { api } from '../services/api';

// 调用 API
const overview = await api.dashboard.getOverview();
const metrics = await api.dashboard.getRealtimeMetrics(15);
```

#### 方式 2: 使用数据中心（推荐用于页面数据）

```typescript
import { useData } from '../contexts/DataContext';

const MyComponent = () => {
  const { 
    dashboardOverview, 
    refreshDashboard, 
    isLoading 
  } = useData();
  
  useEffect(() => {
    refreshDashboard();
  }, []);
  
  if (isLoading('dashboard')) {
    return <Loading />;
  }
  
  // 使用 dashboardOverview...
};
```

### Mock 模式切换

1. **完全使用 Mock**: 设置 `VITE_USE_MOCK=true`
2. **真实 API + 自动回退**: 设置 `VITE_USE_MOCK=false` 和 `VITE_FALLBACK_TO_MOCK=true`
3. **仅真实 API**: 设置 `VITE_USE_MOCK=false` 和 `VITE_FALLBACK_TO_MOCK=false`

## 🔍 检查项

### 代码质量
- [x] 无 TypeScript 编译错误
- [x] 无 Linter 错误
- [x] 所有导入路径正确
- [x] 类型定义完整

### 功能完整性
- [x] 所有 API 端点已配置
- [x] 错误处理完整
- [x] Mock 模式支持
- [x] 自动回退机制
- [x] 请求拦截器
- [x] 响应拦截器
- [x] 数据中心化实现

### 配置完整性
- [x] Vite 配置已更新
- [x] 环境变量类型定义
- [x] API 代理配置
- [x] 环境变量示例文件

## 📝 注意事项

1. **环境变量**: 确保创建 `.env.local` 文件并配置正确的 API 地址
2. **Mock 模式**: 开发时可以使用 Mock 模式，生产环境应使用真实 API
3. **数据中心**: 页面组件可以选择使用 DataContext 或直接调用 API
4. **错误处理**: 所有 API 错误都会自动处理，可以通过 `useData().getError()` 获取错误信息

## 🚀 下一步

1. 根据实际后端 API 调整端点路径（`services/endpoints.ts`）
2. 根据实际需求调整自动刷新间隔（`App.tsx` 中的 `autoRefreshInterval`）
3. 添加认证拦截器（如需要）
4. 添加请求缓存机制（如需要）

