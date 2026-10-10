// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/window_analyzer_singleton.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/utils/_obsolete_window_analyzer.py
using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;

namespace DotCore.UIInspect;

/// <summary>
/// Analyzes a window with UI Automation: screenshot, annotated screenshot (snapshot ids), and JSON of all controls.
/// Single instance via <see cref="Instance"/>. JSON schema matches Python so analysis files are interchangeable.
/// 1:1 Python pycore/pyutils/window/analyzer.py (WindowAnalyzer) and dotapps/d3d4tester/reference/py_d3check/d3utils/window_analyzer_singleton.py.
/// Fixes Python bug: value/help_text/patterns/is_visible/is_active/is_maximized/is_minimized were always null/empty/false.
/// </summary>
public sealed class WindowAnalyzer
{
    public const string WindowCacheKeyPrefix = "window_cache_";
    public const string AnnotationFontFamily = "Arial";
    public const float AnnotationFontSize = 12f;
    public const int WindowActivationWaitMs = 1000;
    public const string DebugDirName = "pytools";
    public const string OutputDirPrefix = "window_analysis_";
    public const string ScreenshotSuffix = "_screenshot.png";
    public const string AnnotatedSuffix = "_annotated.png";
    public const string JsonSuffix = "_analysis.json";
    public const string DefaultProgramName = "Unknown";
    public const string ErrorWindowNotFound = "Window not found";
    public const string ErrorInvalidHandle = "Invalid window handle";
    public const string ErrorScreenshot = "Failed to take screenshot";

    private const int SwRestore = 9;

