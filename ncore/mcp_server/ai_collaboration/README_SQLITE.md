# AI Collaboration MCP Server (SQLite Version)

## 🎯 重大改进：跨客户端协作

这是 AI Collaboration MCP 服务器的 SQLite 版本，实现了真正的跨客户端、跨窗口的 AI 协作。

### 核心特性

✅ **跨客户端共享** - 所有 AI 实例访问同一个 SQLite 数据库
✅ **启动会话命名空间** - 每次启动创建独立的命名空间
✅ **并发安全** - WAL 模式 + 重试机制处理数据库锁
✅ **数据持久化** - 所有数据保存在共享数据库中
✅ **历史记录** - 可查询历史启动会话和数据

---

## 🏗️ 架构设计

### 数据库位置
- **Windows**: `C:\Users\<username>\.core_node\mcp_server\ai_collaboration\ai_collaboration.db`
- **Linux**: `/var/_core_node/mcp_server/ai_collaboration/ai_collaboration.db`

### 启动会话命名空间

每次服务启动时，系统会创建一个新的**命名空间**（Startup Namespace）：

```
startup-<random-id>-<timestamp>
示例: startup-3181aef77a24-1761862285
```

#### 为什么需要命名空间？

1. **隔离不同启动会话的数据** - 每次启动的 AI 协作在独立空间中进行
2. **保留历史记录** - 旧会话的数据不会丢失，可以查询
3. **清理策略** - 可以选择性清理旧的无用数据
4. **多项目支持** - 不同项目可以使用不同的启动会话

#### 工作流程

```
启动 1 (2025-01-01 10:00)
├── Namespace: startup-abc123-1704096000
├── AI #1 (Frontend) 加入
├── AI #2 (Backend) 加入
└── 协作完成，数据保留

启动 2 (2025-01-01 14:00)  ← 新的启动会话
├── Namespace: startup-def456-1704110400
├── AI #3 (Frontend) 加入
├── AI #4 (Database) 加入
└── 独立的协作空间，不影响启动1
```

---

## 📊 数据库架构

### 表结构

#### 1. startup_sessions - 启动会话
```sql
- namespace_id: 命名空间ID (主键)
- started_at: 启动时间
- ended_at: 结束时间
- is_active: 是否活跃 (1=活跃, 0=已结束)
- metadata: 元数据 (JSON)
```

#### 2. roles - AI 角色
```sql
- id: 自增ID
- namespace_id: 所属命名空间
- session_id: AI 会话ID
- role_name: 角色名称
- ai_name: AI 昵称
- registered_at: 注册时间
- last_active: 最后活跃时间
- metadata: 元数据 (JSON)
```

#### 3. work_logs - 工作日志
```sql
- id: 自增ID
- namespace_id: 所属命名空间
- session_id: AI 会话ID
- role_name: 角色名称
- message: 日志内容 (JSON)
- metadata: 元数据 (JSON)
- created_at: 创建时间
```

#### 4. qa_history - 问答历史
```sql
- question_id: 问题ID (主键)
- namespace_id: 所属命名空间
- from_role: 提问者角色
- from_session_id: 提问者会话ID
- to_role: 目标角色
- question: 问题内容
- answer: 答案内容
- context: 上下文 (JSON)
- priority: 优先级 (low/normal/high/urgent)
- status: 状态 (pending/answered)
- asked_at: 提问时间
- answered_at: 回答时间
- answering_session_id: 回答者会话ID
- metadata: 元数据 (JSON)
```

---

## 🚀 使用示例

### 场景：3个 AI 实例协作开发

#### AI #1 (Claude Code - Frontend)
```python
# 注册角色
register_role(
    session_id="claude-code-frontend-001",
    role_name="frontend_designer",
    ai_name="Claude Frontend Dev"
)

# 写工作日志
write_log(
    session_id="claude-code-frontend-001",
    role_name="frontend_designer",
    message={
        "action": "created_component",
        "component": "LoginForm",
        "path": "src/components/LoginForm.tsx"
    }
)

# 向后端提问
ask_question(
    from_role="frontend_designer",
    from_session_id="claude-code-frontend-001",
    to_role="backend_developer",
    question="登录API的端点是什么？需要哪些参数？",
    priority="high"
)
```

#### AI #2 (Claude Desktop - Backend)
```python
# 注册角色
register_role(
    session_id="claude-desktop-backend-001",
    role_name="backend_developer",
    ai_name="Claude Backend Dev"
)

# 查看待回答的问题
questions = get_pending_questions(
    role_name="backend_developer"
)

# 回答问题
answer_question(
    question_id="q-abc123...",
    answer="登录端点是 POST /api/v1/auth/login，需要参数: email (string), password (string)",
    answering_session_id="claude-desktop-backend-001"
)

# 读取前端的日志
logs = read_logs(
    role_name="frontend_designer",
    limit=10
)
```

#### AI #3 (Cursor - Database)
```python
# 注册角色
register_role(
    session_id="cursor-database-001",
    role_name="database_architect",
    ai_name="Claude Database Architect"
)

# 写工作日志
write_log(
    session_id="cursor-database-001",
    role_name="database_architect",
    message={
        "action": "created_table",
        "table": "users",
        "schema": {
            "id": "SERIAL PRIMARY KEY",
            "email": "VARCHAR(255) UNIQUE NOT NULL",
            "password_hash": "VARCHAR(255) NOT NULL"
        }
    }
)

# 向后端和前端广播
ask_question(
    from_role="database_architect",
    from_session_id="cursor-database-001",
    to_role="backend_developer",
    question="用户表已创建，请更新 ORM 模型"
)
```

---

## 🔧 API 工具

### 角色管理

