// PY-REF: none (DOT-only)
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.Runtime.InteropServices;

namespace DotApps.d3d4tester.Core.Monitor;

/// <summary>
/// Color-count probes on a client-area capture, crops as fractions of the client size (RBAssist GETPIXELCOLORCNT, GETTPPIXEL,
/// FIND_URSHI, FIND_ILLUSION, FINISH_ILLUSION). Fixes RBAssist bug: its row loops ran past the crop height (read outside the bitmap).
/// </summary>
public static class D3PixelProbes
{
    private const int IllusionSegments = 11;
    private const int WhiteMin = 210;

    /// <summary>Thresholds parsed from "a,b,c"; missing or invalid parts keep the defaults.</summary>
    public static int[] ParseThresholds(string? text, params int[] defaults)
    {
        var parts = (text ?? "").Split(',', StringSplitOptions.TrimEntries);
        var result = (int[])defaults.Clone();
        for (int i = 0; i < result.Length && i < parts.Length; i++)
            if (int.TryParse(parts[i], NumberStyles.Integer, CultureInfo.InvariantCulture, out int v)) result[i] = v;
        return result;
    }

    /// <summary>Pixels equal to (r, g, b ± 2) in the center crop (w/13.33 x 0.75 * h/5.33): ROSBOT combat cursor color count.</summary>
    public static int CountCenterColor(Bitmap bmp, int r, int g, int b)
    {
        int cw = (int)(bmp.Width / 13.33), ch = (int)(bmp.Height / 5.33);
        var rect = new Rectangle((bmp.Width - cw) / 2, (bmp.Height - ch) / 2, cw, (int)(ch * 0.75));
        return Count(bmp, rect, (x, y, pr, pg, pb) => pr == r && pg == g && Math.Abs(pb - b) <= 2);
    }

    /// <summary>Blue town-portal channel pixels under the portrait (x w/60, y h/12.5, w/40 x h/33).</summary>
    public static int CountTownPortalPixels(Bitmap bmp)
    {
        var rect = new Rectangle(bmp.Width / 60, (int)(bmp.Height / 12.5), bmp.Width / 40, bmp.Height / 33);
        return Count(bmp, rect, (x, y, r, g, b) => r is >= 41 and <= 105 && g is >= 69 and <= 187 && b is >= 214 and <= 249);
    }

    /// <summary>Urshi gem-upgrade dialog: thresholds [goldBottom, white, blue] (RBAssist General.urshi, default 100,6,140).</summary>
    public static bool IsUrshiOpen(Bitmap bmp, int[] t)
    {
        int cw = bmp.Width / 16, ch = (int)(bmp.Height / 9.5);
        var rect = new Rectangle((int)(bmp.Width / 9.3), bmp.Height / 28, cw, ch);
        int subStart = ch - ch / 4;
        int whiteMaxY = (int)(ch * 0.375), whiteMinX = (int)(cw / 2.5), whiteMaxX = (int)(cw / 1.67);
        int gold = 0, goldSub = 0, white = 0, blue = 0;
        Count(bmp, rect, (x, y, r, g, b) =>
        {
            if (r is >= 141 and <= 250 && g is >= 86 and <= 191 && b <= 88)
            {
                gold++;
                if (y >= subStart) goldSub++;
            }
            if (r is >= 187 and <= 252 && g is >= 184 and <= 244 && b is >= 137 and <= 204 && y <= whiteMaxY && x > whiteMinX && x < whiteMaxX)
                white++;
            if (r is >= 13 and <= 115 && g is >= 55 and <= 170 && b >= 112 && y <= subStart)
                blue++;
            return false;
        });
        return goldSub > t[0] && gold >= t[0] * 2 && white > t[1] && blue > t[2];
    }

    /// <summary>Hostile illusion banner: thresholds [whiteTotal, firstSegmentMin, otherSegmentMin] (default 60,1,2).</summary>
    public static bool IsIllusionFound(Bitmap bmp, int[] t)
    {
        int cw = (int)(bmp.Width / 7.2), ch = bmp.Height / 35;
        var rect = new Rectangle((int)(bmp.Width / 2.34), (int)(bmp.Height / 4.9), cw, ch);
        int segWidth = Math.Max(1, cw / IllusionSegments);
        var segs = new int[IllusionSegments];
        int white = Count(bmp, rect, (x, y, r, g, b) =>
        {
            if (r < WhiteMin || g < WhiteMin || b < WhiteMin) return false;
            segs[Math.Min(IllusionSegments - 1, x / segWidth)]++;
            return true;
        });
        if (white <= t[0]) return false;
        if (segs[0] < t[1]) return false;
        for (int i = 1; i < IllusionSegments; i++)
            if (segs[i] <= t[2]) return false;
        return true;
    }

    /// <summary>Illusion completed banner: thresholds [gold, white] (default 100,25).</summary>
    public static bool IsIllusionFinished(Bitmap bmp, int[] t)
    {
        var rect = new Rectangle((int)(bmp.Width / 2.2), bmp.Height / 8, bmp.Width / 11, bmp.Height / 11);
        int white = 0;
        int gold = Count(bmp, rect, (x, y, r, g, b) =>
        {
            if (r >= WhiteMin && g >= WhiteMin && b >= WhiteMin) white++;
            return r is >= 120 and <= 204 && g is >= 96 and <= 156 && b is >= 64 and <= 81;
        });
        return gold > t[0] && white > t[1];
    }

    private delegate bool PixelPredicate(int x, int y, int r, int g, int b);

    /// <summary>Count pixels in rect (clipped to the bitmap) matching the predicate; x/y are relative to the rect.</summary>
    private static int Count(Bitmap bmp, Rectangle rect, PixelPredicate predicate)
    {
        rect.Intersect(new Rectangle(0, 0, bmp.Width, bmp.Height));
        if (rect.Width <= 0 || rect.Height <= 0) return 0;
        var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            int stride = data.Stride;
            var row = new byte[rect.Width * 4];
            int count = 0;
            for (int y = 0; y < rect.Height; y++)
            {
                Marshal.Copy(data.Scan0 + y * stride, row, 0, row.Length);
                for (int x = 0; x < rect.Width; x++)
                {
                    int i = x * 4;
                    if (predicate(x, y, row[i + 2], row[i + 1], row[i])) count++;
                }
            }
            return count;
        }
        finally
        {
            bmp.UnlockBits(data);
        }
    }
}
