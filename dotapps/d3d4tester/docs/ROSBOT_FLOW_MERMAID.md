# ROSBOT 启动流程（DOT 版，流程驱动）

**驱动方式**：按流程顺序执行，不按 tick。点击“启动监控”后 `RosbotFlowRunner` 在独立线程上从 F1 开始顺序执行一轮：F1 → (B → D) → E → P（插件启动动作）→ F3；F3 监控结束（重启 / D3 消失 / ROSBOT 消失）后回到 F1 开始下一轮。所有等待都可取消，点击“停止监控”后流程在当前步骤立即结束。

**复用原则**：D3 正在运行就复用（不重启，不截图识图）；战网已登录就复用（不重启、不退出）；ROSBOT 已在线就直接进入 F3。只有在战网登录界面、断线、登录失败或超时时才处理战网。

**唯一实现**：B = `BattlenetReadyProcess`；D = `GameLaunchProcess`；E = `RosbotRunFlow.RunEBlock`（经 `IRosbotFlowHost.RunRosbotStart`）；P = `RosbotBridgeStartActions`（ROSBOT 启动后，暂停 ROSBOT 由 CoreNodeBridge 插件跟随或传送；不再截图识图点击）；F3 = `F3MonitorProcess`；总流程 = `RosbotFlowRunner`。“确保战网”守护 = `BattlenetGuardRunner`，与监控共用同一个 B 流程（同一时刻只运行一个，监控启动时守护让出）。手动“启动 D3 / D4”也走同一个 B + D。

