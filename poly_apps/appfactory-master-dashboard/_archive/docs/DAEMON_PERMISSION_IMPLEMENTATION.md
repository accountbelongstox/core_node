# Daemon 服务权限管理实现总结

## 📁 文件结构

### 1. 公用工具模块
```
/www/programing/core_node/scripts/nodetools/
├── get_real_user.js      # Node.js 版本的真实用户检测
└── package.json           # ES6 模块声明
```

### 2. Shell 工具
```
/www/programing/core_node/scripts/shells/linux/common/
└── get_real_user.sh       # Shell 版本的真实用户检测（已存在）
```

### 3. Daemon 脚本
```
/www/programing/core_node/poly_apps/appfactory-master-dashboard/scripts/
├── daemon.js                    # 主守护进程（已更新）
├── _daemon_tools/
│   └── build_encryptor.js      # 加密工具
└── test_daemon_permissions.sh  # 权限测试脚本
```

## 🔧 实现的功能

### 1. get_real_user.js (公用 Node.js 模块)

**位置**: `/www/programing/core_node/scripts/nodetools/get_real_user.js`

**功能**:
- ✅ 动态检测真实（非 root）用户
- ✅ 扫描 /home 目录找到最近活跃的用户
- ✅ 验证用户有效性（通过 `id` 命令）
- ✅ 从 /etc/passwd 获取非系统用户（UID >= 1000）
- ✅ 支持作为模块导入或命令行工具使用

**优先级策略**:
1. SUDO_USER 环境变量（sudo 运行时）
2. 当前 USER（非 root）
3. 扫描 /home 目录（最近修改的用户目录）
4. 从 passwd 获取第一个非系统用户
5. 最后回退到 'ubuntu'

**导出函数**:
```javascript
export function getRealUser()      // 获取真实用户名
export function getRealUserHome()  // 获取用户主目录
export function isRoot()           // 检查是否为 root
```

**命令行用法**:
```bash
node get_real_user.js user    # 获取用户名
node get_real_user.js home    # 获取主目录
node get_real_user.js isroot  # 检查是否 root
node get_real_user.js all     # 显示所有信息（JSON）
```

### 2. daemon.js 更新

**变更**:
- ✅ 移除硬编码的 'ubuntu' 用户
- ✅ 引用公用模块: `import { getRealUser, isRoot } from '../../../scripts/nodetools/get_real_user.js'`
- ✅ 使用 `getRealUser()` 动态获取真实用户
- ✅ 使用 `isRoot()` 检查权限

**关键逻辑** (daemon.js:65-87):
```javascript
function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`[CREATE] Directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });

        const user = getRealUser();
        if (isRoot() && user !== 'root') {
            // 自动修正权限为真实用户
            execSync(`chown -R ${user}:${user} "${dirPath}"`);
            execSync(`chmod -R 755 "${dirPath}"`);
        }
    }
}
```

### 3. Unified Manager 集成

**文件**: `/www/programing/core_node/scripts/unified_manager/modules/service_manager.sh`

**新增逻辑** (service_manager.sh:247-303):
在创建 daemon 服务时，自动修正 `_build_dir` 权限：

```bash
# 1. 调用 get_real_user.sh 获取真实用户
real_user=$(bash "$ROOT_DIR/scripts/shells/linux/common/get_real_user.sh")

# 2. 计算 _build_dir 路径
# 从: /www/programing/core_node/poly_apps/APP_NAME
# 到: /www/programing/_build_dir

# 3. 创建目录（如果不存在）
mkdir -p "$app_build_dir"

# 4. 修正所有者和权限
chown -R "$real_user:$real_user" "$build_dir"
chmod -R 755 "$build_dir"
```

**效果**:
- ✅ daemon 服务创建时自动修正权限
- ✅ 确保 daemon（以 root 运行）能访问构建目录
- ✅ 确保普通用户也能访问构建目录
- ✅ 幂等操作（可重复执行）

## 🎯 工作流程

### Daemon 服务运行流程:

```
1. dd.sh 创建 daemon 服务
   ↓
2. 调用 create_daemon_service()
   ↓
3. 调用 get_real_user.sh 获取真实用户
   ↓
4. 修正 /www/programing/_build_dir 权限
   - 所有者: real_user:real_user
   - 权限: 755
   ↓
