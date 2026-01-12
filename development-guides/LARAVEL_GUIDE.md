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
# Laravel Aggregated Application - Development Guide
This Markdown file is located in a subdirectory.  
The **laravel_main project root** is [here](`../poly_apps/laravel_main`).
This guide provides core development rules for the `laravel_main` project.

## 1. Core Principles

- **Framework Version**: This project is built on **Laravel 12**. It is a **pure headless API mode**, retaining only API functionality (while specifically retaining a `routes/web.php` web entry point). However, existing web/vite/ts/babel and other frontend files cannot be deleted, as Laravel needs these basic configurations to start in headless mode.
- **Framework Documentation**: For framework-related questions, please refer to the `./laravel-12.x-doc` directory in the project.
- **Development Standards**: All code uses **English**. Prohibited from running test commands during development, writing and creating unspecified documentation.
- **Localization System**: All UI text must use localization keys (e.g., `QyAppLocalizationKeys.xxx.tr(context)`), no hardcoded strings. Language switching is handled centrally in main entry (`main_common.dart`), using `Localizations.localeOf(context)` to establish dependencies. All pages automatically rebuild when language changes, no manual listeners needed.
- **Multi-endpoint Discovery**: API clients must probe configured base URLs directly (root path), treating any 2xx–4xx HTTP status as reachable for health checks. Endpoint discovery stops immediately after finding the first available endpoint and only retries on app restart, with a notification displayed after 10 seconds if no endpoint is available.
- **Server Port**: Laravel server runs on **port 9000** by default. All API endpoints should be accessed via `http://localhost:9000` or the configured server address with port 9000.
- **System Service Management**: Low-privilege users can restart any systemd service (including root services) via GET API: `/api/servermanager/v1/system/service/restart?service_name={name}` or restart by keyword: `/api/servermanager/v1/system/service/restart-by-keyword?keyword={keyword}` or by app name: `/api/servermanager/v1/system/service/restart-by-appname?app_name={poly_apps_name}`. All endpoints return detailed service status including existence, running state, and restart confirmation.

## 2.1. Code Organization and Standards

To ensure code reusability and easy discovery, please strictly follow the following structure:

- **Global Utils (`app/Utils`)**: Used to store all **shared** utility functions and classes for the application. This directory is at the same level as the `app/Apps` directory.
- **Global Helpers (`app/Helpers`)**: Used to store simple, globally shared helper functions. **Prohibited from arbitrarily adding new Helpers without careful consideration**.
- **Global Providers (`app/Providers`)**: This directory provides a global library of constants and important variables. Before defining new constants, **must** first reference and check whether related configurations already exist in these Providers. **Path mapping uniformly uses `App\Providers\PathMapper`, which has merged the functionality of `DatabasePathHelper`, `ExternalStorageHelper`, and `WebPathHelper`**.
- Please use `PathMapper::mapWebPath()`.

## 2.2. Multi-App Aggregation Structure

This codebase is designed to support multiple applications simultaneously. Each application is isolated in its dedicated module.

- **App-Specific Version Number**: `{Vx}` V is uppercase, x is the version number, initially create an app as 1
- **App Naming Convention**: `{appName}{Vx}` represented as `{appNameWithVersion}`
- **App-Specific Utils/Helper Naming**: `{appNameWithVersion}Utils` represented as `{appNameWithVersionJoinUtils}`, same for Helper, all placed under `app/Apps/{appNameWithVersion}/{appNameWithVersionJoinUtils}`, used to store utility classes and functions **only** used by a single application. Can reference common area functionality for enhanced encapsulation. If functions have strong reusability, place them in the common area.
- **App-Specific Controllers**: All controllers for a specific application (e.g., `{appName}`) **must** be placed in the `app/Apps/{appNameWithVersion}/{appNameWithVersion}FileNameCtl/` directory. To keep file packages from containing too much information while avoiding excessive length, `Controller` is abbreviated as `Ctl` as the file suffix. Note that this is different from Laravel's standard `app/Http/Controllers` directory, with an additional `Apps` level in between and ending with `Ctl`.
- **Filename Information Carrying Principle**: In any app-specific appName controllers and namespaces, the filename must carry `{appNameWithVersion}`
- **App Global Variables**: On top of prioritizing reference to global `app/Providers`, applications need a `{appNameWithVersion}Gvar/xxx` global variable directory, which can have multiple files organizing variables, but is not allowed to reference files other than top-level common space classes
- **ApiInfo Collection**: Each app must implement: `ApiInfo` (collect APP-specific API endpoints and parameters). ApiInfo must at least collect the supportedHeaders used by this APP [derive all header headers supported by this app, such as authentication fields, etc.], apis{path/feature: whether authentication is required|request method|parameter list|return format, etc.} - no need to return other fields to prevent the total JSON from being too long. All API features must be displayed in the feature field, facilitating parsing in the API WEB debugging unique entry point for related functions in `router/web.php`.
 
