# 功能不一致报告

## 📊 各角色功能对比

### 🔵 Admin Dashboard（管理端）

#### 菜单项
1. ✅ 总览 (`/`)
2. ✅ 应用管理 (`/apps`)
3. ✅ 已发布APP (`/app-releases`) - **硬编码中文**
4. ✅ 客服团队 (`/cs`)
5. ✅ 客服人员 (`/cs-list`) - **硬编码中文**
6. ✅ 推广人员 (`/promoters`) - **硬编码中文**
7. ✅ 推广记录 (`/promotion-records`) - **硬编码中文**
8. ✅ 推广轨迹 (`/promotion-tracks`) - **硬编码中文**
9. ✅ CS Assignment (`/cs-assignment`) - **硬编码英文**
10. ✅ Revenue (`/revenue`) - **硬编码英文**
11. ✅ 营收分析 (`/analytics`)

#### 路由
- `/` - DashboardOverview
- `/apps` - AppsList
- `/apps/:appId` - AppDetailPage
- `/cs` - CSTeam
- `/cs-list` - CSList
- `/promoters` - PromoterList
- `/promotion-records` - PromotionRecordList
- `/promotion-records/:id` - PromotionRecordDetail
- `/cs-assignment` - CSAssignment
- `/revenue` - RevenueManagement
- `/promotion-tracks` - PromotionTrackView
- `/app-releases` - AppReleaseList
- `/app-releases/:id` - AppReleaseDetail
- `/analytics` - ComingSoon

---

### 🟢 Tech Dashboard（技术端）

#### 菜单项
1. ✅ 总览 (`/`)
2. ✅ 生成队列 (`/queue`)
3. ✅ 我的项目 (`/projects`)
4. ✅ 发布APP (`/release`)
5. ✅ 已发布APP (`/app-releases`) - **硬编码中文**
6. ✅ 推广轨迹 (`/promotion-tracks`)
7. ✅ 构建部署 (`/build`)
8. ✅ Bug追踪 (`/bugs`)
9. ✅ 监控 (`/monitoring`)

#### 路由
- `/` - TechOverview
- `/queue` - GenerationQueue
- `/queue/:id` - TaskDetails
- `/projects` - MyProjects
- `/release` - AppReleaseForm
- `/app-releases` - AppReleaseList
- `/app-releases/:id` - AppReleaseDetail
- `/promotion-tracks` - PromotionTrackView
- `/build` - BuildDeployment
- `/bugs` - BugTracking
- `/profile` - Profile
- `/notifications` - NotificationCenter
- `/monitoring` - PerformanceMonitoring

---

### 🟡 CS Dashboard（客服端）

#### 菜单项
1. ✅ 总览 (`/`)
2. ✅ 我的应用 (`/my-apps`)
3. ✅ 推广 (`/promotions`)
4. ✅ 绩效分析 (`/performance`)

#### 路由
- `/` - CSOverview
- `/my-apps` - MyApps
- `/promotions` - Promotions
- `/performance` - Performance

---

## ⚠️ 功能不一致问题

### 1. 菜单标签多语言化不一致

#### Admin Dashboard
- ❌ `已发布APP` - 硬编码中文
- ❌ `客服人员` - 硬编码中文
- ❌ `推广人员` - 硬编码中文
- ❌ `推广记录` - 硬编码中文
- ❌ `推广轨迹` - 硬编码中文
- ❌ `CS Assignment` - 硬编码英文
- ❌ `Revenue` - 硬编码英文

#### Tech Dashboard
- ❌ `已发布APP` - 硬编码中文

#### CS Dashboard
- ✅ 所有菜单项都已多语言化

---

### 2. 功能访问权限不一致

#### 推广记录功能
- ✅ **Admin**: 可以访问 `/promotion-records` 和 `/promotion-records/:id`
- ✅ **Tech**: 可以访问 `/promotion-tracks`（显示推广记录列表）
- ❌ **CS**: 无法访问推广记录

