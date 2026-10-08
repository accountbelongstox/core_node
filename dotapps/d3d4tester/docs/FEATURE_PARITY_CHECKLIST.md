# d3d4tester 功能对齐清单（Python d3-check → C#）

逐项按 C# 代码核对（读处理函数，不看注释）。`[x]` 代码完整实现（有 UI 且处理逻辑真正生效）；`[~]` 部分实现（注明缺什么）；`[ ]` 未实现。“Py 同”= Python 也缺，不是移植回退。路径相对 `dotapps/d3d4tester/`。

## 1. 主页：技能宏
- [x] 技能表 7 行（技能1–4、左键、右键、药水）：按键/策略/间隔/延迟/随机延迟，按配置保存 — `ViewModels/SkillRowViewModel`、`Pages/Main/MainPage.xaml`；默认值来自 `Config/default_config.json`
- [x] 策略“连续” — `Core/MacroSkillRunner.RunOneSkillTick`
- [x] 策略“单次” — `MacroSkillRunner.RunOneSkillTick`
- [x] 策略“按住” — 宏启动后按下不放（键盘 / 鼠标，SendInput），停止或智能暂停时松开（D3KeyHelper 语义） — `MacroSkillRunner.EnsureHeld` / `ReleaseHeld`
- [x] 策略“忽略/禁用” — `MacroSkillRunner.SkippedStrategies`
- [x] 间隔/延迟/随机延迟时序（100 ms 循环） — `MacroFallbackRunner.RunLoop`
- [x] 左右键仅在 D3 客户区内点击 — `MacroSkillRunner` + `GameInterfaceData.RefreshD3WindowCache`
- [x] 4 套配置切换与“当前配置”标签 — `MainPage.OnConfigSelectionChanged` → `MacroConfigLoader.LoadActive`
- [x] 快速切换热键 — 每个不同热键注册一次全局热键；多个配置共用同一热键时按顺序轮换（默认都为 F1）；与辅助/战斗热键冲突时跳过 — `D3D4TesterHotkeyBinder.ReregisterQuickSwitch`、`Services/SkillConfigSwitcher`（下拉框、热键、HTTP 共用唯一切换入口）
- [x] 战斗宏启停全局热键（改键即重绑，失败回滚） — `Hotkeys/D3D4TesterHotkeyBinder`
- [x] 战斗宏启停按钮 — `MainViewModel.CombatMacroToggleCommand`
- [x] 辅助宏热键（再按请求停止） — `GameAssistantController.AutoUseInterfaceFunction`
- [x] 切换配置提示音 — `Services/EventCenter.NotifySkillConfigSwitched`
- [x] 智能暂停 — D3 在前台时 Tab 暂停/继续（暂停时松开按住键），Enter / T / M 停止宏（D3KeyHelper 语义），每 20 ms 检测按键 — `MacroFallbackRunner.SmartPauseState`
- [x] 自定义强制站立键 — 左键连点时按住站立键；丢装时也按住 — `MacroSkillRunner`（standVk）、`Core/Assistant/DropEquipment`
- [x] 宏运行中修改技能实时生效 — `macro_configs.*` 任一写入即 `LoadActive`（`Ctl/CombatMacroController.OnConfigChanged`）

