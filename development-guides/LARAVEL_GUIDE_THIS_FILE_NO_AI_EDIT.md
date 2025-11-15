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

<!-- Project root is ../ -->
# Laravel 聚合应用 - 开发指南
This Markdown file is located in a subdirectory.  
The **laravel_main project root** is [here](`../poly_apps/laravel_main`).
本指南为 `laravel_main` 项目提供了核心的开发规则。

## 1. 核心原则

- **框架版本**: 本项目基于 **Laravel 12** 构建。为**纯无头 (Headless) API 模式**，只保留 API 功能（同时特别保留了一个`routes/web.php` 的web入口）、 但不能删除现有的web/vite/ts/bable等前端文件、因为laravel需要这些基础配置才能启动无头模式。
- **框架文档**: 如需查阅框架相关问题，请参考项目内的 `./laravel-12.x-doc` 目录。
- **开发规范**: 所有代码使用**英文**、开发过程中禁止运行测试命令，编写和创建未指定的文档.

## 2.1. 代码组织与规范

为确保代码可复用且易于查找，请严格遵循以下结构：

- **全局 Utils (`app/Utils`)**: 用于存放所有应用**共享**的工具函数和类。该目录与 `app/Apps` 目录平级。
- **全局 Helpers (`app/Helpers`)**: 用于存放简单的、全局共享的辅助函数。**未经充分考虑，禁止随意添加新的 Helper**。
- **全局 Providers (`app/Providers`)**: 此目录提供了一个全局的常量和重要变量库。在定义新常量之前，**必须**优先引用和检查这些 Providers 中是否已有相关配置。**路径映射统一使用 `App\Providers\PathMapper`，已合并 `DatabasePathHelper`、`ExternalStorageHelper`、`WebPathHelper` 的功能。**
- 请使用 `PathMapper::mapWebPath()`。


## 2.2. 多应用聚合结构

本代码库旨在同时支持多个应用。每个应用都在其专属的模块中进行隔离。

- **应用专属版本号**: `{Vx}` V为大写，x为版本号，初始创建一个app为1
- **应用命名规则**: `{appName}{Vx}` 表示为 `{appNameWithVersion}`
- **应用专属的Utils/Hepler命名**：为`{appNameWithVersion}Utils` 表示为 `{appNameWithVersionJoinUtils}`,Helper也是一样，均放置于`app/Apps/{appNameWithVersion}/{appNameWithVersionJoinUtils}`下，用于存放**仅**被单个应用 使用的工具类和函数,可以引用共公区的功能进行强化封装, 如果函数共用性较强，则放置于共公区。
- **应用专属控制器**: 特定应用（例如 `{appName}`）的所有控制器，**必须**放置在 `app/Apps/{appNameWithVersion}/{appNameWithVersion}FileNameCtl/` 目录下，为了保持文件包尽量包含过多信息同时又避免过长将`Controller`简写为`Ctl`作为文件后缀。请注意，这与 Laravel 标准的 `app/Http/Controllers` 目录不同，中间增加了一个 `Apps` 层级/且是`Ctl`结尾。
- **文件名携带信息原则**: 在任何专属appName控制器、命名空间上，都要在文件名上携带`{appNameWithVersion}`
- **应用全局变量**: 在优先引用全局的`app/Providers`之上，应用需要有一个`{appNameWithVersion}Gvar/xxx`，的全局变量目录，里边可以有多个文件组织变量，但不允许引用除顶层公共空间类之外的其他文件
- ApiInfo收集：每个app都要实现 :`ApiInfo`(收集APP专属api端点、参数), ApiInfo至少要收集该APP使用的supportedHeaders[推导该app支持的所有header 头部，比如验证字段等]、apis{path/feature:是否需要认证|请方式|参数列表|返返格式等} - 不需要返回别的字段，以防止总的json过长，所有api的特性都要显示在feature上，便于`router/web.php` 中相关功能的API WEB调试唯一入口解析。
 
## 4. 路由规则

- **路由结构**: 每个应用的路由都定义在 `routes/` 下的一个专属子文件夹中，格式为 `{appNameWithVersion}Router`。例如，`Billing` 应用的路由位于 `routes/BillingRouter/api.php`。
    - `Router` 后缀是为了明确指示 AI 这是一个路由目录，避免混淆。
