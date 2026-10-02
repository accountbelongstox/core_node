using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Globalization;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.Ui;
using DotApps.d3d4tester.Windows.CoordinatePicker;
using DotCore.Foundations;
using OpenCvSharp;
using WpfWindow = System.Windows.Window;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Coordinate picker: scaled client screenshot with point / rect / circle picking (rect and circle take two clicks), editable labels,
/// shared pick history with undo, template-match overlay, refresh screenshot, export to TMP_DIR. One picker at a time.
/// 1:1 Python ui/components/coordinate_picker_window.py CoordinatePicker.
/// Fixes Python bugs: undo popped the local list while the history list was shown (now removes the last history pick);
/// pick ids restarted per window and collided with older history ids (now unique); export text was hardcoded Chinese (now i18n).
/// </summary>
public partial class CoordinatePickerWindow : WpfWindow
{
    private const string LogPrefix = "[COORD_PICKER]";
    private const string PickIdPrefix = "pick_";
    private const string ExportFilePrefix = "coords_";
    private const string ExportFileExtension = ".txt";
    private const string ExportFileTimeFormat = "yyyyMMdd_HHmmss";
    private const string ExportHeaderTimeFormat = "yyyy-MM-dd HH:mm:ss";
    private const string ExportIndent = "   ";
    private const int ExportRuleLength = 50;
    private const char ExportRuleChar = '=';
    private const string MarkBrushKey = "SuccessBrush";
    private const string LabelBackgroundBrushKey = "AccentBrush";
    private const string LabelForegroundBrushKey = "TextOnAccentBrush";
    private const double MarkThickness = 2;
    private const int MarkerSize = 8;
    private const int CrossSize = 15;
    private const int LabelOffsetX = 20;
    private const int LabelOffsetY = -15;
    private const double LabelCornerRadius = 4;
    private const double LabelPaddingX = 6;
    private const double LabelPaddingY = 2;
    private const double LabelEditMinWidth = 120;
    private const int WidthDefault = 50;
    private const int HeightDefault = 50;
    private const int RadiusDefault = 30;
    private const int SizeMin = 10;
    private const int SizeMax = 500;
    private const int RadiusMin = 5;
    private const int RadiusMax = 200;

    private static CoordinatePickerWindow? _current;
    private static int _nextPickId;

    private readonly string _clientType;
    private readonly Func<(Mat? Image, string? Error)>? _refreshScreenshot;
    private readonly TemplateMatcherHelper _matcher = TemplateMatcherHelper.Instance;
    private readonly List<CoordinatePick> _sessionPicks = new();
    private readonly List<(int X, int Y)> _tempPoints = new();
    private readonly List<UIElement> _overlay = new();
    private Mat? _original;
    private double? _scale;
    private int _offsetX;
    private int _offsetY;
    private CoordinatePickType _pickType = CoordinatePickType.Point;
    private int _pickWidth = WidthDefault;
    private int _pickHeight = HeightDefault;
    private int _pickRadius = RadiusDefault;

    private CoordinatePickerWindow(Mat screenshot, string clientType, Func<(Mat? Image, string? Error)>? refreshScreenshot)
    {
        InitializeComponent();
        _original = screenshot;
        _clientType = clientType;
        _refreshScreenshot = refreshScreenshot;
        HistoryList.ItemsSource = History;
        History.CollectionChanged += OnHistoryChanged;
        BtnRefresh.Visibility = refreshScreenshot != null ? Visibility.Visible : Visibility.Collapsed;
        TxtWidth.Text = _pickWidth.ToString(CultureInfo.InvariantCulture);
        TxtHeight.Text = _pickHeight.ToString(CultureInfo.InvariantCulture);
        TxtRadius.Text = _pickRadius.ToString(CultureInfo.InvariantCulture);
        ApplyTexts();
        SetPickType(CoordinatePickType.Point);
        RenumberHistory();
        RefreshDisplaySource();
        Closed += OnClosed;
    }

    /// <summary>Pick history shared across picker windows for the app session. 1:1 Python coordinate_calibration_panel.pick_history.</summary>
    public static ObservableCollection<CoordinatePick> History { get; } = new();

