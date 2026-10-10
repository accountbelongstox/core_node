// PY-REF: scripts/analysis/d4_minimap_path.py
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Debug drawing of a route result: map rect, route dots, ordered path arrows with indices, player and heading.
/// 1:1 Python scripts/analysis/d4_minimap_path.py draw_debug (player and heading text are DOT-only).
/// </summary>
public static class MinimapRouteAnnotator
{
    private static readonly Scalar RectColor = new(0, 255, 255);
    private static readonly Scalar DotColor = new(0, 0, 255);
    private static readonly Scalar PathColor = new(0, 255, 0);
    private static readonly Scalar IndexColor = new(255, 0, 255);
    private static readonly Scalar PlayerColor = new(255, 255, 0);

    /// <summary>Draw <paramref name="result"/> onto a copy of <paramref name="bgr"/>. Caller disposes.</summary>
    public static Mat Draw(Mat bgr, MinimapRouteResult result)
    {
        var vis = bgr.Clone();
        if (result.MapRect is { } map) Cv2.Rectangle(vis, map, RectColor, 2);
        foreach (var dot in result.Dots) Cv2.Circle(vis, dot, 3, DotColor, -1);
        var path = result.OrderedPath;
        for (int i = 0; i < path.Count - 1; i++)
            Cv2.ArrowedLine(vis, path[i], path[i + 1], PathColor, 2, tipLength: 0.3);
        for (int i = 0; i < path.Count; i++)
            Cv2.PutText(vis, i.ToString(), new Point(path[i].X + 4, path[i].Y - 4), HersheyFonts.HersheySimplex, 0.4, IndexColor, 1);
        if (result.Player is { } player)
        {
            Cv2.DrawMarker(vis, player, PlayerColor, MarkerTypes.Cross, 10, 2);
            if (result.HeadingDegrees is { } heading)
                Cv2.PutText(vis, $"{heading:F1} deg", new Point(player.X + 6, player.Y + 14), HersheyFonts.HersheySimplex, 0.4, PlayerColor, 1);
        }
        return vis;
    }
}
