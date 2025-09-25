<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Nuxt 多应用入口开发指南

## 概述

本项目采用**外挂脚本动态替换**的方式实现多应用入口切换，确保SEO友好的硬编码入口文件。每个应用都有独立的命名空间首页文件，通过前置脚本在构建/开发时动态替换 `pages/index.vue`。

## 架构设计

### 核心理念
- **SEO优化**: 服务端硬编码入口文件，确保搜索引擎友好
- **开发便利**: 通过脚本自动化切换，开发者无需手动操作
- **命名空间**: 每个应用有独立的 `index.{appname}.vue` 文件
- **外挂机制**: 构建时动态替换，不依赖运行时逻辑

### 文件结构
```
poly_apps/nuxt_main/
├── pages/
│   ├── index.vue                 # 动态替换的入口文件（不要直接编辑）
│   ├── index.example.vue         # Example应用首页
│   ├── index.codemart.vue        # CodeMart应用首页
│   ├── index.dev.vue             # Dev Tools应用首页
│   ├── index.admin.vue           # Admin应用首页
│   └── index.dashboard.vue       # Dashboard应用首页
├── scripts/
│   └── switch-app-entry.js       # 应用切换脚本
├── .app-backups/                 # 自动备份目录
└── package.json                  # 包含前置脚本的命令
```

## 支持的应用

| 应用名称 | 命名空间 | 首页文件 | 开发命令 |
|---------|---------|----------|----------|
| Example | example | index.example.vue | `yarn dev:example` |
| CodeMart | codemart | index.codemart.vue | `yarn dev:codemart` |
| Dev Tools | dev | index.dev.vue | `yarn dev:dev` |
| Admin | admin | index.admin.vue | `yarn dev:admin` |
| Dashboard | dashboard | index.dashboard.vue | `yarn dev:dashboard` |

## 使用方法

### 开发环境

```bash
# 启动不同应用的开发服务器
yarn dev:example      # 启动 Example 应用
yarn dev:codemart     # 启动 CodeMart 应用
yarn dev:dev          # 启动 Dev Tools 应用
yarn dev:admin        # 启动 Admin 应用
yarn dev:dashboard    # 启动 Dashboard 应用
```

### 生产构建

```bash
# 构建不同应用
yarn build:example      # 构建 Example 应用
yarn build:codemart     # 构建 CodeMart 应用
yarn build:dev          # 构建 Dev Tools 应用
yarn build:admin        # 构建 Admin 应用
yarn build:dashboard    # 构建 Dashboard 应用
```

### 静态生成

```bash
# 生成静态站点
yarn generate:example      # 生成 Example 应用静态站点
yarn generate:codemart     # 生成 CodeMart 应用静态站点
yarn generate:dev          # 生成 Dev Tools 应用静态站点
yarn generate:admin        # 生成 Admin 应用静态站点
yarn generate:dashboard    # 生成 Dashboard 应用静态站点
```

## 脚本工具

### 应用切换脚本

`scripts/switch-app-entry.js` 提供了强大的应用切换功能：

```bash
# 基本用法
node scripts/switch-app-entry.js <appname>

# 查看当前应用
node scripts/switch-app-entry.js --current

# 列出可用备份
node scripts/switch-app-entry.js --list

# 显示帮助
node scripts/switch-app-entry.js --help

# 从备份恢复
node scripts/switch-app-entry.js --restore <backup-file>
```

### 脚本功能特性

1. **自动备份**: 切换前自动备份当前 `index.vue`，使用时间戳作为备份文件名
2. **智能检测**: 避免备份占位符文件
3. **复制替换**: 将源文件复制到目标位置，而不是移动
4. **时间戳命名**: 备份文件格式为 `index.backup.{timestamp}.vue`
5. **错误处理**: 完善的错误检查和用户提示
6. **彩色输出**: 友好的控制台输出界面
7. **生成标记**: 自动在生成的文件中添加来源和时间标记

## 工作原理

### 1. 脚本执行流程

```
运行 yarn dev:appname
    ↓
执行前置脚本 (npm run switch-app appname)
    ↓
检查源文件存在 (pages/index.appname.vue)
    ↓
备份当前 index.vue (如果不是占位符)
    ↓
复制 index.appname.vue 到 index.vue
    ↓
添加生成标记注释
    ↓
启动 Nuxt 开发服务器
```

### 2. 文件替换机制

