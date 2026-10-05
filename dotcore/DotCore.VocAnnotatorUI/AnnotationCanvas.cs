using System.Collections.Specialized;
using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using DotCore.VocAnnotator;

namespace DotCore.VocAnnotatorUI;

/// <summary>Box edited by the canvas (move or resize), committed on mouse up.</summary>
public sealed class BoxEditedEventArgs : EventArgs
{
    public BoxEditedEventArgs(int index, AnnotationBox box)
    {
        Index = index;
        Box = box;
    }

    public int Index { get; }

    public AnnotationBox Box { get; }
}

/// <summary>Brush stroke kind; strokes apply in order (later strokes overwrite earlier ones, Erase clears them).</summary>
public enum CanvasStrokeKind
{
    Foreground,
    Background,
    Erase,
}

/// <summary>Brush stroke in image pixels: a polyline painted with a round brush of Radius.</summary>
public sealed record CanvasStroke(CanvasStrokeKind Kind, double Radius, IReadOnlyList<Point> Points);

/// <summary>
/// Image + box editor surface rendered in one pass. Image pixel space is mapped to the control by zoom and offset.
/// Draw mode: left drag draws a box. Select mode: left drag moves the box under the cursor or pans empty space.
/// Handles of the selected box resize it in both modes; wheel zooms at the cursor; middle drag or pan key + left drag pans.
/// Edits are raised as events and applied by the owner (undo lives there); the canvas never mutates Boxes.
/// Optional stroke layer: with StrokeTool set, left drag paints a brush stroke (StrokeDrawn); Strokes are rendered as
/// foreground / background overlays composed in order. The canvas never mutates Strokes either.
/// </summary>
public sealed class AnnotationCanvas : FrameworkElement
{
    private const double HandleSize = 8;
    private const double HitTolerance = 4;
    private const double WheelZoomStep = 1.2;
    private const double FitMargin = 0.98;
    private const double LabelFontSize = 12;
    private const double LabelPadding = 3;
    private const double NearestNeighborZoom = 2.0;
    private const string BackgroundBrushKey = "InsetBackgroundBrush";
    private const string FontFamilyKey = "UiFontFamily";
    private const string StrokeForegroundBrushKey = "SuccessBrush";
    private const string StrokeBackgroundBrushKey = "DangerBrush";
    private const string StrokeCursorBrushKey = "TextPrimaryBrush";
    private const double StrokeOpacity = 0.45;
    private const double StrokeMinStepPixels = 0.5;

    public static readonly DependencyProperty ImageSourceProperty = Dp(nameof(ImageSource), typeof(BitmapSource), null, (d, _) => ((AnnotationCanvas)d).OnImageChanged());
    public static readonly DependencyProperty BoxesProperty = Dp(nameof(Boxes), typeof(IList<AnnotationBox>), null, (d, e) => ((AnnotationCanvas)d).OnBoxesChanged(e));
    public static readonly DependencyProperty SelectedIndexProperty = DependencyProperty.Register(nameof(SelectedIndex), typeof(int), typeof(AnnotationCanvas),
        new FrameworkPropertyMetadata(-1, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault | FrameworkPropertyMetadataOptions.AffectsRender));
    public static readonly DependencyProperty IsDrawModeProperty = Dp(nameof(IsDrawMode), typeof(bool), false, (d, _) => ((AnnotationCanvas)d).UpdateCursor(null));
    public static readonly DependencyProperty CurrentLabelProperty = Dp(nameof(CurrentLabel), typeof(string), "", null);
    public static readonly DependencyProperty ShowLabelsProperty = Dp(nameof(ShowLabels), typeof(bool), true, null);
    public static readonly DependencyProperty ShowCrosshairProperty = Dp(nameof(ShowCrosshair), typeof(bool), true, null);
    public static readonly DependencyProperty FillOpacityProperty = Dp(nameof(FillOpacity), typeof(double), 0.12, null);
    public static readonly DependencyProperty LineWidthProperty = Dp(nameof(LineWidth), typeof(double), 2.0, null);
    public static readonly DependencyProperty MinBoxSizeProperty = Dp(nameof(MinBoxSize), typeof(double), 4.0, null);
    public static readonly DependencyProperty FitOnOpenProperty = Dp(nameof(FitOnOpen), typeof(bool), true, null);
    public static readonly DependencyProperty StrokesProperty = Dp(nameof(Strokes), typeof(IList<CanvasStroke>), null, (d, e) => ((AnnotationCanvas)d).OnStrokesChanged(e));
    public static readonly DependencyProperty StrokeToolProperty = Dp(nameof(StrokeTool), typeof(CanvasStrokeKind?), null, (d, _) => ((AnnotationCanvas)d).UpdateCursor(null));
    public static readonly DependencyProperty BrushRadiusProperty = Dp(nameof(BrushRadius), typeof(double), 4.0, null);
    public static readonly DependencyProperty IsReadOnlyProperty = Dp(nameof(IsReadOnly), typeof(bool), false, (d, _) => ((AnnotationCanvas)d).UpdateCursor(null));

