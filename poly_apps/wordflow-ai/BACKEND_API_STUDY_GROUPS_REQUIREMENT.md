# 后端API技术要求 - 学习分组功能

**版本**: 1.0
**创建时间**: 2025-12-20
**优先级**: P0 (核心功能)

---

## 📋 功能概述

### 学习分组 vs 词组的区别

| 概念 | 英文 | 说明 | 数据来源 |
|------|------|------|---------|
| **词组** | Word Group | 词库，系统或用户创建的词汇集合 | 系统预置 / 用户上传文档 |
| **学习分组** | Study Group | 用户的学习计划，可包含多个词组 | 用户创建和管理 |

### 业务场景

**场景1**: 用户想学习CET6考试词汇
- 用户找到词组 "English Exam Cet6" (8013个单词)
- 用户将此词组加入到学习分组 "我的考试准备"
- 用户可以在学习分组中统一管理和学习

**场景2**: 用户组织多个学习目标
- 学习分组1: "工作英语" → 包含 Business English + Technical Terms
- 学习分组2: "旅游日语" → 包含 Travel Japanese + Daily Conversation
- 学习分组3: "考试准备" → 包含 CET6 + IELTS Vocabulary

---

## 🗄️ 数据库设计

### 1. 学习分组表 `study_groups`

