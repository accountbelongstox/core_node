# Frontend Centralization Migration Guide
# 前端中心化迁移指南

## 概述 Overview

本次重构将应用状态管理、用户数据管理、存储管理统一到 **UnifiedAppContext**，实现：

1. ✅ **单一数据源** - 所有状态集中管理
2. ✅ **自动持久化** - localStorage 自动同步
3. ✅ **类型安全** - 完整的 TypeScript 支持
4. ✅ **立即生效** - 设置修改可触发页面刷新
5. ✅ **跨标签同步** - storage 事件监听
6. ✅ **向后兼容** - 现有代码无需修改

---

## 架构变更 Architecture Changes

### 之前 Before

```
AppStateContext (主题、语言、视图)
   ↓
useAppState hook

useUser hook (用户、认证)
   ↓
userModel

分散的 localStorage 键名
```

### 现在 Now

```
UnifiedAppContext (统一状态管理)
   ├── App State (主题、语言、视图)
   ├── User State (用户、认证、偏好)
   └── Storage (统一的 StorageKeys)

   ↓

useUnifiedApp hook (推荐)
useAppState hook (兼容)
useUser hook (兼容)
```

---

## 新增文件 New Files

### 1. 存储管理 Storage Management

```
core/storage/
├── StorageKeys.ts       # 统一的 storage 键名常量
├── StorageManager.ts    # 类型安全的存储操作类
└── index.ts             # 导出索引
```

### 2. 统一状态管理 Unified State Management

```
core/contexts/
└── UnifiedAppContext.tsx   # 统一应用状态 Context
```

### 3. 兼容性层 Compatibility Layer

```
hooks/
└── compatibilityHooks.ts   # 兼容旧 API 的 hooks
```

---

## 使用方法 Usage

### 方式 1：使用新的 UnifiedApp Hook（推荐）

```typescript
import { useUnifiedApp } from '@/core/contexts/UnifiedAppContext';

function MyComponent() {
  const {
    // App State
    theme, lang, activeView,
    setTheme, setLang, setActiveView,
    toggleTheme, toggleLang,

    // User State
    user, isLoggedIn, preferences,
    login, logout, register,

    // Utility
    loading, error, clearError
  } = useUnifiedApp();

  // 切换主题（不刷新页面）
  const handleThemeToggle = () => {
    toggleTheme(false);
  };

  // 切换语言（刷新页面）
  const handleLangToggle = () => {
    toggleLang(true); // 传入 true 触发页面刷新
  };

  return (
    <div>
      <button onClick={handleThemeToggle}>Toggle Theme</button>
      <button onClick={handleLangToggle}>Toggle Language</button>
    </div>
  );
}
```

### 方式 2：继续使用旧的 Hooks（兼容）

**无需修改现有代码**，以下用法继续有效：

```typescript
// 旧的 useAppState
import { useAppState } from '@/contexts/AppStateContext';

function MyComponent() {
  const { theme, toggleTheme, lang, setLang } = useAppState();
  // ... 代码保持不变
}
```

```typescript
// 旧的 useUser
import { useUser } from '@/hooks/useUser';

function MyComponent() {
  const { user, login, logout, isLoggedIn } = useUser();
  // ... 代码保持不变
}
```

---

## 页面刷新机制 Page Refresh Mechanism

设置修改时可选择是否刷新页面，确保修改立即生效：

```typescript
// 不刷新页面（默认）
setTheme('dark', false);
setLang('zh', false);

// 刷新页面（修改立即生效）
setTheme('light', true);
setLang('en', true);

// 快捷方法
toggleTheme(true);  // 切换主题并刷新
toggleLang(true);   // 切换语言并刷新
```

**刷新延迟**：300ms，允许状态先保存到 localStorage

---

## Storage Keys 管理 Storage Keys Management

### 使用统一的 StorageKeys

```typescript
import { StorageKeys, StorageManager } from '@/core/storage';

// 读取
const user = StorageManager.get(StorageKeys.USER);
const theme = StorageManager.get(StorageKeys.THEME);

// 写入
StorageManager.set(StorageKeys.USER, userData);
StorageManager.set(StorageKeys.THEME, 'dark');

// 删除
StorageManager.remove(StorageKeys.USER);

// 检查存在
if (StorageManager.has(StorageKeys.AUTH_TOKEN)) {
  // ...
}
```

### 清理 Storage

