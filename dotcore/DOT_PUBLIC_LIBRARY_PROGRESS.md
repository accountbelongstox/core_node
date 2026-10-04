# Dot Public Class Libraries (dotcore) – Progress and Mapping

**Public class libraries (公共类库)** = **pycore** (Python) and **dotcore** (.NET): shared, app-agnostic code. **Sub-app class libraries (子app的类库)** live under `pyapps/<app>/` or `dotapps/<App>/` and are never shared; apps depend only on the core layer. Project list, roles and dependencies: [DESIGN.md](DESIGN.md). Standards: [development-guides/DOT_ARCHITECTURE.md](../development-guides/DOT_ARCHITECTURE.md), Python side: [development-guides/PYTHON_PYCORE.md](../development-guides/PYTHON_PYCORE.md).

When adding or changing a DotCore.* capability, add or update its row in §2. Logic is 1:1 with Python (behavior, not code copy); each type names its source in its summary (`1:1 Python <path>`).

---

## 1. Library mapping

| Python | .NET (dotcore) |
|--------|----------------|
| pyfoundations (color_print, thread_bus, shutdown) | DotCore.Foundations |
| shared constants, paths, providor i18n | DotCore.Common |
| pyutils (common, hotkey, input, window, ocr_cluster, security), pyctl/desktop | DotCore.Utils |
| pyutils/image_tools | DotCore.Utils.Image* , DotCore.TemplateMatcher |
| screenshot provider | DotCore.ScreenCapture |
| database, config I/O, HTTP bridge | DotCore.Infrastructure |
| pyutils/window/analyzer, UI automation | DotCore.UIInspect |
| app theme / tray | DotCore.UITheme |
| pyutils/voc_annotator, ultralytics_comm | DotCore.VocAnnotator |
| d3-check yolo_record (GameAISDK RecordSession) | DotCore.YoloRecord |
| Ultralytics YOLO inference (Python used the Ultralytics runtime) | DotCore.YoloDetect |
| pyadb, pydevice, pythreadpool, pygvar, pyheartbeat, callmodule | Not split in dot yet |

Sub-app library of d3d4tester: `dotapps/d3d4tester/D3D4TesterCore/` (namespace `DotApps.d3d4tester.Core`); Python→C# map: [dotapps/d3d4tester/docs/PY_DOT_PORT_MAP.md](../dotapps/d3d4tester/docs/PY_DOT_PORT_MAP.md).

---

## 2. Capability mapping (all Implemented)

