# 数据库类型规范
**版本**: 1.0
**日期**: 2025-11-18
**状态**: ✅ **强制执行**

---

## 核心原则

### ❌ 禁止的做法
**禁止在数据库Schema中直接使用datetime/date/time类型**

```python
# ❌ 错误示例 - 禁止使用
sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow)
sqlalchemy.Column('birth_date', sqlalchemy.Date)
sqlalchemy.Column('start_time', sqlalchemy.Time)
```

### ✅ 正确的做法
**统一使用String或Integer存储，由中间层负责转换**

```python
# ✅ 正确示例 - 使用String存储ISO格式
sqlalchemy.Column('created_at', sqlalchemy.String(32))  # ISO 8601: "2025-11-18T03:15:26.324494"
sqlalchemy.Column('birth_date', sqlalchemy.String(10))   # ISO 8601: "1990-01-15"
sqlalchemy.Column('start_time', sqlalchemy.String(12))   # ISO 8601: "14:30:00.123"

# ✅ 或使用Integer存储
sqlalchemy.Column('created_at', sqlalchemy.Integer)     # Unix timestamp (seconds since epoch)
sqlalchemy.Column('birth_date', sqlalchemy.Integer)     # YYYYMMDD format: 19900115
```

---

## 为什么禁止datetime类型？

### 1. JSON序列化问题
```python
# 问题：datetime对象无法直接JSON序列化
datetime_obj = datetime.now()
json.dumps({'time': datetime_obj})  # ❌ TypeError: Object of type datetime is not JSON serializable

# 在RPC响应中会导致错误
response = {'created_at': datetime.now()}
json.dumps(response)  # ❌ 错误
```

### 2. 数据库移植性问题
- SQLite的DateTime类型实际上是字符串
- 不同数据库系统的datetime类型实现不一致
- 时区处理复杂，容易出错

### 3. API响应一致性问题
- RESTful API需要返回JSON
- 需要在多处添加序列化逻辑
- 容易遗漏导致运行时错误

---

## 标准存储格式

### DateTime (日期+时间)

**推荐格式**: ISO 8601字符串

```python
# Schema定义
sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False)
sqlalchemy.Column('updated_at', sqlalchemy.String(32), nullable=False)

# 存储示例
'2025-11-18T03:15:26.324494'      # 完整格式（推荐）
'2025-11-18T03:15:26'              # 无微秒
'2025-11-18T03:15:26Z'             # UTC时间
'2025-11-18T03:15:26+08:00'        # 带时区
```

**替代格式**: Unix timestamp（整数）
```python
# Schema定义
sqlalchemy.Column('created_at', sqlalchemy.Integer, nullable=False)

# 存储示例
1700273726  # 秒级时间戳
```

### Date (日期)

**推荐格式**: ISO 8601字符串

```python
# Schema定义
sqlalchemy.Column('birth_date', sqlalchemy.String(10), nullable=True)
sqlalchemy.Column('event_date', sqlalchemy.String(10), nullable=False)

# 存储示例
'2025-11-18'       # ISO 8601格式（推荐）
```

**替代格式**: YYYYMMDD整数
```python
# Schema定义
sqlalchemy.Column('birth_date', sqlalchemy.Integer, nullable=True)

# 存储示例
20251118  # 便于范围查询
```

### Time (时间)

**推荐格式**: ISO 8601字符串

```python
# Schema定义
sqlalchemy.Column('open_time', sqlalchemy.String(12), nullable=False)
sqlalchemy.Column('close_time', sqlalchemy.String(12), nullable=False)

# 存储示例
'14:30:00'         # 基本格式
'14:30:00.123'     # 带毫秒
```

**替代格式**: 秒数（整数）
```python
# Schema定义
sqlalchemy.Column('open_time', sqlalchemy.Integer, nullable=False)

# 存储示例
52200  # 14:30:00 = 14*3600 + 30*60 = 52200秒
```

