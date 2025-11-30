# Sync Nuxt Apps to Laravel Nginx

## 功能说明

在 `start.sh` 交互式菜单中，现在可以将选中的 Nuxt 应用同步到 Laravel systemd 服务和 Nginx 配置。

## 使用方法

### 交互式菜单

1. 运行 `./start.sh` 进入交互式菜单
2. 使用 **上/下箭头** 选择应用
3. 使用 **左/右箭头** 切换模式 (debug/build)
4. 按 **'s'** 键同步到 Laravel Nginx
5. 按 **Enter** 启动应用
6. 按 **'q'** 退出

### 按键说明

- `↑/↓` - 选择应用
- `←/→` - 切换 debug/build 模式
- `Enter` - 启动选中的应用
- `s` - 同步到 Laravel systemd 服务
- `q` - 退出

## 同步流程

按下 `s` 键后，会执行以下操作：

1. **验证应用源码** - 检查 `app_{appname}_pages` 目录是否存在
2. **创建/刷新 systemd 服务** - 调用 Laravel Artisan 命令
3. **自动清理重复服务** - 如果存在同名服务，自动清理
4. **检测配置变化** - 比较 mode 和 port 是否改变
5. **更新服务配置** - 写入新的 systemd 服务文件
6. **显示服务信息** - 显示服务名称和管理命令

## 服务模式

### Debug 模式
- 使用 factory 目录 + 文件监控
- 自动同步源码变化
- 运行 Nuxt dev server
- 命令：`switch-app.js --mode dev`

### Production 模式
- 先构建到 factory 目录
- 运行生产环境优化版本
- 命令：`switch-app.js --mode build`

## 技术细节

### 相对路径定位
```bash
# 从 nuxt_main/scripts 到 laravel_main
laravel_dir="$SCRIPT_DIR/../../laravel_main"
```

### Artisan 命令
```bash
php artisan nuxt:service:refresh <appname> <port> <debug_flag>
```

参数：
- `appname` - 应用名称 (如: codemart, ittools, pymatrix)
- `port` - 端口号 (从 10000 开始，如: 10000, 10001, 10002)
- `debug_flag` - 0=production, 1=debug

### 服务命名规则
```
nuxt-{appname}.service
```

示例：
- `nuxt-codemart.service`
- `nuxt-ittools.service`
- `nuxt-pymatrix.service`

## 返回信息

同步成功后会显示：

```
===============================================================================
  SYNC COMPLETE
===============================================================================

Service Details:
  Name: nuxt-codemart.service
  Port: 10000
  Mode: debug (dev + watcher)

Management Commands:
  Start   : sudo systemctl start nuxt-codemart.service
  Stop    : sudo systemctl stop nuxt-codemart.service
  Restart : sudo systemctl restart nuxt-codemart.service
  Status  : sudo systemctl status nuxt-codemart.service
  Logs    : sudo journalctl -u nuxt-codemart.service -f

✓ Service refreshed successfully!
```

## 智能处理

### 重复添加同一个应用
当反复为同一个应用调用同步时，系统会：

1. 检测配置差异（mode、port）
2. 报告变化详情
3. 自动更新配置
4. 不会创建重复服务

### 返回的 action 字段
- `created` - 新建服务
- `refreshed_no_change` - 刷新但配置无变化
- `refreshed_mode_change` - 模式变化
- `refreshed_port_change` - 端口变化
- `refreshed_mode_and_port_change` - 模式和端口都变化

## 故障排查

### Laravel 目录未找到
```
[ERROR] Laravel directory not found: ../../laravel_main
```
检查目录结构是否正确。

### App 不存在
```
App 'xxx' does not exist in source (app_xxx_pages not found)
```
确保 `app_{appname}_pages` 目录存在。

### Artisan 命令失败
```
[ERROR] Failed to sync service to Laravel Nginx
```
检查：
1. PHP 是否可用
2. Laravel 路径是否正确
3. 权限是否足够
4. Laravel Artisan 命令是否注册

## 示例

### 同步 Codemart (Debug 模式)
1. 选择 Codemart
2. 切换到 debug 模式
3. 按 's'
4. 查看同步结果

### 同步 ITTools (Production 模式)
1. 选择 ITTools
2. 切换到 build 模式
3. 按 's'
4. 查看同步结果
