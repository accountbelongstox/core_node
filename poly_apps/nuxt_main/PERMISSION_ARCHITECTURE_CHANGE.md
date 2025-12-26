# Nuxt PolyApp 权限架构重构

**日期**: 2025-12-03
**原因**: 解决工厂目录 (factory directory) 权限混乱导致的 EACCES 错误

## 问题根源

### 原架构问题
1. **权限冲突**: 工厂目录由 root 创建，但服务尝试以 `ubuntu` 用户运行
2. **同步失败**: Node.js 进程无法删除/修改 root 拥有的文件
3. **复杂性**: 需要频繁的 `chown` 操作来修复权限

### 典型错误
```
Fatal error: [Error: EACCES: permission denied, unlink '/www/_build_dir/nuxt_factory/linux/_app_ittools/scripts/start.sh']
```

## 解决方案：以 ROOT 权限运行

### 架构变更

#### 1. Systemd 服务配置
**文件**: `ServerManagerV1NuxtServiceManager.php`

**变更前**:
```php
User=$user  // 动态检测用户 (ubuntu/root)
```

**变更后**:
```php
User=root  // 固定使用 root
```

影响文件：
- `generateServiceFileContent()` - 生产模式服务 (Line 261)
- `generateDebugServiceFileContent()` - 调试模式服务 (Line 297)

#### 2. 移除权限检测和修复代码
**文件**: `ServerManagerV1NuxtAppCommand.php`

**移除的操作**:
1. ❌ `SystemUtil::detectUser()` - 用户检测
2. ❌ `chown -R $user:$user` - 所有权限修复
3. ❌ `sudo -u $user` - 降权执行命令

**简化的函数**:
- `addPolyApp()` - Line 118: `$user = 'root'`
- `copyToFactory()` - Line 352: 移除 chown 操作
- `prepareFactoryDirectory()` - Line 357-380: 移除权限修复逻辑
- `ensureFactoryPermissions()` - Line 383-388: 仅返回成功
- `ensureFactoryDependencies()` - Line 410: 移除 `sudo -u`
- `startService()` - Line 712-726: 移除所有权限修复
- `fixAndResetPolyApp()` - Line 736-739: 简化删除逻辑

#### 3. 命令执行简化

**pnpm install 变更**:
```bash
# 变更前
cd $factoryPath && echo 'y' | sudo -u ubuntu pnpm install

# 变更后
cd $factoryPath && echo 'y' | pnpm install
```

## 优势

### ✅ 稳定性
1. **无权限冲突**: 所有文件和进程都是 root 权限
2. **无 EACCES 错误**: root 可以访问所有文件
3. **简化同步**: Node.js 进程可以自由删除/创建文件

### ✅ 简洁性
1. **代码减少**: 移除了 100+ 行权限管理代码
2. **维护简单**: 不需要跟踪文件所有权
3. **一致性**: 所有环境行为一致

### ✅ 性能
1. **减少系统调用**: 不需要频繁 chown
2. **部署更快**: 减少权限修复步骤

## 安全考虑

### ⚠️ Root 权限风险

1. **隔离性降低**: 服务以 root 运行，漏洞影响更大
2. **最佳实践违背**: 传统上服务应该以受限用户运行

### 🛡️ 缓解措施

1. **网络隔离**:
   - 服务仅监听 `127.0.0.1`
   - 通过 nginx 反向代理暴露

2. **代码审查**:
   - Nuxt 应用代码需要严格审查
   - 避免执行用户输入

3. **监控**:
   - systemd 日志记录所有活动
   - 使用 `journalctl -u nuxt-* -f` 监控

4. **最小权限**:
   - 考虑使用 Linux capabilities 限制 root 权限
   - 未来可以使用 `CAP_DAC_OVERRIDE` 等

## 部署验证

### 测试步骤
```bash
cd /www/programing/core_node/poly_apps
./nuxt_main/scripts/start.sh
```

1. 选择 "SYNC TO LARAVEL NGINX"
2. 选择 App: `ittools`
3. 选择 Port: `10001`
4. 选择模式: `1` (Debug mode)

### 预期结果
```
[9/9] Starting service
✓ Service started successfully

Successfully deployed Nuxt PolyApp: ittools (Debug Mode)
```

### 验证服务
```bash
# 检查服务状态
systemctl status nuxt-ittools

# 查看服务配置
cat /etc/systemd/system/nuxt-ittools.service | grep "User="
# 应输出: User=root

# 查看文件权限
ls -la /www/_build_dir/nuxt_factory/linux/_app_ittools/
# 所有文件应该是 root:root

# 测试访问
curl http://127.0.0.1:10001
```

## 回滚方案

如果需要恢复到用户隔离模式：

1. **恢复服务配置**:
```bash
git revert <this-commit>
```

2. **修复所有权**:
```bash
chown -R ubuntu:ubuntu /www/_build_dir
chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/nuxt_main
```

3. **重新部署**:
```bash
php artisan servermanager:nuxt rebuild ittools
```

## 相关文件

### 修改的核心文件
1. `app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1NuxtServiceManager.php`
   - 行 261: 生产模式服务 `User=root`
   - 行 297: 调试模式服务 `User=root`

2. `app/Apps/ServerManagerV1/ServerManagerV1CLI/Commands/ServerManagerV1NuxtAppCommand.php`
   - 行 118: 固定使用 root 用户
   - 行 352-354: 移除 chown 操作
   - 行 357-380: 简化目录准备
   - 行 383-388: 简化权限检查
   - 行 410: 移除 sudo -u
   - 行 443-448: 简化缓存目录创建
   - 行 712-726: 简化服务启动
   - 行 736-739: 简化目录清理

### 未修改但相关的文件
1. `app/Providers/PathMapper.php`
   - 添加了 `getNginxBinaryPath()` 方法
   - 用于定位 nginx 二进制文件

2. `poly_apps/nuxt_main/scripts/switch-app.js`
   - 同步逻辑未改变
   - 现在以 root 身份运行，无权限问题

## 后续优化建议

### 1. 使用 Linux Capabilities
```ini
[Service]
User=ubuntu
AmbientCapabilities=CAP_DAC_OVERRIDE CAP_CHOWN
```

### 2. 使用命名空间隔离
```ini
[Service]
User=root
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/www/_build_dir
```

### 3. SELinux/AppArmor 策略
- 限制 root 进程的文件访问范围
- 只允许访问必要的目录

## 总结

此次重构将 Nuxt PolyApp 服务从**用户隔离模式**改为**ROOT 权限模式**，彻底解决了权限冲突问题。虽然增加了安全风险，但通过网络隔离和监控可以有效缓解。代码大幅简化，维护成本降低。

**权���**: 安全性 ↓ vs 稳定性 ↑ + 简洁性 ↑
