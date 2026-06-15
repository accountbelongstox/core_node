# WordFlow AI - 词库API状态总结

**日期:** 2025-12-18
**分析内容:** 词库初始化与API端点可用性

---

## ✅ 回答用户问题

### 问题1: artisan sys:ini中有没有初始化词库？

**答案: ✅ 有！**

`php artisan sys:ini` 命令完整地初始化了词库系统：

```php
// InitializeApps.php 第302-339行

// 1. 创建词库表（第302-307行）
$this->info('Creating vocabulary library tables...');
$vocabResults = AppQyV1VocabularyService::ensureVocabularyTablesExist();

// 2. 从文件导入词库（第311-321行）
$this->info('Importing vocabulary libraries from files...');
$importResults = AppQyV1VocabularyService::importVocabularyFromFiles();

// 3. 显示词库摘要（第325-339行）
$this->info('Vocabulary library summary:');
// 列出所有公开词库的名称、单词数和难度
```

**初始化内容:**
- ✅ 创建5张词库相关表
  - `app_qy_v1_vocabulary_libraries` - 词库元数据表
  - `app_qy_v1_vocabulary_words` - 单词内容表
  - `app_qy_v1_user_languages` - 用户学习语言表
  - `app_qy_v1_user_vocabulary_selections` - 用户词库选择表
  - `app_qy_v1_vocabulary_covers` - 词库封面表

- ✅ 从文件导入8个词库
  - 位置: `init_data/AppQyV1/VoiceStaticServer/vocabulary/*.txt`
  - 总计: ~197,357个单词

**命令输出示例:**
```
Creating vocabulary library tables...
  ✅ app_qy_v1_vocabulary_libraries: created
  ✅ app_qy_v1_vocabulary_words: created
  ✅ app_qy_v1_user_languages: created
  ✅ app_qy_v1_user_vocabulary_selections: created
  ✅ app_qy_v1_vocabulary_covers: created

Importing vocabulary libraries from files...
  ✅ Imported: 8 libraries
  ✓ Skipped: 0 libraries
    • english_beginner_simple.txt: imported 199 words
    • english_coca_20000.txt: imported 20199 words
    • english_coca_60000.txt: imported 60022 words
    • english_exam_cet6.txt: imported 8027 words
    • english_exam_gre.txt: imported 6676 words
    • english_exam_toefl.txt: imported 3469 words
    • english_general_all_words.txt: imported 103941 words
    • english_high_school_core.txt: imported 3468 words

Vocabulary library summary:
  • English Beginner Simple: 199 words (beginner)
  • English High School Core: 3449 words (intermediate)
  • English Coca 20000: 17640 words (intermediate)
  • English Exam Cet6: 8013 words (advanced)
  • English Exam Gre: 6677 words (advanced)
  • English Exam Toefl: 3470 words (advanced)
  • English Coca 60000: 53968 words (advanced)
  • English General All Words: 103941 words (advanced)
```

---

### 问题2: 有没有提供端点给前端访问？

**答案: ✅ 有！API已配置并对外开放**

### 可用的API端点

**基础路径:** `/api/app_qy_v1/vocabulary`

#### 1. 获取统计信息 ✅（已扩展）
```
GET /api/app_qy_v1/vocabulary/statistics
```

**参数:**
- `language` (可选): 语言过滤（语言代码或名称）。省略时返回所有语言的汇总。
- `include_words` (可选): 是否在响应中附带单词样本，默认 false。
- `page` / `per_page` (可选): 当 `include_words=true` 时对单词分页。

