# 故障排除指南

## 模块导出错误

### 错误信息
```
Uncaught SyntaxError: The requested module '/components/Auth/AuthLayout.tsx?t=1768263600652' does not provide an export named 'AuthLayout'
```

### 解决方案

#### 1. 清除 Vite 缓存
```bash
cd /www/programing/core_node/poly_apps/wordflow-ai
rm -rf node_modules/.vite dist .vite
```

#### 2. 重启开发服务器
```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
pnpm dev
# 或
npm run dev
```

#### 3. 检查导出是否正确
确保 `components/Auth/AuthLayout.tsx` 文件中有正确的导出：
```typescript
export const AuthLayout: React.FC<AuthLayoutProps> = ({ ... }) => { ... };
```

确保 `components/Auth/index.ts` 文件中有正确的重新导出：
```typescript
export { AuthLayout } from './AuthLayout';
```

#### 4. 如果问题仍然存在
- 检查文件扩展名是否正确（`.tsx` 用于 React 组件）
- 检查是否有语法错误
- 尝试删除 `node_modules` 并重新安装：
  ```bash
  rm -rf node_modules
  pnpm install
  ```

### 常见原因
1. **Vite 缓存问题** - 最常见的原因，清除缓存即可解决
2. **文件未保存** - 确保所有文件都已保存
3. **导出语法错误** - 检查导出语句是否正确
4. **模块解析问题** - 检查 `vite.config.ts` 中的路径别名配置