## 3. How to Create an APP

- **Visual Specification Collection**: Before creating a new `{appNameWithVersion}` application, all page visual drafts for that application must be organized first. Reference the approach in `poly_apps/flutter_bloom/lib/apps/app_wuy/doc/pageviews/`, use the `pageviews` directory to save page-by-page screenshots, and maintain `screenshots_catalog.md` or equivalent inventory, ensuring that filenames like "01_*.png" can correspond one-to-one with functional modules.
- **OCR + Mapping JSON**: For each page screenshot, OCR/visual parsing scripts need to be run (recommended to first generate `wuy_screenshots_composite.png` then split by single page), identify component positions, colors (primary/text/background colors), dimensions, alignment, and other information in the page, and generate a JSON mapping table. The JSON must at least include: `image_file`, `page_key`, `elements[]` (containing fields such as `type/text`, `bbox`, `color`, `notes`). This JSON is stored together with screenshots under `doc/pageviews/`, for example `pageviews/pageview_specs.json`.
- **Development Phase Comparison**: When implementing frontend/API, this JSON must be loaded and compared with the actual page effects during runtime to ensure UI/parameter consistency. Any deviations (color error > 2%, position offset > 4px, etc.) should be recorded in the App-specific changelog and referenced in PR with this JSON fragment as evidence.
- **Recommended Process**: `Capture screenshots → OCR/script generates JSON → Code implementation → Verify item by item through JSON`. If pages are updated, screenshots and JSON must be updated simultaneously to prevent subsequent development from referencing old parameters.

## 4. Routing Rules

- **Route Structure**: Each application's routes are defined in a dedicated subfolder under `routes/`, with the format `{appNameWithVersion}Router`. For example, the `Billing` application's routes are located in `routes/BillingRouter/api.php`.
    - The `Router` suffix is to clearly indicate to AI that this is a routing directory, avoiding confusion.
- **Route Loading**: All application route files are ultimately introduced and loaded by the main route file `routes/api.php` uniformly.
- **Prohibited Modifications**: **Prohibited** from modifying or appending any content to non-API route files such as `routes/web.php`, `routes/console.php`.

## 5. Database Rules

- **Database Location**: The database used by the project is **located outside the project code directory**, using `PathMapper::getLaravelDatabaseDir()` to map paths, facilitating code migration and deployment.
- **Default Shared Database**: The default database connection is reserved for shared data (such as user accounts). Configure the default connection in `config/database.php`, using `PathMapper::getDefaultDatabasePath()`.
- **Sub-App Independent Databases**: Each sub-app configures an independent database connection in `config/database.php`, with naming format `{appNameWithVersion}`. Database paths use `PathMapper::getLaravelDatabaseDir() . '/{appNameWithVersion}.sqlite'` (SQLite) or independent MySQL/PostgreSQL connections. Each sub-app must implement at least one account database for backing up user data.
- **Account Data Synchronization**: When users register/login, account data **must** be written to both the default database (shared) and the corresponding sub-app database (backup) simultaneously. Use database transactions to ensure data consistency.
- **Model Organization**: `app/Models` changed to `app/Apps/{appNameWithVersion}/{appNameWithVersion}Models/`, named `{appNameWithVersion}{CustomName}Model.php`. Each sub-app's Model uses `protected $connection = '{appNameWithVersion}';` to specify an independent database connection.
- **Migration File Handling**: 
    - **App-Specific Migration Files**: Naming format is `{appNameWithVersion}_xxxx_xx_xx_xxxxxx_*.php`, **must** place `{appNameWithVersion}` in the first position of the filename. In migrations, use `Schema::connection('{appNameWithVersion}')->create()` to specify the connection. Run migrations: `php artisan migrate --database={appNameWithVersion}`.
    - **Global Shared Table Migration Files**: Naming format is `global_xxxx_xx_xx_xxxxxx_*.php`, **must** place `global_` in the first position of the filename. Global shared table migrations use the default connection (no need to specify connection), shared by all applications.
- **Table Name Bridging**: Establish table name maps in `app/Apps/{appNameWithVersion}/{appNameWithVersion}TablesMaps/`, reference `app/Providers/GlobalTablesMaps.php` to get common table names. All database operations directly reference TablesMaps classes, prohibited from secondary encapsulation.

## 6. Public and Static File Rules

- **Storage Path**: The `public` directory used for uploading and storing static files is also **located outside the project code directory**.
- **Path Configuration**: These external paths need to be set in PHP configuration to allow access and need to be additionally declared in the framework's configuration files.
- **Priority Use**: All applications should prioritize using these configured public storage paths.

## 7. API Documentation Rules

