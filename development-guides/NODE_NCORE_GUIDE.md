<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Node.js ncore 开发规范指南

## 1. 核心开发规范（最重要规则）

### 1.1 基础要求
- **请严格遵守：代码必须全英文，可以创建和编辑文件，不要运行测试命令，不要编写总结或测试代码。**
- **基于最新Node.js版本**
- **代码需要写为全英文**
- **必须使用package.json中的别名引用，避免相对路径**

### 1.2 架构原则
- **所有常量统一放在global_vars中管理**
- **所有日志读取、文件操作、网络功能、命令行子线程执行都要使用foundation/common和foundation/utilities中的功能，这样是为了代码便于维护，同时文件读取等功能处理了很多编码问题。并使用别名调用**
- **如果你认为一个功能，部分代码包含 utils，但这并非最基础的底层功能，也可能会调用第三方包，请优先在 `ncore/utils` 目录下寻找对应功能的脚本并添加代码。如果找不到合适的脚本，你可以创建一个新的，但请务必确保你已了解 `utils` 目录的使用规则。**
- **如果你认为一个修改包含常量或重要变量，请放到global_vars，并确认你了解了global_vars的规则**
- **如果你认为某个开发功能，其部分代码属于基础的 utils 功能，不调用其他文件，且不依赖任何第三方包，你可以考虑将其放置在 `ncore/foundation` 目录中，但必须确保这确实是基础功能。**

### 1.3 兼容性与文件管理
- **可以根据任务需要修改ncore内的核代码，但对于旧的函数必须要保留函数名和参数顺序，以确保升级后的代码兼容旧代码**
- **所有静态文件（如图片等）都应放置在根目录 `public` 目录下，此目录不会被 `.gitignore` 忽略。**
- 所有文件夹都应该使用 `#@global_vars` 中的 `CACHE_DIR` 、`DEBUG`/`TMP` 等目录，此目录会被 `.gitignore` 忽略。
- 不要使用throw new Error，而是使用logger.error打印错误日志，同时必的时候return或者以if分支代替

## 2. ncore 核心架构

### 2.1 架构概述
- `./ncore/foundation`为核心功能，由node基础代码写成，只对外提供基础功能，并不调用任何类
- `./ncore/utils`为整个node基础服务框架提供的功能类，一个子文件或一个子目录代表一个功能
- `./ncore/global_vars` 为全局常量、重要变量，如appname,cachedir等，二进制如7z,curl,git等路径，操作系统常量
- `./apps` 本项目在 `apps` 目录中定义了多个文件夹、每个文件夹代表一个app，作为程序的不同入口点。其依赖 `ncore` 作为基础服务，每个app目录下的main.js作为app的入口，以组织ncore成为不同的功能应用。

### 2.2 目录结构
```
ncore/
├── foundation/           # 核心功能
│   ├── common/          # 基础功能
│   │   ├── commander.js # 命令执行
│   │   ├── downloader.js # 下载功能
│   │   ├── encoding.js  # 编码处理
│   │   └── logger.js    # 日志服务
│   ├── utilities/       # 工具库
│   │   ├── filetool.js  # 文件工具
│   │   ├── httptool.js  # HTTP工具
│   │   ├── strtool.js   # 字符串工具
│   │   └── ...          # 其他工具
│   ├── express_utils/   # express的基础封装实现，供全项目调用
│   └── db_utils/        # 数据库的基础封装实现，供全项目调用，支持sqlite/mysql
├── global_vars/         # 全局变量
│   ├── index.js         # 常量主入口
│   ├── gcommon/         # 通用常量
│   ├── tool/            # 常量计算辅助服务
│   ├── global_dir/      # 目录相关常量
│   ├── libs/            # 常量库
│   └── platform-constant/ # 平台常量
├── utils/               # 工具函数（基础类库，避免循环引用）
│   ├── caddy/           # Caddy服务器工具
│   ├── cmd_select/      # 命令行选择工具
│   ├── db_tool/         # 数据库工具
│   ├── dev_tool/        # 开发工具
│   ├── docker_liunx_tool/ # Docker for Linux 工具
│   ├── htmltool/        # HTML工具
│   ├── image/           # 图像处理工具
│   ├── linux/           # Linux系统工具
│   ├── mail/            # 邮件工具
│   ├── net/             # 网络工具
│   ├── openai/          # OpenAI API工具
│   ├── puppeteer_spider_v2/ # Puppeteer爬虫框架
│   ├── web_offline/     # 离线网站下载工具
│   ├── shortcuttool/    # 快捷方式工具
│   ├── spider/          # 爬虫工具 (Puppeteer)
│   ├── strapi_tool/     # Strapi工具
│   ├── systool/         # 系统工具
│   ├── video/           # 视频处理工具
│   └── win_tool/        # Windows系统工具
└── ncontroller/         # 多控制器架构（避免与utils循环引用）
    ├── controllers/     # 具体控制器实现
    │   └── document_controller.js # 文档/网站下载控制器
    ├── controller_manager.js # 控制器管理器
    ├── browser_manager.js # 浏览器管理（使用singleton）
    └── routes/          # RPC路由定义
```