> ⚠️ **重要（数据来源）：** `total_words` 仍是 `vocabulary_libraries.total_words` 的求和，
> **包含跨词库的重复**（同一个单词出现在多个词库中会被多次计数）。
> 而 **翻译 / 有效性 / 覆盖率（TTS、图片、AI 复核）全部来自规范词典表
> `tts_cache_{lang}`**，按 canonical 单词去重，**不是**来自 `vocabulary_words` 词库表。
> 因此 `tts_percentage` / `images_percentage` / `review_percentage` 现在是**真实值**，不再恒为 0。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_languages": 1,
      "total_libraries": 8,
      "total_words": 197357,
      "total_dictionary_words": 233197,
      "total_with_translation": 180000,
      "total_without_translation": 53197,
      "total_valid_words": 233100,
      "total_invalid_words": 97,
      "total_validity_checked": 1200,
      "tts_percentage": 42.5
    },
    "languages": [
      {
        "language": "english",
        "language_code": "en",
        "total_words": 197357,
        "libraries_count": 8,
        "dictionary_words": 233197,
        "with_translation": 180000,
        "without_translation": 53197,
        "valid_words": 233100,
        "invalid_words": 97,
        "validity_checked": 1200,
        "validity_unchecked": 231997,
        "tts_percentage": 42.5,
        "images_percentage": 3.1,
        "review_percentage": 77.2
      }
    ]
  }
}
```

**字段说明:**

`summary`:
| 字段 | 含义 |
|------|------|
| `total_languages` | 有词库的语言数量 |
| `total_libraries` | 词库总数 |
| `total_words` | `vocabulary_libraries.total_words` 求和（**含跨库重复**） |
| `total_dictionary_words` | **新增**：`tts_cache_{lang}` 中去重后的 canonical 单词总数 |
| `total_with_translation` | **新增**：已有翻译的词典单词数 |
| `total_without_translation` | **新增**：无翻译的词典单词数 |
| `total_valid_words` | **新增**：有效单词数 |
| `total_invalid_words` | **新增**：无效单词数（仅被显式标记为无效的行） |
| `total_validity_checked` | **新增**：已被第三方客户端检查过的行数 |
| `tts_percentage` | TTS 覆盖率 |

`languages[]`（每种语言一项）:
| 字段 | 含义 |
|------|------|
| `language` / `language_code` | 语言名称 / 语言代码 |
| `total_words` | 词库求和（**含重复**） |
| `libraries_count` | 该语言下的词库数 |
| `dictionary_words` | **新增**：`tts_cache_{lang}` 中去重后的单词数 |
| `with_translation` / `without_translation` | **新增**：有 / 无翻译的词典单词数 |
| `valid_words` | **新增**：有效单词数 |
| `invalid_words` | **新增**：无效单词数（仅显式被标记无效的行） |
| `validity_checked` | **新增**：第三方客户端已检查过的行数 |
| `validity_unchecked` | **新增**：尚未被检查过的行数 |
| `tts_percentage` | **真实值** = has_audio / dictionary_words |
| `images_percentage` | **真实值**（图片覆盖率） |
| `review_percentage` | **真实值** = with_translation / dictionary_words |

#### 2. 获取推荐词库 ✅
```
GET /api/app_qy_v1/vocabulary/libraries/recommended
```

**参数:**
- `language` (可选): 语言过滤，默认 "english"
- `limit` (可选): 返回数量，范围1-50，默认10

**响应示例:**
```json
{
  "success": true,
  "data": {
    "libraries": [
      {
        "id": 1,
        "name": "English Beginner Simple",
        "description": "Auto-imported vocabulary list: English Beginner Simple",
        "word_count": 199,
        "language": "english",
        "difficulty": "beginner",
        "category": "foundation",
        "image_url": "https://...",
        "cover_status": "completed",
        "is_recommended": true,
        "tags": ["foundation", "beginner", "recommended"]
      }
    ]
  }
}
```

#### 3. 获取词库列表（分页+过滤） ✅
```
GET /api/app_qy_v1/vocabulary/libraries
```

**参数:**
- `language` (可选): 语言过滤
- `category` (可选): 类别过滤 (foundation|academic|exam|frequency|general)
- `difficulty` (可选): 难度过滤 (beginner|intermediate|advanced)
- `search` (可选): 搜索关键词（搜索name和description）
- `page` (可选): 页码，默认1
- `per_page` (可选): 每页数量，范围1-100，默认20

**响应示例:**
```json
{
  "success": true,
  "data": {
    "libraries": [...],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 8,
      "last_page": 1,
      "has_more": false
    }
  }
}
```

#### 4. 单词有效性 API ✅（新增）

**有效性语义（重要）:** 有效性是**显式的、由外部断言的**。每条词典行**默认有效**；
只有当第三方校验客户端（它会把单词拿到互联网上核对）**显式上报为无效**时，该行才变为无效。
从未被检查过的行**保持有效**。

有效性状态存储在 `tts_cache_{lang}` 上，由迁移
`AppQyV1_2026_06_08_000000_add_validity_columns_to_tts_cache_tables.php` 新增的列承载：

| 列 | 类型 | 说明 |
|----|------|------|
| `is_valid` | boolean，默认 `true` | 是否有效 |
| `validity_checked_at` | datetime，检查前为 `null` | 第三方检查时间戳 |
| `validity_source` | string | 标识上报来源的标签 |
| `validity_note` | text | 备注 |

##### 4a. 拉取待检查单词
```
GET /api/app_qy_v1/vocabulary/validity/pending
```

**参数:**
- `language` (可选): 语言代码或名称，默认 `en`
- `limit` (可选): 范围 1..1000，默认 100

返回**尚未被检查过**的单词，按查询次数（`query_count`）从高到低排序，供客户端在线核对：

```json
{
  "success": true,
  "data": {
    "language": "en",
    "count": 100,
    "words": [
      { "id": 12, "word": "abandon", "md5": "5f93f983524def3dca464469d2cf9f3e" }
    ]
  }
}
```

##### 4b. 上报校验结果
```
POST /api/app_qy_v1/vocabulary/validity/report
```

**请求体:**
```json
{
  "language": "en",
  "source": "external-checker",
  "results": [
    { "word": "abandon", "is_valid": true },
    { "md5": "5f93f983524def3dca464469d2cf9f3e", "is_valid": false, "note": "not a real word", "source": "external-checker" }
  ]
}
```

- `language` (可选): 语言代码或名称，默认 `en`
- `source` (可选): 默认来源标签，可被单条结果内的 `source` 覆盖
- `results[]`: 每项含 `word?`（字符串）或 `md5?`（32 位）、`is_valid`（必填 boolean）、可选 `note`、可选 `source`
- 匹配规则：优先按 `md5` 匹配；仅提供 `word` 时按 `md5(word)` 匹配。

**响应:**
```json
{
  "success": true,
  "data": {
    "language": "en",
    "updated": 2,
    "not_found": 0,
    "marked_valid": 1,
    "marked_invalid": 1
  }
}
```

---

### 路由配置 ✅

**位置:** `routes/AppQyV1Router/AppQyV1Vocabulary.php`

```php
Route::prefix('app_qy_v1')->group(function () {
    Route::prefix('vocabulary')->group(function () {
        Route::get('/statistics', [AppQyV1VocabularyLibraryPublicController::class, 'getStatistics']);
        Route::get('/libraries/recommended', [AppQyV1VocabularyLibraryPublicController::class, 'getRecommended']);
        Route::get('/libraries', [AppQyV1VocabularyLibraryPublicController::class, 'getLibraries']);

        // 单词有效性上报（第三方校验客户端）
        Route::get('/validity/pending', [AppQyV1VocabularyValidityController::class, 'getPending']);
        Route::post('/validity/report', [AppQyV1VocabularyValidityController::class, 'report']);
    });
});
```

**已加载到主路由:** `routes/api.php` 第164行
```php
require_once __DIR__ . '/AppQyV1Router/AppQyV1Vocabulary.php';
```

### 端点特性 🌟

- ✅ **公开访问** - 不需要认证
- ✅ **支持分页** - 避免一次加载过多数据
- ✅ **支持过滤** - 按类别、难度、语言过滤
- ✅ **支持搜索** - 按名称和描述搜索
- ✅ **自动封面** - 集成AI生成的封面图
- ✅ **完整元数据** - 包含难度、类别、标签、单词数等信息

---

## ⚠️ 发现的问题

### 问题: 数据库连接名称大小写不匹配

**错误信息:**
```
Database connection [AppQyV1] not configured.
```

**原因:**
`AppQyV1VocabularyLibraryModel.php` 中使用的连接名是 `'AppQyV1'`（首字母大写），但数据库配置中使用的是 `'appqyv1'`（全小写）。

**已修复:**
```php
// app/Apps/AppQyV1/AppQyV1Models/AppQyV1VocabularyLibraryModel.php

