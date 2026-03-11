# .NET UI Project Specification (Clean Architecture + MVVM + Fluent 2)

**Canonical spec** for .NET UI projects under **dotapps** when using WPF, MAUI, Blazor Hybrid, or Avalonia. All other documents that describe UI or Presentation layer structure must defer to this spec. Combines **Clean Architecture**, **MVVM**, and **Microsoft Fluent 2** design. Cursor rule: [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc). Base layout and language: [DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md) and [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc).

---

## 1. Solution Architecture (Clean Architecture)

Use a **layered architecture** for logic decoupling. Standard solution structure:

### 1.1 Domain Layer (core)

- **Dependencies:** None (pure C# POCO).
- **Contents:** Entities, ValueObjects, Enums, and **interfaces** (e.g. repository interfaces). Core business logic; no UI or database framework dependencies.

### 1.2 Application Layer

- **Dependencies:** Domain.
- **Contents:** Use cases, DTOs, service interfaces, validators (e.g. FluentValidation). **CQRS** via MediatR (commands/queries) is the common practice.

### 1.3 Infrastructure Layer

- **Dependencies:** Application.
- **Contents:** Database (EF Core), external API clients, file system, authentication. All side effects live here.

### 1.4 Presentation Layer (UI)

- **Dependencies:** Application (not Infrastructure).
- **Contents:** UI framework code (WPF/MAUI/Blazor). Views (XAML/Razor), ViewModels, Converters, Styles. **No complex business logic** in this layer.

---

## 2. UI Directory Structure (Presentation Layer)

MVVM UI projects under **dotapps** should follow a clear folder layout. Example for one app:

```
dotapps/<AppName>/
├── App.xaml                    # Entry and resource dictionary merge
├── Assets/                     # Static resources
│   ├── Fonts/                  # Fonts (e.g. Segoe UI, Open Sans)
│   ├── Images/                 # Images (SVG, PNG)
│   └── Styles/                 # Global styles (Colors.xaml, Themes.xaml)
├── Components/                 # Reusable UI (UserControls)
├── Pages/   (or Views/)        # Page-level views
│   ├── Dashboard/
│   │   ├── DashboardPage.xaml
│   │   └── DashboardPage.xaml.cs
│   └── Settings/
├── ViewModels/                 # ViewModels (state and UI logic)
│   ├── Base/                   # BaseViewModel (INotifyPropertyChanged)
│   └── DashboardViewModel.cs
├── Services/                   # UI-specific services
│   ├── Navigation/             # Navigation service
│   └── Dialog/                 # Dialog service
└── Converters/                 # Data-binding converters (e.g. BoolToVisibility)
```

- **Pages/Views:** Group by feature (e.g. Dashboard, Settings).
- **ViewModels:** One per major view; inject dependencies via constructor.
- **Services:** Interface-based for testability (e.g. INavigationService).

---

## 3. Naming and Coding Standards

| Type           | Format (example)           | Rule |
|----------------|----------------------------|------|
| Views          | `[Feature]Page.xaml`       | Suffix: Page, Window, or View (e.g. LoginPage). |
| ViewModels     | `[Feature]ViewModel.cs`    | One-to-one with View; constructor injection. |
| Services       | `I[Name]Service`           | Interface-based; easy to mock in tests. |
| Commands       | `[Action]Command`          | ICommand properties in ViewModel (e.g. SubmitCommand). |
| Async          | `[Method]Async`            | All I/O on UI thread must be async; avoid blocking. |

- Code and comments: **English**; **ASCII only** in source (per [DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md)).
- App root namespace: **DotApps.\<AppName\>** (e.g. DotApps.SimpleUi).

---

## 4. Visual Design (Fluent 2)

Use **Fluent 2** (Windows 11 style): light, depth, motion, and material.

### 4.1 Materials and depth

- Use **Mica** and **Acrylic** for backgrounds so the app fits the OS.
- Use **shadows** and **strokes** for hierarchy, not flat color blocks.

### 4.2 Motion

- Transitions for show/hide of UI elements.
- **Staggered entrance** for lists; **drill-in** for page navigation.

### 4.3 Typography

- Default: **Segoe UI Variable**.
- Titles: bold, sufficient whitespace; body: clear contrast. Follow [Fluent 2 Design Guidelines](https://fluent2.microsoft.design/).

### 4.4 Layout and theming

- Follow Fluent 2 layout system.
- Prefer **WinUI 3**-style controls where available (e.g. in WPF via compatibility or MAUI).
- Support **Light/Dark** mode; use MAUI/default theme variables where applicable.

---

## 5. Relation to DOT_ARCHITECTURE and dot.mdc

- **Layout and language:** [DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md) and [.cursor/rules/dot.mdc](../.cursor/rules/dot.mdc) define dotcore/dotapps layout, naming (DotCore.*, DotApps.*), dependencies, and English/ASCII.
- **This spec:** Applies **only** when building **UI** (WPF, MAUI, Blazor Hybrid, Avalonia) in **dotapps**. It adds Clean Architecture layers, MVVM, Presentation folder structure, and Fluent 2. It does not replace the base dot rule.
- **Updating rules and resolving conflicts:** See [CURSOR_RULES_UPDATE_GUIDE.md](CURSOR_RULES_UPDATE_GUIDE.md): when this spec or `.cursor/rules/dot-ui.mdc` changes, update the canonical doc and the rule; any other document that describes UI/Presentation must defer to this spec (no duplicate or conflicting definitions).