    private static readonly Lazy<WindowAnalyzer> LazyInstance = new(() => new WindowAnalyzer());

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNameCaseInsensitive = true,
    };

    private readonly ConcurrentDictionary<string, AnalyzedWindow> _windowCache = new(StringComparer.Ordinal);

    private WindowAnalyzer()
    {
        DebugDir = Path.Combine(Path.GetTempPath(), DebugDirName);
    }

    public static WindowAnalyzer Instance => LazyInstance.Value;

    /// <summary>Root for timestamped output dirs (Python PYTOOLS_TMP_DIR).</summary>
    public string DebugDir { get; set; }

    /// <summary>JSON options used for analysis files (indented, non-ASCII kept).</summary>
    public static JsonSerializerOptions SerializerOptions => JsonOptions;

    /// <summary>Find a visible top-level window whose title contains any of <paramref name="windowTitles"/> (ordinal), cache first.</summary>
    public AnalyzedWindow? GetWindowByTitles(IReadOnlyList<string> windowTitles, bool useCache = true)
    {
        if (windowTitles == null || windowTitles.Count == 0)
            return null;
        if (useCache)
        {
            var cached = WindowFromCache(windowTitles);
            if (cached != null)
                return cached;
        }

        foreach (var info in WindowFinder.FindWindowsByTitles(windowTitles))
        {
            var title = windowTitles.FirstOrDefault(t => !string.IsNullOrEmpty(t) && info.Title.Contains(t, StringComparison.Ordinal));
            if (title == null)
                continue;
            var window = WindowFromHandle(info.Hwnd, info.Title);
            if (window != null)
            {
                _windowCache[WindowCacheKeyPrefix + title.ToLowerInvariant()] = window;
                ColorPrinter.Blue($"[CACHE] Cached window info for '{title}'");
            }
            return window;
        }
        ColorPrinter.Red($"[WindowAnalyzer] Window not found titles=[{string.Join(", ", windowTitles)}]");
        return null;
    }

    /// <summary>Window info block of the analysis JSON.</summary>
    public WindowInfoData GetWindowInfo(AnalyzedWindow window)
    {
        return new WindowInfoData
        {
            Hwnd = window.Hwnd.ToInt64(),
            Title = window.Title,
            Left = window.Left,
            Top = window.Top,
            Width = window.Width,
            Height = window.Height,
            IsActive = Native.GetForegroundWindow() == window.Hwnd,
            IsMaximized = Native.IsZoomed(window.Hwnd),
            IsMinimized = Native.IsIconic(window.Hwnd),
        };
    }

    /// <summary>Enumerate all controls depth-first with snapshot ids (id = visit order, parent_id, level). 1:1 Python enumerate_controls_ui_automation.</summary>
    public List<UiAnalysisControl> EnumerateControls(IntPtr hwnd)
    {
        var controls = new List<UiAnalysisControl>();
        try
        {
            using var automation = new UIA3Automation();
            var root = automation.FromHandle(hwnd);
            if (root == null)
            {
                ColorPrinter.Red($"[WindowAnalyzer] No UI Automation control for hwnd={hwnd}");
                return controls;
            }
            ColorPrinter.Green("[WindowAnalyzer] Enumerating UI Automation controls...");
            WalkControls(root, null, 0, controls);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[WindowAnalyzer] UI Automation enumeration failed hwnd={hwnd}: {ex.Message}");
            return controls;
        }
        ColorPrinter.Green($"[WindowAnalyzer] Found {controls.Count} UI Automation controls");
        return controls;
    }

    /// <summary>Activate the window, wait, and save a screenshot of its screen rectangle.</summary>
    public bool TakeScreenshot(AnalyzedWindow window, string outputPath)
    {
        window.Activate();
        Thread.Sleep(WindowActivationWaitMs);
        try
        {
            using var bmp = ScreenCaptureService.GetScreenshotProvider().CaptureRegion(window.Left, window.Top, window.Width, window.Height);
            if (bmp == null)
            {
                ColorPrinter.Red($"[WindowAnalyzer] screenshot failed path={outputPath}: capture returned null");
                return false;
            }
            bmp.Save(outputPath, ImageFormat.Png);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[WindowAnalyzer] screenshot failed path={outputPath}: {ex.Message}");
            return false;
        }
        ColorPrinter.Green($"[WindowAnalyzer] Screenshot saved to: {outputPath}");
        return true;
    }

    /// <summary>Draw each control's rect and snapshot id on the screenshot. 1:1 Python draw_element_numbers.</summary>
    public void DrawElementNumbers(string imagePath, IReadOnlyList<UiAnalysisControl> controls, string outputPath, AnalyzedWindow? window)
    {
        if (window == null)
        {
            ColorPrinter.Red("[WindowAnalyzer] Cannot get window for annotation");
            return;
        }
        Bitmap img;
        try
        {
            using var src = Image.FromFile(imagePath);
            img = new Bitmap(src);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[WindowAnalyzer] open screenshot failed path={imagePath}: {ex.Message}");
            return;
        }
        using (img)
        {
            using (var g = Graphics.FromImage(img))
            using (var font = CreateAnnotationFont())
            using (var pen = new Pen(Color.Red, 1))
            {
                foreach (var control in controls)
                {
                    var rect = control.Rect;
                    if (rect == null || rect.Width == 0 || rect.Height == 0)
                        continue;
                    int left = rect.Left - window.Left;
                    int top = rect.Top - window.Top;
                    int right = rect.Right - window.Left;
                    int bottom = rect.Bottom - window.Top;
                    if (left < 0 || top < 0 || right > img.Width || bottom > img.Height)
                        continue;

                    g.DrawRectangle(pen, left, top, right - left, bottom - top);
                    string text = control.Id.ToString();
                    var size = g.MeasureString(text, font);
                    float textX = left + (right - left - size.Width) / 2;
                    float textY = top + (bottom - top - size.Height) / 2;
                    g.FillRectangle(Brushes.White, textX - 2, textY - 2, size.Width + 4, size.Height + 4);
                    g.DrawString(text, font, Brushes.Red, textX, textY);
                }
            }
            try
            {
                img.Save(outputPath, ImageFormat.Png);
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"[WindowAnalyzer] save annotated screenshot failed path={outputPath}: {ex.Message}");
                return;
            }
        }
        ColorPrinter.Green($"[WindowAnalyzer] Annotated screenshot saved to: {outputPath}");
    }

    /// <summary>Create DebugDir/window_analysis_yyyyMMdd_HHmmss; returns DebugDir on failure.</summary>
    public string CreateTimestampDir()
    {
        var outputDir = Path.Combine(DebugDir, OutputDirPrefix + DateTime.Now.ToString("yyyyMMdd_HHmmss"));
        try
        {
            Directory.CreateDirectory(outputDir);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[WindowAnalyzer] create output directory failed path={outputDir}: {ex.Message}");
            return DebugDir;
        }
        ColorPrinter.Green($"[WindowAnalyzer] Created output directory: {outputDir}");
        return outputDir;
    }

    /// <summary>Analyze window by handle (e.g. found by PID). Same output as AnalyzeWindow.</summary>
    public WindowAnalysisResult AnalyzeWindowByHandle(IntPtr hwnd, string? windowTitle, string programName = DefaultProgramName)
    {
        ColorPrinter.Yellow($"[WindowAnalyzer] Analyzing window: {programName} (by handle)");
        var window = WindowFromHandle(hwnd, string.IsNullOrEmpty(windowTitle) ? DefaultProgramName : windowTitle);
        if (window == null)
            return WindowAnalysisResult.Fail(ErrorInvalidHandle);
        return AnalyzeWindowImpl(window, programName);
    }

    /// <summary>Analyze window found by titles: screenshot, annotated screenshot, controls JSON.</summary>
    public WindowAnalysisResult AnalyzeWindow(IReadOnlyList<string> windowTitles, string programName = DefaultProgramName)
    {
        ColorPrinter.Yellow($"[WindowAnalyzer] Analyzing window: {programName}");
        var window = GetWindowByTitles(windowTitles);
        if (window == null)
            return WindowAnalysisResult.Fail(ErrorWindowNotFound);
        return AnalyzeWindowImpl(window, programName);
    }

    private WindowAnalysisResult AnalyzeWindowImpl(AnalyzedWindow window, string programName)
    {
        var outputDir = CreateTimestampDir();
        var windowInfo = GetWindowInfo(window);

        var screenshotPath = Path.Combine(outputDir, programName + ScreenshotSuffix);
        if (!TakeScreenshot(window, screenshotPath))
            return WindowAnalysisResult.Fail(ErrorScreenshot);

        var controls = EnumerateControls(window.Hwnd);
        var annotatedPath = Path.Combine(outputDir, programName + AnnotatedSuffix);
        DrawElementNumbers(screenshotPath, controls, annotatedPath, window);

        var doc = new UiAnalysisDocument
        {
            Timestamp = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss.ffffff"),
            ProgramName = programName,
            WindowInfo = windowInfo,
            Controls = controls,
            Files = new Dictionary<string, string>
            {
                ["screenshot"] = screenshotPath,
                ["annotated_screenshot"] = annotatedPath,
            },
        };

        var jsonPath = Path.Combine(outputDir, programName + JsonSuffix);
        try
        {
            File.WriteAllText(jsonPath, JsonSerializer.Serialize(doc, JsonOptions), new UTF8Encoding(false));
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[WindowAnalyzer] save JSON failed path={jsonPath}: {ex.Message}");
            return WindowAnalysisResult.Fail($"Failed to save JSON: {ex.Message}");
        }
        ColorPrinter.Green($"[WindowAnalyzer] JSON data saved to: {jsonPath}");

        doc.Files["json"] = jsonPath;
        ColorPrinter.Green($"[WindowAnalyzer] Window analysis completed for {programName}");
        return new WindowAnalysisResult { Success = true, Document = doc, JsonPath = jsonPath };
    }

    private AnalyzedWindow? WindowFromCache(IReadOnlyList<string> windowTitles)
    {
        foreach (var title in windowTitles)
        {
            var cacheKey = WindowCacheKeyPrefix + (title ?? "").ToLowerInvariant();
            if (!_windowCache.TryGetValue(cacheKey, out var cachedInfo))
                continue;
            var hwnd = cachedInfo.Hwnd;
            if (!(hwnd != IntPtr.Zero && Native.IsWindow(hwnd) && Native.IsWindowVisible(hwnd)))
            {
                ColorPrinter.Yellow($"[CACHE] Cached window invalid for '{title}', searching...");
                continue;
            }
            var window = WindowFromHandle(hwnd, cachedInfo.Title);
            if (window == null)
                continue;
            _windowCache[cacheKey] = window;
            ColorPrinter.Green($"[CACHE] Using cached window: '{window.Title}' (Handle: {hwnd})");
            return window;
        }
        return null;
    }

    private static AnalyzedWindow? WindowFromHandle(IntPtr hwnd, string windowTitle)
    {
        if (hwnd == IntPtr.Zero || !Native.GetWindowRect(hwnd, out var r))
        {
            ColorPrinter.Red($"[WindowAnalyzer] GetWindowRect failed hwnd={hwnd}");
            return null;
        }
        return new AnalyzedWindow(hwnd, windowTitle, r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
    }

    private static void WalkControls(AutomationElement control, int? parentId, int level, List<UiAnalysisControl> controls)
    {
        int controlId = controls.Count;
        controls.Add(ControlInfo(control, controlId, parentId, level));
        AutomationElement[] children;
        try
        {
            children = control.FindAllChildren() ?? Array.Empty<AutomationElement>();
        }
        catch
        {
            return;
        }
        foreach (var child in children)
            WalkControls(child, controlId, level + 1, controls);
    }

    private static UiAnalysisControl ControlInfo(AutomationElement control, int controlId, int? parentId, int level)
    {
        var info = new UiAnalysisControl { Id = controlId, ParentId = parentId, Level = level };
        try
        {
            var p = control.Properties;
            info.Type = UIOperations.GetControlTypeName(control);
            info.Name = p.Name.ValueOrDefault ?? "";
            info.AutomationId = p.AutomationId.ValueOrDefault ?? "";
            info.ClassName = p.ClassName.ValueOrDefault ?? "";
            info.HelpText = p.HelpText.ValueOrDefault;
            info.Value = UIOperations.GetValue(control);
            info.IsEnabled = p.IsEnabled.ValueOrDefault;
            info.IsVisible = !p.IsOffscreen.ValueOrDefault;
            var r = p.BoundingRectangle.ValueOrDefault;
            info.Rect = new UiAnalysisRect { Left = r.Left, Top = r.Top, Right = r.Right, Bottom = r.Bottom, Width = r.Width, Height = r.Height };
            info.Patterns = control.GetSupportedPatterns().Select(pt => pt.Name).ToList();
        }
        catch
        {
            // partial info for elements that vanish during the walk
        }
        return info;
    }

    private static Font CreateAnnotationFont()
    {
        try
        {
            return new Font(AnnotationFontFamily, AnnotationFontSize, GraphicsUnit.Pixel);
        }
        catch
        {
            return new Font(FontFamily.GenericSansSerif, AnnotationFontSize, GraphicsUnit.Pixel);
        }
    }

    internal static class Native
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left, Top, Right, Bottom;
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsZoomed(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }

    /// <summary>Window handle + title + geometry used by the analyzer. 1:1 Python AnalyzedWindow.</summary>
    public sealed class AnalyzedWindow
    {
        public AnalyzedWindow(IntPtr hwnd, string title, int left, int top, int width, int height)
        {
            Hwnd = hwnd;
            Title = title ?? "";
            Left = left;
            Top = top;
            Width = width;
            Height = height;
        }

        public IntPtr Hwnd { get; }
        public string Title { get; }
        public int Left { get; }
        public int Top { get; }
        public int Width { get; }
        public int Height { get; }

        /// <summary>SetForegroundWindow then ShowWindow(SW_RESTORE).</summary>
        public bool Activate()
        {
            try
            {
                WindowInputHelper.SetForegroundWindow(Hwnd);
                Native.ShowWindow(Hwnd, SwRestore);
                return true;
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"[WindowAnalyzer] activate failed hwnd={Hwnd}: {ex.Message}");
                return false;
            }
        }
    }
}

