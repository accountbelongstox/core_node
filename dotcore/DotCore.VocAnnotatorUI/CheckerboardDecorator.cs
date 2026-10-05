// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace DotCore.VocAnnotatorUI;

/// <summary>
/// Decorator that paints a transparency checkerboard behind its child (e.g. a cutout thumbnail).
/// The two cell brushes follow the theme tokens by default and can be overridden.
/// </summary>
public sealed class CheckerboardDecorator : Decorator
{
    private const string LightBrushKey = "ControlStrokeBrush";
    private const string DarkBrushKey = "InsetBackgroundBrush";

    public static readonly DependencyProperty LightBrushProperty = Dp(nameof(LightBrush), typeof(Brush), null);
    public static readonly DependencyProperty DarkBrushProperty = Dp(nameof(DarkBrush), typeof(Brush), null);
    public static readonly DependencyProperty CellSizeProperty = Dp(nameof(CellSize), typeof(double), 6.0);

    private Brush? _tile;

    public CheckerboardDecorator()
    {
        SetResourceReference(LightBrushProperty, LightBrushKey);
        SetResourceReference(DarkBrushProperty, DarkBrushKey);
    }

    public Brush? LightBrush { get => (Brush?)GetValue(LightBrushProperty); set => SetValue(LightBrushProperty, value); }

    public Brush? DarkBrush { get => (Brush?)GetValue(DarkBrushProperty); set => SetValue(DarkBrushProperty, value); }

    public double CellSize { get => (double)GetValue(CellSizeProperty); set => SetValue(CellSizeProperty, value); }

    protected override void OnRender(DrawingContext dc)
    {
        _tile ??= CreateTile();
        if (_tile != null) dc.DrawRectangle(_tile, null, new Rect(RenderSize));
    }

    private static DependencyProperty Dp(string name, Type type, object? defaultValue) =>
        DependencyProperty.Register(name, type, typeof(CheckerboardDecorator),
            new FrameworkPropertyMetadata(defaultValue, FrameworkPropertyMetadataOptions.AffectsRender, (d, _) => ((CheckerboardDecorator)d)._tile = null));

    private Brush? CreateTile()
    {
        if (LightBrush is not { } light || DarkBrush is not { } dark) return null;
        double cell = Math.Max(1, CellSize);
        var group = new DrawingGroup();
        group.Children.Add(new GeometryDrawing(dark.CloneCurrentValue(), null, new RectangleGeometry(new Rect(0, 0, cell * 2, cell * 2))));
        var lightCells = new GeometryGroup();
        lightCells.Children.Add(new RectangleGeometry(new Rect(0, 0, cell, cell)));
        lightCells.Children.Add(new RectangleGeometry(new Rect(cell, cell, cell, cell)));
        group.Children.Add(new GeometryDrawing(light.CloneCurrentValue(), null, lightCells));
        var brush = new DrawingBrush(group)
        {
            TileMode = TileMode.Tile,
            Viewport = new Rect(0, 0, cell * 2, cell * 2),
            ViewportUnits = BrushMappingMode.Absolute,
            Stretch = Stretch.None,
        };
        brush.Freeze();
        return brush;
    }
}
