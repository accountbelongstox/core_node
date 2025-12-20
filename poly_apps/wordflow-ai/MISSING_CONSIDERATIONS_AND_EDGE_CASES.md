# 缺失的考虑点和边缘案例分析

**创建时间**: 2025-12-20
**目的**: 识别需求文档中未明确提及但需要考虑的场景

---

## 🔍 数据完整性问题

### 1. word_groups 表是否有 language 字段？

**问题描述**:
要验证"词组语言"与"分组语言"是否匹配，前提是 `word_groups` 表必须有 `language` 字段。

**当前状态**: ❓ **未在需求文档中明确提及**

**影响**:
如果 word_groups 表没有 language 字段，无法实现语言匹配验证。

**需要确认**:
```sql
-- 检查 word_groups 表结构
DESCRIBE word_groups;

-- 应该包含类似字段:
-- language VARCHAR(10) NOT NULL COMMENT '词组语言（en, zh, ja等）'
```

**建议**:
```sql
-- 如果没有，立即添加
ALTER TABLE word_groups
ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en' COMMENT '词组语言',
ADD INDEX idx_language (language);

-- 迁移现有数据（根据词组名称或分类推断语言）
UPDATE word_groups
SET language = 'en'
WHERE name LIKE '%CET%' OR name LIKE '%IELTS%' OR name LIKE '%TOEFL%';

UPDATE word_groups
SET language = 'ja'
WHERE name LIKE '%JLPT%' OR name LIKE '%日本語%';
```

**优先级**: 🔴 **P0 - 阻塞性问题**

---

### 2. 如何处理没有明确语言的词组？

**场景**:
- 用户自己创建的词组，可能没有指定语言
- 从文档导入的词组，语言识别可能失败

**当前行为**: ❓ **未定义**

**可能的解决方案**:

**方案A: 使用用户的首选语言作为默认值**
```python
def create_user_word_group(user_id, name, words):
    user = get_user(user_id)
    default_language = user.learning_languages[0] if user.learning_languages else 'en'

    return create_word_group(
        name=name,
        words=words,
        language=default_language  # 使用首选语言
    )
```

**方案B: 强制用户选择语言**
```json
// 前端创建词组时必须提供language
POST /api/word_groups/create
{
  "name": "My Custom Vocabulary",
  "language": "en",  // 必填
  "words": [...]
}
```

**方案C: 自动检测语言**
```python
def detect_language_from_words(words):
    """从词汇内容自动检测语言"""
    # 简单实现：检查字符集
    for word in words[:10]:  # 检查前10个词
        if re.search(r'[\u4e00-\u9fff]', word):  # 中文
            return 'zh'
        if re.search(r'[\u3040-\u30ff]', word):  # 日语
            return 'ja'
        if re.search(r'[\uac00-\ud7af]', word):  # 韩语
            return 'ko'
    return 'en'  # 默认英语
```

**建议**: 结合方案B和C
- 前端提供语言选择器（默认值通过方案C自动检测）
- 后端验证language字段必填

**优先级**: 🟡 **P1 - 影响用户体验**

---

## 🔄 用户注册流程

### 3. 用户注册时是否自动创建默认分组？

**需求文档说明**:
> 根据用户首选语言创建第一个背诵分组

**问题**:
1. 如果用户注册时未选择语言怎么办？
2. 是否应该为所有"常用语言"都创建分组？

**建议流程**:

**流程A: 保守策略（推荐）**
```
用户注册 → 询问首选语言（必选）→ 创建该语言的默认分组
```

**流程B: 激进策略**
```
用户注册 → 不询问语言 → 创建英语默认分组（假设最常见）
用户首次访问语言设置 → 引导选择学习语言 → 自动创建对应分组
```

**流程C: 延迟初始化**
```
用户注册 → 不创建任何分组
用户首次添加词组 → 检测到没有分组 → 自动创建对应语言的分组
```

**当前实现**: ❓ **需要确认**