/// <summary>Result of AnalyzeWindow / AnalyzeWindowByHandle (Python dict with success/error + analysis data).</summary>
public sealed class WindowAnalysisResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public UiAnalysisDocument? Document { get; set; }
    public string? JsonPath { get; set; }

    public static WindowAnalysisResult Fail(string error) => new() { Success = false, Error = error };
}

/// <summary>Analysis JSON root: timestamp, program_name, window_info, controls, files.</summary>
public sealed class UiAnalysisDocument
{
    [JsonPropertyName("timestamp")] public string Timestamp { get; set; } = "";
    [JsonPropertyName("program_name")] public string ProgramName { get; set; } = "";
    [JsonPropertyName("window_info")] public WindowInfoData? WindowInfo { get; set; }
    [JsonPropertyName("controls")] public List<UiAnalysisControl> Controls { get; set; } = new();
    [JsonPropertyName("files")] public Dictionary<string, string> Files { get; set; } = new();
}

/// <summary>Analysis JSON window_info block.</summary>
public sealed class WindowInfoData
{
    [JsonPropertyName("hwnd")] public long Hwnd { get; set; }
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("left")] public int Left { get; set; }
    [JsonPropertyName("top")] public int Top { get; set; }
    [JsonPropertyName("width")] public int Width { get; set; }
    [JsonPropertyName("height")] public int Height { get; set; }
    [JsonPropertyName("is_active")] public bool IsActive { get; set; }
    [JsonPropertyName("is_maximized")] public bool IsMaximized { get; set; }
    [JsonPropertyName("is_minimized")] public bool IsMinimized { get; set; }
}

