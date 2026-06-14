# WordFlow AI - 后端词库系统分析

**日期:** 2025-12-18
**分析对象:** Laravel后端词库系统

---

## 📊 数据库概览

### 当前词库统计

数据库中共有 **8个词库**，包含 **197,357个单词**（去重前）

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

### 类别分布

| 类别 | 词库数量 | 总单词数 |
|------|----------|----------|
| **Foundation** (基础) | 1 | 199 |
| **Academic** (学术) | 1 | 3,449 |
| **Exam** (考试) | 3 | 18,160 |
| **Frequency** (词频) | 3 | 175,549 |

---

## 🗄️ 数据库架构

### 1. **app_qy_v1_vocabulary_libraries** (词库表)

存储词库的元数据信息。

**字段:**
```php
- id: 主键
- name: 词库名称 (如 "English Coca 20000")
- description: 描述 (如 "Auto-imported vocabulary list: English Coca 20000")
- language: 语言代码 (如 "english")
- total_words: 总单词数
- is_public: 是否公开 (boolean)
- owner_user_id: 所有者用户ID (nullable，系统词库为null)
- source: 来源标识 (如 "english_coca_20000")
- difficulty_level: 难度级别 ("beginner"|"intermediate"|"advanced")
- category: 类别 ("foundation"|"academic"|"exam"|"frequency"|"general")
- image_url: 封面图URL (nullable)
- is_recommended: 是否推荐 (boolean)
- tags: 标签JSON数组 (如 ["frequency", "intermediate"])
- created_at, updated_at: 时间戳
```

**索引:**
- `uniq_vocab_lib_source` - source字段唯一索引
- `idx_vocab_lib_language` - language字段索引
- `idx_vocab_lib_public` - is_public字段索引
- `idx_vocab_lib_owner` - owner_user_id字段索引
- `idx_vocab_lib_category` - category字段索引
- `idx_vocab_lib_recommended` - is_recommended字段索引

### 2. **app_qy_v1_vocabulary_words** (单词表)

存储具体单词内容。

**字段:**
```php
- id: 主键
- library_id: 外键关联词库表
- word_index: 单词在词库中的顺序
- word: 单词内容 (text类型)
- created_at: 创建时间
```

**索引:**
- `idx_vocab_words_library` - library_id字段索引
- `idx_vocab_words_word` - word字段索引
- `idx_vocab_words_lib_index` - library_id+word_index复合索引

**外键约束:**
```php
library_id -> app_qy_v1_vocabulary_libraries(id) ON DELETE CASCADE
```

### 3. **app_qy_v1_user_languages** (用户学习语言表)

存储用户正在学习的语言。

**字段:**
```php
- id: 主键
- user_id: 用户ID
- language: 学习语言
- native_language: 母语 (nullable)
- is_learning: 是否正在学习 (boolean)
- proficiency_level: 熟练程度 (nullable)
- created_at, updated_at: 时间戳
```

**唯一约束:**
```php
unique(user_id, language) - 防止重复添加同一语言
```

### 4. **app_qy_v1_user_vocabulary_selections** (用户词库选择表)

存储用户选择的词库。

**字段:**
```php
- id: 主键
- user_id: 用户ID
- library_id: 词库ID
- selected_at: 选择时间
- is_active: 是否激活 (boolean)
```

**唯一约束:**
```php
unique(user_id, library_id) - 防止重复选择
```

**外键约束:**
```php
library_id -> app_qy_v1_vocabulary_libraries(id) ON DELETE CASCADE
```

### 5. **app_qy_v1_vocabulary_covers** (词库封面表)

存储词库封面图生成状态。

**字段:**
```php
- id: 主键
- library_id: 词库ID (unique)
- cover_filename: 封面文件名
- status: 状态 ("pending"|"processing"|"completed"|"failed")
- prompt: 生成提示词 (nullable)
- description: 描述 (nullable)
- priority: 优先级 (默认0)
- error_message: 错误信息 (nullable)
- width, height: 尺寸 (默认1280x720)
- last_requested_at: 最后请求时间
- last_generated_at: 最后生成时间
- started_at: 开始处理时间
- finished_at: 完成时间
- created_at, updated_at: 时间戳
```

**索引:**
- `idx_vocab_covers_status` - status字段索引
- `idx_vocab_covers_priority` - priority字段索引

---

## 🔌 API 端点

