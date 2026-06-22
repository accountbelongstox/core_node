# Import Map 最佳实践和官方规范

## 📋 官方规范

### Import Map 标准

根据 [WICG Import Maps 规范](https://github.com/WICG/import-maps) 和 [MDN 文档](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/script/type/importmap)：

```html
<script type="importmap">
{
  "imports": {
    "模块名": "URL路径"
  }
}
</script>
```

### ✅ 当前写法符合规范

您的 `index.html` 中的写法**符合官方规范**：

```html
<script type="importmap">
{
  "imports": {
    "react": "https://aistudiocdn.com/react@^19.2.3",
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.3/"
  }
}
</script>
```

## ⚠️ 重要注意事项

### 1. 版本范围（Caret ^）的限制

**问题**：Import Map **不支持版本范围解析**

- Import Map 只是简单的 URL 映射
- 浏览器**不会解析** semver 版本范围（如 `^19.2.3`）
- `^19.2.3` 会被当作**字面字符串**处理
- CDN 服务器需要支持版本范围解析（如 esm.sh、aistudiocdn.com）

**当前状态**：
- ✅ `aistudiocdn.com` 支持版本范围解析
- ✅ 可以正常工作
- ⚠️ 但这不是 importmap 规范的一部分，依赖 CDN 的实现

### 2. 推荐做法：使用精确版本

**最佳实践**（生产环境）：

```html
<script type="importmap">
{
  "imports": {
    "react": "https://aistudiocdn.com/react@19.2.3",
    "react-dom/": "https://aistudiocdn.com/react-dom@19.2.3/",
    "react-router-dom": "https://aistudiocdn.com/react-router-dom@7.11.0"
  }
}
</script>
```

**原因**：
- ✅ 版本锁定，避免意外更新
- ✅ 更符合 importmap 的设计理念
- ✅ 不依赖 CDN 的版本解析功能

### 3. 开发环境 vs 生产环境

#### 开发环境（当前方案）
```html
<!-- 使用版本范围，方便更新 -->
"react": "https://aistudiocdn.com/react@^19.2.3"
```

**优点**：
- 快速迭代
- 自动获取补丁版本更新

**缺点**：
- 版本不锁定
- 可能引入意外更新

#### 生产环境（推荐）
```html
<!-- 使用精确版本，确保稳定性 -->
"react": "https://aistudiocdn.com/react@19.2.3"
```

**优点**：
- 版本锁定
- 可预测的行为
- 符合生产环境最佳实践

## 🔄 与 Vite 的关系

### 当前架构

您同时使用了：
1. **Vite** - 构建工具（`vite.config.ts`）
2. **Import Map** - 浏览器原生模块映射

### 建议

#### 方案 A：纯 Vite 打包（推荐用于生产）

**移除 importmap，使用 Vite 打包**：

```bash
# 构建生产版本
pnpm run build

# Vite 会将所有依赖打包到 dist/
# 无需 importmap，无需 CDN
```

**优点**：
- ✅ 所有依赖打包在一起，加载更快
- ✅ 无外部 CDN 依赖
- ✅ 版本完全锁定
- ✅ 支持代码分割和优化

#### 方案 B：保留 Import Map（开发环境）

**保留 importmap 用于开发**：

```html
<!-- 开发环境：使用 importmap 快速开发 -->
<script type="importmap">
{
  "imports": {
    "react": "https://aistudiocdn.com/react@^19.2.3"
  }
}
</script>
```

**优点**：
- ✅ 快速开发，无需构建
- ✅ 热更新更快
- ✅ 适合原型开发

## 📝 官方文档参考

### Import Map 规范
- [WICG Import Maps](https://github.com/WICG/import-maps)
- [MDN Import Maps](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/script/type/importmap)

### 浏览器支持
- ✅ Chrome 89+
- ✅ Edge 89+
- ✅ Firefox 108+
- ✅ Safari 16.4+

### 不支持的浏览器
- 需要使用 polyfill：`es-module-shims`

## 🎯 推荐配置

### 开发环境（当前）

```html
<script type="importmap">
{
  "imports": {
    "lucide-react": "https://aistudiocdn.com/lucide-react@^0.562.0",
    "@google/genai": "https://aistudiocdn.com/@google/genai@^1.34.0",
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.3/",
    "recharts": "https://aistudiocdn.com/recharts@^3.6.0",
    "react/": "https://aistudiocdn.com/react@^19.2.3/",
    "react": "https://aistudiocdn.com/react@^19.2.3",
    "react-router-dom": "https://aistudiocdn.com/react-router-dom@^7.11.0"
  }
}
</script>
```

### 生产环境（推荐）

**选项 1：使用 Vite 打包（最佳）**
```bash
# 移除 importmap，使用 Vite 构建
pnpm run build
```

**选项 2：保留 importmap，使用精确版本**
```html
<script type="importmap">
{
  "imports": {
    "lucide-react": "https://aistudiocdn.com/lucide-react@0.562.0",
    "@google/genai": "https://aistudiocdn.com/@google/genai@1.34.0",
    "react-dom/": "https://aistudiocdn.com/react-dom@19.2.3/",
    "recharts": "https://aistudiocdn.com/recharts@3.6.0",
    "react/": "https://aistudiocdn.com/react@19.2.3/",
    "react": "https://aistudiocdn.com/react@19.2.3",
    "react-router-dom": "https://aistudiocdn.com/react-router-dom@7.11.0"
  }
}
</script>
```

## ✅ 总结

1. **当前写法符合官方规范** ✅
2. **版本范围（^）可用，但依赖 CDN 实现** ⚠️
3. **生产环境建议使用精确版本或 Vite 打包** 📦
4. **开发环境使用 importmap 是合理的** 🚀

## 🔗 相关文档

- [CDN 迁移说明](./CDN_MIGRATION.md)
- [字体配置说明](./FONT_SETUP.md)
- [Vite 官方文档](https://vitejs.dev/)

