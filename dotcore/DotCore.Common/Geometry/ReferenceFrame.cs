// PY-REF: none (DOT-only)
namespace DotCore.Common.Geometry;

/// <summary>How a UI laid out on a reference (standard) size follows the actual size.</summary>
public enum ScaleMode
{
    /// <summary>X and Y scale independently (actual / reference per axis): the standard-resolution mapping of <see cref="CoordinateScaler"/>.</summary>
    Stretch,
    /// <summary>One scale from the height, centered horizontally (UIs that keep their aspect, e.g. Diablo III dialogs).</summary>
    HeightCentered,
    /// <summary>One scale from the width, centered vertically.</summary>
    WidthCentered,
    /// <summary>One scale that fits the reference inside the actual size (letterbox), centered on both axes.</summary>
    Fit,
    /// <summary>One scale that makes the reference cover the actual size (cropped), centered on both axes.</summary>
    Fill,
}

/// <summary>Point in reference units (or actual pixels, by context).</summary>
public readonly record struct RefPoint(double X, double Y)
{
    public RefPoint Offset(double dx, double dy) => new(X + dx, Y + dy);

    public RefPoint Minus(RefPoint other) => new(X - other.X, Y - other.Y);

    public RefPoint Plus(RefPoint other) => new(X + other.X, Y + other.Y);
}

/// <summary>Rectangle in reference units (or actual pixels, by context).</summary>
public readonly record struct RefRect(double X, double Y, double Width, double Height)
{
    public RefPoint TopLeft => new(X, Y);

    public RefPoint Center => new(X + Width / 2, Y + Height / 2);

    public double Right => X + Width;

    public double Bottom => Y + Height;

    public RefRect Offset(double dx, double dy) => this with { X = X + dx, Y = Y + dy };

    public RefRect Inflate(double d) => new(X - d, Y - d, Width + 2 * d, Height + 2 * d);

    /// <summary>The rectangle relative to an anchor point (anchor becomes the origin).</summary>
    public RefRect RelativeTo(RefPoint anchor) => Offset(-anchor.X, -anchor.Y);

    /// <summary>A rectangle stored relative to an anchor, placed at the anchor again.</summary>
    public RefRect At(RefPoint anchor) => Offset(anchor.X, anchor.Y);

    /// <summary>Every edge within tolerance of the other rectangle's.</summary>
    public bool IsNear(RefRect other, double tolerance) =>
        Math.Abs(X - other.X) <= tolerance && Math.Abs(Y - other.Y) <= tolerance
        && Math.Abs(Width - other.Width) <= tolerance && Math.Abs(Height - other.Height) <= tolerance;

    public static RefRect FromCorners(RefPoint a, RefPoint b) =>
        new(Math.Min(a.X, b.X), Math.Min(a.Y, b.Y), Math.Abs(b.X - a.X), Math.Abs(b.Y - a.Y));
}

/// <summary>
/// A reference size and how the UI follows the actual size: positions measured once on the reference size (or learned on any size
/// and stored in reference units, see <see cref="LayoutCache"/>) map to actual pixels by the size ratio, and back. Per axis the
/// mapping is v * s (anchored at 0) or A / 2 + (v - R / 2) * s (centered), with s from <see cref="Mode"/>.
/// </summary>
public readonly record struct ReferenceFrame(double Width, double Height, ScaleMode Mode)
{
    /// <summary>Scale factors (actual / reference) for the actual size.</summary>
    public (double X, double Y) Scale(double actualWidth, double actualHeight) => Mode switch
    {
        ScaleMode.Stretch => (actualWidth / Width, actualHeight / Height),
        ScaleMode.HeightCentered => Uniform(actualHeight / Height),
        ScaleMode.WidthCentered => Uniform(actualWidth / Width),
        ScaleMode.Fit => Uniform(Math.Min(actualWidth / Width, actualHeight / Height)),
        _ => Uniform(Math.Max(actualWidth / Width, actualHeight / Height)),
    };

    /// <summary>Reference length to actual pixels along X (uniform modes: the one scale).</summary>
    public double LengthX(double length, double actualWidth, double actualHeight) => length * Scale(actualWidth, actualHeight).X;

    /// <summary>Reference length to actual pixels along Y (uniform modes: the one scale).</summary>
    public double LengthY(double length, double actualWidth, double actualHeight) => length * Scale(actualWidth, actualHeight).Y;

    /// <summary>Reference point to actual coordinates (not rounded).</summary>
    public RefPoint ToActual(RefPoint point, double actualWidth, double actualHeight)
    {
        var (sx, sy) = Scale(actualWidth, actualHeight);
        return new(Forward(point.X, Width, actualWidth, sx, CenteredX), Forward(point.Y, Height, actualHeight, sy, CenteredY));
    }

    /// <summary>Reference point to the nearest actual pixel.</summary>
    public (int X, int Y) ToPixel(RefPoint point, double actualWidth, double actualHeight)
    {
        var p = ToActual(point, actualWidth, actualHeight);
        return ((int)Math.Round(p.X), (int)Math.Round(p.Y));
    }

    /// <summary>Actual coordinates back to reference units (inverse of <see cref="ToActual(RefPoint, double, double)"/>).</summary>
    public RefPoint ToReference(RefPoint actual, double actualWidth, double actualHeight)
    {
        var (sx, sy) = Scale(actualWidth, actualHeight);
        return new(Backward(actual.X, Width, actualWidth, sx, CenteredX), Backward(actual.Y, Height, actualHeight, sy, CenteredY));
    }

    public RefRect ToActual(RefRect rect, double actualWidth, double actualHeight) =>
        RefRect.FromCorners(ToActual(rect.TopLeft, actualWidth, actualHeight), ToActual(new RefPoint(rect.Right, rect.Bottom), actualWidth, actualHeight));

    public RefRect ToReference(RefRect actual, double actualWidth, double actualHeight) =>
        RefRect.FromCorners(ToReference(actual.TopLeft, actualWidth, actualHeight), ToReference(new RefPoint(actual.Right, actual.Bottom), actualWidth, actualHeight));

    private bool CenteredX => Mode is ScaleMode.HeightCentered or ScaleMode.Fit or ScaleMode.Fill;

    private bool CenteredY => Mode is ScaleMode.WidthCentered or ScaleMode.Fit or ScaleMode.Fill;

    private static (double, double) Uniform(double s) => (s, s);

    private static double Forward(double v, double reference, double actual, double s, bool centered) =>
        centered ? actual / 2.0 + (v - reference / 2) * s : v * s;

    private static double Backward(double a, double reference, double actual, double s, bool centered) =>
        centered ? (a - actual / 2.0) / s + reference / 2 : a / s;
}
