# Native UI + RPC v2 架构流程图

## 1. 整合后完整启动流程

```mermaid
flowchart TD
    Start([应用启动]) --> Config[创建 NativeUIConfig]
    Config --> Launch[launch_native_app]

    Launch --> P1[Phase 1: 端口分配]
    P1 --> P2[Phase 2: URL 处理]
    P2 --> P3[Phase 3: 回调管理器]
    P3 --> P45[Phase 4.5: Timer Manager]
    P45 --> P46{Phase 4.6: Frontend 启用?}

    P46 -->|是| FE_Start[启动 Frontend Thread]
    P46 -->|否| P47

    FE_Start --> FE_Mode{前端模式}
    FE_Mode -->|生产模式| FE_Prod[检查编译输出]
    FE_Mode -->|开发模式| FE_Dev[启动 dev server]

    FE_Prod --> FE_Prod_Check{输出存在?}
    FE_Prod_Check -->|否| FE_Compile[阻塞编译]
    FE_Prod_Check -->|是| FE_Prod_Mount[准备 static_mount]
    FE_Compile --> FE_Prod_Mount

    FE_Dev --> FE_Dev_Install[自动 pnpm install]
    FE_Dev_Install --> FE_Dev_Run[自动 npm run dev]
    FE_Dev_Run --> FE_Dev_Wait[等待端口 ready]
    FE_Dev_Wait --> P47

    FE_Prod_Mount --> P47{Phase 4.7: RPC v2 启用?}

    P47 -->|是| RPC_Start[启动 RPC v2 Service]
    P47 -->|否| P5[Phase 5: Singleton 检测]

    RPC_Start --> RPC_Mount{自动挂载前端?}
    RPC_Mount -->|是| RPC_Get[获取 static_mount]
    RPC_Mount -->|否| RPC_NoMount[不挂载静态文件]

    RPC_Get --> RPC_Config[构建 RPC v2 配置]
    RPC_NoMount --> RPC_Config

    RPC_Config --> RPC_Launch[ServiceLauncher.start]
    RPC_Launch --> RPC_FastAPI[FastAPIRPCServer]

    RPC_FastAPI --> RPC_Routers[挂载 API Routers]
    RPC_Routers --> RPC_Static{有 static_mounts?}
    RPC_Static -->|是| RPC_Mount_Static[app.mount StaticFiles]
    RPC_Static -->|否| P5
    RPC_Mount_Static --> P5

    P5 --> P5_Check{已有实例?}
    P5_Check -->|是| P5_Exit[退出]
    P5_Check -->|否| P6[Phase 6: 启动窗口]

    P6 --> P6_Check{显示调试窗口?}
    P6_Check -->|是| P6_Debug[启动 Tkinter 调试窗口]
    P6_Check -->|否| P7[Phase 7: 主 UI]

    P6_Debug --> P7
    P7 --> P7_UI[创建 PySide6 WebView]
    P7_UI --> P7_Wire[连接回调到 CallbackManager]
    P7_Wire --> P7_Run[QApplication.exec]
    P7_Run --> End([应用运行中])

    P5_Exit --> Exit([退出])

    style FE_Start fill:#e1f5ff
    style RPC_Start fill:#fff4e1
    style P7_UI fill:#f0f0f0
```

## 2. 信息流：静态文件挂载协调

```mermaid
sequenceDiagram
    participant App as 应用层 (matrix_main.py)
    participant Native as native_ui.launch_native_app
    participant Frontend as FrontendLauncherThread
    participant RPC as _start_rpc_v2_service
    participant Launcher as ServiceLauncher
    participant FastAPI as FastAPIRPCServer

    App->>Native: launch_native_app(config)
    activate Native

    Native->>Native: Phase 4.6: Start Frontend
    Native->>Frontend: FrontendLauncherThread.start()
    activate Frontend

    alt 生产模式
        Frontend->>Frontend: 检查 .output/public/
        alt 不存在
            Frontend->>Frontend: 阻塞编译 Nuxt
        end
        Frontend->>Frontend: _static_dir = .output/public/
    else 开发模式
        Frontend->>Frontend: 启动 npm run dev
        Frontend->>Frontend: 等待端口 ready
    end

    deactivate Frontend

    Native->>Native: Phase 4.7: Start RPC v2
    Native->>RPC: _start_rpc_v2_service(config, frontend_thread)
    activate RPC

    RPC->>Frontend: frontend_thread.get_static_mount()
    Frontend-->>RPC: {'url_prefix': '/', 'directory': '...', 'name': 'frontend'}

    RPC->>RPC: 构建 static_mounts = [frontend_static_mount]
    RPC->>RPC: 构建 LauncherConfig
    Note over RPC: services['rpc_v2'] = {<br/>  'fastapi_routers': [...],<br/>  'static_mounts': [...]<br/>}

    RPC->>Launcher: ServiceLauncher.start()
    activate Launcher

    Launcher->>FastAPI: SERVICE_STARTERS['rpc_v2'](config)
    activate FastAPI

    FastAPI->>FastAPI: for router in fastapi_routers:<br/>  app.include_router(router)

    FastAPI->>FastAPI: for mount in static_mounts:<br/>  app.mount(prefix, StaticFiles)

    FastAPI-->>Launcher: RPC v2 实例
    deactivate FastAPI

    Launcher-->>RPC: ServiceLauncher 实例
    deactivate Launcher

    RPC-->>Native: RPC v2 服务实例
    deactivate RPC

    Native->>Native: Phase 7: Create PySide6 UI
    Native->>App: 应用运行
    deactivate Native
```

