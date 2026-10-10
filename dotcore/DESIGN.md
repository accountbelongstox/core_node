# DotCore Design

**Dotcore** is the .NET **public class libraries (公共类库)** layer, counterpart of **pycore**: shared, app-agnostic libraries only. **Sub-app class libraries (子app的类库)** live under `dotapps/<App>/` (e.g. `dotapps/d3d4tester/D3D4TesterCore/`) and are not part of dotcore. Apps reference only dotcore, never each other.

Standards: [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md). pycore↔dotcore mapping: [DOT_PUBLIC_LIBRARY_PROGRESS.md](DOT_PUBLIC_LIBRARY_PROGRESS.md). Button/text-region recognition: [docs/BUTTON_RECOGNITION_DESIGN.md](docs/BUTTON_RECOGNITION_DESIGN.md).

## 1. Layout

One folder = one csproj = namespace `DotCore.<Name>`, directly under `dotcore/` (no `src/`). Shared build settings: `Directory.Build.props`, `Directory.Packages.props` (central NuGet versions), `nuget.config`.

## 2. Project roles

| Project | Role | Depends on |
|---------|------|------------|
| **DotCore.Foundations** | Guard/Result, `IEventHub` (priority, main-thread publish), `AppEventIds`, `ColorPrinter` (incl. gray refresh lines), shutdown request; BCL only | (none) |
| **DotCore.Common** | Constants, `AppPaths`, i18n provider, status symbols, `Geometry/CoordinateScaler` (standard→actual coords, window borders) | Foundations |
| **DotCore.Utils** | Paths, strings, time, hotkeys, config-change hub, security; `Input/` (`ClickHandler`, `FieldInput`, clipboard, IME); `Window/` (`WindowResizer`, `BrowserWindowDetector`), `WindowFinder`, `WindowInputHelper`; `ProcessUtil`, `ShellOpen`; `Ocr/` (PaddleOCR engine, `OcrEngineRegistry`, `OcrHelper`, `OcrBbox`, `ImageFractionCrop`) | Foundations, Common, PaddleOCRSharp, OpenCvSharp4 |
| **DotCore.Utils.ImageColor** | HSV / InRange masks, `BgrColorMatch` | Foundations, OpenCvSharp4 |
| **DotCore.Utils.ImageContours** | FindContours, area/aspect filter | Foundations, OpenCvSharp4 |
| **DotCore.Utils.ImageMorphology** | Canny, dilation, erosion | Foundations, OpenCvSharp4 |
| **DotCore.Utils.ImagePreprocess** | Grayscale, Otsu; `ImageConvert` (Bitmap↔Mat, BGR/BGRA/gray); `ImageAnnotate` (debug drawing) | Foundations, OpenCvSharp4 |
| **DotCore.ScreenCapture** | Screen/window capture, `ScreenCaptureOptions` (window-only, activate-first, crop, region, rect cache, game-window locator hook), `ScreenshotData` | Foundations, Utils, ImagePreprocess |
| **DotCore.TemplateMatcher** | Template matching, `ScaledTemplateMatcher` (standard-resolution templates, auto-scale, multi/region match), `FeatureMatcherService` (ORB/SIFT/AKAZE), `ImageMatcherRegistry` | Foundations, ImagePreprocess, OpenCvSharp4 |
| **DotCore.MinimapPath** | Minimap route recognition: `MinimapRouteRecognizer` (locate minimap by color, outlined route dots, chain filter, nearest-neighbor ordering from the player, Douglas-Peucker waypoints, heading), `MinimapRouteOptions` (per-game tuning), `MinimapRouteAnnotator` | ImageColor, OpenCvSharp4 |
| **DotCore.ButtonRecognizer** | Button/text-region pipelines (aggregate) | Foundations, Common, Utils, ImageColor, ImageContours, ImageMorphology, ImagePreprocess, TemplateMatcher, ScreenCapture |
| **DotCore.Infrastructure** | File I/O, `JsonKeyPathConfig`, `Http/LocalJsonHttpHost` (local JSON HTTP routes, CORS) | Foundations, Common |
| **DotCore.UIInspect** | UI Automation (FlaUI): `UIOperations` (focus, rect-click fallback), element dump, `WindowAnalyzer` (JSON dump), `UiAnalysisSequence` (selectors, run sequence), process launch | Foundations, Utils, ScreenCapture, FlaUI |
| **DotCore.UITheme** | WPF Fluent 2 theme: `Themes/*.xaml` (tokens, dark/light colors, styles), `ThemeManager`, `WindowChromeBehavior`, `WindowBackdrop`, `ControlAssist`, tray icon, status-bar contracts | WPF |
| **DotCore.VocAnnotator** | Annotation model and IO (`AnnotationBox`, `ImageAnnotation`, `AnnotationIo`: JSON / VOC / YOLO txt, project-wide label rename/remove/count), `ImageHeaderReader`, `AnnotationCleanup`, `ProjectConfig` (ordered classes, colors), `VocAnnotatorConfig` (`AnnotatorSettings`, embedded defaults), `YoloDataLayout` (reserved `_datasets` / `_runs` project subdirs), patch data, launcher | Foundations, Common |
| **DotCore.VocAnnotatorUI** | Shared WPF annotator: `AnnotatorWindow` / `AnnotatorView` (MVVM `AnnotatorViewModel`), `AnnotationCanvas` (zoom/pan, draw, move, 8-handle resize), undo/redo, class management, AI pre-label (`AutoLabelService`), settings dialog, embedded i18n (`AnnotatorI18n`) | Foundations, Common, UITheme, VocAnnotator, YoloDetect, YoloTrain |
| **DotCore.YoloTrain** | Training: `YoloEnvironmentProbe` (OS/CPU/RAM/NVIDIA GPU, Python + torch/CUDA + Ultralytics + yolo CLI), `YoloTrainAdvisor` (recommended parameters + reasons), `YoloTrainParameters`, `YoloDatasetAssembler` (train/val/test split: seed, stratify, background cap), `YoloDataYaml`, `YoloTrainRunner` (train / ONNX export, progress, cancel), `YoloArtifacts` | Foundations, VocAnnotator |
| **DotCore.YoloTaskSet** | Specific training mode ([docs/YOLO_TASKSET_SYNTHESIS_DESIGN.md](docs/YOLO_TASKSET_SYNTHESIS_DESIGN.md)): task sets (targets, variants, scenes, common images/videos, augmentation with per-target override) in `TaskSetStore`; `VariantExtractor` (crop / GrabCut cutout from images and video frames), `VariantAugmenter`, `VideoFrameExtractor`, `TaskSetSynthesizer` (cut-and-paste synthesis with automatic labels, preview) | Foundations, VocAnnotator, YoloTrain, OpenCvSharp4 |
| **DotCore.YoloDetect** | `YoloOnnxDetector`: Ultralytics detection ONNX inference (letterbox, class-wise NMS, names from metadata) | Foundations, OnnxRuntime, OpenCvSharp4 |
| **DotCore.YoloRecord** | Native window recording: `YoloRecordService` (segments), `YoloSegmentLayout` (compose/merge/info), `YoloRecordConfig` | ScreenCapture, VocAnnotator |

## 3. Build

Build a project or an app csproj (dependencies build transitively); on Linux add `-p:EnableWindowsTargeting=true` (compile-only) and use `--artifacts-path` outside the source tree:

```bash
dotnet build dotapps/d3d4tester/d3d4tester.csproj -p:EnableWindowsTargeting=true --artifacts-path <cache>/dotnet-artifacts/d3d4tester
```

App run/build scripts: `dotapps/<app>/scripts/start.{ps1,sh}` (see DOT_ARCHITECTURE §6).
