# Core Node 项目统一管理开发规范

## 硬性开发要求

### 1. 应用配置硬编码要求

**强制要求**: 所有应用配置必须硬编码在统一配置文件中，禁止使用目录扫描方式

#### 1.1 应用注册表结构
- 所有应用信息必须在 `app_registry.json` 中硬编码定义
- 每个应用必须明确指定类型：`ncore-app`、`poly-vue`、`poly-laravel`、`poly-flutter`、`python`、`java`、`go`、`php`
- 每个应用必须包含完整的安装、启动、构建命令
- 禁止动态扫描应用目录，所有应用路径必须硬编码

#### 1.2 应用类型分类
```json
{
  "ncore-app": "NCore框架应用，通过统一入口启动：node ./main.js app={appname}",
  "poly-vue": "Vue.js应用，在应用目录npm/yarn install",
  "poly-laravel": "Laravel应用，在应用目录composer install",
  "poly-flutter": "Flutter应用，在应用目录flutter pub get",
  "python": "Python应用，使用uv管理依赖",
  "java": "Java应用，使用maven/gradle管理",
  "go": "Go应用，使用go mod管理",
  "php": "纯PHP应用，使用composer管理"
}
```

#### 1.3 NCore应用架构说明
**重要**: `ncore-app` 类型应用采用统一入口架构：
- **统一入口**: 所有应用通过 `node ./main.js app={appname}` 启动
- **依赖共享**: 所有应用共享根目录的 package.json 和 node_modules
- **应用隔离**: 每个应用的主逻辑位于 `apps/{appname}/main.js`
- **参数传递**: 通过 app 参数指定要启动的具体应用
- **脚本统一**: install/start/deploy/stop 脚本逻辑相同，仅参数不同

#### 8.2 NCore应用脚本生成
- **公共脚本**: 公共生成一个install脚本，因为所有ncore-app的安装逻辑都是一样的,共用同一个node，只是启动参数 appname不同，公共启动脚本直接内嵌`node ./main.js app={appname}` 启动
- **差异实现**: 每个ncore app 如果实现附加的install/start/deploy/stop 逻辑，附加install将在调用公 install 之后调用，start则调用实体脚本，不再使用内嵌 `node ./main.js app={appname}` 启动
- **脚本位置**: 除了公共脚本，各个 `apps/{appname}`的相关脚本生成到 `apps/{appname}/scripts/` 下，按启动参数进行硬编码

#### 8.3 脚本执行规范
**重要**: 所有脚本都必须通过cmd触发ps1执行，不能直接执行ps1文件，因为ps1无法直接执行。

- **脚本复杂度分类**: 每个独立脚本需要在脚本注释中注明简单与复杂程度
  - **简单脚本**: 逻辑简单，直接使用bat文件实现
  - **复杂脚本**: 逻辑复杂，使用bat文件触发ps1执行

- **执行方式标准**:
  - **Windows**: 使用 `cmd /c "powershell -NoProfile -ExecutionPolicy Bypass -File script.ps1"`
  - **Linux**: 使用 `bash script.sh`
  - **跨平台**: 优先使用bat文件，内部调用对应的ps1或sh

- **文件结构要求**:
  ```
  apps/{appname}/scripts/
  ├── start.bat          # Windows启动入口（简单或复杂）
  ├── start.ps1          # Windows PowerShell脚本（复杂时使用）
  ├── start.sh           # Linux Shell脚本
  ├── install.bat        # Windows安装入口
  ├── install.ps1        # Windows PowerShell安装脚本
  └── install.sh         # Linux Shell安装脚本
  ```

- **Registry配置更新**:
  - **start_cmd**: 指向 `.bat` 文件，如 `"explorer \"D:\\programing\\core_node\\apps\\DevOps\\scripts\\start.bat\""`
  - **install_cmd**: 指向 `.bat` 文件，如 `"explorer \"D:\\programing\\core_node\\apps\\DevOps\\scripts\\install.bat\""`
  - **Linux命令**: 保持指向 `.sh` 文件

#### 8.4 Explorer命令参数规范
**重要**: Explorer命令只能接受一个参数，多参数会导致额外文件夹打开。

- **正确格式**: `explorer "绝对路径"`
- **参数限制**: 只能有一个文件路径参数，不能有额外参数
- **路径要求**: 必须使用绝对路径，避免相对路径解析问题
- **执行环境**: 对于explorer命令，不要在执行前切换工作目录