- **源文件**: `pages/index.{appname}.vue`
- **目标文件**: `pages/index.vue`
- **备份位置**: `.app-backups/index.backup.{timestamp}.vue`
- **生成标记**: 自动添加注释标识文件来源和生成时间
- **备份命名**: 使用 ISO 时间戳格式，如 `index.backup.2025-08-18T20-26-34-406Z.vue`

### 3. 架构优化

**移除的组件**:
- ❌ `AppSwitcher.vue` - 已移除，不再需要运行时应用切换组件
- ❌ 页面内切换按钮 - 已替换为命令行说明信息
- ❌ 中间件重定向 - 不再使用运行时重定向机制

**保留的功能**:
- ✅ 外挂脚本切换 - 构建时动态替换入口文件
- ✅ 命名空间文件 - 每个应用独立的首页文件
- ✅ SEO优化 - 硬编码入口文件确保搜索引擎友好

### 4. Package.json 脚本集成

```json
{
  "scripts": {
    "switch-app": "node scripts/switch-app-entry.js",
    "dev:example": "npm run switch-app example && cross-env APP_ENTRY=example nuxt dev",
    "build:example": "npm run switch-app example && cross-env APP_ENTRY=example nuxt build"
  }
}
```

## 开发规范

### 1. 创建新应用

1. **创建首页文件**:
   ```bash
   # 创建新应用的首页文件
   cp pages/index.example.vue pages/index.newapp.vue
   ```

2. **编辑应用内容**:
   ```vue
   <!-- pages/index.newapp.vue -->
   <template>
     <div>
       <!-- 新应用的首页内容 -->
     </div>
   </template>
   ```

3. **更新脚本配置**:
   ```javascript
   // scripts/switch-app-entry.js
   const SUPPORTED_APPS = ['example', 'codemart', 'dev', 'admin', 'dashboard', 'newapp'];
   ```

4. **添加 package.json 脚本**:
   ```json
   {
     "dev:newapp": "npm run switch-app newapp && cross-env APP_ENTRY=newapp nuxt dev",
     "build:newapp": "npm run switch-app newapp && cross-env APP_ENTRY=newapp nuxt build"
   }
   ```

### 2. 编辑应用首页

⚠️ **重要**: 永远不要直接编辑 `pages/index.vue`，它会被脚本覆盖！

```bash
# 正确的编辑方式
# 编辑对应的命名空间文件
vim pages/index.example.vue    # 编辑 Example 应用首页
vim pages/index.dev.vue        # 编辑 Dev Tools 应用首页
```

### 3. 调试和故障排除

```bash
# 查看当前激活的应用
yarn switch-app --current

# 查看可用备份
yarn switch-app --list

# 手动切换应用（不启动服务器）
yarn switch-app dev

# 从备份恢复
yarn switch-app --restore index.backup.2024-01-01T10-00-00-000Z.vue
```

## 最佳实践

### 1. 开发流程

1. **确定目标应用**: 明确要开发的应用类型
2. **编辑命名空间文件**: 修改 `pages/index.{appname}.vue`
3. **启动开发服务器**: 运行 `yarn dev:{appname}`
4. **测试验证**: 确保应用正常工作
5. **构建部署**: 运行 `yarn build:{appname}`

### 2. 团队协作

- **版本控制**: 提交所有 `index.{appname}.vue` 文件
- **忽略文件**: `.gitignore` 应包含 `.app-backups/`
- **文档更新**: 新增应用时更新本指南
- **代码审查**: 重点检查命名空间文件的修改

### 3. 部署注意事项

- **构建前切换**: 确保构建前运行了正确的切换脚本
- **环境变量**: 生产环境设置正确的 `APP_ENTRY`
- **静态生成**: 使用 `generate:{appname}` 命令生成静态站点
- **CDN缓存**: 注意清理CDN缓存以确保更新生效

## 故障排除

### 常见问题

1. **index.vue 内容不正确**
   ```bash
   # 检查当前应用
   yarn switch-app --current

   # 手动切换到正确应用
   yarn switch-app correct-app-name
   ```

2. **源文件不存在**
   ```bash
   # 错误: Source file not found: pages/index.appname.vue
   # 解决: 创建对应的命名空间文件
   cp pages/index.example.vue pages/index.appname.vue
   ```

3. **备份文件过多**
   ```bash
   # 清理旧备份（保留最近10个）
   ls -t .app-backups/ | tail -n +11 | xargs -I {} rm .app-backups/{}
   ```

