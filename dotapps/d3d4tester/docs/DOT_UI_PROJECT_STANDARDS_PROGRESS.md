# d3d4tester .NET UI Project Standards – Progress

Progress checklist + code conventions for d3d4tester & dotcore. Canonical rules: [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md); app layout, i18n, theme and build/run: [DOT_PROJECT_STANDARDS.md](DOT_PROJECT_STANDARDS.md). This doc does not redefine them.

---

## 完成率 (Completion rate)

**100%.**

| Phase | Scope | Status |
|-------|--------|--------|
| Phase 1 | Directory & naming (Panels→Pages, Assets/ViewModels/Converters) | Done |
| Phase 2 | MVVM (BaseViewModel, RelayCommand, ViewModels per page, Converters) | Done |
| Phase 3 | Services, Fluent 2 (DotCore.UITheme 样式/明暗主题/Mica/动效), Domain/ApplicationServices/Infrastructure 分层 | Done |
| Phase 4 | Tab/GetPage, 变量与注释统一为 Page | Done |
| Options Pattern | 配置读 `GetOptions<T>`、写 `SetValueAsync`；控件绑定 `ConfigBinding` | Done |
| 配置 vs 内存数据中心化 | 区分明确 + `InMemoryCentersCatalog` 单源清单 | Done |
| Python 1:1 port | pyapps/d3-check 全量移植，见 [PY_DOT_PORT_MAP.md](PY_DOT_PORT_MAP.md) | Done |

Tab content = `Pages/<Feature>/<Feature>Page.xaml` (Main, Rosbot, D4, Calibration, RunLog). MainWindow = shell (`ShellWindowStyle`); dialogs under `Windows/` use `DialogWindowStyle`.

---

## 5. Configuration vs in-memory data centralization

两种中心化，不可混用。

### 5.1 配置中心化 (Configuration) — 来自文件

- 来源：用户 JSON 配置（与 Python d3-check 共用，schema 一致）。
- 读：`ConfigOptionsProvider.GetOptions<T>()`（Options POCOs，`Config/Options/`）；不在业务代码中散读键值。
- 写：`D3D4TesterConfigService.Instance.SetValueAsync(key, v)` + `QueueSave()`；键路径常量在 `Constants/ConfigKeys.<Area>.cs`。
- 控件 ↔ 配置：仅 `Config/ConfigBinding`（`BindCheckBox`/`BindTextBox`/`BindIntTextBox`/`BindComboBox`/`BindOffsetTextBox`，`Save*`）。
- 特例：`MacroConfigLoader`（嵌套结构）、`AsiaCredentialsService`（加密）直接读 Config。

### 5.2 内存数据中心化 (In-memory) — 运行时状态