- **流程瑕疵识别**:
  - **双重Explorer调用**: 统一管理器和NCore框架都可能调用explorer，需要避免冲突
  - **工作目录影响**: `Set-Location` + `explorer` 组合可能导致额外参数传递
  - **参数嵌套**: PowerShell命令中的引号嵌套会导致路径解析错误

- **修复方案**:
  - **条件执行**: 对explorer命令单独处理，不切换工作目录
  - **参数清理**: 确保PowerShell命令中没有多余的引号嵌套
  - **流程隔离**: 统一管理器的explorer调用与应用内部的explorer调用分离

### 2. 用户界面编号要求

**强制要求**: 所有应用列表必须显示编号，支持编号选择

#### 2.1 界面显示格式
```
[INFO] Available Applications:
1. DevOps (Type: ncore-app)
2. nuxt_main:admin (Type: poly-vue)
3. laravel_main (Type: poly-laravel)
4. flutter_bloom (Type: poly-flutter)
5. d3check (Type: python)
```

#### 2.2 输入方式
- 支持单个编号：`1`
- 支持多个编号空格分割：`1 3 5`
- 支持编号范围：`1-3`
- 支持预设名称：`dev-suite`

### 3. 技术栈特定安装要求

**强制要求**: 每个技术栈必须有独立的安装逻辑，硬编码实现

#### 3.1 NCore应用 (ncore-app)
- **安装位置**: 项目根目录（所有应用共享）
- **安装命令**: `yarn install`（统一安装所有依赖）
- **启动方式**: `node ./main.js app={appname}`
- **前置检查**: node、yarn版本
- **后置验证**: node_modules存在
- **脚本特点**: 所有应用的install/start/deploy/stop脚本逻辑相同，仅appname参数不同

#### 3.2 Poly应用安装
- **poly-vue**: 应用目录 `npm install` 或 `yarn install`
- **poly-laravel**: 应用目录 `composer install && npm install`
- **poly-flutter**: 应用目录 `flutter pub get`

#### 3.3 Python应用（只作做检查，不用安装，安装交给dd.cmd/sh中的其他功能）
- 前置要求：检查uv、uvx、PIL等必要包
- Windows额外检查要求：win32api、py-auto等类库
- 安装方式：使用uv管理，不依赖requirements.txt

#### 3.4 PHP应用（需要使用脚本根据which php/ where php 的位置进行修改）
- 前置要求：配置php.ini开启所有必要扩展
- Linux权限：允许访问/www/wwwroot目录,Windows：D:\wwwroot
- 执行权限：允许执行exe命令
- 安装方式：composer install

#### 3.5 Flutter应用（只作做检查，不用安装，安装交给dd.cmd/sh中的其他功能）
- 前置要求：安装Java 17
- 安装方式：flutter pub get
- 构建要求：支持web、android、ios平台

### 4. 前置函数和回调函数要求

**强制要求**: 每个技术栈必须实现标准化的前置和回调函数，前置和回调函数放在`unified_manager`统一目录

#### 4.1 函数命名规范
```
Pre-Install-{TechStack}()   # 前置安装函数
Install-{TechStack}()       # 安装函数
Post-Install-{TechStack}()  # 后置验证函数
```

#### 4.2 技术栈前置要求硬编码
- **NCore应用**: Node latest、yarn全局安装
- **Python**: uv、uvx、PIL、win32api(Windows)、pythonauto 自动化(Windows)
- **PHP**: php.ini配置、/www/wwwroot权限(Linux)、d:/wwwroot权限(windows)、exe执行权限
- **Java**: JDK 17、JAVA_HOME环境变量
- **Go**: Go 1.19+、GOPATH配置

### 5. Poly应用脚本集中管理要求

**强制要求**: 每个poly应用必须实现标准化脚本
**强制要求**: 每个poly应用脚脚本放在poly app的scripts目录下,但由unified_manager统一调用

#### 5.1 脚本目录结构
```
poly_apps/{app_name}/scripts/
├── install.ps1/.sh     # 安装脚本（脚本内需要强行将工作目录切换到脚本所在目录的上一级目录）
├── deploy.ps1/.sh      # 部署脚本，部署脚本在于没有调试功能，以及更高的安全性（比如laravel禁止重新生成数据库等）（脚本内需要强行将工作目录切换到脚本所在目录的上一级目录）
├── start.ps1/.sh       # 启动脚本，与部署脚本相反，更轻松（脚本内需要强行将工作目录切换到脚本所在目录的上一级目录）
```

