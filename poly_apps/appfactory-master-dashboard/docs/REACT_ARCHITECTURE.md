# React 架构设计文档 - 加密图片解密系统

## 概述

本文档说明如何将原生 JavaScript 加密图片解密功能完全集成到 React 官方架构中，使用 React 官方能力和最佳实践。

## 架构层次

```
React Components (使用 usePasswordChange hook)
  ↓
PasswordContext (React Context API - 监听 URL 变化)
  ↓
encryptedImageService (单例服务)
  ↓
EncryptedAppAssetsManager (资源管理)
  ↓
DynamicDecryptionManager (缓存管理)
  ↓
ImageDecryptor (XOR 解密)
```

## 核心设计原则

### 1. 使用 React 官方能力

- **React Router**: 使用 `useLocation` hook 监听 URL 变化
- **React Context**: 使用 `PasswordContext` 管理密码状态
- **React Hooks**: 使用 `useEffect` 处理副作用（图片加载、缓存清理）
- **React State**: 使用 `useState` 管理组件状态

### 2. 层次加载流程

#### URL 变化 → 密码更新 → 图片重新加载

```
1. 用户点击链接或 URL 变化
   ↓
2. React Router 的 useLocation 检测到变化
   ↓
3. PasswordContext 的 useEffect 触发
   ↓
4. 从 URL hash 中提取 pp/pwd/password 参数
   ↓
5. 更新 PasswordContext 中的 password state
   ↓
6. password 变化触发另一个 useEffect
   ↓
7. 调用 encryptedImageService.setPassword(password)
   ↓
8. EncryptedAppAssetsManager.setPassword() 清除缓存
   ↓
9. 组件中的 useEffect([password]) 检测到密码变化
   ↓
10. 组件重新加载图片（使用新密码解密）
```

### 3. 密码参数动态刷新机制

#### PasswordContext 监听 URL 变化

```typescript
// contexts/PasswordContext.tsx
export const PasswordProvider: React.FC = ({ children }) => {
  const location = useLocation(); // React Router 官方 hook
  
  useEffect(() => {
    // 从 URL hash 中提取密码参数
    const passwordParam = getUrlParam('pp', '') || 
                         getUrlParam('pwd', '') || 
                         getUrlParam('password', '');
    
    // 更新 Context 中的 password
    setPassword(passwordParam);
  }, [location.search, location.pathname]); // React Router 变化时触发
};
```

#### 密码变化时自动清除缓存

```typescript
// contexts/PasswordContext.tsx
useEffect(() => {
  // 密码变化时，通知 encryptedImageService
  encryptedImageService.setPassword(password);
}, [password]);
```

```typescript
// services/encryptedAppAssets.ts
setPassword(newPassword: string): void {
  if (newPassword !== this.currentPassword) {
    this.currentPassword = newPassword;
    this.decryptor.setPassword(newPassword);
    this.clearCache(); // 清除所有缓存的解密图片
  }
}
```

#### 组件自动重新加载图片

```typescript
// components/AppCard.tsx
const AppCard: React.FC = ({ app }) => {
  const password = usePasswordChange(); // 监听密码变化
  
  useEffect(() => {
    const loadImages = async () => {
      // 密码变化时，这个 effect 会重新执行
      const icon = await encryptedImageService.loadAppIcon(app.id);
      setIconUrl(icon);
    };
    loadImages();
  }, [app.id, password]); // password 在依赖数组中
};
```

## 文件结构

### TypeScript 模块（替代原生 JS）

```
services/
├── imageDecryptor.ts              # 图片解密核心逻辑（XOR）
├── dynamicDecryptionManager.ts    # 动态解密管理器（缓存管理）
├── encryptedAppAssets.ts          # 加密资源管理器
└── encryptedImageService.ts       # 单例服务（对外接口）

contexts/
└── PasswordContext.tsx            # React Context（密码管理）

hooks/
└── usePasswordChange.ts           # React Hook（组件使用）

utils/
└── urlParams.ts                   # URL 参数工具（HashRouter 支持）
```