    /// <summary>
    /// Open the picker for a captured screenshot (the window takes ownership of the Mat), closing any previous picker.
    /// <paramref name="refreshScreenshot"/> re-captures the client window; null hides the Refresh button.
    /// 1:1 Python _open_calibration_window.
    /// </summary>
    public static CoordinatePickerWindow ShowPicker(WpfWindow? owner, Mat screenshot, string clientType, Func<(Mat? Image, string? Error)>? refreshScreenshot)
    {
        _current?.Close();
        var window = new CoordinatePickerWindow(screenshot, clientType, refreshScreenshot) { Owner = owner };
        _current = window;
        window.Show();
        return window;
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        History.CollectionChanged -= OnHistoryChanged;
        if (ReferenceEquals(_current, this)) _current = null;
        _original?.Dispose();
        _original = null;
    }

    private void ApplyTexts()
    {
        var p = D3D4TesterI18n.Provider;
        UpdateTitle();
        LblPickMode.Text = p.GetUiText(I18nKeys.CoordPickerPickModeTitle);
        TxtPoint.Text = p.GetUiText(I18nKeys.CoordPickerPickTypePoint);
        TxtRect.Text = p.GetUiText(I18nKeys.CoordPickerPickTypeRect);
        TxtCircle.Text = p.GetUiText(I18nKeys.CoordPickerPickTypeCircle);
        LblValues.Text = p.GetUiText(I18nKeys.CoordPickerValuesTitle);
        LblWidth.Text = p.GetUiText(I18nKeys.CoordPickerWidth);
        LblHeight.Text = p.GetUiText(I18nKeys.CoordPickerHeight);
        LblRadius.Text = p.GetUiText(I18nKeys.CoordPickerRadius);
        LblTemplateMatching.Text = p.GetUiText(I18nKeys.CoordPickerTemplateMatchingTitle);
        TxtSelectTemplates.Text = p.GetUiText(I18nKeys.CoordPickerSelectTemplates);
        LblHistory.Text = p.GetUiText(I18nKeys.CoordPickerHistoryTitle);
        BtnUndo.ToolTip = p.GetUiText(I18nKeys.CoordPickerUndo);
        ColId.Header = p.GetUiText(I18nKeys.CoordPickerHistoryColId);
        ColType.Header = p.GetUiText(I18nKeys.CoordPickerHistoryColType);
        ColCoords.Header = p.GetUiText(I18nKeys.CoordPickerHistoryColCoords);
        ColName.Header = p.GetUiText(I18nKeys.CoordPickerHistoryColName);
        TxtRefresh.Text = p.GetUiText(I18nKeys.CoordPickerRefreshScreenshot);
        TxtExport.Text = p.GetUiText(I18nKeys.CoordPickerExportCoords);
        BtnComplete.Content = p.GetUiText(I18nKeys.CoordPickerComplete);
        BtnClose.Content = p.GetUiText(I18nKeys.CoordPickerClose);
        TxtHint.Text = p.GetUiText(I18nKeys.CoordPickerEditNameHint);
        TxtEmptyCanvas.Text = p.GetUiText(I18nKeys.CoordPickerEmptyCanvas);
    }

    private void UpdateTitle()
    {
        int w = _original?.Width ?? 0;
        int h = _original?.Height ?? 0;
        Title = $"{D3D4TesterI18n.Provider.GetUiText(I18nKeys.CoordPickerWindowTitle)} - {w}x{h}";
    }

    private void OnHistoryChanged(object? sender, NotifyCollectionChangedEventArgs e) => RenumberHistory();

    private void RenumberHistory()
    {
        for (int i = 0; i < History.Count; i++) History[i].Index = i + 1;
        TxtPicksCount.Text = $"{D3D4TesterI18n.Provider.GetUiText(I18nKeys.CoordPickerPicksCount)} {History.Count}";
        BtnUndo.IsEnabled = History.Count > 0;
    }

    private void PickType_Click(object sender, RoutedEventArgs e)
    {
        if (ReferenceEquals(sender, TglRect)) SetPickType(CoordinatePickType.Rect);
        else if (ReferenceEquals(sender, TglCircle)) SetPickType(CoordinatePickType.Circle);
        else SetPickType(CoordinatePickType.Point);
    }

