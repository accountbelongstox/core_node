// PY-REF: dotapps/d3d4tester/reference/py_d3check/d4utils/d4_red_portal_detector.py
using DotCore.Utils.ImageColor;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Red portal: OR mask of 12 portal colors (±5 %), column-major scan inside the scaled margins, first window (≤ max size)
/// holding ≥ min area matched pixels -> its bounding box. Run per D4 tick by D4Pipeline (Python had no caller).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d4utils/d4_red_portal_detector.py.
/// </summary>
public static class D4RedPortalDetector
{
    /// <summary>Portal bounding box in image coordinates, or null. 1:1 d4_detect_red_portal.</summary>
    public static Rect? Detect(Mat imageBgr, bool isWindowed)
    {
        if (imageBgr == null || imageBgr.Empty()) return null;
        using var mask = BgrColorMatch.InRangeAnyMaskRatio(imageBgr, D4Constants.RedPortalColors, D4Constants.RedPortalColorTolerance);
        return FindPortalRegion(mask, (imageBgr.Width, imageBgr.Height), isWindowed);
    }

    private static Rect? FindPortalRegion(Mat mask, (int Width, int Height) size, bool isWindowed)
    {
        int h = mask.Rows, w = mask.Cols;
        int leftMargin = D4StandardCoords.Scale(D4StandardCoords.RedPortalScanLeftMarginX, 0, size, isWindowed).X;
        int rightMargin = D4StandardCoords.Scale(D4StandardCoords.RedPortalScanRightMarginX, 0, size, isWindowed).X;
        int bottomMargin = D4StandardCoords.Scale(0, D4StandardCoords.RedPortalScanBottomMarginY, size, isWindowed).Y;
        int maxWidth = D4StandardCoords.Scale(D4StandardCoords.RedPortalMaxWidthX, 0, size, isWindowed).X;
        int maxHeight = D4StandardCoords.Scale(0, D4StandardCoords.RedPortalMaxHeightY, size, isWindowed).Y;
        int xMin = leftMargin, xMax = w - rightMargin, yMax = h - bottomMargin;
        if (xMin >= xMax || yMax <= 0) return null;

        for (int px = Math.Max(0, xMin); px < Math.Min(w, xMax); px++)
        {
            for (int py = 0; py < Math.Min(h, yMax); py++)
            {
                if (mask.At<byte>(py, px) == 0) continue;
                int xEnd = Math.Min(w, px + maxWidth);
                int yEnd = Math.Min(h, py + maxHeight);
                int count = 0, minX = int.MaxValue, minY = int.MaxValue, maxX = -1, maxY = -1;
                for (int y = py; y < yEnd; y++)
                {
                    for (int x = px; x < xEnd; x++)
                    {
                        if (mask.At<byte>(y, x) == 0) continue;
                        count++;
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
                if (count >= D4StandardCoords.RedPortalMinArea && maxX >= 0)
                    return new Rect(minX, minY, maxX - minX + 1, maxY - minY + 1);
            }
        }
        return null;
    }
}
