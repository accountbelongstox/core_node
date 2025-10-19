# 主题和样式开发规范

## 架构概述

本项目采用**主主题 + 子APP扩展主题**的架构模式，确保样式的统一性和可维护性。

```
主主题 (common/styles/theme-base.css)
  │
  ├── 子APP主题 (apps/app_*/styles_app_*/theme-*.css)
  │   └── 页面组件 (使用 class 引用，禁止定义 style)
  │
  └── 公共组件 (使用主主题变量)
```

## 核心原则

### 1. 主主题 (theme-base.css)

**位置**: `poly_apps/nuxt_main/common/styles/theme-base.css`

**职责**:
- 定义所有公共的 CSS 变量
- 提供基础的颜色系统、间距系统、字体系统等
- 包含通用的工具类
- 所有子 APP 都继承此主题

**规范**:
```css
/* ✅ 正确: 在主主题中定义 CSS 变量 */
:root {
  --primary-color: #4361ee;
  --spacing-md: 16px;
  --font-size-md: 16px;
}
```

### 2. 子APP扩展主题

**位置**: `poly_apps/nuxt_main/apps/app_*/styles_app_*/theme-*.css`

**职责**:
- 继承主主题
- 定义子 APP 专属的 CSS 变量
- 定义子 APP 专属的通用组件样式
- 不能覆盖主主题的变量（除非有明确的业务需求）

**规范**:
```css
/* ✅ 正确: 在子APP主题中扩展专属变量 */
:root {
  --codemart-primary: #4361ee;
  --codemart-project-draft: #9e9e9e;
}

/* ✅ 正确: 定义子APP通用组件样式 */
.codemart-card {
  background: var(--card-bg);
  padding: var(--spacing-lg);
}
```

```css
/* ❌ 错误: 不要覆盖主主题变量 */
:root {
  --primary-color: #ff0000; /* 不要这样做! */
}
```

### 3. 页面组件样式

**严格规范**: **页面组件中禁止使用 `<style>` 标签**

#### ✅ 正确做法

1. **使用 class 引用主题样式**:
```vue
<!--
  【开发规范】
  - 禁止在此组件中定义 <style> 标签
  - 所有样式通过 class 引用主题变量
  - 主题文件: common/styles/theme-base.css
  - 扩展主题: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-container">
    <h1 class="codemart-section-title">{{ title }}</h1>
    <div class="codemart-card">
      <button class="codemart-btn codemart-btn-primary">
        Click Me
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 组件逻辑
</script>

<!-- 无 <style> 标签 -->
```

2. **动态样式使用 inline style 和 CSS 变量**:
```vue
<template>
  <div :style="{ color: 'var(--codemart-primary)' }">
    Dynamic color
  </div>
</template>
```

#### ❌ 错误做法

```vue
<!-- ❌ 错误: 不要在页面组件中定义 style -->
<template>
  <div class="my-component">Content</div>
</template>

<style scoped>
/* 禁止这样做! */
.my-component {
  padding: 20px;
  background: #fff;
}
</style>
```

## 样式文件结构

```
poly_apps/nuxt_main/
├── common/
│   └── styles/
│       └── theme-base.css          # 主主题
│
├── apps/
│   ├── app_codemart/
│   │   └── styles_app_codemart/
│   │       └── theme-codemart.css  # CodeMart 扩展主题
│   │
│   ├── app_admin/
│   │   └── styles_app_admin/
│   │       └── theme-admin.css     # Admin 扩展主题
│   │
│   └── app_dashboard/
│       └── styles_app_dashboard/
│           └── theme-dashboard.css # Dashboard 扩展主题
│
└── nuxt.config.ts                  # 导入主题文件
```

## Nuxt 配置

在 `nuxt.config.ts` 中导入主题文件:

```typescript
export default defineNuxtConfig({
  css: [
    // 主主题 - 必须首先加载
    '~/common/styles/theme-base.css',

    // 子APP主题 - 根据 APP_ENTRY 动态加载
    process.env.APP_ENTRY === 'codemart'
      ? '~/apps/app_codemart/styles_app_codemart/theme-codemart.css'
      : null,

    // 其他全局样式
    '~/assets/css/app.css',
  ].filter(Boolean),
});
```

## 主题变量命名规范

### 主主题变量命名

```css
/* 颜色 */
--primary-color
--success-color
--error-color

/* 间距 */
--spacing-xs
--spacing-sm
--spacing-md

/* 字体 */
--font-size-sm
--font-weight-bold

/* 状态 */
--status-active-bg
--status-active-color
```

### 子APP变量命名

**格式**: `--{app-name}-{category}-{variant}`

```css
/* CodeMart 专属 */
--codemart-primary
--codemart-project-draft
--codemart-task-pending

/* Admin 专属 */
--admin-primary
--admin-sidebar-bg
--admin-menu-active

/* Dashboard 专属 */
--dashboard-primary
--dashboard-chart-color-1
--dashboard-widget-bg
```

## CSS 类命名规范

### 主主题类命名

```css
/* 通用工具类 */
.container
.text-primary
.btn
.card

/* 布局类 */
.flex
.grid
.hide-mobile
```

### 子APP类命名

