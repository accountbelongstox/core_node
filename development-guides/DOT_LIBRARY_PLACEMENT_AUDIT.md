# Dot class library placement audit

Full scan of **dotcore** (公共类库) and **dotapps** (apps + sub-app libs). Purpose: confirm what lives where, and flag any misplaced or inconsistent placement. Reference: [DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md). **UI structure in dotapps (WPF/MAUI/Blazor):** canonical spec [DOT_UI_PROJECT_SPECIFICATION.md](DOT_UI_PROJECT_SPECIFICATION.md) and [.cursor/rules/dot-ui.mdc](../.cursor/rules/dot-ui.mdc); other docs must defer to it.

---

## 1. dotcore – public class libraries

Rule: **Generic, reusable code used by more than one app** belongs here. No app-specific config keys, UI, or domain (e.g. D3/ROSBOT/Battle.net) in dotcore.

### 1.1 DotCore.Foundations

| File | Purpose | Placement |
|------|--------|-----------|
| Guard.cs | Argument/state checks | OK – base |
| Result.cs | Result type | OK – base |
| ColorPrinter.cs | Console color output | OK – base |
| AppEventIds.cs | Event id constants | OK – base |
| IEventHub.cs, DefaultEventHub.cs | Event bus | OK – base |
| IShutdownRequest.cs, DefaultShutdownRequest.cs | Shutdown signal | OK – base |
| IMainThreadDispatcher.cs | Main-thread dispatch | OK – base |

**Verdict:** BCL/minimal; no third-party. Correct.

---

### 1.2 DotCore.Common

| File | Purpose | Placement |
|------|--------|-----------|
| AppPaths.cs | User data dir, config path (cross-platform) | OK – generic path helpers |
| CommonConstants.cs | Shared constants | OK – generic |
| II18nProvider.cs, DefaultI18nProvider.cs | i18n abstraction + default impl | OK – generic |
| StatusDisplaySymbols.cs | Symbols for status display | OK – generic |

**Verdict:** Generic paths, i18n, constants. Correct. No app names.

---

### 1.3 DotCore.Utils

| File / folder | Purpose | Placement |
|----------------|--------|-----------|
| PathUtil.cs | Path helpers | OK – generic |
| StringUtil.cs | String helpers | OK – generic |
| TimeUtil.cs | Time helpers | OK – generic |
| HotkeyUtil.cs | Hotkey string normalize/parse | OK – generic |
| ConfigChangeNotifier.cs | Config change notification | OK – generic |
| IGlobalHotkeyService.cs, WindowsGlobalHotkeyService.cs | Global hotkey (Windows) | OK – generic util |
| Ocr/ (IOcrEngine, OcrHelper, OcrResult, PaddleOcrEngine) | OCR abstraction + PaddleOCR | OK – generic; optional third-party |
| **Security/MachineIdProvider.cs** | Machine-unique ID (Registry/wmic) | OK – moved from D3CheckCore; generic |
| **Security/PasswordCipher.cs** | Machine-bound Fernet encrypt/decrypt | OK – moved from D3CheckCore; generic |

**Verdict:** All shared utilities. Security in dotcore is correct.

---

### 1.4 DotCore.Infrastructure

| File | Purpose | Placement |
|------|--------|-----------|
| IFileReadWriter.cs, DefaultFileReadWriter.cs | File read/write abstraction | OK – generic |
| JsonKeyPathConfig.cs | JSON config by key path (load/save, get/set) | OK – generic; no app keys |

**Verdict:** Generic file and config abstraction. Correct.

---

### 1.5 DotCore.UITheme

| File | Purpose | Placement |
|------|--------|-----------|
| ThemeColors.cs, ThemeColorKeys.cs | Color keys/values | OK – theme data |
| ThemeFonts.cs, ThemeFontInfo.cs, ThemeFontKeys.cs | Font keys/values | OK – theme data |
| ThemeSizes.cs, ThemeSizeKeys.cs | Size keys/values | OK – theme data |
| UITheme.cs | Theme aggregation | OK – no WPF controls |

**Verdict:** Theme data only; reusable by D3Check and other apps. Correct.

---

### 1.6 DotCore.UIInspect

| File | Purpose | Placement |
|------|--------|-----------|
| UIOperations.cs | FlaUI value/click/focus helpers | OK – generic UI Automation |
| UIElementDumper.cs, UIInspectPrinter.cs | Dump/inspect UI tree | OK – generic |
| ElectronDetector.cs, UIButtonEnumerator.cs, ProcessLauncher.cs | Process/UI detection helpers | OK – generic |

**Verdict:** Generic UI Automation (FlaUI). Correct.

---

### 1.7 DotCore.ScreenCapture