    /// <summary>Exclusive pick type; drops an unfinished rect/circle first point. 1:1 Python _set_pick_type.</summary>
    private void SetPickType(CoordinatePickType type)
    {
        _pickType = type;
        bool hadTemp = _tempPoints.Count > 0;
        _tempPoints.Clear();
        TglPoint.IsChecked = type == CoordinatePickType.Point;
        TglRect.IsChecked = type == CoordinatePickType.Rect;
        TglCircle.IsChecked = type == CoordinatePickType.Circle;
        if (hadTemp) RedrawOverlay();
    }

    /// <summary>Clamp width/height (10..500) and radius (5..200) like the Python spinboxes.</summary>
    private void ValueBox_LostFocus(object sender, RoutedEventArgs e)
    {
        _pickWidth = ConfigBinding.ParseInt(TxtWidth.Text, SizeMin, SizeMax, WidthDefault);
        _pickHeight = ConfigBinding.ParseInt(TxtHeight.Text, SizeMin, SizeMax, HeightDefault);
        _pickRadius = ConfigBinding.ParseInt(TxtRadius.Text, RadiusMin, RadiusMax, RadiusDefault);
        TxtWidth.Text = _pickWidth.ToString(CultureInfo.InvariantCulture);
        TxtHeight.Text = _pickHeight.ToString(CultureInfo.InvariantCulture);
        TxtRadius.Text = _pickRadius.ToString(CultureInfo.InvariantCulture);
    }

    /// <summary>Show the template-match drawing when present, else the original screenshot.</summary>
    private void RefreshDisplaySource()
    {
        var image = _matcher.DisplayImage ?? _original;
        ScreenshotImage.Source = image == null || image.Empty() ? null : MatImageSource.ToBitmapSource(image);
        TxtEmptyCanvas.Visibility = ScreenshotImage.Source == null ? Visibility.Visible : Visibility.Collapsed;
        UpdateCanvasLayout();
    }

    private void PickCanvas_SizeChanged(object sender, SizeChangedEventArgs e) => UpdateCanvasLayout();

    /// <summary>Fit the image into the canvas (keep aspect, centered), then redraw marks and labels. 1:1 Python _update_canvas_display.</summary>
    private void UpdateCanvasLayout()
    {
        double canvasWidth = PickCanvas.ActualWidth;
        double canvasHeight = PickCanvas.ActualHeight;
        if (_original == null || _original.Empty() || ScreenshotImage.Source == null || canvasWidth <= 1 || canvasHeight <= 1)
        {
            _scale = null;
            RedrawOverlay();
            return;
        }
        var source = (BitmapSource)ScreenshotImage.Source;
        double scale = Math.Min(canvasWidth / source.PixelWidth, canvasHeight / source.PixelHeight);
        int newWidth = (int)(source.PixelWidth * scale);
        int newHeight = (int)(source.PixelHeight * scale);
        _scale = scale;
        _offsetX = ((int)canvasWidth - newWidth) / 2;
        _offsetY = ((int)canvasHeight - newHeight) / 2;
        ScreenshotImage.Width = newWidth;
        ScreenshotImage.Height = newHeight;
        Canvas.SetLeft(ScreenshotImage, _offsetX);
        Canvas.SetTop(ScreenshotImage, _offsetY);
        RedrawOverlay();
    }

    /// <summary>All history marks + labels, plus the pending first point of a rect/circle. 1:1 Python _redraw_all_marks / _redraw_all_labels.</summary>
    private void RedrawOverlay()
    {
        foreach (var element in _overlay) PickCanvas.Children.Remove(element);
        _overlay.Clear();
        if (_scale == null) return;
        foreach (var pick in History)
        {
            switch (pick.Type)
            {
                case CoordinatePickType.Rect: DrawRectMark(pick); break;
                case CoordinatePickType.Circle: DrawCircleMark(pick); break;
                default: DrawPointMark(pick.X, pick.Y); break;
            }
        }
        if (_tempPoints.Count == 1) DrawPointMark(_tempPoints[0].X, _tempPoints[0].Y);
        foreach (var pick in History) AddLabel(pick);
    }

    private (double X, double Y) ToCanvas(int x, int y) =>
        _scale is { } s ? ((int)(x * s) + _offsetX, (int)(y * s) + _offsetY) : (0, 0);

    private void AddOverlay(UIElement element, double left, double top)
    {
        Canvas.SetLeft(element, left);
        Canvas.SetTop(element, top);
        PickCanvas.Children.Add(element);
        _overlay.Add(element);
    }