**测试步骤**:
```bash
# 1. 创建新用户
curl -X POST /api/auth/register \
  -d '{"username": "testuser", "email": "test@example.com", "password": "xxx"}'

# 2. 立即查询该用户的分组
curl -X GET /api/study_groups/list \
  -H "Authorization: Bearer $NEW_USER_TOKEN"

# 3. 检查返回结果
# 预期: 应该有1个默认分组？还是0个？
```

**优先级**: 🟡 **P1 - 用户首次体验**

---

## 📊 API设计问题

### 4. 列表API是否支持分页？

**问题**:
如果一个用户有50个背诵分组（例如为每个课程创建一个分组），`GET /api/study_groups/list` 一次性返回所有数据可能导致性能问题。

**当前设计**: ❓ **需求文档未提及分页**

**建议**:
```json
// 请求
GET /api/study_groups/list?page=1&page_size=20&language=en

// 响应
{
  "success": true,
  "data": {
    "study_groups": [...],
    "pagination": {
      "current_page": 1,
      "page_size": 20,
      "total": 45,
      "total_pages": 3
    }
  }
}
```

**优先级**: 🟢 **P2 - 性能优化**

---

### 5. 按语言获取分组是否支持多语言查询？

**场景**:
用户想要同时获取英语和日语的所有分组。

**当前设计**:
```
GET /api/study_groups/by_language/en  // 只能查询一种语言
```

**可能的改进**:
```
// 方案A: 使用查询参数
GET /api/study_groups/list?languages=en,ja,zh

// 方案B: 使用POST请求
POST /api/study_groups/query
{
  "languages": ["en", "ja", "zh"],
  "is_language_default": true  // 可选过滤条件
}
```

**优先级**: 🟢 **P2 - 便利性增强**

---

## 🛡️ 安全和权限问题

### 6. 是否验证用户只能访问自己的分组？

**风险**:
如果没有权限验证，用户A可能通过猜测分组ID访问用户B的分组。

**需要验证的端点**:
```bash
# 测试: 用户A尝试访问用户B的分组
curl -X GET /api/study_groups/{USER_B_GROUP_ID} \
  -H "Authorization: Bearer $USER_A_TOKEN"

# 预期: 应该返回 403 Forbidden 或 404 Not Found
```

**建议的验证逻辑**:
```python
def get_study_group(group_id, user_id):
    group = db.query_one("""
        SELECT * FROM study_groups
        WHERE id = :group_id
    """, {"group_id": group_id})

    if not group:
        return error_404("分组不存在")

    # 权限验证
    if group.uid != user_id:
        return error_403("无权访问此分组")

    return success(group)
```

**优先级**: 🔴 **P0 - 安全漏洞**

---

### 7. 是否限制用户创建分组的数量？

**风险**:
恶意用户可能创建大量分组，占用数据库资源。

**建议**:
```python
# 限制每个用户最多创建100个分组
MAX_STUDY_GROUPS_PER_USER = 100

def create_study_group(user_id, data):
    existing_count = db.query_scalar("""
        SELECT COUNT(*) FROM study_groups
        WHERE uid = :user_id AND is_archived = FALSE
    """, {"user_id": user_id})

    if existing_count >= MAX_STUDY_GROUPS_PER_USER:
        return error({
            "code": "QUOTA_EXCEEDED",
            "message": f"已达到分组数量上限（{MAX_STUDY_GROUPS_PER_USER}个）"
        })

    # 继续创建...
```

**优先级**: 🟡 **P1 - 防滥用**

---

## 🔀 并发问题

### 8. 同一用户同时创建多个相同语言的默认分组

**场景**:
用户快速点击两次"选择英语"按钮，前端可能同时发送两个请求到 `create_for_language`。

**风险**:
如果没有幂等性保护，可能创建两个 `is_language_default=TRUE` 的英语分组。