### TimeDelta (时间间隔)

**标准格式**: 总秒数（浮点数）

```python
# Schema定义
sqlalchemy.Column('duration', sqlalchemy.Float, nullable=False)

# 存储示例
3600.5  # 1小时30秒
```

---

## 自动类型转换

### 写入数据库（Python → Database）

**BaseModel自动处理，无需手动转换**

```python
# 你的代码：正常使用Python类型
from datetime import datetime, date

data = {
    'name': 'John',
    'created_at': datetime.now(),      # Python datetime对象
    'birth_date': date(1990, 1, 15),  # Python date对象
}

# BaseModel自动转换
UserModel.insert(conn, data)

# 实际存储到数据库的数据
# {
#     'name': 'John',
#     'created_at': '2025-11-18T03:15:26.324494',  # 自动转换为ISO字符串
#     'birth_date': '1990-01-15',                   # 自动转换为ISO字符串
# }
```

### 从数据库读取（Database → Python）

**查询结果返回的是原始类型（字符串/数字）**

```python
# 查询结果
result = UserModel.select_one(conn, where={'id': 1})

# result包含原始数据库类型
print(result['created_at'])  # '2025-11-18T03:15:26.324494' (字符串)
print(result['birth_date'])  # '1990-01-15' (字符串)

# 如果需要Python对象，手动转换
from datetime import datetime, date

created_at = datetime.fromisoformat(result['created_at'])
birth_date = date.fromisoformat(result['birth_date'])
```

---

## 迁移现有代码

### 步骤1: 更新Schema定义

```python
# 旧代码（需要修改）
class MyModel(BaseModel):
    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True),
            sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow),  # ❌
            sqlalchemy.Column('birth_date', sqlalchemy.Date),  # ❌
        )

# 新代码（正确）
class MyModel(BaseModel):
    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True),
            sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False),  # ✅
            sqlalchemy.Column('birth_date', sqlalchemy.String(10), nullable=True),   # ✅
        )
```

### 步骤2: 更新default值

```python
# ❌ 错误：使用datetime.utcnow作为default
sqlalchemy.Column('created_at', sqlalchemy.DateTime, default=datetime.utcnow)

# ✅ 方法1：不设置default，在插入前赋值
sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False)

data = {
    'created_at': datetime.now(),  # BaseModel会自动转换为ISO字符串
}

# ✅ 方法2：使用Lambda（SQLAlchemy会延迟执行）
from datetime import datetime
sqlalchemy.Column('created_at', sqlalchemy.String(32), default=lambda: datetime.now().isoformat())
```

### 步骤3: 更新查询逻辑

```python
# 如果需要按日期范围查询，使用字符串比较
# ISO 8601格式天然支持字符串排序

# 查询今天创建的记录
today = date.today().isoformat()  # '2025-11-18'
tomorrow = (date.today() + timedelta(days=1)).isoformat()  # '2025-11-19'

# 字符串比较（ISO格式可以直接比较）
results = MyModel.select(
    conn,
    where={
        'created_at >= ': today,
        'created_at < ': tomorrow,
    }
)
```

---

## RPC响应处理

### ❌ 问题：datetime对象无法序列化

```python
# 数据库查询结果包含datetime对象
user = UserModel.select_one(conn, where={'id': 1})
# user = {'id': 1, 'created_at': datetime(2025, 11, 18, 3, 15, 26)}

# RPC响应时出错
response = {'user': user}
json.dumps(response)  # ❌ TypeError
```

### ✅ 解决方案：存储字符串

```python
# 使用新规范后，查询结果已经是字符串
user = UserModel.select_one(conn, where={'id': 1})
# user = {'id': 1, 'created_at': '2025-11-18T03:15:26.324494'}

# RPC响应正常
response = {'user': user}
json.dumps(response)  # ✅ 成功
```

---

## 最佳实践

### 1. Schema设计