```typescript
import { clearAllStorage, clearCacheStorage, clearTempStorage } from '@/core/storage';

// 清除所有 Nexus storage
clearAllStorage();

// 只清除缓存
clearCacheStorage();

// 只清除临时数据
clearTempStorage();
```

---

## API 参考 API Reference

### UnifiedAppContext API

#### State 状态

```typescript
interface UnifiedAppContextType {
  // App State
  activeView: ViewType;
  lang: Language;
  theme: Theme;

  // User State
  user: User | null;
  isLoggedIn: boolean;
  preferences: UserPreferences;

  // Loading & Error
  loading: boolean;
  error: string | null;
}
```

#### Methods 方法

**App Actions**
- `setActiveView(view: ViewType): void`
- `setLang(lang: Language, reload?: boolean): void`
- `setTheme(theme: Theme, reload?: boolean): void`
- `toggleTheme(reload?: boolean): void`
- `toggleLang(reload?: boolean): void`

**User Actions**
- `login(username: string, password: string): Promise<boolean>`
- `register(...): Promise<boolean>`
- `logout(): Promise<boolean>`
- `updatePreferences(prefs: Partial<UserPreferences>): Promise<boolean>`
- `addRecentTool(toolId: string): void`
- `toggleFavorite(toolId: string): void`
- `isFavorite(toolId: string): boolean`

**Utility Actions**
- `clearError(): void`
- `refreshState(): void`
- `resetAll(): void`

---

## 迁移步骤 Migration Steps

### Step 1: 更新 App.tsx (如果需要)

如果你的应用使用了 `AppStateProvider`，它现在自动指向 `UnifiedAppProvider`，无需修改。

```typescript
// 这段代码无需修改，仍然有效
import { AppStateProvider } from '@/contexts/AppStateContext';

function App() {
  return (
    <AppStateProvider>
      {/* ... */}
    </AppStateProvider>
  );
}
```

### Step 2: 逐步迁移组件（可选）

如果你想使用新的 API，可以逐步迁移：

```typescript
// 旧代码
import { useAppState } from '@/contexts/AppStateContext';
import { useUser } from '@/hooks/useUser';

function MyComponent() {
  const { theme, setTheme } = useAppState();
  const { user, login } = useUser();
  // ...
}

// 新代码
import { useUnifiedApp } from '@/core/contexts/UnifiedAppContext';

function MyComponent() {
  const { theme, setTheme, user, login } = useUnifiedApp();
  // ...
}
```

### Step 3: 更新 Storage 使用（推荐）

```typescript
// 旧代码
localStorage.setItem('my_key', JSON.stringify(data));
const data = JSON.parse(localStorage.getItem('my_key') || '{}');

// 新代码
import { StorageManager, StorageKeys } from '@/core/storage';

StorageManager.set(StorageKeys.SETTINGS, data);
const data = StorageManager.get(StorageKeys.SETTINGS, {});
```

---

## 注意事项 Important Notes

1. **向后兼容**：所有现有代码无需修改即可工作
2. **推荐迁移**：新功能请使用 `useUnifiedApp`
3. **Storage 键名**：统一使用 `StorageKeys` 常量
4. **页面刷新**：设置修改时按需使用 `reload` 参数
5. **跨标签同步**：自动监听 storage 事件

---

## 故障排查 Troubleshooting

### 问题：状态未持久化

**解决**：检查 StorageKeys 是否正确配置

```typescript
import { StorageKeys } from '@/core/storage';
console.log(StorageKeys.APP_STATE); // 应该输出: 'nexus_app_state'
```

### 问题：页面刷新未生效

**解决**：确保传入 `reload: true` 参数

```typescript
setTheme('dark', true); // ✅ 会刷新
setTheme('dark');       // ❌ 不会刷新
```

### 问题：用户状态丢失

**解决**：检查 userModel 是否正确保存

```typescript
import { userModel } from '@/core/models';
console.log(userModel.getUser()); // 检查用户数据
```

---

## 完成 ✅

前端中心化架构已完成！现在你拥有：

- ✅ 统一的状态管理系统
- ✅ 类型安全的 Storage 操作
- ✅ 自动持久化机制
- ✅ 页面刷新控制
- ✅ 完整的向后兼容
- ✅ 跨标签同步支持

**推荐阅读**：
- `core/storage/StorageKeys.ts` - 所有可用的 storage 键
- `core/contexts/UnifiedAppContext.tsx` - 完整的 Context 实现
- `hooks/compatibilityHooks.ts` - 兼容性层实现