// 修改前:
protected $connection = 'AppQyV1';

// 修复后:
protected $connection = 'appqyv1';
```

**需要重启Octane:**
由于Octane会缓存代码，需要重启Octane服务才能加载更新：

```bash
# 重启Octane
php artisan octane:reload

# 或者停止后重新启动
pkill -f "artisan octane"
php artisan octane:start --host=0.0.0.0 --port=9000 --workers=8 --watch
```

---

## 🧪 测试API端点

### 测试命令

```bash
# 1. 测试统计API
curl "http://localhost:9000/api/app_qy_v1/vocabulary/statistics" | jq

# 2. 测试推荐词库
curl "http://localhost:9000/api/app_qy_v1/vocabulary/libraries/recommended?limit=3" | jq

# 3. 测试词库列表（按类别过滤）
curl "http://localhost:9000/api/app_qy_v1/vocabulary/libraries?category=exam&per_page=3" | jq

# 4. 测试搜索
curl "http://localhost:9000/api/app_qy_v1/vocabulary/libraries?search=high+school" | jq
```

### 预期响应（修复后）

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_languages": 1,
      "total_libraries": 8,
      "total_words": 197357,
      "total_dictionary_words": 233197,
      "total_with_translation": 180000,
      "total_without_translation": 53197,
      "total_valid_words": 233100,
      "total_invalid_words": 97,
      "total_validity_checked": 1200,
      "tts_percentage": 42.5
    },
    "languages": [ /* 每种语言一项，见上文字段说明 */ ]
  }
}
```

