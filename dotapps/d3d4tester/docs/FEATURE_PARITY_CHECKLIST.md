# d3d4tester 功能对齐清单（Python d3-check → C#）

逐项按 C# 代码核对（读处理函数，不看注释）。`[x]` 代码完整实现（有 UI 且处理逻辑真正生效）；`[~]` 部分实现（注明缺什么）；`[ ]` 未实现。“Py 同”= Python 也缺，不是移植回退。路径相对 `dotapps/d3d4tester/`。

## 1. 主页：技能宏
- [x] 技能表 7 行（技能1–4、左键、右键、药水）：按键/策略/间隔/延迟/随机延迟，按配置保存 — `ViewModels/SkillRowViewModel`、`Pages/Main/MainPage.xaml`；默认值来自 `Config/default_config.json`
- [x] 策略“连续” — `Core/MacroSkillRunner.RunOneSkillTick`
- [x] 策略“单次” — `MacroSkillRunner.RunOneSkillTick`
- [~] 策略“按住” — 行为与“单次”相同，无按住逻辑（Py 同）
- [x] 策略“忽略/禁用” — `MacroSkillRunner.SkippedStrategies`
- [x] 间隔/延迟/随机延迟时序（100 ms 循环） — `MacroFallbackRunner.RunLoop`
- [x] 左右键仅在 D3 客户区内点击 — `MacroSkillRunner` + `GameInterfaceData.RefreshD3WindowCache`
- [x] 4 套配置切换与“当前配置”标签 — `MainPage.OnConfigSelectionChanged` → `MacroConfigLoader.LoadActive`
- [~] 快速切换热键 — 只保存，不注册全局热键（Py 同）
- [x] 战斗宏启停全局热键（改键即重绑，失败回滚） — `Hotkeys/D3D4TesterHotkeyBinder`
- [x] 战斗宏启停按钮 — `MainViewModel.CombatMacroToggleCommand`
- [x] 辅助宏热键（再按请求停止） — `GameAssistantController.AutoUseInterfaceFunction`
- [x] 切换配置提示音 — `Services/EventCenter.NotifySkillConfigSwitched`
- [~] 智能暂停 — 只绑定配置，运行时无读取（Py 同）
- [~] 自定义强制站立键 — 只绑定配置，运行时无读取（Py 同）
- [~] 宏运行中修改技能实时生效 — 只在启动宏/切换配置时重载；Python 在配置变更时重载（移植缺口）

## 2. 辅助自动化（主页右栏 + 辅助热键）
- [~] 血岩碎片 + 类型 — 只绑定配置（Py 同）
- [~] 快速拾取 — 只绑定配置（Py 同）
- [x] 铁匠分解 — `GameAssistantController.RunBlacksmithBranch` → `Blacksmith/BlacksmithHandler`
- [x] 自动分解（保留远古+/太古） — `BlacksmithHandler.HandleAutoSalvageBySlots`
- [~] 卡奈重铸 + 模式 — 流程会跑，但不读 `kanai_reforge.mode`（Py 同）
- [x] 卡奈升级 — `Kanai/KanaiFlow.RunUpgradeFlow`
- [~] 卡奈转换 + 材料 — 仅打印“未实现”（Py 为 TODO）
- [~] 丢弃装备 — 只绑定配置（Py 同）
- [x] 自动确保战网正常（DOT） — `Services/BattlenetGuardService`
- [x] 战网状态以右上角头像为准（Offline = 头像离线异常；Online/Away/Busy/Appear Offline = 正常）；只有头像菜单里的 BattleTag 文本与菜单名一致时才采信，BattleTag 显示在状态栏 — `BattlenetOperationBase.ReadAccountPresence`
- [x] 广告/欢迎弹窗（`*-modal` + Close）自动识别并关闭 — `BattlenetPopupDismiss.TryCloseModal`
- [x] D3/D4 页签与游戏页按钮状态识别（开始游戏 / 更新 / 未安装 / 免费试玩·购买 / 启动中），按选中页签或按钮里的游戏名归属，状态栏 D3、D4 两个徽章各带状态图标；每个游戏记住最后看到的状态 — `BattlenetOperationBase.DetectGameUi`、`GameInterfaceData.MergeGameUi`
- [ ] 切换 D3/D4 页签并点开始游戏（基于上面的识别）
- [x] 战网、ROSBOT 不是本程序的子进程（父进程 = 桌面 explorer，程序重启/退出不影响） — `DotCore.Utils.ShellOpen.StartProgram`
- [x] 启动 D3（不带 ROSBOT） — `LoginTryController.EnsureD3RunningFromBattlenetNoRosbot`
- [x] 背包偏移 — `BagInfoCollector.BagOffsetProvider`（`use_in_calculation` 无 UI，Py 同）
- [x] 界面识别（铁匠/卡奈）+ DEBUG 调试图 — `D3InterfaceDetection`
- [x] 辅助运行中再按热键停止 — `AssistantExecutionState`

