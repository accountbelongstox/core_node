using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Ui;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;
using WpfWindow = System.Windows.Window;

namespace DotApps.d3d4tester.Windows;

/// <summary>One region crop tile of the D4 debug window.</summary>
public sealed class D4RegionImageItem : BaseViewModel
{
    private string _title = "";
    private ImageSource? _image;
    private string _placeholder = "";
    private string _sizeText = "";

    public D4RegionImageItem(string key) => Key = key;

    public string Key { get; }
    public string Title { get => _title; set => SetProperty(ref _title, value); }
    public ImageSource? Image { get => _image; set => SetProperty(ref _image, value); }
    public string Placeholder { get => _placeholder; set => SetProperty(ref _placeholder, value); }
    public string SizeText { get => _sizeText; set => SetProperty(ref _sizeText, value); }
}

/// <summary>
/// D4 debug image window: region crops of the last tick (two columns), D3 bag recognition, pause/continue crop updates, refresh.
/// Opening it sets debug_window_open and starts the D4 tick loop; closing clears it.
/// 1:1 Python pyapps/d3-check/ui/components/debug_window.py (DebugWindow, get_debug_window, close_debug_window, update_debug_window_images_if_open).
/// </summary>
public partial class D4DebugWindow : WpfWindow
{
    private const string LogPrefix = "[DebugWindow]";
    private const int BagMarkerMinRadius = 2;
    private const double BagMarkerRatio = 0.15;
    private const double BagLetterScale = 0.35;
    private const string GlyphPause = "";
    private const string GlyphPlay = "";

    /// <summary>Python regions list order (label = region image key).</summary>
    private static readonly string[] RegionKeys =
    {
        D4RegionNames.TeamCount, D4RegionNames.TeamVote, D4RegionNames.Minimap, D4RegionNames.ExpBar, D4RegionNames.QuestText,
        D4RegionNames.Bag, D4RegionNames.BlacksmithMenu, D4RegionNames.WhisperObols, D4RegionNames.EquipmentLeft,
        D4RegionNames.EquipmentRight, D4RegionNames.BlacksmithFunction, D4RegionNames.MapName, D4RegionNames.DungeonProgress,
        D4RegionNames.FindTeam, D4RegionNames.FormTeam, D4RegionNames.ActivitySelection, D4RegionNames.MinTierInput,
        D4RegionNames.MaxTierInput, D4RegionNames.ConfirmTeam, D4RegionNames.PanelClose, D4RegionNames.MinTierClick,
    };

    private static readonly Scalar BagGridColor = new(160, 160, 160);
    private static readonly Scalar BagLetterColor = new(255, 255, 255);
    private static readonly Scalar BagDefaultQualityColor = new(128, 128, 128);
    private static readonly Dictionary<string, Scalar> BagQualityColors = new(StringComparer.Ordinal)
    {
        [BagSlotValues.QualityEmpty] = new Scalar(100, 100, 100),
        [BagSlotValues.QualityLegendarySet] = new Scalar(0, 200, 0),
        [BagSlotValues.QualityLegendary] = new Scalar(0, 165, 255),
        [BagSlotValues.QualityRare] = new Scalar(0, 255, 255),
        [BagSlotValues.QualityMagic] = new Scalar(255, 128, 0),
        [BagSlotValues.QualityUnknown] = new Scalar(128, 128, 128),
    };

    private readonly ObservableCollection<D4RegionImageItem> _items = new();
    private readonly Dictionary<string, D4RegionImageItem> _itemsByKey = new(StringComparer.Ordinal);
    private int _lastUpdatedCount;
    private int _updateQueued;

    private D4DebugWindow()
    {
        InitializeComponent();
        foreach (var key in ColumnMajorOrder(RegionKeys))
        {
            var item = new D4RegionImageItem(key);
            _items.Add(item);
            _itemsByKey[key] = item;
        }
        RegionItems.ItemsSource = _items;
        RefreshI18n();
        Loaded += (_, _) => QueueUpdate();
        Closed += OnClosed;
        D4Controller.Instance.DebugImagesUpdated += QueueUpdate;
        ColorPrinter.Blue($"{LogPrefix} Debug window created");
    }

    /// <summary>The open window, or null. 1:1 get_popup(POPUP_KEY_DEBUG_WINDOW).</summary>
    public static D4DebugWindow? Current => UiRegistry.GetPopup(AppConstants.PopupKeyDebugWindow) as D4DebugWindow;