- 来源：内存（运行时计算、服务状态、回调更新），不持久化。
- **全局状态中心（单一数据源）**：`GameInterfaceData.Instance`（`GetStateSnapshot()`、`RegisterCallback`/`NotifyCallbacks`、`SetMarshalToUi`）。战网（窗口、动态三态原子写入、区域）、D3（运行、菜单/掉线/游戏中、窗口几何 hwnd/标题/偏移/全屏尺寸）、ROSBOT、流程开关都只存这一份；D4 是它的分区 `GameInterfaceData.Instance.D4`（= `D4InterfaceData.Instance`）。`RosbotFlowState` 只是视图，不持有副本。`Set*` 返回是否变化，写入方据此只通知一次。禁止在 Provider/Service 里另存同一事实（如私有静态几何）。
- **单一检测/控制**：战网 → `BattlenetManager`（`GetPath`/`HasWindow`/`GetProcess`/`Start` 幂等/`RestoreFromTray`/`ActivateWindow`）；D3/D4 窗口 → `GameWindowManager` 子类 `D3Manager`/`D4Manager`；区域 → `BattlenetStatusProvider.EnsureBattlenetRegionFromConfig`；路径有效性 → `PathScanner.IsValidExePath`/`IsRosPathUsable`。不再自写 `Process.GetProcessesByName` 或标题列表。
- **启动幂等**：先查中心/管理器，缺失才动作。战网 B 块（tick）与 D 块（`LoginTryController`：托盘恢复 → 登录确认 → 游戏页签 + Play → 轮询窗口）是唯一启动路径；D3 用 `EnsureD3RunningFromBattlenetNoRosbot`，D4 用 `EnsureD4RunningFromBattlenet`（D4 页“启动D4”）。
- **战网客户端状态（国服/亚服分实现）**：国服、亚服战网 UI 与流程不同，各自实现 `IBattlenetOperation`（`BattlenetOperationCn` / `BattlenetOperationAsia`），共享逻辑在 `BattlenetOperationBase`。界面状态由 `ClassifyClientState` 判定：公共部分（睡眠、浏览器等待、登录失败、掉线、连接中、启动中、正常、载入中）在基类，登录界面由各区实现 `ClassifyLoginScreen`（国服：网易协议页 `LoginCn`、网页登录弹窗 `LoginCnWeb`；亚服：邮箱 / 密码 / 其他登录页）。`BattlenetClientStateDetector` 只负责遍历所有可见战网窗口、按 UI 精确 id 选区服实现（`game-nav-btn-D3CN`/`ntes`/`LoginPopupWindow` = 国服，`game-nav-btn-D3`/`accountName`/`password` = 亚服，禁止子串匹配），结果写入 `GameInterfaceData`（`BattlenetClientState`、`BattlenetUiRegion`，三元组由它派生），状态栏按 `ui.rosbot.battlenet_state.*` 显示。被动探测每 10 秒一次（`WindowMonitorService`，TickDriver %10；BN-only 开启时由其 2 秒刷新代替），不点击、不激活窗口。新增界面信号先用 `scripts/bnprobe.ps1`（幂等构建 `tools/BnProbe` 并实地扫描，输出 `<CN_CACHE_ROOT>/bnprobe/*.json`）验证，再改常量。
- **检测刷新唯一入口**：`RosbotTaskProcessor.RefreshAllGameStatus`（战网 → D3（可选动态截图）→ D4 运行 → ROSBOT → 一次通知）；窗口监视器与 RunLog“刷新战网/D3/D4状态”调试按钮都走它，不另写刷新序列。
- **权威清单**：`Core/InMemoryCentersCatalog.cs`（中心、访问入口、线程契约）。新增共享状态必须先登记到该清单，不新增散落的可变 static。
- **UI 绑定**：ViewModel 取快照或订阅回调；后台线程经 Dispatcher marshal 到 UI 线程（见 [DOT_TAB_UI_FREEZE_DESIGN.md](DOT_TAB_UI_FREEZE_DESIGN.md)、[ENTRY_AND_DATA_ARCHITECTURE_1TO1.md](ENTRY_AND_DATA_ARCHITECTURE_1TO1.md) §2）。
- 按页/控件持有的实例（如 Calibration 页 `YoloCalibrationData`、各页 ViewModel）不列入清单，其数据仍来自中心或 Config。

---

## 6. DOT code conventions

- **Language:** code, comments, XML docs, logs, names in English; UI text via i18n.
- **Naming:** PascalCase public/types/constants; camelCase locals/parameters. Roles: **Provider** = single source/capture; **Service** = stateless/shared; **Manager** = process/config/lifecycle; **Controller** = UI/flow. Shared instances via one getter (e.g. `GetScreenshotProvider`, `GetTemplateMatcher`).
- **Constants:** no magic literals in public defaults; named constants (e.g. `ScreenCaptureConstants`, `TemplateMatcherService.DefaultThreshold`).
- **Structure:** usings at top; one responsibility per type; no circular refs (fix by layering, not lazy load).
- **Layers:** Entry (WPF app) → Controller (`Ctl/`, `D3D4TesterCore`) → Service (`DotCore.*`) → Shared (`DotCore.Common`/`Foundations`) + Config/Const (`Constants/`, `I18n/`).
- **Reuse:** extend existing DotCore / D3D4TesterCore types before adding new ones.
- **Exceptions:** try/catch only where failure cannot be avoided by preconditions (OS/COM/IO).

**Quick reference:** capture → `ScreenCaptureService.GetScreenshotProvider()`; matcher → `TemplateMatcherService.GetTemplateMatcher()`; scaled D3 templates → `D3ScaledTemplateMatcher`; periodic work → `TickDriver.Instance.Register*`; debug buttons → `TestActionRegistry.Register(i18nKey, action)`.
