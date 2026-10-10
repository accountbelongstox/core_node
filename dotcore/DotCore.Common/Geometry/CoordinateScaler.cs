// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/game_interface_data.py
namespace DotCore.Common.Geometry;

/// <summary>Window frame sizes in pixels (left/right border, title bar, bottom border) used by windowed-mode scaling.</summary>
public readonly record struct WindowBorders(int Left, int Right, int TitleBar, int Bottom)
{
    /// <summary>No frame (fullscreen or borderless).</summary>
    public static WindowBorders None => new(0, 0, 0, 0);
}

/// <summary>
/// Pure standard-to-actual coordinate scaler (no global state).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/share/game_interface_data.py calculate_unified_scaled_coordinate and scale_standard_value_to_actual.
/// Windowed: (v - border) * scale + border with scale = (actual - frame) / standard. Fullscreen: v * actual / standard.
/// </summary>
public static class CoordinateScaler
{
    /// <summary>Scale factors (actual content / standard content). Windowed subtracts the frame from the actual size.</summary>
    public static (double ScaleX, double ScaleY) GetScale(
        int actualWidth, int actualHeight, int standardWidth, int standardHeight, bool isWindowed, WindowBorders borders)
    {
        if (isWindowed)
        {
            double effectiveActualWidth = actualWidth - (borders.Left + borders.Right);
            double effectiveActualHeight = actualHeight - (borders.TitleBar + borders.Bottom);
            return (effectiveActualWidth / standardWidth, effectiveActualHeight / standardHeight);
        }
        return (actualWidth / (double)standardWidth, actualHeight / (double)standardHeight);
    }

    /// <summary>Map a standard coordinate to the actual window pixel.</summary>
    public static (int X, int Y) Scale(
        int standardX, int standardY,
        int actualWidth, int actualHeight,
        int standardWidth, int standardHeight,
        bool isWindowed, WindowBorders borders)
    {
        var (scaleX, scaleY) = GetScale(actualWidth, actualHeight, standardWidth, standardHeight, isWindowed, borders);
        return ScaleWithFactors(standardX, standardY, scaleX, scaleY, isWindowed, borders);
    }

    /// <summary>Single-axis variant: a null axis stays null (1:1 Python (x, None) / (None, y)).</summary>
    public static (int? X, int? Y) Scale(
        int? standardX, int? standardY,
        int actualWidth, int actualHeight,
        int standardWidth, int standardHeight,
        bool isWindowed, WindowBorders borders)
    {
        var (x, y) = Scale(standardX ?? 0, standardY ?? 0, actualWidth, actualHeight, standardWidth, standardHeight, isWindowed, borders);
        return (standardX.HasValue ? x : null, standardY.HasValue ? y : null);
    }

    /// <summary>Map a standard coordinate with precomputed scale factors.</summary>
    public static (int X, int Y) ScaleWithFactors(
        int standardX, int standardY, double scaleX, double scaleY, bool isWindowed, WindowBorders borders)
    {
        if (isWindowed)
            return (ScaleValue(standardX, scaleX, borders.Left), ScaleValue(standardY, scaleY, borders.TitleBar));
        return ((int)(standardX * scaleX), (int)(standardY * scaleY));
    }

    /// <summary>(value - border) * scale + border, truncated. 1:1 Python scale_standard_value_to_actual.</summary>
    public static int ScaleValue(double value, double scale, int border) => (int)((value - border) * scale + border);

    /// <summary>Inverse of <see cref="Scale(int, int, int, int, int, int, bool, WindowBorders)"/>: actual window pixel -> standard coordinate (not truncated).</summary>
    public static (double X, double Y) Unscale(
        int actualX, int actualY,
        int actualWidth, int actualHeight,
        int standardWidth, int standardHeight,
        bool isWindowed, WindowBorders borders)
    {
        var (scaleX, scaleY) = GetScale(actualWidth, actualHeight, standardWidth, standardHeight, isWindowed, borders);
        return isWindowed
            ? (UnscaleValue(actualX, scaleX, borders.Left), UnscaleValue(actualY, scaleY, borders.TitleBar))
            : (actualX / scaleX, actualY / scaleY);
    }

    /// <summary>(value - border) / scale + border: inverse of <see cref="ScaleValue"/> without truncation.</summary>
    public static double UnscaleValue(double value, double scale, int border) => (value - border) / scale + border;

    /// <summary>Standard rectangle -> actual window rectangle (corners scaled like points).</summary>
    public static RefRect ScaleRect(
        RefRect standard,
        int actualWidth, int actualHeight,
        int standardWidth, int standardHeight,
        bool isWindowed, WindowBorders borders)
    {
        var (scaleX, scaleY) = GetScale(actualWidth, actualHeight, standardWidth, standardHeight, isWindowed, borders);
        var a = ScaleWithFactors((int)standard.X, (int)standard.Y, scaleX, scaleY, isWindowed, borders);
        var b = ScaleWithFactors((int)standard.Right, (int)standard.Bottom, scaleX, scaleY, isWindowed, borders);
        return RefRect.FromCorners(new RefPoint(a.X, a.Y), new RefPoint(b.X, b.Y));
    }

    /// <summary>The fullscreen standard mapping as a <see cref="ReferenceFrame"/> (per-axis stretch).</summary>
    public static ReferenceFrame StretchFrame(int standardWidth, int standardHeight) => new(standardWidth, standardHeight, ScaleMode.Stretch);
}
