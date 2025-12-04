# Laravel Web 面析 (app_ittools) 架构规划

## 应用概述
- **名称**: Laravel Web 面析
- **命名空间**: ittools
- **描述**: Laravel 开发调试和管理工具集合

## 主菜单结构（基于 debug_interface_template.html）

### 1. API Testing Dashboard (API 测试仪表板) 🚀
- API 请求构建器
- 请求历史记录
- 响应查看和格式化
- CSRF Token 管理

### 2. Development Tools (开发工具) 🛠️
- **IT Tools (子菜单 - 原 ittools 全部功能)**
  - 加密工具（Crypto）
  - 转换器（Converter）
  - 网络工具（Network）
  - 文本工具（Text）
  - 数学工具（Math）
  - Web 工具
  - 媒体工具
  - 开发工具
  - 测量工具
  - 数据工具

### 3. System Information (系统信息) 📊
- PHP 信息
- Laravel 配置信息
- 服务器环境信息
- 数据库信息

### 4. Vocabulary Learning (词汇学习) 📚
- 词汇列表管理
- 学习进度跟踪
- 词汇测试

### 5. Code Browser (代码浏览器) 💻
- 项目文件树
- 代码文件查看
- 语法高亮

### 6. Static Resources (静态资源) 🎬
- 图片资源浏览
- 媒体文件管理
- 静态文件预览

### 7. MCP Manager (MCP 管理器) 📸
- MCP 服务器配置
- MCP 状态监控
- MCP 工具管理

### 8. Octane Timer Tasks (Octane 定时任务) ⏱️
- 定时任务列表
- 任务执行日志
- 任务管理界面

## 组件复用策略

### 复用 Common 组件
- `AppShellSidebar` - 侧边栏布局 ✓
- `BaseButton` - 按钮组件 ✓
- `BaseModal` - 模态框组件 ✓
- `BasePanel` - 面板组件 ✓
- `DataTable` - 数据表格 ✓
- `StatCard` - 统计卡片 ✓

### 复用现有 app_ittools 组件
- `CategoryTreePanel` → 改造为侧边栏菜单
- `ToolWorkspace` → 改造为内容工作区
- `tools/*` → 保留为 Development Tools 子模块

## 目录结构规划

```
apps/app_ittools/
├── components_app_ittools/
│   ├── ittools_index/
│   │   └── ItToolsApp.vue                      # 主应用入口（新架构）
│   ├── ittools_index_components/
│   │   ├── AppSidebar.vue                      # 主侧边栏（新）
│   │   ├── AppHeader.vue                       # 顶部导航（新）
│   │   └── AppContentArea.vue                  # 内容区域（新）
│   ├── modules/                                 # 功能模块（新）
│   │   ├── api_testing/                        # API 测试模块
│   │   │   ├── ApiTestingDashboard.vue
│   │   │   ├── RequestBuilder.vue
│   │   │   └── ResponseViewer.vue
│   │   ├── dev_tools/                          # 开发工具模块
│   │   │   ├── DevToolsPanel.vue
│   │   │   └── ittools/                        # IT Tools 子模块
│   │   │       └── (原 tools/* 组件)
│   │   ├── system_info/                        # 系统信息模块
│   │   │   ├── SystemInfoPanel.vue
│   │   │   ├── PhpInfoCard.vue
│   │   │   └── LaravelInfoCard.vue
│   │   ├── vocabulary/                         # 词汇学习模块
│   │   ├── code_browser/                       # 代码浏览器模块
│   │   ├── static_resources/                   # 静态资源模块
│   │   ├── mcp_manager/                        # MCP 管理器模块
│   │   └── octane_tasks/                       # Octane 任务模块
│   └── tools/                                   # 保留原 IT Tools 组件
│       ├── crypto/
│       ├── converter/
│       ├── network/
│       └── ...
├── composables_app_ittools/
│   ├── useApiTesting.ts                        # API 测试 composable（新）
│   ├── useSystemInfo.ts                        # 系统信息 composable（新）
│   └── useITTools.ts                            # IT Tools composable（保留）
├── services_app_ittools/
│   ├── api-testing-api.ts                      # API 测试服务（新）
│   ├── system-info-api.ts                      # 系统信息服务（新）
│   └── ittools-api.ts                           # IT Tools 服务（保留）
├── stores_app_ittools/
│   ├── app-navigation-store.ts                 # 导航状态（新）
│   ├── api-testing-store.ts                    # API 测试状态（新）
│   └── ittools-store.ts                        # IT Tools 状态（保留）
└── types_app_ittools/
    ├── index.ts                                 # 全局类型
    ├── api-testing.ts                          # API 测试类型（新）
    └── ittools.ts                               # IT Tools 类型（保留，移动到此）
```

## 实现步骤

### Phase 1: 基础架构（当前）
1. ✅ 删除 pages/types 中的类型文件
2. ⏳ 创建新的主应用框架
3. ⏳ 创建侧边栏导航组件
4. ⏳ 创建内容区域路由系统

### Phase 2: 核心模块
1. 实现 API Testing Dashboard
2. 实现 System Information
3. 整合原 IT Tools 为 Development Tools 子模块

### Phase 3: 扩展模块
1. 实现 Code Browser
2. 实现 Static Resources
3. 实现 MCP Manager
4. 实现 Octane Timer Tasks
5. 实现 Vocabulary Learning

### Phase 4: 优化和完善
1. 添加多语言支持（i18n）
2. 添加主题定制
3. 性能优化
4. 测试和调试

## API 接口规划

### API Testing Module
- `POST /api/ittools/api-test/execute` - 执行 API 请求
- `GET /api/ittools/api-test/history` - 获取历史记录
- `GET /api/ittools/api-test/csrf` - 获取 CSRF Token

### System Information Module
- `GET /api/ittools/system/php-info` - PHP 信息
- `GET /api/ittools/system/laravel-info` - Laravel 信息
- `GET /api/ittools/system/server-info` - 服务器信息

### Code Browser Module
- `GET /api/ittools/code/tree` - 获取文件树
- `GET /api/ittools/code/file` - 读取文件内容

### MCP Manager Module
- `GET /api/ittools/mcp/servers` - MCP 服务器列表
- `POST /api/ittools/mcp/config` - 更新配置

### Octane Tasks Module
- `GET /api/ittools/octane/tasks` - 任务列表
- `POST /api/ittools/octane/task/execute` - 执行任务

## 关键设计原则
1. **最小化重复代码** - 充分复用 common 组件和现有代码
2. **模块化设计** - 每个功能模块独立，易于维护和扩展
3. **响应式布局** - 适配桌面和移动设备
4. **状态管理** - 使用 Pinia Store 管理应用状态
5. **类型安全** - 使用 TypeScript 确保类型安全
