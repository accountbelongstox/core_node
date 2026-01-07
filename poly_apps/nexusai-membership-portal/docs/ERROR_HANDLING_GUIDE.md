# 统一错误处理指南

## 📋 概述

项目已建立统一的错误处理和 Toast 通知系统，所有 API 调用都应使用统一的错误处理，避免在代码中到处写 `throw new Error` 或 `console.error`。

## 🎯 核心组件

### 1. Toast 系统 (`utils/toast.tsx`)

提供统一的 Toast 通知组件：

```tsx
import { ToastProvider, useToast } from './utils/toast';

// 在 App.tsx 中使用
<ToastProvider position="top-right" maxToasts={5}>
  <App />
</ToastProvider>

// 在组件中使用
const { success, error, warning, info } = useToast();
error('操作失败', '错误');
success('操作成功');
```

### 2. 错误处理器 (`utils/errorHandler.ts`)

统一处理所有错误：

```typescript
import { ErrorHandler } from './utils/errorHandler';

// 处理 API 响应
const data = ErrorHandler.handleApiResponse(response, '获取数据');

// 处理异常
ErrorHandler.handleError(error, '操作', true);

// 显示成功消息
ErrorHandler.handleSuccess('操作成功');
```

### 3. API 包装器 (`utils/apiWrapper.ts`)

简化 API 调用和错误处理：

```typescript
import { ApiWrapper } from './utils/apiWrapper';

// 方式1: 返回数据或 null（自动显示错误 Toast）
const data = await ApiWrapper.wrap(
  () => apiClient.get<User>('/users/profile'),
  '获取用户资料',
  true // 显示 Toast
);

// 方式2: 失败时抛出错误（用于需要处理错误的场景）
const data = await ApiWrapper.wrapOrThrow(
  () => apiClient.get<User>('/users/profile'),
  '获取用户资料'
);

// 方式3: 返回完整响应对象
const response = await ApiWrapper.wrapResponse(
  () => apiClient.get<User>('/users/profile'),
  '获取用户资料'
);
```

## ✅ 正确的使用方式

### 在 API 服务中

**❌ 错误方式**:
```typescript
async getById(id: string): Promise<ApiKey> {
  const response = await apiClient.get<ApiKey>(`/admin/api-keys/${id}`);
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.message || 'Failed to fetch API key');
}
```

**✅ 正确方式**:
```typescript
async getById(id: string): Promise<ApiKey | null> {
  return ApiWrapper.wrap(
    () => apiClient.get<ApiKey>(`/admin/api-keys/${id}`),
    '获取 API Key',
    true
  );
}
```

### 在组件中

**❌ 错误方式**:
```tsx
try {
  const data = await apiKeyService.getAll();
  setKeys(data);
} catch (error) {
  console.error('Failed to fetch keys:', error);
  alert('获取失败');
}
```

**✅ 正确方式**:
```tsx
const loadKeys = async () => {
  const data = await apiKeyService.getAll();
  if (data) {
    setKeys(data.keys);
  }
  // 错误已由 ApiWrapper 自动处理并显示 Toast
};
```

## 📝 迁移指南

### 步骤 1: 更新 API 服务

将所有 `throw new Error` 替换为 `ApiWrapper.wrap`：

```typescript
// 旧代码
async getAll(): Promise<ApiKey[]> {
  const response = await apiClient.get<ApiKey[]>('/admin/api-keys');
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.message || 'Failed');
}

// 新代码
async getAll(): Promise<ApiKey[] | null> {
  return ApiWrapper.wrap(
    () => apiClient.get<ApiKey[]>('/admin/api-keys'),
    '获取 API Keys',
    true
  );
}
```

### 步骤 2: 更新组件调用

移除 try-catch，直接使用返回的数据：

```typescript
// 旧代码
try {
  const keys = await apiKeyService.getAll();
  setKeys(keys);
} catch (error) {
  console.error(error);
}

// 新代码
const keys = await apiKeyService.getAll();
if (keys) {
  setKeys(keys);
}
```

## 🎨 Toast 类型

- **success**: 成功操作（绿色）
- **error**: 错误信息（红色，默认 6 秒）
- **warning**: 警告信息（黄色）
- **info**: 提示信息（蓝色）

## ⚠️ 注意事项

1. **不要在 API 服务中 throw Error**：使用 `ApiWrapper.wrap` 返回 `null` 或数据
2. **不要在组件中写 try-catch**：错误已由统一处理器处理
3. **需要特殊处理时**：使用 `ApiWrapper.wrapOrThrow` 或 `ApiWrapper.wrapResponse`
4. **静默错误**：设置 `showToast: false` 来静默处理错误

## 📚 示例

完整示例请参考：
- `services/api/authService.ts` - 认证服务示例
- `services/api/apiKeyService.ts` - API Key 服务示例