- **API List Interface**: Each application (`{appNameWithVersion}`) **must** provide a public method for outputting a list of all accessible API interfaces under that application and their parameter details.
- **Real-Time Updates**: When adding a new, publicly accessible API interface to an application, **must** immediately update this public interface for displaying the API list to ensure documentation real-time.

## 8. Development Process and Restrictions

- **Reuse Priority Principle**:
    1.  Before implementing new functionality, **must** first check the `app/Utils` directory to confirm if available functionality already exists.
    2.  If it doesn't exist, analyze whether this functionality might be reused by other applications. If yes, it should be added to `app/Utils`.
    3.  If functionality is strictly limited to a single application, it should follow naming conventions and be added to the `app/Apps/{appNameWithVersion}/Utils/` directory.

## 9. File System Operations Standards

- **Required Classes**: Use `App\Utils\FileSystemManager` for all file/directory operations. Use `App\Utils\SystemUserDetector` to get actual logged-in user.
- **Auto Permission Fix**: FileSystemManager automatically fixes ownership to actual user (detected via /home scan on desktop systems) after all operations.
- **External Path Mapping**: Paths outside storage/ are auto-mapped to storage/external/ with symlinks (Swoole sandbox workaround).
- **Prohibited Native Functions**: Do not use `file_put_contents()`, `file_get_contents()`, `mkdir()`, `copy()`, `rename()`, `scandir()`, etc. directly. Use FileSystemManager methods instead.
- **Required Methods**: `FileSystemManager::writeFile()`, `::readFile()`, `::mkdir()`, `::ensureDirectoryExists()`, `::copy()`, `::rename()`, `::scandir()`, `::exists()`, `::isFile()`, `::isDir()`, `::fixPermissions()`, `::fixPermissionsRecursive()`.

## 10. MCP (Model Context Protocol) Application Rules

MCP applications are special sub-applications used to provide tools, resources, and prompts to AI clients through the Model Context Protocol. **MCP applications must be placed as standard applications in the `app/Apps/{appNameWithVersion}/` directory**, because MCP applications typically contain a large amount of code (tools, resources, prompts, controllers, utility classes, etc.), requiring a complete application structure to organize code.

MCP applications follow these differentiated rules:

- **Application Location Requirement**: **MCP applications must be placed as standard applications in the `app/Apps/{appNameWithVersion}/` directory**, at the same level as other applications (such as `AppQyV1`, `AwyV0`, etc.). MCP applications contain a large amount of code and must follow a complete standard application structure.
- **Standard Application Structure**: MCP applications must include the following standard application structure:
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}Controllers/` - App-specific controllers
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}ApiInfo.php` - API information collection
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}Gvar/` - App global variables
    - `app/Apps/{appNameWithVersion}/{appNameWithVersion}Utils/` - App-specific utility classes (optional, for MCP tool business logic encapsulation)
    - `routes/{appNameWithVersion}Router/` - App routes
- **MCP Server Organization**: MCP Server classes must be placed in the `app/Mcp/Servers/` directory, with naming format `{appNameWithVersion}Server.php` (e.g.: `McpV1Server.php`). Server classes extend the `Laravel\Mcp\Server` base class. **Note**: Although Server classes are placed under `app/Mcp/Servers/`, this is a Laravel MCP framework requirement. The MCP application itself is still a complete application.
- **MCP Tools Organization**: MCP Tools must be placed in the `app/Mcp/Tools/` directory, with naming format `{appNameWithVersion}{ToolName}Tool.php` (e.g.: `McpV1ImageManipulationTool.php`). Tool classes extend the `Laravel\Mcp\Server\Tool` base class. **Tool business logic can be encapsulated in `app/Apps/{appNameWithVersion}/{appNameWithVersion}Utils/`, tool classes are only responsible for MCP protocol interaction**.
- **MCP Resources Organization**: MCP Resources must be placed in the `app/Mcp/Resources/` directory, with naming format `{appNameWithVersion}{ResourceName}Resource.php`.
- **MCP Prompts Organization**: MCP Prompts must be placed in the `app/Mcp/Prompts/` directory, with naming format `{appNameWithVersion}{PromptName}Prompt.php`.

## 12. PHP Calling Python (pycore) Standards

### 12.1 CallPycoreUtils General Standards
- **Location**: `app/CallPycoreUtils/`
- **Naming**: `Pycore{FeatureName}Util.php`
- **Architecture**: Laravel App → CallPycoreUtils → Python pycore/pyutils
- **Execution**: Use `Process::run()` with PYTHONPATH setting
- **Communication**: JSON format input/output
- **Path**: pycore root directory is 4 levels up from laravel_main/app/CallPycoreUtils
- **Error Handling**: Return array containing success/error/exit_code
- **Logging**: Use `Log::info()`/`Log::error()` to record call details
- **Timeout**: Set reasonable timeout based on feature characteristics (recommended: fast queries 30s, normal processing 300s, batch processing 600s)
- **Return Format**: Uniformly return Array format, must at least include success field

## 11. Unique Web Entry Point Debugging
- This project retains a unique web entry point `routes/web.php`, which only has route (1): `/api_info` displays a JSON data, which will reference `App\Http\EnvironmentApiInfo\Index` and centrally reference all apps' `ApiInfo` as well as common `app/Http/EnvironmentApiInfo/*` collection information. Note that it is collected by `app/Http/EnvironmentApiInfo/Index.php` (the `routes/web.php` file cannot be modified). The content to be collected is all files under `app/Http/EnvironmentApiInfo/*` and each app's `ApiInfo`. Return this information via web route `/` for debugging. In addition to public information, supports parameters to selectively display a specific app's `ApiInfo`
- This project retains a unique web entry point `routes/web.php`, which only has route: (2) `/` displays a fully functional HTML page (please do not use Laravel -vue and other functions for development, reduce complexity, especially this Laravel does not depend on node/package.json). The HTML displayed by the `/` route will reference `/api_info`'s public_info and `api_reference` for display and debugging. Please add debugging functionality for each API. Need a complete selection/debugging page.
- `routes/web.php` also extends `POST /api_params_cache/save` / `/api_params_cache/load` / `/api_params_cache/list` for API debugging data exchange
- `routes/web.php` serves debug assets via `/debug-assets/css/{file}` and `/debug-assets/js/{file}` for modular HTML template. The debug interface uses multi-file architecture with external CSS/JS imports from `app/Http/EnvironmentApiInfo/assets/`.

- **Prohibited Behaviors**:
    - **Prohibited** from writing or modifying any code under the `app/Console` directory.
    - **Prohibited** from creating or distributing any Laravel events (`app/Events`).
    - **Prohibited** from writing any functionality related to Laravel Web frontend, including **Blade templates, Vite configuration, CSS/JS resource files**, etc. However, existing vite/babel/web and other frontend configurations and web files cannot be deleted, because Laravel needs these basics to correctly start in headless mode.
    - **Prohibited** from adding new helper functions to `app/Helpers`, unless the function is absolutely necessary and globally common.
    - **Prohibited** from deleting files without authorization.

## API Response Standards (MANDATORY for ALL Controllers)

**All backend controllers MUST use standardized response format:**
1. Use `App\Traits\ApiResponse` trait in all controllers
2. Use `App\Helpers\AuthHelper` for authentication checks
3. NO try-catch blocks - trust framework validation and database operations
4. Response methods: `success()`, `error()`, `unauthorized()`, `forbidden()`, `notFound()`
5. Authentication pattern: `$user = AuthHelper::requireAdmin($request); if (!$user) return $this->forbidden();`
6. NO duplicate response()->json() blocks - always use trait methods
7. Example: `return $this->success($data, 'Success message');`
8. All child apps and modules MUST follow this standard
9. **Frontend MUST use Data Models** - Create TypeScript models (e.g., `ServerManagerModel`) that handle all API calls, validation, and state management; components should NEVER directly call APIs or handle response validation - models encapsulate ALL business logic and return typed results
10. **ServerManager Auto-Detect** - Use `POST /api/server-manager/restart` to auto-restart current Laravel service (localhost only, no service name needed, auto-detects via `ServerManagerV1OctaneServiceManager::getCurrentOctaneServiceName()`). Automatically clears config/route/cache before restart
11. **Error Messages MUST Be Specific** - ALL error messages MUST state the exact reason (e.g., "Email already exists" NOT "Registration failed"). Generic messages like "Registration failed. Please check the logs" are PROHIBITED - always return the actual error from the exception or validation failure

## SSO External Integration

**CORS Setup**: SSO provider adds `CORS_ALLOWED_ORIGINS=https://external-site1.com,https://external-site2.com` to `.env`. **Get Auth URL**: `POST https://sso-provider.com/sso/authorize` with body `{redirect_uri: 'https://your-site.com/callback', organization_id?, provider?: 'authkit'}` returns `{success: true, data: {url, state}}`. **Redirect**: Send user to `data.url`. **Callback**: Your callback receives `?code=xxx&state=xxx`, verify state, then call `GET https://sso-provider.com/sso/user` with `credentials: 'include'` to get `{success: true, data: {user: {id, email, avatar, name, nickname, username}, token?}}`. **Iframe**: `<iframe src="https://sso-provider.com/sso" allow="camera; microphone"></iframe>`. **Logout**: `POST https://sso-provider.com/sso/logout` with `credentials: 'include'`. **Required**: All requests must include `credentials: 'include'` (fetch) or `withCredentials: true` (axios). **Response Format**: All APIs return `{success: boolean, data: any, message: string}`.