    /// <summary>Raised on the UI thread when the window opens (true) or closes (false).</summary>
    public static event Action<bool>? OpenStateChanged;

    /// <summary>Show the window (create once), set debug_window_open and start the tick loop. 1:1 get_debug_window + show.</summary>
    public static D4DebugWindow Open(WpfWindow? owner)
    {
        if (Current is { } existing)
        {
            existing.Activate();
            return existing;
        }
        var window = new D4DebugWindow();
        if (owner is { IsLoaded: true }) window.Owner = owner;
        UiRegistry.RegisterPopup(AppConstants.PopupKeyDebugWindow, window);
        D4InterfaceData.Instance.DebugWindowOpen = true;
        window.Show();
        D4TickLoop.Instance.EnsureRunning();
        OpenStateChanged?.Invoke(true);
        return window;
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        Title = p.GetUiText(I18nKeys.D4DebugWindowTitle);
        TxtHeading.Text = p.GetUiText(I18nKeys.D4DebugWindowHeading);
        TxtRefresh.Text = p.GetUiText(I18nKeys.D4DebugRefresh);
        TxtClose.Text = p.GetUiText(I18nKeys.D4DebugClose);
        TxtBagTitle.Text = p.GetUiText(I18nKeys.D4DebugD3BagTitle);
        TxtRegionsTitle.Text = p.GetUiText(I18nKeys.D4DebugRegionsTitle);
        foreach (var item in _items)
        {
            item.Title = p.GetUiText(I18nKeys.D4DebugRegionPrefix + item.Key.ToLowerInvariant().Replace(' ', '_'));
            if (item.Image == null) item.Placeholder = p.GetUiText(I18nKeys.D4DebugNoImage);
        }
        if (ImgBag.Source == null) TxtBagPlaceholder.Text = p.GetUiText(I18nKeys.D4DebugNoImage);
        RefreshPauseState();
        RefreshRegionCount();
    }

    /// <summary>Python two-column layout fills the left column first; UniformGrid fills rows, so interleave the halves.</summary>
    private static IEnumerable<string> ColumnMajorOrder(IReadOnlyList<string> keys)
    {
        int half = (keys.Count + 1) / 2;
        for (int row = 0; row < half; row++)
        {
            yield return keys[row];
            if (row + half < keys.Count) yield return keys[row + half];
        }
    }

    /// <summary>Build images off the UI thread and apply them; coalesces ticks while an update is pending.</summary>
    private void QueueUpdate()
    {
        if (Interlocked.Exchange(ref _updateQueued, 1) == 1) return;
        Task.Run(() =>
        {
            try
            {
                var regions = BuildRegionImages();
                var bag = BuildBagSection();
                Dispatcher.BeginInvoke(() =>
                {
                    Interlocked.Exchange(ref _updateQueued, 0);
                    if (!IsLoaded) return;
                    ApplyRegionImages(regions);
                    ApplyBagSection(bag);
                });
            }
            catch (Exception ex)
            {
                Interlocked.Exchange(ref _updateQueued, 0);
                ColorPrinter.Red($"{LogPrefix} Update failed: {ex.Message}");
            }
        });
    }

    /// <summary>Region crops as frozen bitmaps (null = no image). 1:1 update_images (data part).</summary>
    private static Dictionary<string, (BitmapSource? Image, int Width, int Height)>? BuildRegionImages()
    {
        var data = D4InterfaceData.Instance;
        ColorPrinter.Blue($"{LogPrefix} Starting update_images...");
        var labels = data.GetRegionImageLabels();
        if (labels.Count == 0)
        {
            ColorPrinter.Yellow($"{LogPrefix} No region images in detected_regions");
            return null;
        }
        ColorPrinter.Blue($"{LogPrefix} Found {labels.Count} region images");
        var result = new Dictionary<string, (BitmapSource?, int, int)>(StringComparer.Ordinal);
        foreach (var key in RegionKeys)
        {
            using var mat = data.CloneRegionImage(key);
            if (mat == null)
            {
                ColorPrinter.Yellow($"{LogPrefix} No image for '{key}'");
                result[key] = (null, 0, 0);
                continue;
            }
            result[key] = (MatImageSource.ToBitmapSource(mat), mat.Width, mat.Height);
        }
        return result;
    }

