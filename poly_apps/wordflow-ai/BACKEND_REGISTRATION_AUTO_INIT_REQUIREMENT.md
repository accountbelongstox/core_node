# 后端要求 - 用户注册时自动初始化

**优先级**: P0 (核心功能)
**创建时间**: 2025-12-20

---

## 📋 需求概述

当用户注册新账号时，后端需要**自动创建默认学习分组**，而不是创建测试词组数据。

---

## 🔴 重要说明

### 词组 vs 学习分组的区别

| 概念 | 英文 | 说明 | 谁创建 |
|------|------|------|--------|
| **词组** | Word Group | 词库，包含一组单词的集合 | 系统预置 / 用户上传文档 / 用户手动创建 |
| **学习分组** | Study Group | 学习计划，可以包含多个词组 | **注册时自动创建默认分组** + 用户手动创建 |

### 当前问题
用户在Library页面看到的是**词组（Word Groups）**，不是学习分组。如果显示了测试数据，说明：
1. 后端返回了测试词组数据（需要清理）
2. 或者是系统预置的词库（可以保留，但应该明确标记为系统词库）

---

## ✅ 注册时自动初始化要求

### 1. 用户注册成功后，立即执行以下操作

#### A. 创建默认学习分组（必须）

**表**: `study_groups`

**SQL示例**:
```sql
INSERT INTO study_groups (
  id,
  uid,
  name,
  description,
  is_default,
  total_word_groups,
  total_words,
  learned_words,
  daily_goal,
  study_mode,
  color,
  icon,
  sort_order,
  created_at,
  updated_at
) VALUES (
  UUID(),                                    -- 生成UUID
  :user_id,                                  -- 刚注册的用户ID
  '默认分组',                                -- 固定名称
  '系统自动创建的默认学习分组',              -- 固定描述
  TRUE,                                      -- 是默认分组
  0,                                         -- 初始没有词组
  0,                                         -- 初始没有单词
  0,                                         -- 初始未学习
  50,                                        -- 默认每日目标50词
  'sequential',                              -- 默认顺序学习模式
  '#3B82F6',                                 -- 蓝色主题
  '📚',                                       -- 书本图标
  0,                                         -- 排序为0（最前面）
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

#### B. 不要创建测试词组（重要！）

**❌ 错误做法**:
```sql
-- 不要这样做！
INSERT INTO groups (gid, gname, ...) VALUES
  ('test_001', 'IELTS Core 3000', ...),
  ('test_002', 'Business English', ...),
  ('test_003', 'My Uploaded PDF', ...);
```

**✅ 正确做法**:
- 只创建默认学习分组
- 让用户自己选择要学习的词库
- 或者提供推荐词库供用户选择

---

## 🔌 注册API端点修改

### `POST /api/auth/register` 或 `/api/user/register`

**修改后的业务流程**:

```python
def register_user(username, email, password):
    # 1. 验证输入
    validate_registration_data(username, email, password)

    # 2. 检查用户名/邮箱是否已存在
    if user_exists(email):
        return error("Email already registered")

    # 3. 创建用户账号
    user_id = create_user_account(username, email, password)

    # 4. 【新增】自动创建默认学习分组
    create_default_study_group(user_id)

    # 5. 生成token
    token = generate_auth_token(user_id)

    # 6. 返回用户信息
    return {
        "success": True,
        "data": {
            "user": get_user_info(user_id),
            "token": token
        },
        "message": "Registration successful"
    }

def create_default_study_group(user_id):
    """注册时自动创建默认学习分组"""
    db.execute("""
        INSERT INTO study_groups (
            id, uid, name, description, is_default,
            total_word_groups, total_words, learned_words,
            daily_goal, study_mode, color, icon, sort_order
        ) VALUES (
            UUID(), :user_id, '默认分组',
            '系统自动创建的默认学习分组', TRUE,
            0, 0, 0, 50, 'sequential',
            '#3B82F6', '📚', 0
        )
    """, {"user_id": user_id})