```python
class ArticleModel(BaseModel):
    @classmethod
    def define_table_structure(cls, metadata):
        return sqlalchemy.Table(
            cls.__full_table_name__,
            metadata,
            sqlalchemy.Column('id', sqlalchemy.Integer, primary_key=True),
            sqlalchemy.Column('title', sqlalchemy.String(200), nullable=False),

            # ✅ 日期时间字段使用String
            sqlalchemy.Column('created_at', sqlalchemy.String(32), nullable=False),
            sqlalchemy.Column('updated_at', sqlalchemy.String(32), nullable=False),
            sqlalchemy.Column('published_at', sqlalchemy.String(32), nullable=True),

            # ✅ 日期字段使用String
            sqlalchemy.Column('publish_date', sqlalchemy.String(10), nullable=True),
        )
```

### 2. 插入数据

```python
# 直接使用Python datetime对象，BaseModel会自动转换
article_data = {
    'title': 'Hello World',
    'created_at': datetime.now(),           # 自动转为 '2025-11-18T03:15:26.324494'
    'updated_at': datetime.now(),
    'published_at': datetime(2025, 11, 20, 10, 0, 0),
    'publish_date': date(2025, 11, 20),     # 自动转为 '2025-11-20'
}

ArticleModel.insert(conn, article_data)
```

### 3. 查询和使用

```python
# 查询
article = ArticleModel.select_one(conn, where={'id': 1})

# article包含字符串格式的日期
print(article['created_at'])      # '2025-11-18T03:15:26.324494'
print(article['publish_date'])    # '2025-11-20'

# 如果需要Python对象进行计算
created_dt = datetime.fromisoformat(article['created_at'])
publish_dt = date.fromisoformat(article['publish_date'])

# 计算天数差
days_diff = (publish_dt - created_dt.date()).days
```

### 4. RPC响应

```python
def handle_get_article(params, request_id, context):
    """获取文章详情"""
    article_id = params.get('id')

    # 查询数据库
    article = ArticleModel.select_one(conn, where={'id': article_id})

    # 直接返回，无需序列化处理
    return {
        'success': True,
        'data': article  # ✅ 包含字符串格式的日期，可以直接JSON序列化
    }
```

---

## 检查清单

在创建新Model时，请确认：

- [ ] Schema中没有使用 `sqlalchemy.DateTime`
- [ ] Schema中没有使用 `sqlalchemy.Date`
- [ ] Schema中没有使用 `sqlalchemy.Time`
- [ ] 日期时间字段使用 `sqlalchemy.String(32)`
- [ ] 日期字段使用 `sqlalchemy.String(10)`
- [ ] 时间字段使用 `sqlalchemy.String(12)`
- [ ] 不使用 `default=datetime.utcnow`（改用Lambda或插入前赋值）
- [ ] 插入数据时可以使用Python datetime对象（BaseModel会自动转换）
- [ ] RPC响应可以直接返回查询结果（无需手动序列化）

---

## 常见问题

### Q1: 为什么不在JSON序列化时处理？
**A**: 这是hack方式，治标不治本。应该从源头（数据层）解决问题。

### Q2: 如果需要数据库层面的日期计算怎么办？
**A**: ISO格式字符串支持自然排序和比较。复杂计算在应用层进行。

### Q3: 性能会受影响吗？
**A**: 影响极小。字符串存储和比较的性能与datetime类型相当。

### Q4: 迁移现有数据库怎么办？
**A**:
1. 新建String列
2. 将datetime列的值转换为ISO字符串存入新列
3. 更新代码使用新列
4. 删除旧列

---

## 相关文件

- `pycore/database/type_converter.py` - 类型转换中间层
- `pycore/database/base_model.py` - 集成了自动类型转换的BaseModel
- `pycore/database/json_serializer.py` - JSON序列化工具（备用）

---

**规范版本**: 1.0
**最后更新**: 2025-11-18
**强制执行日期**: 2025-11-18起所有新Model必须遵守