    private double _zoom = 1;
    private Vector _offset;
    private bool _fitPending = true;
    private Point? _pointer;
    private bool _panKeyDown;
    private DragKind _drag;
    private Point _dragStartScreen;
    private Point _dragStartImage;
    private Vector _panStartOffset;
    private int _dragIndex = -1;
    private Handle _dragHandle;
    private AnnotationBox? _dragOriginal;
    private AnnotationBox? _preview;
    private INotifyCollectionChanged? _observedBoxes;
    private INotifyCollectionChanged? _observedStrokes;
    private List<Point>? _strokePoints;
    private (Geometry Foreground, Geometry Background)? _strokeGeometry;

    public AnnotationCanvas()
    {
        Focusable = true;
        FocusVisualStyle = null;
        ClipToBounds = true;
        SnapsToDevicePixels = true;
    }

    private enum DragKind { None, Draw, Move, Resize, Pan, Stroke }

    [Flags]
    private enum Handle { None = 0, Left = 1, Top = 2, Right = 4, Bottom = 8 }

    public event EventHandler<AnnotationBox>? BoxDrawn;

    public event EventHandler<BoxEditedEventArgs>? BoxEdited;

    /// <summary>Brush stroke finished (StrokeTool mode).</summary>
    public event EventHandler<CanvasStroke>? StrokeDrawn;

    /// <summary>Zoom or offset changed.</summary>
    public event EventHandler? ViewChanged;

    /// <summary>Pointer position in image pixels (null when outside the image).</summary>
    public event EventHandler<Point?>? PointerMoved;

    public BitmapSource? ImageSource { get => (BitmapSource?)GetValue(ImageSourceProperty); set => SetValue(ImageSourceProperty, value); }
    public IList<AnnotationBox>? Boxes { get => (IList<AnnotationBox>?)GetValue(BoxesProperty); set => SetValue(BoxesProperty, value); }
    public int SelectedIndex { get => (int)GetValue(SelectedIndexProperty); set => SetValue(SelectedIndexProperty, value); }
    public bool IsDrawMode { get => (bool)GetValue(IsDrawModeProperty); set => SetValue(IsDrawModeProperty, value); }
    public string CurrentLabel { get => (string)GetValue(CurrentLabelProperty); set => SetValue(CurrentLabelProperty, value); }
    public bool ShowLabels { get => (bool)GetValue(ShowLabelsProperty); set => SetValue(ShowLabelsProperty, value); }
    public bool ShowCrosshair { get => (bool)GetValue(ShowCrosshairProperty); set => SetValue(ShowCrosshairProperty, value); }
    public double FillOpacity { get => (double)GetValue(FillOpacityProperty); set => SetValue(FillOpacityProperty, value); }
    public double LineWidth { get => (double)GetValue(LineWidthProperty); set => SetValue(LineWidthProperty, value); }
    public double MinBoxSize { get => (double)GetValue(MinBoxSizeProperty); set => SetValue(MinBoxSizeProperty, value); }
    public bool FitOnOpen { get => (bool)GetValue(FitOnOpenProperty); set => SetValue(FitOnOpenProperty, value); }
    public IList<CanvasStroke>? Strokes { get => (IList<CanvasStroke>?)GetValue(StrokesProperty); set => SetValue(StrokesProperty, value); }