#### register_role
注册 AI 角色到当前命名空间
```json
{
  "session_id": "unique-session-id",
  "role_name": "frontend_designer",
  "ai_name": "Claude Frontend Dev",
  "metadata": {}
}
```

#### get_role_list
获取当前命名空间中所有注册的角色
```json
{
  "include_inactive": false
}
```

### 工作日志

#### write_log
写入工作日志
```json
{
  "session_id": "unique-session-id",
  "role_name": "frontend_designer",
  "message": {"action": "created_component", "details": "..."},
  "metadata": {}
}
```

#### read_logs
读取工作日志
```json
{
  "role_name": "backend_developer",  // 可选
  "session_id": "unique-session-id",  // 可选
  "limit": 100,
  "offset": 0
}
```

#### search_logs
搜索工作日志
```json
{
  "keyword": "authentication",
  "role_name": "backend_developer",  // 可选
  "limit": 50
}
```

### 问答系统

#### ask_question
向另一个 AI 提问
```json
{
  "from_role": "frontend_designer",
  "from_session_id": "unique-session-id",
  "to_role": "backend_developer",
  "question": "What's the API endpoint?",
  "context": {},
  "priority": "normal"
}
```

#### get_pending_questions
获取待回答的问题
```json
{
  "role_name": "backend_developer",
  "session_id": "unique-session-id",  // 可选
  "priority_filter": ["high", "urgent"],  // 可选
  "limit": 50
}
```

#### answer_question
回答问题
```json
{
  "question_id": "q-abc123...",
  "answer": "The endpoint is POST /api/v1/auth/login",
  "answering_session_id": "unique-session-id",
  "metadata": {}
}
```

#### get_question_history
获取问答历史
```json
{
  "role_name": "backend_developer",  // 可选
  "session_id": "unique-session-id",  // 可选
  "status": "answered",  // 可选: pending/answered
  "limit": 100
}
```

### 系统工具

#### health_check
检查服务器健康状态
```json
{}
```

#### get_namespace_info
获取当前命名空间信息
```json
{}
```

#### list_all_namespaces
列出所有启动会话
```json
{
  "include_inactive": false
}
```

#### get_storage_stats
获取存储统计信息
```json
{}
```

---

## 🔒 并发安全

### WAL 模式
SQLite 使用 Write-Ahead Logging (WAL) 模式，支持：
- 多个读取者同时读取
- 一个写入者和多个读取者并发操作
- 更好的并发性能

### 重试机制
当遇到数据库锁时：
- 自动重试最多 5 次
- 指数退避延迟 (0.1s, 0.2s, 0.3s...)
- 超时时间 30 秒

### 线程安全
- 每个线程使用独立的数据库连接
- 使用线程本地存储 (thread local storage)
- 自动管理连接生命周期

---

## 📝 预定义角色

系统提供 10 个预定义角色：

1. **frontend_designer** - 前端开发和 UI 实现
2. **backend_developer** - 后端服务和 API 开发
3. **database_architect** - 数据库设计和优化
4. **devops_engineer** - 部署和基础设施
5. **qa_tester** - 质量保证和测试
6. **product_manager** - 需求和规划
7. **ui_ux_designer** - 用户界面和体验设计
8. **security_specialist** - 安全分析和加固
9. **technical_writer** - 文档和指南
10. **general_assistant** - 通用助手

---

## 🧹 数据清理

### 自动清理
系统不会自动删除旧数据，但提供了清理方法。

### 手动清理（可选）
```python
# 清理30天前的旧会话
storage.cleanup_old_sessions(days=30)
```

### 查询历史数据
```python
# 查看所有历史启动会话
namespaces = list_all_namespaces(include_inactive=True)

# 切换到旧会话查看数据（需要修改代码）
# 通常不需要，因为每次启动使用新的命名空间
```

---

## 🆚 与旧版本的对比

| 特性 | 旧版本 (JSON文件) | 新版本 (SQLite) |
|------|------------------|----------------|
| 跨客户端共享 | ❌ 不支持 | ✅ 支持 |
| 并发安全 | ⚠️ 有限 | ✅ WAL + 重试 |
| 数据持久化 | ✅ 文件 | ✅ 数据库 |
| 启动会话隔离 | ❌ 无 | ✅ 命名空间 |
| 查询性能 | ⚠️ 线性扫描 | ✅ 索引查询 |
| 存储效率 | ⚠️ 多个JSON文件 | ✅ 单个数据库 |
| 历史数据 | ⚠️ 混合在一起 | ✅ 按会话隔离 |

---

## 🚀 部署

### MCP 配置

已在以下配置文件中自动配置：
- `mcpWindowsTemplate.json`
- `mcpLinuxTemplate.json`
- `mcpUbuntoDesktopTemplate.json`
- `mcpWSLTemplate.json`

所有工具已设置为自动批准，无需手动确认。

### 独立运行

```bash
python main.py
```

---

## 📌 注意事项

1. **命名空间隔离** - 每次启动创建新的命名空间，不同启动之间的数据不会混淆
2. **数据库位置** - 确保所有客户端能访问同一个数据库文件路径
3. **权限问题** - Windows 用户目录通常可读写；Linux 确保 `/var/_core_node` 有权限
4. **并发限制** - SQLite 在极高并发下可能遇到锁，但一般 AI 协作场景不会达到限制
5. **备份建议** - 定期备份 `ai_collaboration.db` 文件

---

## 🔄 迁移指南

从旧版本迁移：
1. 旧版本数据在 `roles.json`, `messages/`, `qa_history.json`
2. 新版本启动后会创建新的数据库
3. 旧数据不会自动迁移（可以手动编写迁移脚本）
4. 建议：直接使用新版本，旧数据仅供查阅

---

## 📖 版本

Current version: **2.0.0 (SQLite Edition)**

---

## 🤝 贡献

如有问题或建议，请提交 Issue。
