# ✅ Laravel Dashboard 服务已启动

## 🎉 可以访问了

### 前端地址
**http://192.168.50.3:10018** ✅ 正在运行

### 后端 API
**http://192.168.50.3:9000** ✅ 正在运行

### 服务状态
```bash
# 查看状态
sudo systemctl status webapp-laravel_dashboard

# 查看日志
sudo journalctl -u webapp-laravel_dashboard -f

# 重启服务
sudo systemctl restart webapp-laravel_dashboard
```

---

## ⚠️ 需要修复: inotify 文件监视器限制

### 问题描述
当前系统的 inotify watch 限制太低 (65536),导致:
- ❌ **Vite 热更新 (HMR) 不工作** - 修改代码后不会自动刷新
- ❌ 文件监视失败
- ❌ Systemd 监控功能受限

### 症状
```
Error: ENOSPC: System limit for number of file watchers reached
Failed to add a watch: inotify watch limit reached
```

### 🔧 立即修复 (1分钟解决)

**方法 1: 使用自动修复脚本** (推荐)
```bash
cd /www/programing/core_node/scripts/shells/linux/debian/install_shells
./fix_inotify_limit.sh
```

**方法 2: 手动修复**
```bash
# 1. 临时增加限制 (立即生效,重启后失效)
sudo sysctl fs.inotify.max_user_watches=524288

# 2. 永久增加限制 (重启后依然有效)
echo "fs.inotify.max_user_watches=524288" | sudo tee /etc/sysctl.d/60-inotify-watches.conf
sudo sysctl -p /etc/sysctl.d/60-inotify-watches.conf

# 3. 重启 laravel_dashboard 服务
sudo systemctl restart webapp-laravel_dashboard

# 4. 验证修复
cat /proc/sys/fs/inotify/max_user_watches
# 应该显示: 524288
```

---

## 修复后的效果

✅ **文件监视正常工作**
✅ **Vite 热更新 (HMR) 工作** - 修改代码自动刷新浏览器
✅ **开发体验提升** - 不需要手动刷新
✅ **Systemd 监控正常**

---

## 服务管理命令

### 启动/停止/重启
```bash
sudo systemctl start webapp-laravel_dashboard
sudo systemctl stop webapp-laravel_dashboard
sudo systemctl restart webapp-laravel_dashboard
```

### 查看状态
```bash
sudo systemctl status webapp-laravel_dashboard
```

### 查看实时日志
```bash
sudo journalctl -u webapp-laravel_dashboard -f
```

### 开机自启动
```bash
# 启用
sudo systemctl enable webapp-laravel_dashboard

# 禁用
sudo systemctl disable webapp-laravel_dashboard
```

---

## 端口对照表

| 服务 | 端口 | 地址 | 说明 |
|-----|------|------|-----|
| Laravel Dashboard (前端) | 10018 | http://192.168.50.3:10018 | Vite 开发服务器 ✅ |
| Laravel Main (后端 API) | 9000 | http://192.168.50.3:9000 | Laravel Octane ✅ |
| Laravel Main (Vite) | 10019 | http://192.168.50.3:10019 | - |

---

## 常见问题

### Q1: 页面无法加载?
A: 检查服务状态:
```bash
sudo systemctl status webapp-laravel_dashboard
```

### Q2: 修改代码后页面不刷新?
A: 需要修复 inotify 限制 (见上面的修复方法)

### Q3: 端口 10018 被占用?
A: 查看占用端口的进程:
```bash
sudo lsof -i :10018
```

### Q4: 如何查看详细错误?
A: 查看实时日志:
```bash
sudo journalctl -u webapp-laravel_dashboard -f
```

---

## 下一步

1. ✅ 修复 inotify 限制 (上面的脚本)
2. ✅ 访问 http://192.168.50.3:10018
3. ✅ 开始开发!

---

**文档创建时间**: 2025-12-18 19:10
**服务状态**: ✅ 运行中
**需要操作**: 修复 inotify 限制以启用热更新