    /// <summary>Brush tool for left drag; null = box editing.</summary>
    public CanvasStrokeKind? StrokeTool { get => (CanvasStrokeKind?)GetValue(StrokeToolProperty); set => SetValue(StrokeToolProperty, value); }

    /// <summary>Existing boxes cannot be moved or resized (selection, pan and draw mode still work).</summary>
    public bool IsReadOnly { get => (bool)GetValue(IsReadOnlyProperty); set => SetValue(IsReadOnlyProperty, value); }

    /// <summary>Brush radius in image pixels.</summary>
    public double BrushRadius { get => (double)GetValue(BrushRadiusProperty); set => SetValue(BrushRadiusProperty, value); }

    /// <summary>Color of a class label; set by the owner, call Refresh after colors change.</summary>
    public Func<string, Color>? LabelColor { get; set; }

    public double Zoom => _zoom;

    /// <summary>True while the pan key (Space) is held: left drag pans.</summary>
    public bool PanKeyDown
    {
        get => _panKeyDown;
        set
        {
            _panKeyDown = value;
            UpdateCursor(_pointer.HasValue ? ToScreen(_pointer.Value) : null);
        }
    }

    public void Refresh() => InvalidateVisual();

    public void FitToView()
    {
        if (ImageSource is not { } img || ActualWidth <= 0 || ActualHeight <= 0)
        {
            _fitPending = true;
            return;
        }
        _fitPending = false;
        var zoom = Math.Min(ActualWidth / img.PixelWidth, ActualHeight / img.PixelHeight) * FitMargin;
        SetView(zoom, new Vector((ActualWidth - img.PixelWidth * zoom) / 2, (ActualHeight - img.PixelHeight * zoom) / 2));
    }

    /// <summary>Zoom to an absolute factor around a control point (default: center).</summary>
    public void SetZoom(double zoom, Point? anchor = null)
    {
        zoom = Math.Clamp(zoom, AnnotatorSettings.MinZoomPercent / 100.0, AnnotatorSettings.MaxZoomPercent / 100.0);
        var a = anchor ?? new Point(ActualWidth / 2, ActualHeight / 2);
        var imagePoint = ToImage(a);
        SetView(zoom, new Vector(a.X - imagePoint.X * zoom, a.Y - imagePoint.Y * zoom));
    }

    public void ZoomBy(double factor, Point? anchor = null) => SetZoom(_zoom * factor, anchor);

    /// <summary>Scroll so the box is visible (keeps zoom).</summary>
    public void BringIntoView(AnnotationBox box)
    {
        var r = ToScreen(box);
        double dx = r.Left < 0 ? -r.Left + HandleSize : r.Right > ActualWidth ? ActualWidth - r.Right - HandleSize : 0;
        double dy = r.Top < 0 ? -r.Top + HandleSize : r.Bottom > ActualHeight ? ActualHeight - r.Bottom - HandleSize : 0;
        if (dx != 0 || dy != 0) SetView(_zoom, _offset + new Vector(dx, dy));
    }

    protected override void OnRenderSizeChanged(SizeChangedInfo sizeInfo)
    {
        base.OnRenderSizeChanged(sizeInfo);
        if (_fitPending) FitToView();
    }