### 公开API (不需要认证)

**基础路径:** `/api/AppQyV1/vocabulary`

#### 1. 获取推荐词库
```
GET /api/AppQyV1/vocabulary/libraries/recommended
```

**参数:**
- `language` (可选): 语言过滤，默认 "english"
- `limit` (可选): 返回数量，范围1-50，默认10

**响应:**
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
        "cover_error": null,
        "is_recommended": true,
        "tags": ["foundation", "beginner", "recommended"],
        "cover_log": null
      }
    ]
  }
}
```

#### 2. 获取词库列表（分页）
```
GET /api/AppQyV1/vocabulary/libraries
```

**参数:**
- `language` (可选): 语言过滤
- `category` (可选): 类别过滤 (foundation|academic|exam|frequency|general)
- `difficulty` (可选): 难度过滤 (beginner|intermediate|advanced)
- `search` (可选): 搜索关键词（搜索name和description）
- `page` (可选): 页码，默认1
- `per_page` (可选): 每页数量，范围1-100，默认20

**响应:**
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

#### 3. 获取统计信息（已扩展）
```
GET /api/app_qy_v1/vocabulary/statistics
```

**参数:**
- `language` (可选): 语言过滤（语言代码或名称）。省略时返回所有语言汇总。
- `include_words` (可选): 是否附带单词样本，默认 false。
- `page` / `per_page` (可选): 当 `include_words=true` 时对单词分页。

> ⚠️ **数据来源：** `total_words` / `languages[].total_words` 是
> `vocabulary_libraries.total_words` 的求和，**包含跨词库的重复**。
> 而翻译、有效性、覆盖率（TTS / 图片 / AI 复核）全部来自规范词典表
> `tts_cache_{lang}`（按 canonical 单词去重），**不是**来自 `vocabulary_words` 词库表。
> `tts_percentage` / `images_percentage` / `review_percentage` 现在是真实值，不再恒为 0。

**响应:**
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
- `summary.total_words`：词库求和（含重复）；`summary.total_dictionary_words`：词典去重单词总数。
- `summary.total_with_translation` / `total_without_translation`：词典中有 / 无翻译的单词数。
- `summary.total_valid_words` / `total_invalid_words` / `total_validity_checked`：有效 / 无效（仅显式标记） / 已被第三方检查的行数。
- `languages[]` 在每种语言下重复上述维度，并提供 `validity_unchecked`（尚未检查）以及真实的
  `tts_percentage`（has_audio / dictionary_words）、`images_percentage`、`review_percentage`（with_translation / dictionary_words）。

#### 4. 单词有效性 API（新增）

有效性是**显式的、由外部断言**的：每条词典行**默认有效**，仅当第三方校验客户端
（核对单词是否真实存在于互联网）**显式上报为无效**时才变为无效；未检查的行保持有效。
状态由迁移 `AppQyV1_2026_06_08_000000_add_validity_columns_to_tts_cache_tables.php`
在 `tts_cache_{lang}` 上新增的列承载：`is_valid`（boolean，默认 true）、
`validity_checked_at`（datetime，未检查时为 null）、`validity_source`（string）、`validity_note`（text）。

```
GET  /api/app_qy_v1/vocabulary/validity/pending?language=<code|name>&limit=<1..1000，默认100>
     -> { language, count, words: [ { id, word, md5 } ] }   // 未检查、按查询次数从高到低

POST /api/app_qy_v1/vocabulary/validity/report
     body: { language?:<code|name，默认en>, source?:string,
             results: [ { word?:string, md5?:string(32), is_valid:boolean, note?:string, source?:string } ] }
     -> { language, updated, not_found, marked_valid, marked_invalid }
