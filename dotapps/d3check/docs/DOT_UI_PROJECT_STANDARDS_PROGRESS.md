# D3Check .NET UI Project Standards – Progress

Single DOT standards doc for d3check & dotcore: **progress checklist** + **code conventions**. UI/structure/MVVM/Fluent 2: canonical [DOT_UI_PROJECT_SPECIFICATION.md](../../../development-guides/DOT_UI_PROJECT_SPECIFICATION.md) and [.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc); this doc does not redefine them.

---

## 完成率 (Completion rate)

**100%.** Phase 1–4, Phase 3 optional items, Options Pattern, and 配置中心化 vs 内存数据中心化（含一览）done.

| Phase | Scope | Status |
|-------|--------|--------|
| Phase 1 | Directory & naming (Panels→Pages, Assets/ViewModels/Converters) | Done |
| Phase 2 | MVVM (BaseViewModel, ViewModels per page, Converters, Commands) | Done |
| Phase 3 | Services, Fluent 2 占位/分组/分层/明暗主题/Mica/动效 | Done |
| Phase 4 | Tab/GetPage, 变量与注释统一为 Page | Done |
| Options Pattern | IOptions from user config; no raw Configuration key | Done |
| 配置 vs 内存数据中心化 | 区分明确 + 内存中心一览 + 配置读 GetOptions/写 SetValueAsync + **内存数据代码规范化**（推荐构架使用文档 + 单源/marshal 落实） | Done |

**Phase 4:** TabMainPanel→TabMainPage, GetPanel→GetPage, IMainWindowHost/GetPage, 局部变量与注释 *Panel→*Page, AppConstants/DOT_TAB_UI_FREEZE_DESIGN, TabIndexRosbot=1 — Done.

**Phase 3:** BnUiDebugPaths→Services, Fluent 2 Styles/Themes/Motion, Pages 按功能分组, Domain/ApplicationServices/Infrastructure, MicaBackdropHelper — Done.

---

## 1. Target layout (canonical spec)

[DOT_UI_PROJECT_SPECIFICATION.md](../../../development-guides/DOT_UI_PROJECT_SPECIFICATION.md) §1–§3: Domain→Application→Infrastructure→Presentation; Presentation = Assets/, Components/, Pages/, ViewModels/, Services/, Converters/; [Feature]Page.xaml, [Feature]ViewModel.cs, I[Name]Service, [Action]Command, [Method]Async.

---

## 2. Current state

Tab content = Pages/[Feature]/[Feature]Page.xaml (Main, Rosbot, D4, Calibration, Log). Components/TitleBarControl, Windows/CredentialsDialog. Assets (Fonts/Images/Styles), ViewModels/Base, Converters, Services. MainWindow = shell; tabs host Pages. Domain/ApplicationServices/Infrastructure in place; D3CheckCore unchanged.

---

## 3. Phase 1–4 checklists

- **Phase 1:** Panels→Pages/Main|Rosbot|D4|Calibration|Log, MainWindow GetPage/TabMainPage, AppConstants PanelKey* kept, Assets/ViewModels/Converters, Panels removed or empty, build/run OK.
- **Phase 2:** BaseViewModel, RelayCommand, Converters in App.xaml, ViewModels per page, SkillRowViewModel in ViewModels/, MainPage binding, build/run OK.
- **Phase 3:** Services 规范化, Fluent 2 占位与 Themes/Motion, 按功能分组, 分层, MicaBackdropHelper.
- **Phase 4:** TabMainPage, GetPage, *Page 变量与注释.

---

## 4. Build and run

```bash
dotnet build dotapps\d3check\d3check.csproj
dotnet run --project dotapps\d3check\d3check.csproj
```

---

## 5. Configuration vs in-memory data centralization

Two different centralization patterns; do not confuse.

---

### 5.1 配置中心化 (Configuration centralization) — 来自文件

**用途：** 持久化配置（用户设置、API 地址、功能开关等），来源是 **配置文件**（appsettings.json、用户 JSON）。

**方案：Options Pattern (`IOptions<T>` / `IOptionsSnapshot<T>`)**  
通过依赖注入将配置注入到服务中；支持配置热重载 (`IOptionsSnapshot`) 和验证。不在业务代码中散写 `Configuration["Key"]`。

