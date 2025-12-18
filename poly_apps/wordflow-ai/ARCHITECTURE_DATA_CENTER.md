# 数据中心化架构文档

## 概述

WordFlow AI 采用完全中心化的数据管理架构，确保数据流的统一性和一致性。

## 核心数据中心

### 1. UserDataCenter (用户数据中心)

**位置**: `/services/UserDataCenter.ts`

**职责**:
- 统一处理所有用户数据
- 标准化头像 URL 构建逻辑
- 用户数据验证和修复
- 提供用户数据工具方法

**核心方法**:

```typescript
// 处理和标准化用户数据
processUserData(user): User

// 获取格式化的头像 URL
getAvatarUrl(user): string

// 验证用户数据完整性
validateUserData(user): { valid: boolean; issues: string[] }

// 合并用户数据更新
mergeUserData(existingUser, updates): User

// 获取显示名称
getDisplayName(user): string

// 调试用户数据
debugUserData(user, source): void
```

**头像 URL 构建优先级**:
1. `avatar_url` 字段（如果是完整 HTTP URL）
2. `avatar` 字段（构建完整 URL）
   - 格式: `avatars/appqyv1/filename.png` → `http://xxx/api/files/avatars/appqyv1/filename.png`
3. 默认头像（基于用户名生成）
   - 使用 UI Avatars API 生成

### 2. StorageCenter (存储中心)

**位置**: `/services/StorageCenter.ts`

**职责**:
- 统一管理 localStorage 操作
- 集成 UserDataCenter 进行数据处理
- 提供类型安全的存储接口
- 自动数据序列化和反序列化

**数据持久化流程**:

```typescript
// 存储用户时自动处理
auth.setUser(user) {
  // 1. 通过 UserDataCenter 处理用户数据
  const processedUser = UserDataCenter.processUserData(user);

  // 2. 存储到 localStorage
  localStorage.setItem('user_data', JSON.stringify(processedUser));
}

// 读取用户时自动重新处理
auth.getUser() {
  // 1. 从 localStorage 读取
  const user = JSON.parse(localStorage.getItem('user_data'));

  // 2. 重新通过 UserDataCenter 处理
  // 这确保 avatar_url 在 API 地址变化后仍然正确
  return UserDataCenter.processUserData(user);
}
```

**关键特性**:
- ✅ 存储时处理数据
- ✅ 读取时重新处理数据
- ✅ 自动适应 API 地址变化
- ✅ 完整的日志记录

### 3. ApiCenter (API 中心)

**位置**: `/services/ApiCenter.ts`

**职责**:
- 统一管理所有 API 调用
- 集成 UserDataCenter 处理用户数据
- 统一错误处理
- 自动 token 管理

**用户数据流**:

```typescript
// 登录流程
auth.login(credentials) {
  // 1. 调用后端 API
  const response = await request('/login', { ... });

  // 2. 提取用户数据
  let user = response.data.user;

  // 3. 通过 UserDataCenter 处理
  user = UserDataCenter.processUserData(user);

  // 4. 存储到 StorageCenter（会再次处理）
  StorageCenter.auth.setUser(user);

  return { user, token };
}
```

### 4. RouteCenter (路由中心)

**位置**: `/router/RouteCenter.tsx`

**职责**:
- 集中管理所有路由配置
- 路由权限控制
- 路由分类和查询
- 沉浸式路由判断

**路由配置**:

```typescript
const ROUTE_REGISTRY: RouteConfig[] = [
  {
    path: '/profile_edit',
    element: <ProfileEditPage />,
    name: 'Edit Profile',
    category: 'user',
    isProtected: true,
    isImmersive: false,
  },
  // ... 更多路由
];
```

**路由管理方法**:

```typescript
RouteCenter.getAllRoutes()              // 获取所有路由
RouteCenter.getRoutesByCategory(cat)    // 按分类获取
RouteCenter.getRouteByPath(path)        // 根据路径获取
RouteCenter.isImmersiveRoute(path)      // 判断沉浸式
RouteCenter.isProtectedRoute(path)      // 判断需要登录
```

### 5. StateManager (状态管理中心)

**位置**: `/services/StateManager.ts`

**职责**:
- 运行时全局状态管理
- 提供订阅机制
- 状态变化通知

**使用方式**:

```typescript
// 设置状态
StateManager.set(GlobalState.USER, user);
StateManager.set(GlobalState.IS_LOGGED_IN, true);

// 获取状态
const user = StateManager.get(GlobalState.USER);

// 订阅状态变化
const unsubscribe = StateManager.subscribe(GlobalState.USER, (newUser) => {
  console.log('User changed:', newUser);
});
```

## 数据流向图