## 3. 数据流：配置到服务

```mermaid
graph LR
    subgraph "应用层"
        A1[NativeUIConfig] --> A2{配置项}
        A2 --> A3[frontend_*]
        A2 --> A4[rpc_*]
        A2 --> A5[window_*]
    end

    subgraph "native_ui 内部"
        A3 --> B1[FrontendConfig]
        B1 --> B2[FrontendLauncherThread]
        B2 --> B3{模式}
        B3 -->|生产| B4[编译 + static_mount]
        B3 -->|开发| B5[dev server + URL]

        A4 --> C1[RPC v2 Config]
        B4 --> C1
        C1 --> C2[LauncherConfig]
        C2 --> C3[ServiceLauncher]
        C3 --> C4[FastAPIRPCServer]

        A5 --> D1[PySide6UIConfig]
        B5 --> D1
        C4 --> D1
        D1 --> D2[PySide6Framework]
    end

    subgraph "最终输出"
        C4 --> E1[HTTP API]
        C4 --> E2[WebSocket API]
        C4 --> E3[静态文件服务]
        D2 --> E4[WebView 窗口]
    end

    style A1 fill:#e1f5ff
    style C4 fill:#fff4e1
    style D2 fill:#f0f0f0
```

## 4. 架构层次对比

### 4.1 整合前架构（当前）

```mermaid
graph TB
    subgraph "应用层 (pyapps/matrix)"
        A1[matrix_main.py] --> A2[frontend_compiler.py]
        A1 --> A3[launcher_builder.py]
        A1 --> A4[event_handlers.py]

        A2 -.-> A21[frontend_launcher.NuxtLauncher]
        A3 -.-> A31[导入 API routers]
        A3 -.-> A32[构建 LauncherConfig]
        A3 -.-> A21
    end

    subgraph "框架层 (pycore)"
        B1[pylauncher.ServiceLauncher]
        B2[pythreadpool.SERVICE_STARTERS]
        B3[rpc_v2.FastAPIRPCServer]

        A32 --> B1
        B1 --> B2
        B2 --> B3
    end

    subgraph "服务层"
        C1[FastAPI App]
        C2[Uvicorn Server]

        B3 --> C1
        C1 --> C2
    end

    style A1 fill:#ffcccc
    style A2 fill:#ffcccc
    style A3 fill:#ffcccc
```

### 4.2 整合后架构（目标）

```mermaid
graph TB
    subgraph "应用层 (pyapps/matrix)"
        A1[matrix_main.py<br/>简化版] -.-> A11[NativeUIConfig]
        A1 --> A2[event_handlers.py]
    end

    subgraph "native_ui 框架层"
        B1[launch_native_app] --> B2[Phase 4.6: Frontend]
        B1 --> B3[Phase 4.7: RPC v2]
        B1 --> B4[Phase 7: PySide6 UI]

        B2 --> B21[FrontendLauncherThread]
        B21 -.-> B22[frontend_launcher]

        B3 --> B31[_start_rpc_v2_service]
        B31 -.-> B32[ServiceLauncher]
        B31 -.-> B33[FastAPIRPCServer]
    end

    subgraph "服务层"
        C1[FastAPI App]
        C2[Uvicorn Server]
        C3[PySide6 QApplication]

        B33 --> C1
        C1 --> C2
        B4 --> C3
    end

    A11 --> B1

    style A1 fill:#ccffcc
    style B1 fill:#e1f5ff
```

## 5. 三种模式的架构差异