| File | Purpose | Placement |
|------|--------|-----------|
| ScreenCaptureService.cs, ScreenshotData.cs | Screen capture + data type | OK – generic |
| ScreenCaptureConstants.cs, NativeMethods.cs | Constants + P/Invoke | OK – generic |

**Verdict:** Generic screen capture. Correct.

---

### 1.8 DotCore.TemplateMatcher

| File | Purpose | Placement |
|------|--------|-----------|
| TemplateMatcherService.cs, TemplateMatchResult.cs, TemplateMatcherConstants.cs | Image template matching (OpenCv) | OK – generic |

**Verdict:** Generic image matching. Correct.

---

### 1.9 DotCore.Utils.ImageColor / ImageContours / ImageMorphology / ImagePreprocess

| Project | Purpose | Placement |
|---------|--------|-----------|
| ImageColor | HSV, InRange mask, HsvRange | OK – generic image |
| ImageContours | FindContours, area/aspect filter | OK – generic |
| ImageMorphology | Canny, Dilation, Erosion | OK – generic |
| ImagePreprocess | Grayscale, Otsu binarize | OK – generic |

**Verdict:** Isolated image utils; no cross-calls between them. Correct.

---

### 1.10 DotCore.ButtonRecognizer

| File | Purpose | Placement |
|------|--------|-----------|
| ButtonRecognizerService.cs, ButtonCandidate.cs, ButtonRecognizerConstants.cs | Button/text region recognition; composes Utils.*, TemplateMatcher, ScreenCapture | OK – aggregate lib |

**Verdict:** Composes other dotcore libs; generic. Correct.

---

### 1.11 DotCore.VocAnnotator

| File | Purpose | Placement |
|------|--------|-----------|
| AnnotationIo.cs, VocIo.cs, DataYamlWriter.cs | VOC/JSON annotation IO | OK – generic format |
| ProjectConfig.cs, VocAnnotatorConfig.cs | Project/config for annotator | OK – generic |
| VocAnnotatorLauncher.cs | Launch VocAnnotator app (dotapps) as process | OK – lib provides API; host (e.g. d3check) calls it |

**Verdict:** Annotation format + launcher API; launcher is “host app calls lib to start annotator”. Correct in dotcore.

---

## 2. dotapps – applications and sub-app libs

