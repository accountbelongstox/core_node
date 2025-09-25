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

## 1. 项目架构

### 1.1. Node基础服务框架 ，位于(`./ncore`)，基于node最新版，可以由`./apps`中的多信子文件夹作为不同的入口点，以实现不同的应用逻辑，均由`./ncore`提供信心功能。
### ncore 及 ./apps 的开发规范 参见`development-guides/NODE_NCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`。

### 1.2. 应用模块 (`apps` )
- **核心应用 (`apps`)**: `apps/` 目录下的应用是 `ncore` 的业务入口，通过根目录 `node ./main.js app=appName` 启动，会自动调用apps/appName/main.js中的start方法
。

### 1.2. 聚合应用 (`poly_apps`)
- **聚合应用 (`poly_apps`)**: `poly_apps/` 目录下的第三方应用（如 Laravel, Vue, Flutter）可与 `ncore` 交互或独立运行。

#### 1.2.1. Laravel后端特殊应用  (`./poly_apps/laravel_main`)
`poly_apps/laravel_main` 是基于 Laravel 的核心后端服务，采用多入口API为其他应用提供服务，详细开发指南见其 `./poly_apps/laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md` 文件。
#### 1.2.2. Flutter聚合特殊应用  (`./poly_apps/flutter_bloom`)
`poly_apps/flutter_bloom` 是基于 Flutter 的最新的用于本项目的聚合mibole/web客户端项目、将与其他项目进行交互，采用多入口，详细开发指南见其 `./poly_apps/flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md` 文件。
#### 1.2.3. Nuxt聚合特殊应用  (`./poly_apps/nuxt_main`)
`poly_apps/nuxt_main` 基于 nuxt 框架、是本项目的必要的web入口支持，详细开发指南见其 `./poly_apps/nuxt_main/development-guides/NUXT_POLYAPP_GUIDE_THIS_FILE_NO_AI_EDIT.md` 文件。
### MCP (AI-MCP service) 服务开发规范 `参见`development-guides/MCPSERVER_GUIDE_THIS_FILE_NO_AI_EDIT.md`

### 1.3. 系统环境支撑及预安装脚
- Windows基于根目录的 `dd.cmd` (Windows) 对本系统用到的node/java/php/docker等基础环境、应用软件、基本设置一键安装，扩展规范请参阅 `./development-guides/DD_POWERSHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`。
和 `dd.sh` (Linux) 脚本，用于
- Linux基于根目录的 `dd.sh` (Debian) 对本系统用到的基础环境、应用软件、基本设置一键安装(Linux的功能略复杂于Windows)，扩展规范请参阅 `./development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`。

### 1.4. 全局辅助脚本`./scripts/`
- 辅助脚本用于开发中的辅助脚本，
- 开发前请务必阅读 `./scripts/AUXILIARY_SCRIPTS_GUIDE_THIS_FILE_NO_AI_EDIT.md`。

## 2. 开发流程
- 所有`app` / `poly_apps` / `./ncore` / `./scripts` 等下在都有该对应版块的`development-guides`文档，如果没有、请报告.
- 当声明需要开发基于ncore的APP时，请查看对应的文档
- 当声明要要开发基于poly_apps中的app时，请查阅对应的文档
- 当声明要要联动开发时，请查阅对应的多个app或版块的文档文档
- Gemini ai 专用反馈文档 `development-guides\GEMINI_AI_FEEDBACK.md`

## 严格要求
- 开发中不要运行测试命令
- 开发中不要写未指定的文档，特别是readme.md
- 开发中不要写总结，以节省时间

## 项目特点总结
- Monorepo 架构: 将所有相关的应用和库都放在一个代码仓库中，便于统一管理、版本控制和代码共享。
- 框架驱动: 自研的 ncore 框架统一了开发模式和技术栈，保证了代码的一致性和可维护性。
- 低代码/零代码理念: 通过高度封装和配置驱动，让开发者能更专注于业务逻辑，而不是重复的基础设施建设。
- 多应用与多语言支持 (Polyglot): 能够在一个项目下同时开发和管理 Node.js、PHP、Python、Vue、Flutter
    等不同技术栈的应用，具备很强的灵活性和扩展性。
- 高度自动化: 强大的 dd 脚本和完善的开发指南，体现了项目对开发效率和自动化运维的重视。