```mermaid
%%{init: {'themeVariables': {'fontSize': '45px', 'primaryFontSize': '45px', 'secondaryFontSize': '45px', 'tertiaryFontSize': '45px', 'fontFamily': 'arial'}}}%%
flowchart TB
    subgraph A["总流程 RosbotFlowRunner（独立线程，顺序执行）"]
        A1_Start["[A1] 点击启动监控：置监控开关，启动流程线程"]
        A1_Stop["[A1s] 点击停止监控：取消流程（当前步骤立即结束，ROSBOT 保持原样）"]
        A1_Pause["[A1p] 点击暂停监控：流程在当前步骤停下（监控仍开，重启请求忽略，战网守护不动）；ROSBOT 正在运行则按它的暂停键 F6"]
        A1_Resume["[A1r] 点击继续监控：被暂停的 ROSBOT 再按 F6 恢复；日志超时重新计时；从 F1 继续（运行中的一律复用）"]
        A1_Pause --> A1_Resume
        A1_Resume --> F1_HasD3
        F1_HasD3{"[F1] D3 是否在运行？"}
        F2_RosbotOnline{"[F2] ROSBOT 是否在线（running / paused）？"}
        A1_Start --> F1_HasD3
    end

    subgraph B["B 战网就绪 BattlenetReadyProcess（顺序循环，每 2s 探测一次客户端状态）"]
        B1_Probe{"[B1] 探测战网状态（BattlenetClientStateDetector）"}
        B2_Ready["[B2] 已登录主界面 / 游戏启动中 → 复用"]
        B3_Start["[B3] 未运行 → 启动战网，等 5s"]
        B4_Tray["[B4] 隐藏在托盘 → 托盘恢复，否则再次启动 Battle.net.exe 显示窗口（不关闭，不掉登录）"]
        B5_Region["[B5] 区服与全局设置不一致 → --setregion 重启（120s 冷却）"]
        B6_LoginCn["[B6] 国服登录页 → 同意 + 网易登录（15s 冷却）→ 网页登录自动化"]
        B7_LoginWeb["[B7] 网页登录 / 浏览器等待 → 网页登录自动化轮询"]
        B8_LoginAsia["[B8] 亚服登录页 → 已存账号密码填写提交（无则弹出凭据对话框）"]
        B9_User["[B9] 正在登录 / 安全验证 / 验证码 → 等用户，永不重启"]
        B10_Popup["[B10] 弹窗 → 关闭"]
        B11_Restart["[B11] 断线 / 登录失败 → 重启战网"]
        B12_Timeout["[B12] 异常状态（连接中、加载、离线、未知）超过 battlenet.abnormal_timeout_sec，或登录状态超过 battlenet.login_timeout_sec → 重启；休眠 / 读取账号超过 5 分钟 → 清缓存后启动"]
        B1_Probe -->|"Normal / GameStarting"| B5_Region
        B5_Region -->|"区服一致"| B2_Ready
        B5_Region -->|"已切换区服"| B1_Probe
        B1_Probe -->|"NotRunning"| B3_Start
        B1_Probe -->|"TrayHidden"| B4_Tray
        B1_Probe -->|"LoginCn"| B6_LoginCn
        B1_Probe -->|"LoginCnWeb / BrowserLoginWait"| B7_LoginWeb
        B1_Probe -->|"LoginAsia / LoginEmail / LoginPassword"| B8_LoginAsia
        B1_Probe -->|"LoggingIn / SecurityCheck / VerificationCode"| B9_User
        B1_Probe -->|"Popup"| B10_Popup
        B1_Probe -->|"Disconnected / LoginFailed"| B11_Restart
        B3_Start --> B1_Probe
        B4_Tray --> B1_Probe
        B6_LoginCn --> B12_Timeout
        B7_LoginWeb --> B12_Timeout
        B8_LoginAsia --> B12_Timeout
        B9_User --> B1_Probe
        B10_Popup --> B1_Probe
        B11_Restart --> B1_Probe
        B12_Timeout -->|"未超时，等 2s"| B1_Probe
        B12_Timeout -->|"超时 → 重启"| B1_Probe
    end

    subgraph D["D 从战网启动 D3 GameLaunchProcess（单次执行，失败不重启战网）"]
        D1_Activate["[D1] 激活战网窗口，等 1s"]
        D2_EndRosbot["[D2] 启动 D3 前结束 ROSBOT"]
        D3_Play["[D3] 直接启动 Battle.net.exe --exec=launch D3 / D3CN（每 10s 重发至 D3 进程出现，最多 60s，关闭 New version 提示）；失败才激活战网点 D3 页签 + Play"]
        D4_Wait["[D4] 窗口类 D3 Main Window Class 且高度 > 500 才算就绪"]
        D5_Found{"[D5] 找到 D3 窗口？"}
        D6_Fail["[D6] 失败：等 20s 后回到 F1"]
        D7_JustEntered["[D7] D3 已启动 → F2"]
        D1_Activate --> D2_EndRosbot --> D3_Play --> D4_Wait --> D5_Found
        D5_Found -->|否| D6_Fail
        D5_Found -->|是| D7_JustEntered
    end

    subgraph P["P 插件启动动作 RosbotBridgeStartActions（ROSBOT 上线后立即执行，无截图识图）"]
        P1_Config{"[P1] 已保存跟随设置，或（本轮新启动 ROSBOT 且配置了传送 UI 序列）？"}
        P2_InGame{"[P2] 90s 内插件数据在线且英雄在游戏内？"}
        P3_Pause["[P3] 按 ROSBOT 暂停键 F6 暂停 ROSBOT"]
        P4_Follow["[P4] 跟随：跳过传送，重发已保存的 follow 命令 → 暂停监控（ROSBOT 保持暂停，由插件跟随；继续监控时结束跟随并恢复 ROSBOT）"]
        P5_Teleport["[P5] 传送：插件 ui_sequence 按顺序等待并点击 D3 UI 元素 → 再按 F6 恢复 ROSBOT"]
        P6_Skip["[P6] 跳过：ROSBOT 照常挂机"]
        P1_Config -->|是| P2_InGame
        P1_Config -->|否| P6_Skip
        P2_InGame -->|否| P6_Skip
        P2_InGame -->|是| P3_Pause
        P3_Pause -->|"跟随"| P4_Follow
        P3_Pause -->|"传送"| P5_Teleport
    end

    subgraph E["E 启动 ROSBOT RosbotRunFlow.RunEBlock（顺序执行，停止监控即中断）"]
        E1_Kill["[E1] 结束已有 ROSBOT"]
        E2_Wait["[E2] 等 1s"]
        E3_Update["[E3] 自动使用最新 ROS：找更新 zip → 解压 → 复制 RoS-BoT.ini → 更新 ros_directory；auto_start_rosbot 关闭则不启动"]
        E4_Start["[E4] 以 autostart 参数启动 ROSBOT（战网休眠 / 读取账号时跳过本轮），记录 F3 起算时间"]
        E5_Task["[E5] 任务初始化"]
        E6_UI["[E6] 45s 内自行挂机即完成；否则回退：等窗口 / 服务器 → 点主档案 → 点 Start botting"]
        E7_Fail["[E7] 失败：等 20s 后回到 F1"]
        E1_Kill --> E2_Wait --> E3_Update --> E4_Start --> E5_Task --> E6_UI
        E4_Start -->|"未启动"| E7_Fail
    end

    subgraph F3["F3 监控 F3MonitorProcess（每 2s 一次，每 10s 刷新 D3 / ROSBOT 状态）"]
        F3_Loop{"[F3] 检查"}
        F3_Restart["[F3r] 重启请求（错误弹窗 / 内存 / 触发器 / 日志系统错误）、ROSBOT 日志掉线、ROSBOT 日志超时（含测试模式）"]
        F3_D3Gone["[F3d] D3 窗口消失"]
        F3_RosbotGone["[F3g] ROSBOT 离线超过 30s（D3 仍在）"]
        F3_RosbotRestart["[F3e] 只重启 ROSBOT 的请求（智能回响恢复失败）"]
        F4_Close["[F4] 结束 D3 → 向系统发送 F7 → 按 PID 结束 ROSBOT（重启计数、通知、错误截图、按设置关闭战网）"]
        F3_Loop -->|"正常，等 2s"| F3_Loop
        F3_Loop --> F3_Restart --> F4_Close
        F3_Loop --> F3_D3Gone --> F4_Close
        F3_Loop --> F3_RosbotGone
        F3_Loop --> F3_RosbotRestart
    end

    F1_HasD3 -->|"否"| B1_Probe
    B2_Ready -->|"D3 仍未运行"| D1_Activate
    B2_Ready -->|"D3 已出现"| F2_RosbotOnline
    F1_HasD3 -->|"是 → 复用 D3"| F2_RosbotOnline
    D7_JustEntered --> F2_RosbotOnline
    D6_Fail --> F1_HasD3
    F2_RosbotOnline -->|"否 → ROSBOT autostart 自己进游戏"| E1_Kill
    F2_RosbotOnline -->|"是 → 复用 ROSBOT"| P1_Config
    E6_UI --> P1_Config
    P5_Teleport --> F3_Loop
    P6_Skip --> F3_Loop
    P4_Follow --> A1_Resume
    E7_Fail --> F1_HasD3
    F4_Close --> F1_HasD3
    F3_RosbotGone --> F1_HasD3
    F3_RosbotRestart --> E1_Kill

    subgraph G["确保战网守护 BattlenetGuardRunner（battlenet.ensure_normal）"]
        G1_Check{"[G1] 每 10s：监控未运行且 D3 未运行？"}
        G2_B["[G2] 运行 B（不激活窗口）；监控启动时立即让出"]
        G1_Check -->|是| G2_B --> G1_Check
        G1_Check -->|"否 → 不动战网"| G1_Check
    end
```