    private T MarkShape<T>(T shape) where T : Shape
    {
        shape.SetResourceReference(Shape.StrokeProperty, MarkBrushKey);
        shape.StrokeThickness = MarkThickness;
        shape.IsHitTestVisible = false;
        return shape;
    }

    /// <summary>Ring + cross. 1:1 Python _draw_mark_at.</summary>
    private void DrawPointMark(int x, int y)
    {
        var (cx, cy) = ToCanvas(x, y);
        AddOverlay(MarkShape(new Ellipse { Width = MarkerSize * 2, Height = MarkerSize * 2 }), cx - MarkerSize, cy - MarkerSize);
        AddOverlay(MarkShape(new Line { X1 = cx - CrossSize, Y1 = cy, X2 = cx + CrossSize, Y2 = cy }), 0, 0);
        AddOverlay(MarkShape(new Line { X1 = cx, Y1 = cy - CrossSize, X2 = cx, Y2 = cy + CrossSize }), 0, 0);
    }

    private void DrawRectMark(CoordinatePick pick)
    {
        if (pick.Width <= 0 || pick.Height <= 0) return;
        var (x1, y1) = ToCanvas(pick.X, pick.Y);
        var (x2, y2) = ToCanvas(pick.X + pick.Width, pick.Y + pick.Height);
        AddOverlay(MarkShape(new Rectangle { Width = Math.Max(0, x2 - x1), Height = Math.Max(0, y2 - y1) }), x1, y1);
    }

    private void DrawCircleMark(CoordinatePick pick)
    {
        if (pick.Radius <= 0 || _scale is not { } s) return;
        var (cx, cy) = ToCanvas(pick.X, pick.Y);
        int r = (int)(pick.Radius * s);
        AddOverlay(MarkShape(new Ellipse { Width = r * 2, Height = r * 2 }), cx - r, cy - r);
    }

    /// <summary>Name chip next to the pick; double-click edits it. 1:1 Python _create_pick_label.</summary>
    private void AddLabel(CoordinatePick pick)
    {
        var (ax, ay) = pick.LabelAnchor;
        var (cx, cy) = ToCanvas(ax, ay);
        var text = new TextBlock { Text = pick.Name, Style = (Style)FindResource("CaptionTextStyle") };
        text.SetResourceReference(TextBlock.ForegroundProperty, LabelForegroundBrushKey);
        var label = new Border
        {
            Child = text,
            CornerRadius = new CornerRadius(LabelCornerRadius),
            Padding = new Thickness(LabelPaddingX, LabelPaddingY, LabelPaddingX, LabelPaddingY),
            Cursor = Cursors.Hand,
            ToolTip = pick.CoordsText,
        };
        label.SetResourceReference(Border.BackgroundProperty, LabelBackgroundBrushKey);
        label.MouseLeftButtonDown += (_, e) =>
        {
            e.Handled = true;
            if (e.ClickCount == 2) BeginEditLabel(pick, label);
        };
        AddOverlay(label, cx + LabelOffsetX, cy + LabelOffsetY);
    }