Rule: **App-specific code** (config keys, UI, flows, domain) stays under **dotapps/<App>/** or its sub-app lib (e.g. D3CheckCore). **No generic public-library code** in app libs.

### 2.1 dotapps/d3check (main app)

| Area | Contents | Placement |
|------|----------|-----------|
| Config/ | AsiaCredentialsService, D3CheckConfigService | OK – app config + credential service (uses DotCore.Utils.Security) |
| Constants/ | ConfigKeys, I18nKeys | OK – app keys |
| Ctl/ | BattlenetLoginCtl, RosbotFlowController, RosbotStatusProvider | OK – app flow controllers |
| I18n/ | D3CheckI18n, I18nFallbacks, I18nExtensions | OK – app i18n |
| Panels/, Windows/, Components/ | WPF panels, CredentialsDialog, etc. | OK – app UI |
| MainWindow.xaml.cs, App.xaml.cs | Entry and main window | OK – app |

**Verdict:** All d3check-specific. Correct.

---

### 2.2 dotapps/d3check/D3CheckCore (sub-app lib)

| File / folder | Purpose | Placement |
|----------------|--------|-----------|
| PathScanner.cs, PathScanResult.cs | Scan drives for BN/D3/ROSBOT paths | OK – D3/ROSBOT specific |
| DriveOrder.cs | Fixed drive order for scan (D first, C last) | OK – used by PathScanner; D3 scan semantics |
| RosbotPathPicker.cs, RosbotVersionInfo.cs, RosbotConstants.cs, RosbotDetection.cs, RosbotOperation.cs, IRosbotOperation.cs | ROSBOT path pick, version, detection, operation | OK – D3/ROSBOT |
| D3PathConstants.cs, D3ScaleConstants.cs, D3StatusSymbols.cs | D3 paths, scale, status symbols | OK – D3 |
| GameInterfaceData.cs, IGameInterfaceData.cs, GameInterfaceStateSnapshot.cs | Game state (BN/D3/ROS) | OK – D3 |
| Battlenet/ (BattlenetManager, BattlenetOperation*, BattlenetRegionDetection, BattlenetStuckDetector, BattlenetCacheCleanup, BrowserWindowFinder, BrowserLoginOcrFlow, etc.) | Battle.net window, region, login, operations | OK – D3/BN |
| *(CredentialsStored moved to dotapps/d3check/Config/)* | — | Config-related DTO in app root |
| ScreenshotAndScaleHelper.cs, GameInputHelper.cs | D3 screenshot/input helpers | OK – D3 |

**Verdict:** All D3/ROSBOT/Battle.net domain. No generic cipher/machine-id here (moved to DotCore.Utils.Security). Correct.

---

### 2.3 Other dotapps

| App | Notes |
|-----|------|
| SimpleUi | WPF sample; references dotcore as needed. OK. |
| Cli | Console host; Foundations, Common, Utils. OK. |
| CallModule | Service host; Foundations, Common, Utils. OK. |
| VocAnnotator | Annotator app; references DotCore.Common (and optionally others). OK. |
| abc, _template | Scaffold/template. OK. |

---

## 3. Dependency summary

- **Foundations:** no project refs.
- **Common:** Foundations only.
- **Utils, Infrastructure:** Foundations + Common.
- **Utils.Image*:** Foundations only (no cross-calls).
- **TemplateMatcher, ScreenCapture:** no dotcore project refs; packages only.
- **UITheme, UIInspect:** no dotcore project refs.
- **ButtonRecognizer:** Utils, Utils.Image*, TemplateMatcher, ScreenCapture.
- **VocAnnotator:** Foundations, Common.
- **d3check:** Foundations, Common, Utils, Infrastructure, UITheme, UIInspect, VocAnnotator, D3CheckCore.
- **D3CheckCore:** Foundations, Common, Utils (and UIInspect, ScreenCapture, TemplateMatcher via its csproj).

No cycles. Apps only reference dotcore (and their own sub-app lib).

---

## 4. Past correction (already done)

- **MachineIdProvider, PasswordCipher:** Were under `dotapps/d3check/D3CheckCore/Security/`. Moved to **dotcore/DotCore.Utils/Security/** (namespace `DotCore.Utils.Security`). Generic machine-bound encrypt/decrypt belongs in dotcore.

---

## 5. Follow-up optimizations (done)

- **CredentialsStored (done):** Moved from D3CheckCore to Config. Was: storage DTO for this app’s credentials; only used by d3check config/credentials flow. Moved to `dotapps/d3check/Config/CredentialsStored.cs` (namespace DotApps.d3check.Config).
- **DotCore.Utils:** Ocr, Security, Hotkey, Path, String, Time, ConfigChangeNotifier stay in one lib; split only if a subtree grows large.
- **Dead config keys (done):** Removed unused `ConfigKeys.BattlenetAsiaAccount` and `BattlenetAsiaPassword`; credential access via `AsiaCredentialsService` and `BattlenetAsiaCredentials`.
- **DotCore.Utils.Security build (done):** Nullable in PasswordCipher; MachineIdProvider guards Registry/wmic with `OperatingSystem.IsWindows()` (CA1416).
- **Empty folder (done):** Removed `D3CheckCore/Credentials/` after moving CredentialsStored to Config.

---

## 6. Summary table

| Location | Role | Placement verdict |
|----------|------|--------------------|
| dotcore/DotCore.Foundations | Base (Guard, Result, events, ColorPrinter) | OK |
| dotcore/DotCore.Common | Paths, i18n, constants | OK |
| dotcore/DotCore.Utils | Path, String, Time, Hotkey, Ocr, **Security** | OK |
| dotcore/DotCore.Infrastructure | File, JsonKeyPathConfig | OK |
| dotcore/DotCore.UITheme | Theme colors/fonts/sizes | OK |
| dotcore/DotCore.UIInspect | UI Automation (FlaUI) | OK |
| dotcore/DotCore.ScreenCapture | Screen capture | OK |
| dotcore/DotCore.TemplateMatcher | Image template match | OK |
| dotcore/DotCore.Utils.Image* | Image color/contours/morphology/preprocess | OK |
| dotcore/DotCore.ButtonRecognizer | Button recognition aggregate | OK |
| dotcore/DotCore.VocAnnotator | VOC/annotation IO + launcher API | OK |
| dotapps/d3check (root) | Config, Ctl, I18n, Panels, Windows | OK |
| dotapps/d3check/D3CheckCore | PathScanner, DriveOrder, Battlenet, Rosbot, GameInterface, D3 constants | OK |
| dotapps/d3check/Config | D3CheckConfigService, AsiaCredentialsService, **CredentialsStored** | OK |

**Overall:** Class library placement is consistent. Generic code is in dotcore; D3/ROSBOT/Battle.net and d3check-specific config/UI are in dotapps/d3check and D3CheckCore.

---

## 7. Remaining backlog (non-placement)

- **RosbotPanel:** "Open Tampermonkey script" – implemented (path from `ConfigKeys.PathsTampermonkeyScript`, fallback to repo `scripts/d3check_oauth_login_tampermonkey.user.js`; opens in Notepad).
- **D4Panel:** Debug button – implemented (opens a read-only window with current EXP Farming log snapshot).
- No remaining must-do items.
