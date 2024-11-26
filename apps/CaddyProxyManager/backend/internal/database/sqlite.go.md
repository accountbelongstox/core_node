# internal/database/sqlite.go

## 1. 功能描述
实现SQLite数据库的连接、管理和操作，提供数据持久化支持。

## 2. API接口清单
不直接提供API接口，为应用程序提供数据库操作支持。

## 3. 方法清单
- `NewDB(config *config.Config) (*DB, error)`: 创建数据库连接
- `Close() error`: 关闭数据库连接
- `Migrate() error`: 执行数据库迁移
- `Transaction(fn func(tx *gorm.DB) error) error`: 事务处理
- `Backup(filename string) error`: 数据库备份

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置管理)
- internal/database/models.go (数据模型)
- internal/logger/logger.go (日志处理)
- internal/errors/errors.go (错误处理) 