    private void ApplyRegionImages(Dictionary<string, (BitmapSource? Image, int Width, int Height)>? regions)
    {
        if (regions == null) return;
        var p = D3D4TesterI18n.Provider;
        int updated = 0;
        foreach (var (key, entry) in regions)
        {
            if (!_itemsByKey.TryGetValue(key, out var item)) continue;
            item.Image = entry.Image;
            item.SizeText = entry.Image != null ? $"{entry.Width}x{entry.Height}" : "";
            item.Placeholder = entry.Image != null ? "" : p.GetUiText(I18nKeys.D4DebugNoImage);
            if (entry.Image != null) updated++;
        }
        _lastUpdatedCount = updated;
        RefreshRegionCount();
        ColorPrinter.Green($"{LogPrefix} Updated {updated}/{_items.Count} images");
    }

    private void RefreshRegionCount() =>
        TxtRegionCount.Text = string.Format(D3D4TesterI18n.Provider.GetUiText(I18nKeys.D4DebugRegionCount), _lastUpdatedCount, _items.Count);

    private sealed record BagSection(string Info, BitmapSource? Image, bool HasData, bool HasGameImage);

    /// <summary>D3 bag info lines + cropped bag with grid and quality markers. 1:1 _update_d3_bag_section / _draw_d3_bag_grid_on_pil.</summary>
    private static BagSection BuildBagSection()
    {
        var p = D3D4TesterI18n.Provider;
        var d3 = GameInterfaceData.Instance;
        var coords = d3.BagCoordinates;
        var layout = d3.BagLayout;
        if (coords == null && layout == null)
            return new BagSection(p.GetUiText(I18nKeys.D4DebugD3BagNoData), null, false, false);

        var lines = new List<string>();
        if (coords != null)
        {
            lines.Add(string.Format(p.GetUiText(I18nKeys.D4DebugBagGrid), coords.Rows, coords.Cols, coords.TotalSlots));
            lines.Add(string.Format(p.GetUiText(I18nKeys.D4DebugBagCorners), coords.TopLeft, coords.BottomRight));
            lines.Add(string.Format(p.GetUiText(I18nKeys.D4DebugBagSize), coords.Width, coords.Height));
        }
        if (layout is { Items.Count: > 0 })
        {
            var items = layout.Items;
            int occupied = items.Values.Count(v => v.Type != BagSlotValues.TypeEmpty);
            lines.Add(string.Format(p.GetUiText(I18nKeys.D4DebugBagOccupied), occupied, coords?.TotalSlots ?? 0));
            int Count(string quality) => items.Values.Count(v => v.Quality == quality);
            lines.Add("");
            lines.Add(p.GetUiText(I18nKeys.D4DebugBagQuality));
            lines.Add(string.Format(p.GetUiText(I18nKeys.D4DebugBagQualityCounts),
                Count(BagSlotValues.QualityLegendarySet), Count(BagSlotValues.QualityLegendary), Count(BagSlotValues.QualityRare),
                Count(BagSlotValues.QualityMagic), Count(BagSlotValues.QualityUnknown), Count(BagSlotValues.QualityEmpty)));
            lines.Add("");
            foreach (var kv in items.OrderBy(k => k.Key.Row).ThenBy(k => k.Key.Col))
            {
                if (kv.Value.Type == BagSlotValues.TypeEmpty) continue;
                lines.Add(string.Format(p.GetUiText(I18nKeys.D4DebugBagSlot), kv.Key.Row, kv.Key.Col, kv.Value.Type, kv.Value.Quality));
            }
        }
        else
        {
            lines.Add(p.GetUiText(I18nKeys.D4DebugBagNoLayout));
        }
        var info = string.Join("\n", lines);
        if (coords == null) return new BagSection(info, null, true, false);

        using var bitmap = d3.CloneGameWindowImage();
        if (bitmap == null) return new BagSection(info, null, true, false);
        using var frame = ImageConvert.NormalizeToBgr(bitmap);
        int left = Math.Clamp(coords.TopLeft.X, 0, frame.Width);
        int top = Math.Clamp(coords.TopLeft.Y, 0, frame.Height);
        int right = Math.Clamp(coords.BottomRight.X, left, frame.Width);
        int bottom = Math.Clamp(coords.BottomRight.Y, top, frame.Height);
        if (right - left <= 0 || bottom - top <= 0) return new BagSection(info, null, true, false);
        using var crop = new Mat(frame, new OpenCvSharp.Rect(left, top, right - left, bottom - top)).Clone();
        DrawBagGrid(crop, coords, layout);
        return new BagSection(info, MatImageSource.ToBitmapSource(crop), true, true);
    }

