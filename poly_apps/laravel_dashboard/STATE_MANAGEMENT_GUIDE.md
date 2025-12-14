# 状态管理中心化 - 快速指南

## 1. 功能概述 ✅

**已完成:**
- ✅ 左侧工具栏选中状态自动缓存到 localStorage
- ✅ 刷新页面后恢复最后选择的工具
- ✅ 全站状态统一中心化管理
- ✅ 主题、语言、登录状态全部持久化

---

## 2. 立即测试

### 清除浏览器缓存
```bash
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

### 测试步骤
1. **打开应用** - 默认显示 Media Browser
2. **点击左侧工具栏** - 选择 "Tools" 或任意其他页面
3. **刷新页面 (F5)** - 应该仍然显示你最后选择的页面 ✅
4. **切换主题** - 刷新后主题保持
5. **切换语言** - 刷新后语言保持

---

## 3. 开发者使用指南

### 3.1 在任意组件中使用全局状态

```tsx
import { useAppState } from '../contexts/AppStateContext';

function MyComponent() {
  const {
    activeView,    // 当前页面
    setActiveView, // 切换页面
    theme,         // 当前主题
    toggleTheme,   // 切换主题
    lang,          // 当前语言
    toggleLang,    // 切换语言
    isLoggedIn,    // 登录状态
    setIsLoggedIn  // 设置登录状态
  } = useAppState();

  return (
    <button onClick={() => setActiveView(ViewType.TOOLS)}>
      前往工具页面
    </button>
  );
}
```

### 3.2 添加新的全局状态

编辑 `contexts/AppStateContext.tsx`:

```typescript
// 1. 在 AppState 接口中添加
interface AppState {
  activeView: ViewType;
  // ... 其他状态
  newState: string;  // 新增状态
}

// 2. 在 DEFAULT_STATE 中设置默认值
const DEFAULT_STATE: AppState = {
  activeView: ViewType.MEDIA_BROWSER,
  // ... 其他状态
  newState: 'default',  // 默认值
};

// 3. 在 Context 类型中添加方法
interface AppStateContextType {
  // ... 其他状态
  newState: string;
  setNewState: (value: string) => void;
}

// 4. 在 Provider 中实现
export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
  // ... 其他代码

  const setNewState = useCallback((value: string) => {
    setState(prev => ({ ...prev, newState: value }));
    console.log('[AppStateContext] New state changed to:', value);
  }, []);

  const value: AppStateContextType = {
    // ... 其他状态
    newState: state.newState,
    setNewState,
  };
};
```

### 3.3 查看 localStorage 数据

打开浏览器控制台 (F12) → Application/Storage → Local Storage:

```javascript
// 应用状态
dashboard_app_state: {
  "activeView": "tools",
  "lang": "en",
  "theme": "dark",
  "isLoggedIn": false,
  "lastVisitedView": "tools"
}

// API 配置
dashboard_api_config: {
  "baseUrl": "http://192.168.50.3:9000",
  "apiKey": "...",
  "port": 9000
}
```

---

## 4. 架构说明

### 4.1 Context 层级结构

```
AppStateProvider (最外层 - 应用状态)
  └─ ApiConfigProvider (API 配置)
      └─ ToastProvider (通知系统)
          └─ AppContent (应用内容)
```

### 4.2 文件结构

```
contexts/
  ├─ AppStateContext.tsx     ← 新增：全局应用状态
  ├─ ApiConfigContext.tsx    ← 已有：API 配置
  └─ (LanguageContext.tsx)   ← 未使用：国际化系统

App.tsx                       ← 已修改：使用 AppStateContext
```

---

## 5. 状态管理原则

### ✅ 应该放在中心化状态的：
- 需要跨组件共享的数据
- 需要持久化（刷新后保留）的数据
- 全局配置（主题、语言）
- 用户会话信息

### ❌ 应该保持组件本地的：
- 模态框开关状态
- 表单输入临时数据
- 加载状态 (loading/error)
- 列表过滤/搜索关键词

---

## 6. 调试技巧

### 查看状态变化日志

打开浏览器控制台 (F12)，应该看到：

```
[AppStateContext] Initial state loaded: {activeView: "media", ...}
[App] Mounted with activeView: media
[AppStateContext] Active view changed to: tools
[AppStateContext] State saved to localStorage: tools
[AppStateContext] Theme changed to: light
```

### 手动清除状态

在控制台执行：
```javascript
localStorage.removeItem('dashboard_app_state');
location.reload();
```

---

## 7. 常见问题

### Q1: 刷新后状态没有恢复？
**A:** 清除浏览器缓存 (`Ctrl+Shift+R`)，然后重新测试。

### Q2: 如何重置到默认状态？
**A:** 使用 `resetState()` 方法：
```tsx
const { resetState } = useAppState();
resetState(); // 重置所有状态到默认值
```

### Q3: 可以在 Context 外使用 Hook 吗？
**A:** 不可以。必须在 `AppStateProvider` 内部使用 `useAppState()`。

### Q4: 如何批量更新多个状态？
**A:** 使用 `updateState()` 方法：
```tsx
const { updateState } = useAppState();
updateState({
  theme: 'light',
  lang: 'zh',
  activeView: ViewType.TOOLS
});
```

---

## 8. 性能优化建议

1. **避免频繁更新** - 状态更新会触发 localStorage 写入
2. **使用 useCallback** - 所有更新函数已使用 useCallback 优化
3. **拆分 Context** - 如果状态过多，可以考虑拆分成多个 Context
4. **使用 memo** - 对于复杂的派生状态，使用 useMemo

---

## 9. 相关文档

- `STATE_MANAGEMENT_REPORT.md` - 详细的架构分析报告
- `CACHE_CLEAR_GUIDE.md` - 浏览器缓存清除指南
- `COMPLETION_REPORT.md` - 项目完成报告

---

**状态:** ✅ **生产就绪**
**版本:** 1.0.0
**更新日期:** 2025-12-14