    protected override void OnRender(DrawingContext dc)
    {
        dc.DrawRectangle(TryFindResource(BackgroundBrushKey) as Brush ?? Brushes.Black, null, new Rect(RenderSize));
        if (ImageSource is not { } img) return;
        dc.DrawImage(img, new Rect(_offset.X, _offset.Y, img.PixelWidth * _zoom, img.PixelHeight * _zoom));
        DrawStrokes(dc);

        var boxes = Boxes;
        int selected = SelectedIndex;
        if (boxes != null)
        {
            for (int i = 0; i < boxes.Count; i++)
            {
                var box = i == _dragIndex && _preview != null && _drag is DragKind.Move or DragKind.Resize ? _preview : boxes[i];
                DrawBox(dc, box, i == selected);
            }
        }
        if (_drag == DragKind.Draw && _preview != null)
            DrawBox(dc, _preview, selected: false, preview: true);
        if (StrokeTool != null && _pointer is { } brushAt && _drag != DragKind.Pan)
        {
            var pen = ClassPalette.Freeze(new Pen(TryFindResource(StrokeCursorBrushKey) as Brush ?? Brushes.White, 1));
            double r = Math.Max(1, BrushRadius * _zoom);
            dc.DrawEllipse(null, pen, ToScreen(brushAt), r, r);
        }
        else if (ShowCrosshair && _pointer is { } p && _drag != DragKind.Pan)
        {
            var s = ToScreen(p);
            var pen = ClassPalette.Freeze(new Pen(new SolidColorBrush(Color.FromArgb(0xA0, 0xFF, 0xFF, 0xFF)), 1) { DashStyle = DashStyles.Dash });
            var area = ImageRect();
            dc.DrawLine(pen, new Point(area.Left, s.Y), new Point(area.Right, s.Y));
            dc.DrawLine(pen, new Point(s.X, area.Top), new Point(s.X, area.Bottom));
        }
    }

    protected override void OnMouseDown(MouseButtonEventArgs e)
    {
        base.OnMouseDown(e);
        if (ImageSource == null) return;
        Focus();
        var screen = e.GetPosition(this);
        var image = ToImage(screen);
        if (e.ChangedButton == MouseButton.Middle || (e.ChangedButton == MouseButton.Left && _panKeyDown))
        {
            Begin(DragKind.Pan, screen, image);
            e.Handled = true;
            return;
        }
        if (e.ChangedButton == MouseButton.Right)
        {
            int hit = HitBox(screen);
            if (hit >= 0) SelectedIndex = hit;
            return;
        }
        if (e.ChangedButton != MouseButton.Left) return;
        if (StrokeTool != null)
        {
            _strokePoints = new List<Point> { image };
            Begin(DragKind.Stroke, screen, image);
            e.Handled = true;
            return;
        }
        var boxes = Boxes;
        var handle = !IsReadOnly && boxes != null && SelectedIndex >= 0 && SelectedIndex < boxes.Count ? HitHandle(boxes[SelectedIndex], screen) : Handle.None;
        if (boxes != null && handle != Handle.None)
        {
            _dragIndex = SelectedIndex;
            _dragHandle = handle;
            _dragOriginal = boxes[SelectedIndex];
            Begin(DragKind.Resize, screen, image);
        }
        else if (IsDrawMode)
        {
            if (!InImage(image)) return;
            Begin(DragKind.Draw, screen, image);
        }
        else
        {
            int hit = HitBox(screen);
            if (hit >= 0 && boxes != null && IsReadOnly)
            {
                SelectedIndex = hit;
                Begin(DragKind.Pan, screen, image);
            }
            else if (hit >= 0 && boxes != null)
            {
                SelectedIndex = hit;
                _dragIndex = hit;
                _dragOriginal = boxes[hit];
                Begin(DragKind.Move, screen, image);
            }
            else
            {
                SelectedIndex = -1;
                Begin(DragKind.Pan, screen, image);
            }
        }
        e.Handled = true;
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        var screen = e.GetPosition(this);
        var image = ToImage(screen);
        SetPointer(ImageSource != null && InImage(image) ? image : null);
        if (_drag == DragKind.None)
        {
            UpdateCursor(screen);
            if (ShowCrosshair || StrokeTool != null) InvalidateVisual();
            return;
        }
        var img = ImageSource!;
        int w = img.PixelWidth, h = img.PixelHeight;
        switch (_drag)
        {
            case DragKind.Pan:
                SetView(_zoom, _panStartOffset + (screen - _dragStartScreen));
                return;
            case DragKind.Stroke when _strokePoints != null:
                if ((image - _strokePoints[^1]).Length >= StrokeMinStepPixels) _strokePoints.Add(image);
                break;
            case DragKind.Draw:
                _preview = AnnotationBox.FromCorners(CurrentLabel, _dragStartImage.X, _dragStartImage.Y, image.X, image.Y).ClampTo(w, h);
                break;
            case DragKind.Move when _dragOriginal != null:
                var o = _dragOriginal;
                double dx = Math.Clamp(image.X - _dragStartImage.X, -o.XMin, w - o.XMax);
                double dy = Math.Clamp(image.Y - _dragStartImage.Y, -o.YMin, h - o.YMax);
                _preview = o.Offset(dx, dy);
                break;
            case DragKind.Resize when _dragOriginal != null:
                _preview = Resize(_dragOriginal, _dragHandle, Math.Clamp(image.X, 0, w), Math.Clamp(image.Y, 0, h));
                break;
        }
        InvalidateVisual();
    }

