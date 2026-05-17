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
# WordFlow AI - 架构改进总结

**日期:** 2025-12-18
**主题:** 中心化架构改进 - Storage、Language、State管理统一

---

## 📊 完成的改进

### 1. **语言切换自动刷新机制**

#### 问题
- 用户切换界面语言后，组件不会自动重新渲染
- 需要手动刷新页面(window.location.reload())才能看到效果

#### 解决方案
**AppContext.tsx** - 添加语言版本状态强制刷新：
```typescript
const [languageVersion, setLanguageVersion] = useState<number>(0);

// Subscribe to language changes and force re-render
const unsubscribeLang = LanguageCenter.subscribe((lang) => {
  console.log('[AppContext] Language changed to:', lang);
  // Force re-render all components using t() by incrementing version
  setLanguageVersion(prev => prev + 1);

  // Apply language to document
  document.documentElement.lang = lang;

  console.log('[AppContext] Language switched, forcing UI refresh');
});
```

**工作原理:**
1. 用户在设置中切换语言
2. `SettingsCenter.update()` 被调用
3. SettingsCenter自动调用`LanguageCenter.setLanguage()`
4. LanguageCenter触发所有订阅者回调
5. AppContext收到回调，`setLanguageVersion(prev => prev + 1)`
6. AppContext重新渲染
7. 所有子组件重新渲染，调用`t()`获取新语言的翻译

**优势:**
- ✅ 不需要`window.location.reload()`
- ✅ 保留应用状态（不会丢失数据）
- ✅ 无缝切换体验
- ✅ 所有使用`t()`的组件自动更新

---

### 2. **设置中心自动同步LanguageCenter**

#### 问题
- 设置中心(SettingsCenter)和语言中心(LanguageCenter)数据不同步
- 修改`settings.language.appInterface`不会自动更新LanguageCenter

#### 解决方案
**SettingsCenter.ts** - 自动同步机制：
```typescript
update(partial: Partial<AppSettings>): void {
  const oldSettings = { ...this.settings };
  this.settings = { ...this.settings, ...partial };

  this.save();
  this.notifyListeners();

  // Auto-apply language change to LanguageCenter
  if (partial.language?.appInterface) {
    const lang = Array.isArray(partial.language.appInterface)
      ? partial.language.appInterface[0]
      : partial.language.appInterface;
    if (lang) {
      // Dynamically import LanguageCenter to avoid circular dependency
      import('../i18n/LanguageCenter').then(({ LanguageCenter }) => {
        LanguageCenter.setLanguage(lang as any);
        console.log('[SettingsCenter] Language updated in LanguageCenter:', lang);
      });
    }
  }

  // Auto-refresh on critical changes
  if (this.shouldRefresh(oldSettings, this.settings)) {
    this.refresh();
  }
}
```

**同样逻辑应用到updateSection()方法:**
```typescript
updateSection<K extends keyof AppSettings>(
  section: K,
  value: Partial<AppSettings[K]>
): void {
  // ...

  // Auto-apply language change to LanguageCenter
  if (section === 'language' && (value as any).appInterface) {
    const lang = Array.isArray((value as any).appInterface)
      ? (value as any).appInterface[0]
      : (value as any).appInterface;
    if (lang) {
      import('../i18n/LanguageCenter').then(({ LanguageCenter }) => {
        LanguageCenter.setLanguage(lang as any);
        console.log('[SettingsCenter] Language updated in LanguageCenter:', lang);
      });
    }
  }

  // ...
}
```

**优势:**
- ✅ 自动同步两个中心的数据
- ✅ 使用动态import避免循环依赖
- ✅ 开发者无需手动调用两处更新

---

## 🏗️ 架构概览

### 当前中心化架构