```
┌─────────────┐
│   Backend   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│    ApiCenter        │  ← 统一 API 调用
│  processUserData()  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  UserDataCenter     │  ← 数据标准化处理
│  - processUserData  │
│  - getAvatarUrl     │
│  - validate         │
└──────┬──────────────┘
       │
       ├───────────┬─────────────┐
       ▼           ▼             ▼
┌─────────────┐ ┌──────────┐ ┌──────────┐
│ Storage     │ │  State   │ │   UI     │
│ Center      │ │ Manager  │ │Components│
│(localStorage)│ │ (memory) │ │          │
└─────────────┘ └──────────┘ └──────────┘
```

## 刷新后数据恢复流程

### 问题场景
用户登录后头像显示正常，但刷新页面后头像丢失或显示错误。

### 根本原因
- 登录时：后端返回 `avatar: "avatars/appqyv1/xxx.png"` → 构建 `avatar_url`
- 刷新时：直接从 localStorage 读取 → 如果 `avatar_url` 未正确存储或 API 地址变化，就会出错

### 解决方案

**双重处理机制**:

1. **存储时处理** (`StorageCenter.auth.setUser`)
   ```typescript
   const processedUser = UserDataCenter.processUserData(user);
   localStorage.setItem('user_data', JSON.stringify(processedUser));
   ```

2. **读取时重新处理** (`StorageCenter.auth.getUser`)
   ```typescript
   const user = JSON.parse(localStorage.getItem('user_data'));
   return UserDataCenter.processUserData(user);  // 重新构建 avatar_url
   ```

**优势**:
- ✅ 即使 API 地址变化，头像仍能正确显示
- ✅ 数据始终保持最新状态
- ✅ 无需手动维护 avatar_url
- ✅ 统一的数据处理逻辑

## 最佳实践

### 1. 永远通过 UserDataCenter 处理用户数据

```typescript
// ❌ 错误做法
const user = response.data.user;
StorageCenter.auth.setUser(user);

// ✅ 正确做法
let user = response.data.user;
user = UserDataCenter.processUserData(user);
StorageCenter.auth.setUser(user);
```

### 2. 永远通过 StorageCenter 访问存储

```typescript
// ❌ 错误做法
const user = JSON.parse(localStorage.getItem('user_data'));

// ✅ 正确做法
const user = StorageCenter.auth.getUser();  // 自动处理
```

### 3. 使用 RouteCenter 管理路由

```typescript
// ❌ 错误做法
const isImmersive = ['/reading_run', '/quiz_run'].includes(path);

// ✅ 正确做法
const isImmersive = RouteCenter.isImmersiveRoute(path);
```

### 4. 调试用户数据

```typescript
// 使用 UserDataCenter 的调试功能
UserDataCenter.debugUserData(user, 'Login Flow');

// 输出:
// [UserDataCenter] Debug User Data (Login Flow)
//   Username: test_user
//   Avatar: avatars/appqyv1/avatar_1.png
//   Avatar URL: http://xxx/api/files/avatars/appqyv1/avatar_1.png
//   Validation: { valid: true, issues: [] }
```

## 配置管理

### 外部配置

**端口配置** (`.env`):
```
PORT=10028
GEMINI_API_KEY=
```

**vite.config.ts**:
```typescript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: parseInt(env.PORT),  // ✅ 从环境变量读取，无硬编码
      host: '0.0.0.0',
    },
    // ...
  };
});
```

## 架构优势

1. **统一性**: 所有数据处理逻辑集中在 UserDataCenter
2. **可靠性**: 双重处理机制确保数据始终正确
3. **可维护性**: 单一数据源，易于修改和调试
4. **可扩展性**: 易于添加新的数据处理逻辑
5. **类型安全**: TypeScript 提供完整类型检查
6. **日志完善**: 关键节点都有详细日志

## 问题排查

### 头像不显示

1. 检查日志：
   ```
   [StorageCenter] Storing user with processed avatar_url: xxx
   [StorageCenter] Loading user with re-processed avatar_url: xxx
   ```

2. 使用调试工具：
   ```typescript
   UserDataCenter.debugUserData(user, 'Problem');
   ```

3. 检查 avatar_url 格式：
   - 应该是完整的 HTTP URL
   - 应该包含正确的 API 地址
   - 应该包含正确的文件路径

### API 地址变化后数据异常

- ✅ **无需担心**：StorageCenter 读取时会自动重新构建 avatar_url
- ✅ 基于当前 `apiManager.getCurrentBaseUrl()` 重新生成

### 数据不同步

1. 确认使用了 StorageCenter 而非直接 localStorage
2. 确认使用了 UserDataCenter 处理数据
3. 检查 StateManager 订阅是否正确设置

## 总结

WordFlow AI 的数据中心化架构确保了：
- ✅ 数据流清晰可控
- ✅ 刷新后数据正确恢复
- ✅ 配置完全外部化
- ✅ 路由集中管理
- ✅ 易于调试和维护