    protected override void OnMouseUp(MouseButtonEventArgs e)
    {
        base.OnMouseUp(e);
        if (_drag == DragKind.None) return;
        var kind = _drag;
        var preview = _preview?.RoundToPixels();
        int index = _dragIndex;
        var original = _dragOriginal;
        var strokePoints = _strokePoints;
        var strokeTool = StrokeTool;
        EndDrag();
        if (kind == DragKind.Stroke && strokePoints != null && strokeTool is { } tool)
            StrokeDrawn?.Invoke(this, new CanvasStroke(tool, Math.Max(StrokeMinStepPixels, BrushRadius), strokePoints));
        else if (preview != null)
        {
            if (kind == DragKind.Draw && preview.IsValid(MinBoxSize))
                BoxDrawn?.Invoke(this, preview);
            else if (kind is DragKind.Move or DragKind.Resize && index >= 0 && preview != original && preview.IsValid(1))
                BoxEdited?.Invoke(this, new BoxEditedEventArgs(index, preview));
        }
        InvalidateVisual();
        e.Handled = true;
    }

    protected override void OnLostMouseCapture(MouseEventArgs e)
    {
        base.OnLostMouseCapture(e);
        if (_drag != DragKind.None)
        {
            EndDrag();
            InvalidateVisual();
        }
    }

    protected override void OnMouseWheel(MouseWheelEventArgs e)
    {
        base.OnMouseWheel(e);
        if (ImageSource == null) return;
        ZoomBy(e.Delta > 0 ? WheelZoomStep : 1 / WheelZoomStep, e.GetPosition(this));
        e.Handled = true;
    }

    protected override void OnMouseLeave(MouseEventArgs e)
    {
        base.OnMouseLeave(e);
        SetPointer(null);
        InvalidateVisual();
    }

    private static DependencyProperty Dp(string name, Type type, object? defaultValue, PropertyChangedCallback? changed) =>
        DependencyProperty.Register(name, type, typeof(AnnotationCanvas),
            new FrameworkPropertyMetadata(defaultValue, FrameworkPropertyMetadataOptions.AffectsRender, changed));

    private void OnImageChanged()
    {
        EndDrag();
        if (ImageSource == null) return;
        if (FitOnOpen || _fitPending) FitToView();
        else UpdateScalingMode();
    }

    private void OnBoxesChanged(DependencyPropertyChangedEventArgs e)
    {
        if (_observedBoxes != null) _observedBoxes.CollectionChanged -= OnBoxesCollectionChanged;
        _observedBoxes = e.NewValue as INotifyCollectionChanged;
        if (_observedBoxes != null) _observedBoxes.CollectionChanged += OnBoxesCollectionChanged;
    }

