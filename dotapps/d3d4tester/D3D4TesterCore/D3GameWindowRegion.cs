// PY-REF: pyapps/d3-check/d3utils/d3u_common/game_window_region.py
using System.Drawing;
using DotCore.ScreenCapture;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Fixed-ratio crops of the game window image (e.g. Smart Echo OCR area). 1:1 Python pyapps/d3-check/d3utils/d3u_common/game_window_region.py.
/// </summary>
public static class D3GameWindowRegion
{
    private const double Middle30Left = 0.35;
    private const double Middle30Right = 0.65;
    private const double UpperHalfTop = 0.0;
    private const double UpperHalfBottom = 0.5;

    /// <summary>Crop middle 30% width, upper half. Returns a new bitmap (caller disposes) or null when invalid. 1:1 crop_game_window_middle30_upper_half.</summary>
    public static Bitmap? CropGameWindowMiddle30UpperHalf(Bitmap? img)
    {
        if (img == null) return null;
        try
        {
            int w = img.Width, h = img.Height;
            if (w <= 0 || h <= 0) return null;
            int left = (int)(Middle30Left * w);
            int right = (int)(Middle30Right * w);
            int upper = (int)(UpperHalfTop * h);
            int lower = (int)(UpperHalfBottom * h);
            if (left >= right || upper >= lower) return null;
            return ScreenCaptureService.CropBitmap(img, new Rectangle(left, upper, right - left, lower - upper));
        }
        catch
        {
            return null;
        }
    }
}