**建议的幂等性实现**:
```python
def create_language_study_group(user_id, language):
    # 使用数据库锁或唯一约束确保幂等性
    try:
        # 方案A: 使用 INSERT IGNORE（MySQL）
        db.execute("""
            INSERT INTO study_groups (
                id, uid, name, language, is_language_default, ...
            ) VALUES (
                UUID(), :user_id, :name, :language, TRUE, ...
            )
            ON DUPLICATE KEY UPDATE id=id  -- 如果已存在，不做任何操作
        """)
    except IntegrityError:
        # 方案B: 先查询，如果存在则返回
        existing = db.query_one("""
            SELECT * FROM study_groups
            WHERE uid = :user_id
              AND language = :language
              AND is_language_default = TRUE
        """)
        return success(existing)
```

**需要的数据库约束**:
```sql
-- 确保每个用户的每种语言只有一个默认分组
ALTER TABLE study_groups
ADD UNIQUE INDEX uk_user_language_default (uid, language, is_language_default);
```

**优先级**: 🟡 **P1 - 数据一致性**

---

## 🗑️ 数据删除和清理

### 9. 删除学习语言时，是否删除对应的分组？

**场景**:
用户在语言设置中取消勾选"日语"。

**问题**:
1. 日语的背诵分组是否应该被删除？
2. 如果分组中已有学习进度，删除会导致数据丢失吗？

**建议策略**:

**方案A: 软删除（推荐）**
```python
def remove_learning_language(user_id, language):
    # 不删除分组，只归档
    db.execute("""
        UPDATE study_groups
        SET is_archived = TRUE
        WHERE uid = :user_id AND language = :language
    """)
```

**方案B: 保留但提示**
```python
def remove_learning_language(user_id, language):
    # 不做任何操作，只更新用户设置
    # 前端显示提示："您的日语分组仍然保留，可以在分组列表中找到"
    pass
```

**方案C: 询问用户**
```json
// 前端弹出确认对话框
{
  "message": "取消学习日语后，您的日语分组将被归档（可以在归档列表中恢复）。是否继续？",
  "options": ["归档分组", "保留分组", "取消"]
}
```

**当前行为**: ❓ **需求文档未说明**

**优先级**: 🟡 **P1 - 用户体验**

---

### 10. 删除分组时，是否删除学习进度？

**场景**:
用户删除一个背诵分组。

**关联数据**:
```
study_groups (分组)
  ↓ (一对多)
study_group_word_groups (分组-词组关联)
  ↓ (可能关联)
user_word_progress (用户的单词学习进度)
```

**问题**:
1. 删除分组时，是否级联删除 `study_group_word_groups` 记录？
2. 是否保留 `user_word_progress` 记录（用户的学习进度）？

**建议**:
```sql
-- 分组删除时级联删除关联记录
ALTER TABLE study_group_word_groups
ADD CONSTRAINT fk_sgwg_study_group
FOREIGN KEY (study_group_id) REFERENCES study_groups(id)
ON DELETE CASCADE;  -- 分组删除时自动删除关联

-- 但保留用户的单词学习进度
-- user_word_progress 表不依赖 study_groups
```

**优先级**: 🟡 **P1 - 数据完整性**

---

## 🌐 国际化问题

### 11. 默认分组名称的多语言支持

**当前设计**:
```python
LANGUAGE_NAMES = {
    'en': {'zh': '英语', 'en': 'English', 'icon': '🇺🇸'},
    'ja': {'zh': '日语', 'en': 'Japanese', 'icon': '🇯🇵'},
    ...
}
```

**问题**:
1. 如果用户的界面语言不是中文或英语怎么办？
2. 分组名称是存储在数据库还是动态翻译？

**方案A: 存储用户语言的名称**
```python
def create_language_study_group(user_id, language):
    user = get_user(user_id)
    user_locale = user.interface_language  # 'zh', 'en', 'ja'...

    group_name = LANGUAGE_NAMES.get(language, {}).get(user_locale, language.upper())

    db.execute("""
        INSERT INTO study_groups (name, language, ...)
        VALUES (:name, :language, ...)
    """, {"name": group_name, ...})
```