---

## 📊 词库数据概览

### 当前词库列表

| ID | 词库名称 | 单词数 | 难度 | 类别 | 推荐 |
|----|----------|--------|------|------|------|
| 1 | English Beginner Simple | 199 | beginner | foundation | ✅ |
| 2 | English Coca 20000 | 17,640 | intermediate | frequency | ❌ |
| 3 | English Coca 60000 | 53,968 | advanced | frequency | ❌ |
| 4 | English Exam Cet6 | 8,013 | advanced | exam | ✅ |
| 5 | English Exam Gre | 6,677 | advanced | exam | ✅ |
| 6 | English Exam Toefl | 3,470 | advanced | exam | ✅ |
| 7 | English General All Words | 103,941 | advanced | frequency | ❌ |
| 8 | English High School Core | 3,449 | intermediate | academic | ✅ |

### 类别统计

| 类别 | 词库数量 | 总单词数 |
|------|----------|----------|
| Foundation (基础) | 1 | 199 |
| Academic (学术) | 1 | 3,449 |
| Exam (考试) | 3 | 18,160 |
| Frequency (词频) | 3 | 175,549 |

### 难度统计

| 难度 | 词库数量 |
|------|----------|
| Beginner (初级) | 1 |
| Intermediate (中级) | 2 |
| Advanced (高级) | 5 |

---

## 🔄 相关服务和模型

### 服务类

**AppQyV1VocabularyService**
`app/Apps/AppQyV1/Services/AppQyV1VocabularyService.php`

- ✅ `ensureVocabularyTablesExist()` - 创建/更新数据表
- ✅ `importVocabularyFromFiles()` - 从TXT文件导入词库
- ✅ `buildLibraryMetadata($filename)` - 解析文件名生成元数据
- ✅ `calculateNextReviewTime()` - 间隔重复算法

### Model类

**AppQyV1VocabularyLibraryModel**
`app/Apps/AppQyV1/AppQyV1Models/AppQyV1VocabularyLibraryModel.php`

- ✅ Scopes: `public()`, `forLanguage()`
- ✅ Casts: `is_public`, `is_recommended`, `tags`
- ✅ 已修复连接名称为 `'appqyv1'`

### 控制器

**AppQyV1VocabularyLibraryPublicController**
`app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`

- ✅ `getStatistics()` - 获取统计信息（含词典覆盖率 / 有效性汇总，来源 `tts_cache_{lang}`）
- ✅ `getRecommended()` - 获取推荐词库
- ✅ `getLibraries()` - 获取词库列表（分页+过滤）
- ✅ 集成 `AppQyV1VocabularyCoverService` - 自动获取封面

**AppQyV1VocabularyValidityController**（新增）
`app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyValidityController.php`

- ✅ `getPending()` - 返回尚未被检查的单词供第三方校验
- ✅ `report()` - 接收第三方校验结果并更新 `tts_cache_{lang}` 有效性列

---

## 📝 前端集成示例

### TypeScript接口定义