## 2. 辅助自动化（主页右栏 + 辅助热键）
- [x] 血岩碎片 + 类型 — 卡达拉处按辅助热键：在鼠标处连点右键；次数 = 背包按类型可容纳件数（首饰 1 格、其余 2 格），最多 60，背包未识别时 15 — `Core/Assistant/BloodShardGamble`
- [x] 快速拾取 — 鼠标在人物附近时连点左键 30 次，否则点 1 次；间隔取自动画速度 — `Core/Assistant/QuickPickup`
- [x] 铁匠分解 — `GameAssistantController.RunBlacksmithBranch` → `Blacksmith/BlacksmithHandler`
- [x] 自动分解（保留远古+/太古） — `BlacksmithHandler.HandleAutoSalvageBySlots`
- [x] 卡奈重铸 + 模式 — 重铸鼠标处（否则背包第一件）传奇，最多 10 次：直到远古+ / 双爆（OCR 提示框）/ 双爆且远古+；修正 Python 把重铸页当升级稀有处理 — `Core/Kanai/KanaiRecipeHelper.RunReforge`
- [x] 卡奈升级 — `Kanai/KanaiFlow.RunUpgradeFlow`
- [x] 卡奈转换 + 材料 — 在玩家打开的转换页：遗忘之魂=按分解保留规则的传奇、萃取水晶=稀有、奥术之尘=魔法，逐件右键/填充/转化/翻页 — `KanaiRecipeHelper.RunConvert`
- [x] 丢弃装备 — 鼠标在背包内按辅助热键：按分解保留规则逐格悬停判定后拿起并丢到窗口中心 — `Core/Assistant/DropEquipment`
- [x] 自动确保战网正常（DOT） — `Services/BattlenetGuardService`
- [x] 战网状态以右上角头像为准（Offline = 头像离线异常；Online/Away/Busy/Appear Offline = 正常）；只有头像菜单里的 BattleTag 文本与菜单名一致时才采信，BattleTag 显示在状态栏 — `BattlenetOperationBase.ReadAccountPresence`
- [x] 广告/欢迎弹窗（`*-modal` + Close）自动识别并关闭 — `BattlenetPopupDismiss.TryCloseModal`
- [x] D3/D4 页签与游戏页按钮状态识别（开始游戏 / 更新 / 未安装 / 免费试玩·购买 / 启动中），按选中页签或按钮里的游戏名归属，状态栏 D3、D4 两个徽章各带状态图标；每个游戏记住最后看到的状态 — `BattlenetOperationBase.DetectGameUi`、`GameInterfaceData.MergeGameUi`
- [x] 切换 D3/D4 页签并点开始游戏（基于上面的识别：启动中直接成功，更新/安装/免费试玩不点击）— `Core/Battlenet/BattlenetGameLauncher`，D 块启动 D3/D4 共用
- [x] 战网、ROSBOT 不是本程序的子进程（父进程 = 桌面 explorer，程序重启/退出不影响） — `DotCore.Utils.ShellOpen.StartProgram`
- [x] 启动 D3（不带 ROSBOT） — `LoginTryController.EnsureD3RunningFromBattlenetNoRosbot`
- [x] 背包偏移 — `BagInfoCollector.BagOffsetProvider`（`use_in_calculation` 无 UI，Py 同）
- [x] 界面识别（铁匠/卡奈）+ DEBUG 调试图 — `D3InterfaceDetection`
- [x] 辅助运行中再按热键停止 — `AssistantExecutionState`

## 3. ROSBOT 页
- [x] 自动启用最新 ROS — `Ctl/RosbotRunFlow.RunE3UpdateFlow`
- [x] 蓝门优先（捡材料） — 开启时把 ROSBOT 插件 BlackWhiteGay 的 `rsttcp.cfg` 写 `enableBlue=False`（蓝门结束不再断线快退，先捡材料），其他键保留；ROSBOT 下次启动生效 — `Services/RosbotPluginConfigSync`
- [x] 初生蓝门复用 — `Services/RosbotLogAnalyzer`
- [x] 拾取血岩 — 写 ROSBOT 插件 ExtPickup 的 `extpick.cfg`（`pickup=` 全部 8 种碎片物品 / 关闭时清空），插件在升级宝石结束后拾取；ROSBOT 下次启动生效 — `Services/RosbotPluginConfigSync`
- [x] 智能回响开关 — `Services/RosbotSmartEchoCoordinator`
- [x] 智能回响等待秒数 — F7 暂停后等待该秒数才开始 OCR 恢复检测（之后仍有 60 秒上限） — `RosbotSmartEchoCoordinator`
- [x] 测试模式 + 测试超时 — `Core/Flow/F3LogTimeout`
- [~] 防卡住 — ROSBOT 及其插件（ExtPickup / BlackWhiteGay / BWGComprehensive / HCHelp）都没有对应开关；ROSBOT 自带的 `Stuck time detection` 是毫秒数且本机无 `RoS-BoT.ini`
- [x] 开机启动 — 在当前用户 Startup 目录维护指向本程序 exe 的 .lnk，随配置创建/删除，启动时同步 — `Services/StartupShortcutService`、dotcore `StartupShortcut`
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
- [x] 暂停/恢复测试 — 日志页按钮，1:1 Python `do_rosbot_test_pause_resume` — `Services/RosbotPauseResumeTestService`

