===========================================
智能静态路径解析器 - StaticPathResolver
===========================================

基于 gvar_common.sh 逻辑的跨平台路径解析器

功能概述：
=========

StaticPathResolver 是一个智能的路径解析工具，参考了 gvar_common.sh
中的路径映射逻辑，能够自动检测运行环境并提供差异化的静态目录计算。

核心特性：
=========

1. 环境自动检测
   ✓ Windows 桌面环境
   ✓ Linux 桌面环境（X11/Wayland）
   ✓ WSL (Windows Subsystem for Linux)
   ✓ Linux 生产服务器环境

2. 智能路径解析
   ✓ 基于环境的差异化路径计算
   ✓ 自动选择最佳基础目录
   ✓ 支持自定义路径键
   ✓ 自动规范化路径格式

3. 默认路径配置
   ✓ 自动生成静态目录配置
   ✓ 多目录支持
   ✓ 环境感知的路径映射

环境检测逻辑：
=============

检测顺序：
1. 平台检测（Windows/Linux）
2. WSL 检测（/mnt/c/Users 或 /proc/version）
3. 桌面环境检测（DISPLAY、WAYLAND_DISPLAY、XDG_CURRENT_DESKTOP）
4. 生产环境判断（无桌面且非WSL）

路径解析规则：
=============

基础目录选择：

WSL 环境：
- 优先：/mnt/d（如果存在）
- 备选：/mnt/c
- 用途：开发环境，访问 Windows 文件系统

Windows 环境：
- 优先：D:\ > E:\ > F:\ > C:\
- 用途：Windows 桌面开发环境

Linux 桌面环境：
- 优先：/mnt/data > /opt > /home
- 备选：/www
- 用途：Linux 桌面开发环境

Linux 生产环境：
- 默认：/www
- 用途：生产服务器部署

项目根目录规则：

开发环境（WSL/Desktop）：
  基础目录/programing/core_node
  例如：
  - WSL: /mnt/d/programing/core_node
  - Windows: D:\programing\core_node
  - Linux Desktop: /opt/programing/core_node

生产环境：
  基础目录/wwwroot/core_node
  例如：
  - Linux Production: /www/wwwroot/core_node

静态目录规则：

所有环境：
  基础目录/www/{subdirectory}

  支持的子目录：
  - static    (静态文件)
  - wwwroot   (网站根目录)
  - assets    (资源文件)
  - uploads   (上传文件)
  - shared-data (共享数据)
  - public    (公共文件)

使用方法：
=========

1. 获取环境信息：
   ```javascript
   const rpc = require('#@ncore/utils/rpc');

   const envInfo = rpc.getEnvironmentInfo();
   console.log('Platform:', envInfo.platform);
   console.log('Is WSL:', envInfo.isWSL);
   console.log('Is Production:', envInfo.isProduction);
   console.log('Base Directory:', envInfo.baseDir);
   console.log('Project Root:', envInfo.projectRoot);
   ```

2. 获取默认静态路径配置：
   ```javascript
   const paths = rpc.getDefaultStaticPaths();
   // 返回：
   // {
   //   '/static': ['/mnt/d/www/static', '/mnt/d/www/wwwroot'],
   //   '/assets': ['/mnt/d/www/assets'],
   //   '/uploads': ['/mnt/d/www/uploads']
   // }
   ```

3. 解析自定义路径：
   ```javascript
   const staticPath = rpc.resolveStaticPath('static');
   const uploadsPath = rpc.resolveStaticPath('uploads');
   const customPath = rpc.resolveStaticPath('wwwroot', 'myapp');

   // WSL 示例输出：
   // staticPath: /mnt/d/www/static
   // uploadsPath: /mnt/d/www/uploads
   // customPath: /mnt/d/www/wwwroot/myapp
   ```

4. 自动配置静态目录：
   ```javascript
   const server = rpc.createExpressServer({
       HTTP_PORT: 8080
       // 不指定 STATIC_PATHS，自动检测并使用默认路径
   });
   ```

5. 自定义静态目录配置：
   ```javascript
   const server = rpc.createExpressServer({
       HTTP_PORT: 8080,
       STATIC_PATHS: {
           '/static': [
               rpc.resolveStaticPath('static'),
               rpc.resolveStaticPath('wwwroot')
           ],
           '/uploads': rpc.resolveStaticPath('uploads'),
           '/custom': '/path/to/custom/directory'
       }
   });
   ```

路径键支持：
===========

预定义路径键：
- 'wwwroot'      - 网站根目录
- 'static'       - 静态文件目录
- 'uploads'      - 上传文件目录
- 'assets'       - 资源文件目录
- 'shared-data'  - 共享数据目录
- 'public'       - 公共文件目录（项目相对）

自定义路径：
直接传入路径字符串，将被原样返回

环境对比示例：
=============

相同的配置在不同环境下的解析结果：

配置代码：
```javascript
{
    '/static': rpc.resolveStaticPath('static')
}
```

解析结果：

Windows 环境：
  /static → D:\www\static

WSL 环境：
  /static → /mnt/d/www/static

Linux Desktop 环境：
  /static → /opt/www/static

Linux Production 环境：
  /static → /www/static

与 gvar_common.sh 的对应关系：
==============================

Bash 函数                 → JavaScript 方法
--------------------------------------------
get_base_data_directory() → getBaseDataDirectory()
get_core_node_project_root() → getCoreNodeProjectRoot()
map_web_path()            → resolveStaticPath()
detect_desktop_environment() → detectDesktopEnvironment()
IS_WSL                    → isWSL
IS_PRODUCTION             → isProduction
HAS_DESKTOP_ENVIRONMENT   → hasDesktop

测试与验证：
===========

运行测试：
```bash
# 查看环境信息
node ncore/utils/rpc/STATIC_PATH_EXAMPLE.js info

# 使用自动检测路径启动服务器
node ncore/utils/rpc/STATIC_PATH_EXAMPLE.js auto

# 使用自定义路径启动服务器
node ncore/utils/rpc/STATIC_PATH_EXAMPLE.js custom
```

API 参考：
=========

rpc.getEnvironmentInfo()
  返回环境检测信息对象

rpc.getDefaultStaticPaths()
  返回自动检测的静态路径配置对象

rpc.resolveStaticPath(pathKey, subPath)
  参数：
    pathKey: 路径键或自定义路径
    subPath: 可选的子路径
  返回：解析后的完整路径字符串

rpc.staticPathResolver
  访问底层 StaticPathResolver 实例

优势：
=====

✓ 跨平台兼容：支持 Windows、Linux、WSL
✓ 零配置：自动检测并使用最佳路径
✓ 灵活性：支持自定义路径配置
✓ 一致性：基于 gvar_common.sh 的成熟逻辑
✓ 可维护性：集中的路径管理
✓ 可扩展性：易于添加新的路径键

文件位置：
=========

实现文件：
  ncore/utils/rpc/http_rpc/libs/StaticPathResolver.js

使用示例：
  ncore/utils/rpc/STATIC_PATH_EXAMPLE.js

文档文件：
  ncore/utils/rpc/STATIC_PATH_RESOLVER_README.txt (本文件)

集成位置：
  ncore/utils/rpc/index.js (导出)
  ncore/utils/rpc/http_rpc/ExpressServer.js (使用)

状态：✅ 完整实现
====================
智能路径解析器已完整实现并集成到 RPC 框架中。
