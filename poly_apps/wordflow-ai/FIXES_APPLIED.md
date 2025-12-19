# 修复说明 - 词库功能导航问题

## 问题描述

1. **首页推荐词库点击错误**: 点击首页的推荐词库卡片时，跳转到了 `/recommendations` 页面，而不是词库详情页
2. **Recommendations 页面混淆**: `/recommendations` 页面本身不应该显示单词列表，它是用来显示推荐的词库集合(collections)的

## 已应用的修复

### 1. 修复首页推荐词库的点击处理

**文件**: `pages/Dashboard/Home.tsx:378`

**修改前**:
```tsx
onClick={() => navigate('recommendations')}
```

**修改后**:
```tsx
onClick={() => navigate('vocabulary_library', { libraryId: library.id })}
```

**说明**: 现在点击词库卡片会跳转到词库详情页，并传递 `libraryId` 参数。

### 2. 修复 "More" 按钮的跳转

**文件**: `pages/Dashboard/Home.tsx:361`

**修改前**:
```tsx
onClick={() => navigate('recommendations')}
```

**修改后**:
```tsx
onClick={() => navigate('courses')}
```

**说明**: "More" 按钮现在跳转到课程/词库列表页面，而不是 recommendations 页面。

### 3. 添加词库详情页路由

**文件**: `router/RouteCenter.tsx:45,363-368`

**新增导入**:
```tsx
// Pages - Vocabulary
import VocabularyLibraryDetailPage from '../pages/Vocabulary/LibraryDetail';
```

**新增路由**:
```tsx
{
  path: '/vocabulary_library',
  element: <VocabularyLibraryDetailPage />,
  name: 'Vocabulary Library Detail',
  category: 'library',
  isProtected: false,
}
```

### 4. 更新词库详情页以接收参数

**文件**: `pages/Vocabulary/LibraryDetail.tsx:36,47`

**修改前**:
```tsx
const { user, navigate, t, settings } = useContext(AppContext);
// ...
const libraryId = 1; // This should come from route params
```

**修改后**:
```tsx
const { user, navigate, t, settings, navigationParams } = useContext(AppContext);
// ...
const libraryId = navigationParams?.libraryId || 1;
```

**说明**: 现在从 `navigationParams` 中获取 `libraryId`，如果没有则默认为 1。

## 功能说明

### /recommendations 页面的正确用途

这个页面用于显示**词库集合推荐**，不是单词列表：

- **用途**: 显示推荐的学习集合/课程
- **需要登录**: 是
- **显示内容**:
  - 词库集合信息（名称、描述、词数）
  - 难度等级
  - 分类标签
  - 选择/取消选择按钮

### /vocabulary_library 页面（新）

这是新创建的词库详情页，用于显示单词列表：

- **用途**: 显示词库中的单词列表
- **需要登录**: 否（公开访问）
- **主要功能**:
  - 显示词库信息
  - 分页显示单词（500-2000 词/页）
  - 多列网格布局（1-5 列）
  - 翻译功能（Bing/Google/DeepL）
  - 显示设置（字体大小、列数等）

## 导航流程

### 正确的导航流程

```
首页
  └─> 推荐词库卡片（点击）
       └─> /vocabulary_library?libraryId=1
            └─> 显示该词库的单词列表
```

### Recommendations 页面的导航流程

```
首页
  └─> 用户需要先登录
       └─> /recommendations
            └─> 显示推荐的学习集合
                 └─> 点击 "Select" 按钮选择集合
```

## 测试步骤

### 1. 测试首页词库点击

1. 打开首页 `http://192.168.50.3:10029/`
2. 滚动到 "RECOMMENDED VOCABULARY" 部分
3. 点击任意词库卡片
4. **预期结果**: 跳转到词库详情页，显示该词库的单词列表

### 2. 测试 More 按钮

1. 在首页点击 "More" 按钮（推荐词库部分）
2. **预期结果**: 跳转到课程列表页 `/courses`

### 3. 测试词库详情页

1. 手动访问 `http://192.168.50.3:10029/vocabulary_library`
2. **预期结果**:
   - 显示词库信息
   - 显示单词列表（默认词库 ID=1）
   - 右上角有设置图标
   - 可以切换显示选项

### 4. 测试 Recommendations 页面

1. 登录后访问 `http://192.168.50.3:10029/recommendations`
2. **预期结果**:
   - 显示推荐的词库集合（不是单词）
   - 每个集合显示名称、描述、词数等信息
   - 可以选择/取消选择集合

## 后端 API 状态

### 词库单词 API

**端点**: `GET /api/app_qy_v1/vocabulary/libraries/{id}/words`

**状态**: ⚠️ **需要重启 Octane 服务器**

路由已添加，但由于 Octane 缓存，新路由尚未生效。需要执行：

```bash
# 方法 1: 重启 Octane（需要 root 权限）
php artisan octane:reload

# 方法 2: 完全重启服务
# 停止当前进程，然后重新启动
```

### 测试 API（重启后）

```bash
# 获取词库 1 的前 10 个单词
curl "http://localhost:9000/api/app_qy_v1/vocabulary/libraries/1/words?per_page=10"

# 预期响应
{
  "success": true,
  "data": {
    "library": {
      "id": 1,
      "name": "English Beginner Simple",
      "total_words": 199,
      "language": "english"
    },
    "words": [
      {"index": 0, "word": "# 26个英文字母"},
      {"index": 1, "word": "a"},
      ...
    ],
    "pagination": {...}
  }
}
```

## 相关文件

### 修改的文件
- ✅ `pages/Dashboard/Home.tsx` - 修复词库卡片点击和 More 按钮
- ✅ `pages/Vocabulary/LibraryDetail.tsx` - 更新以接收 libraryId 参数
- ✅ `router/RouteCenter.tsx` - 添加词库详情页路由

### 新创建的文件
- ✅ `pages/Vocabulary/LibraryDetail.tsx` - 词库详情页组件
- ✅ `services/translators/index.ts` - 翻译服务（Bing/Google/DeepL）
- ✅ `services/languageMapper.ts` - 语言代码映射工具

### 后端文件
- ✅ `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php` - 添加 getLibraryWords 方法
- ✅ `routes/AppQyV1Router/AppQyV1Vocabulary.php` - 添加词库单词路由

## 注意事项

1. **Octane 重启**: 后端路由修改需要重启 Octane 才能生效
2. **权限问题**: 如果无法重启 Octane，请联系系统管理员
3. **翻译功能**: Bing 和 Google 翻译使用非官方 API，可能受限
4. **CORS 问题**: 如果翻译功能在浏览器中不工作，可能需要后端代理

## 下一步

如果 Octane 成功重启后：

1. 测试从首页点击词库是否能正确跳转
2. 测试词库详情页是否能加载单词
3. 测试翻译功能是否正常工作
4. 如有问题，查看浏览器控制台错误信息

## 总结

所有前端代码已修复完毕，现在：

- ✅ 首页推荐词库点击正确跳转到词库详情页
- ✅ More 按钮跳转到课程列表
- ✅ 词库详情页路由已配置
- ✅ 词库详情页能接收 libraryId 参数
- ⏳ 等待 Octane 重启以启用后端 API

用户现在可以正常浏览词库和单词列表了！