    private void OnBoxesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e) => InvalidateVisual();

    private void OnStrokesChanged(DependencyPropertyChangedEventArgs e)
    {
        if (_observedStrokes != null) _observedStrokes.CollectionChanged -= OnStrokesCollectionChanged;
        _observedStrokes = e.NewValue as INotifyCollectionChanged;
        if (_observedStrokes != null) _observedStrokes.CollectionChanged += OnStrokesCollectionChanged;
        _strokeGeometry = null;
    }

    private void OnStrokesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        _strokeGeometry = null;
        InvalidateVisual();
    }

    private void DrawStrokes(DrawingContext dc)
    {
        bool painting = _drag == DragKind.Stroke && _strokePoints != null && StrokeTool != null;
        if (Strokes is not { Count: > 0 } && !painting) return;
        _strokeGeometry ??= ComposeStrokes(Strokes ?? Array.Empty<CanvasStroke>());
        var (fg, bg) = _strokeGeometry.Value;
        dc.PushTransform(new MatrixTransform(_zoom, 0, 0, _zoom, _offset.X, _offset.Y));
        dc.PushOpacity(StrokeOpacity);
        if (!fg.IsEmpty()) dc.DrawGeometry(TryFindResource(StrokeForegroundBrushKey) as Brush ?? Brushes.Lime, null, fg);
        if (!bg.IsEmpty()) dc.DrawGeometry(TryFindResource(StrokeBackgroundBrushKey) as Brush ?? Brushes.Red, null, bg);
        if (painting)
        {
            var current = StrokeGeometry(new CanvasStroke(StrokeTool!.Value, BrushRadius, _strokePoints!));
            var key = StrokeTool switch
            {
                CanvasStrokeKind.Foreground => StrokeForegroundBrushKey,
                CanvasStrokeKind.Background => StrokeBackgroundBrushKey,
                _ => StrokeCursorBrushKey,
            };
            dc.DrawGeometry(TryFindResource(key) as Brush ?? Brushes.White, null, current);
        }
        dc.Pop();
        dc.Pop();
    }

    /// <summary>Foreground and background areas after applying the strokes in order.</summary>
    private static (Geometry Foreground, Geometry Background) ComposeStrokes(IEnumerable<CanvasStroke> strokes)
    {
        Geometry fg = Geometry.Empty, bg = Geometry.Empty;
        foreach (var stroke in strokes)
        {
            var area = StrokeGeometry(stroke);
            switch (stroke.Kind)
            {
                case CanvasStrokeKind.Foreground:
                    fg = Geometry.Combine(fg, area, GeometryCombineMode.Union, null);
                    bg = Geometry.Combine(bg, area, GeometryCombineMode.Exclude, null);
                    break;
                case CanvasStrokeKind.Background:
                    bg = Geometry.Combine(bg, area, GeometryCombineMode.Union, null);
                    fg = Geometry.Combine(fg, area, GeometryCombineMode.Exclude, null);
                    break;
                default:
                    fg = Geometry.Combine(fg, area, GeometryCombineMode.Exclude, null);
                    bg = Geometry.Combine(bg, area, GeometryCombineMode.Exclude, null);
                    break;
            }
        }
        fg.Freeze();
        bg.Freeze();
        return (fg, bg);
    }

    private static Geometry StrokeGeometry(CanvasStroke stroke)
    {
        var points = stroke.Points;
        if (points.Count == 0) return Geometry.Empty;
        if (points.Count == 1) return new EllipseGeometry(points[0], stroke.Radius, stroke.Radius);
        var line = new StreamGeometry();
        using (var ctx = line.Open())
        {
            ctx.BeginFigure(points[0], isFilled: false, isClosed: false);
            ctx.PolyLineTo(points.Skip(1).ToList(), isStroked: true, isSmoothJoin: true);
        }
        var pen = new Pen(Brushes.Black, stroke.Radius * 2)
        {
            StartLineCap = PenLineCap.Round,
            EndLineCap = PenLineCap.Round,
            LineJoin = PenLineJoin.Round,
        };
        var widened = line.GetWidenedPathGeometry(pen);
        widened.FillRule = FillRule.Nonzero;
        return widened;
    }

    private void Begin(DragKind kind, Point screen, Point image)
    {
        _drag = kind;
        _dragStartScreen = screen;
        _dragStartImage = image;
        _panStartOffset = _offset;
        _preview = null;
        CaptureMouse();
    }

    private void EndDrag()
    {
        _drag = DragKind.None;
        _preview = null;
        _dragIndex = -1;
        _dragOriginal = null;
        _dragHandle = Handle.None;
        _strokePoints = null;
        if (IsMouseCaptured) ReleaseMouseCapture();
    }

    private void SetView(double zoom, Vector offset)
    {
        _zoom = zoom;
        _offset = offset;
        UpdateScalingMode();
        InvalidateVisual();
        ViewChanged?.Invoke(this, EventArgs.Empty);
    }

    private void UpdateScalingMode() =>
        RenderOptions.SetBitmapScalingMode(this, _zoom >= NearestNeighborZoom ? BitmapScalingMode.NearestNeighbor : BitmapScalingMode.HighQuality);

    private void SetPointer(Point? image)
    {
        if (_pointer == image) return;
        _pointer = image;
        PointerMoved?.Invoke(this, image);
    }

    private void DrawBox(DrawingContext dc, AnnotationBox box, bool selected, bool preview = false)
    {
        var color = LabelColor?.Invoke(box.Label) ?? ClassPalette.Unknown;
        var rect = ToScreen(box);
        var fill = ClassPalette.Freeze(new SolidColorBrush(Color.FromArgb((byte)(Math.Clamp(FillOpacity, 0, 1) * 255), color.R, color.G, color.B)));
        var pen = new Pen(ClassPalette.Freeze(new SolidColorBrush(color)), LineWidth + (selected ? 1 : 0));
        if (box.Difficult || preview) pen.DashStyle = DashStyles.Dash;
        pen.Freeze();
        dc.DrawRectangle(fill, pen, rect);
        if (selected && !preview && !IsReadOnly)
        {
            var handleFill = ClassPalette.Freeze(new SolidColorBrush(Colors.White));
            foreach (var p in HandlePoints(rect))
                dc.DrawRectangle(handleFill, pen, new Rect(p.X - HandleSize / 2, p.Y - HandleSize / 2, HandleSize, HandleSize));
        }
        if (!ShowLabels || preview || string.IsNullOrEmpty(box.Label)) return;
        var text = new FormattedText(box.Difficult ? box.Label + " *" : box.Label, CultureInfo.CurrentUICulture, FlowDirection.LeftToRight,
            new Typeface(TryFindResource(FontFamilyKey) as FontFamily ?? SystemFonts.MessageFontFamily, FontStyles.Normal, FontWeights.SemiBold, FontStretches.Normal),
            LabelFontSize, ClassPalette.Freeze(new SolidColorBrush(ClassPalette.ContrastText(color))), VisualTreeHelper.GetDpi(this).PixelsPerDip);
        double tw = text.Width + LabelPadding * 2, th = text.Height + LabelPadding / 2;
        double ty = rect.Top - th >= 0 ? rect.Top - th : rect.Top;
        dc.DrawRectangle(ClassPalette.Freeze(new SolidColorBrush(color)), null, new Rect(rect.Left, ty, tw, th));
        dc.DrawText(text, new Point(rect.Left + LabelPadding, ty + LabelPadding / 4));
    }

    private static IEnumerable<Point> HandlePoints(Rect r)
    {
        double cx = (r.Left + r.Right) / 2, cy = (r.Top + r.Bottom) / 2;
        yield return r.TopLeft;
        yield return new Point(cx, r.Top);
        yield return r.TopRight;
        yield return new Point(r.Right, cy);
        yield return r.BottomRight;
        yield return new Point(cx, r.Bottom);
        yield return r.BottomLeft;
        yield return new Point(r.Left, cy);
    }

    private Handle HitHandle(AnnotationBox box, Point screen)
    {
        var r = ToScreen(box);
        double tol = HandleSize / 2 + 2;
        bool nearL = Math.Abs(screen.X - r.Left) <= tol, nearR = Math.Abs(screen.X - r.Right) <= tol;
        bool nearT = Math.Abs(screen.Y - r.Top) <= tol, nearB = Math.Abs(screen.Y - r.Bottom) <= tol;
        bool inX = screen.X >= r.Left - tol && screen.X <= r.Right + tol, inY = screen.Y >= r.Top - tol && screen.Y <= r.Bottom + tol;
        double cx = (r.Left + r.Right) / 2, cy = (r.Top + r.Bottom) / 2;
        var h = Handle.None;
        if (nearL && inY) h |= Handle.Left;
        if (nearR && inY) h |= Handle.Right;
        if (nearT && inX) h |= Handle.Top;
        if (nearB && inX) h |= Handle.Bottom;
        bool corner = (h & (Handle.Left | Handle.Right)) != 0 && (h & (Handle.Top | Handle.Bottom)) != 0;
        bool edgeMid = Math.Abs(screen.X - cx) <= tol || Math.Abs(screen.Y - cy) <= tol;
        return corner || (h != Handle.None && edgeMid) ? h : Handle.None;
    }

    private int HitBox(Point screen)
    {
        var boxes = Boxes;
        if (boxes == null) return -1;
        var p = ToImage(screen);
        double tol = HitTolerance / _zoom;
        int best = -1;
        double bestArea = double.MaxValue;
        for (int i = 0; i < boxes.Count; i++)
        {
            var b = boxes[i];
            if (p.X < b.XMin - tol || p.X > b.XMax + tol || p.Y < b.YMin - tol || p.Y > b.YMax + tol) continue;
            double area = i == SelectedIndex ? -1 : b.Area;
            if (area < bestArea)
            {
                bestArea = area;
                best = i;
            }
        }
        return best;
    }

    private static AnnotationBox Resize(AnnotationBox o, Handle h, double x, double y)
    {
        double l = o.XMin, t = o.YMin, r = o.XMax, b = o.YMax;
        if ((h & Handle.Left) != 0) l = x;
        if ((h & Handle.Right) != 0) r = x;
        if ((h & Handle.Top) != 0) t = y;
        if ((h & Handle.Bottom) != 0) b = y;
        return AnnotationBox.FromCorners(o.Label, l, t, r, b, o.Difficult);
    }

    private void UpdateCursor(Point? screen)
    {
        if (_panKeyDown || _drag == DragKind.Pan) { Cursor = Cursors.SizeAll; return; }
        if (StrokeTool != null) { Cursor = Cursors.Cross; return; }
        var boxes = Boxes;
        if (screen is { } s && !IsReadOnly && boxes != null && SelectedIndex >= 0 && SelectedIndex < boxes.Count)
        {
            var h = HitHandle(boxes[SelectedIndex], s);
            if (h != Handle.None)
            {
                Cursor = h switch
                {
                    Handle.Left or Handle.Right => Cursors.SizeWE,
                    Handle.Top or Handle.Bottom => Cursors.SizeNS,
                    Handle.Left | Handle.Top or Handle.Right | Handle.Bottom => Cursors.SizeNWSE,
                    _ => Cursors.SizeNESW,
                };
                return;
            }
        }
        if (IsDrawMode) { Cursor = Cursors.Cross; return; }
        Cursor = screen is { } p && HitBox(p) >= 0 ? Cursors.Hand : Cursors.Arrow;
    }

    private bool InImage(Point image) =>
        ImageSource is { } img && image.X >= 0 && image.Y >= 0 && image.X <= img.PixelWidth && image.Y <= img.PixelHeight;

    private Rect ImageRect() => ImageSource is { } img ? new Rect(_offset.X, _offset.Y, img.PixelWidth * _zoom, img.PixelHeight * _zoom) : Rect.Empty;

    private Point ToImage(Point screen) => new((screen.X - _offset.X) / _zoom, (screen.Y - _offset.Y) / _zoom);

    private Point ToScreen(Point image) => new(image.X * _zoom + _offset.X, image.Y * _zoom + _offset.Y);

    private Rect ToScreen(AnnotationBox b) => new(ToScreen(new Point(b.XMin, b.YMin)), ToScreen(new Point(b.XMax, b.YMax)));
}