```csharp
// 1. 定义配置类 (POCO)
public class AppSettings
{
    public string ApiUrl { get; set; }
    public int TimeoutSeconds { get; set; }
    public FeatureFlags Features { get; set; }
}

// 2. 注册服务 (Program.cs / 宿主)
// 将 appsettings.json 的 "App" 节点绑定到类
builder.Services.Configure<AppSettings>(
    builder.Configuration.GetSection("App"));

// 3. 在服务中使用 (注入 IOptions)
public class DataService
{
    private readonly AppSettings _settings;

    public DataService(IOptions<AppSettings> options)
    {
        _settings = options.Value; // 安全访问配置
    }
}
```

**d3check 现状：** ConfigOptionsProvider 从用户 JSON 绑定到 Options POCOs；**所有配置读取**均通过 `ConfigOptionsProvider.GetOptions<T>()`（MainWindow、LogPage、RosbotPage、CalibrationPage、RosbotUpdateManager、RosbotFlowController、RosbotRunFlow、BattlenetLoginCtl、RosbotStatusProvider、D3CheckI18n、YoloCalibrationData、CombatMacroController、D3CheckHotkeyBinder 等）；写仍经 D3CheckConfigService.SetValueAsync + QueueSave。MacroConfigLoader/AsiaCredentialsService 因嵌套或加密仍直接读 Config，属特例。常量与默认值仍用命名常量（见 §6）。

---

### 5.2 内存数据中心化 (In-memory data centralization) — UI 数值/运行时状态

**用途：** UI 上展示的 **运行时数据**（如状态网格、计数、游戏/BN/ROSBOT 状态），来源是 **内存**，不绑定配置文件。

**与配置中心化的区别：**

| 维度 | 配置中心化 (§5.1) | 内存数据中心化 (§5.2) |
|------|-------------------|-------------------------|
| 数据来源 | 配置文件 (appsettings / 用户 JSON) | 内存（运行时计算、服务状态、回调更新） |
| 持久化 | 是（保存到磁盘） | 否（进程内单源，可选另存由 Config 负责） |
| 典型 API | `IOptions<T>`, `IOptionsSnapshot<T>`, `Configure<T>(GetSection(...))` | 单一数据源服务 + GetStateSnapshot / RegisterCallback / NotifyCallbacks；或 ViewModel 暴露属性 |
| 热重载 | IOptionsSnapshot 支持文件变更后下次请求生效 | 通过回调/事件/NotifyCallbacks 推送到 UI |
| 示例 | ApiUrl, TimeoutSeconds, FeatureFlags | 当前地图、队伍数、dungeon_progress、状态网格数值 |

**推荐构架（内存数据）：**

- **单一数据源**：所有 UI 需要的运行时状态从一个服务/Provider 获取，禁止多处维护同一份状态。参见 [ENTRY_AND_DATA_ARCHITECTURE_1TO1.md](ENTRY_AND_DATA_ARCHITECTURE_1TO1.md) §2 Data centralization。
- **d3check 对应：**  
  - 配置（键/持久化）→ D3CheckConfigService；读路径用 Options Pattern (§5.1)。  
  - 游戏/BN/ROSBOT 状态 → `GameInterfaceData.Instance`，`GetStateSnapshot()`，`RegisterCallback` / `NotifyCallbacks`，`SetMarshalToUi`。  
  - 路径/区域/凭证 → ConfigKeys + 对应 Service（如 AsiaCredentialsService）。
- **UI 绑定：** ViewModel 从上述服务取快照或订阅回调；通过 Dispatcher  marshal 到 UI 线程（见 [DOT_TAB_UI_FREEZE_DESIGN.md](DOT_TAB_UI_FREEZE_DESIGN.md)）。不新建全局静态状态；新功能通过既有 getter/注入获取服务。参见 [DOT_D3CHECK_COMPONENTIZATION_AND_ADJUSTMENTS.md](DOT_D3CHECK_COMPONENTIZATION_AND_ADJUSTMENTS.md) §4。

**推荐构架使用文档（内存数据中心化）：**