```

---

## 🎯 预期行为

### 场景1: 新用户注册

**步骤**:
1. 用户填写注册信息 → 提交
2. 后端验证 → 创建用户账号
3. **自动创建默认学习分组**
4. 返回用户信息 + token
5. 前端跳转到主页

**用户看到的**:
- Library页面：空的，没有任何词组（✅ 正确）
- 学习分组：有一个"默认分组"（✅ 正确）

### 场景2: 用户首次访问学习分组

**前端调用**: `GET /api/study_groups/list`

**后端返回**:
```json
{
  "success": true,
  "data": {
    "study_groups": [
      {
        "id": "sg_abc123",
        "name": "默认分组",
        "description": "系统自动创建的默认学习分组",
        "is_default": true,
        "total_word_groups": 0,
        "total_words": 0,
        "learned_words": 0,
        "progress": 0,
        "daily_goal": 50,
        "icon": "📚",
        "color": "#3B82F6"
      }
    ],
    "total": 1
  }
}
```

### 场景3: 用户添加词组到学习分组

**步骤**:
1. 用户在Library页面看到系统词库（如果后端提供）
2. 用户点击某个词组（如 "CET6"）
3. 前端调用: `POST /api/study_groups/{默认分组ID}/add_word_group`
   ```json
   {
     "word_group_id": "group_cet6_001"
   }
   ```
4. 后端更新学习分组统计
5. 用户可以开始学习

---

## 🗄️ 数据库初始化建议

### 选项1: 纯净初始化（推荐）
- 只创建默认学习分组
- 不创建任何测试词组
- 让用户自己添加或上传词组

### 选项2: 提供系统词库（可选）
如果要提供预置词库，应该：
1. 明确标记为 `type = 'system'`
2. 在Library页面单独展示为"系统推荐词库"
3. 不自动添加到用户的学习分组

**系统词库示例**:
```sql
INSERT INTO groups (gid, gname, type, language, total_words, description) VALUES
  ('sys_cet4', 'CET-4 Core Vocabulary', 'system', 'en', 4000, 'Essential words for CET-4 exam'),
  ('sys_cet6', 'CET-6 Core Vocabulary', 'system', 'en', 8013, 'Essential words for CET-6 exam'),
  ('sys_toefl', 'TOEFL Mastery', 'system', 'en', 3000, 'Advanced academic vocabulary'),
  ('sys_ielts', 'IELTS Core 3000', 'system', 'en', 3000, 'Essential vocabulary for high IELTS scores');
```

---

## 📊 前后端协作流程

### 1. 用户注册
```
前端: POST /api/auth/register
后端:
  ↓ 创建用户
  ↓ 自动创建默认学习分组 ✅
  ↓ 返回 user + token
前端: 跳转到主页
```

### 2. 用户访问Library
```
前端: GET /api/word_groups/list
后端: 返回用户的词组列表（初始为空）

前端: GET /api/study_groups/list
后端: 返回学习分组列表（包含默认分组）
```

### 3. 用户选择系统词库
```
前端: 显示系统推荐词库
用户: 点击 "CET-6"
前端: POST /api/study_groups/{默认分组}/add_word_group
      { "word_group_id": "sys_cet6" }
后端:
  ↓ 插入关联记录
  ↓ 更新统计信息
  ↓ 返回成功
前端: 刷新列表，显示已添加的词组
```

---

## 🧪 测试用例

### 测试1: 新用户注册
1. 注册新账号
2. 登录成功
3. 调用 `GET /api/study_groups/list`
4. **验证**: 返回1个默认学习分组
5. **验证**: 默认分组的 `is_default = true`
6. **验证**: `total_word_groups = 0`

### 测试2: Library页面初始状态
1. 新用户登录
2. 访问Library页面
3. 调用 `GET /api/word_groups/list`
4. **验证**: 返回空数组或只有系统词库（type='system'）
5. **验证**: 没有用户测试数据

### 测试3: 添加词组到默认分组
1. 获取默认分组ID
2. 添加系统词库到默认分组
3. **验证**: `total_word_groups = 1`
4. **验证**: `total_words` 更新为词组的单词数

---

## 🔴 需要后端清理的内容

### 1. 移除注册时创建的测试词组
如果当前注册流程包含以下代码，请删除：
```python
# ❌ 删除这些测试数据创建逻辑
create_test_word_groups(user_id)
insert_sample_data(user_id)
initialize_user_library_with_demo_data(user_id)
```

### 2. 清理现有测试账号的数据
对于已经存在的测试账号：
```sql
-- 清理非系统词组（保留系统词库）
DELETE FROM groups
WHERE uid = :user_id
  AND type != 'system';

-- 确保每个用户有默认学习分组
INSERT INTO study_groups (...)
SELECT ... FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM study_groups
  WHERE uid = users.id AND is_default = TRUE
);
```

---

## 📝 实施检查清单

后端团队请确认：

- [ ] 注册API不再创建测试词组数据
- [ ] 注册成功后自动创建默认学习分组
- [ ] 默认学习分组的字段值符合要求（name="默认分组", is_default=TRUE等）
- [ ] 测试：新用户注册后有且仅有1个学习分组
- [ ] 测试：新用户的Library初始为空（或只有系统词库）
- [ ] （可选）提供系统词库，明确标记为 type='system'

---

## 🎯 总结

### 核心原则
1. **注册时只创建默认学习分组**
2. **不要创建测试词组数据**
3. **让用户自主选择学习内容**

### 数据关系
```
User (用户)
  └── Study Groups (学习分组)
        └── 默认分组 ✅ 注册时自动创建
        └── 我的考试准备 (用户后续创建)
        └── 工作英语 (用户后续创建)

Word Groups (词组/词库)
  ├── 系统词库 (type='system')
  │     ├── CET-4
  │     ├── CET-6
  │     └── TOEFL
  ├── 用户创建 (type='user')
  └── 文档导入 (type='document')
```

### 工作流程
```
1. 用户注册 → 自动创建默认学习分组 ✅
2. 用户浏览系统词库 → 选择感兴趣的
3. 用户添加到学习分组 → 开始学习
4. 用户也可以上传文档 → 自动创建词组
```

---

*Generated on 2025-12-20 | WordFlow AI Backend Team*