**方案B: 存储语言代码，前端动态翻译**
```python
# 后端只存储语言代码作为name
db.execute("""
    INSERT INTO study_groups (name, language, ...)
    VALUES (:language, :language, ...)  -- name = 'en', language = 'en'
""")

# 前端根据用户界面语言动态翻译
const displayName = t(`languages.${group.name}`)  // 'English' or '英语'
```

**建议**: 使用方案B（更灵活，支持动态切换界面语言）

**优先级**: 🟢 **P2 - 国际化增强**

---

## 📈 统计和性能

### 12. 分组统计字段的更新机制

**字段**:
```sql
total_word_groups INT    -- 包含的词组数量
total_words INT          -- 总单词数
learned_words INT        -- 已学习单词数
```

**问题**:
这些字段是实时计算还是定期更新？

**方案A: 实时计算（不存储）**
```python
def get_study_group(group_id):
    group = db.query_one("SELECT * FROM study_groups WHERE id = :id")

    # 实时计算统计
    stats = db.query_one("""
        SELECT
            COUNT(DISTINCT sgwg.word_group_id) AS total_word_groups,
            SUM(wg.total_words) AS total_words,
            SUM(sgwg.mastered_count) AS learned_words
        FROM study_group_word_groups sgwg
        JOIN word_groups wg ON sgwg.word_group_id = wg.id
        WHERE sgwg.study_group_id = :group_id
    """)

    return {**group, **stats}
```

**方案B: 异步更新（存储）**
```python
def add_word_group_to_study_group(study_group_id, word_group_id):
    # 添加关联
    insert_association(study_group_id, word_group_id)

    # 异步更新统计（使用队列）
    queue.enqueue(update_study_group_stats, study_group_id)

def update_study_group_stats(study_group_id):
    stats = calculate_stats(study_group_id)
    db.execute("""
        UPDATE study_groups
        SET total_word_groups = :total_word_groups,
            total_words = :total_words,
            learned_words = :learned_words
        WHERE id = :id
    """, {**stats, "id": study_group_id})
```

**方案C: 触发器更新（推荐）**
```sql
-- 当添加词组到分组时自动更新统计
CREATE TRIGGER update_study_group_stats_on_add
AFTER INSERT ON study_group_word_groups
FOR EACH ROW
BEGIN
    UPDATE study_groups sg
    SET total_word_groups = (
        SELECT COUNT(*) FROM study_group_word_groups
        WHERE study_group_id = NEW.study_group_id
    ),
    total_words = (
        SELECT SUM(wg.total_words)
        FROM study_group_word_groups sgwg
        JOIN word_groups wg ON sgwg.word_group_id = wg.id
        WHERE sgwg.study_group_id = NEW.study_group_id
    )
    WHERE sg.id = NEW.study_group_id;
END;
```

**当前实现**: ❓ **需要确认**

**优先级**: 🟡 **P1 - 性能和准确性**

---

## 🔄 业务逻辑边缘案例

### 13. 用户可以删除语言的默认分组吗？

**场景**:
用户删除了英语的默认分组（is_language_default=TRUE）。

**问题**:
1. 删除后，该语言还有默认分组吗？
2. 如果用户再次添加英语词组，显示哪些分组？

**建议**:
```python
def delete_study_group(group_id, user_id):
    group = get_study_group(group_id)

    # 检查是否为语言默认分组
    if group.is_language_default:
        # 方案A: 禁止删除
        return error({
            "code": "CANNOT_DELETE_DEFAULT_GROUP",
            "message": "不能删除语言的默认分组，请先创建另一个分组并设为默认"
        })

        # 方案B: 自动指定新的默认分组
        other_groups = get_groups_by_language(user_id, group.language)
        if other_groups:
            set_as_default(other_groups[0].id)

    # 执行删除
    db.execute("DELETE FROM study_groups WHERE id = :id", {"id": group_id})
```

