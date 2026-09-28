# DotCore Design

**Dotcore** is the .NET **public class libraries (公共类库)** layer. It is the counterpart of **pycore** on the Python side: all shared, app-agnostic libraries live here. **Sub-app class libraries (子app的类库)** are per-app code under `pyapps/<app>/` or `dotapps/<App>/` and are not part of dotcore. Apps (dotapps) reference only dotcore; they do not reference each other.

Shared library layout and roles. Canonical definitions (公共类库 vs 子app的类库): [development-guides/PYCORE_PYAPPS_STRUCTURE.md](../development-guides/PYCORE_PYAPPS_STRUCTURE.md). Architecture: [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md). Cursor skill: [.cursor/skills/dot/SKILL.md](../.cursor/skills/dot/SKILL.md). Progress and pycore↔dotcore mapping: [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](DOT_PUBLIC_LIBRARY_PROGRESS.md). **Button / text-region recognition** (HSV, contours, morphology, OCR, optional YOLO): [dotcore/docs/BUTTON_RECOGNITION_DESIGN.md](docs/BUTTON_RECOGNITION_DESIGN.md).

---

## 1. Layout (libraries only)

Libraries live **directly under dotcore/** (no `src/`):

```
dotcore/
├── DESIGN.md
├── dotcore.sln
├── Directory.Build.props
├── Directory.Packages.props
├── nuget.config
├── DotCore.Foundations/
├── DotCore.Common/
├── DotCore.Utils/
├── DotCore.Utils.ImageColor/
├── DotCore.Utils.ImageContours/
├── DotCore.Utils.ImageMorphology/
├── DotCore.Utils.ImagePreprocess/
├── DotCore.ButtonRecognizer/
├── DotCore.Infrastructure/
├── DotCore.UIInspect/
├── DotCore.UITheme/
├── DotCore.VocAnnotator/
└── tests/
    └── DotCore.Foundations.Tests/
```

Apps live under **dotapps/** at repo root (see DOT_ARCHITECTURE.md). For UI apps (WPF/MAUI/Blazor/Avalonia), **Presentation layer:** canonical spec [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md), [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc).

---

## 2. Project roles

| Project | Role | Depends on |
|---------|------|------------|
| **DotCore.Foundations** | Base types, BCL only | (none) |
| **DotCore.Common** | Constants, paths | Foundations |
| **DotCore.Utils** | Shared utilities (incl. Ocr) | Foundations, Common |
| **DotCore.Utils.ImageColor** | HSV, InRange mask (no cross-calls) | Foundations, OpenCvSharp |
| **DotCore.Utils.ImageContours** | FindContours, area/aspect filter (no cross-calls) | Foundations, OpenCvSharp |
| **DotCore.Utils.ImageMorphology** | Canny, Dilation, Erosion (no cross-calls) | Foundations, OpenCvSharp |
| **DotCore.Utils.ImagePreprocess** | Grayscale, Otsu binarize (no cross-calls) | Foundations, OpenCvSharp |
| **DotCore.ButtonRecognizer** | Button/text-region pipelines (aggregate) | ImageColor, ImageContours, ImageMorphology, ImagePreprocess, Utils, TemplateMatcher, ScreenCapture |
| **DotCore.Infrastructure** | DB, I/O | Foundations, Common |
| **DotCore.UIInspect** | UI Automation (FlaUI) | (none) |
| **DotCore.UITheme** | Theme data (colors, fonts, sizes); no WPF | (none) |
| **DotCore.VocAnnotator** | VOC/JSON annotation IO, project config | Foundations, Common |

---

## 3. Build

From repo root:

```bash
dotnet build dotcore/dotcore.sln
```

Solution includes both `dotcore` libs and `dotapps` projects (references like `..\dotapps\SimpleUi\SimpleUi.csproj`).