```
┌─────────────────────────────────────────────────────────────┐
│                        AppContext                            │
│  - 统一状态管理                                               │
│  - 订阅所有中心的变更                                         │
│  - 强制刷新机制 (languageVersion)                             │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
  ┌─────────────┐  ┌──────────────┐  ┌────────────┐
  │ StorageCenter│  │SettingsCenter│  │LanguageCenter│
  │   (存储)     │  │    (设置)     │  │   (语言)    │
  └─────────────┘  └──────────────┘  └────────────┘
            │               │               │
            │               │               │
            ▼               ▼               ▼
        LocalStorage    Listeners       Translations
```

### 数据流

**设置变更流程:**
```
User Action (设置页面)
    ↓
updateSettings() / updateSection()
    ↓
SettingsCenter.update()
    ↓
├─ StorageCenter.set() → LocalStorage持久化
├─ notifyListeners() → AppContext收到通知
├─ LanguageCenter.setLanguage() (如果是语言变更)
└─ applyTheme/applyFontSize/applyLanguage() (立即应用)
    ↓
AppContext setState()
    ↓
All Components Re-render
```

**语言切换流程:**
```
User clicks language option
    ↓
updateSettings({ language: { appInterface: 'zh' } })
    ↓
SettingsCenter.update()
    ↓
LanguageCenter.setLanguage('zh')
    ↓
LanguageCenter notifies subscribers
    ↓
AppContext: setLanguageVersion(prev => prev + 1)
    ↓
AppContext re-renders
    ↓
All child components re-render
    ↓
t('key') returns new translation
    ↓
UI displays new language ✅
```

---

## 📦 已存在的中心化服务

### 1. **StorageCenter** (已完善)
- **位置:** `services/StorageCenter.ts`
- **功能:**
  - ✅ 统一LocalStorage操作
  - ✅ 类型安全的get/set
  - ✅ 分组helper (auth, settings, language, cache)
  - ✅ 缓存过期机制

### 2. **SettingsCenter** (本次改进)
- **位置:** `services/SettingsCenter.ts`
- **功能:**
  - ✅ 统一应用设置管理
  - ✅ 自动保存到StorageCenter
  - ✅ 订阅机制 (onChange)
  - ✅ 自动判断是否需要刷新
  - ✅ **新增:** 自动同步LanguageCenter

### 3. **LanguageCenter** (已完善)
- **位置:** `i18n/LanguageCenter.ts`
- **功能:**
  - ✅ 多语言翻译 (t方法)
  - ✅ 语言切换 (setLanguage)
  - ✅ 订阅机制 (subscribe)
  - ✅ Intl格式化 (数字、日期、相对时间)

### 4. **StateManager** (已存在)
- **位置:** `services/StateManager.ts`
- **功能:**
  - ✅ 全局状态管理
  - ✅ 用于非React组件访问状态

### 5. **AuthModel & UserModel** (已存在)
- **位置:** `models/`
- **功能:**
  - ✅ 用户认证逻辑
  - ✅ 用户数据管理
  - ✅ 与StorageCenter绑定

---

## ✅ 当前状态

### 已实现的中心化

1. **✅ Storage中心化** - StorageCenter统一管理所有存储
2. **✅ 设置中心化** - SettingsCenter统一管理所有设置
3. **✅ 语言中心化** - LanguageCenter统一管理多语言
4. **✅ 状态中心化** - StateManager统一管理全局状态
5. **✅ Model数据中心化** - AuthModel、UserModel统一管理用户数据

### 已实现的绑定

1. **✅ 登录状态 ↔ StorageCenter**
   - 用户数据保存到LocalStorage
   - 刷新页面自动恢复登录状态

2. **✅ 设置数据 ↔ StorageCenter**
   - 所有设置自动保存到LocalStorage
   - 应用启动时自动加载设置

3. **✅ SettingsCenter ↔ LanguageCenter**
   - 设置语言自动同步到LanguageCenter
   - LanguageCenter变更触发AppContext刷新

4. **✅ 设置修改立即生效**
   - 主题切换 (dark/light/auto) - 通过CSS class立即生效
   - 语言切换 - 通过AppContext状态强制刷新
   - 字体大小 - 通过CSS class立即生效

