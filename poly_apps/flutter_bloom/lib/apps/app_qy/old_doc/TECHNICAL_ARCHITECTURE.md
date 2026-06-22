# Word Learning App - Technical Architecture Document

**Project Name**: Word Learning App (app_qy)
**Technology Stack**: Flutter Bloom + Laravel 12 + MySQL/PostgreSQL
**Framework Version**: Flutter Bloom v2.0, Laravel 12
**Documentation Version**: v1.0.0
**Created Date**: 2025-11-02
**Last Updated**: 2025-11-03

---

## 📋 目录

1. [技术栈选型](#技术栈选型)
2. [系统架构设计](#系统架构设计)
3. [数据库设计](#数据库设计)
4. [核心功能实现](#核心功能实现)
5. [性能优化策略](#性能优化策略)
6. [安全方案](#安全方案)
7. [部署架构](#部署架构)

---

## 🛠️ 技术栈选型

### 前端技术栈 (Flutter)

#### **核心框架**
```yaml
Flutter SDK: ^3.16.0
Dart: ^3.2.0
```

#### **状态管理**
```yaml
riverpod: ^2.4.0              # 推荐：类型安全、可测试性强
# 或者
provider: ^6.1.0              # 备选：轻量级、易上手
```

#### **本地数据库**
```yaml
isar: ^3.1.0                  # 推荐：高性能、类型安全、支持索引
# 或者
hive: ^2.2.3                  # 备选：轻量级、快速
drift: ^2.14.0                # 备选：SQL支持、强类型
```

#### **网络请求**
```yaml
dio: ^5.4.0                   # HTTP客户端
retrofit: ^4.0.0              # RESTful API封装
pretty_dio_logger: ^1.3.1     # 网络日志
```

#### **音频播放 (TTS)**
```yaml
flutter_tts: ^3.8.0           # 文字转语音
audioplayers: ^5.2.0          # 音频播放
just_audio: ^0.9.36           # 高级音频控制
```

#### **文档处理**
```yaml
file_picker: ^6.1.1           # 文件选择
pdf_text: ^0.4.0              # PDF解析
docx_to_text: ^0.1.0          # Word解析
```

#### **UI组件库**
```yaml
flutter_screenutil: ^5.9.0    # 屏幕适配
animations: ^2.0.11           # 动画效果
shimmer: ^3.0.0               # 骨架屏
flutter_slidable: ^3.0.0      # 滑动操作
fl_chart: ^0.65.0             # 图表展示
lottie: ^2.7.0                # Lottie动画
```

#### **工具库**
```yaml
intl: ^0.18.1                 # 国际化
shared_preferences: ^2.2.2    # 简单KV存储
path_provider: ^2.1.1         # 路径获取
permission_handler: ^11.1.0   # 权限管理
connectivity_plus: ^5.0.2     # 网络状态
device_info_plus: ^9.1.1      # 设备信息
```

---

### 后端技术栈 (Laravel 12 + PHP)

#### **核心框架**
```php
Laravel Framework: 12.0        # Web框架
PHP: 8.2+                     # 编程语言
Composer: Latest              # 依赖管理
```

#### **数据库相关**
```php
MySQL: 8.0+ / PostgreSQL: 15+  # 数据库
Laravel Eloquent ORM          # ORM
Laravel Migrations            # 数据库迁移
Laravel Database Seeding       # 数据填充
```

#### **认证与安全**
```php
Laravel Sanctum: Latest        # API认证
Laravel Password Hashing       # 密码加密
Laravel CSRF Protection        # CSRF保护
Laravel Rate Limiting          # API限流
```

#### **任务队列**
```php
Laravel Queues: Latest         # 异步任务
Laravel Horizon: Latest        # 队列监控
Redis: Latest                  # 缓存和消息队列
```

#### **文档处理**
```php
Laravel File Storage           # 文件上传
PDF Parser Library             # PDF解析
PHPWord: Latest                # Word解析
NLP PHP Libraries              # 自然语言处理
```

#### **API相关**
```php
Laravel API Resources          # API资源格式化
Laravel HTTP Client            # HTTP客户端
Laravel CORS                   # 跨域处理
```

#### **日志和监控**
```php
Laravel Logging: Latest        # 日志系统
Laravel Telescope: Latest      # 应用监控
Laravel Clockwork: Latest      # 性能分析
```

---

## 🏗️ 系统架构设计

### Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Flutter Bloom Framework                      │
│                      Client Layer (Flutter)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  UI Layer    │  │  Business    │  │  Data Layer  │         │
│  │  (Widgets)   │  │  Logic Layer │  │  (Repos)     │         │
│  │              │  │  (Providers) │  │              │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └────────┬────────┴────────┬────────┘                  │
│                  │                 │                           │
│         ┌────────▼─────────────────▼────────┐                  │
│         │   Flutter Common Database         │                  │
│         │   • Memory bank data              │                  │
│         │   • Word group data               │                  │
│         │   • Cache data                    │                  │
│         └────────┬──────────────────────────┘                  │
│                  │                                             │
└──────────────────┼─────────────────────────────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼─────────────────────────────────────────────┐
│                    Laravel 12 Backend                          │
│                     Headless API Mode                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  API Layer   │  │  Service     │  │  Data Access │         │
│  │ (Controllers)│  │  Layer       │  │  Layer (ORM) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └────────┬────────┴────────┬────────┘                  │
│                  │                 │                           │
│         ┌────────▼─────────────────▼────────┐                  │
│         │       Redis (Cache + Queue)       │                  │
│         └────────┬──────────────────────────┘                  │
│                  │                                             │
└──────────────────┼─────────────────────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────────────────────┐
│               Laravel Shared Database                           │
│                  (MySQL/PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────┤
│  • app_qy_v1_users         • app_qy_v1_dictionary             │
│  • app_qy_v1_word_groups   • app_qy_v1_learning_records       │
│  • app_qy_v1_documents     • shared tables (users, etc.)      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Flutter Bloom App Architecture (app_qy)

```
lib/apps/app_qy/                          # Word Learning App
├── main_app_qy.dart                     # App Entry Point
├── controller_app_qy/                   # App-specific Controllers
│   ├── auth_controller_app_qy.dart
│   ├── word_controller_app_qy.dart
│   └── settings_controller_app_qy.dart
│
├── config_app_qy/                       # App Configuration
│   ├── app_config_app_qy.dart
│   ├── api_config_app_qy.dart
│   ├── api_endpoints_app_qy.dart
│   └── constants_app_qy.dart
│
├── models_app_qy/                       # App Data Models
│   ├── user_model_app_qy.dart
│   ├── word_model_app_qy.dart
│   ├── word_group_model_app_qy.dart
│   ├── memory_record_model_app_qy.dart
│   └── review_task_model_app_qy.dart
│
├── features_app_qy/                     # Feature Modules
│   ├── home/
│   │   ├── views/home_page_app_qy.dart
│   │   ├── widgets/
│   │   └── controllers/
│   ├── learning/
│   │   ├── views/reading_mode_page_app_qy.dart
│   │   ├── views/card_mode_page_app_qy.dart
│   │   ├── widgets/
│   │   └── controllers/
│   ├── word_groups/
│   │   ├── views/word_groups_page_app_qy.dart
│   │   ├── widgets/
│   │   └── controllers/
│   ├── statistics/
│   │   ├── views/statistics_page_app_qy.dart
│   │   ├── widgets/
│   │   └── controllers/
│   └── settings/
│       ├── views/settings_page_app_qy.dart
│       ├── widgets/
│       └── controllers/
│
├── services_app_qy/                      # App Services Layer
│   ├── auth_api_service_app_qy.dart      # Authentication API
│   ├── word_public_api_service_app_qy.dart # Public Word API
│   ├── learning_api_service_app_qy.dart   # Learning API
│   └── document_service_app_qy.dart       # Document Service
│
├── repositories_app_qy/                  # App Repositories
│   ├── word_repository_app_qy.dart
│   ├── memory_repository_app_qy.dart
│   ├── user_repository_app_qy.dart
│   └── document_repository_app_qy.dart
│
├── utils_app_qy/                        # App-specific Utils
│   ├── app_utils_app_qy.dart
│   └── learning_algorithm_app_qy.dart
│
├── localization_app_qy/                  # App Localization
│   ├── en_app_qy.dart
│   ├── zh_app_qy.dart
│   └── localization_keys_app_qy.dart
│
├── resources_app_qy/                     # App Resources
│   ├── assets_icons_app_qy.dart
│   ├── assets_images_app_qy.dart
│   └── assets_fonts_app_qy.dart
│
├── router_app_qy/                        # App Router
│   └── router_app_qy.dart
│
└── tables_maps_app_qy/                   # Database Table Maps
    ├── app_qy_v1_tables_map.php
    └── app_qy_v1_global_tables_bridge.php
```

### Laravel 12 Backend Architecture (app_qy_v1)

```
poly_apps/laravel_main/
├── app/Apps/AppQyV1/                     # AppQy V1 Namespace
│   ├── Controllers/                      # API Controllers
│   │   ├── Auth/
│   │   │   ├── LoginController.php
│   │   │   ├── RegisterController.php
│   │   │   └── ProfileController.php
│   │   ├── Word/
│   │   │   ├── DictionaryController.php
│   │   │   ├── WordGroupController.php
│   │   │   └── LearningController.php
│   │   └── Document/
│   │       ├── DocumentController.php
│   │       └── ProcessingController.php
│   │
│   ├── Models/                           # Eloquent Models
│   │   ├── User.php
│   │   ├── Dictionary.php
│   │   ├── WordGroup.php
│   │   ├── LearningRecord.php
│   │   └── Document.php
│   │
│   ├── Services/                         # Business Logic
│   │   ├── AuthService.php
│   │   ├── WordLearningService.php
│   │   ├── EbbinghausService.php
│   │   └── DocumentProcessingService.php
│   │
│   ├── Repositories/                     # Data Access Layer
│   │   ├── UserRepository.php
│   │   ├── WordRepository.php
│   │   └── LearningRepository.php
│   │
│   ├── Resources/                        # API Resources
│   │   ├── UserResource.php
│   │   ├── WordResource.php
│   │   ├── WordGroupResource.php
│   │   └── LearningRecordResource.php
│   │
│   └── Requests/                         # Form Requests
│       ├── Auth/
│       ├── Word/
│       └── Document/
│
├── database/migrations/                  # Database Migrations
│   ├── 2024_01_01_000001_create_global_tables.php
│   ├── 2024_01_01_000002_create_app_qy_v1_users_table.php
│   ├── 2024_01_01_000003_create_app_qy_v1_dictionary_table.php
│   └── ...
│
└── routes/                              # API Routes
    └── AppQyV1Router/
        ├── api.php                      # AppQy V1 API Routes
        └── web.php                      # Debug Routes (if needed)
```

---

## 🗄️ 数据库设计

### 本地数据库 (Flutter Common Database - SQLite)

#### **1. MemoryRecord（记忆库记录）**
```dart
// Using Flutter common/database abstract interface
class MemoryRecord {
  int? id;

  // 单词基础信息
  late String word;                    // 原词
  late String lemma;                   // 词根形式

  // 学习状态
  late bool isRead;                    // 是否已读
  late int readCount;                  // 阅读次数
  late int correctCount;               // 正确次数
  late int incorrectCount;             // 错误次数
  late double masteryLevel;            // 掌握度 (0-100)

  // 时间记录
  late DateTime firstLearnedAt;        // 首次学习时间
  late DateTime lastReviewedAt;        // 最后复习时间
  late DateTime nextReviewAt;          // 推荐复习时间
  late int reviewIntervalDays;         // 当前复习间隔（天）
  late int reviewStage;                // 复习阶段 (1-10)

  // 关联数据
  late List<String> sourceGroupIds;    // 来源单词组ID列表
  late List<String> exampleSentences;  // 例句列表
  String? phonetic;                    // 音标
  String? definition;                  // 释义

  // 用户数据
  String? userNotes;                   // 用户笔记
  late List<String> userTags;          // 自定义标签
  late bool isFavorite;                // 是否收藏
  late int userDifficulty;             // 用户难度评分 (1-5)

  // 元数据
  late DateTime createdAt;
  late DateTime updatedAt;

  Map<String, dynamic> toJson() => { /* conversion logic */ };
  factory MemoryRecord.fromJson(Map<String, dynamic> json) => { /* parsing logic */ };
}
```

#### **2. WordGroup（单词组）**
```dart
@collection
class WordGroup {
  Id id = Isar.autoIncrement;

  // 基本信息
  @Index(unique: true)
  late String groupId;                 // 组ID (UUID)
  late String name;                    // 组名称
  late String type;                    // 类型: document/standard/custom
  String? description;                 // 描述

  // 单词列表
  late List<String> wordList;          // 单词列表（word字段）

  // 统计数据
  late int totalCount;                 // 总单词数
  late int learnedCount;               // 已学单词数
  late int masteredCount;              // 掌握单词数
  late int reviewDueCount;             // 待复习单词数

  // 学习计划
  int? targetDays;                     // 目标天数
  int? dailyGoal;                      // 每日目标

  // 来源信息（仅 document 类型）
  String? sourceDocument;              // 来源文档路径
  String? documentType;                // 文档类型: pdf/doc/txt

  // 标准词库信息（仅 standard 类型）
  String? standardLibrary;             // 标准词库: coco60000/coco40000/toefl等

  // 时间信息
  late DateTime createdAt;
  late DateTime lastStudiedAt;
  late DateTime updatedAt;

  // 标签
  late List<String> tags;
}
```

#### **3. ReviewTask（复习任务）**
```dart
@collection
class ReviewTask {
  Id id = Isar.autoIncrement;

  late String word;                    // 单词
  late DateTime dueDate;               // 到期日期
  late int priority;                   // 优先级 (1-5)
  late String status;                  // 状态: pending/completed/overdue
  late int reviewStage;                // 复习阶段

  late DateTime createdAt;
  DateTime? completedAt;
}
```

#### **4. UserSettings（用户设置）**
```dart
@collection
class UserSettings {
  Id id = Isar.autoIncrement;

  // 语言设置
  late String appLanguage;             // APP语言
  late String pronunciationEngine;     // 发音引擎: us/uk/au
  late double pronunciationSpeed;      // 发音速度
  late String phoneticFormat;          // 音标格式: ipa/kk

  // 学习设置
  late int dailyWordGoal;              // 每日学习目标
  late int dailyReviewGoal;            // 每日复习目标
  late String defaultLearningMode;     // 默认学习模式
  late String reviewAlgorithm;         // 复习算法

  // 显示设置
  late String themeMode;               // 主题: light/dark/auto
  late String themeColor;              // 主题色
  late int fontSize;                   // 字体大小
  late bool showPhonetic;              // 显示音标

  // 通知设置
  late bool enableDailyReminder;       // 开启每日提醒
  late List<String> reminderTimes;     // 提醒时间列表

  // 其他
  late DateTime updatedAt;
}
```

---

### Laravel 共享数据库 (MySQL/PostgreSQL)

#### **表前缀规范**
- 全局共享表：`global_` 前缀 (如 `global_users`)
- 应用专属表：`app_qy_v1_` 前缀 (AppName + Version)

#### **Schema 设计**

```sql
-- 全局用户表 (多应用共享)
CREATE TABLE global_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_global_users_email ON global_users(email);
CREATE INDEX idx_global_users_username ON global_users(username);


-- app_qy_v1_词库表
CREATE TABLE app_qy_v1_dictionary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(100) NOT NULL,
    lemma VARCHAR(100) NOT NULL,
    phonetic_us VARCHAR(100),
    phonetic_uk VARCHAR(100),
    definitions JSON NOT NULL,          -- [{"pos": "n.", "meaning": "...", "examples": ["..."]}]
    synonyms TEXT[],                    -- MySQL 8.0+ JSON array
    antonyms TEXT[],
    word_forms JSON,                    -- {"plural": "...", "past": "...", ...}
    etymology TEXT,
    frequency_rank INT,
    cefr_level VARCHAR(10),              -- A1, A2, B1, B2, C1, C2
    difficulty INT CHECK (difficulty BETWEEN 1 AND 5),
    standard_libraries JSON,             -- ["coco60000", "toefl", ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_qy_v1_dictionary_word ON app_qy_v1_dictionary(word);
CREATE INDEX idx_app_qy_v1_dictionary_lemma ON app_qy_v1_dictionary(lemma);
CREATE INDEX idx_app_qy_v1_dictionary_frequency ON app_qy_v1_dictionary(frequency_rank);
CREATE INDEX idx_app_qy_v1_dictionary_cefr ON app_qy_v1_dictionary(cefr_level);


-- app_qy_v1_用户单词组表
CREATE TABLE app_qy_v1_word_groups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,           -- document/standard/custom
    description TEXT,
    word_count INT DEFAULT 0,
    source_document VARCHAR(500),
    standard_library VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_app_qy_v1_word_groups_user
        FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_app_qy_v1_word_groups_user ON app_qy_v1_word_groups(user_id);
CREATE INDEX idx_app_qy_v1_word_groups_type ON app_qy_v1_word_groups(type);


-- app_qy_v1_单词组词表（关联表）
CREATE TABLE app_qy_v1_word_group_words (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    group_id BIGINT NOT NULL,
    word VARCHAR(100) NOT NULL,
    dictionary_id BIGINT,
    sentence_context TEXT,
    position_in_doc INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_app_qy_v1_wgw_group
        FOREIGN KEY (group_id) REFERENCES app_qy_v1_word_groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_app_qy_v1_wgw_dictionary
        FOREIGN KEY (dictionary_id) REFERENCES app_qy_v1_dictionary(id)
);

CREATE INDEX idx_app_qy_v1_wgw_group ON app_qy_v1_word_group_words(group_id);
CREATE INDEX idx_app_qy_v1_wgw_word ON app_qy_v1_word_group_words(word);


-- app_qy_v1_用户学习记录表
CREATE TABLE app_qy_v1_learning_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    word VARCHAR(100) NOT NULL,
    read_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    mastery_level DECIMAL(5,2) DEFAULT 0.00,
    first_learned_at TIMESTAMP NULL,
    last_reviewed_at TIMESTAMP NULL,
    next_review_at TIMESTAMP NULL,
    review_interval_days INT DEFAULT 0,
    review_stage INT DEFAULT 0,
    user_notes TEXT,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_app_qy_v1_lr_user
        FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE,
    UNIQUE(user_id, word)
);

CREATE INDEX idx_app_qy_v1_lr_user ON app_qy_v1_learning_records(user_id);
CREATE INDEX idx_app_qy_v1_lr_word ON app_qy_v1_learning_records(word);
CREATE INDEX idx_app_qy_v1_lr_next_review ON app_qy_v1_learning_records(next_review_at);


-- app_qy_v1_文档上传记录表
CREATE TABLE app_qy_v1_documents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,      -- pdf/doc/docx/txt
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    word_count INT DEFAULT 0,
    extracted_text TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending',  -- pending/processing/completed/failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_app_qy_v1_documents_user
        FOREIGN KEY (user_id) REFERENCES global_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_app_qy_v1_documents_user ON app_qy_v1_documents(user_id);
CREATE INDEX idx_app_qy_v1_documents_status ON app_qy_v1_documents(processing_status);
```

---

## 🚀 核心功能实现

### 1. 艾宾浩斯遗忘曲线算法

```dart
class EbbinghausAlgorithm {
  // 复习间隔（天）
  static const List<int> reviewIntervals = [
    0,    // 第0次：立即
    0,    // 第1次：5分钟（用分数表示：5/1440）
    0,    // 第2次：30分钟（30/1440）
    0,    // 第3次：12小时（0.5天）
    1,    // 第4次：1天
    2,    // 第5次：2天
    4,    // 第6次：4天
    7,    // 第7次：7天
    15,   // 第8次：15天
    30,   // 第9次：30天
    60,   // 第10次：60天
  ];

  /// 计算下次复习时间
  static DateTime calculateNextReview({
    required DateTime lastReviewTime,
    required int reviewStage,
    required bool isCorrect,
  }) {
    int nextStage;

    if (isCorrect) {
      // 答对：进入下一阶段
      nextStage = (reviewStage + 1).clamp(0, reviewIntervals.length - 1);
    } else {
      // 答错：重置到第4阶段（1天）
      nextStage = 4;
    }

    int intervalDays = reviewIntervals[nextStage];

    // 特殊处理前3次（小于1天的间隔）
    if (nextStage == 1) {
      return lastReviewTime.add(const Duration(minutes: 5));
    } else if (nextStage == 2) {
      return lastReviewTime.add(const Duration(minutes: 30));
    } else if (nextStage == 3) {
      return lastReviewTime.add(const Duration(hours: 12));
    }

    return lastReviewTime.add(Duration(days: intervalDays));
  }

  /// 计算掌握度
  static double calculateMasteryLevel({
    required int correctCount,
    required int incorrectCount,
    required int reviewStage,
  }) {
    final totalAttempts = correctCount + incorrectCount;
    if (totalAttempts == 0) return 0.0;

    // 基础正确率（0-70分）
    final baseScore = (correctCount / totalAttempts) * 70;

    // 复习阶段加分（0-30分）
    final stageBonus = (reviewStage / reviewIntervals.length) * 30;

    return (baseScore + stageBonus).clamp(0.0, 100.0);
  }
}
```

### 2. 阅读模式核心逻辑

```dart
class ReadingModeProvider extends StateNotifier<ReadingModeState> {
  final WordRepository _wordRepository;
  final MemoryRepository _memoryRepository;
  final TTSService _ttsService;

  Timer? _playTimer;
  final Queue<String> _historyQueue = Queue<String>(); // 瞬时复习历史

  ReadingModeProvider({
    required WordRepository wordRepository,
    required MemoryRepository memoryRepository,
    required TTSService ttsService,
  })  : _wordRepository = wordRepository,
        _memoryRepository = memoryRepository,
        _ttsService = ttsService,
        super(const ReadingModeState());

  /// 加载单词组（从总记忆库排序）
  Future<void> loadWordGroup(String groupId) async {
    try {
      // 1. 获取单词组所有单词
      final wordGroup = await _wordRepository.getWordGroup(groupId);
      final words = wordGroup.wordList;

      // 2. 从总记忆库查询每个单词的学习状态
      final memoryRecords = await _memoryRepository.getMemoryRecords(words);

      // 3. 智能排序：生词 > 待复习 > 已读 > 学会 > 熟练
      final sortedWords = _sortWordsByPriority(words, memoryRecords);

      // 4. 加载指定数量的单词（默认100个）
      final displayWords = sortedWords.take(state.displayCount).toList();

      state = state.copyWith(
        words: displayWords,
        currentIndex: 0,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  /// 智能排序
  List<String> _sortWordsByPriority(
    List<String> words,
    Map<String, MemoryRecord> memoryRecords,
  ) {
    return words.toList()..sort((a, b) {
      final recordA = memoryRecords[a];
      final recordB = memoryRecords[b];

      // 未读优先级最高
      if (recordA == null && recordB != null) return -1;
      if (recordA != null && recordB == null) return 1;
      if (recordA == null && recordB == null) return 0;

      // 待复习优先于已掌握
      final isDueA = recordA.nextReviewAt.isBefore(DateTime.now());
      final isDueB = recordB.nextReviewAt.isBefore(DateTime.now());
      if (isDueA && !isDueB) return -1;
      if (!isDueA && isDueB) return 1;

      // 按掌握度排序（低到高）
      return recordA.masteryLevel.compareTo(recordB.masteryLevel);
    });
  }

  /// 开始播放
  void startPlaying() {
    if (state.isPlaying) return;

    state = state.copyWith(isPlaying: true);
    _playCurrentWord();
  }

  /// 播放当前单词
  void _playCurrentWord() async {
    if (state.currentIndex >= state.words.length) {
      stopPlaying();
      return;
    }

    final currentWord = state.words[state.currentIndex];

    // 添加到历史队列（用于瞬时复习）
    _historyQueue.addLast(currentWord);
    if (_historyQueue.length > 10) {
      _historyQueue.removeFirst();
    }

    // 播放单词发音
    await _ttsService.speak(
      currentWord,
      speed: state.readingSpeed,
      repeat: state.repeatCount,
    );

    // 更新记忆库
    await _updateMemoryRecord(currentWord);

    // 等待间隔时间后播放下一个
    _playTimer = Timer(
      Duration(seconds: state.readingInterval),
      () {
        if (state.isPlaying) {
          nextWord();
        }
      },
    );
  }

  /// 瞬时复习（回退到上一个单词）
  void instantReview() async {
    if (_historyQueue.length < 2) return;

    // 暂停当前播放
    final wasPlaying = state.isPlaying;
    pausePlaying();

    // 获取上一个单词
    _historyQueue.removeLast(); // 移除当前单词
    final previousWord = _historyQueue.last;

    // 播放上一个单词
    await _ttsService.speak(
      previousWord,
      speed: state.readingSpeed,
      highlight: true, // 高亮显示
    );

    // 记录瞬时复习次数
    state = state.copyWith(
      instantReviewCount: state.instantReviewCount + 1,
    );

    // 播放完后继续原位置
    if (wasPlaying) {
      startPlaying();
    }
  }

  /// 更新记忆库
  Future<void> _updateMemoryRecord(String word) async {
    await _memoryRepository.updateMemoryRecord(
      word: word,
      isRead: true,
      readCount: 1, // 累加
      lastReviewedAt: DateTime.now(),
    );
  }

  @override
  void dispose() {
    _playTimer?.cancel();
    _ttsService.stop();
    super.dispose();
  }
}
```

### 3. TTS 服务封装

```dart
class TTSService {
  final FlutterTts _flutterTts = FlutterTts();

  Future<void> initialize({
    required String engine,  // us/uk/au
    required double speed,
    required double volume,
  }) async {
    await _flutterTts.setLanguage(_getLanguageCode(engine));
    await _flutterTts.setSpeechRate(speed);
    await _flutterTts.setVolume(volume);
  }

  Future<void> speak(
    String text, {
    double? speed,
    int repeat = 1,
    bool highlight = false,
  }) async {
    if (speed != null) {
      await _flutterTts.setSpeechRate(speed);
    }

    for (int i = 0; i < repeat; i++) {
      await _flutterTts.speak(text);
      if (i < repeat - 1) {
        await Future.delayed(const Duration(milliseconds: 500));
      }
    }
  }

  Future<void> stop() async {
    await _flutterTts.stop();
  }

  String _getLanguageCode(String engine) {
    switch (engine) {
      case 'us': return 'en-US';
      case 'uk': return 'en-GB';
      case 'au': return 'en-AU';
      default: return 'en-US';
    }
  }
}
```

---

## ⚡ 性能优化策略

### 1. 数据库优化
- **本地数据库索引**：为常查询字段建立索引
- **分页加载**：单词列表使用分页，每页100-200条
- **懒加载**：音频文件按需下载和缓存
- **批量操作**：学习记录批量更新，减少写入次数

### 2. 内存优化
- **图片缓存**：使用 `cached_network_image` 缓存图片
- **音频预加载**：预加载前5个单词音频
- **数据分页**：大列表使用 `ListView.builder` 懒加载
- **dispose管理**：及时释放不用的资源

### 3. 网络优化
- **请求合并**：批量查询词库接口
- **数据压缩**：启用 gzip 压缩
- **离线优先**：优先使用本地缓存数据
- **增量同步**：只同步变更数据

---

## 🔒 安全方案

### 1. 认证方案
- **JWT Token**：双Token机制（Access Token + Refresh Token）
- **Token存储**：使用 `flutter_secure_storage` 加密存储
- **生物识别**：支持指纹/面容登录

### 2. 数据安全
- **传输加密**：HTTPS + TLS 1.3
- **数据库加密**：Isar 支持加密
- **敏感数据**：密码使用 bcrypt 哈希

### 3. 隐私保护
- **数据脱敏**：用户数据匿名化
- **权限最小化**：只申请必要权限
- **GDPR合规**：支持数据导出和删除

---

## 🚀 部署架构

### 生产环境架构

```
Internet
    │
    ▼
┌─────────────────┐
│  CDN (图片/音频) │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Load Balancer  │  (Nginx)
└─────────────────┘
    │
    ├──────────┬──────────┐
    ▼          ▼          ▼
┌─────────┐┌─────────┐┌─────────┐
│ FastAPI ││ FastAPI ││ FastAPI │  (Uvicorn + Gunicorn)
│ Server 1││ Server 2││ Server 3│
└─────────┘└─────────┘└─────────┘
    │          │          │
    └──────────┴──────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐      ┌─────────┐
│  Redis  │      │   DB    │
│(缓存/队列)│      │(Postgres)│
└─────────┘      └─────────┘
```

### Docker 部署

```dockerfile
# FastAPI Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/wordapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=wordapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 📝 总结

本技术架构文档定义了：

✅ **完整的技术栈选型**（Flutter + FastAPI + PostgreSQL）
✅ **清晰的架构分层**（Clean Architecture）
✅ **详细的数据库设计**（本地 + 远程）
✅ **核心功能实现示例**（艾宾浩斯算法 + 阅读模式）
✅ **性能优化策略**（数据库 + 内存 + 网络）
✅ **安全方案**（认证 + 加密 + 隐私）
✅ **部署架构**（Docker + 负载均衡）

下一步可以根据此文档开始实际开发工作。