| 文档 | 内容 |
|------|------|
| [ENTRY_AND_DATA_ARCHITECTURE_1TO1.md](ENTRY_AND_DATA_ARCHITECTURE_1TO1.md) §2 | Data centralization：Config / GameInterfaceData / Paths·region / Credentials 单源对应表 |
| [DOT_TAB_UI_FREEZE_DESIGN.md](DOT_TAB_UI_FREEZE_DESIGN.md) | NotifyCallbacks 线程契约、SetMarshalToUi、Call sites 与 marshal 要求 |
| [DOT_D3CHECK_COMPONENTIZATION_AND_ADJUSTMENTS.md](DOT_D3CHECK_COMPONENTIZATION_AND_ADJUSTMENTS.md) §4 | Keep marshal/Dispatcher 用法；新功能通过既有 getter，不新增全局状态 |

**内存数据中心化代码规范化：** 已按推荐构架落实，并在**代码层**给出权威清单：`dotapps/d3check/Core/InMemoryCentersCatalog.cs`。运行时共享状态仅经 §5.2.1 一览表/清单中心访问（如 `GameInterfaceData.GetStateSnapshot/RegisterCallback/NotifyCallbacks`、`UiRegistry`、`BattlenetManager`、`RosbotDetection` 等）；MainWindow 已设置 `SetMarshalToUi`，后台线程调用 `NotifyCallbacks` 经 marshal 派发到 UI 线程；新增共享状态必须先登记到 `InMemoryCentersCatalog`，避免散落的非 readonly static 可变状态。完成率 **100%**。

**总结：** 配置中心化 = 文件 → IOptions；内存数据中心化 = 运行时单源服务 + 快照/回调 → ViewModel/UI。两者互补，不可混用。

---

#### 5.2.1 内存数据中心一览 (In-memory center data inventory)

以下为 d3check 中作为 **运行时单源** 的中心数据/服务；本表清单来自对 `dotapps/d3check/**/*.cs` 的代码扫描（static/Instance/Provider/NotifyCallbacks 等入口点），只通过表中入口访问，禁止多处维护同一状态。

| 中心 (Center) | 角色 (Role) | 访问方式 (Access) |
|---------------|-------------|-------------------|
| **GameInterfaceData** | 游戏/BN/ROSBOT 状态单源（窗口、区域、流程开关、地图/阶段、路径有效性、OAuth 等） | `GameInterfaceData.Instance`；`GetStateSnapshot()`、`RegisterCallback`/`UnregisterCallback`、`NotifyCallbacks()`；`UpdateFromPaths`、`SetBattlenetRegion`、`SetD3Status`、`SetRosbotFlowMasterEnabled`、`SetEnsureBattlenetOnlyEnabled` 等写入口 |
| **UiRegistry** | MainWindow/Shell 与页面解析、战斗宏控制器注册 | `RegisterMainUi(root, host)`、`UnregisterMainUi()`、`RegisterCombatMacroController`、`GetCombatMacroController()`、`GetRoot()`、`GetPage(key)` |
| **BattlenetManager** | BN 窗口检测、启动、PathProvider 注入 | `BattlenetManager.Instance`；`SetPathProvider`、`HasWindow()`、`Start()` 等 |
| **AssistantExecutionState** | 辅助宏执行状态（供热键/UI 查询是否正在执行） | `AssistantExecutionState.Instance` |
| **D3CheckI18n** | 当前语言与 UI 文案 | `D3CheckI18n.Provider`、`EnsureInitialized()`、`LanguageChanged` 事件 |
| **ColorPrinter** | 日志回调注册与分发（Log/ROS 等页订阅） | `RegisterCallback`、`UnregisterCallback`；非数据存储，仅分发 |
| **RosbotUpdateManager** | ROSBOT 更新检查、Downloads 目录、应用更新 | `RosbotUpdateManager.Instance`；`CheckUpdate()`、`ApplyUpdate()`、`GetDownloadsDir()`、`GetBattlenetRegion()` |
| **D3WindowFinder** | D3 窗口查找；路径由 Config 提供，结果为运行时 | `SetConfigPathProvider`、`GetConfiguredExePath()`、`FindFirstHandle()` |
| **MacroConfigLoader** | 宏配置加载（从 Config 读，提供内存中的技能配置结构） | `MacroConfigLoader.Instance` |
| **MacroFallbackRunner** | 技能配置提供者（静态委托）+ 回退执行 | `MacroFallbackRunner.Instance`；`SkillConfigProvider` |
| **RosbotDetection** | ROSBOT 进程/窗口检测（带 TTL 缓存） | `RosbotDetection.GetDetection(...)`；`RosbotDetection.InvalidateCache()` |
| **RosbotStatusProvider** | ROSBOT 状态刷新（内部持有 IRosbotOperation 单例） | `RosbotStatusProvider.Refresh()`；`RosbotStatusProvider.GetRosbotOperation()` |
| **DriveOrder** | 固定磁盘盘符列表缓存（供路径扫描） | `DriveOrder.GetFixedDriveRootsForScan(...)`；`DriveOrder.InvalidateCache()` |
| **D3CheckConfigChangeHub** | 配置变更通知中心（运行时事件） | `D3CheckConfigChangeHub.Notifier`；`D3CheckConfigChangeHub.Notify(keyPath)` |
| **SkillRowViewModel.StrategyDisplayNames** | UI 共享下拉显示列表（i18n 动态填充，XAML ItemsSource） | `SkillRowViewModel.StrategyDisplayNames`（由 MainPage 刷新 i18n 时填充） |
| **MainFunctionThreadRegistry** | 主线程注册（D3CheckCore 内流程用） | `MainFunctionThreadRegistry.Instance` |
| **D3StatusBarDisplayBuilder** | 状态栏文案与画刷键（由快照 + i18n 生成） | `D3StatusBarDisplayBuilder.Instance`；`Build(snapshot, i18n)` |
| **CombatMacroController** | 战斗宏开关状态与执行 | 经 `UiRegistry.GetCombatMacroController()` 获取；`Toggle()` 等 |
| **RosbotFlowController** | ROSBOT 流程状态与 Run/EnsureBattlenet 等 | 静态/单例用法；内部依赖 `GameInterfaceData`、`AsiaCredentialsService` 等 |
| **AsiaCredentialsService** | 亚服/国服凭证读写（持久化在 Config，解密后为内存数据） | `GetCredentials(region)`、`SaveCredentials`、`LoadCredentialsForUi`；`RegionAsia`/`RegionCn` |

