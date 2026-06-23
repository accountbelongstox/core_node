# CDN 迁移说明 - 国内访问优化

## 迁移概述

将项目中的外部 CDN 从 `esm.sh` 迁移到 `aistudiocdn.com`，以提升国内访问速度和稳定性。

## 迁移内容

### Import Map CDN 迁移

**迁移前** (esm.sh):
```json
{
  "imports": {
    "lucide-react": "https://esm.sh/lucide-react@^0.562.0",
    "@google/genai": "https://esm.sh/@google/genai@^1.34.0",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "recharts": "https://esm.sh/recharts@^3.6.0",
    "react/": "https://esm.sh/react@^19.2.3/",
    "react": "https://esm.sh/react@^19.2.3",
    "react-router-dom": "https://esm.sh/react-router-dom@^7.11.0"
  }
}
```

**迁移后** (aistudiocdn.com):
```json
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
```

## CDN 选择说明

### aistudiocdn.com

- ✅ **国内访问速度快** - 针对中国网络环境优化
- ✅ **已在多个项目中使用** - 经过验证的稳定方案
- ✅ **ESM 支持** - 完全支持 ES 模块
- ✅ **版本匹配** - 与 package.json 中的版本保持一致

### 其他 CDN 选项对比

| CDN | 国内访问 | ESM 支持 | 状态 |
|-----|---------|---------|------|
| esm.sh | ❌ 慢/不稳定 | ✅ | 已迁移 |
| aistudiocdn.com | ✅ 快 | ✅ | ✅ 当前使用 |
| jsdelivr.net | ⚠️ 可能被屏蔽 | ✅ | 不推荐 |
| unpkg.com | ⚠️ 慢 | ✅ | 备选方案 |
| cdnjs.cloudflare.com | ⚠️ 慢 | ❌ | 不适用 |

## 已迁移的资源

### 1. React 生态系统
- ✅ `react@^19.2.3`
- ✅ `react-dom@^19.2.3`
- ✅ `react-router-dom@^7.11.0`

### 2. UI 库
- ✅ `lucide-react@^0.562.0` - 图标库
- ✅ `recharts@^3.6.0` - 图表库

### 3. AI 服务
- ✅ `@google/genai@^1.34.0` - Google AI SDK

## 字体资源

字体已通过 `@fontsource/inter` npm 包本地打包，无需 CDN：
- ✅ 使用 `@fontsource/inter@5.2.8`
- ✅ 在 `index.tsx` 中导入
- ✅ 通过 Vite 打包，无外部依赖

## 最佳实践建议

### 当前方案（开发环境）
- 使用 `aistudiocdn.com` 进行快速开发和测试
- 适合开发环境，快速迭代

### 生产环境建议
1. **使用 Vite 打包**（推荐）
   - 移除 importmap，使用 Vite 构建
   - 所有依赖打包到应用中
   - 无外部 CDN 依赖，最快最稳定

2. **本地 CDN 托管**
   - 将构建后的资源托管到自己的 CDN
   - 完全控制版本和更新

## 验证方法

### 检查 CDN 加载
1. 打开浏览器开发者工具
2. 查看 Network 标签
3. 确认所有请求都来自 `aistudiocdn.com`
4. 检查加载时间（应该比 esm.sh 快）

### 检查版本匹配
```bash
# 检查 package.json 中的版本
cat package.json | grep -E "(react|lucide|recharts|@google/genai)"

# 对比 index.html 中的版本
grep -E "(react|lucide|recharts|@google/genai)" index.html
```

## 故障排除

### 如果 aistudiocdn.com 无法访问

1. **检查网络连接**
   ```bash
   curl -I https://aistudiocdn.com/react@^19.2.3
   ```

2. **使用备选方案**
   - 临时使用 `unpkg.com`（可能较慢）
   - 或切换到 Vite 打包方案

3. **联系管理员**
   - 检查 CDN 服务状态
   - 考虑使用本地打包方案

## 相关文档

- [字体配置说明](./FONT_SETUP.md)
- [Vite 配置文档](https://vitejs.dev/)
- [Import Maps 规范](https://github.com/WICG/import-maps)

## 更新日期

- **2025-01-05**: 完成 esm.sh -> aistudiocdn.com 迁移