#### 已发布APP功能
- ✅ **Admin**: 可以访问 `/app-releases` 和 `/app-releases/:id`
- ✅ **Tech**: 可以访问 `/app-releases` 和 `/app-releases/:id`
- ❌ **CS**: 无法访问已发布APP列表

#### 推广轨迹功能
- ✅ **Admin**: 可以访问 `/promotion-tracks`
- ✅ **Tech**: 可以访问 `/promotion-tracks`
- ❌ **CS**: 无法访问推广轨迹

#### 客服人员管理
- ✅ **Admin**: 可以访问 `/cs-list`，可以添加、编辑、删除客服
- ❌ **Tech**: 无法访问
- ❌ **CS**: 无法访问

#### 推广人员管理
- ✅ **Admin**: 可以访问 `/promoters`，可以添加、编辑、删除推广人
- ❌ **Tech**: 无法访问
- ❌ **CS**: 无法访问

---

### 3. 路由命名不一致

#### 推广相关路由
- Admin: `/promotion-records` 和 `/promotion-tracks`（两个不同的路由）
- Tech: `/promotion-tracks`（只显示推广记录列表）
- **问题**: 两个路由指向同一个组件（PromotionRecordList），但路径不同

#### APP发布相关路由
- Admin: `/app-releases`
- Tech: `/app-releases` 和 `/release`（发布表单）
- **问题**: Tech 有单独的 `/release` 路由用于发布表单，Admin 没有

---

### 4. 功能实现不一致

#### APP发布功能
- **Admin**: 没有发布APP的功能（只能查看已发布的APP）
- **Tech**: 有 `/release` 路由，可以发布APP
- **问题**: Admin 应该也能发布APP，或者明确说明只有Tech可以发布

#### 推广记录查看
- **Admin**: 有 `/promotion-records` 和 `/promotion-tracks` 两个路由
- **Tech**: 只有 `/promotion-tracks` 路由
- **问题**: 两个路由功能重复，应该统一

---

### 5. 数据访问权限不一致

#### 客服人员数据
- **Admin**: 可以查看、添加、编辑、删除所有客服
- **Tech**: 无法访问
- **CS**: 无法访问（但应该能看到自己的信息）

#### 推广人员数据
- **Admin**: 可以查看、添加、编辑、删除所有推广人
- **Tech**: 无法访问
- **CS**: 无法访问

#### 推广记录数据
- **Admin**: 可以查看所有推广记录
- **Tech**: 可以查看所有推广记录
- **CS**: 无法查看（但可能应该能看到与自己相关的推广记录）

---

## 🔧 建议修复

### 1. 统一菜单标签多语言化
- 所有菜单项使用 `t()` 函数
- 添加缺失的翻译键到 `locales/zh.ts` 和 `locales/en.ts`

### 2. 统一路由命名
- 统一推广记录路由：建议都使用 `/promotion-records`
- 统一APP发布路由：建议都使用 `/app-releases`

### 3. 明确功能权限
- **Admin**: 所有功能（管理、查看、编辑、删除）
- **Tech**: APP发布、推广记录查看、技术相关功能
- **CS**: 自己的数据查看、推广记录查看（仅与自己相关的）

### 4. 功能完整性
- Admin 应该也能发布APP（或明确说明只有Tech可以）
- CS 应该能看到与自己相关的推广记录
- 统一推广记录和推广轨迹的命名和路由

### 5. 数据访问权限
- CS 应该能看到自己的详细信息
- CS 应该能看到与自己相关的推广记录
- 明确各角色的数据访问边界

---

## 📋 待处理事项

1. [ ] 修复所有菜单标签的多语言化
2. [ ] 统一推广记录和推广轨迹的路由命名
3. [ ] 为CS角色添加推广记录查看功能（仅查看与自己相关的）
4. [ ] 明确Admin是否应该能发布APP
5. [ ] 统一各角色的功能访问权限
6. [ ] 添加缺失的路由和功能