**配置相关但不作为“内存中心”单列：** D3CheckConfigService（持久化键值 + 内存缓存）、ConfigOptionsProvider（IOptions 读路径）见 §5.1。  
**按页/控件持有、非全局单源：** 如 Calibration 页的 `YoloCalibrationData` 实例、各页 ViewModel，不列入上表；其数据来源仍应来自上表或 Config/Options。

---

## 6. DOT code conventions

- **Language:** All code, comments, XML docs, logs, names in **English**. UI text via i18n.
- **Naming:** PascalCase public/types/constants; camelCase locals/parameters. Roles: **Provider** = single source/capture; **Service** = stateless/shared; **Manager** = process/config/lifecycle; **Controller** = UI/flow. Single public entry for shared instances (e.g. GetScreenshotProvider, GetTemplateMatcher); callers use getters only.
- **Constants and config:** No magic literals in public defaults; named constants (e.g. ScreenCaptureConstants, TemplateMatcherService.DefaultThreshold). Config via Options Pattern (§5.1); in-memory UI data via single-source services (§5.2).
- **Structure:** Usings at top; one responsibility per type; no circular refs (fix by layering/DI, not lazy load).
- **Layers (d3check):** Entry (app/WPF), Controller (D3CheckCore), Service (DotCore.ScreenCapture/TemplateMatcher), Shared (DotCore.Common/Foundations), Config/Const (constants, I18n). Presentation layout: DOT_UI_PROJECT_SPECIFICATION.
- **Reuse:** Prefer extending existing DotCore/D3CheckCore over new types; get singletons via defined getters.
- **Exceptions:** try/catch only where preconditions cannot avoid failure (OS/COM/IO); document null/empty on failure in XML.

**Quick reference:** Shared capture → `ScreenCaptureService.GetScreenshotProvider()`; matcher → `TemplateMatcherService.GetTemplateMatcher()`; defaults → ScreenCaptureConstants / TemplateMatcherService.DefaultThreshold; code language English; PascalCase/camelCase as above.

*Aligned with pyapps/d3-check/docs/PROJECT_STANDARDS.md (relevant sections).*
