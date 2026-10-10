// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/constants/d3.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/config/screenshot_categories.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Template names, region ratio, capture and key timings for D3. 1:1 with Python
/// providor.constants.d3, providor.constants.common (click/activate) and share.scaled_template_matcher_base.LEFT_REGION_RATIO.
/// </summary>
public static class D3InterfaceConstants
{
    /// <summary>Match center in left this fraction of image width = blacksmith (bag opened) or kanai. 1:1 Python LEFT_REGION_RATIO = 0.3.</summary>
    public const double LeftRegionRatio = 0.3;

    /// <summary>[C3w] Pause between two C3 recognitions.</summary>
    public const double C3wWaitSec = 2.0;

    /// <summary>1:1 Python CLICK_MOVE_DURATION_SEC / CLICK_PAUSE_AFTER_MOVE_SEC.</summary>
    public const double ClickMoveDurationSec = 0.0;
    public const double ClickPauseAfterMoveSec = 0.02;

    /// <summary>1:1 Python ACTIVATE_BEFORE_CAPTURE_DELAY_SEC.</summary>
    public const int ActivateBeforeCaptureDelayMs = 300;

    /// <summary>Key-down to key-up gap for M sent via PostMessage.</summary>
    public const int SendKeyHoldMs = 50;

    public const ushort VkEscape = 0x1B;

    /// <summary>1:1 Python TMP_DIR (system cache pytools/tmp).</summary>
    public static readonly string TmpRootDir = Path.Combine(Path.GetTempPath(), "pytools", "tmp");
}
