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
The **laravel_main project root** is [here](../).
本指南为 `laravel_main` 项目提供了核心的开发规则。`laravel_main` Project root is the parent directory of this file (`../`).。

## 1. 核心原则

- **框架版本**: 本项目基于 **Laravel 12** 构建。为**纯无头 (Headless) API 模式**，只保留 API 功能（同时特别保留了一个`routes/web.php` 的web入口）、 但不能删除现有的web/vite/ts/bable等前端文件、因为laravel需要这些基础配置才能启动无头模式。
- **框架文档**: 如需查阅框架相关问题，请参考项目内的 `./laravel-12.x-doc` 目录。
- **开发规范**: 所有代码使用**英文**、开发过程中禁止运行测试命令，编写和创建未指定的文档.

## 2.1. 代码组织与规范

为确保代码可复用且易于查找，请严格遵循以下结构：

- **全局 Utils (`app/Utils`)**: 用于存放所有应用**共享**的工具函数和类。该目录与 `app/Apps` 目录平级。
- **全局 Helpers (`app/Helpers`)**: 用于存放简单的、全局共享的辅助函数。**未经充分考虑，禁止随意添加新的 Helper**。
- **全局 Providers (`app/Providers`)**: 此目录提供了一个全局的常量和重要变量库。在定义新常量之前，**必须**优先引用和检查这些 Providers 中是否已有相关配置。


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

- **数据库位置**: 项目使用的数据库**位于项目代码目录之外**，以便于代码的迁移和部署。
- **共享数据库**: 所有应用**共同使用同一个数据库**,同时`app/Models`中需要修改为重新放到`app/Apps/{appNameWithVersion}/{appNameWithVersion}Models` 的子目录存入APP专属的Model,不再使用laravel的原目录，同时命名规范为`{appNameWithVersion}{CustomName}Model.php`命名规则，并修正引用。
- **应用数据库表名桥接**： 
    扫描 `database\migrations` 然后更新 `app/Providers/GlobalTablesMaps.php`，在`app/Apps/{appNameWithVersion}/{appNameWithVersion}TablesMaps/` 中建立数据表名的maps格，并提供以下的map
    ```
     {
        tableName1_Key => {
            tablename = '{本规范中的表名}',
            fields => [
                filedName1_key=> 'field name'
                ]
        ...不要重复定义公共表（所有APP都会使用的表，比如User），如果要统一管理可以从中·app/Providers/GlobalTablesMap.php·引入 公共表名，这样APP使用表Maps只需要该类即可完成.
        }
    ``` 
    根据以上的map类，然后在使用数据库的任何地方:包含 `poly_apps\laravel_main\database\migrations` 和 `app/Apps/...` / `app/Models`下都引用上面的类获取Key或FieldKey,注意所有需要用的文件都直接引用`TablesMaps`类-禁止二次封装类,后结更新表名的时候需要更新桥接配置文件中的字符串..
- **迁移文件命名**: 迁移文件名必须以应用名称作为前缀。格式：`xxxx_xx_xx_xxxxxx_create_appNameWithVersion_xxx_table.php`。
- **全局共享表**: 迁移文件名必须以 `global` 作为前缀。例如：`xxxx_xx_xx_xxxxxx_create_global_users_table.php`。
- **表前缀**: 在迁移文件中，为应用专属的数据表名增加 `{appNameWithVersion}_` 前缀。共享数据表（如 `users`）则不加前缀。

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

## 9. 唯一web入口点调试
- 本项目保留了唯一web入口点  `routes/web.php`，其中仅有路由（1）：`/api_info` 显示一个JSON数据，基中将引用 `App\Http\EnvironmentApiInfo\Index` 并集中引用所有app的 `ApiInfo` 以及公共的 `app/Http/EnvironmentApiInfo/*` 收集信息，注意是由 `app/Http/EnvironmentApiInfo/Index.php` 收集( `routes/web.php` 文件不可修改),需要收集的内容为 `app/Http/EnvironmentApiInfo/*` 下的所有文件和每个app的`ApiInfo`。由web路由`/`返回这些信息，以便调试，除了公共信息，支持参数只选择性显示某个app的`ApiInfo`
- 本项目保留了唯一web入口点  `routes/web.php`，其中仅有路由：（2）`/` 显示一个功能完备的HTML页（请勿使用laravel -vue等功能开发，减少复杂度，特别本laravel不依赖node/pacakge.json），`/` 路由显示的HTML将引用`/api_info`的 public_info 和 `api_reference` 予以显示和调试。请增加对每个api的调试功能。需要有一个完备的选择/调试页面。
- `routes/web.php` 同时扩展 ` POST /api_params_cache/save` / `/api_params_cache/load` / `/api_params_cache/list` 用于api调试的数据交换