- **路由加载**: 所有应用的路由文件最终都由主路由文件 `routes/api.php` 统一引入和加载。
- **禁止修改**: **禁止**修改或向 `routes/web.php`、`routes/console.php` 等非 API 路由文件追加任何内容。

## 5. 数据库规则

- **数据库位置**: 项目使用的数据库**位于项目代码目录之外**，使用`PathMapper::getLaravelDatabaseDir()`映射路径，以便于代码的迁移和部署。
- **默认共享数据库**: 默认数据库连接保留用于共享数据（如用户账号）。在`config/database.php`中配置默认连接，使用`PathMapper::getDefaultDatabasePath()`。
- **子应用独立数据库**: 每个子app在`config/database.php`中配置独立数据库连接，命名格式为`{appNameWithVersion}`。数据库路径使用`PathMapper::getLaravelDatabaseDir() . '/{appNameWithVersion}.sqlite'`（SQLite）或独立MySQL/PostgreSQL连接。每个子app至少实现一个账号数据库用于备份用户数据。
- **账号数据同步**: 用户注册/登录时，账号数据**必须同时写入默认数据库（共享）和对应子app数据库（备份）**。使用数据库事务确保数据一致性。
- **Model组织**: `app/Models`改为`app/Apps/{appNameWithVersion}/{appNameWithVersion}Models/`，命名`{appNameWithVersion}{CustomName}Model.php`。每个子app的Model使用`protected $connection = '{appNameWithVersion}';`指定独立数据库连接。
- **迁移文件处理**: 
    - **应用专属迁移文件**: 命名格式为`{appNameWithVersion}_xxxx_xx_xx_xxxxxx_*.php`，**必须**将`{appNameWithVersion}`放在文件名第一位。在迁移中使用`Schema::connection('{appNameWithVersion}')->create()`指定连接。运行迁移：`php artisan migrate --database={appNameWithVersion}`。
    - **全局共享表迁移文件**: 命名格式为`global_xxxx_xx_xx_xxxxxx_*.php`，**必须**将`global_`放在文件名第一位。全局共享表迁移使用默认连接（不需要指定connection），所有应用共享使用。
- **表名桥接**: 在`app/Apps/{appNameWithVersion}/{appNameWithVersion}TablesMaps/`中建立表名maps，引用`app/Providers/GlobalTablesMaps.php`获取公共表名。所有数据库操作直接引用TablesMaps类，禁止二次封装。

## 6. 公共与静态文件规则

- **存储路径**: 用于上传和存储静态文件的 `public` 目录也**位于项目代码目录之外**。
- **路径配置**: 这些站外路径需要在 PHP 配置中设置为允许访问，并需在框架的配置文件中进行额外声明。
- **优先使用**: 所有应用都应优先使用这些已配置的公共存储路径。

## 7. API 文档化规则

- **API 列表接口**: 每个应用 (`{appNameWithVersion}`) 都**必须**提供一个公共方法，用于输出该应用下所有可访问的 API 接口列表及其参数详情。
- **实时更新**: 当为应用添加一个新的、可公开访问的 API 接口后，**必须**立即更新这个用于展示 API 列表的公共接口，以确保文档的实时性。

## 8. 开发流程与限制

- **复用优先原则**: 
    1.  在实现新功能前，**必须**首先检查 `app/Utils` 目录，确认是否已有可用的功能。
    2.  如果不存在，需分析该功能是否可能被其他应用复用。如果是，则应将其添加到 `app/Utils` 中。
    3.  如果功能严格限定于单个应用，则应遵循命名规范，将其添加到 `app/Apps/{appNameWithVersion}/Utils/` 目录下。

## 10. MCP (Model Context Protocol) 应用规则

MCP 应用是特殊的子应用，用于通过 Model Context Protocol 向 AI 客户端提供工具、资源和提示。**MCP 应用必须作为标准应用放在 `app/Apps/{appNameWithVersion}/` 目录下**，因为 MCP 应用通常包含大量代码（工具、资源、提示、控制器、工具类等），需要完整的应用结构来组织代码。

MCP 应用遵循以下差异化规则：

- **应用位置要求**: **MCP 应用必须作为标准应用放在 `app/Apps/{appNameWithVersion}/` 目录下**，与其他应用（如 `AppQyV1`、`AwyV0` 等）平级。MCP 应用包含大量代码，必须遵循完整的标准应用结构。
- **标准应用结构**: MCP 应用必须包含以下标准应用结构：
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}Controllers/` - 应用专属控制器
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}ApiInfo.php` - API 信息收集
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}Gvar/` - 应用全局变量
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}Utils/` - 应用专属工具类（可选，用于 MCP 工具的业务逻辑封装）
    - `routes/{appNameWithVersion}Router/` - 应用路由
