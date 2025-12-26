# WordFlow AI - 应用架构文档
# Application Architecture Document

> **版本 Version**: 2.0
> **更新日期 Last Updated**: 2025-12-18
> **Status**: ✅ Production Ready

---

## 📋 目录 / Table of Contents

1. [系统概览](#系统概览--system-overview)
2. [中心化架构](#中心化架构--centralized-architecture)
3. [数据流](#数据流--data-flow)
4. [目录结构](#目录结构--directory-structure)
5. [最佳实践](#最佳实践--best-practices)
6. [扩展指南](#扩展指南--extension-guide)

---

## 系统概览 / System Overview

WordFlow AI 采用**中心化服务架构**（Centralized Service Architecture），所有核心功能通过统一的服务层管理。

### 核心原则

- ✅ **单一数据源** Single Source of Truth
- ✅ **响应式更新** Reactive Updates
- ✅ **类型安全** Type Safety
- ✅ **自动持久化** Auto Persistence
- ✅ **实时同步** Real-time Sync

### 技术栈

- **Frontend**: React 19.2 + TypeScript 5.8
- **Router**: React Router v7
- **Build**: Vite 6.2
- **State**: Custom Centralized Services
- **i18n**: Custom LanguageCenter
- **API**: Fetch API + Centralized Wrapper

---

## 中心化架构 / Centralized Architecture

### 架构层次图

```
┌─────────────────────────────────────────┐
│         UI Components (Pages)           │  ← React组件
├─────────────────────────────────────────┤
│      React Context (AppContext)         │  ← 全局上下文
├─────────────────────────────────────────┤
│         Models (Business Logic)         │  ← 业务逻辑层
│   UserModel | AuthModel | ...          │
├─────────────────────────────────────────┤
│         Services (Core Services)        │  ← 核心服务层
│   ApiCenter | SettingsCenter | ...     │
├─────────────────────────────────────────┤
│    Storage & State Management           │  ← 数据层
│   StorageCenter | StateManager          │
└─────────────────────────────────────────┘
```

---

## 1. StorageCenter - 存储中心

📁 **位置**: `services/StorageCenter.ts`

**职责**: 统一管理浏览器localStorage，提供类型安全的存储接口

### API

```typescript
// 基础操作
StorageCenter.set(StorageKey.AUTH_TOKEN, value);
StorageCenter.get<T>(StorageKey.AUTH_TOKEN);
StorageCenter.remove(StorageKey.AUTH_TOKEN);
StorageCenter.has(StorageKey.AUTH_TOKEN);

// Auth专用
StorageCenter.auth.setToken(token);
StorageCenter.auth.getToken();
StorageCenter.auth.setUser(user);
StorageCenter.auth.getUser();
StorageCenter.auth.clearAuth();

// Settings专用
StorageCenter.settings.get();
StorageCenter.settings.set(settings);
StorageCenter.settings.getActiveGroupId();

// Language专用
StorageCenter.language.getAppLanguage();
StorageCenter.language.setAppLanguage('zh');

// Cache专用 (带TTL)
StorageCenter.cache.set(key, value, ttlMs);
StorageCenter.cache.get<T>(key);
StorageCenter.cache.invalidateAll();
```

### 特性

- ✅ 类型安全的 `StorageKey` 枚举
- ✅ 自动JSON序列化/反序列化
- ✅ 错误处理和日志
- ✅ 缓存过期机制
- ✅ 分类Helper方法

### 存储键定义

```typescript
export enum StorageKey {
  // Auth
  AUTH_TOKEN = 'auth_token',
  USER_DATA = 'user_data',

  // Settings
  APP_SETTINGS = 'app_settings',
  PLAYLIST_SETTINGS = 'playlist_settings',
  ACTIVE_GROUP_ID = 'active_group_id',

  // Language
  APP_LANGUAGE = 'app_language',
  LEARNING_LANGUAGE = 'learning_language',
  NATIVE_LANGUAGE = 'native_language',

  // Cache
  WORD_GROUPS_CACHE = 'word_groups_cache',
  USER_PROFILE_CACHE = 'user_profile_cache',

  // UI State
  THEME = 'theme',
  SIDEBAR_STATE = 'sidebar_state',
}
```

---

## 2. SettingsCenter - 设置中心

📁 **位置**: `services/SettingsCenter.ts`

**职责**: 管理应用设置，支持响应式更新和自动持久化

### API

```typescript
// 初始化
const settings = SettingsCenter.initialize();

// 获取设置
const current = SettingsCenter.get();

// 更新设置
SettingsCenter.update({
  language: { appInterface: 'zh' },
  display: { theme: 'dark' }
});

// 更新部分设置
SettingsCenter.updateSection('display', { theme: 'dark' });

// 订阅变化
const unsubscribe = SettingsCenter.onChange((newSettings) => {
  console.log('Settings changed:', newSettings);
});

// 快捷方法
SettingsCenter.theme.get();
SettingsCenter.theme.set('dark');
SettingsCenter.theme.toggle();

SettingsCenter.language.get();
SettingsCenter.language.set('zh');
```

### 设置结构

```typescript
interface AppSettings {
  language: LanguageSettings;      // 语言设置
  display: DisplaySettings;         // 显示设置
  audio: AudioSettings;             // 音频设置
  learning: LearningSettings;       // 学习设置
  notifications: NotificationSettings; // 通知设置
}
```

### 自动刷新机制

**触发条件**:
- ✅ 主题变化 (`light` / `dark` / `auto`)
- ✅ 界面语言变化
- ✅ 字体大小变化

**刷新操作**:
1. 应用到DOM (`document.documentElement`)
2. 保存到 StorageCenter
3. 保存到 StateManager
4. 通知所有订阅者
5. 发送 EventBus 事件

---

## 3. LanguageCenter - 多语言中心

📁 **位置**: `i18n/LanguageCenter.ts`

**职责**: 国际化（i18n）管理，提供类型安全的翻译功能

### API

```typescript
// 获取翻译
const text = LanguageCenter.t('common.welcome');
const greet = LanguageCenter.t('common.greeting', { name: 'Alice' });

// 语言切换
LanguageCenter.setLanguage('zh');
const current = LanguageCenter.getCurrentLanguage();

// 订阅语言变化
const unsubscribe = LanguageCenter.subscribe((lang) => {
  console.log('Language changed to:', lang);
});

// 获取支持的语言
const languages = LanguageCenter.getSupportedLanguages();

// 格式化
LanguageCenter.formatNumber(1234.56);
LanguageCenter.formatDate(new Date());
LanguageCenter.formatRelativeTime('2025-12-17');
```

### 支持的语言

- 🇺🇸 **English** (en)
- 🇨🇳 **中文** (zh)
- 🇯🇵 **日本語** (ja)
- 🇰🇷 **한국어** (ko)
- 🇪🇸 **Español** (es)
- 🇫🇷 **Français** (fr)
- 🇩🇪 **Deutsch** (de)

### 翻译文件

- `i18n/locales/en.ts` - 英文翻译
- `i18n/locales/zh.ts` - 中文翻译

### 特性

- ✅ 类型安全的翻译键
- ✅ 参数替换
- ✅ 英文回退
- ✅ 数字/日期格式化
- ✅ 相对时间格式化

---

## 4. StateManager - 状态管理器

📁 **位置**: `services/StateManager.ts`

**职责**: 轻量级响应式全局状态管理（无需外部依赖）

### API

```typescript
// 创建状态
StateManager.create('myState', initialValue);

// 获取状态
const value = StateManager.get(GlobalState.USER);

// 设置状态
StateManager.set(GlobalState.USER, newUser);

// 函数式更新
StateManager.set(GlobalState.USER, (prev) => ({ ...prev, name: 'New' }));

// 订阅变化
const unsubscribe = StateManager.subscribe(GlobalState.USER, (newUser) => {
  console.log('User changed:', newUser);
});
```

### 预定义全局状态

```typescript
export const GlobalState = {
  // User
  USER: 'global.user',
  IS_LOGGED_IN: 'global.isLoggedIn',

  // UI
  CURRENT_PAGE: 'global.currentPage',
  IS_LOADING: 'global.isLoading',
  ERROR_MESSAGE: 'global.errorMessage',

  // Settings
  THEME: 'global.theme',
  LANGUAGE: 'global.language',
  SETTINGS: 'global.settings',

  // Learning
  ACTIVE_GROUP_ID: 'global.activeGroupId',
  LEARNING_STATS: 'global.learningStats',
};
```

---

## 5. EventBus - 事件总线

📁 **位置**: `services/EventBus.ts`

**职责**: 组件间通信的事件系统

### API

```typescript
// 发送事件
EventBus.emit('settings-changed', { theme: 'dark' });
EventBus.emit('user-logged-in', { userId: '123' });

// 监听事件
const unsubscribe = EventBus.on('settings-changed', (data) => {
  console.log('Settings changed:', data);
});

// 监听一次
EventBus.once('user-logged-in', (data) => {
  console.log('User logged in:', data);
});

// React Hook
function MyComponent() {
  useEventBus('settings-changed', (data) => {
    // 处理事件
  });
}
```

### 支持的事件

```typescript
type EventMap = {
  'settings-changed': any;
  'api-endpoint-changed': { endpointId: string };
  'language-changed': { language: string };
  'theme-changed': { theme: 'light' | 'dark' };
  'user-logged-in': { userId: string };
  'user-logged-out': void;
};
```

---

## 6. ApiCenter - API中心

📁 **位置**: `services/ApiCenter.ts`

**职责**: 统一管理所有后端API调用

### API分类

```typescript
// 认证 (7个)
ApiCenter.auth.login(credentials)
ApiCenter.auth.register(data)
ApiCenter.auth.logout()
ApiCenter.auth.getProfile()
ApiCenter.auth.forgotPassword(email)
ApiCenter.auth.resetPassword(...)

// 用户 (5个)
ApiCenter.user.getProfile()
ApiCenter.user.updateProfile(data)
ApiCenter.user.updateAvatar(file)
ApiCenter.user.getInitializationStatus()
ApiCenter.user.initialize(data)

// 词组 (10个)
ApiCenter.wordGroups.getAll()
ApiCenter.wordGroups.getById(id)
ApiCenter.wordGroups.create(data)
ApiCenter.wordGroups.delete(id)

// 学习 (15个)
ApiCenter.learning.getStats()
ApiCenter.learning.getRecommendations()
ApiCenter.learning.selectCollection(id)

// 翻译 (10个)
ApiCenter.translation.translate(data)
ApiCenter.translation.simpleTranslateWithGoogle(data)
ApiCenter.translation.learningMode(data)

// TTS (6个)
ApiCenter.tts.generate(data)
ApiCenter.tts.batchGenerate(data)
ApiCenter.tts.getVoices(language)

// 个人词典 (5个)
ApiCenter.personalDictionary.create(data)
ApiCenter.personalDictionary.query(params)
ApiCenter.personalDictionary.deleteById(id)

// ...共98个端点
```

### 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message: string;
  };
}
```

### 特性

- ✅ 统一错误处理
- ✅ 自动Token添加
- ✅ 请求超时管理
- ✅ 响应标准化
- ✅ TypeScript类型完整

---

## 7. 数据模型层 / Models

📁 **位置**: `models/`

### UserModel - 用户模型

```typescript
// 初始化
UserModel.init();

// 用户信息
const user = UserModel.getCurrentUser();
const displayName = UserModel.getDisplayName();
const avatarUrl = UserModel.getAvatarUrl();

// 统计
const stats = UserModel.getUserStats();
const streak = UserModel.getStreak();
const progress = UserModel.getCompletionPercentage();

// 更新
await UserModel.updateProfile(data);
await UserModel.uploadAvatar(file);
```

### AuthModel - 认证模型

```typescript
// 登录/注册
const result = await AuthModel.login(credentials);
const result = await AuthModel.register(data);

// 登出
await AuthModel.logout();

// 状态
const isAuth = AuthModel.isAuthenticated();
const token = AuthModel.getToken();

// Session
await AuthModel.validateSession();
await AuthModel.initializeAuth();
```

### Model导出中心

📁 **位置**: `models/index.ts`

```typescript
// 运行时导出
export { UserModel } from './UserModel';
export { AuthModel } from './AuthModel';

// 类型导出
export type { UserStats, UserProfile } from './UserModel';
export type { LoginResult, RegisterResult } from './AuthModel';
```

---

## 8. RouteCenter - 路由中心

📁 **位置**: `router/RouteCenter.tsx`

**职责**: 统一管理所有应用路由

### API

```typescript
// 获取所有路由
const routes = RouteCenter.getAllRoutes();

// 按类别获取
const authRoutes = RouteCenter.getRoutesByCategory('auth');
const toolRoutes = RouteCenter.getRoutesByCategory('tools');

// 获取单个路由
const route = RouteCenter.getRouteByPath('/login');

// 检查路由属性
const isImmersive = RouteCenter.isImmersiveRoute('/reading_run');
const isProtected = RouteCenter.isProtectedRoute('/home');

// 获取路由名称
const name = RouteCenter.getRouteName('/tools');
```

### 路由配置

```typescript
interface RouteConfig {
  path: string;                     // 路由路径
  element: React.ReactElement;      // 组件
  name: string;                     // 显示名称
  category: string;                 // 类别
  isProtected?: boolean;            // 需要登录
  isImmersive?: boolean;            // 沉浸式模式
}
```

### 路由统计

- **Total**: 30+ routes
- **Auth**: 3 routes
- **Dashboard**: 3 routes
- **Learning**: 10 routes
- **Library**: 4 routes
- **Tools**: 6 routes
- **Settings**: 8 routes

---

## 数据流 / Data Flow

### 用户操作流程

```
用户操作
   ↓
UI组件
   ↓
Model层 (业务逻辑)
   ↓
ApiCenter (API调用)
   ↓
Backend API
   ↓
响应处理
   ↓
更新本地状态
   ↓
StorageCenter (持久化)
   ↓
StateManager (全局状态)
   ↓
EventBus (通知)
   ↓
UI更新
```

### 设置变更流程

```
用户修改设置
   ↓
SettingsCenter.update()
   ↓
保存到 StorageCenter
   ↓
保存到 StateManager
   ↓
触发 onChange 回调
   ↓
检查是否需要刷新
   ↓
应用主题/语言/字体
   ↓
发送 EventBus 事件
   ↓
组件响应更新
```

### 登录流程

```
用户凭证
   ↓
AuthModel.login()
   ↓
ApiCenter.auth.login()
   ↓
后端验证
   ↓
返回 user + token
   ↓
UserModel.setCurrentUser()
   ↓
StorageCenter 持久化
   ↓
StateManager 更新
   ↓
EventBus 发送 'user-logged-in'
   ↓
AppContext 更新
   ↓
导航到主页
```

---

## 目录结构 / Directory Structure

```
wordflow-ai/
├── components/          # 通用UI组件
│   ├── Header.tsx
│   ├── BottomNav.tsx
│   └── ...
├── contexts/           # React Context
│   └── AppContext.tsx  # 全局上下文
├── i18n/              # 国际化
│   ├── LanguageCenter.ts
│   └── locales/
│       ├── en.ts
│       └── zh.ts
├── models/            # 数据模型
│   ├── index.ts       # Model Center
│   ├── UserModel.ts
│   ├── AuthModel.ts
│   └── ...
├── pages/             # 页面组件
│   ├── Auth/          # 认证页面
│   ├── Dashboard/     # 仪表盘
│   ├── Library/       # 词库
│   ├── Tools/         # AI工具
│   └── ...
├── router/            # 路由配置
│   └── RouteCenter.tsx
├── services/          # 核心服务
│   ├── ApiCenter.ts         # API管理
│   ├── StorageCenter.ts     # 存储管理
│   ├── SettingsCenter.ts    # 设置管理
│   ├── StateManager.ts      # 状态管理
│   ├── EventBus.ts          # 事件总线
│   ├── ApiManager.ts        # API端点管理
│   └── UserDataCenter.ts    # 用户数据处理
├── types.ts           # TypeScript类型
├── App.tsx            # 应用入口
└── main.tsx           # React入口
```

---

## 最佳实践 / Best Practices

### 1. 优先使用中心化服务

✅ **CORRECT**:
```typescript
import { SettingsCenter } from '../services/SettingsCenter';
import { LanguageCenter } from '../i18n/LanguageCenter';
import { UserModel } from '../models/UserModel';

const theme = SettingsCenter.theme.get();
const user = UserModel.getCurrentUser();
const text = LanguageCenter.t('common.welcome');
```

❌ **INCORRECT**:
```typescript
// 不要直接访问 localStorage
const theme = localStorage.getItem('theme');
const user = JSON.parse(localStorage.getItem('user') || 'null');
```

### 2. 订阅和清理

✅ **CORRECT**:
```typescript
useEffect(() => {
  const unsubscribe = SettingsCenter.onChange((settings) => {
    // 处理变化
  });
  return () => unsubscribe();
}, []);
```

### 3. API错误处理

✅ **CORRECT**:
```typescript
const result = await ApiCenter.words.getDailyWords();
if (result.success && result.data) {
  setWords(result.data);
} else {
  alert(result.error?.message || 'Failed to load');
}
```

### 4. Model优先原则

✅ **CORRECT**:
```typescript
await AuthModel.login(credentials);
await UserModel.updateProfile(data);
```

❌ **INCORRECT**:
```typescript
await ApiCenter.auth.login(credentials);
await ApiCenter.user.updateProfile(data);
```

### 5. EventBus通信

```typescript
// 发送
EventBus.emit('theme-changed', { theme: 'dark' });

// 监听
useEventBus('theme-changed', (data) => {
  updateUI(data.theme);
});
```

---

## 扩展指南 / Extension Guide

### 添加新API端点

```typescript
// ApiCenter.ts
myFeature = {
  getData: async (): Promise<ApiResponse<any>> => {
    return this.request<any>('/my_endpoint', { method: 'GET' });
  }
};

// 使用
const result = await ApiCenter.myFeature.getData();
```

### 添加新全局状态

```typescript
// StateManager.ts
export const GlobalState = {
  MY_NEW_STATE: 'global.myNewState',
};

StateManager.create(GlobalState.MY_NEW_STATE, defaultValue);

// 使用
const value = StateManager.get(GlobalState.MY_NEW_STATE);
StateManager.set(GlobalState.MY_NEW_STATE, newValue);
```

### 添加新翻译键

```typescript
// i18n/locales/en.ts
export const en = {
  myFeature: {
    title: 'My Feature',
    description: 'Description',
  }
};

// 使用
const title = LanguageCenter.t('myFeature.title');
```

---

## 性能优化 / Performance Tips

1. **缓存优先**: 使用 `StorageCenter.cache.*` 缓存数据
2. **订阅清理**: 始终清理订阅，避免内存泄漏
3. **状态最小化**: 只在全局存储真正需要共享的状态
4. **懒加载**: 使用 React.lazy 懒加载页面组件
5. **防抖节流**: 处理频繁触发的操作

---

## 调试技巧 / Debugging

### 控制台查看

```javascript
// 全局状态
console.log('[USER]', StateManager.get('global.user'));
console.log('[SETTINGS]', SettingsCenter.get());
console.log('[LANGUAGE]', LanguageCenter.getCurrentLanguage());

// 监听所有事件
EventBus.on('settings-changed', console.log);
EventBus.on('theme-changed', console.log);

// 查看存储
console.log('[Storage]', localStorage);
```

---

## 常见问题 / FAQ

**Q: 为什么不使用Redux/Zustand？**
A: 使用轻量级自定义StateManager，无需外部依赖，更易于理解和维护。

**Q: 设置如何自动刷新？**
A: SettingsCenter内置自动刷新机制，主题、语言、字体变更时自动应用到DOM。

**Q: 如何添加新语言？**
A: 在 `i18n/locales/` 创建语言文件，在 `LanguageCenter.ts` 添加配置。

**Q: API调用失败如何处理？**
A: ApiCenter返回统一 `ApiResponse<T>`，检查 `response.success` 和 `response.error`。

**Q: 如何实现跨组件通信？**
A: 使用 EventBus 发送/监听事件，或使用 StateManager 共享全局状态。

---

## 版本历史 / Version History

### v2.0 (2025-12-18)
- ✅ 完整中心化架构
- ✅ 98个API端点集成
- ✅ 多语言系统
- ✅ 主题实时切换
- ✅ 数据模型层

### v1.0 (2025-12-15)
- ✅ 初始架构
- ✅ 基础服务
- ✅ React 19 升级

---

**Maintained By**: WordFlow AI Team
**Last Review**: 2025-12-18
**Next Review**: 2026-Q1