## 4. D4 页
- [x] 挂经验启停（组队检查在后台） — `ViewModels/D4ViewModel`、`Ctl/D4TickLoop`
- [x] 组队检查 + 自动组队 — `D4TeamFormationChecker`、`D4AutoTeamFormation`
- [x] 切图检测 — `D4MapSwitchDetector`
- [x] 地图名 OCR — `D4MapNameRecognizer`
- [x] 小地图位置（城镇/地下城） — `D4SmallMapDetector`
- [x] 队伍血量 — `D4TeamHealthDetector`
- [x] 地下城进度 — 进度条区域按列亮度计算百分比，每个 D4 tick 更新 — `Core/D4/D4DungeonProgressDetector`
- [x] 坐标/尺寸/窗口模式/切图计数/状态 — `D4UiStatusUpdater`
- [x] 调试图像窗口 — `Windows/D4DebugWindow`（模板路径已修正，`SourcePaths`）
- [x] D4 事件（仅日志） — `D4EventManager`
- [x] 截图与标注保存 — `D4Pipeline.SaveScreenshotAndAnnotate`
- [x] D4 日志 — `Pages/D4/D4Page`
- [x] 从战网启动 D4（DOT） — `LoginTryController.EnsureD4RunningFromBattlenet`
- [x] 记住挂经验状态 — 启动时若上次在挂且 D4 在运行则自动恢复 — `D4ViewModel.RestoreRunningAsync`
- [x] 红门检测 — 每个 D4 tick 检测并记录（出现时记日志） — `D4Pipeline.DetectFrameMarkers`

## 5. 坐标校准页
- [x] 客户端类型（战网/D3/D4） — `CalibrationPage.OnClientTypeChange`
- [x] 截图 → 坐标拾取器（点/矩形/圆、历史、重命名、撤销、导出） — `Windows/CoordinatePickerWindow`
- [x] 模板匹配助手 — `Windows/CoordinatePicker/TemplateMatcherHelper`
- [x] 录制配置 / 录制启停（原生 `DotCore.YoloRecord`） — `CalibrationPage`
- [x] 工程创建/切换/打开目录、片段表、右键菜单、合并/导出/删除、补丁导入 — `CalibrationPage`
- [x] 标注（全功能标注器：缩放平移、移动/调整框、撤销重做、复制上一张、快捷键、类别增删改排序/颜色并同步全项目标注、AI 预标注、可配置设置） — dotcore `DotCore.VocAnnotatorUI.AnnotatorWindow`
- [x] YOLO 训练（DOT，Python 未接线）：环境探测（GPU / Python / torch CUDA / Ultralytics）与推荐参数、全部训练参数可配置、训练集划分（训练/验证/测试比例、种子、分层、负样本上限）与预览、实时日志与轮次进度、停止、导出 ONNX、设为寻路模型 — `Windows/YoloTrainingWindow`、`Services/YoloTrainingService`、dotcore `DotCore.YoloTrain`
- [x] 清理未标注 / 加载工程 — `CalibrationPage`、dotcore `AnnotationCleanup`
- [x] 特定训练（任务集，DOT）：目标 1/2/3、变体 1.x（文件导入或从大图/视频截取，矩形或智能抠图）、目标专属场景、公共图集/视频集，全局与按目标增强（拉伸/旋转/缩放/左右拉伸等），一键生成自动标注的合成训练集并训练 — `Windows/TaskSetWindow`、`Windows/VariantExtractWindow`、训练窗口“特定”模式、dotcore `DotCore.YoloTaskSet`（设计：dotcore/docs/YOLO_TASKSET_SYNTHESIS_DESIGN.md）