**重要：** ncontroller为多控制器架构，browser_manager/document_controller等是独立的controller。每个controller使用utils中的基础类库，避免循环引用。DocumentController实现文档下载（纯净内容）和整站下载（带资源）功能。
```

## 3. 全局变量与常量管理

### 3.1 global_vars 常量、重要变量区
- `./ncore/global_vars`是基础功能的常量区，整个项目只有一个常量区。有些常量是动态运算出来的，比如磁盘大小，但也要放到这里边
- `./ncore/global_vars/index.js`是常量计算的导出主文件，目录下的其他目录，是给`global_vars/index.js`常量计算提供辅助服务的
- 在package.json中使用别名`#@global_vars`引用

### 3.2 package.json 别名规则

**package.json**中不要随意增加别名，以防止别名越来越多，只增加重要的、通用性更广的别名，其他使用 `#@ncore/xx/xxx.js`来调用
#### 3.2.1 别名列表
- `#@/*` → `./*`
- `#@ncore/*` → `./ncore/*`
- `#@apps/*` → `./apps/*`
- `#@global_vars` → `./ncore/global_vars/index.js`
- `#@global_dir` → `./ncore/global_vars/global_dir/globaldir.js`
- `#@bdir` → `./ncore/global_vars/global_dir/globaldir.js`
- `#@gconfig` → `./ncore/global_vars/tool/gconfig.js`
- `#@logger` → `./ncore/foundation/common/logger.js`
- `#@commander` → `./ncore/foundation/common/commander.js`
- `#@freader` → `./ncore/foundation/utilities/filetoollibs/freader.js`
- `#@fwriter` → `./ncore/foundation/utilities/filetoollibs/fwriter.js`
- `#@ftools` → `./ncore/foundation/utilities/filetool.js`
- `#@btools` → `./ncore/foundation/utilities/index.js`
- `#@dbtools` → `./ncore/utils/db_tool/main.js`
- `#@exiton` → `./ncore/foundation/utilities/process_on.js`
- `#@downloader` → `./ncore/foundation/common/downloader.js`
- `#@link` → `./ncore/foundation/common/link.js`
- `#@winpath` → `./ncore/utils/win_tool/libs/winpath.js`
- `#@inspect` → `./ncore/foundation/utilities/inspect.js`

## 4. ncore 模块开发规则

### 4.1 ncore/foundation 开发规则
- `./ncore/foundation` 是项目的核心基础功能目录，提供最底层的、与业务无关的通用能力。
- **`./ncore/foundation/common/`**: 存放项目中最基础的通用模块，例如日志 (`logger.js`)、命令执行 (`commander.js`) 和下载器 (`downloader.js`)。
- **`./ncore/foundation/utilities/`**: 存放各类基础工具库，如文件操作 (`filetool.js`)、HTTP 工具 (`httptool.js`) 和字符串处理 (`strtool.js`)。
- 如果需要添加foundation中的代码，请确保：1. 不引用第三方包，仅使用node原生代码。2.  只能引用 `/foundation/` 中的最底层的代码。

