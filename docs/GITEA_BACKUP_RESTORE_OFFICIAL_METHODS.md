# Gitea 官方备份和恢复方法

> **官方文档来源**: [Backup and Restore | Gitea Documentation](https://docs.gitea.com/administration/backup-and-restore)

## 核心原则 ⚠️

### 备份一致性要求

**必须停止 Gitea 实例才能进行备份**，这是避免数据竞态条件的唯一方法。

官方说明：
> "The only way to avoid race conditions is by stopping the Gitea instance during backups."
> "If the backup happens in the middle of the migration, the git repository may be incomplete although the database claims otherwise."

**为什么必须停止服务？**
- 如果备份发生在数据迁移过程中，Git仓库可能不完整，但数据库却声称完整
- 可能导致备份的数据不一致，恢复时出现问题

## 官方备份命令：`gitea dump`

### 基本用法

```bash
# 切换到 Gitea 用户
su - git

# 停止 Gitea 服务（必须！）
systemctl stop gitea

# 执行备份
./gitea dump -c /path/to/app.ini

# 备份完成后重启服务
systemctl start gitea
```

### 完整命令选项

```bash
gitea dump -c /etc/gitea/app.ini \
           --file gitea-backup-$(date +%Y%m%d-%H%M%S).zip \
           --tempdir /tmp \
           --database mysql  # 可选：转换数据库类型
```

### 备份文件内容

生成的 ZIP 文件包含：

| 文件/目录 | 说明 | 恢复必需 |
|----------|------|----------|
| `app.ini` | 配置文件 | ✅ 是 |
| `custom/` | 自定义文件 | ✅ 是 |
| `data/` | 附件、头像、LFS、索引、SQLite数据库 | ✅ 是 |
| `repos/` | 完整的Git仓库副本 | ✅ 是 |
| `gitea-db.sql` | 数据库导出 | ✅ 是 |
| `log/` | 应用日志 | ❌ 否（不需要恢复）|

### 临时目录

中间文件使用以下目录（按优先级）：
1. `--tempdir` 参数指定的目录
2. `TMPDIR` 环境变量指定的目录
3. 系统默认临时目录

## 数据库备份方法

### 官方推荐：使用原生工具

**不推荐使用 XORM 导出** - 官方文档明确指出：
> "The SQL dump uses XORM, and admins may prefer native MySQL and PostgreSQL dump tools instead, as there are still open issues when using XORM that may cause restore problems."

### MySQL 备份（推荐）

```bash
# 停止 Gitea
systemctl stop gitea

# 使用 mysqldump
mysqldump -u$USER -p$PASS --database $DATABASE > gitea-db.sql

# 或使用配置文件
mysqldump --defaults-extra-file=/etc/mysql/backup.cnf gitea > gitea-db.sql

# 重启 Gitea
systemctl start gitea
```

**MySQL 配置文件示例** (`/etc/mysql/backup.cnf`):
```ini
[client]
user=gitea
password=your_password
host=localhost
```

### PostgreSQL 备份（推荐）

```bash
# 停止 Gitea
systemctl stop gitea

# 使用 pg_dump
pg_dump -U $USER $DATABASE > gitea-db.sql

# 或包含所有者和权限信息
pg_dump -U gitea -F c -f gitea-db.dump gitea

# 重启 Gitea
systemctl start gitea
```

### SQLite 备份

```bash
# 停止 Gitea
systemctl stop gitea

# 直接复制数据库文件
cp /var/lib/gitea/data/gitea.db /backup/gitea-$(date +%Y%m%d).db

# 或使用 SQLite 工具
sqlite3 /var/lib/gitea/data/gitea.db ".backup '/backup/gitea-backup.db'"

# 重启 Gitea
systemctl start gitea
```

## 恢复过程

### 重要提示 ⚠️

**Gitea 没有提供自动恢复命令**，恢复是手动过程。

官方说明：
> "There is currently no support for a recovery command - it is a manual process that mostly involves moving files to their correct locations and restoring a database dump."

### 完整恢复步骤

#### 1. 停止 Gitea 服务

```bash
systemctl stop gitea
```

#### 2. 解压备份文件

```bash
unzip gitea-backup-20250105.zip -d /tmp/gitea-restore
```

#### 3. 恢复文件到正确位置

```bash
# 配置文件
cp /tmp/gitea-restore/app.ini /etc/gitea/app.ini

# 自定义文件
cp -r /tmp/gitea-restore/custom/* /var/lib/gitea/custom/

# 数据目录（附件、头像、LFS等）
cp -r /tmp/gitea-restore/data/* /var/lib/gitea/data/

# Git 仓库
cp -r /tmp/gitea-restore/repos/* /var/lib/gitea/repositories/
```

#### 4. 恢复数据库

**MySQL:**
```bash
mysql -u$USER -p$PASS $DATABASE < /tmp/gitea-restore/gitea-db.sql
```

**PostgreSQL:**
```bash
# 删除旧数据库（可选）
dropdb -U postgres gitea

# 创建新数据库
createdb -U postgres gitea

# 恢复数据
psql -U gitea gitea < /tmp/gitea-restore/gitea-db.sql

# 或从自定义格式恢复
pg_restore -U gitea -d gitea /tmp/gitea-restore/gitea-db.dump
```

**SQLite:**
```bash
cp /tmp/gitea-restore/gitea.db /var/lib/gitea/data/gitea.db
```

#### 5. 修复文件权限

```bash
chown -R git:git /var/lib/gitea
chown -R git:git /etc/gitea
chmod 750 /var/lib/gitea
chmod 640 /etc/gitea/app.ini
```

#### 6. 重新生成 Git Hooks

**这一步非常重要！**

```bash
su - git
cd /path/to/gitea
./gitea admin regenerate hooks
```

#### 7. 重启 Gitea 服务

```bash
systemctl start gitea
```

#### 8. 验证恢复

```bash
# 查看服务状态
systemctl status gitea

# 查看日志
journalctl -u gitea -f

# 测试访问
curl http://localhost:3000
```

## Docker 环境备份

### 使用 docker exec

```bash
# 停止容器
docker stop gitea

# 备份
docker exec -u git -it -w /app/gitea gitea \
    /bin/bash -c '/app/gitea/gitea dump -c /data/gitea/conf/app.ini --tempdir /tmp'

# 复制备份文件
docker cp gitea:/tmp/gitea-dump-*.zip ./backup/

# 重启容器
docker start gitea
```

### Docker Compose 环境

```bash
# 停止服务
docker compose stop gitea

# 备份
docker compose exec -u git gitea \
    /usr/local/bin/gitea dump -c /data/gitea/conf/app.ini

# 复制备份
docker compose cp gitea:/data/gitea-dump-*.zip ./backup/

# 重启服务
docker compose start gitea
```

### Rootless 容器

路径调整：
- 配置文件: `/etc/gitea` → `$HOME/.config/gitea`
- 数据目录: `/var/lib/gitea` → `$HOME/.local/share/gitea`

## 数据库类型转换

### 使用 `--database` 参数

可以在备份时转换数据库类型：

```bash
# 从 MySQL 转换到 PostgreSQL
gitea dump --database postgres -c /etc/gitea/app.ini

# 从 PostgreSQL 转换到 MySQL
gitea dump --database mysql -c /etc/gitea/app.ini
```

**恢复时需要修改 `app.ini`** 中的数据库配置：

```ini
[database]
DB_TYPE = postgres  # 改为目标数据库类型
HOST = localhost:5432
NAME = gitea
USER = gitea
PASSWD = password
```

## 完整备份脚本示例

### 自动备份脚本

```bash
#!/bin/bash
# /usr/local/bin/gitea-backup.sh

set -e

# 配置
GITEA_USER="git"
GITEA_HOME="/var/lib/gitea"
GITEA_BIN="/usr/local/bin/gitea"
GITEA_CONFIG="/etc/gitea/app.ini"
BACKUP_DIR="/backup/gitea"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
BACKUP_FILE="gitea-backup-$(date +%Y%m%d-%H%M%S).zip"

echo "[$(date)] Starting Gitea backup..."

# 停止服务
echo "[$(date)] Stopping Gitea service..."
systemctl stop gitea

# 执行备份
echo "[$(date)] Creating backup..."
su - "$GITEA_USER" -c "cd $GITEA_HOME && $GITEA_BIN dump -c $GITEA_CONFIG --file $BACKUP_DIR/$BACKUP_FILE"

# 重启服务
echo "[$(date)] Starting Gitea service..."
systemctl start gitea

# 等待服务启动
sleep 5

# 检查服务状态
if systemctl is-active --quiet gitea; then
    echo "[$(date)] Gitea service restarted successfully"
else
    echo "[$(date)] ERROR: Gitea service failed to start!" >&2
    exit 1
fi

# 验证备份文件
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup completed: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "[$(date)] ERROR: Backup file not found!" >&2
    exit 1
fi

# 清理旧备份
echo "[$(date)] Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "gitea-backup-*.zip" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed successfully"
```

### 添加定时任务

```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /usr/local/bin/gitea-backup.sh >> /var/log/gitea-backup.log 2>&1
```

## 最佳实践建议

### 1. 备份策略

- ✅ **每日自动备份**：使用 cron 定时执行
- ✅ **保留多个备份**：至少保留最近 7-30 天的备份
- ✅ **异地备份**：将备份文件复制到其他服务器或云存储
- ✅ **测试恢复**：定期测试备份恢复流程

### 2. 数据库选择

- ✅ **生产环境推荐**：MySQL 或 PostgreSQL
- ✅ **使用原生工具**：`mysqldump` 或 `pg_dump`
- ❌ **不推荐**：SQLite（仅适合小型部署或测试）

### 3. 监控和告警

```bash
# 添加备份失败告警
if [ $? -ne 0 ]; then
    echo "Gitea backup failed!" | mail -s "Backup Alert" admin@example.com
fi
```

### 4. 备份验证

```bash
# 验证 ZIP 文件完整性
unzip -t "$BACKUP_FILE"

# 检查必需文件
unzip -l "$BACKUP_FILE" | grep -E '(app.ini|gitea-db.sql|repos/)'
```

## 常见问题和注意事项

### Q1: 是否可以在不停止服务的情况下备份？

**❌ 不推荐。** 官方明确说明必须停止服务以避免数据不一致。

### Q2: XORM 导出有什么问题？

官方指出 XORM 存在未解决的问题，可能导致恢复失败。强烈建议使用原生数据库工具。

### Q3: 恢复后需要做什么？

**必须**重新生成 Git hooks：
```bash
./gitea admin regenerate hooks
```

### Q4: 如何迁移到新服务器？

1. 在旧服务器执行完整备份
2. 在新服务器安装相同版本的 Gitea
3. 按照恢复步骤还原所有文件
4. 重新生成 hooks
5. 重启服务

### Q5: 备份文件太大怎么办？

```bash
# 压缩率更高的选项
zip -9 gitea-backup.zip -r data/ repos/ app.ini gitea-db.sql

# 或者分别备份大文件
tar -czf repos.tar.gz repos/
```

## 参考资源

### 官方文档

- [Backup and Restore | Gitea Documentation](https://docs.gitea.com/administration/backup-and-restore)
- [Command Line | Gitea Documentation](https://docs.gitea.com/administration/command-line)

### 社区资源

- [Backup and Restore Gitea server - Rost Glukhov](https://www.glukhov.org/post/2024/05/gitea-backup-restore/)
- [Gitea setup, backup and restore - Rost Glukhov](https://glukhov.au/posts/2025/gitea/)
- [Backup Gitea in Kubernetes](https://blog.seblab.be/posts/backup-gitea-in-kubernetes/)

### 相关命令

```bash
# 查看 dump 命令帮助
gitea dump --help

# 查看管理员命令
gitea admin --help

# 重新生成 hooks
gitea admin regenerate hooks

# 重新生成 keys
gitea admin regenerate keys
```

---

**文档生成时间**: 2026-01-05
**Gitea 版本**: 1.20+ / 1.21+ / 1.22+
**来源**: Gitea 官方文档
