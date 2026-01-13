# 后端需求总结 - 学习分组功能

**创建时间**: 2025-12-20
**状态**: 📋 待后端实现

---

## 🎯 核心需求

### 问题
你在Library页面看到的这些数据：
```
📚 IELTS Core 3000
💼 Business English
📄 My Uploaded PDF
🎓 TOEFL Mastery
```

这些是**词组（Word Groups）**，不是学习分组。

### 要求
1. ❌ **不要在注册时创建测试词组数据**
2. ✅ **注册时自动创建默认学习分组**
3. ✅ **让用户自己选择学习内容**

---

## 📚 概念区分

| 概念 | 英文 | 说明 | 示例 |
|------|------|------|------|
| **词组** | Word Group | 词库，一组单词的集合 | "CET-6 词汇"（8013个单词） |
| **学习分组** | Study Group | 学习计划，可包含多个词组 | "我的考试准备"（包含CET-6、IELTS等） |

---

## 🔴 P0 核心要求（立即实现）

### 1. 注册时自动创建默认学习分组

**位置**: `POST /api/auth/register` 或 `/api/user/register`

**修改代码**:
```python
def register_user(username, email, password):
    # 1. 创建用户账号
    user_id = create_user_account(username, email, password)

    # 2. 【新增】立即创建默认学习分组
    create_default_study_group(user_id)

    # 3. 返回结果
    return success_response

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

### 2. 创建学习分组表

**执行SQL**:
```sql
-- 学习分组表
CREATE TABLE study_groups (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  uid VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  total_word_groups INT DEFAULT 0,
  total_words INT DEFAULT 0,
  learned_words INT DEFAULT 0,
  daily_goal INT DEFAULT 50,
  study_mode ENUM('sequential', 'random', 'adaptive') DEFAULT 'sequential',
  cover_image VARCHAR(255),
  color VARCHAR(20) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT '📚',
  sort_order INT DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_studied_at TIMESTAMP NULL,
  INDEX idx_uid (uid),
  CONSTRAINT fk_study_groups_user FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE
);

-- 学习分组-词组关联表
CREATE TABLE study_group_word_groups (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  study_group_id VARCHAR(36) NOT NULL,
  word_group_id VARCHAR(36) NOT NULL,
  progress INT DEFAULT 0,
  current_word_index INT DEFAULT 0,
  mastered_count INT DEFAULT 0,
  learning_count INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  last_studied_at TIMESTAMP NULL,
  UNIQUE KEY uk_group_word (study_group_id, word_group_id),
  CONSTRAINT fk_sgwg_study_group FOREIGN KEY (study_group_id)
    REFERENCES study_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_sgwg_word_group FOREIGN KEY (word_group_id)
    REFERENCES groups(gid) ON DELETE CASCADE
);
```

### 3. 实现4个核心API（P0）

| API | 方法 | 功能 |
|-----|------|------|
| `/api/study_groups/create` | POST | 创建学习分组 |
| `/api/study_groups/list` | GET | 获取所有学习分组 |
| `/api/study_groups/default` | GET | 获取默认分组 |
| `/api/study_groups/{id}/add_word_group` | POST | 添加词组到分组 |

### 4. 不要创建测试词组

**删除以下代码**（如果存在）:
```python
# ❌ 删除这些
def register_user(...):
    # ...
    create_sample_word_groups(user_id)  # 删除
    initialize_demo_data(user_id)       # 删除
```

---

## 📖 预期用户体验

### 新用户注册后

#### Library页面（词组列表）
```
┌─────────────────────────────────────┐
│  书库                             ⭐ │
├─────────────────────────────────────┤
│                                     │
│  📄 导入文档 / PDF                  │
│  ➕ 创建词组                        │
│                                     │
│  暂无词组                           │
│  （用户可以导入或创建）             │
│                                     │
└─────────────────────────────────────┘
```

#### 学习分组列表（新页面，待前端实现）
```
┌─────────────────────────────────────┐
│  学习分组                        [+] │
├─────────────────────────────────────┤
│                                     │
│  📚 默认分组           ✅ 默认       │
│  0个词组 · 0个单词                  │
│  进度 0%                            │
│                                     │
│  [添加词组到此分组]                 │
│                                     │
└─────────────────────────────────────┘
```

### 用户添加词组后

用户可以：
1. 浏览系统推荐词库（如果提供）
2. 选择词组（如"CET-6"）
3. 添加到"默认分组"
4. 开始学习

---

## 📋 详细文档

所有技术细节在以下文档中：

1. **`BACKEND_REGISTRATION_AUTO_INIT_REQUIREMENT.md`**
   - 注册时自动初始化详细说明
   - 数据库清理建议
   - 测试用例

2. **`BACKEND_API_STUDY_GROUPS_REQUIREMENT.md`**
   - 完整的API设计（10个端点）
   - 数据库表结构
   - 请求/响应格式
   - 业务逻辑

3. **`STUDY_GROUPS_IMPLEMENTATION_SUMMARY.md`**
   - 前端实现总结
   - 使用示例
   - UI设计建议

---

## ✅ 实施检查清单

后端团队请确认：

### P0 (必须立即完成)
- [ ] 创建 `study_groups` 表
- [ ] 创建 `study_group_word_groups` 表
- [ ] 修改注册API，自动创建默认学习分组
- [ ] 删除注册时创建测试词组的代码
- [ ] 实现 `POST /api/study_groups/create`
- [ ] 实现 `GET /api/study_groups/list`
- [ ] 实现 `GET /api/study_groups/default`
- [ ] 实现 `POST /api/study_groups/{id}/add_word_group`

### P1 (第二阶段)
- [ ] 实现 `GET /api/study_groups/{id}` (获取详情)
- [ ] 实现 `PUT /api/study_groups/{id}` (更新)
- [ ] 实现 `DELETE /api/study_groups/{id}/remove_word_group/{wid}`

### P2 (第三阶段)
- [ ] 实现 `POST /api/study_groups/{id}/update_progress`
- [ ] 实现 `POST /api/study_groups/{id}/set_default`
- [ ] 实现 `DELETE /api/study_groups/{id}`

---

## 🧪 测试建议

### 测试1: 新用户注册
```bash
1. POST /api/auth/register
   Body: { username, email, password }

2. 验证返回的 user 对象

3. GET /api/study_groups/list
   验证: 返回1个默认学习分组
   验证: is_default = true
   验证: total_word_groups = 0
```

### 测试2: Library页面初始状态
```bash
1. 新用户登录

2. GET /api/word_groups/list
   验证: 返回空数组（或只有系统词库）
   验证: 没有测试数据
```

### 测试3: 添加词组到学习分组
```bash
1. GET /api/study_groups/default
   获取默认分组ID

2. POST /api/study_groups/{id}/add_word_group
   Body: { word_group_id: "sys_cet6" }

3. GET /api/study_groups/default
   验证: total_word_groups = 1
   验证: total_words = 8013
```

---

## 📞 问题反馈

如有疑问，请参考：
- 详细API设计: `BACKEND_API_STUDY_GROUPS_REQUIREMENT.md`
- 注册流程: `BACKEND_REGISTRATION_AUTO_INIT_REQUIREMENT.md`
- 前端实现: `STUDY_GROUPS_IMPLEMENTATION_SUMMARY.md`

---

*Generated on 2025-12-20 | WordFlow AI Development Team*
