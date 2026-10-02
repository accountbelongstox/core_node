// PY-REF: pyapps/d3-check/controller/d4func/map_switch_detector.py
// PY-REF: pyapps/d3-check/d4utils/d4_black_screen_detector.py
using DotCore.Foundations;
using DotCore.Utils.ImageColor;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Edge-triggered map switch state machine on the "Map Name" crop: black appears -> switching; black clears -> post-switch idle,
/// count++, map OCR at once; any user action -> normal. Black = ≥95 % pixels with all channels ≤25 (DotCore BgrColorMatch.IsMostlyBlack).
/// 1:1 Python pyapps/d3-check/controller/d4func/map_switch_detector.py (+ d4utils/d4_black_screen_detector.py).
/// </summary>
public sealed class D4MapSwitchDetector
{
    private const string LogPrefix = "[MapSwitchDetector]";

    private static readonly Lazy<D4MapSwitchDetector> LazyInstance = new(() =>
    {
        var d = new D4MapSwitchDetector();
        ColorPrinter.Green("[Global] Map switch detector initialized");
        return d;
    });

    private readonly object _lock = new();
    private bool _previousIsBlack;

    private D4MapSwitchDetector()
    {
        ColorPrinter.Green($"{LogPrefix} Initialized");
    }

    public static D4MapSwitchDetector Instance => LazyInstance.Value;

    /// <summary>Evaluate one tick on the latest Map Name crop. 1:1 detect_map_switch.</summary>
    public D4MapSwitchResult DetectMapSwitch(D4InterfaceData data)
    {
        lock (_lock)
        {
            using var image = data.CloneRegionImage(D4RegionNames.MapName);
            if (image == null)
            {
                ColorPrinter.Yellow($"{LogPrefix} Map Name region not found in region images");
                return new D4MapSwitchResult(false, false, D4MapSwitchTransition.None, data.MapSwitchState, data.MapSwitchCount, null,
                    "Map Name region not available");
            }
            bool isBlack = BgrColorMatch.IsMostlyBlack(image);
            var transition = D4MapSwitchTransition.None;
            D4MapNameResult? recognition = null;
            if (isBlack && !_previousIsBlack)
            {
                data.IsSwitchingMap = true;
                data.IsPostSwitchIdle = false;
                transition = D4MapSwitchTransition.SwitchStarted;
                ColorPrinter.Blue($"{LogPrefix} Map switching started (black screen detected)");
            }
            else if (!isBlack && _previousIsBlack)
            {
                data.IsSwitchingMap = false;
                data.IsPostSwitchIdle = true;
                data.MapSwitchCount++;
                transition = D4MapSwitchTransition.SwitchCompleted;
                ColorPrinter.Green($"{LogPrefix} Map switch completed (count: {data.MapSwitchCount})");
                recognition = D4MapNameRecognizer.Instance.RecognizeMapName(data);
                if (recognition.Attempted)
                    ColorPrinter.Blue($"{LogPrefix} Map name recognition triggered successfully");
                else
                    ColorPrinter.Yellow($"{LogPrefix} Map name recognition not triggered or failed");
            }
            _previousIsBlack = isBlack;
            return new D4MapSwitchResult(true, isBlack, transition, data.MapSwitchState, data.MapSwitchCount, recognition);
        }
    }

    /// <summary>Post-switch idle -> normal (call on a user action). 1:1 reset_post_switch_idle.</summary>
    public void ResetPostSwitchIdle(D4InterfaceData data)
    {
        if (!data.IsPostSwitchIdle) return;
        data.IsPostSwitchIdle = false;
        ColorPrinter.Blue($"{LogPrefix} Post-switch idle cleared (user action detected)");
    }

    /// <summary>Forget the previous black state (used on Stop so a stale edge cannot fire after restart).</summary>
    public void Reset()
    {
        lock (_lock)
            _previousIsBlack = false;
    }
}