```mermaid
graph TB
    subgraph "模式 1: 生产模式 (推荐)"
        P1_Config[NativeUIConfig<br/>frontend_mode=production<br/>rpc_enabled=true]
        P1_Frontend[前端编译<br/>.output/public/]
        P1_RPC[RPC v2<br/>挂载静态文件]
        P1_UI[PySide6 UI<br/>http://localhost:8000]

        P1_Config --> P1_Frontend
        P1_Frontend --> P1_RPC
        P1_RPC --> P1_UI
    end

    subgraph "模式 2: 开发模式"
        P2_Config[NativeUIConfig<br/>frontend_mode=dev<br/>rpc_enabled=true]
        P2_Frontend[前端 dev server<br/>npm run dev]
        P2_RPC[RPC v2<br/>仅 API]
        P2_UI[PySide6 UI<br/>http://localhost:3000]

        P2_Config --> P2_Frontend
        P2_Config --> P2_RPC
        P2_Frontend --> P2_UI
    end

    subgraph "模式 3: 仅 RPC"
        P3_Config[NativeUIConfig<br/>frontend_enabled=false<br/>rpc_enabled=true]
        P3_RPC[RPC v2<br/>仅 API]
        P3_Note[无 UI 窗口<br/>后台服务]

        P3_Config --> P3_RPC
        P3_RPC --> P3_Note
    end

    style P1_Config fill:#ccffcc
    style P2_Config fill:#ffffcc
    style P3_Config fill:#ffcccc
```

## 6. 组件依赖关系

```mermaid
graph LR
    subgraph "pycore.pyutils.native_ui"
        N1[step1_config<br/>app_config.py]
        N2[step3_launcher<br/>launch_native_app.py]
        N3[step9_frontend<br/>frontend_thread.py]
        N4[step5_main_ui<br/>pyside6/]
        N5[step7_managers<br/>callback_manager.py]

        N2 --> N1
        N2 --> N3
        N2 --> N4
        N2 --> N5
    end

    subgraph "pycore.pylauncher"
        L1[launcher.py<br/>ServiceLauncher]
        L2[singleton_detector.py]

        N2 -.-> L1
        N2 --> L2
    end

    subgraph "pycore.pythreadpool"
        T1[starters.py<br/>SERVICE_STARTERS]
        T2[registry.py]

        L1 --> T1
        T1 --> T2
    end

    subgraph "pycore.pyutils.rpc_v2"
        R1[server/fastapi_server.py]
        R2[config.py]

        T1 --> R1
        R1 --> R2
    end

    subgraph "pycore.pyutils.frontend_launcher"
        F1[nuxt_launcher.py]
        F2[universal_launcher.py]

        N3 --> F1
        F1 --> F2
    end

    style N2 fill:#e1f5ff
    style L1 fill:#fff4e1
    style R1 fill:#ffe1e1
```

## 7. 时序图：完整生命周期

```mermaid
sequenceDiagram
    participant User
    participant Main as matrix_main.py
    participant Native as launch_native_app
    participant FE as FrontendThread
    participant RPC as RPC v2 Service
    participant UI as PySide6 UI
    participant CB as CallbackManager

    User->>Main: python pymain.py app=matrix
    Main->>Main: 创建 NativeUIConfig
    Main->>Native: launch_native_app(config)

    activate Native
    Native->>Native: Phase 1-3: 初始化
    Native->>CB: 创建 CallbackManager

    Native->>FE: Phase 4.6: 启动前端
    activate FE
    FE->>FE: 编译/启动 dev server
    FE-->>Native: 前端就绪
    deactivate FE

    Native->>RPC: Phase 4.7: 启动 RPC v2
    activate RPC
    RPC->>FE: 获取 static_mount
    FE-->>RPC: static_mount config
    RPC->>RPC: 挂载静态文件 + API
    RPC-->>Native: RPC v2 就绪

    Native->>UI: Phase 7: 创建 PySide6 UI
    activate UI
    UI->>CB: 连接生命周期回调
    UI->>UI: 加载 webview URL
    UI-->>User: 显示窗口

    User->>UI: 使用应用...

    User->>UI: 关闭窗口
    UI->>CB: 触发 on_closing 回调
    CB->>RPC: 停止 RPC v2
    deactivate RPC
    CB->>FE: 停止前端服务
    deactivate FE
    UI->>CB: 触发 on_closed 回调
    deactivate UI
    deactivate Native

    Main-->>User: 应用退出
```

## 8. 错误处理流程

