# 后端API要求 - 基于语言的背诵分组

**版本**: 2.0
**创建时间**: 2025-12-20
**优先级**: P0 (核心功能)

---

## 🎯 功能概述

### 核心需求
1. **背诵分组必须绑定语言类型**（language字段）
2. **用户修改学习语言时，自动创建对应语言的背诵分组**
3. **添加词组到分组时，只显示匹配语言的分组**
4. **支持同一语言创建多个分组**

### 业务场景

#### 场景1: 用户在设置中选择学习英语
```
用户操作：设置 → 语言设置 → 选择"英语"
前端行为：
  1. 更新 settings.language.learningLanguages = ['en']
  2. 立即调用 StudyGroupsCenter.createLanguageGroup('en')
  3. 前端发送请求: POST /api/study_groups/create_for_language
     Body: { language: 'en' }
后端行为：
  1. 检查该用户是否已有英语的默认分组
  2. 如果没有，创建：
     - name: "English" (或"英语"，根据i18n)
     - language: "en"
     - is_language_default: true
  3. 返回创建的分组
```

#### 场景2: 用户添加CET-6词组（language='en'）到背诵分组
```
前端显示：
  ┌─────────────────────────────────────┐
  │ 选择背诵分组                        │
  ├─────────────────────────────────────┤
  │ 词组：English Exam Cet6             │
  │ 语言：英语 (en)                     │
  │                                     │
  │ 加入到：                            │
  │ ○ 📚 English (默认)                │
  │ ○ 📝 My Exam Preparation           │
  │ ○ 🎯 Business English              │
  │                                     │
  │ [+ 创建新的英语分组]                │
  └─────────────────────────────────────┘

说明：只显示 language='en' 的分组
```

---

## 🗄️ 数据库设计修改

### 1. study_groups 表 - 添加 language 字段

```sql
ALTER TABLE study_groups
ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' COMMENT '分组的语言类型（如en, zh, ja）',
ADD COLUMN is_language_default BOOLEAN DEFAULT FALSE COMMENT '是否为该语言的默认分组',
ADD INDEX idx_uid_language (uid, language),
ADD INDEX idx_uid_language_default (uid, language, is_language_default);
```

**完整表结构（更新后）**:
```sql
CREATE TABLE study_groups (
  -- 基础字段
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  uid VARCHAR(36) NOT NULL COMMENT '用户ID',
  name VARCHAR(100) NOT NULL COMMENT '分组名称',
  description TEXT COMMENT '分组描述',

  -- 类型标识
  is_default BOOLEAN DEFAULT FALSE COMMENT '是否为用户的默认分组（已废弃，使用is_language_default）',
  language VARCHAR(10) NOT NULL DEFAULT 'en' COMMENT '分组的语言类型',
  is_language_default BOOLEAN DEFAULT FALSE COMMENT '是否为该语言的默认分组',

  -- 统计字段
  total_word_groups INT DEFAULT 0 COMMENT '包含的词组数量',
  total_words INT DEFAULT 0 COMMENT '总单词数',
  learned_words INT DEFAULT 0 COMMENT '已学习单词数',

  -- 学习设置
  daily_goal INT DEFAULT 50 COMMENT '每日学习目标',
  study_mode ENUM('sequential', 'random', 'adaptive') DEFAULT 'sequential' COMMENT '学习模式',

  -- 显示设置
  cover_image VARCHAR(255) COMMENT '封面图片',
  color VARCHAR(20) DEFAULT '#3B82F6' COMMENT '主题颜色',
  icon VARCHAR(50) DEFAULT '📚' COMMENT '图标emoji',

  -- 排序和状态
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  is_archived BOOLEAN DEFAULT FALSE COMMENT '是否归档',

  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_studied_at TIMESTAMP NULL COMMENT '最后学习时间',

  -- 索引
  INDEX idx_uid (uid),
  INDEX idx_uid_language (uid, language),
  INDEX idx_uid_language_default (uid, language, is_language_default),

  -- 约束
  CONSTRAINT fk_study_groups_user FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. 唯一约束（可选但推荐）

确保每个用户的每种语言只有一个默认分组：
```sql
ALTER TABLE study_groups
ADD UNIQUE INDEX uk_user_language_default (uid, language, is_language_default);
-- 注意：MySQL 5.7+ 对于UNIQUE索引，NULL值不参与唯一性检查
-- 因此 is_language_default=FALSE 的记录不会冲突
```

---

## 🔌 新增/修改API端点

### 1. 为指定语言创建默认背诵分组（新增）

**Endpoint**: `POST /api/study_groups/create_for_language`

**请求体**:
```json
{
  "language": "en"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "sg_en_default_123",
    "uid": "user_456",
    "name": "English",
    "language": "en",
    "is_language_default": true,
    "total_word_groups": 0,
    "total_words": 0,
    "daily_goal": 50,
    "icon": "🇺🇸",
    "color": "#3B82F6"
  },
  "message": "背诵分组已创建"
}
```

**业务逻辑**:
1. 验证用户登录
2. 检查该用户是否已有该语言的默认分组
   ```sql
   SELECT * FROM study_groups
   WHERE uid = :user_id
     AND language = :language
     AND is_language_default = TRUE
   ```
3. 如果已存在，直接返回该分组
4. 如果不存在，创建新分组：
   - 名称根据语言自动生成（"English", "中文", "日本語"等）
   - `is_language_default = TRUE`
   - `language = 请求的语言代码`
5. 返回分组信息

**语言名称映射** (建议):
```python
LANGUAGE_NAMES = {
    'en': {'zh': '英语', 'en': 'English', 'icon': '🇺🇸'},
    'zh': {'zh': '中文', 'en': 'Chinese', 'icon': '🇨🇳'},
    'ja': {'zh': '日语', 'en': 'Japanese', 'icon': '🇯🇵'},
    'ko': {'zh': '韩语', 'en': 'Korean', 'icon': '🇰🇷'},
    'fr': {'zh': '法语', 'en': 'French', 'icon': '🇫🇷'},
    'de': {'zh': '德语', 'en': 'German', 'icon': '🇩🇪'},
    'es': {'zh': '西班牙语', 'en': 'Spanish', 'icon': '🇪🇸'},
}

