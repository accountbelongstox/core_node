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
- **单一数据源**：UI 所需运行时状态只从一个中心获取，禁止多处维护同一状态。游戏/BN/ROSBOT 状态 → `GameInterfaceData.Instance`（`GetStateSnapshot()`、`RegisterCallback`/`NotifyCallbacks`、`SetMarshalToUi`）；D4 状态 → `D4InterfaceData.Instance`；流程开关 → `RosbotFlowState.Instance`。
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
