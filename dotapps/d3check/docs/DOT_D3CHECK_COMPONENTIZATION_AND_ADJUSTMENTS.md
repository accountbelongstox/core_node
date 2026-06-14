# D3Check DOT: Build Fix and Componentization Review

Build fixes applied + alignment review. **Layout, layers, naming:** [DOT_UI_PROJECT_STANDARDS_PROGRESS.md](DOT_UI_PROJECT_STANDARDS_PROGRESS.md) and [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md).

---

## 1. Build Fixes Applied

| Issue | Location | Fix |
|-------|----------|-----|
| `DispatcherPriority` does not exist in the current context | `Pages/LogPage.xaml.cs` line 159 | Use fully qualified name: `System.Windows.Threading.DispatcherPriority.Normal`. The WPF temporary compilation context may not resolve `DispatcherPriority` from `System.Windows.Threading` when only the short name is used. |
| `WindowsGlobalHotkeyService` could not be found | `MainWindow.xaml.cs` line 35 | Add `using DotCore.Utils;` so the type from DotCore.Utils is in scope for the code-behind (and for the WPF markup compiler temp project). |

After these changes, `dotnet build dotapps/d3check/d3check.csproj` and `dotnet run --project dotapps/d3check/d3check.csproj` succeed.

---

## 2. Current State (references only)

See [DOT_UI_PROJECT_STANDARDS_PROGRESS.md](DOT_UI_PROJECT_STANDARDS_PROGRESS.md) §1–2, §6. Dependency: d3check → DotCore.* + D3CheckCore; D3CheckCore → DotCore.* only. MainWindow wires Config, Hotkeys, controllers, pages; singletons/getters; threading per [DOT_TAB_UI_FREEZE_DESIGN.md](DOT_TAB_UI_FREEZE_DESIGN.md).

## 3. Gaps vs Official / Recommended Design

### 3.1 Microsoft DI Guidelines (summary)

- Prefer **small, well-factored, testable services**; avoid **stateful static members** and **global state**; use **singleton services** from a container where appropriate.
- Avoid **captive dependency** (e.g. singleton holding a scoped dependency).
- Prefer **constructor injection** over static getters when testability and explicit dependencies are desired.

Reference: [Dependency injection guidelines - .NET](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-guidelines).

### 3.2 WPF / Structure

- **Target structure**: For View/ViewModel separation and Presentation folder layout, follow [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) (canonical).
- **Current state**: d3check uses mostly code-behind and shared state (GameInterfaceData, Config, etc.) with little ViewModel layer; MainWindow and pages mix UI wiring and logic. Acceptable for this tool; optional refactor toward MVVM later.

### 3.3 Current Shortcomings

| Area | Issue | Risk |
|------|--------|------|
| **Singleton / static access** | Widespread `*.Instance` and static getters (Config, GameInterfaceData, AssistantExecutionState, etc.) | Global state, harder to test and to swap implementations. |
| **No DI container** | All wiring in MainWindow.OnLoaded (create service, create binder, set callbacks, initialize) | MainWindow knows every dependency; adding a feature touches the shell. |
| **Controller creation** | Controllers created in MainWindow or page and hold references to Config/state | Lifecycle and ownership are implicit; captive dependency risk if a “singleton” controller outlives a scope. |
| **Page–state coupling** | Pages call `D3CheckConfigService.Instance`, `GameInterfaceData.Instance`, `ColorPrinter.*` directly | Pages are not pure views; testing requires global state or refactor. |
| **DispatcherPriority / Utils** | LogPage and MainWindow relied on type resolution that failed in WPF temp project | Build fragility; full qualification / explicit usings reduce it. |

---

## 4. Recommended Adjustments

### 4.1 Keep (no change)

- **dotcore / dotapps / D3CheckCore** layout and dependency direction.
- **Hotkeys**, **Config**, **Ctl**, **D3CheckCore** as separate folders/assemblies with clear responsibilities.
- **Marshal and Dispatcher** usage as in DOT_TAB_UI_FREEZE_DESIGN.md (SetMarshalToUi, BeginInvoke, ApplicationIdle for tab switch).
- **Build fixes**: keep `System.Windows.Threading.DispatcherPriority` in LogPage and `using DotCore.Utils` in MainWindow.

