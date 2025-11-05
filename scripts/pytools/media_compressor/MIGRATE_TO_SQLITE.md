# 迁移到 SQLite - 完整指南

## 为什么必须迁移

### JSON 方案的根本问题

1. **每次读取解析完整文件**
   - 11488 条记录 = 2.6MB JSON
   - 每次读取都要解析所有数据
   - 即使只查一条记录

2. **写入不是真正原子的**
   - 需要 tmp 文件 workaround
   - 进程崩溃仍有数据丢失风险
   - 复杂的锁机制仍不够可靠

3. **性能问题**
   - 读取：O(n) 每次解析所有记录
   - 查找：O(n) 遍历所有记录
   - 更新：读取全部 → 修改 → 写入全部

### SQLite 的优势

1. **真正的原子操作**
   - ACID 事务保证
   - 不需要 tmp 文件
   - 进程崩溃也不会损坏数据

2. **高效的查询**
   - 读取：O(1) 使用索引
   - 查找：O(log n) B-tree 索引
   - 更新：只修改单条记录

3. **更好的并发**
   - WAL 模式支持读写并发
   - 内置锁机制更可靠
   - 不需要自己实现文件锁

4. **性能对比**
   ```
   操作          JSON (11488条)    SQLite
   读取单条      2.6MB 解析        几KB读取
   写入单条      2.6MB 重写        几KB更新
   查询100条     2.6MB 解析        几十KB
   并发读        互斥锁等待         并发读取
   ```

## 迁移步骤

### 1. 运行迁移脚本

```bash
cd D:\programing\core_node\scripts\pytools\media_compressor

# 迁移数据
python migrate_to_sqlite.py

# 输出：
# Migration: JSON → SQLite
#   Source: E:/Evidences/compression_cache.json
#   Target: E:/Evidences/compression_cache.db
#
# Reading JSON file... done (11488 entries)
# Creating SQLite database... done
# Migrating data... done
# Verifying migration... OK (11488 entries)
#
# ✓ Migration completed successfully!
```

### 2. 备份 JSON 文件

```bash
mv E:/Evidences/compression_cache.json E:/Evidences/compression_cache.json.backup
```

### 3. 修改 compressor.py

```python
# 修改前：
from json_store import ThreadSafeJsonStore

cache_store = ThreadSafeJsonStore(
    path=CACHE_JSON,
    default_factory=self._create_empty_cache,
)

# 修改后：
from sqlite_store import SqliteStore

cache_store = SqliteStore(
    path=SOURCE_DIR / "compression_cache.db",  # .db 而不是 .json
    default_factory=self._create_empty_cache,
)
```

### 4. 重启所有客户端

```bash
# 停止所有运行中的 media_compressor 进程
# 重新启动
python main.py
```

## API 兼容性

`SqliteStore` 实现了和 `ThreadSafeJsonStore` 相同的接口：

```python
# 所有这些方法都兼容
store.read()  # 返回相同格式的字典
store.write(data)  # 接受相同格式的字典
store.update(mutator_func)  # 相同的更新机制
store.ensure_file()  # 相同的初始化
```

**不需要修改任何业务逻辑代码！**

只需要：
1. 修改 import
2. 修改路径（.json → .db）

## 性能提升预期

### 启动时间

```
JSON:  读取 2.6MB + 解析 11488 条 = ~1-2 秒
SQLite: 连接数据库 + 初始化 = ~0.1 秒
提升：10-20 倍
```

### 每 50 个文件刷新快照

```
JSON:  读取 2.6MB + 解析 = ~0.5 秒
SQLite: 查询 50 条记录 = ~0.01 秒
提升：50 倍
```

### 写入单条记录

```
JSON:  读取全部 + 修改 + 写入全部 = ~1 秒
SQLite: UPDATE 单条 = ~0.01 秒
提升：100 倍
```

### 总体性能

```
处理 11000 个文件：
JSON:   ~2-3 小时 (大量 I/O 等待)
SQLite: ~30-60 分钟 (几乎无 I/O 等待)
提升：2-4 倍
```

## 回滚方案

如果迁移后有问题：

```bash
# 1. 停止所有客户端

# 2. 恢复 JSON
mv E:/Evidences/compression_cache.json.backup E:/Evidences/compression_cache.json

# 3. 修改 compressor.py 改回 ThreadSafeJsonStore

# 4. 重启客户端
```

## 迁移后清理

确认 SQLite 正常工作后：

```bash
# 删除不再需要的文件
rm E:/Evidences/compression_cache.json.backup
rm E:/Evidences/compression_cache.json.broken
rm E:/Evidences/compression_cache.json.corrupted
rm E:/Evidences/.compression_cache.json.tmp.*  # 所有 tmp 文件
```

## 立即迁移的理由

1. **当前 JSON 方案已经导致数据丢失**
   - 文件被清空为 0 字节
   - 数据损坏需要手动修复

2. **性能问题无法从根本上解决**
   - 即使优化，仍需读取完整 JSON
   - 11000+ 记录的性能不可接受

3. **SQLite 是成熟可靠的方案**
   - 被数十亿设备使用
   - 经过 20+ 年验证
   - Python 内置支持

4. **迁移成本低**
   - API 完全兼容
   - 只需修改 2 行代码
   - 数据自动迁移

**不要再浪费时间修补 JSON 方案了，立即迁移到 SQLite！**
