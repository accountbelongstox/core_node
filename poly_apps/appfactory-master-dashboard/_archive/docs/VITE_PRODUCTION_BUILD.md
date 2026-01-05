# Vite 生产构建配置指南

## ✅ 已实施的方案：纯 Vite 打包

项目已配置为使用 **纯 Vite 打包**，所有依赖通过 npm 安装并打包，无需 importmap 或外部 CDN。

## 🎯 配置说明

### 1. 移除 Import Map

**之前**（使用 importmap）：
```html
<script type="importmap">
{
  "imports": {
    "react": "https://aistudiocdn.com/react@^19.2.3"
  }
}
</script>
```

**现在**（纯 Vite 打包）：
```html
<!-- 所有依赖通过 Vite 打包，无需 importmap -->
```

### 2. Vite 配置优化

`vite.config.ts` 已配置以下优化：

#### 代码分割（Code Splitting）
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'ui-vendor': ['lucide-react', 'recharts', 'sonner'],
  'ai-vendor': ['@google/genai'],
}
```

**优势**：
- ✅ 更好的缓存策略
- ✅ 并行加载多个 chunk
- ✅ 减少重复代码

#### 依赖预构建优化
```typescript
optimizeDeps: {
  include: [
    'react', 'react-dom', 'react-router-dom',
    'lucide-react', 'recharts', 'sonner',
    '@google/genai', '@fontsource/inter',
  ],
}
```

**优势**：
- ✅ 开发环境启动更快
- ✅ 依赖预构建缓存
- ✅ 减少运行时解析时间

## 📦 构建命令

### 开发环境
```bash
pnpm run dev
```
- 使用 Vite 开发服务器
- 热模块替换（HMR）
- 快速启动

### 生产构建
```bash
pnpm run build
```
- 构建优化后的生产版本
- 代码压缩和混淆
- 输出到 `dist/` 目录

### 预览生产构建
```bash
pnpm run preview
```
- 本地预览生产构建
- 验证构建结果

## 🚀 构建输出

### 目录结构
```
dist/
├── index.html          # 入口 HTML
├── assets/
│   ├── index-[hash].js      # 主应用代码
│   ├── react-vendor-[hash].js    # React 相关库
│   ├── ui-vendor-[hash].js       # UI 库
│   ├── ai-vendor-[hash].js       # AI 库
│   └── index-[hash].css          # 样式文件
└── ...
```

### 文件命名
- 使用内容哈希（content hash）
- 自动缓存失效
- 长期缓存支持

## ✅ 优势总结

### 1. 性能优势
- ✅ **更快的加载速度** - 所有资源打包在一起
- ✅ **代码分割** - 按需加载，减少初始加载时间
- ✅ **Tree Shaking** - 移除未使用的代码
- ✅ **压缩优化** - 生产版本自动压缩

### 2. 可靠性优势
- ✅ **无外部依赖** - 不依赖 CDN 可用性
- ✅ **版本锁定** - 通过 package.json 锁定版本
- ✅ **离线可用** - 所有资源本地化
- ✅ **一致性** - 开发和生产环境一致

### 3. 维护优势
- ✅ **统一管理** - 所有依赖在 package.json
- ✅ **易于更新** - 只需更新 package.json
- ✅ **类型安全** - TypeScript 支持完整
- ✅ **调试友好** - Source maps 支持

## 🔍 验证构建

### 检查构建输出
```bash
# 构建项目
pnpm run build

# 查看构建输出
ls -lh dist/assets/

# 检查文件大小
du -sh dist/
```

### 检查依赖
```bash
# 确认所有依赖已安装
pnpm install

# 检查依赖版本
pnpm list --depth=0
```

### 测试生产构建
```bash
# 预览生产构建
pnpm run preview

# 在浏览器中打开
# 检查 Network 标签，确认没有外部 CDN 请求
```

## 📊 性能对比

### Import Map 方案
- ❌ 需要多个 HTTP 请求（每个包一个）
- ❌ 依赖 CDN 可用性
- ❌ 版本可能不一致
- ❌ 网络延迟影响加载

### Vite 打包方案（当前）
- ✅ 单个或少量 HTTP 请求
- ✅ 无外部依赖
- ✅ 版本完全锁定
- ✅ 本地加载，无网络延迟

## 🛠️ 故障排除

### 问题 1: 构建失败

**症状**：`pnpm run build` 失败

**解决方案**：
```bash
# 清理缓存
rm -rf node_modules/.vite
rm -rf dist

# 重新安装依赖
pnpm install

# 重新构建
pnpm run build
```

### 问题 2: 依赖未找到

**症状**：`Cannot find module 'xxx'`

**解决方案**：
```bash
# 检查 package.json 中是否有该依赖
grep "xxx" package.json

# 如果没有，安装它
pnpm add xxx

# 重新构建
pnpm run build
```

### 问题 3: 文件过大

**症状**：构建后的文件很大

**解决方案**：
- 检查 `vite.config.ts` 中的代码分割配置
- 使用动态导入（`import()`）进行懒加载
- 检查是否有未使用的依赖

## 📚 相关文档

- [Vite 官方文档](https://vitejs.dev/)
- [Vite 构建优化](https://vitejs.dev/guide/build.html)
- [Import Map 最佳实践](./IMPORTMAP_BEST_PRACTICES.md)
- [CDN 迁移说明](./CDN_MIGRATION.md)

## 🎉 总结

项目已成功迁移到纯 Vite 打包方案：

1. ✅ 移除了 importmap
2. ✅ 所有依赖通过 npm 管理
3. ✅ Vite 配置已优化
4. ✅ 生产构建已配置代码分割
5. ✅ 无外部 CDN 依赖

**下一步**：运行 `pnpm run build` 构建生产版本！