/// <summary>One control in the analysis JSON; Id is the snapshot id drawn on the annotated screenshot.</summary>
public sealed class UiAnalysisControl
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("parent_id")] public int? ParentId { get; set; }
    [JsonPropertyName("type")] public string Type { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("automation_id")] public string AutomationId { get; set; } = "";
    [JsonPropertyName("class_name")] public string ClassName { get; set; } = "";
    [JsonPropertyName("value")] public string? Value { get; set; }
    [JsonPropertyName("help_text")] public string? HelpText { get; set; }
    [JsonPropertyName("patterns")] public List<string> Patterns { get; set; } = new();
    [JsonPropertyName("rect")] public UiAnalysisRect? Rect { get; set; }
    [JsonPropertyName("is_enabled")] public bool? IsEnabled { get; set; }
    [JsonPropertyName("is_visible")] public bool? IsVisible { get; set; }
    [JsonPropertyName("level")] public int Level { get; set; }
}

/// <summary>Screen rectangle of a control in the analysis JSON.</summary>
public sealed class UiAnalysisRect
{
    [JsonPropertyName("left")] public int Left { get; set; }
    [JsonPropertyName("top")] public int Top { get; set; }
    [JsonPropertyName("right")] public int Right { get; set; }
    [JsonPropertyName("bottom")] public int Bottom { get; set; }
    [JsonPropertyName("width")] public int Width { get; set; }
    [JsonPropertyName("height")] public int Height { get; set; }
}