### 4.2 ncore/utils 开发规则
- `./ncore/utils`中的代码可以引用 `ncore/foundation` 和 `global_vars` 的功能作为其支撑部分，不要重复实现 `ncore/foundation` 中的任何功能，比如文件读取，日志，打印，编码等。
- `./ncore/utils`中的任何功能导出的都将是一个实例，而不是一个类，这是为了减少实例化带来的性能开销
- 如引用第三方包，遵守本文档第三包使用规则。对于一个新的utils开发任务，你可以将提示词存档到utils的子目录中，以便后续查档开发。

## 5. App 开发规范

### 5.1 基于 ncore 基础服务的 app 开发规范
#### 5.1.1 基础要求
- **请严格遵守：代码必须完全使用英文，可以创建和编辑文件，不要运行测试命令，不要编写摘要或测试代码**
- **如果APP是新创建，将提示词整理并放入APP目录，便于后续对照增量开发**

#### 5.1.2 开发流程
- **开发前评估**：在开始开发之前，至关重要的是扫描核心 `ncore` 库（`global_vars`、`foundation`、`utils`），以确定它们是否满足当前应用的需求。请输出一份分析和评估文档到 `apps/your-app-name/development_analysis.md`，解释哪些功能应该在 `app` 目录中实现，哪些应该调用 `utils`，以及哪些需要扩展 `utils`。此评估应在新开发和增量开发中执行。

#### 5.1.3 启动与入口
- **启动方法**：通过在主文件 `main.js` 后附加参数 `app=appName` 来启动相应的应用程序。例如：`node main.js app=YourAppName`。
- **入口文件**：主文件 `main.js` 将自动调用并执行相应 `apps/appName/main.js` 文件中的 `start` 方法作为应用程序的启动入口点。
#### 5.1.4 应用配置
- 每个应用的独立配置文件位于其 `config/` 目录中，并由 `index.js` 统一导出。
- 应用程序的配置将通过 `ncore/global_vars/tool/gconfig.js` 与主配置合并。
- 在应用程序代码中，应使用 `package.json` 中定义的别名 `#@gconfig` 来引用和访问合并后的配置。
#### 5.1.5 目录文件使用
- 静态文件目录默认使用项目根目录中的 `public` 文件夹，由 `#@global_dir`中导出。
- 系统将根据应用程序名称 (`appName`) 在 `public` 目录中自动创建一个专属区域。
- **大文件存储目录**（用于下载、媒体等大文件）：
  - `APP_LARGE_FILES_CACHE_DIR` - 大文件缓存目录
  - `APP_LARGE_FILES_TMP_DIR` - 大文件临时目录
- **运行时临时目录**（用于执行过程中的小临时文件）：
  - `APP_RUNTIME_CACHE_DIR` - 运行时缓存目录
  - `APP_RUNTIME_TMP_DIR` - 运行时临时目录
- 临时文件、debug、cache文件夹 优先引用全局预设，由 `#@global_dir`中导出，不必实际ensure Dir之类的功能，该功能则ncore实现
- 7z、curl、git 全局二进制文件路径 优先引用全局预设，由 `global_vars\global_dir\binary_dir.js`中导出。
### 5.2 ncore 引用规范

app 需要引用ncore中的功能实现逻辑，按以下优先级引用：

#### 5.2.1 文件操作
- `#@freader` → `./ncore/foundation/utilities/filetoollibs/freader.js`
- `#@fwriter` → `./ncore/foundation/utilities/filetoollibs/fwriter.js`
- `#@ftools` → `./ncore/foundation/utilities/filetool.js`

#### 5.2.2 日志与打印
- `#@logger` → `./ncore/foundation/common/logger.js`

#### 5.2.3 命令行与子进程
- `#@commander` → `./ncore/foundation/common/commander.js`

#### 5.2.4 配置文件
- `#@gconfig` → `./ncore/global_vars/tool/gconfig.js` (注意该文件为二次包装，包含了app中的config/index.js 文件)

#### 5.2.5 全局常量与变量
- `#@global_vars` → `./ncore/global_vars/index.js`
- `#@global_dir` → `./ncore/global_vars/global_dir/globaldir.js`
- `#@bdir` → `./ncore/global_vars/global_dir/globaldir.js`