4. **Tailwind CSS 错误**
   ```bash
   # 错误: Cannot apply unknown utility class `p-4`
   # 原因: 旧的 AppSwitcher 组件已被移除
   # 解决: 确保没有引用已删除的组件
   ```

### 调试技巧

- 使用 `--current` 参数检查当前状态
- 查看 `index.vue` 顶部的生成注释
- 检查 `.app-backups/` 目录的备份文件
- 使用 `--list` 查看可用的备份选项

## 扩展和定制

### 添加新的应用类型

1. 在 `SUPPORTED_APPS` 数组中添加新应用名
2. 创建对应的 `index.{appname}.vue` 文件
3. 在 `package.json` 中添加相应脚本
4. 更新本文档的应用列表

### 自定义脚本行为

可以通过修改 `scripts/switch-app-entry.js` 来自定义：
- 备份策略
- 文件命名规则
- 错误处理逻辑
- 输出格式

---

## 总结

这个多应用入口系统通过外挂脚本实现了：
- ✅ SEO友好的硬编码入口
- ✅ 开发时的便利切换
- ✅ 清晰的命名空间管理
- ✅ 自动化的备份机制
- ✅ 完善的错误处理

遵循本指南可以确保多应用开发的一致性和可维护性。

---

## ⚠️ CRITICAL: Tailwind CSS v4 Migration Notes

**ATTENTION ALL AIs: READ THIS BEFORE MAKING ANY CSS CHANGES**

This project has been upgraded to **Tailwind CSS v4**. The following changes are MANDATORY and BREAKING:

### 🚫 FORBIDDEN in Tailwind CSS v4:
1. **NO `@apply` directives** - These are completely removed in v4
2. **NO `tailwind.config.js` file** - Configuration is now done via CSS
3. **NO `@tailwind` directives** - Use `@import "tailwindcss"` instead

### ✅ REQUIRED in Tailwind CSS v4:
1. **Use CSS custom properties** instead of `@apply`
2. **Use `@theme` directive** for theme customization
3. **Use `@import "tailwindcss"`** at the top of CSS files
4. **Use standard CSS properties** with Tailwind's CSS variables

### 🔧 Migration Examples:

**WRONG (v3 syntax):**
```css
.btn-primary {
    @apply bg-primary text-white px-4 py-2;
}
```

**CORRECT (v4 syntax):**
```css
.btn-primary {
    background-color: var(--color-primary-DEFAULT);
    color: white;
    padding: 0.5rem 1rem;
}
```

### 🎨 Theme Variables:
Use these CSS custom properties for colors:
- `var(--color-primary-DEFAULT)`
- `var(--color-secondary-DEFAULT)`
- `var(--color-success-DEFAULT)`
- `var(--color-danger-DEFAULT)`
- `var(--color-warning-DEFAULT)`
- `var(--color-info-DEFAULT)`
- `var(--color-dark-DEFAULT)`

### 🚨 CRITICAL ERRORS TO AVOID:
1. **DO NOT** add `@apply` directives - this will break the build
2. **DO NOT** create `tailwind.config.js` - this is obsolete
3. **DO NOT** use `@tailwind base/components/utilities` - use `@import "tailwindcss"`
4. **DO NOT** ignore CSS custom property syntax - use `var()` functions

### 📋 Checklist Before CSS Changes:
- [ ] No `@apply` directives used
- [ ] CSS custom properties used for theme colors
- [ ] Standard CSS properties used instead of Tailwind utilities in custom CSS
- [ ] Dark mode handled with `.dark` class selectors
- [ ] RTL support handled with `[dir="rtl"]` selectors

### 🔍 Common Error Patterns:
- `Cannot apply unknown utility class 'p-4'` = You used `@apply` directive
- `@tailwind directive not found` = You used old v3 import syntax
- `Unknown at-rule @apply` = You used forbidden `@apply` directive

**IF YOU SEE THESE ERRORS: STOP AND FIX THE CSS SYNTAX IMMEDIATELY**

### 📁 Files Already Fixed:
- `assets/css/tailwind.css` - All `@apply` directives converted to standard CSS
- `assets/css/app.css` - Import structure updated for v4

### 🛠️ What Was Fixed:
1. Converted all `@apply` directives to standard CSS properties
2. Used CSS custom properties for theme colors
3. Maintained dark mode support with `.dark` selectors
4. Preserved RTL support with `[dir="rtl"]` selectors
5. Updated button, form, table, and component styles

**REMEMBER: Tailwind CSS v4 is a BREAKING change. Always use standard CSS properties with CSS custom properties instead of `@apply` directives.**

---