    /// <summary>Inline rename; Enter or focus loss commits (empty keeps the old name), Escape cancels. 1:1 Python _edit_pick_label.</summary>
    private void BeginEditLabel(CoordinatePick pick, Border label)
    {
        var editor = new TextBox { Text = pick.Name, MinWidth = LabelEditMinWidth };
        bool done = false;
        void Finish(bool commit)
        {
            if (done) return;
            done = true;
            var newName = editor.Text.Trim();
            if (commit && newName.Length > 0) pick.Name = newName;
            PickCanvas.Children.Remove(editor);
            _overlay.Remove(editor);
            RedrawOverlay();
        }
        editor.KeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter) { e.Handled = true; Finish(true); }
            else if (e.Key == Key.Escape) { e.Handled = true; Finish(false); }
        };
        editor.LostKeyboardFocus += (_, _) => Finish(true);
        editor.MouseLeftButtonDown += (_, e) => e.Handled = true;
        AddOverlay(editor, Canvas.GetLeft(label), Canvas.GetTop(label));
        label.Visibility = Visibility.Collapsed;
        editor.Focus();
        editor.SelectAll();
    }

    private bool TryToImage(System.Windows.Point canvasPoint, out int x, out int y)
    {
        x = y = 0;
        if (_scale is not { } s || _original == null) return false;
        x = (int)((canvasPoint.X - _offsetX) / s);
        y = (int)((canvasPoint.Y - _offsetY) / s);
        return x >= 0 && y >= 0 && x <= _original.Width && y <= _original.Height;
    }

    private void PickCanvas_MouseMove(object sender, MouseEventArgs e) =>
        TxtCursor.Text = TryToImage(e.GetPosition(PickCanvas), out int x, out int y) ? $"({x}, {y})" : "";

    /// <summary>Point = one click; rect = two corners; circle = center then edge. 1:1 Python _on_canvas_click.</summary>
    private void PickCanvas_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (!TryToImage(e.GetPosition(PickCanvas), out int x, out int y)) return;
        switch (_pickType)
        {
            case CoordinatePickType.Point:
                AddPick(new CoordinatePick(NextPickId(), CoordinatePickType.Point, x, y) { Name = DefaultName(CoordinatePickType.Point) });
                break;
            case CoordinatePickType.Rect when _tempPoints.Count == 0:
            case CoordinatePickType.Circle when _tempPoints.Count == 0:
                _tempPoints.Add((x, y));
                DrawPointMark(x, y);
                ColorPrinter.Blue($"{LogPrefix} Drew mark at original pos ({x}, {y})");
                break;
            case CoordinatePickType.Rect:
            {
                var (x1, y1) = _tempPoints[0];
                _tempPoints.Clear();
                AddPick(new CoordinatePick(NextPickId(), CoordinatePickType.Rect, Math.Min(x, x1), Math.Min(y, y1), Math.Abs(x - x1), Math.Abs(y - y1))
                {
                    Name = DefaultName(CoordinatePickType.Rect),
                });
                break;
            }
            case CoordinatePickType.Circle:
            {
                var (cx, cy) = _tempPoints[0];
                _tempPoints.Clear();
                int radius = (int)Math.Sqrt((double)(x - cx) * (x - cx) + (double)(y - cy) * (y - cy));
                AddPick(new CoordinatePick(NextPickId(), CoordinatePickType.Circle, cx, cy, radius: radius) { Name = DefaultName(CoordinatePickType.Circle) });
                break;
            }
        }
    }

    private static string NextPickId() => PickIdPrefix + Interlocked.Increment(ref _nextPickId).ToString(CultureInfo.InvariantCulture);

    /// <summary>"{type} {n}" with n counted in this window. 1:1 Python f"Point {len(self.picks) + 1}" (type name via i18n).</summary>
    private string DefaultName(CoordinatePickType type)
    {
        var key = type switch
        {
            CoordinatePickType.Rect => I18nKeys.CoordPickerPickTypeRect,
            CoordinatePickType.Circle => I18nKeys.CoordPickerPickTypeCircle,
            _ => I18nKeys.CoordPickerPickTypePoint,
        };
        return $"{D3D4TesterI18n.Provider.GetUiText(key)} {_sessionPicks.Count + 1}";
    }

    /// <summary>Add to this window and to the shared history, then redraw. 1:1 Python pick append + on_picks_updated.</summary>
    private void AddPick(CoordinatePick pick)
    {
        _sessionPicks.Add(pick);
        History.Add(pick);
        RedrawOverlay();
        ColorPrinter.Green($"{LogPrefix} Pick added: {pick.TypeName} {pick.CoordsText} {pick.Name} ({pick.Id})");
        ColorPrinter.Green("[COORD_CALIBRATION] Added 1 picks to history");
    }

    private void UndoCommand_Executed(object sender, ExecutedRoutedEventArgs e)
    {
        if (History.Count == 0) return;
        var last = History[^1];
        History.RemoveAt(History.Count - 1);
        _sessionPicks.Remove(last);
        RedrawOverlay();
        ColorPrinter.Blue($"{LogPrefix} Last pick undone");
    }

    private void BtnSelectTemplates_Click(object sender, RoutedEventArgs e)
    {
        if (_original == null || _original.Empty())
        {
            ColorPrinter.Yellow($"{LogPrefix} No screenshot to match templates on");
            return;
        }
        var dialog = new TemplateSelectDialog(_matcher, _clientType, () => _original, RefreshDisplaySource) { Owner = this };
        dialog.ShowDialog();
    }

    /// <summary>Re-capture the client window; history is kept. 1:1 Python _on_refresh_screenshot.</summary>
    private void BtnRefresh_Click(object sender, RoutedEventArgs e)
    {
        if (_refreshScreenshot == null) return;
        var (image, error) = _refreshScreenshot();
        if (image == null || error != null)
        {
            image?.Dispose();
            var p = D3D4TesterI18n.Provider;
            MessageBox.Show(this, error ?? p.GetUiText(I18nKeys.CoordCalNoGameWindow), p.GetUiText(I18nKeys.CoordCalErrorTitle),
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        _original?.Dispose();
        _original = image;
        _matcher.ClearDisplayImage();
        UpdateTitle();
        RefreshDisplaySource();
        ColorPrinter.Green($"{LogPrefix} Screenshot refreshed, history unchanged");
    }

    /// <summary>Write the history to TMP_DIR/coords_{timestamp}.txt. 1:1 Python _on_export_coords (labels via i18n).</summary>
    private void BtnExport_Click(object sender, RoutedEventArgs e)
    {
        if (History.Count == 0)
        {
            ColorPrinter.Yellow($"{LogPrefix} No coordinates to export");
            return;
        }
        var p = D3D4TesterI18n.Provider;
        var now = DateTime.Now;
        var path = System.IO.Path.Combine(BnUiDebugPaths.TmpDirectory, ExportFilePrefix + now.ToString(ExportFileTimeFormat, CultureInfo.InvariantCulture) + ExportFileExtension);
        try
        {
            Directory.CreateDirectory(BnUiDebugPaths.TmpDirectory);
            File.WriteAllText(path, BuildExportText(now), new UTF8Encoding(false));
            ColorPrinter.Green($"{LogPrefix} Coordinates exported to {path}");
            MessageBox.Show(this, p.GetUiText(I18nKeys.CoordPickerExportSuccessMsg) + "\n" + path, p.GetUiText(I18nKeys.CoordPickerExportSuccessTitle),
                MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Red($"{LogPrefix} Export failed: {ex.Message}");
            MessageBox.Show(this, ex.Message, p.GetUiText(I18nKeys.CoordPickerExportErrorTitle), MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static string BuildExportText(DateTime now)
    {
        var p = D3D4TesterI18n.Provider;
        string typeLabel = p.GetUiText(I18nKeys.CoordPickerExportType);
        string coordsLabel = p.GetUiText(I18nKeys.CoordPickerExportCoordsLabel);
        var sb = new StringBuilder();
        sb.Append(p.GetUiText(I18nKeys.CoordPickerExportHeader)).Append(" - ").Append(now.ToString(ExportHeaderTimeFormat, CultureInfo.InvariantCulture)).Append('\n');
        sb.Append(new string(ExportRuleChar, ExportRuleLength)).Append("\n\n");
        foreach (var pick in History)
        {
            sb.Append(pick.Index).Append(". ").Append(pick.Name).Append('\n');
            sb.Append(ExportIndent).Append(typeLabel).Append(": ").Append(pick.TypeName).Append('\n');
            switch (pick.Type)
            {
                case CoordinatePickType.Rect:
                    sb.Append(ExportIndent).Append(coordsLabel).Append($": ({pick.X}, {pick.Y})\n");
                    sb.Append(ExportIndent).Append(p.GetUiText(I18nKeys.CoordPickerExportSize)).Append($": {pick.Width} × {pick.Height}\n");
                    break;
                case CoordinatePickType.Circle:
                    sb.Append(ExportIndent).Append(p.GetUiText(I18nKeys.CoordPickerExportCenter)).Append($": ({pick.X}, {pick.Y})\n");
                    sb.Append(ExportIndent).Append(p.GetUiText(I18nKeys.CoordPickerExportRadius)).Append($": {pick.Radius}\n");
                    break;
                default:
                    sb.Append(ExportIndent).Append(coordsLabel).Append($": ({pick.X}, {pick.Y})\n");
                    break;
            }
            sb.Append('\n');
        }
        return sb.ToString();
    }

    /// <summary>Complete and Close both just close (picks are already in the history). 1:1 Python _on_complete / _on_close.</summary>
    private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();
}