#### 5.2.6 下载功能
- `#@downloader` → `./ncore/foundation/common/downloader.js`

#### 5.2.7 基础工具
- `#@btools` → `./ncore/foundation/utilities/index.js` (了解其中的全部功能，确保app中的所有代码优先引用其中的功能)

#### 5.2.8 别名引用
- `#@/*` → `./*`
- `#@ncore/*` → `./ncore/*`

#### 5.2.9 编码库
- 全局的编码库，请引用 `ncore\foundation\common\encoding.js`
### 5.3 ncore 使用规则
- app中引用ncore中的任何功能是，尽量避免二次封装
- ncore app 需要实现启动部署脚本（apps/{appname}/scripts/目录下的start.ps1、install.ps1、deploy.ps1、stop.ps1），因为统一管理系统需要通过explorer调用这些脚本来启动和管理应用，如果app有特殊的操作系统库需求，需要在install.ps1中完成相关依赖的安装

## 6. 目录使用规范

### 6.1 大文件存储目录
- **用途**: 存储下载的大文件、媒体文件、数据库备份等
- **目录**:
  - `APP_LARGE_FILES_CACHE_DIR` - 大文件缓存，适合存储需要长期保存的大文件
  - `APP_LARGE_FILES_TMP_DIR` - 大文件临时目录，适合存储临时的大文件
- **使用场景**: 文件下载、视频处理、数据库备份、日志归档等

### 6.2 运行时临时目录
- **用途**: 存储程序运行过程中的小临时文件
- **目录**:
  - `APP_RUNTIME_CACHE_DIR` - 运行时缓存，适合存储程序运行时的缓存数据
  - `APP_RUNTIME_TMP_DIR` - 运行时临时文件，适合存储程序执行过程中的临时文件
- **使用场景**: 会话数据、临时计算结果、进程间通信文件等

### 6.3 目录选择指南
- **大文件 (>10MB)**: 使用 `APP_LARGE_FILES_*` 目录
- **小文件 (<10MB)**: 使用 `APP_RUNTIME_*` 目录
- **需要长期保存**: 使用 `*_CACHE_DIR` 目录
- **临时使用**: 使用 `*_TMP_DIR` 目录
## 7. 开发流程与规范

### 7.1 开发流程文档
- 根据本文档的ncore目录和app目录的具体分工，输出一个开发流程文档到app目录中，主要用于分析ncore目录相于当开发要求中，是否有功能需要加入，以及怎么加入
- 分析ncore和app的代码分配细节，ncore是否有需要加强，app扩展了那些不必ncore处理的代码，每一个建议需要标明涉及文件，如果文件不存在则标建议创建文件名
- 不要写readme.md等其他未明确要求的任何文档

### 7.2 第三方包引用
- 如果一个功能需要引用第三方包，请确保该包支持最新node，或者最后更新日期在2年内，如果你无法确定，请遵守ncore/app的代码分配规则用原生的node实现一个
- 如果你确信并引用了一个第三方包，在README.md（注意是根目录中的readme，不是app目录中的） 中更新追加一个yarn add 命令，提示启动本项目前安装该包，并注明你引用该包的依据

### 7.3 别名引用及验证
- 确保所有优先使用别名，请查看package.json（注意是根目录，app目录不要这个文件），请不要随意猜想别名，确认每个别外都有效,对于没有明确定义的别名，使用通用的 `#@ncore/xxx/xxx.js` 直接连接到文件

## 8. 推荐的应用目录结构

### 8.1 目录结构原则
代码应完全使用英文，请遵循 APP 中代码量最小，主要用于组织参数和管制逻辑，功能在util中完整实现的原则。