## 3. ROSBOT 页
- [x] 自动启用最新 ROS — `Ctl/RosbotRunFlow.RunE3UpdateFlow`
- [~] 蓝门优先 — 只绑定配置（Py 同）
- [x] 初生蓝门复用 — `Services/RosbotLogAnalyzer`
- [~] 拾取血岩 — 只绑定配置（Py 同）
- [x] 智能回响开关 — `Services/RosbotSmartEchoCoordinator`
- [~] 智能回响等待秒数 — 只绑定，实际用固定 60 秒（Py 同）
- [x] 测试模式 + 测试超时 — `Core/Flow/F3LogTimeout`
- [~] 防卡住 — 只绑定配置（Py 同）
- [~] 开机启动 — 只绑定配置（Py 同）
- [x] 日志超时重启 + 分钟数 — `F3LogTimeout.GetTimeoutConfig`
- [x] 总重启次数 [R#] — `RosbotTaskProcessor.ProcessEveryTick`
- [x] 启动/停止 ROSBOT（总流程） — `RosbotTaskProcessor.RequestStartFlow/RequestStopFlow`
- [x] 确保战网 — 写 `battlenet.ensure_normal` → `BattlenetGuardService`
- [x] 更新 ROSBOT — `Windows/RosbotUpdateInfoWindow.RunInteractiveUpdateAsync`
- [x] 打开油猴脚本 — `RosbotPage.BtnOpenTampermonkey_Click`（网页登录已改为 UI 自动化，不再依赖油猴）
- [x] 账号密码对话框（按区服） — `Windows/CredentialsDialog`
- [x] 流程触发的凭据对话框 — `RosbotFlowController.SetShowCredentialsDialogAndWait`
- [x] ROSBOT 日志视图 / 最后日志时间 / 打开 logs.txt / 复制 — `RosbotPage`
- [x] 日志分析：地图/阶段/掉线/启停 — `RosbotLogAnalyzer`
- [ ] 暂停/恢复测试 — 未移植（Python 无调用方）

## 4. D4 页
- [x] 挂经验启停（组队检查在后台） — `ViewModels/D4ViewModel`、`Ctl/D4TickLoop`
- [x] 组队检查 + 自动组队 — `D4TeamFormationChecker`、`D4AutoTeamFormation`
- [x] 切图检测 — `D4MapSwitchDetector`
- [x] 地图名 OCR — `D4MapNameRecognizer`
- [x] 小地图位置（城镇/地下城） — `D4SmallMapDetector`
- [x] 队伍血量 — `D4TeamHealthDetector`
- [~] 地下城进度 — 磁贴存在但从未赋值（Py 同）
- [x] 坐标/尺寸/窗口模式/切图计数/状态 — `D4UiStatusUpdater`
- [x] 调试图像窗口 — `Windows/D4DebugWindow`（模板路径已修正，`SourcePaths`）
- [x] D4 事件（仅日志） — `D4EventManager`
- [x] 截图与标注保存 — `D4Pipeline.SaveScreenshotAndAnnotate`
- [x] D4 日志 — `Pages/D4/D4Page`
- [x] 从战网启动 D4（DOT） — `LoginTryController.EnsureD4RunningFromBattlenet`
- [~] 记住挂经验状态 — 只写不读（Py 同）
- [~] 红门检测 — 有实现无调用方（Py 同）

## 5. 坐标校准页
- [x] 客户端类型（战网/D3/D4） — `CalibrationPage.OnClientTypeChange`
- [x] 截图 → 坐标拾取器（点/矩形/圆、历史、重命名、撤销、导出） — `Windows/CoordinatePickerWindow`
- [x] 模板匹配助手 — `Windows/CoordinatePicker/TemplateMatcherHelper`
- [x] 录制配置 / 录制启停（原生 `DotCore.YoloRecord`） — `CalibrationPage`
- [x] 工程创建/切换/打开目录、片段表、右键菜单、合并/导出/删除、补丁导入 — `CalibrationPage`
- [x] 标注（VOC 标注窗口） — `Windows/AnnotatorWindow`
- [x] YOLO 训练 / 清理未标注 / 加载工程（DOT，Python 未接线） — `CalibrationPage.OnTrainAsync` 等

## 6. 日志页
- [~] 背包识别测试 / 黄装升级 / 重铸装备 / 测试寻路 — 只打印起止文字（Py 同）
- [~] 调试血岩 / 拾取 / 重铸 / 转换 / 分解 / 丢装 / 声音 / 暂停 — 未注册处理器，点击只打印“placeholder”
- [x] 调试铁匠（背包悬停 + 真实分解） — `GameAssistantController.RunDebugBagHoverWithSalvage`
- [~] 调试卡奈升级 — 实际执行的是铁匠分解（沿用 Python 的复制错误）
- [x] 调试战网 UI JSON / 调试 ROSBOT — `BattlenetUiAnalyzeService`、`RosbotDebugService`
- [x] 调试：刷新战网/D3/D4 状态（DOT） — `Services/GameStatusDebugService`
- [x] 清除/保存日志、DEBUG 开关、自动滚动、级别过滤、检查日志区域 — `RunLogPage`
- [x] 系统资源（系统/本程序/战网/D3/D4/ROSBOT 的 CPU/内存/显存/GPU，可见时每秒） — `Components/ResourceMonitorBlock`、dotcore `SystemResourceSampler`

## 7. 状态栏
- [x] 当前配置、战网（细分客户端状态 + 区服）、ROS、D3、地图、阶段、油猴、窗口尺寸、测试模式 — `StatusBar/D3StatusBarDisplayBuilder`
- [x] 路径芯片 + ROS 版本、一键扫描（启动/区服变化/路径不符自动触发，5 秒节流） — `MainWindow`
- [~] 扫描结果弹窗 — Python 有，C# 只记日志（移植缺口）

## 8. 标题栏 / 窗口
- [x] 拖动/双击最大化、语言、主题（DOT）、最小化/最大化/关闭、恢复尺寸、重启程序、几何与上次页签保存 — `Components/TitleBarControl`、`MainWindow`、`ShutdownManager`

## 9. 系统托盘
- [x] 显示/最大化/重启/调试切页/退出 — `Services/TrayIconService`
- [~] 托盘通知 — 接口存在无调用方（Py 同）

## 10. HTTP 桥（127.0.0.1:8765）
- [x] 状态/配置查询、宏启停、配置切换与保存、OAuth、YOLO 录制与片段接口 — `Services/D3D4TesterHttpBridge`
- [~] `/api/config/update` — 写配置但不重载运行中的宏（移植缺口）

## 11. 定时与一次性任务
- [x] 1 秒 TickDriver（流程 %2、回响 %3、10 秒探测）、窗口监视、ROSBOT 日志跟踪、路径扫描、D4 3 秒循环 — `Core/Flow/TickDriver`、`Services/WindowMonitorService`、`Ctl/D4TickLoop`

## 12. 战网 / ROSBOT 流程
- [x] B 块（启动、托盘恢复、国服/亚服登录、网页登录自动化、弹窗关闭、确认） — `Core/Flow/BattlenetReadyFlow`、`Core/Battlenet/BrowserLoginAutomation`
- [x] 仅确保战网流程 + 全局守护（DOT：默认开） — `BnOnlyFlow`、`BattlenetGuardService`
- [x] 守护规则（DOT）：先确保区服（`--setregion`）、异常超时重启、登录超时重启；安全验证/验证码期间不重启 — `Core/Flow/BattlenetStateWatchdog`
- [x] 战网客户端状态探测（DOT，含安全验证、等待验证码、登录中、载入账户等） — `BattlenetClientStateDetector` + `IBattlenetOperation.ClassifyClientState`
- [x] B/D 块的界面判断（`GetDynamicState`）与状态中心共用同一个分类器（首页无开始按钮也算已登录，不再超时误杀） — `BattlenetOperationBase.GetDynamicState`
- [x] 程序日志按天落盘，战网的每次启动/关闭都记录状态与调用来源 — `ColorPrinter.EnableFileLog`、`~/.core_node/.d3check/logs/`
- [x] 安全验证页自动点 Continue（id `submit`，60 秒内只点一次，发送验证码邮件） — `BrowserLoginAutomation.SubmitSecurityCheck`，由 `BattlenetStateWatchdog` 在守护运行时调用
- [~] 验证码输入页（"Please enter the security code sent to: …"，Resend code / Submit / Go Back）— 已识别并等待人工输入；验证码只在邮箱里，程序不能自动填写
- [x] 流程的“退出重启”（B5）只关闭不正常的战网：正常 / 弹窗 / 游戏启动中一律保留；B13 确认已登录后重置超时 — `BattlenetManager.CloseIfUnhealthy`、`BattlenetReadyFlow.Confirm`
- [x] 登录中 / 安全验证 / 邮件与验证码页期间绝不关闭或重启战网 — `BattlenetManager.Close`（现场探测后拒绝）、`BattlenetReadyFlow` B5 改为继续等待、看门狗豁免
- [x] 密码输入改为键盘逐字输入（网页表单不接受 ValuePattern 直接赋值） — `BrowserLoginAutomation.Fill`、`BattlenetAsiaOps.FillField`
- [x] 多账号（DOT，国服/亚服分开、加密、头像菜单退出切换） — `Config/BattlenetAccountService`、`Pages/Battlenet`
- [x] D 块（启动 D3/D4）、C 分支（C1–C12）、E 块（启动 ROSBOT）、F0–F4、日志掉线重启、系统错误、无物品弹窗、智能回响、“必须启动 D3”弹窗 — `Ctl/LoginTryController`、`Ctl/D3ConnectC3Flow`、`Ctl/RosbotRunFlow`、`Core/Flow/*`、`Services/RosbotLog*`

## 13. D3 检测
- [x] D3 窗口查找、掉线/菜单/游戏中、界面类型、背包与品质、Kanai 页状态、D3 状态截图 — `D3WindowFinder`、`Ctl/D3StatusProvider`、`D3InterfaceDetection`、`Core/Bag/*`、`D3StartGameAndTeleport`

## 待办（移植缺口，按优先级）
1. 宏运行中修改技能 / HTTP `/api/config/update` 后实时重载（`MacroConfigLoader.LoadActive` 挂到配置变更通知）。
2. 调试按钮补处理器：血岩、拾取、重铸、转换、分解、丢装、声音、暂停；修正“调试卡奈升级”。
3. 扫描结果弹窗。
4. 战网主界面切换 D3/D4 页签并点开始游戏（用 `DetectGameUi` 的识别结果；亚服 D4 页签 id 为 `Fen`）。
5. Python 也未实现、但 UI 已有的配置：按住策略、快速切换热键、智能暂停、自定义站立键、血岩/拾取/丢装、卡奈重铸模式与转换、ROSBOT 蓝门/拾血岩/防卡/开机启动/回响等待秒数、地下城进度。

## 统计
| 区域 | [x] | [~] | [ ] |
|---|---|---|---|
| 主页 | 11 | 5 | 0 |
| 辅助自动化 + 战网守护 | 12 | 5 | 1 |
| ROSBOT | 14 | 5 | 1 |
| D4 | 12 | 3 | 0 |
| 坐标校准 | 7 | 0 | 0 |
| 日志页 | 5 | 3 | 0 |
| 状态栏/标题栏/托盘/HTTP/定时 | 6 | 3 | 0 |
| 流程 / D3 检测 | 10 | 1 | 0 |
| **合计** | **77** | **25** | **2** |

`[~]` 中多数为 Python 同样未实现；真正的移植缺口见“待办”1–4。
