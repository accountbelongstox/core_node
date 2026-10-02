// PY-REF: pyapps/d3-check/share/game_interface_data.py
// PY-REF: pyapps/d3-check/controller/d4func/map_name_utils.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4 shared interface data (singleton). 1:1 Python pyapps/d3-check/share/game_interface_data.py D4InterfaceData (+ InterfaceDataBase)
/// and controller/d4func/map_name_utils.py (current map). Typed fields replace the overloaded detected_regions dict:
/// region crops live in <see cref="RegionImages"/>, the map name in <see cref="CurrentMap"/>, the location in <see cref="SmallMap"/>.
/// Fixes Python bug: small-map and window-region detection overwrote detected_regions, dropping region_images and map_name.
/// Images are BGR Mats owned by this instance; readers get clones through the snapshot methods.
/// </summary>
public sealed class D4InterfaceData
{
    private static readonly Lazy<D4InterfaceData> LazyInstance = new(() =>
    {
        ColorPrinter.Green("[Global] D4 interface data initialized");
        return new D4InterfaceData();
    });

    private readonly object _imageLock = new();
    private Mat? _gameWindowImage;
    private Dictionary<string, Mat> _regionImages = new(StringComparer.Ordinal);

    private D4InterfaceData() { }

    public static D4InterfaceData Instance => LazyInstance.Value;

    public string? Timestamp { get; set; }
    public string? Error { get; set; }
    public (int X, int Y) WindowOffset { get; set; }
    public (int Width, int Height) FullscreenSize { get; set; }
    public (int Width, int Height) GameWindowSize { get; set; }
    public string? LastAnnotatedScreenshotPath { get; set; }

    public IReadOnlyDictionary<string, D4RegionInfo>? DetectedRegions { get; set; }
    public IReadOnlyDictionary<string, D4PointInfo>? DetectedPoints { get; set; }
    public DateTime? RegionDetectionTimestamp { get; set; }

    public D4TeamHealthResult? TeamHealth { get; set; }
    public DateTime? TeamHealthDetectionTimestamp { get; set; }
    public D4SmallMapResult? SmallMap { get; set; }
    public DateTime? SmallMapDetectionTimestamp { get; set; }
    public string? LastSmallMapDebugPath { get; set; }

    public bool GameRunning { get; set; }
    public bool ExpFarmingRunning { get; set; }

    public bool WindowDetected { get; set; }
    public IntPtr? WindowHwnd { get; set; }
    public string WindowTitle { get; set; } = "";
    public (int X, int Y) WindowPosition { get; set; }

    public int CurrentAct { get; set; }
    public int CurrentChapter { get; set; }
    public string CurrentQuest { get; set; } = "";
    public string Difficulty { get; set; } = "";
    public int WorldTier { get; set; }
    public int CurrentLevel { get; set; }
    public int CurrentExp { get; set; }
    public int ExpToNextLevel { get; set; }
    public double ExpPercent { get; set; }
    public int ParagonLevel { get; set; }

    public string? LastScreenshotPath { get; set; }
    public DateTime? LastScreenshotTime { get; set; }

    public bool DebugWindowOpen { get; set; }
    public bool DebugWindowPaused { get; set; }

    public bool IsSwitchingMap { get; set; }
    public int MapSwitchCount { get; set; }
    public bool IsPostSwitchIdle { get; set; }

    /// <summary>null = unknown, true = has team, false = no team.</summary>
    public bool? HasTeam { get; set; }
    public DateTime? TeamCheckTimestamp { get; set; }

    /// <summary>Wait used by operations for "next tick" (fixes Python bug: 0.1 s default never matched the 3 s D4 tick).</summary>
    public double TickIntervalSec { get; set; } = D4Constants.TickIntervalSec;

    /// <summary>Recognized map name (map_name_utils current map); null = Unknown.</summary>
    public string? CurrentMap { get; set; }

    /// <summary>Dungeon progress text; no producer yet (Python never produced it).</summary>
    public string? DungeonProgress { get; set; }

    public bool IsMapNameAvailable => !string.IsNullOrEmpty(CurrentMap);
    public D4LocationType LocationType => SmallMap?.LocationType ?? D4LocationType.Unknown;
    public bool? IsInTown => SmallMap?.IsInTown;
    public bool HasGameWindowImage { get { lock (_imageLock) return _gameWindowImage is { IsDisposed: false } m && !m.Empty(); } }
    public int RegionImageCount { get { lock (_imageLock) return _regionImages.Count; } }

    public D4MapSwitchState MapSwitchState =>
        IsSwitchingMap ? D4MapSwitchState.Switching : IsPostSwitchIdle ? D4MapSwitchState.PostSwitch : D4MapSwitchState.Normal;