**格式**: `{app-name}-{component}-{variant}`

```css
/* CodeMart */
.codemart-container
.codemart-card
.codemart-btn-primary
.codemart-project-card

/* Admin */
.admin-container
.admin-sidebar
.admin-menu-item

/* Dashboard */
.dashboard-container
.dashboard-widget
.dashboard-chart
```

## 暗色主题支持

所有主题都应支持暗色模式:

```css
/* 主主题 */
:root {
  --bg-primary: #ffffff;
  --text-primary: #3b3f5c;
}

[data-theme='dark'] {
  --bg-primary: #0e1726;
  --text-primary: #e0e6ed;
}

/* 子APP扩展 */
:root {
  --codemart-card-bg: var(--card-bg); /* 继承主主题 */
}

[data-theme='dark'] {
  --codemart-card-bg: #1b2e4b; /* 可以覆盖暗色模式 */
}
```

## 响应式设计

使用主主题定义的断点:

```css
/* 主主题中定义 */
@media (max-width: 767px) {
  .hide-mobile {
    display: none;
  }
}

@media (min-width: 768px) {
  .hide-desktop {
    display: none;
  }
}

/* 子APP中使用 */
@media (max-width: 768px) {
  .codemart-container {
    padding: var(--spacing-md);
  }
}
```

## 必须遵守的规则

### ✅ DO (必须做)

1. **所有颜色、间距、字体都使用 CSS 变量**
2. **页面组件只使用 `class` 引用样式，不定义 `<style>`**
3. **新的通用样式添加到主主题**
4. **新的子APP专属样式添加到子APP主题**
5. **在组件顶部添加开发规范注释**
6. **支持暗色主题**
7. **使用语义化的类名**

### ❌ DON'T (禁止做)

1. **❌ 不要在页面组件中定义 `<style>` 标签**
2. **❌ 不要使用硬编码的颜色值（如 `#fff`, `#000`）**
3. **❌ 不要使用硬编码的间距值（如 `padding: 20px`）**
4. **❌ 不要在子APP主题中覆盖主主题变量（除非有明确需求）**
5. **❌ 不要在公共组件中引用子APP专属变量**
6. **❌ 不要重复定义相同的样式**

## 迁移旧代码

如果现有组件中有 `<style>` 标签，需要迁移:

### 步骤1: 提取样式到主题文件

```vue
<!-- 旧代码 -->
<template>
  <div class="my-card">Content</div>
</template>

<style scoped>
.my-card {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}
</style>
```

### 步骤2: 迁移到主题文件

```css
/* apps/app_codemart/styles_app_codemart/theme-codemart.css */
.codemart-card {
  padding: var(--spacing-lg);
  background: var(--card-bg);
  border-radius: var(--radius-md);
}
```

### 步骤3: 更新组件

```vue
<!-- 新代码 -->
<!--
  【开发规范】
  - 禁止在此组件中定义 <style> 标签
  - 所有样式通过 class 引用主题变量
  - 主题文件: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-card">Content</div>
</template>

<script setup lang="ts">
// 组件逻辑
</script>

<!-- 无 <style> 标签 -->
```

## 示例: CodeMart 项目卡片

```vue
<!--
  【开发规范】
  - 禁止在此组件中定义 <style> 标签
  - 所有样式通过 class 引用主题变量
  - 主题文件: common/styles/theme-base.css
  - 扩展主题: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-card">
    <div class="codemart-card-header">
      <h3 class="codemart-section-title">{{ project.title }}</h3>
      <span class="codemart-badge codemart-badge-active">
        {{ project.status }}
      </span>
    </div>

    <div class="codemart-card-body">
      <p class="text-secondary">{{ project.description }}</p>

      <div class="codemart-budget">
        ¥{{ project.budgetMin }} - ¥{{ project.budgetMax }}
      </div>

      <div class="codemart-skills">
        <span
          v-for="skill in project.skills"
          :key="skill"
          class="codemart-skill-tag"
        >
          {{ skill }}
        </span>
      </div>
    </div>

    <div class="codemart-card-footer">
      <button class="codemart-btn codemart-btn-primary">
        View Details
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Project } from '../types_app_codemart';

interface Props {
  project: Project;
}

defineProps<Props>();
</script>

<!-- 无 <style> 标签 - 所有样式在主题文件中定义 -->
```

## 检查清单

在提交代码前，请确保:

- [ ] 没有在页面组件中使用 `<style>` 标签
- [ ] 所有颜色都使用 CSS 变量
- [ ] 所有间距都使用 CSS 变量
- [ ] 类名遵循命名规范
- [ ] 支持暗色主题
- [ ] 添加了规范注释
- [ ] 样式在主主题或子APP主题中定义
- [ ] 响应式设计正常工作

## 总结

**核心思想**:
1. **主主题** 定义公共变量和基础样式
2. **子APP主题** 扩展专属变量和组件样式
3. **页面组件** 只使用 class 引用，禁止定义 style

这种架构确保:
- ✅ 样式统一、可维护
- ✅ 主题切换简单
- ✅ 避免样式冲突
- ✅ 代码复用性高
- ✅ 编译时可以优化（tree-shaking）