### 已废弃的原生 JS（保留但不使用）

```
public/js/
├── image_decryptor.js             # 已转换为 services/imageDecryptor.ts
├── dynamic_decryption_manager.js  # 已转换为 services/dynamicDecryptionManager.ts
└── encrypted_app_assets.js        # 已转换为 services/encryptedAppAssets.ts
```

## 关键实现细节

### 1. 单例服务模式

```typescript
// services/encryptedImageService.ts
class EncryptedImageService {
  private assetsManager: EncryptedAppAssetsManager;
  
  constructor() {
    // 直接使用 TypeScript 模块，不依赖全局对象
    this.assetsManager = new EncryptedAppAssetsManager();
  }
}

// 导出单例
export const encryptedImageService = new EncryptedImageService();
```

### 2. React Context 集成

```typescript
// contexts/PasswordContext.tsx
export const PasswordProvider: React.FC = ({ children }) => {
  const location = useLocation(); // React Router 官方 hook
  const [password, setPassword] = useState('');
  
  // 监听 URL 变化
  useEffect(() => {
    const passwordParam = getUrlParam('pp', '');
    setPassword(passwordParam);
  }, [location.search, location.pathname]);
  
  // 同步密码到服务
  useEffect(() => {
    encryptedImageService.setPassword(password);
  }, [password]);
  
  return (
    <PasswordContext.Provider value={{ password }}>
      {children}
    </PasswordContext.Provider>
  );
};
```

### 3. 组件使用模式

```typescript
// components/AppCard.tsx
const AppCard: React.FC = ({ app }) => {
  const password = usePasswordChange(); // 获取当前密码
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const loadImages = async () => {
      // 密码变化时自动重新加载
      const icon = await encryptedImageService.loadAppIcon(app.id);
      setIconUrl(icon);
    };
    loadImages();
  }, [app.id, password]); // password 在依赖数组中
  
  return <img src={iconUrl || '/placeholder.png'} />;
};
```

## 优势对比

### 旧架构（原生 JS + React 混合）

- ❌ 依赖全局 `window` 对象
- ❌ 手动事件监听器（`hashchange`）
- ❌ 时序问题（脚本加载顺序）
- ❌ 类型不安全（JavaScript）
- ❌ 难以测试和维护

### 新架构（纯 React）

- ✅ 使用 React Router 官方 `useLocation` hook
- ✅ 使用 React Context API 管理状态
- ✅ 使用 TypeScript 类型安全
- ✅ 自动响应 URL 变化（React Router）
- ✅ 易于测试和维护
- ✅ 完全集成到 React 生态系统

## 迁移步骤

1. ✅ 将原生 JS 类转换为 TypeScript 模块
2. ✅ 更新 `encryptedImageService` 使用新模块
3. ✅ 更新 `PasswordContext` 直接使用服务
4. ✅ 移除对全局 `window` 对象的依赖
5. ⏳ 从 `index.html` 移除原生 JS script 标签（待验证功能后）

## 测试验证

### 验证步骤

1. 访问 `http://192.168.50.3:10000/`
2. 点击链接 `href="#/apps"`
3. 检查 URL 是否包含 `?pp=BuildFactoryEncryptionKey2025`
4. 验证图片是否正确解密显示
5. 修改 URL 中的 `pp` 参数，验证图片是否重新解密

### 预期行为

- URL 变化时，`PasswordContext` 自动检测密码变化
- 密码变化时，缓存自动清除
- 组件自动重新加载图片（使用新密码）
- 所有操作通过 React 官方能力完成，无需手动事件监听

## 总结

通过使用 React 官方架构和能力，我们实现了：

1. **层次加载**：清晰的依赖关系和加载顺序
2. **动态刷新**：URL 参数变化时自动更新密码和重新解密图片
3. **类型安全**：完整的 TypeScript 类型支持
4. **易于维护**：符合 React 最佳实践，代码清晰易懂