```mermaid
flowchart TD
    Start([启动应用]) --> Config[验证配置]
    Config --> ConfigErr{配置有效?}
    ConfigErr -->|否| ConfigFail[ConfigError: 配置无效]
    ConfigErr -->|是| Frontend{前端启用?}

    Frontend -->|是| FE_Start[启动前端]
    Frontend -->|否| RPC_Check

    FE_Start --> FE_Mode{模式}
    FE_Mode -->|生产| FE_Build[编译前端]
    FE_Mode -->|开发| FE_Dev[启动 dev server]

    FE_Build --> FE_BuildErr{编译成功?}
    FE_BuildErr -->|否| FE_BuildFail[BuildError: 前端编译失败]
    FE_BuildErr -->|是| RPC_Check

    FE_Dev --> FE_DevErr{启动成功?}
    FE_DevErr -->|否| FE_DevFail[DevServerError: dev server 启动失败]
    FE_DevErr -->|是| RPC_Check

    RPC_Check{RPC 启用?}
    RPC_Check -->|是| RPC_Start[启动 RPC v2]
    RPC_Check -->|否| Singleton

    RPC_Start --> RPC_Err{启动成功?}
    RPC_Err -->|否| RPC_Fail[RPCError: RPC v2 启动失败]
    RPC_Err -->|是| Singleton[Singleton 检测]

    Singleton --> Single_Err{已有实例?}
    Single_Err -->|是| Single_Exit[退出: 已有实例运行]
    Single_Err -->|否| UI_Start[启动 UI]

    UI_Start --> UI_Err{启动成功?}
    UI_Err -->|否| UI_Fail[UIError: UI 启动失败]
    UI_Err -->|是| Running[应用运行中]

    ConfigFail --> Cleanup[清理资源]
    FE_BuildFail --> Cleanup
    FE_DevFail --> Cleanup
    RPC_Fail --> Cleanup
    UI_Fail --> Cleanup
    Single_Exit --> Exit

    Cleanup --> Exit[退出应用]

    Running --> UserClose[用户关闭]
    UserClose --> Shutdown[执行关闭回调]
    Shutdown --> Cleanup

    style ConfigFail fill:#ffcccc
    style FE_BuildFail fill:#ffcccc
    style FE_DevFail fill:#ffcccc
    style RPC_Fail fill:#ffcccc
    style UI_Fail fill:#ffcccc
    style Running fill:#ccffcc
```

## 9. 配置传递路径

```mermaid
graph TD
    subgraph "用户配置"
        UC[NativeUIConfig]
        UC --> UC1[frontend_*]
        UC --> UC2[rpc_*]
        UC --> UC3[window_*]
        UC --> UC4[tray_*]
    end

    subgraph "Phase 4.6: Frontend"
        UC1 --> FC[FrontendConfig]
        FC --> FC1[framework]
        FC --> FC2[app_dir]
        FC --> FC3[mode]
        FC --> FC4[port]
        FC --> FT[FrontendLauncherThread]
    end

    subgraph "Phase 4.7: RPC v2"
        UC2 --> RC1[rpc_port]
        UC2 --> RC2[rpc_host]
        UC2 --> RC3[rpc_routers]
        FT --> RC4[static_mounts]

        RC1 --> LC[LauncherConfig]
        RC2 --> LC
        RC3 --> LC
        RC4 --> LC

        LC --> SL[ServiceLauncher]
        SL --> RPC[FastAPIRPCServer]
    end

    subgraph "Phase 7: UI"
        UC3 --> PC[PySide6UIConfig]
        UC4 --> PC
        PC --> PF[PySide6Framework]
    end

    style UC fill:#e1f5ff
    style FC fill:#ccffcc
    style LC fill:#fff4e1
    style PC fill:#f0f0f0
```

## 10. 代码简化对比

```mermaid
graph LR
    subgraph "整合前 (~350 行)"
        B1[matrix_main.py<br/>~100 行]
        B2[frontend_compiler.py<br/>~80 行]
        B3[launcher_builder.py<br/>~200 行]
        B4[event_handlers.py<br/>~100 行]

        B1 --> B2
        B1 --> B3
        B1 --> B4
    end

    subgraph "整合后 (~120 行)"
        A1[matrix_main.py<br/>~120 行]
        A2[event_handlers.py<br/>~100 行]

        A1 --> A2

        A3[native_ui<br/>处理所有逻辑]
        A1 -.-> A3
    end

    B1 -.减少 65%.-> A1

    style B1 fill:#ffcccc
    style B2 fill:#ffcccc
    style B3 fill:#ffcccc
    style A1 fill:#ccffcc
```

---

**图表说明：**
- 浅蓝色：native_ui 模块
- 浅黄色：RPC v2 相关
- 浅绿色：前端相关
- 浅灰色：UI 相关
- 浅红色：需要删除/简化的代码

**查看方式：**
这些 Mermaid 图表可以在支持 Mermaid 的 Markdown 查看器中渲染，例如：
- GitHub/GitLab
- VS Code (with Mermaid extension)
- Obsidian
- Typora
- 在线工具：https://mermaid.live/

**文档版本**: v1.0
**创建时间**: 2025-12-07
**作者**: Claude (AI Assistant)