    private static void DrawBagGrid(Mat img, BagCoordinates coords, BagLayout? layout)
    {
        int w = img.Width, h = img.Height;
        if (coords.Rows <= 0 || coords.Cols <= 0) return;
        double slotW = w / (double)coords.Cols;
        double slotH = h / (double)coords.Rows;
        for (int col = 0; col <= coords.Cols; col++)
        {
            int x = (int)(col * slotW);
            Cv2.Line(img, new OpenCvSharp.Point(x, 0), new OpenCvSharp.Point(x, h), BagGridColor, 1);
        }
        for (int row = 0; row <= coords.Rows; row++)
        {
            int y = (int)(row * slotH);
            Cv2.Line(img, new OpenCvSharp.Point(0, y), new OpenCvSharp.Point(w, y), BagGridColor, 1);
        }
        if (layout is not { Items.Count: > 0 } || layout.Layout.Count == 0) return;
        int r = Math.Max(BagMarkerMinRadius, Math.Min((int)(slotW * BagMarkerRatio), (int)(slotH * BagMarkerRatio)));
        for (int row = 0; row < coords.Rows; row++)
        {
            for (int col = 0; col < coords.Cols; col++)
            {
                if (row < layout.Layout.Count && col < layout.Layout[row].Count && layout.Layout[row][col] == BagSlotValues.LayoutItem2SlotBottom)
                    continue;
                if (!layout.Items.TryGetValue((row, col), out var info)) continue;
                int cx = (int)((col + 0.5) * slotW);
                int cy = (int)((row + 0.5) * slotH);
                var quality = string.IsNullOrEmpty(info.Quality) ? BagSlotValues.QualityUnknown : info.Quality;
                var color = BagQualityColors.TryGetValue(quality, out var c) ? c : BagDefaultQualityColor;
                Cv2.Rectangle(img, new OpenCvSharp.Point(cx - r, cy - r), new OpenCvSharp.Point(cx + r, cy + r), color, -1);
                var letter = char.ToUpperInvariant(quality[0]).ToString();
                Cv2.PutText(img, letter, new OpenCvSharp.Point(cx - 4, cy + 4), HersheyFonts.HersheySimplex, BagLetterScale, BagLetterColor, 1);
            }
        }
    }

    private void ApplyBagSection(BagSection bag)
    {
        var p = D3D4TesterI18n.Provider;
        TxtBagInfo.Text = bag.Info;
        ImgBag.Source = bag.Image;
        TxtBagPlaceholder.Text = bag.Image != null ? "" : p.GetUiText(bag.HasData ? I18nKeys.D4DebugNoGameImage : I18nKeys.D4DebugNoImage);
    }

    /// <summary>1:1 _toggle_pause.</summary>
    private void BtnPause_Click(object sender, RoutedEventArgs e)
    {
        var data = D4InterfaceData.Instance;
        data.DebugWindowPaused = !data.DebugWindowPaused;
        if (data.DebugWindowPaused) ColorPrinter.Yellow($"{LogPrefix} Image updates PAUSED - viewing frozen snapshot");
        else ColorPrinter.Green($"{LogPrefix} Image updates RESUMED");
        RefreshPauseState();
    }

    private void RefreshPauseState()
    {
        var p = D3D4TesterI18n.Provider;
        bool paused = D4InterfaceData.Instance.DebugWindowPaused;
        TxtPause.Text = p.GetUiText(paused ? I18nKeys.D4DebugResume : I18nKeys.D4DebugPause);
        IconPause.Text = paused ? GlyphPlay : GlyphPause;
        BtnPause.Style = (Style)FindResource(paused ? "SuccessButtonStyle" : "WarningButtonStyle");
        TxtLive.Text = p.GetUiText(paused ? I18nKeys.D4DebugPaused : I18nKeys.D4DebugLive);
        ChipLive.Style = (Style)FindResource(paused ? "StatusChipWarningStyle" : "StatusChipSuccessStyle");
    }

    private void BtnRefresh_Click(object sender, RoutedEventArgs e) => QueueUpdate();

    private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();

    /// <summary>1:1 _on_close.</summary>
    private void OnClosed(object? sender, EventArgs e)
    {
        D4Controller.Instance.DebugImagesUpdated -= QueueUpdate;
        D4InterfaceData.Instance.DebugWindowOpen = false;
        UiRegistry.UnregisterPopup(AppConstants.PopupKeyDebugWindow);
        ColorPrinter.Yellow($"{LogPrefix} Debug window closed");
        OpenStateChanged?.Invoke(false);
    }
}
