# Gitea 用户密码管理指南

## 重要前提

**检查 INSTALL_LOCK 状态**：Gitea 必须完成初始化后才能使用 admin 命令。

```bash
# 检查配置文件
grep INSTALL_LOCK /www/wwwroot/data/gitea/config/app.ini

# 如果显示 INSTALL_LOCK = false，需要先修改为 true
sudo sed -i 's/INSTALL_LOCK = false/INSTALL_LOCK = true/' /www/wwwroot/data/gitea/config/app.ini
sudo chown -R git:git /www/wwwroot/data/gitea/
sudo systemctl restart gitea
```

## 方法一：使用 Gitea 命令行工具

**重要参数说明**：
- `--config`: 配置文件路径（app.ini）
- `--work-path`: 工作目录路径（数据目录）
- `--custom-path`: 自定义文件目录路径

### 1. 列出所有用户

```bash
gitea --config /www/wwwroot/data/gitea/config/app.ini --work-path /www/wwwroot/data/gitea/data --custom-path /www/wwwroot/data/gitea/custom admin user list
```

### 2. 创建管理员账号

```bash
gitea --config /www/wwwroot/data/gitea/config/app.ini --work-path /www/wwwroot/data/gitea/data --custom-path /www/wwwroot/data/gitea/custom admin user create --username admin --password AdminPassword123 --email admin@example.com --admin
```

### 3. 修改用户密码

```bash
gitea --config /www/wwwroot/data/gitea/config/app.ini --work-path /www/wwwroot/data/gitea/data --custom-path /www/wwwroot/data/gitea/custom admin user change-password --username USERNAME --password NEW_PASSWORD
```

### 4. 强制用户下次登录修改密码

```bash
gitea --config /www/wwwroot/data/gitea/config/app.ini --work-path /www/wwwroot/data/gitea/data --custom-path /www/wwwroot/data/gitea/custom admin user change-password --username USERNAME --password NEW_PASSWORD --must-change-password
```

## 方法二：使用 REST API

### 1. 获取管理员 Token

首先需要在 Gitea Web 界面生成 Access Token：
1. 登录 Gitea
2. 进入 `设置` → `应用` → `管理访问令牌`
3. 生成新的 Token

### 2. 创建用户并设置密码

```bash
curl -X POST "http://localhost:3000/api/v1/admin/users" -H "Authorization: token YOUR_ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"username": "newuser", "email": "newuser@example.com", "password": "secure_password", "must_change_password": true, "send_notify": false}'
```

### 3. 列出所有用户

```bash
curl -X GET "http://localhost:3000/api/v1/admin/users?page=1&limit=50" -H "Authorization: token YOUR_ADMIN_TOKEN"
```

### 4. 删除用户

```bash
curl -X DELETE "http://localhost:3000/api/v1/admin/users/username" -H "Authorization: token YOUR_ADMIN_TOKEN"
```

## 方法三：直接修改数据库（SQLite）

⚠️ **警告**: 直接修改数据库有风险，建议先备份！

### 1. 备份数据库

```bash
sudo cp /www/wwwroot/data/gitea/data/gitea.db /www/wwwroot/data/gitea/data/gitea.db.backup.$(date +%Y%m%d-%H%M%S)
```

### 2. 查看用户列表

```bash
sudo -u git sqlite3 /www/wwwroot/data/gitea/data/gitea.db "SELECT id, name, email, is_admin FROM user;"
```

### 3. 查看密码哈希算法

```bash
grep "PASSWORD_HASH_ALGO" /www/wwwroot/data/gitea/config/app.ini
```

## 方法四：通过 Web 界面

### 1. 管理员重置用户密码

1. 以管理员身份登录 Gitea
2. 进入 `站点管理` → `用户账号管理`
3. 找到目标用户，点击编辑
4. 设置新密码
5. 可选：勾选 "下次登录必须修改密码"
6. 保存

## 密码策略配置

编辑 `/www/wwwroot/data/gitea/config/app.ini`：

```ini
[security]
INSTALL_LOCK = true
MIN_PASSWORD_LENGTH = 10
PASSWORD_COMPLEXITY = lower,upper,digit
PASSWORD_HASH_ALGO = argon2
DISABLE_GIT_HOOKS = true
```

修改配置后需要重启 Gitea：

```bash
sudo systemctl restart gitea
```

## 常见问题

### 1. 忘记管理员密码怎么办？

```bash
gitea --config /www/wwwroot/data/gitea/config/app.ini --work-path /www/wwwroot/data/gitea/data --custom-path /www/wwwroot/data/gitea/custom admin user change-password --username admin --password NewSecurePassword123
```

### 2. 密码复杂度要求

密码必须满足配置文件中 `PASSWORD_COMPLEXITY` 的要求：
- `lower`: 至少包含一个小写字母
- `upper`: 至少包含一个大写字母
- `digit`: 至少包含一个数字
- `spec`: 至少包含一个特殊字符

### 3. 密码哈希存储位置

用户密码哈希存储在数据库的 `user` 表的 `passwd` 字段中：

```bash
sudo -u git sqlite3 /www/wwwroot/data/gitea/data/gitea.db "SELECT name, email, passwd FROM user LIMIT 5;"
```

**注意**: 密码是单向哈希的，无法直接查看原始密码！

## 安全建议

1. **使用强密码**: 至少10个字符，包含大小写字母、数字和特殊字符
2. **定期更换密码**: 建议每3-6个月更换一次
3. **启用双因素认证**: 在用户设置中启用 2FA
4. **限制管理员数量**: 只给必要的用户管理员权限
5. **审计日志**: 定期检查 `/www/wwwroot/data/gitea/log/` 中的日志
6. **备份数据库**: 定期备份 `gitea.db`

## 本地配置路径

根据安装脚本，你的 Gitea 配置路径：

- **二进制文件**: `/usr/local/bin/gitea`
- **配置文件**: `/www/wwwroot/data/gitea/config/app.ini`
- **数据目录**: `/www/wwwroot/data/gitea/data/`
- **数据库**: `/www/wwwroot/data/gitea/data/gitea.db`
- **日志目录**: `/www/wwwroot/data/gitea/log/`
- **运行用户**: `git`
- **默认端口**: `3000`
