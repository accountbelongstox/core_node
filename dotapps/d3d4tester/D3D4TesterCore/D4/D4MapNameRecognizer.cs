using DotCore.Foundations;
using DotCore.Utils.Ocr;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// OCR of the "Map Name" crop while post-switch idle: non-empty text sets the current map and clears idle; after 3 empty attempts idle is cleared.
/// 1:1 Python pyapps/d3-check/controller/d4func/map_name_recognizer.py (OCR task map_name; in-memory, no temp file).
/// </summary>
public sealed class D4MapNameRecognizer
{
    private const string LogPrefix = "[MapNameRecognizer]";
    private const string UnknownMap = "Unknown";

    private static readonly Lazy<D4MapNameRecognizer> LazyInstance = new(() =>
    {
        var r = new D4MapNameRecognizer();
        ColorPrinter.Green("[Global] Map name recognizer initialized");
        return r;
    });

    private readonly object _lock = new();

    private D4MapNameRecognizer()
    {
        ColorPrinter.Green($"{LogPrefix} Initialized");
    }

    public static D4MapNameRecognizer Instance => LazyInstance.Value;

    public string LastRecognizedMap { get; private set; } = UnknownMap;
    public int RecognitionAttempts { get; private set; }
    public int MaxRecognitionAttempts => D4Constants.MapNameMaxRecognitionAttempts;
    public bool IsOcrAvailable => D4OcrConfig.EngineForTask(D4OcrConfig.TaskMapName) != null;

    /// <summary>Recognize the map name when post-switch idle. Attempted=false when skipped. 1:1 recognize_map_name.</summary>
    public D4MapNameResult RecognizeMapName(D4InterfaceData data)
    {
        lock (_lock)
        {
            if (!data.IsPostSwitchIdle) return Skipped(null);
            using var image = data.CloneRegionImage(D4RegionNames.MapName);
            if (image == null)
            {
                ColorPrinter.Yellow($"{LogPrefix} Map Name region not found in region images");
                return Skipped("Map Name region not available");
            }
            var engine = D4OcrConfig.EngineForTask(D4OcrConfig.TaskMapName);
            if (engine == null)
            {
                ColorPrinter.Yellow($"{LogPrefix} No OCR engines available");
                return Skipped("No OCR engine");
            }

            RecognitionAttempts++;
            int attempt = RecognitionAttempts;
            ColorPrinter.Blue($"{LogPrefix} Attempting map name recognition (attempt {attempt}/{MaxRecognitionAttempts})");
            ColorPrinter.Blue($"{LogPrefix} Performing OCR recognition...");
            var text = engine.Ocr(image)?.Text?.Trim();
            if (!string.IsNullOrEmpty(text))
            {
                ColorPrinter.Green($"{LogPrefix} OCR result: '{text}'");
                LastRecognizedMap = text;
                data.SetCurrentMapName(text);
                ColorPrinter.Blue($"{LogPrefix} Updated shared data with map name: '{text}'");
                data.IsPostSwitchIdle = false;
                RecognitionAttempts = 0;
                ColorPrinter.Green($"{LogPrefix} Map name recognized: '{text}'");
                return new D4MapNameResult(true, true, text, attempt, MaxRecognitionAttempts, false);
            }

            ColorPrinter.Yellow($"{LogPrefix} No text recognized in Map Name region");
            bool gaveUp = false;
            if (RecognitionAttempts >= MaxRecognitionAttempts)
            {
                ColorPrinter.Yellow($"{LogPrefix} Max recognition attempts reached, resetting post-switch idle");
                data.IsPostSwitchIdle = false;
                RecognitionAttempts = 0;
                gaveUp = true;
            }
            return new D4MapNameResult(true, false, null, attempt, MaxRecognitionAttempts, gaveUp);
        }
    }

    /// <summary>Reset attempt counter and last map (used on Stop).</summary>
    public void Reset()
    {
        lock (_lock)
        {
            RecognitionAttempts = 0;
            LastRecognizedMap = UnknownMap;
        }
    }

    private D4MapNameResult Skipped(string? error) =>
        new(false, false, null, RecognitionAttempts, MaxRecognitionAttempts, false, error);
}