- **禁止行为**:
    - **禁止**运行任何 `artisan test` 测试命令。
    - **禁止**编写或修改 `app/Console` 目录下的任何代码。
    - **禁止**创建或分发任何 Laravel 事件 (`app/Events`)。
    - **禁止**编写任何与 Laravel Web 前端相关的功能，包括 **Blade 模板、Vite 配置、CSS/JS 资源文件**等，但不能删除现有的vite/bable/web等前端配置和web文件，因为laravel需要这些基础才能正确启动无头模式，。
    - **禁止**向 `app/Helpers` 添加新的辅助函数，除非该函数是绝对必要且全局通用的。
    - **禁止**在没有授权的情况下删除文件。

# 开发合规性检查清单

在每次开发任务结束后，请使用本清单逐一核对 AI 的操作，以确保其严格遵守项目开发规范。
在检测前，你应该先再次阅读一下文档，了解最新规范内容.
---

1.  是否遵守了**核心原则**中的规定，确保所有新增的代码、注释和变量名都使用了**英文**？
2.  是否遵守了**核心原则**中的规定，确保项目保持在**纯无头 (Headless) API 模式**，没有添加任何 Blade 模板或 Vite 前端相关代码？
3.  是否遵守了**代码组织规范**，在编写新功能前，已首先检查 `app/Utils` 目录以寻找可复用的全局功能？
4.  是否遵守了**代码组织规范**，将确实需要被多个应用共享的新功能正确地放入了 `app/Utils` 目录？
5.  是否遵守了**代码组织规范**中的 专属Utils/Helpers 等 **命名规范**？
6.  是否遵守了**代码组织规范**中的 专属控制器 **命名规范**？
7.  是否遵守了**代码组织规范**，在定义新的全局常量或重要变量前，已首先检查 `app/Providers` 以避免重复定义？
8.  是否遵守了**代码组织规范**，将 `{appNameWithVersion}` 的控制器放在了 `app/Apps/{appNameWithVersion}/Controllers/` 目录下？
9.  是否遵守了**路由规则**，将 `{appNameWithVersion}` 的新 API 路由定义在了 `routes/{appNameWithVersion}Router/` 子目录中？
10. 是否遵守了**路由规则**，确保了新的路由已被主路由文件 `routes/api.php` 正确引入？
11. 是否遵守了**数据库规则**，在创建数据库迁移时，为应用专属的表 (`{appNameWithVersion}_xxx`) 和全局表 (`global_xxx`) 正确地添加了文件名前缀？
12. 是否遵守了**数据库规则**，在迁移文件中，为应用专属的数据表名正确地添加了 `{appNameWithVersion}_` 前缀？
13. 是否遵守了**API 文档化规则**，在添加或修改了一个公开 API 后，同步更新了该应用用于展示其所有 API 列表的那个公共接口？
14. 是否遵守了**禁止行为**规定，没有运行 `artisan test` 命令？
15. 是否遵守了**禁止行为**规定，没有编写或修改 `app/Console` 目录下的任何代码？
16. 是否遵守了**禁止行为**规定，没有创建或分发任何 Laravel 事件？
17. 是否遵守了**禁止行为**规定，没有向 `app/Helpers` 目录添加新的辅助函数？
18. 是否遵守了**禁止行为**规定，没有修改 `routes/web.php` 或 `routes/console.php` 文件？
19. 是否遵守了**禁止行为**规定，未经提定删除文件？
20. 是否遵守了**数据库名桥接规则**，中的数据表、字段桥接使用规则,且没有对任何`TablesMaps`类进行二次封装？
21. 是否遵守了**应用命名规则**，以及**应用控制器命名规则**？
22. 是否遵守了**共享数据库**，中的Models个性放置/命名规则，以及更新了全局的引用？。
23. 是否检查共公**Utils**区，所有应用专属Utils都到了应用目录下，并按命名规范重新放置？。

### 以上检测完后，输出一份./ComplianceAnalysisCheck.md 详细清单日