---

## 🎯 测试要点

### 语言切换测试
1. 进入Settings → Display
2. 切换Interface Language (目前需要添加UI)
3. **预期:** 所有文字立即切换，无需刷新页面

### 主题切换测试
1. 进入Settings → Display
2. 切换Theme (Light/Dark/Auto)
3. **预期:** 界面立即切换主题

### 持久化测试
1. 修改设置（语言、主题等）
2. 刷新浏览器
3. **预期:** 所有设置保留

### 登录状态持久化测试
1. 登录应用
2. 关闭浏览器
3. 重新打开浏览器访问应用
4. **预期:** 自动登录，无需重新输入密码

---

## 📝 下一步建议

### 1. 添加界面语言选择器（可选）
Settings/Display.tsx中已有部分实现，可以添加完整的界面语言选择UI：

```typescript
// 在Display页面添加
<div className="space-y-3">
  <h2>Interface Language</h2>
  <div className="grid grid-cols-2 gap-3">
    {LanguageCenter.getSupportedLanguages().map(lang => (
      <button
        key={lang.code}
        onClick={() => updateSettings({
          language: { ...settings.language, appInterface: lang.code }
        })}
        className={isActive ? 'active' : ''}
      >
        {lang.flag} {lang.nativeName}
      </button>
    ))}
  </div>
</div>
```

### 2. 移除Display.tsx中的window.location.reload()
当前Settings/Display.tsx的`handleInterfaceLanguageChange`中有：
```typescript
window.location.reload(); // 可以移除这行
```

因为现在有了自动刷新机制，不再需要强制刷新整个页面。

### 3. 添加切换动画（可选）
可以在语言切换时添加淡入淡出动画，提升用户体验。

---

## 🔧 技术细节

### 避免循环依赖
使用动态import避免SettingsCenter ↔ LanguageCenter循环依赖：
```typescript
import('../i18n/LanguageCenter').then(({ LanguageCenter }) => {
  LanguageCenter.setLanguage(lang as any);
});
```

### 强制刷新机制
通过递增版本号触发React重新渲染：
```typescript
const [languageVersion, setLanguageVersion] = useState<number>(0);
setLanguageVersion(prev => prev + 1); // 触发所有子组件刷新
```

### 订阅模式
所有中心都使用观察者模式：
```typescript
// SettingsCenter
const unsubscribe = SettingsCenter.onChange((settings) => { ... });

// LanguageCenter
const unsubscribe = LanguageCenter.subscribe((lang) => { ... });
```

---

## 📊 性能考虑

### 优势
- ✅ 不刷新整个页面，保留应用状态
- ✅ 只重新渲染必要的组件
- ✅ 设置自动持久化，减少API调用

### 注意事项
- ⚠️ 语言切换会触发整个AppContext树重新渲染
- ⚠️ 大量使用t()的组件会同时刷新

### 优化建议
- 使用React.memo包裹不需要重新渲染的组件
- 考虑使用Context splitting (分离语言context)

---

## 🎓 开发指南

### 如何添加新设置项
1. 在`SettingsCenter.ts`的接口中添加字段
2. 在`DEFAULT_SETTINGS`中添加默认值
3. 在组件中使用`updateSettings()`更新
4. SettingsCenter自动处理保存和通知

### 如何添加新语言
1. 在`i18n/locales/`中添加新语言文件
2. 在`LanguageCenter.ts`的`translations`中注册
3. 在`LANGUAGE_CONFIGS`中添加配置
4. 完成！用户即可切换到新语言

### 如何处理需要立即生效的设置
1. 在`SettingsCenter.shouldRefresh()`中添加判断条件
2. 在`SettingsCenter.refresh()`中添加应用逻辑
3. 或者在AppContext的订阅回调中处理

---

**开发者签名:** Claude Code Assistant
**最后更新:** 2025-12-18 21:00