def get_default_group_name(language, user_locale='zh'):
    """获取默认分组名称"""
    return LANGUAGE_NAMES.get(language, {}).get(user_locale, language.upper())

def get_language_icon(language):
    """获取语言图标"""
    return LANGUAGE_NAMES.get(language, {}).get('icon', '📚')
```

---

### 2. 获取指定语言的所有背诵分组（新增）

**Endpoint**: `GET /api/study_groups/by_language/{language}`

**路径参数**:
- `language`: 语言代码（如 `en`, `zh`, `ja`）

**响应**:
```json
{
  "success": true,
  "data": {
    "language": "en",
    "study_groups": [
      {
        "id": "sg_en_default",
        "name": "English",
        "is_language_default": true,
        "total_word_groups": 3,
        "total_words": 1500,
        "icon": "🇺🇸"
      },
      {
        "id": "sg_en_exam",
        "name": "Exam Preparation",
        "is_language_default": false,
        "total_word_groups": 2,
        "total_words": 8000,
        "icon": "📝"
      }
    ],
    "total": 2
  }
}
```

**业务逻辑**:
1. 验证用户登录
2. 查询该用户该语言的所有分组
   ```sql
   SELECT * FROM study_groups
   WHERE uid = :user_id
     AND language = :language
     AND is_archived = FALSE
   ORDER BY is_language_default DESC, sort_order ASC
   ```
3. 返回分组列表（默认分组排在最前面）

---

### 3. 修改创建分组API - 支持指定语言

**Endpoint**: `POST /api/study_groups/create`

**请求体（更新）**:
```json
{
  "name": "Business English",
  "description": "Professional workplace vocabulary",
  "language": "en",          // 【新增】必填字段
  "daily_goal": 100,
  "icon": "💼",
  "color": "#10B981"
}
```

**验证**:
- `language` 字段必填
- 验证语言代码是否有效（在支持的语言列表中）

---

### 4. 修改获取所有分组API - 返回language字段

**Endpoint**: `GET /api/study_groups/list`

**响应（更新）**:
```json
{
  "success": true,
  "data": {
    "study_groups": [
      {
        "id": "sg_en_default",
        "name": "English",
        "language": "en",              // 【新增】
        "is_language_default": true,   // 【新增】
        "total_word_groups": 3,
        "total_words": 1500
      },
      {
        "id": "sg_zh_default",
        "name": "中文",
        "language": "zh",              // 【新增】
        "is_language_default": true,   // 【新增】
        "total_word_groups": 1,
        "total_words": 500
      }
    ],
    "total": 2
  }
}
```

---

## 🔄 修改后的自动化业务逻辑

### 1. 用户注册时（更新）

**不再创建通用默认分组**，改为：
- 根据用户首选语言创建第一个背诵分组
- 如果用户未设置首选语言，创建英语分组（默认）

```python
def register_user(username, email, password, preferred_language='en'):
    # 创建用户账号
    user_id = create_user_account(username, email, password)

    # 创建首选语言的默认背诵分组
    create_language_study_group(user_id, preferred_language)

    return success_response

