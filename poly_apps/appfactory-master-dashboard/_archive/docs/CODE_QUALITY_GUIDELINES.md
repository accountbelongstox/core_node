# 代码质量指南

## 强类型和冗余代码消除

### 1. 工具类库封装

#### URL 参数工具 (`utils/urlParams.ts`)
**原因**：HashRouter 环境下，URL 参数位于 hash 中（`#/path?param=value`），而不是 search 中。必须使用此工具类来正确提取参数，避免重复代码。

**使用示例**：
```typescript
import { getUrlParam, getUrlParamOrNull } from './utils/urlParams';

// 获取参数，带默认值
const password = getUrlParam('pwd', '');

// 获取参数，可能为 null
const user = getUrlParamOrNull('user');
```

### 2. 必须使用 `||`（逻辑或运算符）的地方

以下情况**必须**使用 `||`，因为它们是逻辑或运算符，不是空值合并：

1. **条件判断中的逻辑或**
   ```typescript
   // ✅ 正确：逻辑或运算符
   if (!selectedAppId || !downloadUrl) {
     return;
   }
   
   // ✅ 正确：逻辑或运算符
   disabled={!appName || !description || isGeneratingSuggestions}
   
   // ✅ 正确：逻辑或运算符
   app.status === AppStatus.LIVE || app.status === AppStatus.PENDING
   ```

2. **字符串拼接中的逻辑或**
   ```typescript
   // ✅ 正确：逻辑或运算符
   const currentPath = hashPath.replace('#', '') || '/';
   ```

### 3. 必须使用 `?.`（可选链）的地方

以下情况**必须**使用 `?.`，因为对象可能为 null/undefined：

1. **动态加载的对象方法调用**
   ```typescript
   // ✅ 正确：assetsManager 可能为 null（初始化失败、脚本未加载等）
   if (this.assetsManager?.revokeAllUrls) {
     this.assetsManager.revokeAllUrls();
   }
   ```

2. **用户信息可能为 null**
   ```typescript
   // ✅ 正确：user 可能为 null（未登录）
   const tech = techTeam.find(t => t.id === (user?.id ?? 'tech1'));
   ```

3. **数组元素可能为 undefined**
   ```typescript
   // ✅ 正确：数组元素可能不存在
   const todayRevenue = dailyStats[0]?.revenue ?? 0;
   ```

### 4. 必须使用 `??`（空值合并运算符）的地方

以下情况**必须**使用 `??`，而不是 `||`：

1. **区分 null/undefined 和 falsy 值**
   ```typescript
   // ✅ 正确：0 是有效值，不应被替换
   const revenue = cs.totalEarnings ?? 0;
   
   // ❌ 错误：如果 totalEarnings 为 0，会被替换为默认值
   const revenue = cs.totalEarnings || 0;
   ```

2. **字符串默认值**
   ```typescript
   // ✅ 正确：空字符串是有效值
   const name = app?.name ?? 'Unknown App';
   ```

### 5. 必须保留 catch 代码的地方

以下情况**必须**保留 catch 代码：

1. **异步文件加载** (`services/encryptedImageService.ts`)
   - **原因**：网络错误、文件不存在、解密失败等
   - **处理**：返回错误图片或 null

2. **外部 API 调用** (`services/geminiService.ts`, `services/apiService.ts`)
   - **原因**：网络错误、API 限制、服务不可用等
   - **处理**：返回 null 或使用 mock 数据回退

3. **localStorage 操作** (`services/storageService.ts`)
   - **原因**：存储空间满、隐私模式、跨域等
   - **处理**：返回默认值或静默失败

4. **健康检查请求** (`services/ApiManager.ts`)
   - **原因**：网络错误、超时、服务器不可达等
   - **处理**：标记端点不可用

### 6. 类型定义

#### EncryptedAppAssetsManager 类型 (`types/encryptedAssets.ts`)
**原因**：EncryptedAppAssetsManager 是全局 JavaScript 类，无法直接导入。必须使用 declare 声明类型，避免使用 any。

### 7. 已消除的冗余代码

1. **移除所有 `|| []` 和 `|| {}`**
   - `modelService` 现在保证返回非空数组/对象
   - 使用强类型确保返回值类型

2. **移除不必要的可选链**
   - 在确定对象存在的地方，直接访问属性

3. **统一使用 `??` 替代 `||`**
   - 区分 null/undefined 和 falsy 值（0, '', false）

4. **移除不必要的类型断言**
   - 使用明确的类型定义替代 `as any`

### 8. 代码质量检查清单

- [x] 所有 `any` 类型已替换为具体类型
- [x] 所有 `||` 用于默认值的地方已替换为 `??`
- [x] 所有 `|| []` 和 `|| {}` 已移除
- [x] URL 参数提取已封装为工具类
- [x] 所有 catch 代码已添加必要性注释
- [x] 所有必要的 `?.` 和 `||` 已添加注释说明原因