```sql
CREATE TABLE study_groups (
  -- 基础字段
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  uid VARCHAR(36) NOT NULL COMMENT '用户ID',
  name VARCHAR(100) NOT NULL COMMENT '分组名称',
  description TEXT COMMENT '分组描述',

  -- 类型标识
  is_default BOOLEAN DEFAULT FALSE COMMENT '是否为默认分组',

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
  INDEX idx_uid_default (uid, is_default),
  INDEX idx_sort (uid, sort_order),

  -- 约束
  CONSTRAINT fk_study_groups_user FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. 学习分组-词组关联表 `study_group_word_groups`

```sql
CREATE TABLE study_group_word_groups (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  study_group_id VARCHAR(36) NOT NULL COMMENT '学习分组ID',
  word_group_id VARCHAR(36) NOT NULL COMMENT '词组ID (gid)',

  -- 学习进度
  progress INT DEFAULT 0 COMMENT '学习进度 0-100',
  current_word_index INT DEFAULT 0 COMMENT '当前学习到第几个单词',

  -- 统计
  mastered_count INT DEFAULT 0 COMMENT '已掌握单词数',
  learning_count INT DEFAULT 0 COMMENT '学习中单词数',

  -- 排序
  sort_order INT DEFAULT 0 COMMENT '在分组中的排序',

  -- 状态
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',

  -- 时间戳
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL COMMENT '开始学习时间',
  completed_at TIMESTAMP NULL COMMENT '完成时间',
  last_studied_at TIMESTAMP NULL COMMENT '最后学习时间',

  -- 索引
  INDEX idx_study_group (study_group_id),
  INDEX idx_word_group (word_group_id),
  UNIQUE KEY uk_group_word (study_group_id, word_group_id),

  -- 约束
  CONSTRAINT fk_sgwg_study_group FOREIGN KEY (study_group_id)
    REFERENCES study_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_sgwg_word_group FOREIGN KEY (word_group_id)
    REFERENCES groups(gid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🔌 API端点要求

### 1. 创建学习分组

**Endpoint**: `POST /api/study_groups/create`

**请求体**:
```json
{
  "name": "我的考试准备",
  "description": "CET6考试词汇学习计划",
  "is_default": false,
  "daily_goal": 100,
  "study_mode": "sequential",
  "cover_image": "exam.jpg",
  "color": "#3B82F6",
  "icon": "📝"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "sg_123abc",
    "uid": "user_456",
    "name": "我的考试准备",
    "description": "CET6考试词汇学习计划",
    "is_default": false,
    "total_word_groups": 0,
    "total_words": 0,
    "learned_words": 0,
    "daily_goal": 100,
    "study_mode": "sequential",
    "cover_image": "exam.jpg",
    "color": "#3B82F6",
    "icon": "📝",
    "sort_order": 0,
    "created_at": "2025-12-20T10:00:00Z"
  },
  "message": "学习分组创建成功"
}
```

**业务逻辑**:
1. 验证用户登录状态
2. 检查分组名称是否重复（同一用户）
3. 如果是用户的第一个分组，自动设置为默认分组
4. 生成UUID作为分组ID
5. 返回完整的分组信息

---

### 2. 获取用户所有学习分组

**Endpoint**: `GET /api/study_groups/list`

**查询参数**:
- `include_archived` (optional): boolean - 是否包含归档的分组

**响应**:
```json
{
  "success": true,
  "data": {
    "study_groups": [
      {
        "id": "sg_default",
        "name": "默认分组",
        "is_default": true,
        "total_word_groups": 3,
        "total_words": 10500,
        "learned_words": 2340,
        "progress": 22,
        "icon": "📚",
        "color": "#3B82F6"
      },
      {
        "id": "sg_123",
        "name": "我的考试准备",
        "is_default": false,
        "total_word_groups": 1,
        "total_words": 8013,
        "learned_words": 0,
        "progress": 0,
        "icon": "📝",
        "color": "#F59E0B"
      }
    ],
    "total": 2
  }
}
```

**业务逻辑**:
1. 验证用户登录
2. 查询用户的所有学习分组
3. 按 `sort_order` 排序
4. 计算统计字段（从关联表聚合）
5. 如果用户没有任何分组，**自动创建默认分组**

---

### 3. 向学习分组添加词组

**Endpoint**: `POST /api/study_groups/{study_group_id}/add_word_group`

**路径参数**:
- `study_group_id`: 学习分组ID

**请求体**:
```json
{
  "word_group_id": "group_cet6_001",
  "sort_order": 1
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "study_group_id": "sg_123",
    "word_group_id": "group_cet6_001",
    "word_group_name": "English Exam Cet6",
    "total_words": 8013,
    "progress": 0,
    "status": "not_started",
    "added_at": "2025-12-20T10:05:00Z"
  },
  "message": "词组已成功添加到学习分组"
}
```

**业务逻辑**:
1. 验证用户权限（是否是该分组的拥有者）
2. 验证词组是否存在
3. 检查是否已经添加过（避免重复）
4. 插入关联记录
5. **更新学习分组的统计字段**（total_word_groups, total_words）
6. 返回添加结果

---

### 4. 从学习分组移除词组

**Endpoint**: `DELETE /api/study_groups/{study_group_id}/remove_word_group/{word_group_id}`

**响应**:
```json
{
  "success": true,
  "message": "词组已从学习分组中移除"
}
```

**业务逻辑**:
1. 验证用户权限
2. 删除关联记录
3. **更新学习分组的统计字段**
4. 返回结果

---

### 5. 获取学习分组详情（包含所有词组）

**Endpoint**: `GET /api/study_groups/{study_group_id}`

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "sg_123",
    "name": "我的考试准备",
    "description": "CET6考试词汇学习计划",
    "total_word_groups": 1,
    "total_words": 8013,
    "learned_words": 0,
    "progress": 0,
    "daily_goal": 100,
    "icon": "📝",
    "word_groups": [
      {
        "id": "group_cet6_001",
        "name": "English Exam Cet6",
        "total_words": 8013,
        "language": "en",
        "type": "system",
        "cover_image": "cet6.jpg",
        "progress": 0,
        "mastered_count": 0,
        "status": "not_started",
        "sort_order": 1
      }
    ]
  }
}
```

**业务逻辑**:
1. 验证用户权限
2. 查询学习分组基本信息
3. JOIN关联表获取所有词组信息
4. 按sort_order排序
5. 返回完整数据

---

### 6. 更新学习分组

**Endpoint**: `PUT /api/study_groups/{study_group_id}`

**请求体**:
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述",
  "daily_goal": 150,
  "study_mode": "adaptive",
  "color": "#10B981",
  "icon": "🎯"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "sg_123",
    "name": "更新后的名称",
    "updated_at": "2025-12-20T11:00:00Z"
  },
  "message": "学习分组已更新"
}
```