def create_language_study_group(user_id, language):
    """为指定语言创建默认背诵分组"""
    db.execute("""
        INSERT INTO study_groups (
            id, uid, name, language, is_language_default,
            total_word_groups, total_words, learned_words,
            daily_goal, study_mode, color, icon, sort_order
        ) VALUES (
            UUID(), :user_id, :group_name, :language, TRUE,
            0, 0, 0, 50, 'sequential',
            :color, :icon, 0
        )
    """, {
        "user_id": user_id,
        "group_name": get_default_group_name(language),
        "language": language,
        "color": "#3B82F6",
        "icon": get_language_icon(language)
    })
```

### 2. 用户在设置中添加学习语言时（新增）

**触发时机**: 用户在 `/settings_lang` 页面添加新的学习语言

**流程**:
```
用户勾选"日语" → 保存设置
  ↓
前端: POST /api/user/update_learning_languages
      { "learning_languages": ["en", "ja"] }
  ↓
后端: 更新 user.learning_languages
  ↓
后端: 检查用户是否有日语的背诵分组
  ↓
后端: 如果没有，自动调用 create_language_study_group(user_id, 'ja')
  ↓
返回成功
```

**建议实现**:
```python
def update_learning_languages(user_id, new_languages):
    """更新用户学习的语言，并自动创建对应的背诵分组"""

    # 1. 更新用户配置
    db.execute("""
        UPDATE users
        SET learning_languages = :languages
        WHERE id = :user_id
    """, {"user_id": user_id, "languages": json.dumps(new_languages)})

    # 2. 为每个语言创建默认背诵分组（如果不存在）
    for lang in new_languages:
        existing = db.query_one("""
            SELECT id FROM study_groups
            WHERE uid = :user_id
              AND language = :language
              AND is_language_default = TRUE
        """, {"user_id": user_id, "language": lang})

        if not existing:
            create_language_study_group(user_id, lang)

    return success_response
```

---

## 🎯 词组与分组的语言匹配规则

### 规则1: 添加词组到分组时验证语言匹配

**Endpoint**: `POST /api/study_groups/{id}/add_word_group`

**验证逻辑**:
```python
def add_word_group_to_study_group(study_group_id, word_group_id):
    # 1. 获取学习分组信息
    study_group = get_study_group(study_group_id)

    # 2. 获取词组信息
    word_group = get_word_group(word_group_id)

    # 3. 验证语言匹配
    if study_group.language != word_group.language:
        return error({
            "code": "LANGUAGE_MISMATCH",
            "message": f"词组语言({word_group.language})与分组语言({study_group.language})不匹配"
        })

    # 4. 添加到分组
    insert_association(study_group_id, word_group_id)

    # 5. 更新统计
    update_study_group_stats(study_group_id)

    return success_response
```

**错误响应示例**:
```json
{
  "success": false,
  "error": {
    "code": "LANGUAGE_MISMATCH",
    "message": "词组语言(ja)与分组语言(en)不匹配",
    "word_group_language": "ja",
    "study_group_language": "en"
  }
}
```

---

## 📊 数据迁移脚本（对于现有数据）

如果数据库中已有 study_groups 数据，需要执行迁移：

```sql
-- 1. 添加language字段（已在ALTER TABLE中）
ALTER TABLE study_groups
ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en',
ADD COLUMN is_language_default BOOLEAN DEFAULT FALSE;

-- 2. 为现有分组设置language（根据实际情况调整）
-- 方案A: 所有现有分组默认为英语
UPDATE study_groups
SET language = 'en'
WHERE language IS NULL OR language = '';

-- 方案B: 根据用户的learning_languages推断
UPDATE study_groups sg
JOIN users u ON sg.uid = u.id
SET sg.language = JSON_UNQUOTE(JSON_EXTRACT(u.learning_languages, '$[0]'))
WHERE sg.language = 'en'
  AND u.learning_languages IS NOT NULL;

-- 3. 为每个用户的第一个分组设置为语言默认分组
UPDATE study_groups sg1
SET is_language_default = TRUE
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY uid, language ORDER BY created_at) AS rn
    FROM study_groups
  ) sg2
  WHERE rn = 1
);

-- 4. 添加索引
ALTER TABLE study_groups
ADD INDEX idx_uid_language (uid, language),
ADD INDEX idx_uid_language_default (uid, language, is_language_default);
```

---

## 🧪 测试用例

### 测试1: 用户添加新学习语言
```bash
# 1. 用户登录，当前学习语言: ["en"]
GET /api/study_groups/list
# 验证: 返回1个英语分组

# 2. 用户在设置中添加日语
POST /api/user/update_learning_languages
Body: { "learning_languages": ["en", "ja"] }

# 3. 验证自动创建日语分组
GET /api/study_groups/list
# 验证: 返回2个分组（英语 + 日语）