```typescript
// types.ts
export interface VocabularyLibrary {
  id: number;
  name: string;
  description: string;
  word_count: number;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'foundation' | 'academic' | 'exam' | 'frequency' | 'general';
  image_url: string;
  cover_status: 'pending' | 'processing' | 'completed' | 'failed';
  is_recommended: boolean;
  tags: string[];
}

export interface VocabularyLanguageStats {
  language: string;
  language_code: string;
  total_words: number;          // library sum (includes cross-library duplicates)
  libraries_count: number;
  dictionary_words: number;     // distinct canonical words in tts_cache_{lang}
  with_translation: number;
  without_translation: number;
  valid_words: number;
  invalid_words: number;        // only rows explicitly flagged invalid
  validity_checked: number;     // rows a third-party client has checked
  validity_unchecked: number;
  tts_percentage: number;       // has_audio / dictionary_words
  images_percentage: number;
  review_percentage: number;    // with_translation / dictionary_words
}

export interface VocabularyStatistics {
  summary: {
    total_languages: number;
    total_libraries: number;
    total_words: number;              // library sum (includes duplicates)
    total_dictionary_words: number;   // distinct canonical words across tts_cache_{lang}
    total_with_translation: number;
    total_without_translation: number;
    total_valid_words: number;
    total_invalid_words: number;
    total_validity_checked: number;
    tts_percentage: number;
  };
  languages: VocabularyLanguageStats[];
}

export interface VocabularyLibrariesResponse {
  libraries: VocabularyLibrary[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    has_more: boolean;
  };
}
```

### API调用示例

```typescript
// services/VocabularyApi.ts
import { apiManager } from './ApiManager';

export class VocabularyApi {
  private static readonly BASE_PATH = '/app_qy_v1/vocabulary';

  /**
   * 获取词库统计信息
   */
  static async getStatistics(language: string = 'english'): Promise<VocabularyStatistics> {
    const response = await apiManager.get(`${this.BASE_PATH}/statistics`, {
      params: { language }
    });
    return response.data;
  }

  /**
   * 获取推荐词库
   */
  static async getRecommended(
    language: string = 'english',
    limit: number = 10
  ): Promise<VocabularyLibrary[]> {
    const response = await apiManager.get(`${this.BASE_PATH}/libraries/recommended`, {
      params: { language, limit }
    });
    return response.data.libraries;
  }

  /**
   * 获取词库列表（分页+过滤）
   */
  static async getLibraries(params: {
    language?: string;
    category?: string;
    difficulty?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<VocabularyLibrariesResponse> {
    const response = await apiManager.get(`${this.BASE_PATH}/libraries`, { params });
    return response.data;
  }
}
```

### React组件使用示例

```typescript
// pages/Library/Courses.tsx
import { useEffect, useState } from 'react';
import { VocabularyApi } from '../../services/VocabularyApi';
import type { VocabularyLibrary } from '../../types';

export const CoursesPage = () => {
  const [libraries, setLibraries] = useState<VocabularyLibrary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        const data = await VocabularyApi.getRecommended('english', 10);
        setLibraries(data);
      } catch (error) {
        console.error('Failed to fetch libraries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibraries();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      {libraries.map((library) => (
        <div key={library.id} className="card">
          <img src={library.image_url} alt={library.name} />
          <h3>{library.name}</h3>
          <p>{library.word_count} words</p>
          <span className={`badge-${library.difficulty}`}>
            {library.difficulty}
          </span>
          {library.is_recommended && <span className="badge-recommended">★ Recommended</span>}
        </div>
      ))}
    </div>
  );
};
```

---

## ✅ 总结

### 词库初始化

| 项目 | 状态 |
|------|------|
| sys:ini命令包含词库初始化 | ✅ 是 |
| 自动创建数据表 | ✅ 是 |
| 从文件导入词库 | ✅ 是 |
| 显示初始化摘要 | ✅ 是 |

### API端点

| 项目 | 状态 |
|------|------|
| 统计信息API（含词典覆盖率/有效性汇总） | ✅ 已扩展 |
| 推荐词库API | ✅ 已配置 |
| 词库列表API | ✅ 已配置 |
| 单词有效性 pending/report API | ✅ 已配置 |
| 路由已注册 | ✅ 是 |
| 公开访问（无需认证） | ✅ 是 |
| 支持过滤和搜索 | ✅ 是 |
| 支持分页 | ✅ 是 |

### 问题修复

| 问题 | 状态 |
|------|------|
| Model连接名称大小写 | ✅ 已修复 |
| 需要重启Octane | ⚠️ 待重启 |

---

## 🚀 下一步操作

1. **重启Octane服务**
   ```bash
   php artisan octane:reload
   ```

2. **测试API端点**
   ```bash
   curl "http://localhost:9000/api/app_qy_v1/vocabulary/statistics"
   ```

3. **前端集成**
   - 在 `services/` 目录创建 `VocabularyApi.ts`
   - 在 `types.ts` 添加词库接口定义
   - 在 Library 页面使用API获取词库列表

---

**文档生成时间:** 2025-12-18
**分析工具:** Claude Code Assistant