---

### 7. 删除学习分组

**Endpoint**: `DELETE /api/study_groups/{study_group_id}`

**响应**:
```json
{
  "success": true,
  "message": "学习分组已删除"
}
```

**业务逻辑**:
1. 验证用户权限
2. **不允许删除默认分组**（返回错误）
3. 由于设置了 CASCADE，关联的词组记录会自动删除
4. 返回结果

---

### 8. 设置默认学习分组

**Endpoint**: `POST /api/study_groups/{study_group_id}/set_default`

**响应**:
```json
{
  "success": true,
  "message": "默认学习分组已更新"
}
```

**业务逻辑**:
1. 验证用户权限
2. 将用户所有分组的 `is_default` 设为 false
3. 将目标分组的 `is_default` 设为 true
4. 返回结果

---

### 9. 更新词组学习进度

**Endpoint**: `POST /api/study_groups/{study_group_id}/update_progress`

**请求体**:
```json
{
  "word_group_id": "group_cet6_001",
  "current_word_index": 150,
  "mastered_count": 120,
  "learning_count": 30
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "progress": 19,
    "status": "in_progress"
  },
  "message": "学习进度已更新"
}
```

**业务逻辑**:
1. 验证用户权限
2. 更新关联表的进度字段
3. 自动计算 progress = (current_word_index / total_words) * 100
4. 更新状态（not_started → in_progress → completed）
5. 更新时间戳
6. **聚合更新学习分组的 learned_words 字段**

---

### 10. 获取默认学习分组

**Endpoint**: `GET /api/study_groups/default`

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "sg_default",
    "name": "默认分组",
    "is_default": true,
    "total_word_groups": 0,
    "total_words": 0,
    "word_groups": []
  }
}
```

**业务逻辑**:
1. 验证用户登录
2. 查询用户的默认分组（is_default = true）
3. 如果不存在，**立即创建**一个默认分组
4. 返回默认分组信息

**默认分组创建规则**:
```json
{
  "name": "默认分组",
  "description": "系统自动创建的默认学习分组",
  "is_default": true,
  "daily_goal": 50,
  "study_mode": "sequential",
  "color": "#3B82F6",
  "icon": "📚"
}
```

---

## 🔄 自动化业务逻辑

### 1. 用户注册时（新增 - P0）
**重要**: 在用户注册成功后，立即自动创建默认学习分组

参考文档: `BACKEND_REGISTRATION_AUTO_INIT_REQUIREMENT.md`

**位置**: `POST /api/auth/register` 或 `/api/user/register` 的处理逻辑中

**创建逻辑**:
```python
def register_user(...):
    # ... 创建用户账号 ...
    user_id = create_user(...)

    # 立即创建默认学习分组
    create_default_study_group(user_id)

    return success_response