# 4. 验证日语分组是默认分组
GET /api/study_groups/by_language/ja
# 验证: 返回1个分组，is_language_default=true
```

### 测试2: 语言匹配验证
```bash
# 1. 获取英语分组
GET /api/study_groups/by_language/en
# 记录分组ID: sg_en_123

# 2. 尝试添加日语词组到英语分组
POST /api/study_groups/sg_en_123/add_word_group
Body: { "word_group_id": "jp_hiragana_001" }

# 3. 验证返回错误
# 预期: success=false, error.code="LANGUAGE_MISMATCH"
```

### 测试3: 创建同语言的多个分组
```bash
# 1. 已有英语默认分组
GET /api/study_groups/by_language/en
# 返回: "English" (is_language_default=true)

# 2. 创建另一个英语分组
POST /api/study_groups/create
Body: {
  "name": "Business English",
  "language": "en",
  "icon": "💼"
}

# 3. 验证创建成功
GET /api/study_groups/by_language/en
# 验证: 返回2个英语分组
```

---

## 📝 前后端数据格式约定（更新）

### StudyGroup 对象（更新）
```typescript
interface StudyGroup {
  id: string;
  uid: string;
  name: string;
  description?: string;
  language: string;              // 【新增】语言代码（en, zh, ja等）
  is_language_default: boolean;  // 【新增】是否为该语言的默认分组
  is_default: boolean;           // 【废弃】保留兼容性
  total_word_groups: number;
  total_words: number;
  learned_words: number;
  progress: number;
  daily_goal: number;
  study_mode: 'sequential' | 'random' | 'adaptive';
  cover_image?: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  last_studied_at?: string;
}
```

### CreateStudyGroupRequest（更新）
```typescript
interface CreateStudyGroupRequest {
  name: string;
  language: string;              // 【新增】必填
  description?: string;
  daily_goal?: number;
  study_mode?: 'sequential' | 'random' | 'adaptive';
  color?: string;
  icon?: string;
}
```

---

## ⏱️ 实现优先级

### P0 (立即实现)
1. ✅ 添加 language 和 is_language_default 字段到 study_groups 表
2. ✅ 实现 `POST /api/study_groups/create_for_language`
3. ✅ 实现 `GET /api/study_groups/by_language/{language}`
4. ✅ 修改 `POST /api/study_groups/create` 支持 language 字段
5. ✅ 修改 `GET /api/study_groups/list` 返回 language 字段
6. ✅ 修改 `POST /api/user/update_learning_languages` 自动创建分组

### P1 (第二阶段)
7. ✅ 在 `POST /api/study_groups/{id}/add_word_group` 中验证语言匹配
8. ✅ 数据迁移脚本（如有现有数据）

---

## 🎨 建议的UI变化（供前端参考）

### 语言设置页面
```
┌─────────────────────────────────────┐
│ 语言设置                            │
├─────────────────────────────────────┤
│ 我要学习的语言：                    │
│                                     │
│ ☑️ 🇺🇸 English                      │
│    已创建背诵分组 ✅                │
│                                     │
│ ☑️ 🇯🇵 日本語                       │
│    已创建背诵分组 ✅                │
│                                     │
│ ☐ 🇰🇷 한국어                        │
│    勾选后自动创建背诵分组            │
│                                     │
└─────────────────────────────────────┘
```

### 添加词组到分组（语言过滤）
```
┌─────────────────────────────────────┐
│ 选择背诵分组                        │
├─────────────────────────────────────┤
│ 词组：JLPT N3 Vocabulary            │
│ 语言：日本語 (ja)                   │
│                                     │
│ 加入到日语分组：                    │
│ ○ 🇯🇵 日本語 (默认)                │
│ ○ 📝 JLPT Preparation              │
│                                     │
│ [+ 创建新的日语分组]                │
│                                     │
│ ❌ 英语分组（已过滤，不显示）        │
└─────────────────────────────────────┘
```

---

## 📞 总结

### 核心变更
1. **study_groups 表添加 language 字段** - 每个分组绑定一种语言
2. **自动创建语言分组** - 用户选择学习语言时自动创建
3. **语言匹配验证** - 词组只能添加到同语言的分组
4. **支持多分组** - 同一语言可以有多个分组

### API清单
| API | 说明 | 优先级 |
|-----|------|--------|
| `POST /api/study_groups/create_for_language` | 为语言创建默认分组 | P0 |
| `GET /api/study_groups/by_language/{lang}` | 获取指定语言的所有分组 | P0 |
| `POST /api/study_groups/create` | 创建分组（支持language） | P0 |
| `GET /api/study_groups/list` | 获取所有分组（返回language） | P0 |
| `POST /api/user/update_learning_languages` | 更新学习语言（自动创建分组） | P0 |

---

*Generated on 2025-12-20 | WordFlow AI Backend Team*