```

每条结果按 `md5` 匹配；仅提供 `word` 时按 `md5(word)` 匹配。

### 用户API (需要认证)

**基础路径:** `/api/AppQyV1/learning`

#### 1. 选择词库
```
POST /api/AppQyV1/learning/libraries/select
```

**请求体:**
```json
{
  "library_id": 1
}
```

#### 2. 删除词库（上传的自定义词库）
```
DELETE /api/AppQyV1/learning/libraries/{library_id}
```

---

## 📁 词库源文件

### 位置
```
/www/programing/core_node/poly_apps/laravel_main/init_data/AppQyV1/VoiceStaticServer/vocabulary/
```

### 文件列表

| 文件名 | 单词数 | 文件大小 | 难度 | 类别 |
|--------|--------|----------|------|------|
| english_beginner_simple.txt | 200 | 1.1K | beginner | foundation |
| english_high_school_core.txt | 3,468 | 25K | intermediate | academic |
| english_coca_20000.txt | 20,199 | 167K | intermediate | frequency |
| english_exam_toefl.txt | 3,469 | 28K | advanced | exam |
| english_exam_cet6.txt | 8,027 | 65K | advanced | exam |
| english_exam_gre.txt | 6,676 | 58K | advanced | exam |
| english_coca_60000.txt | 60,022 | 578K | advanced | frequency |
| english_general_all_words.txt | 103,941 | 968K | advanced | frequency |

**总计:** 206,002 单词（包含重复）

### 文件格式

每个文件是纯文本格式，一行一个单词：
```
the
be
and
of
a
in
to
...
```

---

## 🛠️ 核心服务

### AppQyV1VocabularyService

**位置:** `app/Apps/AppQyV1/Services/AppQyV1VocabularyService.php`

#### 主要方法:

##### 1. `ensureVocabularyTablesExist()`
自动创建或更新词库相关数据表。

**功能:**
- 创建5个词库相关表（如果不存在）
- 自动添加缺失的列
- 确保所有索引和外键约束存在

**返回:**
```php
[
  'app_qy_v1_vocabulary_libraries' => 'created' | 'exists',
  'app_qy_v1_vocabulary_words' => 'created' | 'exists',
  'app_qy_v1_user_languages' => 'created' | 'exists',
  'app_qy_v1_user_vocabulary_selections' => 'created' | 'exists',
  'app_qy_v1_vocabulary_covers' => 'created' | 'exists',
]
```

##### 2. `importVocabularyFromFiles()`
从 `init_data/` 目录导入词库文件。

**功能:**
- 扫描 vocabulary 目录中的所有 .txt 文件
- 根据文件名自动生成元数据（名称、难度、类别、标签）
- 批量插入单词（每批1000个）
- 智能跳过已导入的词库
- 更新词库如果文件内容改变

**返回:**
```php
[
  'imported' => 3,
  'skipped' => 5,
  'errors' => 0,
  'libraries' => [
    'english_coca_20000.txt' => 'imported 20199 words',
    'english_beginner_simple.txt' => 'already imported',
    ...
  ]
]
```

**文件名解析规则:**
```php
// english_beginner_simple.txt →
[
  'name' => 'English Beginner Simple',
  'difficulty' => 'beginner',
  'category' => 'foundation',
  'is_recommended' => true,
]

// english_coca_20000.txt →
[
  'name' => 'English Coca 20000',
  'difficulty' => 'intermediate',
  'category' => 'frequency',
  'is_recommended' => false,
]

// english_exam_gre.txt →
[
  'name' => 'English Exam Gre',
  'difficulty' => 'advanced',
  'category' => 'exam',
  'is_recommended' => true,
]
```

##### 3. `buildLibraryMetadata($filename)`
根据文件名构建词库元数据。

**规则:**
- 包含 "beginner" 或 "simple" → beginner + foundation + recommended
- 包含 "high_school" → intermediate + academic + recommended
- 包含 "coca_20000" → intermediate + frequency
- 包含 "coca_60000" 或 "general_all" → advanced + frequency
- 包含 "exam" 或 "gre" 或 "toefl" 或 "cet6" → advanced + exam + recommended

##### 4. `calculateNextReviewTime($familiarityLevel, $timesCorrect)`
计算下次复习时间（间隔重复算法）。

**间隔规则:**
```php
Level 0: 1 day
Level 1: 2 days
Level 2: 4 days
Level 3: 7 days
Level 4: 15 days
Level 5: 30 days
Level 6: 60 days
Level 7: 120 days