```

**默认分组参数**:
- name: "默认分组"
- description: "系统自动创建的默认学习分组"
- is_default: TRUE
- daily_goal: 50
- study_mode: "sequential"
- color: "#3B82F6"
- icon: "📚"
- sort_order: 0

### 2. 不要创建测试词组数据
**重要**: 注册时不要自动创建任何测试词组（Word Groups），让用户自己选择学习内容。

### 3. 添加词组到分组时
- 更新 `study_groups.total_word_groups += 1`
- 更新 `study_groups.total_words += word_group.total_words`

### 4. 移除词组时
- 更新 `study_groups.total_word_groups -= 1`
- 更新 `study_groups.total_words -= word_group.total_words`
- 更新 `study_groups.learned_words` 重新计算

### 5. 学习进度更新时
- 自动更新关联表的 `status` 字段
  - progress = 0: `not_started`
  - 0 < progress < 100: `in_progress`
  - progress = 100: `completed`
- 更新 `last_studied_at` 时间戳
- 如果是第一次学习，设置 `started_at`

### 6. 统计字段维护
所有涉及数量变更的操作都需要同步更新：
- `total_word_groups`
- `total_words`
- `learned_words`

---

## 🛡️ 权限和安全

### 权限验证
每个API都必须验证：
1. 用户是否登录（检查token）
2. 操作的学习分组是否属于当前用户

### 数据隔离
- 所有查询都必须加上 `WHERE uid = :current_user_id`
- 防止跨用户数据访问

### 输入验证
- 分组名称长度：1-100字符
- 描述长度：最多1000字符
- daily_goal: 1-1000
- study_mode: 只能是 sequential/random/adaptive

---

## 📊 性能优化建议

### 1. 索引优化
- `study_groups(uid)` - 用户查询
- `study_groups(uid, is_default)` - 默认分组查询
- `study_group_word_groups(study_group_id)` - 关联查询
- `study_group_word_groups(word_group_id)` - 反向查询

### 2. 缓存策略
- 学习分组列表：5分钟缓存
- 学习分组详情：3分钟缓存
- 进度更新后立即清除相关缓存

### 3. 批量操作
提供批量添加词组的API：
```
POST /api/study_groups/{id}/batch_add_word_groups
Body: { "word_group_ids": ["id1", "id2", "id3"] }
```

---

## 🧪 测试用例

### 测试场景1: 新用户首次使用
1. 用户注册并登录
2. 调用 `GET /api/study_groups/list`
3. 后端自动创建默认分组
4. 返回包含1个默认分组的列表

### 测试场景2: 添加词组到学习分组
1. 创建学习分组 "考试准备"
2. 添加词组 "CET6" (8013词)
3. 验证 total_word_groups = 1
4. 验证 total_words = 8013

### 测试场景3: 学习进度更新
1. 学习150个单词
2. 调用更新进度API
3. 验证 progress 约为 1.87%
4. 验证 status = "in_progress"

### 测试场景4: 删除非默认分组
1. 创建分组 "临时分组"
2. 成功删除
3. 验证关联的词组记录也被删除

### 测试场景5: 尝试删除默认分组
1. 调用删除默认分组API
2. 应返回错误: "不能删除默认分组"

---

## 📝 前后端数据格式约定

### StudyGroup 对象
```typescript
interface StudyGroup {
  id: string;
  uid: string;
  name: string;
  description?: string;
  is_default: boolean;
  total_word_groups: number;
  total_words: number;
  learned_words: number;
  progress: number;  // 计算字段: (learned_words / total_words) * 100
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

### StudyGroupWordGroup 对象
```typescript
interface StudyGroupWordGroup {
  id: string;
  study_group_id: string;
  word_group_id: string;
  word_group_name: string;  // JOIN查询获取
  total_words: number;      // JOIN查询获取
  progress: number;
  current_word_index: number;
  mastered_count: number;
  learning_count: number;
  status: 'not_started' | 'in_progress' | 'completed';
  added_at: string;
  last_studied_at?: string;
}
```

---

## ⏱️ 实现优先级

### P0 (立即实现)
1. ✅ 创建学习分组
2. ✅ 获取学习分组列表
3. ✅ 添加词组到分组
4. ✅ 获取默认分组（自动创建）

### P1 (第二阶段)
5. ✅ 移除词组
6. ✅ 更新学习分组
7. ✅ 获取学习分组详情

### P2 (第三阶段)
8. ✅ 更新学习进度
9. ✅ 设置默认分组
10. ✅ 删除学习分组

---

## 🚀 实施步骤建议

### Step 1: 数据库建表
```bash
# 执行SQL创建表结构
mysql -u root -p wordflow_db < study_groups_schema.sql
```

### Step 2: 实现核心API (P0)
- 创建分组
- 列出分组
- 添加词组
- 获取默认分组

### Step 3: 前端集成测试
- 测试创建分组
- 测试添加 CET6 词组
- 验证统计数据正确

### Step 4: 实现扩展功能 (P1, P2)
- 移除、更新、删除
- 进度跟踪
- 默认分组设置

---

## 📧 联系方式

如有技术疑问，请联系：
- **前端负责人**: [前端团队]
- **后端负责人**: [后端团队]
- **产品经理**: [产品团队]

---

*Generated on 2025-12-20 | WordFlow AI Backend Team*