## 6. 日志页
- [x] 背包识别测试（打印背包布局）/ 黄装升级（卡奈升级）/ 重铸装备（卡奈重铸） — `GameAssistantController.RegisterTestActions`
- [x] 测试寻路 — YOLO NPC 模型（类别 blacksmith / kanai_cube / stash / waypoint）识别城里的铁匠、卡奈魔盒、仓库、传送点，并点击走向 `navigation.target`，直到目标够近或步数用完；再点一次按钮停止。模型取 `navigation.npc_model_path`，为空时用 YOLO 数据根目录下最新的 `best.onnx`；训练窗口训练结束后自动导出 ONNX，并可一键“设为寻路模型” — `Core/Navigation/D3TownNavigator`、`Services/TownNavigationTestService`、dotcore `DotCore.YoloDetect`。数据集待采集训练
- [x] 调试卡奈升级 / 卡奈重铸 / 自动分解（仅调试，不点击）/ 声音 — `GameAssistantController.RegisterTestActions`（截图→界面识别→背包采集→对应流程，忽略功能开关）
- [x] 调试血岩 / 拾取 / 转换 / 丢装 / 暂停 — 只读预览（背包空格、将丢/保留件数、按品质统计、热键与前台状态），不点击
- [x] 调试铁匠（背包悬停 + 真实分解） — `GameAssistantController.RunDebugBagHoverWithSalvage`
- [x] 调试战网 UI JSON / 调试 ROSBOT — `BattlenetUiAnalyzeService`、`RosbotDebugService`
- [x] 调试：刷新战网/D3/D4 状态（DOT） — `Services/GameStatusDebugService`
- [x] 清除/保存日志、DEBUG 开关、自动滚动、级别过滤、检查日志区域 — `RunLogPage`
- [x] 系统资源（系统/本程序/战网/D3/D4/ROSBOT 的 CPU/内存/显存/GPU，可见时每秒） — `Components/ResourceMonitorBlock`、dotcore `SystemResourceSampler`

## 7. 状态栏
- [x] 当前配置、战网（细分客户端状态 + 区服）、ROS、D3、地图、阶段、油猴、窗口尺寸、测试模式 — `StatusBar/D3StatusBarDisplayBuilder`
- [x] 路径芯片 + ROS 版本、一键扫描（启动/区服变化/路径不符自动触发，5 秒节流） — `MainWindow`
- [x] 扫描结果弹窗（全部未找到时列出缺失项；扫描异常弹错误框） — `MainWindow.ShowScanNothingFound`

## 8. 标题栏 / 窗口
- [x] 拖动/双击最大化、语言、主题（DOT）、最小化/最大化/关闭、恢复尺寸、重启程序、几何与上次页签保存 — `Components/TitleBarControl`、`MainWindow`、`ShutdownManager`

## 9. 系统托盘
- [x] 显示/最大化/重启/调试切页/退出 — `Services/TrayIconService`
- [x] 托盘通知 — ROSBOT 启动成功/失败、停止时弹托盘气泡 — `EventCenter.NotifyTray`

## 10. HTTP 桥（127.0.0.1:8765）
- [x] 状态/配置查询、宏启停、配置切换与保存、OAuth、YOLO 录制与片段接口 — `Services/D3D4TesterHttpBridge`
- [x] `/api/config/update` — 写配置后经变更通知重载运行中的宏

## 11. 定时与一次性任务
- [x] 1 秒 TickDriver（流程 %2、回响 %3、10 秒探测）、窗口监视、ROSBOT 日志跟踪、路径扫描、D4 3 秒循环 — `Core/Flow/TickDriver`、`Services/WindowMonitorService`、`Ctl/D4TickLoop`