- **MCP Server 组织**: MCP Server 类必须放置在 `app/Mcp/Servers/` 目录下，命名格式为 `{appNameWithVersion}Server.php`（例如：`McpV1Server.php`）。Server 类继承 `Laravel\Mcp\Server` 基类。**注意**：虽然 Server 类放在 `app/Mcp/Servers/` 下，但这是 Laravel MCP 框架的要求，MCP 应用本身仍然是一个完整的应用。
- **MCP Tools 组织**: MCP Tools 必须放置在 `app/Mcp/Tools/` 目录下，命名格式为 `{appNameWithVersion}{ToolName}Tool.php`（例如：`McpV1ImageManipulationTool.php`）。Tool 类继承 `Laravel\Mcp\Server\Tool` 基类。**工具的业务逻辑可以封装在 `app/Apps/{appNameWithVersion}/{appNameWithVersion}Utils/` 中，工具类只负责 MCP 协议交互**。
- **MCP Resources 组织**: MCP Resources 必须放置在 `app/Mcp/Resources/` 目录下，命名格式为 `{appNameWithVersion}{ResourceName}Resource.php`。
- **MCP Prompts 组织**: MCP Prompts 必须放置在 `app/Mcp/Prompts/` 目录下，命名格式为 `{appNameWithVersion}{PromptName}Prompt.php`。

## 11. PHP 调用 Python (pycore) 规范

### 11.1 CallPycoreUtils 通用规范
- **位置**: `app/CallPycoreUtils/`
- **命名**: `Pycore{FeatureName}Util.php`
- **架构**: Laravel App → CallPycoreUtils → Python pycore/pyutils
- **执行**: 使用 `Process::run()` with PYTHONPATH 设置
- **通信**: JSON 格式输入输出
- **路径**: pycore 根目录从 laravel_main/app/CallPycoreUtils 向上4层
- **错误处理**: 返回包含 success/error/exit_code 的数组
- **日志**: 使用 `Log::info()`/`Log::error()` 记录调用详情
- **超时**: 根据功能特性设置合理超时时间（建议：快速查询30s，普通处理300s，批量处理600s）
- **返回格式**: 统一返回 Array 格式，至少包含 success 字段

## 9. 唯一web入口点调试
- 本项目保留了唯一web入口点  `routes/web.php`，其中仅有路由（1）：`/api_info` 显示一个JSON数据，基中将引用 `App\Http\EnvironmentApiInfo\Index` 并集中引用所有app的 `ApiInfo` 以及公共的 `app/Http/EnvironmentApiInfo/*` 收集信息，注意是由 `app/Http/EnvironmentApiInfo/Index.php` 收集( `routes/web.php` 文件不可修改),需要收集的内容为 `app/Http/EnvironmentApiInfo/*` 下的所有文件和每个app的`ApiInfo`。由web路由`/`返回这些信息，以便调试，除了公共信息，支持参数只选择性显示某个app的`ApiInfo`
- 本项目保留了唯一web入口点  `routes/web.php`，其中仅有路由：（2）`/` 显示一个功能完备的HTML页（请勿使用laravel -vue等功能开发，减少复杂度，特别本laravel不依赖node/pacakge.json），`/` 路由显示的HTML将引用`/api_info`的 public_info 和 `api_reference` 予以显示和调试。请增加对每个api的调试功能。需要有一个完备的选择/调试页面。
- `routes/web.php` 同时扩展 ` POST /api_params_cache/save` / `/api_params_cache/load` / `/api_params_cache/list` 用于api调试的数据交换

- **禁止行为**:
    - **禁止**编写或修改 `app/Console` 目录下的任何代码。
    - **禁止**创建或分发任何 Laravel 事件 (`app/Events`)。
    - **禁止**编写任何与 Laravel Web 前端相关的功能，包括 **Blade 模板、Vite 配置、CSS/JS 资源文件**等，但不能删除现有的vite/bable/web等前端配置和web文件，因为laravel需要这些基础才能正确启动无头模式，。
    - **禁止**向 `app/Helpers` 添加新的辅助函数，除非该函数是绝对必要且全局通用的。
    - **禁止**在没有授权的情况下删除文件。
