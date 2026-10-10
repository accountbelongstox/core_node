// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/coordinate_helper.py
namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4 game -> screen coordinate helpers (window offset + standard scaling, random points, title bar point, random delay).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/share/coordinate_helper.py.
/// </summary>
public static class D4CoordinateHelper
{
    private static readonly Random Rng = new();

    /// <summary>Game coordinate (standard or actual) -> screen. 1:1 calculate_screen_coordinate.</summary>
    public static (int X, int Y) CalculateScreenCoordinate(D4InterfaceData data, (int X, int Y) gameCoord, bool useStandardResolution = true)
    {
        var size = data.GameWindowSize;
        if (size.Width <= 0 || size.Height <= 0) return gameCoord;
        var scaled = useStandardResolution ? D4StandardCoords.Scale(gameCoord, size, data.IsWindowedMode()) : gameCoord;
        return (scaled.X + data.WindowOffset.X, scaled.Y + data.WindowOffset.Y);
    }

    /// <summary>Random screen point inside a region with a margin. 1:1 calculate_random_point_in_region.</summary>
    public static (int X, int Y) CalculateRandomPointInRegion(
        D4InterfaceData data, (int X, int Y) regionStart, (int X, int Y) regionEnd, bool useStandardResolution = true, int? margin = null)
    {
        int m = margin ?? D4Constants.ClickMarginRegion;
        var s = CalculateScreenCoordinate(data, regionStart, useStandardResolution);
        var e = CalculateScreenCoordinate(data, regionEnd, useStandardResolution);
        int minX = Math.Min(s.X, e.X) + m, maxX = Math.Max(s.X, e.X) - m;
        int minY = Math.Min(s.Y, e.Y) + m, maxY = Math.Max(s.Y, e.Y) - m;
        if (minX >= maxX) (minX, maxX) = (s.X, e.X);
        if (minY >= maxY) (minY, maxY) = (s.Y, e.Y);
        return (RandomInclusive(minX, maxX), RandomInclusive(minY, maxY));
    }

    /// <summary>Random screen point in the title bar for window activation; null without a window size. 1:1 get_title_bar_random_point.</summary>
    public static (int X, int Y)? GetTitleBarRandomPoint(D4InterfaceData data)
    {
        var (w, h) = data.GameWindowSize;
        if (w <= 0 || h <= 0) return null;
        var (ox, oy) = data.WindowOffset;
        int margin = D4Constants.ClickMarginDefault;
        int left = ox + D4Constants.Borders.Left + margin;
        int right = ox + w - D4Constants.Borders.Right - margin;
        int top = oy + D4Constants.TitleBarTopOffset + D4Constants.TitleBarInnerMargin;
        int bottom = oy + D4Constants.TitleBarTopOffset + D4Constants.Borders.TitleBar - D4Constants.TitleBarInnerMargin;
        return (RandomInclusive(left, right), RandomInclusive(top, bottom));
    }

    /// <summary>Random delay in seconds within [minMs, maxMs]. 1:1 calculate_random_delay.</summary>
    public static double CalculateRandomDelay(double minMs = D4Constants.RandomDelayMinMs, double maxMs = D4Constants.RandomDelayMaxMs)
    {
        lock (Rng)
            return (minMs + Rng.NextDouble() * (maxMs - minMs)) / 1000.0;
    }

    /// <summary>random.randint(a, b) (inclusive; swapped bounds tolerated).</summary>
    public static int RandomInclusive(int a, int b)
    {
        if (a > b) (a, b) = (b, a);
        lock (Rng)
            return Rng.Next(a, b + 1);
    }
}