## 12. 战网 / ROSBOT 流程
- [x] B 块（启动、托盘恢复、国服/亚服登录、网页登录自动化、弹窗关闭、确认） — `Core/Flow/BattlenetReadyProcess`、`Core/Battlenet/BrowserLoginAutomation`
- [x] 仅确保战网流程 + 全局守护（DOT：默认开） — `Core/Flow/BattlenetGuardRunner`、`BattlenetGuardService`
- [x] 守护规则（DOT）：先确保区服（`--setregion`）、异常超时重启、登录超时重启；安全验证/验证码期间不重启 — `Core/Flow/BattlenetReadyProcess`
- [x] 战网客户端状态探测（DOT，含安全验证、等待验证码、登录中、载入账户等） — `BattlenetClientStateDetector` + `IBattlenetOperation.ClassifyClientState`
- [x] B/D 块的界面判断（`GetDynamicState`）与状态中心共用同一个分类器（首页无开始按钮也算已登录，不再超时误杀） — `BattlenetOperationBase.GetDynamicState`
- [x] 程序日志按天落盘，战网的每次启动/关闭都记录状态与调用来源 — `ColorPrinter.EnableFileLog`、`~/.core_node/.d3check/logs/`
- [x] 安全验证页自动点 Continue（id `submit`，60 秒内只点一次，发送验证码邮件） — `BrowserLoginAutomation.SubmitSecurityCheck`，由 `BattlenetReadyProcess` 在安全验证状态时调用
- [~] 验证码输入页（"Please enter the security code sent to: …"，Resend code / Submit / Go Back）— 已识别并等待人工输入；验证码只在邮箱里，程序不能自动填写
- [x] 战网只在断线 / 登录失败 / 超时时重启：正常 / 弹窗 / 游戏启动中一律复用，托盘隐藏只恢复显示 — `BattlenetReadyProcess`、`BattlenetManager.ShowHiddenClient`
- [x] 登录中 / 安全验证 / 邮件与验证码页期间绝不关闭或重启战网 — `BattlenetManager.Close`（现场探测后拒绝）、`BattlenetReadyProcess` 等待用户状态不计超时
- [x] 密码输入改为键盘逐字输入（网页表单不接受 ValuePattern 直接赋值） — `BrowserLoginAutomation.Fill`、`BattlenetAsiaOps.FillField`
- [x] 多账号（DOT，国服/亚服分开、加密、头像菜单退出切换） — `Config/BattlenetAccountService`、`Pages/Battlenet`
- [x] D 块（启动 D3/D4）、C 分支（C1–C12）、E 块（启动 ROSBOT）、F0–F4、日志掉线重启、系统错误、无物品弹窗、智能回响、“必须启动 D3”弹窗 — `Core/Flow/RosbotFlowRunner`（流程驱动）、`Core/Flow/*Process`、`Ctl/RosbotRunFlow`、`Ctl/LoginTryController`（手动）、`Services/RosbotLog*`

## 13. D3 检测
- [x] D3 窗口查找、掉线/菜单/游戏中、界面类型、背包与品质、Kanai 页状态、D3 状态截图 — `D3WindowFinder`、`Ctl/D3StatusProvider`、`D3InterfaceDetection`、`Core/Bag/*`、`D3ScreenState`

## 14. 反编译页（DOT）
- [x] 工具一键下载/修复到数据目录 `~/.core_node/.d3check/tools`：ILSpy（ilspycmd 8.2，需 .NET SDK，以 roll-forward 运行在 .NET 8）、de4dot-cex 4.0、autoit-ripper 1.2（需 Python）、UPX 5.2.1 — dotcore `DotCore.Decompile.DecompileTools`
- [x] 一键反编译 ROSBOT：主程序 de4dot 去混淆 + ILSpy（项目输出失败时改单文件输出），全部托管插件 DLL，生成 `settings_fields.md`（306 个设置项 = RoS-BoT.ini 键）；主程序受 DNGuard HVM 保护，41463 个方法体为运行时解密的占位代码 — `Services/DecompileService`
- [x] 一键反编译 RBAssist（AutoIt 编译程序）：autoit-ripper 提取 `script.au3` + 内嵌文件，带 UPX 段时先 `upx -d` 再提取；路径自动在 ROSBOT 目录附近查找，可浏览选择
- [x] 任意文件：自动识别 .NET / AutoIt / 原生（原生报告不支持），输出到 `~/.core_node/.d3check/decompiled`

## 待办
1. 防卡住：ROSBOT 与插件无对应设置。
2. 城镇寻路：采集并训练 blacksmith / kanai_cube / stash / waypoint 数据集。
3. 坐标与阈值需在游戏内验证：卡达拉连点、快速拾取半径、丢装落点、地下城进度亮度阈值、双爆 OCR 关键词。

## 统计
| 区域 | [x] | [~] | [ ] |
|---|---|---|---|
| 主页 | 16 | 0 | 0 |
| 辅助自动化 + 战网守护 | 18 | 0 | 0 |
| ROSBOT | 19 | 1 | 0 |
| D4 | 15 | 0 | 0 |
| 坐标校准 | 7 | 0 | 0 |
| 日志页 | 9 | 0 | 0 |
| 状态栏/标题栏/托盘/HTTP/定时 | 9 | 0 | 0 |
| 流程 / D3 检测 | 13 | 1 | 0 |
| **合计** | **106** | **2** | **0** |

剩余 `[~]`：防卡住（ROSBOT 无对应设置）、验证码只能人工输入。
