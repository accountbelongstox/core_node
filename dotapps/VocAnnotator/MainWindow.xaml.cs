using System.Collections.Generic;
using System.IO;
using System.Linq;
using IOPath = System.IO.Path;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Microsoft.Win32;
using DotCore.VocAnnotator;

namespace DotApps.VocAnnotator;

public partial class MainWindow : Window
{
    private string? _imagesDir;
    private string? _saveDir;
    private string? _currentImagePath;
    private (int W, int H) _currentImageSize;
    private List<Dictionary<string, object>> _currentShapes = new();
    private bool _addRectMode;
    private Point _rectStart;
    private Rectangle? _previewRect;
    private const string ProjectConfigFileName = "project_config.json";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        ParseCommandLineAndApply();
        if (string.IsNullOrEmpty(_imagesDir))
            _imagesDir = VocAnnotatorConfig.GetLastImagesDir();
        if (string.IsNullOrEmpty(_saveDir))
            _saveDir = VocAnnotatorConfig.GetLastSaveDir();
        if (!string.IsNullOrEmpty(_saveDir))
            TxtSaveDir.Text = _saveDir;
        LoadClassesFromProject();
        if (!string.IsNullOrEmpty(_imagesDir))
            FillImageList();
    }

    private void ParseCommandLineAndApply()
    {
        var args = Environment.GetCommandLineArgs();
        for (var i = 1; i < args.Length; i++)
        {
            if (args[i] == "--project-path" && i + 1 < args.Length)
            {
                var p = args[i + 1].Trim();
                if (Directory.Exists(p))
                {
                    _saveDir = IOPath.GetFullPath(p);
                    TxtSaveDir.Text = _saveDir;
                    VocAnnotatorConfig.SetLastSaveDir(_saveDir);
                }
                i++;
                continue;
            }
            var path = args[i].Trim();
            if (Directory.Exists(path))
            {
                _imagesDir = IOPath.GetFullPath(path);
                VocAnnotatorConfig.SetLastImagesDir(_imagesDir);
                break;
            }
        }
    }

    private void BtnOpenDir_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            ValidateNames = false,
            CheckFileExists = false,
            CheckPathExists = true,
            FileName = "Folder Selection."
        };
        if (!string.IsNullOrEmpty(_imagesDir) && Directory.Exists(_imagesDir))
            dlg.InitialDirectory = _imagesDir;
        if (dlg.ShowDialog() != true) return;
        var dir = IOPath.GetDirectoryName(dlg.FileName);
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
        _imagesDir = dir;
        VocAnnotatorConfig.SetLastImagesDir(_imagesDir);
        FillImageList();
    }

    private void FillImageList()
    {
        LstImages.Items.Clear();
        if (string.IsNullOrEmpty(_imagesDir) || !Directory.Exists(_imagesDir)) return;
        var exts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".webp" };
        var files = Directory.EnumerateFiles(_imagesDir)
            .Where(f => exts.Contains(IOPath.GetExtension(f)))
            .Select(IOPath.GetFileName)
            .Where(f => !string.IsNullOrEmpty(f))
            .OrderBy(f => f!)
            .ToList();
        foreach (var f in files)
            LstImages.Items.Add(f);
    }

    private void BtnSetSaveDir_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            ValidateNames = false,
            CheckFileExists = false,
            CheckPathExists = true,
            FileName = "Folder Selection."
        };
        if (!string.IsNullOrEmpty(_saveDir) && Directory.Exists(_saveDir))
            dlg.InitialDirectory = _saveDir;
        if (dlg.ShowDialog() != true) return;
        var dir = IOPath.GetDirectoryName(dlg.FileName);
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
        _saveDir = dir;
        VocAnnotatorConfig.SetLastSaveDir(_saveDir);
        TxtSaveDir.Text = _saveDir;
        LoadClassesFromProject();
    }

    private void LoadClassesFromProject()
    {
        LstClasses.Items.Clear();
        var configPath = string.IsNullOrEmpty(_saveDir) ? null : IOPath.Combine(_saveDir, ProjectConfigFileName);
        var classes = ProjectConfig.GetClassesFromConfig(configPath);
        if (classes.Count == 0)
            classes = new List<string> { "object" };
        foreach (var c in classes)
            LstClasses.Items.Add(c);
        if (LstClasses.Items.Count > 0)
            LstClasses.SelectedIndex = 0;
        if (string.IsNullOrEmpty(TxtCurrentClass.Text) && classes.Count > 0)
            TxtCurrentClass.Text = classes[0];
    }

    private void LstClasses_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LstClasses.SelectedItem is string s)
            TxtCurrentClass.Text = s;
    }

    private void LstImages_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LstImages.SelectedItem is not string fileName || string.IsNullOrEmpty(_imagesDir))
            return;
        var path = IOPath.Combine(_imagesDir, fileName);
        if (!File.Exists(path)) return;
        _currentImagePath = path;
        LoadImageAndAnnotations();
        BtnSave.IsEnabled = !string.IsNullOrEmpty(_saveDir);
    }

    private void LoadImageAndAnnotations()
    {
        if (string.IsNullOrEmpty(_currentImagePath) || !File.Exists(_currentImagePath))
            return;
        var dir = !string.IsNullOrEmpty(_saveDir) ? _saveDir! : _imagesDir!;
        _currentShapes = AnnotationIo.LoadAnnotations(_currentImagePath, dir).ToList();

        BitmapImage? bi = null;
        try
        {
            bi = new BitmapImage();
            bi.BeginInit();
            bi.CacheOption = BitmapCacheOption.OnLoad;
            bi.UriSource = new Uri(_currentImagePath, UriKind.Absolute);
            bi.EndInit();
            bi.Freeze();
        }
        catch
        {
            return;
        }

        var w = bi.PixelWidth;
        var h = bi.PixelHeight;
        _currentImageSize = (w, h);

        CanvasImage.Width = w;
        CanvasImage.Height = h;
        ImgDisplay.Source = bi;
        ImgDisplay.Width = w;
        ImgDisplay.Height = h;

        RedrawShapes();
        BtnAddRect.IsEnabled = true;
    }

    private void RedrawShapes()
    {
        var toRemove = CanvasImage.Children.OfType<Rectangle>().ToList();
        foreach (var r in toRemove)
            CanvasImage.Children.Remove(r);

        foreach (var shape in _currentShapes)
        {
            var bbox = ShapeToBbox(shape);
            if (bbox == null) continue;
            var (xmin, ymin, xmax, ymax) = bbox.Value;
            var rect = new Rectangle
            {
                Stroke = Brushes.Lime,
                StrokeThickness = 2,
                Fill = Brushes.Transparent,
                Width = Math.Max(1, xmax - xmin),
                Height = Math.Max(1, ymax - ymin)
            };
            Canvas.SetLeft(rect, xmin);
            Canvas.SetTop(rect, ymin);
            CanvasImage.Children.Add(rect);
        }
    }

    private static (int XMin, int YMin, int XMax, int YMax)? ShapeToBbox(Dictionary<string, object> shape)
    {
        if (!shape.TryGetValue("points", out var ptsObj)) return null;
        var pts = ptsObj as IList<double[]>;
        if (pts == null && ptsObj is IEnumerable<object> en)
            pts = en.OfType<double[]>().ToList();
        if (pts == null || pts.Count < 2) return null;
        var xs = pts.Select(p => p.Length > 0 ? p[0] : 0.0).ToList();
        var ys = pts.Select(p => p.Length > 1 ? p[1] : 0.0).ToList();
        int xmin = (int)xs.Min(), xmax = (int)xs.Max(), ymin = (int)ys.Min(), ymax = (int)ys.Max();
        return (xmin, ymin, xmax, ymax);
    }

    private void BtnAddRect_Click(object sender, RoutedEventArgs e)
    {
        _addRectMode = !_addRectMode;
        BtnAddRect.Content = _addRectMode ? "Cancel (click again)" : "Add rectangle (drag on image)";
        if (!_addRectMode && _previewRect != null)
        {
            CanvasImage.Children.Remove(_previewRect);
            _previewRect = null;
        }
    }

    private void CanvasImage_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (!_addRectMode || sender is not Image img) return;
        var pos = e.GetPosition(img);
        _rectStart = pos;
        _previewRect = new Rectangle
        {
            Stroke = Brushes.Cyan,
            StrokeThickness = 2,
            Fill = Brushes.Transparent,
            Width = 0,
            Height = 0
        };
        Canvas.SetLeft(_previewRect, pos.X);
        Canvas.SetTop(_previewRect, pos.Y);
        CanvasImage.Children.Add(_previewRect);
        img.CaptureMouse();
        e.Handled = true;
    }

    private void CanvasImage_MouseMove(object sender, MouseEventArgs e)
    {
        if (!_addRectMode || _previewRect == null || sender is not Image img) return;
        var pos = e.GetPosition(img);
        var x = Math.Min(_rectStart.X, pos.X);
        var y = Math.Min(_rectStart.Y, pos.Y);
        var w = Math.Abs(pos.X - _rectStart.X);
        var h = Math.Abs(pos.Y - _rectStart.Y);
        Canvas.SetLeft(_previewRect, x);
        Canvas.SetTop(_previewRect, y);
        _previewRect.Width = Math.Max(1, w);
        _previewRect.Height = Math.Max(1, h);
        e.Handled = true;
    }

    private void CanvasImage_MouseUp(object sender, MouseButtonEventArgs e)
    {
        if (!_addRectMode || _previewRect == null || sender is not Image img) return;
        img.ReleaseMouseCapture();
        var pos = e.GetPosition(img);
        var xmin = (int)Math.Min(_rectStart.X, pos.X);
        var ymin = (int)Math.Min(_rectStart.Y, pos.Y);
        var xmax = (int)Math.Max(_rectStart.X, pos.X);
        var ymax = (int)Math.Max(_rectStart.Y, pos.Y);
        if (xmax - xmin < 2 || ymax - ymin < 2)
        {
            CanvasImage.Children.Remove(_previewRect);
            _previewRect = null;
            e.Handled = true;
            return;
        }
        var label = TxtCurrentClass.Text?.Trim() ?? "object";
        var shape = new Dictionary<string, object>
        {
            ["shape_type"] = AnnotationIo.ShapeTypeRectangle,
            ["label"] = label,
            ["points"] = new[] { new[] { (double)xmin, (double)ymin }, new[] { (double)xmax, (double)ymax } },
            ["difficult"] = 0
        };
        _currentShapes.Add(shape);
        CanvasImage.Children.Remove(_previewRect);
        _previewRect = null;
        RedrawShapes();
        e.Handled = true;
    }

    private void BtnSave_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_currentImagePath) || string.IsNullOrEmpty(_saveDir))
        {
            MessageBox.Show("Select an image and set save dir first.", "VOC Annotator", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        try
        {
            AnnotationIo.SaveAnnotations(_currentImagePath, _saveDir, _currentImageSize, _currentShapes, writeVoc: true);
            MessageBox.Show("Saved.", "VOC Annotator", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show("Save failed: " + ex.Message, "VOC Annotator", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
}