### 4.2 Short-term (low risk)

1. **Explicit usings in code-behind**
   - In any XAML code-behind that uses types from DotCore or D3CheckCore, add explicit `using` for the defining namespace (e.g. `DotCore.Utils`, `DotApps.d3check.Core`) to avoid WPF temp project resolution issues.

2. **DispatcherPriority**
   - Prefer full name `System.Windows.Threading.DispatcherPriority` in all XAML code-behind (e.g. LogPage, RosbotPage, MainWindow) for consistency and to avoid context-dependent resolution.

3. **Document singleton usage**
   - In DOT_UI_PROJECT_STANDARDS_PROGRESS or a short “Architecture” section, state that d3check currently uses singleton/static getters by design (no DI container), and that new features should obtain services via these getters rather than new global state.

### 4.3 Medium-term (optional, when touching startup or testing)

4. **Introduce a small DI container at startup**
   - Use the built-in `Microsoft.Extensions.DependencyInjection` (or keep current manual wiring). Register: Config (singleton), GameInterfaceData (singleton), AssistantExecutionState (singleton), HotkeyService, HotkeyBinder, and controllers as needed. MainWindow (or an AppBootstrapper) resolves from the container instead of creating everything by hand. This aligns with “design services for DI” and makes dependencies explicit.

5. **Inject interfaces into controllers and binder**
   - Define narrow interfaces (e.g. `IConfigService`, `IAssistantExecutionState` already exists). Controllers and D3CheckHotkeyBinder take these in the constructor (or via setters before Init). Reduces direct dependency on concrete singletons and improves testability.

6. **Limit MainWindow responsibilities**
   - Move hotkey wiring, timer setup, and ColorPrint routing into a dedicated “shell controller” or bootstrap class that receives the necessary services and configures MainWindow. MainWindow then only handles window and tab UI and delegates to that class. Keeps MainWindow smaller and separates orchestration from view.

### 4.4 Long-term (if moving toward MVVM)

7. **Introduce ViewModels for main tabs**
   - One ViewModel per main area (e.g. Rosbot, Log, Main options). Pages bind to ViewModel properties/commands; code-behind only for view-only behavior. State (GameInterfaceData, Config) is updated by controllers or services; ViewModels observe or are fed by them. This would be a larger refactor and is optional unless the team commits to MVVM.

8. **Avoid new static/global state**
   - For new features, prefer services registered in a container or passed explicitly (constructor/setter) instead of new `*.Instance` singletons, to stay consistent with Microsoft’s “avoid global state” and “singleton services” guidance.

---

## 5. Summary Table

| Item | Status | Action |
|------|--------|--------|
| Build (LogPage DispatcherPriority) | Fixed | Use `System.Windows.Threading.DispatcherPriority.Normal` |
| Build (MainWindow WindowsGlobalHotkeyService) | Fixed | Add `using DotCore.Utils;` |
| Layout (dotcore / dotapps / D3CheckCore) | OK | Keep |
| Layers (Entry / Controller / Service / UI) | OK | Keep; document in standards |
| Singleton / no DI | Acceptable | Document; consider optional DI later |
| Code-behind vs MVVM | Acceptable | Optional ViewModels later |
| Explicit usings / full type names in code-behind | Recommended | Apply to new and touched files |
| Optional DI + interfaces | Recommended (medium-term) | When adding features or improving tests |

---

## 6. References

- [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) – Layout and dependencies.
- [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc) – Dot rule (language, layout, naming).
- [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) – **Canonical** UI/Presentation spec (Clean Architecture + MVVM + Fluent 2); [.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc).
- [DOT_UI_PROJECT_STANDARDS_PROGRESS.md](DOT_UI_PROJECT_STANDARDS_PROGRESS.md) – d3check layers (roles), naming, constants.
- [DOT_TAB_UI_FREEZE_DESIGN.md](DOT_TAB_UI_FREEZE_DESIGN.md) – Threading and Dispatcher usage.
- [Dependency injection guidelines - .NET](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-guidelines) – Service design, lifetimes, anti-patterns.