**优先级**: 🟡 **P1 - 业务规则**

---

### 14. 修改分组的language字段是否允许？

**场景**:
用户创建了一个英语分组，里面已经有10个英语词组。现在想把这个分组改成日语分组。

**当前API设计**:
```
POST /api/study_groups/{id}/update
{
  "name": "新名称",
  "language": "ja"  // 是否允许修改？
}
```

**建议**: **不允许修改language字段**
```python
def update_study_group(group_id, updates):
    if 'language' in updates:
        return error({
            "code": "LANGUAGE_IMMUTABLE",
            "message": "不能修改分组的语言，请创建新分组"
        })
```

**理由**:
- 修改language会导致现有词组的语言不匹配
- 可能破坏学习进度的统计

**优先级**: 🟡 **P1 - 数据一致性**

---

## 📋 完整的边缘案例清单

| # | 场景 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | word_groups表缺少language字段 | 🔴 P0 | ❓ 待确认 |
| 2 | 用户只能访问自己的分组 | 🔴 P0 | ❓ 待确认 |
| 3 | 用户注册时的默认分组创建 | 🟡 P1 | ❓ 待确认 |
| 4 | 词组没有明确语言时的处理 | 🟡 P1 | ❓ 待确认 |
| 5 | 同一用户同时创建相同语言的默认分组 | 🟡 P1 | ❓ 待确认 |
| 6 | 删除学习语言时的分组处理 | 🟡 P1 | ❓ 待确认 |
| 7 | 删除分组时的进度保留 | 🟡 P1 | ❓ 待确认 |
| 8 | 统计字段的更新机制 | 🟡 P1 | ❓ 待确认 |
| 9 | 删除语言默认分组的限制 | 🟡 P1 | ❓ 待确认 |
| 10 | 修改分组language字段的限制 | 🟡 P1 | ❓ 待确认 |
| 11 | 限制用户创建分组的数量 | 🟡 P1 | ❓ 待确认 |
| 12 | 列表API的分页支持 | 🟢 P2 | ❓ 待确认 |
| 13 | 多语言查询支持 | 🟢 P2 | ❓ 待确认 |
| 14 | 默认分组名称的国际化 | 🟢 P2 | ❓ 待确认 |

---

## 🎯 建议的补充要求文档

建议后端团队创建以下文档：

### 1. **业务规则文档** (Business Rules)
明确定义：
- 用户可以创建多少个分组？
- 是否允许删除默认分组？
- 是否允许修改分组的语言？
- 删除学习语言时如何处理分组？

### 2. **权限和安全文档** (Security & Permissions)
明确定义：
- 所有API的权限验证规则
- 防止CSRF、注入攻击的措施
- API限流策略

### 3. **错误码文档** (Error Codes)
标准化所有错误码：
```json
{
  "LANGUAGE_MISMATCH": "词组语言与分组语言不匹配",
  "QUOTA_EXCEEDED": "已达到数量上限",
  "CANNOT_DELETE_DEFAULT_GROUP": "不能删除默认分组",
  "LANGUAGE_IMMUTABLE": "不能修改分组的语言",
  ...
}
```

### 4. **性能指标文档** (Performance Metrics)
定义可接受的性能指标：
- API响应时间 < 200ms
- 支持的最大分组数量 = 100
- 支持的最大词组数量 = 1000

---

## 📞 后续行动

### 立即行动
1. 后端团队审查本文档，确认每个场景的处理策略
2. 更新 `BACKEND_LANGUAGE_BASED_STUDY_GROUPS_REQUIREMENT.md`，明确这些边缘案例的处理方式
3. 前端团队根据确认的策略调整代码

### 本周完成
1. 补充业务规则文档
2. 补充错误码文档
3. 执行所有边缘案例的测试

---

**文档负责人**: 待指定
**审核截止日期**: 2025-12-21
**优先级**: P0 - 影响核心功能

*Generated on 2025-12-20 | WordFlow AI Development Team*