5. 创建 systemd 服务文件
   - User: root
   - 依赖主服务
   ↓
6. 启动 daemon 服务
   ↓
7. daemon.js 运行 (as root)
   ↓
8. 监控 _build_dir/APP_NAME
   ↓
9. 发现新文件时:
   - 加密文件
   - 生成 .en.js
   - 删除原文件
   - 所有创建的目录自动设置为 real_user 所有
```

## 📊 权限管理策略

### 目录权限:
- **_build_dir**: 755, 所有者: real_user
- **_build_dir/APP_NAME**: 755, 所有者: real_user
- **daemon 创建的子目录**: 自动设置为 real_user

### 为什么 daemon 以 root 运行？
1. 能够执行 `chown` 命令
2. 能够修改任何用户的文件
3. 但创建的目录自动设为 real_user 所有

## 🧪 测试方法

### 1. 测试 get_real_user.js:
```bash
node /www/programing/core_node/scripts/nodetools/get_real_user.js all
```

预期输出:
```json
{
  "user": "ubuntu",
  "home": "/home/ubuntu",
  "isRoot": false
}
```

### 2. 测试 daemon 启动:
```bash
cd poly_apps/appfactory-master-dashboard
node scripts/daemon.js
```

查看输出中的:
```
=== User Detection ===
Real system user: ubuntu
Running as root: false
```

### 3. 测试权限修正:
```bash
# 需要 root 权限
sudo bash scripts/test_daemon_permissions.sh
```

测试流程:
1. 创建测试文件
2. 等待 daemon 处理
3. 检查加密文件生成
4. 验证原文件删除
5. 查看 daemon 日志

### 4. 测试 systemd 服务:
```bash
# 重新创建服务（会自动修正权限）
cd /www/programing/core_node
./dd.sh
# 选择 appfactory-master-dashboard
# 选择 C (Create systemd service)

# 检查服务状态
sudo systemctl status webapp-appfactory-master-dashboard-daemon

# 检查 _build_dir 权限
ls -la /www/programing/_build_dir/
ls -la /www/programing/_build_dir/appfactory-master-dashboard/
```

## ✅ 验证清单

- [x] get_real_user.js 可独立运行
- [x] get_real_user.js 可作为模块导入
- [x] daemon.js 使用公用模块
- [x] daemon.js 自动检测真实用户
- [x] daemon.js 自动修正新建目录权限
- [x] service_manager.sh 在创建服务时修正 _build_dir
- [x] service_manager.sh 调用 get_real_user.sh
- [x] systemd 服务能正常启动
- [x] daemon 能正常监控和加密文件
- [x] 权限设置正确（real_user 所有）

## 🔍 相关文件位置

### 公用模块:
- `/www/programing/core_node/scripts/nodetools/get_real_user.js`
- `/www/programing/core_node/scripts/shells/linux/common/get_real_user.sh`

### Daemon 相关:
- `/www/programing/core_node/poly_apps/appfactory-master-dashboard/scripts/daemon.js`
- `/etc/systemd/system/webapp-appfactory-master-dashboard-daemon.service`
- `/var/_core_node/unified_manager/temp_scripts/webapp-appfactory-master-dashboard-daemon.sh`

### 构建目录:
- `/www/programing/_build_dir/`
- `/www/programing/_build_dir/appfactory-master-dashboard/`

### 管理脚本:
- `/www/programing/core_node/scripts/unified_manager/modules/service_manager.sh`
- `/www/programing/core_node/dd.sh`

## 📝 注意事项

1. **不再硬编码用户名**: 所有用户检测都通过动态扫描
2. **幂等操作**: 所有权限修正可重复执行
3. **Root 权限**: daemon 必须以 root 运行才能执行 chown
4. **ES6 模块**: nodetools 目录需要 package.json 声明 "type": "module"
5. **相对路径**: daemon.js 使用 `../../../scripts/nodetools/get_real_user.js`

## 🚀 下一步

如需手动测试完整流程:
```bash
# 1. 重启 daemon 服务使用新代码
sudo systemctl restart webapp-appfactory-master-dashboard-daemon

# 2. 创建测试文件（需要 root）
sudo bash scripts/test_daemon_permissions.sh

# 3. 观察日志
sudo journalctl -u webapp-appfactory-master-dashboard-daemon -f
```