### 8.2 目录结构示例
```
- main.js # 主入口文件。通过运行 `main.js app=your-app-name` 启动 `apps/your-app-name/main.js` 中的 `start` 函数，并引用 `ncore` 目录中的功能。

apps/
└── your-app-name/          # 请遵循 app中代码最少原则，所有功能全部在util中实现
    ├── main.js             # 应用程序主入口（必须包含一个 start 方法）
    ├── config/             # 应用程序特定配置目录
    │   └── index.js        # 配置文件导出
    ├── controller/         # 控制器（处理业务逻辑），可以服务 Web 应用程序或 CLI 应用程序，请遵循 app中代码最少原则，所有功能全部在util中实现
    ├── service/            # [非必要]服务层（封装核心功能）
    ├── routes/             # [非必要]如果有 HTTP Web 功能，推荐用于定义路由
    ├── model/              # 数据模型定义，引用 `foundation/db_utils` 中相应函数，仅在使用数据库时创建
    ├── middleware/         # [非必要]框架（如 Express）的中间件，仅在使用 HTTP Web 服务时创建
    ├── templates/          # [非必要]除非使用http服务，否则可以不创建
    ├── http/               # [非必要]如果有 HTTP Web 功能，推荐创建此目录
    │   └── index.js        # HTTP 功能入口，引用 `foundation/express_utils` 中相应函数
    └── ...                 # 其他功能目录
    (不能包含 package.json 文件，因为实际入口点是根目录中的 `main.js`)
    (不包含 Dockerfile)
```

### 8.3 全局 Express 的使用
- 如某个app或util需要使用web功能，引用 `foundation/express_utils` 中的实现，并可以扩展 `foundation/express_utils`

### 8.4 全局 DB 数据库的使用
- 如某个app或util需要使用db功能，引用 `foundation/db_utils` 中的实现，并可以扩展 `foundation/db_utils`.优先使用sqlite

## 9. APP 开发后检测清单

### 9.1 文件操作检测
确保文件操作都引用了：
- `#@freader` → `./ncore/foundation/utilities/filetoollibs/freader.js`
- `#@fwriter` → `./ncore/foundation/utilities/filetoollibs/fwriter.js`
- `#@ftools` → `./ncore/foundation/utilities/filetool.js`

### 9.2 日志与打印检测
确保打印和日志引用了：
- `#@logger` → `./ncore/foundation/common/logger.js`

### 9.3 命令行与子进程检测
确保命令行，子进程全部引用：
- `#@commander` → `./ncore/foundation/common/commander.js`

### 9.4 配置文件检测
确保配置文件引用#@gconfig的二次包装，注意该文件为二次包装，包含了app中的config/index.js 文件：
- `#@gconfig` → `./ncore/global_vars/tool/gconfig.js`

### 9.5 全局常量与变量检测
确保全局常量、变量优先引用：
- `#@global_vars` → `./ncore/global_vars/index.js`
- `#@global_dir` → `./ncore/global_vars/global_dir/globaldir.js`
- `#@bdir` → `./ncore/global_vars/global_dir/globaldir.js`

### 9.6 下载功能检测
确保下载功能引用：
- `#@downloader` → `./ncore/foundation/common/downloader.js`

### 9.7 基础工具检测
了解`#@btools` → `./ncore/foundation/utilities/index.js`中的全部功能，确保app中的所有代码优先引用其中的功能
### 9.8 别名引用检测
确保所有有别名的引用，使用了别名：
- `#@/*` → `./*`
- `#@ncore/*` → `./ncore/*`

### 9.9 综合规范检测清单
1. **入口文件策略**：是否遵守了规范中的app入口文件策略，特别注意app目录中不能有package.json文件，而以根目录的为主
2. **目录使用策略**：是否遵守了规范中的app静态文件目录、缓存目录、临时目录等使用策略
3. **代码语言**：代码是否全英文（除指定的提示文字，或者多国语言配置文件）
4. **开发流程文档**：是否详细分析了规范中的 `开发流程文档`
5. **开发测试规范**：是否遵守了规范中的app开发测试规范
6. **第三方包引用规则**：是否遵守了规范中的第三方包引用规则
7. **ncore使用规则**：是否遵守了规范中ncore使用规则
8. **全局编码库引用**：是否遵守了规范中全局编码库的引用
9. **别名规则**：是否遵守了规范中的别名规则，且所有别名有效
10. **启动部署脚本**：ncore app 需要实现启动部署脚本（apps/{appname}/scripts/目录下的start.ps1、install.ps1、deploy.ps1、stop.ps1），因为统一管理系统需要通过explorer调用这些脚本来启动和管理应用，如果app有特殊的操作系统库需求，需要在install.ps1中完成相关依赖的安装