#### 5.2 脚本调用方式
- **Windows**: 使用explorer调用对应.ps1脚本
- **Linux**: 使用&在独立线程启动.sh脚本
- 所有脚本必须支持后台运行模式

### 6. 系统服务安装要求

**强制要求**: 支持将应用安装为系统服务

#### 6.1 Windows系统服务
- 将运行脚本添加到startup（全局用户）菜单
- 创建.lnk快捷方式到启动文件夹
- 支持开机自启动

#### 6.2 Linux系统服务
- 根据appname创建systemd服务，连接deploy.sh脚本
- 服务名格式：`ncore-{appname}`
- 设置开机启动：`systemctl enable`
- 支持服务管理：start、stop、restart、status

#### 6.3 服务配置模板(默认使用root权限)
```ini
[Unit]
Description=NCore {AppName} Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={AppPath}
ExecStart={StartCommand}
Restart=always

[Install]
WantedBy=multi-user.target
```

### 7. 常量配置文件要求

**强制要求**: 创建集中的常量配置文件

#### 7.1 常量文件结构
```
scripts/unified_manager/constants/
├── paths.json          # 路径常量
├── commands.json       # 命令常量
├── versions.json       # 版本要求常量
└── services.json       # 服务配置常量
```

#### 7.2 路径常量定义
```json
{
  "PROJECT_ROOT": "项目根目录绝对路径",
  "APPS_DIR": "apps目录路径",
  "POLY_APPS_DIR": "poly_apps目录路径",
  "SCRIPTS_DIR": "scripts目录路径",
  "LOGS_DIR": "日志目录路径",
  "TEMP_DIR": "临时文件目录路径"
}
```

#### 7.3 公共代码要求
- 所有脚本必须引用统一的常量文件
- 禁止硬编码路径字符串
- 支持相对路径自动解析为绝对路径
- 每个脚本都要强行定义自身所在的目录，以及相对到 PROJECT_ROOT 的路径，功能脚本如 start/stop/install/deploy 需要在脚本内强行切换到poly app的目录。
- 外部脚本调用子 ps1/sh 脚本时，需要记录当前工作目录，在子脚本之后需要恢复工作目录

### 8. 现有脚本迁移要求

**强制要求**: 新开发的统一管理脚本必须兼容和迁移现有脚本

#### 8.1 Poly应用脚本迁移
- **扫描现有脚本**: 在poly_apps子目录中查找现有的启动脚本
- **脚本识别**: 自动识别.ps1、.sh、.bat、.cmd等可执行脚本
- **功能迁移**: 将现有脚本的功能迁移到标准化脚本中
- **参数适配**: 保持原有脚本的参数和功能不变



### 1. Apps 目录应用统计 (9个)

#### Node.js 应用 (8个)
- **DevOps**: DevOps管理系统 (Node.js + Express)
- **DocumentOffline**: 离线文档处理 (Node.js)
- **GetDocFromUrlByPuppeteer**: 网页文档抓取 (Node.js + Puppeteer)
- **VideoCompression**: 视频压缩服务 (Node.js)
- **VoiceClientAndCaddy**: 语音客户端 (Node.js + Caddy)
- **WebLocalAreaNetwork**: 局域网Web服务 (Node.js)
- **ai_translator_app**: AI翻译应用 (Node.js)
- **flutter_icon_manager**: Flutter图标管理 (Node.js)

#### Python 应用 (1个)
- **d3check**: Diablo III自动化控制系统 (Python + PyWin32)

### 2. Poly Apps 目录应用统计 (5个)

#### 前端应用 (3个)
- **nuxt_main**: Nuxt.js多入口Web应用 (支持5个子应用)
  - Example App
  - CodeMart App
  - Dev Tools App
  - Admin App
  - Dashboard App
- **admin-vue-tailwind**: Vue.js管理后台 (Vue 3 + Tailwind CSS)
- **it-tools**: 开发者工具集合 (Vue 3 + Vite)

#### 后端应用 (1个)
- **laravel_main**: Laravel API后端 (PHP + Laravel 11.x)

#### 移动应用 (1个)
- **flutter_bloom**: Flutter跨平台应用 (Flutter + Dart)

## 实施要求


### 禁止事项

- 禁止使用目录扫描方式获取应用信息
- 禁止依赖requirements.txt等不稳定的配置文件
- 禁止硬编码绝对路径字符串在代码中、改为从配置文件中查找相对路径
- 禁止跳过前置条件检查
- 禁止缺少错误处理和日志记录