| Python | dotcore type |
|--------|--------------|
| pyfoundations guard/result | `Foundations/Guard`, `Result` |
| pyfoundations color_print | `Foundations/ColorPrinter` (callbacks, colors, `GrayRefresh`, `RefreshLine`) |
| thread_bus EventHandlerRegistry, event_signals | `Foundations/IEventHub`, `DefaultEventHub` (priority, duplicate reject, `PublishOnMainThread`), `AppEventIds` |
| shutdown_manager | `Foundations/IShutdownRequest`, `DefaultShutdownRequest` |
| root.after(0, f) | `Foundations/IMainThreadDispatcher` |
| paths, constants | `Common/AppPaths`, `CommonConstants`, `StatusDisplaySymbols` |
| i18n_manager | `Common/II18nProvider`, `DefaultI18nProvider` |
| share/game_interface_data scale_standard_value_to_actual, auto_scale | `Common/Geometry/CoordinateScaler`, `WindowBorders` |
| config load/get/set/queue save | `Infrastructure/JsonKeyPathConfig`, `IFileReadWriter` |
| controller/http_bridge_controller (Flask) | `Infrastructure/Http/LocalJsonHttpHost` (`MapGet`, `MapPost`, `Start`, `Stop`) |
| config_change_hub | `Utils/ConfigChangeNotifier` |
| time debounce | `Utils/TimeUtil` |
| hotkey_registry, normalize_hotkey_canonical | `Utils/HotkeyUtil`, `IGlobalHotkeyService`, `WindowsGlobalHotkeyService` |
| window_finder | `Utils/WindowFinder` |
| pyctl/desktop/click_handler | `Utils/Input/ClickHandler` (click/drag/curve move/keys/type/PostMessage click) |
| pyutils/input/field_input, clipboard_text, ime_switch | `Utils/Input/FieldInput`, `ClipboardText`, `ImeSwitch` |
| press_key_to_window, is_cursor_in_window | `Utils/WindowInputHelper` |
| pyutils/common/browser_window_detector | `Utils/Window/BrowserWindowDetector` |
| d3utils/window_resizer | `Utils/Window/WindowResizer` |
| d3utils/process_helper | `Utils/ProcessUtil` |
| open_path/open_dir/open_file, system_launcher start_program | `Utils/ShellOpen` |
| security (cipher, machine id) | `Utils/Security/PasswordCipher`, `MachineIdProvider` |
| ocr_cluster/cnocr_engine_registry | `Utils/Ocr/OcrEngineRegistry` (task→model, `EnsureLoaded`, `ForTask`), `PaddleOcrEngine`, `IOcrEngine` (path/Bitmap/Mat) |
| d3utils/ocr_helper | `Utils/Ocr/OcrHelper`, `OcrBbox`, `ImageFractionCrop` |
| d3u_common/image_conversion | `Utils.ImagePreprocess/ImageConvert` |
| image_tools/image_annotator | `Utils.ImagePreprocess/ImageAnnotate` |
| BGR color tables / InRange | `Utils.ImageColor/BgrColorMatch`, `ImageColorService` |
| d4_black_screen_detector brightness stats | `Utils.ImageColor/BgrColorMatch` |
| d3utils/screenshot_provider | `ScreenCapture/ScreenCaptureService`, `ScreenCaptureOptions`, `ScreenshotData` |
| image_tools/image_matcher, image_matcher_registry | `TemplateMatcher/ImageMatcher`, `ImageMatcherRegistry`, `FeatureMatcherService`, `TemplateMatchMethod` |
| share/scaled_template_matcher_base | `TemplateMatcher/ScaledTemplateMatcher` |
| pyutils/window/analyzer | `UIInspect/WindowAnalyzer` |
| d3utils/ui_analysis_operations, ui_control_operations | `UIInspect/UiAnalysisSequence`, `UIOperations` |
| app theme, pystray | `UITheme/ThemeManager`, `WindowChromeBehavior`, `WindowBackdrop`, `ControlAssist`, `Tray/NotifyTrayIcon`, `Themes/*.xaml` |
| voc_annotator (voc_io, annotation_io, config, project_config, patch_data, yolo_data_layout) | `VocAnnotator/VocIo`, `AnnotationIo`, `VocAnnotatorConfig`, `ProjectConfig`, `PatchData`, `YoloDataLayout`, `VocAnnotatorLauncher` |
| d3utils/yolo_dataset_from_annotations, ultralytics_comm | `VocAnnotator/YoloDatasetBuilder`, `DataYamlWriter` |
| d3utils/yolo_train_flow (+ GameAISDK yolo_label_lib) | `VocAnnotator/YoloTrainFlow` |
| d3utils/yolo_record | `YoloRecord/YoloRecordService`, `YoloSegmentLayout`, `YoloRecordConfig` |
| Ultralytics YOLO detect (DOT-only, ONNX export of best.pt) | `YoloDetect/YoloOnnxDetector`, `YoloDetection` |

Not in dotcore: Windows native OCR (Windows.Media.Ocr) — WinRT winmd cannot be referenced from these libraries (NETSDK1130); use `PaddleOcrEngine`.

---

## 3. References

| Resource | Purpose |
|----------|---------|
| [.NET documentation](https://learn.microsoft.com/en-us/dotnet/) | SDK, C#, BCL, project format |
| [pycore/](../pycore/) | Python public class libraries mirrored here |
| [pyapps/d3-check/](../pyapps/d3-check/) | Python source of the d3d4tester port |