// 特殊规则：如果熟悉度>=5且答对>=5次，间隔180天
```

---

## 🎯 控制器

### AppQyV1VocabularyLibraryPublicController

**位置:** `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`

#### 关键特性:
1. **无 try-catch** - 信任Laravel验证
2. **无 `??` 或 `||`** - 使用显式if语句
3. **自动封面集成** - 通过 `AppQyV1VocabularyCoverService` 获取封面
4. **智能排序** - 推荐优先、难度排序、单词数排序

#### transformLibrary() 方法
将数据库模型转换为API响应格式：
```php
[
  'id' => 1,
  'name' => 'English Beginner Simple',
  'description' => '...',
  'word_count' => 199,
  'language' => 'english',
  'difficulty' => 'beginner',
  'category' => 'foundation',
  'image_url' => 'https://...',
  'cover_status' => 'completed',
  'cover_error' => null,
  'is_recommended' => true,
  'tags' => ['foundation', 'beginner', 'recommended'],
  'cover_log' => null,
]
```

---

## 📋 Models

### 1. AppQyV1VocabularyLibraryModel

**位置:** `app/Apps/AppQyV1/AppQyV1Models/AppQyV1VocabularyLibraryModel.php`

**特性:**
- **Scopes:**
  - `public()` - 只查询公开词库
  - `forLanguage($language)` - 按语言过滤

- **Casts:**
  - `is_public` → boolean
  - `is_recommended` → boolean
  - `tags` → array

### 2. AppQyV1VocabularyItemModel

**位置:** `app/Apps/AppQyV1/AppQyV1Models/AppQyV1VocabularyItemModel.php`

对应新的 `app_qy_v1_vocabulary_items` 表（用于新架构）。

### 3. AppQyV1VocabularyCollectionModel

**位置:** `app/Apps/AppQyV1/AppQyV1Models/AppQyV1VocabularyCollectionModel.php`

对应新的 `app_qy_v1_vocabulary_collections` 表（用于新架构）。

---

## 🔄 数据迁移

### 旧表 vs 新表

系统同时存在两套表结构：

#### 旧架构（当前使用）:
```
app_qy_v1_vocabulary_libraries  (词库表)
app_qy_v1_vocabulary_words      (单词表)
```

#### 新架构（计划中）:
```
app_qy_v1_vocabulary_collections  (词库集合表)
app_qy_v1_vocabulary_items        (词库项表)
```

**新架构优势:**
- `collection_id` + `lang_code` + `word_md5` 设计更灵活
- `extra_data` JSON字段存储额外元数据
- 支持多语言词库
- 更好的去重机制（word_md5）

**迁移文件:**
```
database/migrations/AppQyV1_2025_11_24_000001_create_vocabulary_collections_table.php
database/migrations/AppQyV1_2025_11_24_000002_create_vocabulary_items_table.php
database/migrations/AppQyV1_2025_11_24_000004_create_user_selected_libraries_table.php
```

---

## 🔍 使用示例

### 1. 初始化词库系统

```php
use App\Apps\AppQyV1\Services\AppQyV1VocabularyService;

// 创建表
$result = AppQyV1VocabularyService::ensureVocabularyTablesExist();

// 导入词库文件
$importResult = AppQyV1VocabularyService::importVocabularyFromFiles();
```

### 2. 查询推荐词库

```php
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;

$recommended = AppQyV1VocabularyLibraryModel::query()
    ->public()
    ->forLanguage('english')
    ->where('is_recommended', true)
    ->orderByDesc('total_words')
    ->get();
```

### 3. 获取词库单词

```php
$words = DB::connection('appqyv1')
    ->table('app_qy_v1_vocabulary_words')
    ->where('library_id', 1)
    ->orderBy('word_index')
    ->get();
```

---

## 🚀 推荐优化

### 1. 性能优化
- ✅ 已有索引优化
- ⚠️ 考虑添加单词全文搜索索引
- ⚠️ 对大词库（>50K词）考虑分片

### 2. 功能增强
- 📝 添加词库分类标签系统
- 📝 支持用户自定义词库上传
- 📝 词库收藏/点赞功能
- 📝 学习进度统计

### 3. 数据质量
- 📝 词库去重（跨库去重）
- 📝 添加单词词性、释义
- 📝 集成发音音频
- 📝 例句数据

### 4. 架构迁移
- 📝 逐步迁移到新表结构（collections + items）
- 📝 支持多语言词库
- 📝 实现word_md5去重机制

---

## 📊 统计摘要

- **总词库数:** 8个
- **总单词数:** 197,357个（去重前）
- **推荐词库:** 5个
- **类别分布:**
  - Foundation: 1个
  - Academic: 1个
  - Exam: 3个
  - Frequency: 3个
- **难度分布:**
  - Beginner: 1个
  - Intermediate: 2个
  - Advanced: 5个

---

**生成时间:** 2025-12-18
**分析工具:** Claude Code Assistant