    /// <summary>Windowed when fullscreen minus window is at least the title-bar threshold on both axes. 1:1 is_windowed_mode.</summary>
    public bool IsWindowedMode()
    {
        var (ww, wh) = GameWindowSize;
        var (fw, fh) = FullscreenSize;
        return fw - ww >= D4Constants.WindowedThreshold && fh - wh >= D4Constants.WindowedThreshold;
    }

    public bool IsExpFarmingRunning() => ExpFarmingRunning;

    /// <summary>Replace the game window image (takes ownership; previous disposed).</summary>
    public void SetGameWindowImage(Mat? bgr)
    {
        lock (_imageLock)
        {
            if (!ReferenceEquals(_gameWindowImage, bgr)) _gameWindowImage?.Dispose();
            _gameWindowImage = bgr;
        }
    }

    /// <summary>Clone of the game window image (BGR), or null. Caller disposes.</summary>
    public Mat? CloneGameWindowImage()
    {
        lock (_imageLock)
            return _gameWindowImage is { IsDisposed: false } m && !m.Empty() ? m.Clone() : null;
    }

    /// <summary>Replace all region crops (takes ownership; previous disposed).</summary>
    public void SetRegionImages(Dictionary<string, Mat> images)
    {
        lock (_imageLock)
        {
            foreach (var old in _regionImages.Values) old.Dispose();
            _regionImages = images ?? new Dictionary<string, Mat>(StringComparer.Ordinal);
        }
    }

    /// <summary>Clone of one region crop (BGR), or null. Caller disposes.</summary>
    public Mat? CloneRegionImage(string label)
    {
        lock (_imageLock)
            return _regionImages.TryGetValue(label, out var m) && !m.IsDisposed && !m.Empty() ? m.Clone() : null;
    }

    /// <summary>Region crop labels in insertion order.</summary>
    public IReadOnlyList<string> GetRegionImageLabels()
    {
        lock (_imageLock)
            return _regionImages.Keys.ToList();
    }

    /// <summary>All region crops as new bitmaps for the debug window. Caller disposes.</summary>
    public Dictionary<string, Bitmap> CloneRegionBitmaps()
    {
        var result = new Dictionary<string, Bitmap>(StringComparer.Ordinal);
        lock (_imageLock)
        {
            foreach (var kv in _regionImages)
            {
                if (kv.Value.IsDisposed || kv.Value.Empty()) continue;
                result[kv.Key] = ImageConvert.MatToBitmap(kv.Value);
            }
        }
        return result;
    }

    /// <summary>Set current map name (map_name_utils.set_current_map_name).</summary>
    public void SetCurrentMapName(string mapName)
    {
        CurrentMap = mapName;
        ColorPrinter.Blue($"[MapNameUtils] Set current map name: '{mapName}'");
    }

    /// <summary>Clear current map name (map_name_utils.clear_current_map_name).</summary>
    public void ClearCurrentMapName()
    {
        CurrentMap = null;
        ColorPrinter.Blue("[MapNameUtils] Cleared current map name");
    }

    /// <summary>Clear all data (called on Stop). 1:1 D4InterfaceData.clear.</summary>
    public void Clear()
    {
        Timestamp = null;
        Error = null;
        SetGameWindowImage(null);
        SetRegionImages(new Dictionary<string, Mat>(StringComparer.Ordinal));
        WindowOffset = (0, 0);
        FullscreenSize = (0, 0);
        GameWindowSize = (0, 0);
        LastAnnotatedScreenshotPath = null;
        DetectedRegions = null;
        DetectedPoints = null;
        RegionDetectionTimestamp = null;
        TeamHealth = null;
        TeamHealthDetectionTimestamp = null;
        SmallMap = null;
        SmallMapDetectionTimestamp = null;
        LastSmallMapDebugPath = null;
        GameRunning = false;
        ExpFarmingRunning = false;
        WindowDetected = false;
        WindowHwnd = null;
        WindowTitle = "";
        WindowPosition = (0, 0);
        CurrentAct = 0;
        CurrentChapter = 0;
        CurrentQuest = "";
        Difficulty = "";
        WorldTier = 0;
        CurrentLevel = 0;
        CurrentExp = 0;
        ExpToNextLevel = 0;
        ExpPercent = 0.0;
        ParagonLevel = 0;
        LastScreenshotPath = null;
        LastScreenshotTime = null;
        DebugWindowOpen = false;
        DebugWindowPaused = false;
        IsSwitchingMap = false;
        MapSwitchCount = 0;
        IsPostSwitchIdle = false;
        HasTeam = null;
        TeamCheckTimestamp = null;
        CurrentMap = null;
        DungeonProgress = null;
    }
}
